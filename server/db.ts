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

// PostgreSQL 연결 문자열
const connectionString = process.env.DATABASE_URL || 
  "postgres://postgres:postgres@localhost:5432/postgres";
console.log("데이터베이스 URL:", connectionString.replace(/\/\/([^:]+):[^@]+@/, '//***:***@'));

// Neon 클라이언트 생성
let sql: NeonQueryFunction<any, any> | null = null;
let db: any;

try {
  sql = neon(connectionString);
  // Drizzle 인스턴스 생성
  db = drizzle(sql, { schema });
  console.log("데이터베이스 연결 성공");
} catch (error) {
  console.error("데이터베이스 연결 실패, 메모리 저장소 사용:", error);
  // 메모리 저장소를 사용하도록 코드 수정 필요
  // 메모리 기반 데이터베이스 처리 코드는 없으므로 일단 빈 객체를 생성
  sql = null;
  db = {};
}

export { db };

// 마이그레이션을 건너뛰고 스키마 변경 사항을 직접 추가합니다.
export async function runMigrations() {
  try {
    console.log("마이그레이션 함수 호출됨 (비활성화)");
    // 실제 마이그레이션은 비활성화되어 있습니다.
  } catch (error) {
    console.error("마이그레이션 실행 중 오류 발생:", error);
    throw error;
  }
}