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
import { VTuberServer } from './vtuber-server.js';

// 런타임 루트 디렉터리 (모든 환경에서 안전)
const isPkg = typeof (process as any).pkg !== 'undefined';
const rootDir = isPkg
  ? path.resolve(path.dirname(process.execPath), "..")
  : process.cwd();

// 환경 변수 로드
const envPath = path.join(rootDir, ".env");
console.log('🔍 .env 파일 경로:', envPath);
dotenv.config({ path: envPath });

// 환경변수 확인 로그
console.log('🔑 환경변수 로드 확인:', {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `✅ 로드됨 (${process.env.OPENAI_API_KEY.substring(0, 20)}...)` : '❌ 없음',
  VITE_OPENAI_API_KEY: process.env.VITE_OPENAI_API_KEY ? `✅ 로드됨 (${process.env.VITE_OPENAI_API_KEY.substring(0, 20)}...)` : '❌ 없음',
  DATABASE_URL: process.env.DATABASE_URL ? '✅ 로드됨' : '❌ 없음'
});

const app = express();

// ✅ 헬스체크 - 최상단 등록 (DB/Firebase 초기화 전에도 응답 가능)
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// CORS 설정
app.use(cors());

// JSON 파싱 - 이미지 업로드를 위해 크기 제한 증가
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// TTS 오디오 파일 서빙을 위한 public 폴더 설정
const publicPath = path.join(process.cwd(), "public");
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
  console.log("📁 public 폴더 생성:", publicPath);
}

// 필요한 하위 폴더 생성
const audioPath = path.join(publicPath, 'audio');
const imagesPath = path.join(publicPath, 'images');
const personalAvatarsPath = path.join(publicPath, 'personal-avatars');
const libsPath = path.join(publicPath, 'libs');
const live2dModelsPath = path.join(publicPath, 'live2d-models');

[audioPath, imagesPath, personalAvatarsPath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("📁 폴더 생성:", dir);
  }
});

console.log("🎵 TTS 오디오 폴더 준비:", audioPath);
console.log("📁 오디오 파일 절대 경로:", path.resolve(audioPath));

// ⚡⚡⚡ 최우선: 오디오 파일 서빙 - 다른 모든 것보다 먼저! ⚡⚡⚡
console.log("\n");
console.log("=".repeat(80));
console.log("🎵 오디오 파일 서빙 핸들러 등록 중 (최우선)...");
console.log("=".repeat(80));

// OPTIONS 요청 처리 (CORS preflight)
app.options('/audio/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.sendStatus(200);
});

// GET/HEAD 요청 처리
const handleAudioRequest = async (req: any, res: any) => {
  try {
    const fileName = req.path.replace('/audio/', '');
    const filePath = path.join(audioPath, fileName);
    
    console.log('🎵 오디오 파일 직접 요청:', {
      method: req.method,
      url: req.url,
      fileName: fileName,
      filePath: filePath,
      exists: fs.existsSync(filePath)
    });
    
    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      console.error('❌ 오디오 파일 없음:', filePath);
      return res.status(404).send('Audio file not found');
    }
    
    // Content-Type 결정
    let contentType = 'application/octet-stream';
    if (fileName.endsWith('.mp3')) {
      contentType = 'audio/mpeg';
    } else if (fileName.endsWith('.opus')) {
      contentType = 'audio/opus';
    } else if (fileName.endsWith('.ogg')) {
      contentType = 'audio/ogg';
    } else if (fileName.endsWith('.wav')) {
      contentType = 'audio/wav';
    }
    
    const fileStats = fs.statSync(filePath);
    
    console.log('✅ 오디오 파일 서빙:', {
      method: req.method,
      fileName: fileName,
      contentType: contentType,
      size: fileStats.size
    });
    
    // CORS 및 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileStats.size);
    
    // HEAD 요청은 헤더만 반환
    if (req.method === 'HEAD') {
      return res.end();
    }
    
    // 파일 전송
    res.sendFile(filePath);
  } catch (error) {
    console.error('❌ 오디오 파일 서빙 오류:', error);
    res.status(500).send('Error serving audio file');
  }
};

