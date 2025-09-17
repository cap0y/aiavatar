import 'dotenv/config';
import { drizzle } from "drizzle-orm/neon-http";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "../shared/schema";

// 런타임 디렉터리 계산 (pkg/CJS/ESM 호환)
const isPkg = typeof (process as any).pkg !== 'undefined';
const runtimeDirname = isPkg
  ? process.cwd()
  : (typeof __dirname !== 'undefined'
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url))
    );

// PostgreSQL 연결 문자열 - Replit 환경 변수 우선 사용
let connectionString = process.env.DATABASE_URL || 
  process.env.REPLIT_DB_URL || 
  process.env.NEON_DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/postgres";

// SSL 설정 추가 (Neon DB는 SSL이 필요함)
if (connectionString.includes('neon.tech') && !connectionString.includes('sslmode=')) {
  connectionString += connectionString.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

console.log("데이터베이스 URL:", connectionString.replace(/\/\/([^:]+):[^@]+@/, '//***:***@'));

// Neon 클라이언트 생성
let sql: NeonQueryFunction<any, any> | null = null;
let db: any;

// 데이터베이스 연결 시도 함수
async function connectToDatabase() {
  try {
    // Neon 연결 설정
    sql = neon(connectionString);
    
    // 연결 테스트
    await sql`SELECT 1`;
    
    // Drizzle 인스턴스 생성
    db = drizzle(sql, { schema });
    console.log("데이터베이스 연결 성공 (Neon)");
    return true;
  } catch (error) {
    console.error("Neon 데이터베이스 연결 실패:", error);
    
    // 로컬 PostgreSQL 연결 시도 (pg 모듈 사용)
    try {
      console.log("로컬 PostgreSQL 연결 시도 (pg 모듈)...");
      const pool = new Pool({
        connectionString: "postgres://postgres:postgres@localhost:5432/postgres"
      });
      
      // 연결 테스트
      await pool.query('SELECT 1');
      
      // Drizzle 인스턴스 생성 (pg 용)
      db = drizzlePg(pool, { schema });
      console.log("로컬 데이터베이스 연결 성공 (pg)");
      return true;
    } catch (pgError) {
      console.error("로컬 데이터베이스 연결 실패 (pg):", pgError);
      
      // 두 번째 방법으로 다시 시도 (neon 라이브러리로 로컬 연결)
      try {
        console.log("로컬 PostgreSQL 연결 시도 (neon)...");
        const localConnectionString = "postgres://postgres:postgres@localhost:5432/postgres";
        sql = neon(localConnectionString);
        await sql`SELECT 1`;
        db = drizzle(sql, { schema });
        console.log("로컬 데이터베이스 연결 성공 (neon)");
        return true;
      } catch (localError) {
        console.error("로컬 데이터베이스 연결 실패, 메모리 저장소 사용:", localError);
        return false;
      }
    }
  }
}

// 초기 연결 시도
try {
  // 비동기 함수를 동기적으로 실행하기 위한 즉시 실행 함수
  (async () => {
    const connected = await connectToDatabase();
    if (!connected) {
      // 연결 실패 시 대체 로직
      console.error("대체 데이터베이스 연결 시도 중...");
      
      // 임시 메모리 객체
      db = {
        query: async () => [],
        select: () => ({ from: () => ({ where: () => [] }) }),
        insert: () => ({ values: () => [] }),
        update: () => ({ set: () => ({ where: () => [] }) }),
        delete: () => ({ where: () => [] })
      };
      console.log("임시 메모리 객체로 대체됨");
    }
  })();
} catch (error) {
  console.error("초기 데이터베이스 연결 설정 오류:", error);
  
  // 임시 메모리 객체
  db = {
    query: async () => [],
    select: () => ({ from: () => ({ where: () => [] }) }),
    insert: () => ({ values: () => [] }),
    update: () => ({ set: () => ({ where: () => [] }) }),
    delete: () => ({ where: () => [] })
  };
  console.log("임시 메모리 객체로 대체됨 (오류 발생)");
}

export { db };

// 마이그레이션 함수 - 실제로 마이그레이션 실행
export async function runMigrations() {
  try {
    console.log("마이그레이션 함수 호출됨");
    
    if (!sql) {
      // 연결이 없으면 다시 시도
      const connected = await connectToDatabase();
      if (!connected) {
        console.error("SQL 클라이언트가 없어 마이그레이션을 실행할 수 없습니다.");
        return;
      }
    }
    
    // 여기에 마이그레이션 로직 추가
    // 예: 마이그레이션 파일 실행
    const migrationsDir = path.join(runtimeDirname, '..', 'server', 'migrations');
    
    console.log(`마이그레이션 디렉토리: ${migrationsDir}`);
    
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      console.log(`발견된 마이그레이션 파일: ${migrationFiles.join(', ')}`);
      
      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        
        console.log(`마이그레이션 실행 중: ${file}`);
        try {
          if (sql) {
            await sql(sqlContent);
            console.log(`마이그레이션 성공: ${file}`);
          }
        } catch (error) {
          console.error(`마이그레이션 실패 (${file}):`, error);
          // 계속 진행
        }
      }
    } else {
      console.log("마이그레이션 디렉토리를 찾을 수 없습니다.");
    }
  } catch (error) {
    console.error("마이그레이션 실행 중 오류 발생:", error);
  }
}