import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env 파일 로드
config();

// 데이터베이스 연결
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigrations() {
  try {
    console.log("🚀 마이그레이션 시작...");
    
    const migrationsDir = join(__dirname, "..", "db", "migrations");
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    console.log(`📁 발견된 마이그레이션 파일: ${files.length}개`);

    for (const file of files) {
      console.log(`\n📄 실행 중: ${file}`);
      const filePath = join(migrationsDir, file);
      const sqlContent = readFileSync(filePath, "utf-8");
      
      // 여러 개의 SQL 문을 세미콜론으로 분리하여 실행
      const statements = sqlContent
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await sql(statement);
          console.log(`  ✅ 성공`);
        } catch (error) {
          // 이미 존재하는 경우는 무시
          if (error.code === "42P07" || error.code === "42701") {
            console.log(`  ⚠️  이미 존재함 (무시)`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log("\n✨ 모든 마이그레이션이 완료되었습니다!");
  } catch (error) {
    console.error("\n❌ 마이그레이션 실행 중 오류 발생:", error);
    process.exit(1);
  }
}

runMigrations();

