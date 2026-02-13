import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://neondb_owner:npg_QJt2FSMbds9m@ep-spring-sun-aflggxu7.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function backup() {
  await client.connect();
  console.log('Connected to database.');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const lines = [];

  lines.push('--');
  lines.push('-- PostgreSQL database dump');
  lines.push(`-- Backup date: ${new Date().toISOString()}`);
  lines.push('--');
  lines.push('');
  lines.push('');

  // ============================================================
  // 1) Sequences - 테이블보다 먼저 생성해야 nextval 참조가 가능
  // ============================================================
  const seqListResult = await client.query(`
    SELECT c.relname AS sequencename,
           s.seqstart AS start_value,
           s.seqmin AS min_value,
           s.seqmax AS max_value,
           s.seqincrement AS increment_by,
           s.seqcache AS cache_size,
           s.seqcycle AS is_cycle,
           format_type(s.seqtypid, NULL) AS data_type
    FROM pg_class c
    JOIN pg_sequence s ON s.seqrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY c.relname
  `);

  if (seqListResult.rows.length > 0) {
    lines.push('--');
    lines.push('-- Sequences');
    lines.push('--');
    lines.push('');

    for (const seq of seqListResult.rows) {
      console.log(`Backing up sequence: ${seq.sequencename}`);
      lines.push(`DROP SEQUENCE IF EXISTS public.${quoteIdent(seq.sequencename)} CASCADE;`);
      lines.push(`CREATE SEQUENCE public.${quoteIdent(seq.sequencename)}`);
      lines.push(`    AS ${seq.data_type || 'bigint'}`);
      lines.push(`    INCREMENT BY ${seq.increment_by}`);
      lines.push(`    MINVALUE ${seq.min_value}`);
      lines.push(`    MAXVALUE ${seq.max_value}`);
      lines.push(`    START WITH ${seq.start_value}`);
      lines.push(`    CACHE ${seq.cache_size}${seq.is_cycle ? ' CYCLE' : ' NO CYCLE'};`);
      lines.push('');

      // Set current sequence value
      try {
        const seqValResult = await client.query(
          `SELECT last_value, is_called FROM public.${quoteIdent(seq.sequencename)}`
        );
        if (seqValResult.rows.length > 0) {
          const { last_value, is_called } = seqValResult.rows[0];
          lines.push(`SELECT pg_catalog.setval('public.${quoteIdentInString(seq.sequencename)}', ${last_value}, ${is_called});`);
          lines.push('');
        }
      } catch (e) {
        lines.push(`-- Could not get sequence value for ${seq.sequencename}`);
        lines.push('');
      }
    }
  }

  // ============================================================
  // 2) Tables - CREATE TABLE + Data
  // ============================================================
  const tablesResult = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tables = tablesResult.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

  for (const table of tables) {
    console.log(`Backing up table: ${table}`);

    // Get column info
    const colResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length, 
             column_default, is_nullable, udt_name,
             numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    // Build CREATE TABLE
    lines.push('--');
    lines.push(`-- Name: ${table}; Type: TABLE; Schema: public`);
    lines.push('--');
    lines.push('');
    lines.push(`DROP TABLE IF EXISTS public.${quoteIdent(table)} CASCADE;`);
    lines.push('');
    lines.push(`CREATE TABLE public.${quoteIdent(table)} (`);

    const colDefs = [];
    for (const col of colResult.rows) {
      let typeName = getTypeName(col);
      let def = `    ${quoteIdent(col.column_name)} ${typeName}`;
      if (col.column_default !== null) {
        def += ` DEFAULT ${col.column_default}`;
      }
      if (col.is_nullable === 'NO') {
        def += ' NOT NULL';
      }
      colDefs.push(def);
    }
    lines.push(colDefs.join(',\n'));
    lines.push(');');
    lines.push('');

    // Get primary key
    const pkResult = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [table]);

    if (pkResult.rows.length > 0) {
      const pkCols = pkResult.rows.map(r => quoteIdent(r.column_name)).join(', ');
      lines.push(`ALTER TABLE ONLY public.${quoteIdent(table)}`);
      lines.push(`    ADD CONSTRAINT ${quoteIdent(table + '_pkey')} PRIMARY KEY (${pkCols});`);
      lines.push('');
    }

    // Get data
    const dataResult = await client.query(`SELECT * FROM public.${quoteIdent(table)}`);
    
    if (dataResult.rows.length > 0) {
      lines.push('--');
      lines.push(`-- Data for Name: ${table}; Type: TABLE DATA; Schema: public`);
      lines.push('--');
      lines.push('');

      const columns = colResult.rows.map(c => c.column_name);
      const colNames = columns.map(c => quoteIdent(c)).join(', ');

      for (const row of dataResult.rows) {
        const values = columns.map(col => escapeSqlValue(row[col]));
        lines.push(`INSERT INTO public.${quoteIdent(table)} (${colNames}) VALUES (${values.join(', ')});`);
      }
      lines.push('');
    }
  }

  // Get foreign keys
  lines.push('--');
  lines.push('-- Foreign Key Constraints');
  lines.push('--');
  lines.push('');

  const fkResult = await client.query(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name
  `);

  for (const fk of fkResult.rows) {
    lines.push(`ALTER TABLE ONLY public.${quoteIdent(fk.table_name)}`);
    lines.push(`    ADD CONSTRAINT ${quoteIdent(fk.constraint_name)} FOREIGN KEY (${quoteIdent(fk.column_name)}) REFERENCES public.${quoteIdent(fk.foreign_table_name)}(${quoteIdent(fk.foreign_column_name)});`);
    lines.push('');
  }

  // Get indexes
  lines.push('--');
  lines.push('-- Indexes');
  lines.push('--');
  lines.push('');

  const idxResult = await client.query(`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
    ORDER BY tablename, indexname
  `);

  for (const idx of idxResult.rows) {
    lines.push(idx.indexdef + ';');
  }
  lines.push('');

  lines.push('--');
  lines.push('-- PostgreSQL database dump complete');
  lines.push('--');

  const sqlContent = lines.join('\n');
  const fileName = `prod_db_backup_${timestamp}.sql`;

  const fs = await import('fs');
  const path = await import('path');
  const backupDir = path.join(process.cwd(), 'backup');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filePath = path.join(backupDir, fileName);
  fs.writeFileSync(filePath, sqlContent, 'utf8');
  
  console.log(`\nBackup saved to: ${filePath}`);
  console.log(`Total tables: ${tables.length}`);

  await client.end();
  console.log('Done!');
}

function quoteIdent(name) {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

// setval() 등 SQL 문자열 리터럴 안에서 사용할 이름 (대문자 포함 시 큰따옴표 필요)
function quoteIdentInString(name) {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name;
  return `"${name}"`;
}

function getTypeName(col) {
  const { data_type, character_maximum_length, udt_name, numeric_precision, numeric_scale } = col;
  
  switch (data_type) {
    case 'character varying':
      return character_maximum_length ? `character varying(${character_maximum_length})` : 'character varying';
    case 'character':
      return character_maximum_length ? `character(${character_maximum_length})` : 'character';
    case 'numeric':
      if (numeric_precision && numeric_scale) return `numeric(${numeric_precision},${numeric_scale})`;
      if (numeric_precision) return `numeric(${numeric_precision})`;
      return 'numeric';
    case 'integer': return 'integer';
    case 'bigint': return 'bigint';
    case 'smallint': return 'smallint';
    case 'boolean': return 'boolean';
    case 'text': return 'text';
    case 'timestamp with time zone': return 'timestamp with time zone';
    case 'timestamp without time zone': return 'timestamp without time zone';
    case 'date': return 'date';
    case 'double precision': return 'double precision';
    case 'real': return 'real';
    case 'json': return 'json';
    case 'jsonb': return 'jsonb';
    case 'uuid': return 'uuid';
    case 'bytea': return 'bytea';
    case 'ARRAY': return udt_name.replace(/^_/, '') + '[]';
    case 'USER-DEFINED': return udt_name;
    default: return data_type;
  }
}

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return val.toString();
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});