app.get('/audio/*', handleAudioRequest);
app.head('/audio/*', handleAudioRequest);
console.log("=".repeat(80));
console.log("✅ 오디오 파일 서빙 핸들러 등록 완료 (글로벌 스코프)");
console.log("📁 오디오 경로:", audioPath);
console.log("🔗 핸들러:", "app.get('/audio/*')");
console.log("=".repeat(80));
console.log("\n");

// 정적 파일 서빙 설정 - 클라이언트 빌드 파일 경로 계산
const distPublicUnderProjectRoot = path.join(rootDir, "dist", "public");
const distPublicUnderDist = path.join(rootDir, "public");
const distPath = fs.existsSync(distPublicUnderProjectRoot)
  ? distPublicUnderProjectRoot
  : distPublicUnderDist;

console.log("클라이언트 빌드 파일 경로:", distPath);
console.log("클라이언트 빌드 파일 존재:", fs.existsSync(distPath));

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
    
    // AI 이미지 생성을 위한 타임아웃 증가 (120초)
    httpServer.timeout = 120000;
    httpServer.keepAliveTimeout = 120000;
    httpServer.headersTimeout = 120000;
    
    // Socket.io 서버 설정
    setupSocketServer(httpServer);
    
    // VTuber WebSocket 서버 설정
    console.log("🤖 VTuber WebSocket 서버 초기화 중...");
    let vtuberServer: VTuberServer | null = null;
    try {
      vtuberServer = new VTuberServer(httpServer);
      console.log("✅ VTuber WebSocket 서버 초기화 완료");
    } catch (e) {
      console.error("❌ VTuber 서버 초기화 실패 (서버는 계속 실행):", e);
    }
    
    // 이미지 및 기타 정적 파일 서빙
    app.use('/images', express.static(imagesPath));
    app.use('/personal-avatars', express.static(personalAvatarsPath));

    // Live2D 라이브러리 & 모델 직접 서빙 (Vite 빌드 출력에 의존하지 않음)
    if (fs.existsSync(libsPath)) {
      console.log("📦 /libs 정적 파일 서빙:", libsPath);
      app.use('/libs', express.static(libsPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
          } else if (filePath.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          }
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }));
    } else {
      console.warn("⚠️ /libs 폴더 없음:", libsPath);
    }

    if (fs.existsSync(live2dModelsPath)) {
      app.use('/live2d-models', express.static(live2dModelsPath, {
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }));
    }

    // 클라이언트 빌드 파일 서빙 (정적 리소스용)
    if (fs.existsSync(distPath)) {
      console.log("📦 클라이언트 정적 파일 서빙:", distPath);
      app.use(express.static(distPath, {
        index: false, // index.html 자동 서빙 비활성화
        setHeaders: (res, filePath) => {
          // JS, CSS 등 정적 파일에만 캐싱 적용
          if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
          }
        }
      }));
    }
    
    // 클라이언트 라우트를 위한 모든 요청 처리 (API와 정적 파일 제외)
    if (fs.existsSync(distPath)) {
      app.use((req, res, next) => {
        // 정적 파일과 API 경로는 다음 미들웨어로
        if (req.path.startsWith('/api') || 
            req.path.startsWith('/audio') || 
            req.path.startsWith('/images') ||
            req.path.startsWith('/personal-avatars') ||
            req.path.startsWith('/libs') ||
            req.path.startsWith('/live2d-models') ||
            req.path.startsWith('/feed-media') ||
            req.path.startsWith('/client-ws')) {
          return next();
        }
        // HTML 파일 요청이거나 확장자가 없는 경우 SPA로
        if (req.method === 'GET' && !path.extname(req.path)) {
          return res.sendFile(path.join(distPath, "index.html"));
        }
        next();
      });
    }
    
    // 라우트 등록
    await registerRoutes(app);
    
    if (!fs.existsSync(distPath)) {
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
