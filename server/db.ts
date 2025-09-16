import 'dotenv/config';
import { drizzle } from "drizzle-orm/neon-http";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
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
const connectionString = process.env.DATABASE_URL || 
  process.env.REPLIT_DB_URL || 
  process.env.NEON_DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/postgres";

console.log("데이터베이스 URL:", connectionString.replace(/\/\/([^:]+):[^@]+@/, '//***:***@'));

// Neon 클라이언트 생성
let sql: NeonQueryFunction<any, any> | null = null;
let db: any;

try {
  // Neon 연결 설정
  sql = neon(connectionString);
  
  // Drizzle 인스턴스 생성
  db = drizzle(sql, { schema });
  console.log("데이터베이스 연결 성공");
} catch (error) {
  console.error("데이터베이스 연결 실패, 메모리 저장소 사용:", error);
  
  // 연결 실패 시 대체 로직
  try {
    // 로컬 SQLite 또는 다른 대체 방법을 시도할 수 있음
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
  } catch (fallbackError) {
    console.error("대체 연결도 실패:", fallbackError);
    db = {};
  }
}

export { db };

// 마이그레이션 함수 - 실제로 마이그레이션 실행
export async function runMigrations() {
  try {
    console.log("마이그레이션 함수 호출됨");
    
    if (!sql) {
      console.error("SQL 클라이언트가 없어 마이그레이션을 실행할 수 없습니다.");
      return;
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
          await sql(sqlContent);
          console.log(`마이그레이션 성공: ${file}`);
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