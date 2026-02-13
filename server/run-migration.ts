import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// 환경 변수 로드
const envPath = path.join(process.cwd(), '.env');
console.log('🔍 .env 파일 경로:', envPath);
dotenv.config({ path: envPath });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function runMigration() {
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('🚀 마이그레이션 시작...\n');
    
    // db/migrations 디렉토리의 모든 SQL 파일 읽기
    const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`📁 발견된 마이그레이션 파일: ${files.length}개\n`);
    
    for (const file of files) {
      console.log(`📄 실행 중: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      // SQL 문을 세미콜론으로 분리하여 각각 실행
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement) {
          try {
            console.log('  📝', statement.substring(0, 60).replace(/\n/g, ' ') + '...');
            await sql(statement);
            console.log('  ✅ 성공');
          } catch (error: any) {
            // 이미 존재하는 테이블/컬럼은 무시
            if (error.code === '42P07' || error.code === '42701' || error.code === '42P16' || error.code === '42P01') {
              console.log('  ⚠️  이미 존재하거나 관련 오류 (무시)');
            } else {
              console.error('  ❌ 오류:', error.message);
              throw error;
            }
          }
        }
      }
      console.log('');
    }
    
    console.log('✨ 모든 마이그레이션이 완료되었습니다!');
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

runMigration();

