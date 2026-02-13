// Windows 서버에서 실행할 간단한 업로드 서버

// D:\aiavatar\ 폴더에 이 파일을 저장하고 실행

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3008; // 다른 포트와 겹치지 않게

// CORS 허용 (Replit에서 접근 가능하도록)
app.use(cors());

// 업로드 디렉토리 설정
const UPLOAD_DIR = path.join(__dirname, 'feed-media');

// 폴더가 없으면 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 정적 파일 서빙 추가 - feed-media 폴더를 /aiavatar/feed-media 경로로 서빙
app.use('/aiavatar/feed-media', express.static(UPLOAD_DIR));

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `feed-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// 업로드 API
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('✅ 파일 업로드 완료:', {
      filename: req.file.filename,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
      path: req.file.path,
    });

    // Replit에 반환할 URL - 포트 포함하여 정확한 URL 반환
    const fileUrl = `http://115.160.0.166:3008/aiavatar/feed-media/${req.file.filename}`;

    res.json({
      success: true,
      filename: req.file.filename,
      url: fileUrl,
      size: req.file.size,
    });
  } catch (error) {
    console.error('❌ 업로드 오류:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// 상태 확인 API
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uploadDir: UPLOAD_DIR });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 업로드 서버 실행 중: http://115.160.0.166:${PORT}`);
  console.log(`📁 업로드 폴더: ${UPLOAD_DIR}`);
  console.log(`🌐 정적 파일 서빙: http://115.160.0.166:${PORT}/aiavatar/feed-media/`);
});

