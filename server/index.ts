import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { registerRoutes } from "./routes.js";
import { runMigrations } from "./db.js"; // 마이그레이션 활성화
import { storage, initializeStorage } from "./storage.js";
import fs from "fs";
import http from 'http';
import { setupSocketServer } from './socket-server.js';

// 런타임 루트 디렉터리 (모든 환경에서 안전)
const isPkg = typeof (process as any).pkg !== 'undefined';
const rootDir = isPkg
  ? path.resolve(path.dirname(process.execPath), "..")
  : process.cwd();

// 환경 변수 로드
dotenv.config({ path: path.join(rootDir, ".env") });

const app = express();

// CORS 설정
app.use(cors());

// JSON 파싱 - 이미지 업로드를 위해 크기 제한 증가
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 정적 파일 서빙 설정 - 클라이언트 빌드 파일이 있는 경우에만
const distPublicUnderProjectRoot = path.join(rootDir, "dist", "public");
const distPublicUnderDist = path.join(rootDir, "public");
const distPath = fs.existsSync(distPublicUnderProjectRoot)
  ? distPublicUnderProjectRoot
  : distPublicUnderDist;
if (fs.existsSync(distPath)) {
  console.log("클라이언트 빌드 파일 서빙:", distPath);
  app.use(express.static(distPath));
} else {
  console.log("클라이언트 빌드 파일이 없습니다. API 서버만 실행합니다.");
}

// API 경로 설정
console.log("API 라우트 등록 중...");
const startServer = async () => {
  try {
    // 마이그레이션 실행
    console.log("데이터베이스 마이그레이션 실행 중...");
    try {
      await runMigrations();
      console.log("마이그레이션 완료");
    } catch (migrationError) {
      console.error("마이그레이션 실패:", migrationError);
      // 마이그레이션 실패해도 서버는 계속 실행
    }
    
    // 스토리지 초기화 (데이터베이스 연결 상태에 따라 MemStorage 또는 DatabaseStorage 선택)
    console.log("스토리지 초기화 중...");
    try {
      await initializeStorage();
      console.log("스토리지 초기화 완료");
    } catch (storageError) {
      console.error("스토리지 초기화 실패:", storageError);
      console.log("기본 메모리 스토리지로 계속 진행");
    }
    
    // HTTP 서버 생성
    const httpServer = http.createServer(app);
    
    // Socket.io 서버 설정
    setupSocketServer(httpServer);
    
    // 라우트 등록
    await registerRoutes(app);
    
    // 클라이언트 라우트를 위한 모든 요청 처리
    if (fs.existsSync(distPath)) {
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      // API 서버만 실행 중인 경우 루트 경로 처리
      app.get("/", (req, res) => {
        res.json({ 
          message: "API 서버가 실행 중입니다",
          documentation: "API 문서는 /api/docs 에서 확인할 수 있습니다.",
          time: new Date().toISOString()
        });
      });
    }
    
    // 포트 설정 - 5000 대신 5001 포트 사용
    const port = parseInt(process.env.PORT || (process.env.NODE_ENV === 'production' ? '8080' : '5001'));
    
    // 서버 시작 - Cloud Run 호환을 위해 항상 0.0.0.0으로 바인딩 (모든 인터페이스에서 접근 가능)
    const host = '0.0.0.0';
    httpServer.listen(port, host, () => {
      console.log(`서버 실행 중: http://${host}:${port}`);
      console.log(`API 엔드포인트: http://${host}:${port}/api`);
      console.log(`WebSocket 서버 실행 중: ws://${host}:${port}`);
      
      // 개발 서버 안내
      if (process.env.NODE_ENV === "development" && !fs.existsSync(distPath)) {
        console.log("\n개발 모드 안내:");
        console.log("클라이언트 개발 서버를 다음 명령어로 실행하세요:");
        console.log("cd client && npm run dev");
      }
    });
  } catch (error) {
    console.error("서버 시작 중 오류 발생:", error);
    process.exit(1);
  }
};

// 서버 시작
startServer();
