// @ts-nocheck
import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertUserSchema, insertBookingSchema, insertMessageSchema, createUserWithHash, verifyPassword, users } from "../shared/schema.ts";
import axios from "axios";
import qs from "querystring";
import { adminAuth } from "./firebaseAdmin.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { registerPaymentRoutes } from "./payment.js";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import bcrypt from "bcryptjs";

// 이미지 업로드 디렉토리 설정
const imageUploadDir = path.join(process.cwd(), "public", "images");
if (!fs.existsSync(imageUploadDir)) {
  fs.mkdirSync(imageUploadDir, { recursive: true });
}

// 프로필 이미지 전용 디렉토리 생성
const profileImageUploadDir = path.join(imageUploadDir, "profile");
if (!fs.existsSync(profileImageUploadDir)) {
  fs.mkdirSync(profileImageUploadDir, { recursive: true });
}

// 상품 이미지 전용 디렉토리 생성
const itemImageUploadDir = path.join(imageUploadDir, "item");
if (!fs.existsSync(itemImageUploadDir)) {
  fs.mkdirSync(itemImageUploadDir, { recursive: true });
}

// 채팅 이미지 전용 디렉토리 생성
const chatImageUploadDir = path.join(imageUploadDir, "chat");
if (!fs.existsSync(chatImageUploadDir)) {
  fs.mkdirSync(chatImageUploadDir, { recursive: true });
}

// Multer 설정
const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    // 요청 경로에 따라 저장 폴더 결정
    if (req.path === '/api/upload/product-image') {
      cb(null, itemImageUploadDir);
    } else if (req.path === '/api/upload') {
      cb(null, profileImageUploadDir);
    } else if (req.path === '/api/upload/chat-image') {
      cb(null, chatImageUploadDir);
    } else {
      cb(null, imageUploadDir);
    }
  },
  filename: (req, file, cb) => {
    // 고유한 파일명 생성 (타임스탬프 + 랜덤문자 + 확장자)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<void> {
  // 정적 파일 서빙 설정 (images 폴더)
  app.use('/images', (req, res, next) => {
    // CORS 헤더 추가
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  }, express.static(imageUploadDir));

  // 결제 라우트 등록
  registerPaymentRoutes(app);

  // 이미지 업로드 API
  app.post("/api/upload", upload.single('image'), async (req, res) => {
    try {
      console.log("🖼️ 프로필 이미지 업로드 요청 받음");
      
      if (!req.file) {
        return res.status(400).json({ error: "이미지가 업로드되지 않았습니다." });
      }

      // 이미지 URL 생성 (쇼핑몰과 동일한 형식)
      const imageUrl = `/images/profile/${req.file.filename}`;
      
      console.log("🖼️ 프로필 이미지 업로드 성공:", {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: imageUrl
      });

      res.json({
        success: true,
        imageUrl
      });
    } catch (error) {
      console.error("🚫 이미지 업로드 오류:", error);
      res.status(500).json({ error: "이미지 업로드 중 오류가 발생했습니다" });
    }
  });

  // 상품 이미지 전용 업로드 API
  app.post("/api/upload/product-image", upload.single('image'), async (req, res) => {
    try {
      console.log("🖼️ 상품 이미지 업로드 요청 받음");
      
      if (!req.file) {
        return res.status(400).json({ error: "이미지가 업로드되지 않았습니다." });
      }

      // 이미지 URL 생성
      const imageUrl = `/images/item/${req.file.filename}`;
      
      console.log("🖼️ 상품 이미지 업로드 성공:", {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: imageUrl
      });

      return res.json({
        success: true,
        url: imageUrl
      });
    } catch (error) {
      console.error("🚫 상품 이미지 업로드 오류:", error);
      return res.status(500).json({
        error: "이미지 업로드 중 오류가 발생했습니다"
      });
    }
  });

  // 채팅 이미지 업로드 API
  app.post("/api/upload/chat-image", upload.single('image'), async (req, res) => {
    try {
      console.log("🖼️ 채팅 이미지 업로드 요청 받음");
      
      if (!req.file) {
        return res.status(400).json({ error: "이미지가 업로드되지 않았습니다." });
      }

      // 채팅방 ID를 쿼리 파라미터로 받음 (선택적)
      const roomId = req.query.roomId || 'general';
      
      // 채팅방별 디렉토리 생성
      const roomDir = path.join(chatImageUploadDir, roomId.toString());
      if (!fs.existsSync(roomDir)) {
        fs.mkdirSync(roomDir, { recursive: true });
      }
      
      // 이미지 파일 이동
      const newFilePath = path.join(roomDir, req.file.filename);
      fs.renameSync(req.file.path, newFilePath);

      // 이미지 URL 생성
      const imageUrl = `/images/chat/${roomId}/${req.file.filename}`;
      
      console.log("🖼️ 채팅 이미지 업로드 성공:", {
        roomId,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: imageUrl
      });

      return res.json({
        success: true,
        url: imageUrl
      });
    } catch (error) {
      console.error("🚫 채팅 이미지 업로드 오류:", error);
      return res.status(500).json({
        error: "이미지 업로드 중 오류가 발생했습니다"
      });
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = await insertUserSchema.parseAsync(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(400).json({ error: "이미 존재하는 이메일입니다" });
      }
      
      // 비밀번호 암호화 적용
      const userWithHashedPassword = await createUserWithHash(userData);
      const user = await storage.createUser(userWithHashedPassword);
      
      // 민감한 정보는 제외하고 반환
      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name,
          userType: user.userType,
          grade: user.grade
        } 
      });
    } catch (error) {
      console.error("회원가입 오류:", error);
      res.status(400).json({ error: "회원가입에 실패했습니다" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("로그인 요청:", req.body);
      let { email, password } = req.body;
      email = typeof email === 'string' ? email.trim().toLowerCase() : email;
      password = typeof password === 'string' ? password.trim() : password;
      
      if (!email || !password) {
        console.log("이메일 또는 비밀번호 누락");
        return res.status(400).json({ error: "이메일과 비밀번호는 필수 항목입니다" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log(`사용자 없음: ${email}`);
        return res.status(401).json({ error: "이메일 또는 비밀번호가 잘못되었습니다" });
      }
      
      console.log(`사용자 찾음: ${email}`);
      
      // 비밀번호 검증
      const bcryptFormat = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
      const storedLooksHashedInitial = typeof user.password === 'string' && bcryptFormat.test(user.password);
      console.log(`[auth] 로그인 검사 시작: email=${email}, storedFmt=${storedLooksHashedInitial ? 'bcrypt' : 'plain'} len=${(user.password||'').length}`);
      let isPasswordValid = await verifyPassword(password, user.password);
      console.log(`[auth] bcrypt.compare 결과: ${isPasswordValid}`);

      // 레거시 폴백: DB에 평문이 저장되어 있거나, 사용자가 해시 문자열 자체를 입력하는 경우 처리
      if (!isPasswordValid) {
        const storedLooksHashed = typeof user.password === 'string' && bcryptFormat.test(user.password);
        if (password === user.password) {
          if (storedLooksHashed) {
            // 사용자가 저장된 해시와 동일한 문자열을 입력한 경우: 통과만 시키고 DB는 변경하지 않음
            isPasswordValid = true;
            console.log(`[auth] 해시 문자열 입력으로 통과(변경 없음): user=${email}`);
          } else {
            // 저장된 값이 평문이고 입력도 동일 평문 → bcrypt로 업그레이드 저장
            const upgraded = bcrypt.hashSync(password, 10);
            await storage.updatePassword(user.id, upgraded);
            isPasswordValid = true;
            console.log(`[auth] 레거시 평문 비밀번호를 bcrypt로 업그레이드: user=${email}`);
          }
        }
      }

      if (!isPasswordValid) {
        console.log(`비밀번호 불일치: ${email}`);
        return res.status(401).json({ error: "이메일 또는 비밀번호가 잘못되었습니다" });
      }
      
      console.log(`로그인 성공: ${email}`);
      
      // Firebase 사용자 정보와 호환되도록 응답 형식 수정
      res.json({ 
        user: { 
          id: user.id,
          uid: String(user.id), // Firebase uid 호환성
          email: user.email, 
          name: user.name,
          displayName: user.name, // Firebase 호환성
          userType: user.userType,
          grade: user.grade,
          isApproved: user.isApproved || user.userType !== 'careManager'
        } 
      });
    } catch (error) {
      console.error("로그인 오류:", error);
      res.status(400).json({ error: "로그인에 실패했습니다" });
    }
  });

  // 비밀번호 변경
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      let { userId, currentPassword, newPassword } = req.body as {
        userId?: string | number;
        currentPassword?: string;
        newPassword?: string;
      };

      // 입력 정리
      if (typeof currentPassword === 'string') currentPassword = currentPassword.trim();
      if (typeof newPassword === 'string') newPassword = newPassword.trim();

      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ error: "userId, currentPassword, newPassword는 필수입니다" });
      }

      const numericUserId = Number(userId);
      if (!Number.isFinite(numericUserId)) {
        return res.status(400).json({ error: "유효한 사용자 ID가 아닙니다" });
      }

      const user = await storage.getUser(numericUserId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      let isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        const bcryptFormat = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
        const storedLooksHashed = typeof user.password === 'string' && bcryptFormat.test(user.password);
        const inputLooksHashed = typeof currentPassword === 'string' && bcryptFormat.test(currentPassword);
        // 1) DB에 평문 저장되어 있었고 입력도 동일 평문인 경우 허용
        // 2) DB에 해시가 저장되어 있고 사용자가 그 해시 문자열을 그대로 입력한 경우도 허용(정상화 목적)
        if (currentPassword === user.password || (storedLooksHashed && inputLooksHashed && currentPassword === user.password)) {
          isValid = true;
        }
      }
      if (!isValid) {
        return res.status(401).json({ error: "현재 비밀번호가 일치하지 않습니다" });
      }

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ error: "새 비밀번호는 6자 이상이어야 합니다" });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await storage.updatePassword(numericUserId, hashedPassword);

      return res.json({ success: true });
    } catch (error) {
      console.error("비밀번호 변경 오류:", error);
      return res.status(500).json({ error: "비밀번호 변경에 실패했습니다" });
    }
  });

  // Kakao OAuth 로그인
  app.post("/api/auth/kakao", async (req, res) => {
    try {
      const { code } = req.body as { code: string };
      if (!code) return res.status(400).json({ error: "code required" });

      const { data: tokenData } = await axios.post(
        "https://kauth.kakao.com/oauth/token",
        qs.stringify({
          grant_type: "authorization_code",
          client_id: process.env.KAKAO_REST_KEY,
          redirect_uri: process.env.KAKAO_REDIRECT_URI,
          code,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const accessToken = tokenData.access_token;

      const { data: me } = await axios.get("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const kakaoId: string = me.id.toString();
      const email: string | undefined = me.kakao_account?.email;
      const nickname: string | undefined = me.properties?.nickname;
      const photoURL: string | undefined = me.properties?.profile_image;

      // 사용자 찾기/생성
      let user = email ? await storage.getUserByEmail(email).catch(() => undefined) : undefined;

      if (!user) {
        // 랜덤 비밀번호 생성 (소셜 로그인이므로 실제 사용되지 않음)
        const randomPassword = Math.random().toString(36).slice(-10);
        
        const userData = {
          username: nickname || `kakao_${kakaoId.slice(-6)}`,
          email: email || `kakao_${kakaoId}@example.com`,
          password: randomPassword,
          name: nickname || `카카오사용자_${kakaoId.slice(-6)}`,  // null 대신 기본값 설정
          phone: null,
          userType: 'customer' as const,  // 타입 명시적 캐스팅
        };
        
        // 비밀번호 암호화 적용
        const userWithHashedPassword = await createUserWithHash(userData);
        user = await storage.createUser(userWithHashedPassword);
      }

      const customToken = await adminAuth.createCustomToken(kakaoId);

      res.json({ 
        token: customToken, 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name,
          userType: user.userType,
          grade: user.grade 
        } 
      });
    } catch (err: any) {
      console.error("[KakaoAuth]", err.response?.data || err);
      res.status(500).json({ error: "kakao auth failed" });
    }
  });

  // 사용자 유형 변경 API
  app.post("/api/users/:id/change-type", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { userType } = req.body;
      
      // 유효한 사용자 유형인지 확인
      if (!['customer', 'careManager', 'admin'].includes(userType)) {
        return res.status(400).json({ error: "유효하지 않은 사용자 유형입니다" });
      }
      
      const user = await storage.updateUserType(userId, userType);
      
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name,
          userType: user.userType
        } 
      });
    } catch (error) {
      console.error("사용자 유형 변경 오류:", error);
      res.status(400).json({ error: "사용자 유형 변경에 실패했습니다" });
    }
  });

  // 사용자 프로필 사진 업데이트 API
  app.put("/api/users/:id/profile-photo", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { photoURL } = req.body;
      
      if (!photoURL) {
        return res.status(400).json({ error: "프로필 사진 URL이 필요합니다." });
      }
      
      // 해당 사용자가 케어 매니저인지 확인
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
      
      // 응답 객체에 명시적으로 타입 지정
      const result: { success: boolean; careManagerUpdated?: boolean } = { success: true };
      
      // 사용자가 케어 매니저인 경우 케어 매니저 프로필 이미지도 업데이트
      if (user.userType === 'careManager') {
        try {
          const careManager = await storage.getCareManager(userId);
          if (careManager) {
            await storage.updateCareManager(userId, { imageUrl: photoURL });
            result.careManagerUpdated = true;
          }
        } catch (error) {
          console.error("케어 매니저 프로필 사진 업데이트 실패:", error);
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error("프로필 사진 업데이트 오류:", error);
      res.status(500).json({ error: "프로필 사진 업데이트 중 오류가 발생했습니다." });
    }
  });

  // 케어 매니저 승인 API
  app.post("/api/care-managers/:id/approve", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const user = await storage.approveCareManager(userId);
      
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      res.json({ 
        success: true, 
        message: "케어 매니저 승인이 완료되었습니다",
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name,
          userType: user.userType,
          isApproved: user.isApproved 
        } 
      });
    } catch (error) {
      console.error("케어 매니저 승인 오류:", error);
      res.status(400).json({ error: "케어 매니저 승인에 실패했습니다" });
    }
  });

  // 케어 매니저 예약 목록 조회 API
  app.get("/api/bookings/care-manager/:careManagerId", async (req, res) => {
    try {
      const careManagerId = parseInt(req.params.careManagerId);
      
      if (isNaN(careManagerId)) {
        return res.status(400).json({ error: "유효하지 않은 케어매니저 ID입니다" });
      }
      
      const bookings = await storage.getBookingsByCareManager(careManagerId);
      res.json(bookings);
    } catch (error) {
      console.error("케어 매니저 예약 목록 조회 오류:", error);
      res.status(500).json({ error: "예약 목록 조회에 실패했습니다" });
    }
  });

  // 날짜별 케어 매니저 예약 조회 API
  app.get("/api/bookings/care-manager-date/:careManagerId/:date", async (req, res) => {
    try {
      const careManagerId = parseInt(req.params.careManagerId);
      const date = req.params.date;
      
      const bookings = await storage.getBookingsByCareManagerAndDate(careManagerId, date);
      res.json(bookings);
    } catch (error) {
      console.error("날짜별 케어 매니저 예약 조회 오류:", error);
      res.status(500).json({ error: "날짜별 예약 조회에 실패했습니다" });
    }
  });

  // 예약 상태 변경 API
  app.put("/api/bookings/:id/status", async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { status } = req.body;
      
      // 유효한 상태 값인지 확인
      if (!['pending', 'confirmed', 'completed', 'canceled'].includes(status)) {
        return res.status(400).json({ error: "유효하지 않은 예약 상태입니다" });
      }
      
      const booking = await storage.updateBookingStatus(bookingId, status);
      
      if (!booking) {
        return res.status(404).json({ error: "예약을 찾을 수 없습니다" });
      }
      
      res.json(booking);
    } catch (error) {
      console.error("예약 상태 변경 오류:", error);
      res.status(400).json({ error: "예약 상태 변경에 실패했습니다" });
    }
  });

  // Care Manager routes
  app.get("/api/care-managers", async (req, res) => {
    try {
      console.log("케어매니저 목록 요청 처리 중...");
      const careManagers = await storage.getAllCareManagers();
      console.log(`케어매니저 ${careManagers.length}명 조회됨`);
      res.json(careManagers);
    } catch (error) {
      console.error("케어 매니저 목록 조회 오류:", error);
      res.status(500).json({ error: "케어 매니저 목록을 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/care-managers/:id", async (req, res) => {
    const careManager = await storage.getCareManager(parseInt(req.params.id));
    if (!careManager) {
      res.status(404).send({ error: "CareManager not found" });
      return;
    }
    res.send(careManager);
  });

  // 케어 매니저 정보 업데이트 API
  app.put("/api/care-managers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payload = req.body;
      let updated = await storage.updateCareManager(id, payload);
      if (!updated) {
        // 레코드가 없으면 새로 생성
        const user = await storage.getUser(id);
        const insertData: any = {
          // 필수 필드 기본값+payload
          name: user?.name || `CareManager#${id}`,
          age: payload.age ?? 0,
          rating: 0,
          reviews: 0,
          experience: payload.experience || "",
          location: payload.location || "",
          hourlyRate: payload.hourlyRate || 0,
          services: payload.services || [],
          certified: false,
          imageUrl: payload.imageUrl || null,
          description: payload.description || null,
          isApproved: false,
        };
        updated = await storage.createCareManager(insertData);
        return res.status(201).json(updated);
      }
      res.json(updated);
    } catch (error) {
      console.error("케어 매니저 업데이트 오류:", error);
      res.status(400).json({ error: "케어 매니저 업데이트에 실패했습니다" });
    }
  });

  // Service routes
  app.get("/api/services", async (req, res) => {
    try {
      const services = await storage.getAllServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: "서비스 목록을 불러오는데 실패했습니다" });
    }
  });

  // Booking routes
  app.post("/api/bookings", async (req, res) => {
    try {
      console.log("예약 요청 데이터:", req.body);
      
      // date 필드가 문자열로 오는 경우 Date 객체로 변환
      if (req.body.date && typeof req.body.date === 'string') {
        req.body.date = new Date(req.body.date);
      }
      
      const bookingData = insertBookingSchema.parse(req.body);
      console.log("스키마 검증 후 데이터:", bookingData);
      
      // 케어매니저 존재 여부 확인
      const careManager = await storage.getCareManager(bookingData.careManagerId);
      if (!careManager) {
        return res.status(400).json({ error: `케어매니저 ID ${bookingData.careManagerId}가 존재하지 않습니다` });
      }
      
      // 서비스 존재 여부 확인
      const service = await storage.getService(bookingData.serviceId);
      if (!service) {
        return res.status(400).json({ error: `서비스 ID ${bookingData.serviceId}가 존재하지 않습니다` });
      }
      
      const booking = await storage.createBooking(bookingData);
      res.json(booking);
    } catch (error) {
      console.error("예약 생성 오류:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: `예약 생성에 실패했습니다: ${error.message}` });
      } else {
        res.status(400).json({ error: "예약 생성에 실패했습니다" });
      }
    }
  });

  app.get("/api/bookings/user/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      
      // 예약 목록 가져오기
      const bookings = await storage.getBookingsByUser(userId);
      
      // 각 예약에 대한 케어매니저 정보와 서비스 정보 추가
      const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
        // 케어매니저 정보 가져오기
        let careManager = await storage.getCareManager(booking.careManagerId);
        if (!careManager) {
          careManager = {
            id: booking.careManagerId,
            name: `케어 매니저 #${booking.careManagerId}`,
            imageUrl: null,
            age: 0,
            rating: 0,
            reviews: 0,
            experience: "",
            location: "",
            hourlyRate: 0,
            services: [],
            certified: false,
            isApproved: false,
            createdAt: new Date(),
            description: null,
            introContents: null,
          };
        }
        const careManagerSafe = careManager as any;
 
        // 서비스 정보 가져오기
        let service = await storage.getService(booking.serviceId);
        if (!service) {
          service = {
            id: booking.serviceId,
            name: "서비스 정보 없음",
            icon: "fas fa-question",
            color: "bg-gray-500",
            description: null,
            averageDuration: null
          };
        }
        
        // 정보 합치기
        return {
          ...booking,
          careManager: {
            id: careManagerSafe.id,
            name: careManagerSafe.name,
            imageUrl: careManagerSafe.imageUrl
          },
          service: {
            name: service.name
          }
        };
      }));
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error("예약 목록 조회 오류:", error);
      res.status(500).json({ error: "예약 목록을 불러오는데 실패했습니다" });
    }
  });

  // 특정 날짜에 케어 매니저의 예약 정보 가져오기
  app.get("/api/bookings/manager/:managerId/date/:date", async (req, res) => {
    try {
      const managerId = parseInt(req.params.managerId);
      const date = req.params.date; // YYYY-MM-DD 형식
      
      // 해당 날짜의 모든 예약 가져오기
      const bookings = await storage.getBookingsByCareManagerAndDate(managerId, date);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "예약 정보를 불러오는데 실패했습니다" });
    }
  });

  // Message routes
  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: "메시지 전송에 실패했습니다" });
    }
  });

  app.get("/api/messages/:userId1/:userId2", async (req, res) => {
    try {
      const userId1 = parseInt(req.params.userId1);
      const userId2 = parseInt(req.params.userId2);
      const messages = await storage.getMessagesBetweenUsers(userId1, userId2);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "메시지 목록을 불러오는데 실패했습니다" });
    }
  });

  // 사용자 목록 조회 API
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "사용자 목록을 불러오는데 실패했습니다" });
    }
  });

  // 관리자 대시보드 통계
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const [users, careManagers, bookings] = await Promise.all([
        storage.getUsers(),
        storage.getAllCareManagers(),
        storage.getAllBookings(),
      ]);
      const totalRevenue = bookings.filter(b=> (b as any).status === 'completed').reduce((sum,b)=> sum + (b as any).totalAmount,0);
      res.json({
        totalUsers: users.length,
        totalCareManagers: careManagers.length,
        totalRevenue,
      });
    } catch (error) {
      res.status(500).json({ error: "통계 정보를 불러오는데 실패했습니다" });
    }
  });

  // 분쟁 목록 조회
  app.get("/api/disputes", async (req, res) => {
    try {
      const disputes = await storage.getAllDisputes();
      res.json(disputes);
    } catch (error) {
      console.error("분쟁 목록 조회 오류", error);
      res.status(500).json({ error: "분쟁 목록을 불러오는데 실패했습니다" });
    }
  });

  // 분쟁 상태 업데이트
  app.put("/api/disputes/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const updated = await storage.updateDisputeStatus(id, status);
      if (!updated) return res.status(404).json({ error: "분쟁을 찾을 수 없습니다" });
      res.json(updated);
    } catch (error) {
      console.error("분쟁 상태 업데이트 오류", error);
      res.status(400).json({ error: "분쟁 상태 업데이트에 실패했습니다" });
    }
  });

  /* -------------------- Notice Routes -------------------- */
  app.get("/api/notices", async (req, res) => {
    const notices = await storage.getAllNotices();
    res.json(notices);
  });

  app.post("/api/notices", async (req, res) => {
    try {
      const { title, content } = req.body;
      if (!title || !content) return res.status(400).json({ error: "title, content required" });
      const notice = await storage.createNotice({ title, content });
      res.status(201).json(notice);
    } catch (e) {
      res.status(400).json({ error: "공지 생성 실패" });
    }
  });

  app.put("/api/notices/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const updated = await storage.updateNotice(id, req.body);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });

  app.delete("/api/notices/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const ok = await storage.deleteNotice(id);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ success: true });
  });

  /* -------------------- Product Routes -------------------- */
  
  // 상품 카테고리 목록 조회 (상품 상세 라우트보다 먼저 와야 함)
  app.get("/api/products/categories", async (req, res) => {
    try {
      const categories = await storage.getAllProductCategories();
      res.json({ categories });
    } catch (error) {
      console.error("상품 카테고리 목록 조회 오류:", error);
      res.status(500).json({ error: "상품 카테고리 목록을 불러오는데 실패했습니다" });
    }
  });

  // 상품 카테고리 상세 조회
  app.get("/api/products/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 카테고리 ID입니다" });
      }
      
      const category = await storage.getProductCategory(id);
      
      if (!category) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("상품 카테고리 상세 조회 오류:", error);
      res.status(500).json({ error: "카테고리 정보를 불러오는데 실패했습니다" });
    }
  });
  
  // 상품 목록 조회
  app.get("/api/products", async (req, res) => {
    try {
      const { seller_id, category_id, category, search, limit = 50, offset = 0 } = req.query;
      
      const params: any = {};
      if (seller_id) params.sellerId = parseInt(seller_id as string);
      if (category_id) params.categoryId = parseInt(category_id as string);
      
      // 카테고리 이름을 직접 storage로 전달 (매핑 제거)
      if (category) {
        console.log("[SERVER] 카테고리 이름 전달:", category);
        params.category = category as string;
      }
      
      if (search) params.search = search as string;
      if (limit) params.limit = parseInt(limit as string);
      if (offset) params.offset = parseInt(offset as string);
      
      console.log("[SERVER] 상품 목록 조회 파라미터:", params);
      
      const products = await storage.getAllProducts(params);
      console.log(`[SERVER] 조회된 상품 개수: ${products.length}`);
      res.json(products);
    } catch (error) {
      console.error("상품 목록 조회 오류:", error);
      res.status(500).json({ error: "상품 목록을 불러오는데 실패했습니다" });
    }
  });

  // 상품 상세 조회
  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 상품 ID입니다" });
      }
      
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("상품 상세 조회 오류:", error);
      res.status(500).json({ error: "상품 정보를 불러오는데 실패했습니다" });
    }
  });

  // 상품 등록
  app.post("/api/products", async (req, res) => {
    try {
      const productData = req.body;
      
      // 필수 필드 검증
      if (!productData.title || !productData.price) {
        return res.status(400).json({ error: "상품명과 가격은 필수 항목입니다" });
      }
      
      // 데이터베이스 스키마에 맞게 필드명 변환
      const dbProductData: any = {
        title: productData.title,
        description: productData.description,
        price: Number(productData.price),
        discountPrice: productData.discount_price ? Number(productData.discount_price) : null,
        stock: Number(productData.stock) || 0,
        images: productData.images,
        tags: productData.tags,
        status: productData.status || 'active',
        options: productData.options
      };
      
      // seller_id를 sellerId로 변환
      if (productData.seller_id) {
        dbProductData.sellerId = parseInt(productData.seller_id);
      }
      
      // category_id를 categoryId로 변환
      if (productData.category_id) {
        dbProductData.categoryId = parseInt(productData.category_id);
      }
      
      const product = await storage.createProduct(dbProductData);
      res.status(201).json(product);
    } catch (error) {
      console.error("상품 등록 오류:", error);
      res.status(400).json({ error: "상품 등록에 실패했습니다" });
    }
  });

  // 상품 수정
  app.put("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 상품 ID입니다" });
      }
      
      const productData = req.body;
      
      // 데이터베이스 스키마에 맞게 필드명 변환
      const dbProductData: any = {};
      
      // 기본 필드들 복사
      if (productData.title) dbProductData.title = productData.title;
      if (productData.description !== undefined) dbProductData.description = productData.description;
      if (productData.price) dbProductData.price = Number(productData.price);
      if (productData.discount_price !== undefined) {
        dbProductData.discountPrice = productData.discount_price ? Number(productData.discount_price) : null;
      }
      if (productData.stock !== undefined) dbProductData.stock = Number(productData.stock) || 0;
      if (productData.images !== undefined) dbProductData.images = productData.images;
      if (productData.tags !== undefined) dbProductData.tags = productData.tags;
      if (productData.status) dbProductData.status = productData.status;
      if (productData.options !== undefined) dbProductData.options = productData.options;
      
      // seller_id를 sellerId로 변환
      if (productData.seller_id) {
        dbProductData.sellerId = parseInt(productData.seller_id);
      }
      
      // category_id를 categoryId로 변환 (0도 유효한 값으로 처리)
      if (productData.category_id !== undefined && productData.category_id !== null && productData.category_id !== "") {
        dbProductData.categoryId = parseInt(productData.category_id);
      }
      
      const updated = await storage.updateProduct(id, dbProductData);
      
      if (!updated) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("상품 수정 오류:", error);
      res.status(400).json({ error: "상품 수정에 실패했습니다" });
    }
  });

  // 상품 삭제
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 상품 ID입니다" });
      }
      
      const deleted = await storage.deleteProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("상품 삭제 오류:", error);
      res.status(400).json({ error: "상품 삭제에 실패했습니다" });
    }
  });

  // 상품 카테고리 등록
  app.post("/api/products/categories", async (req, res) => {
    try {
      const categoryData = req.body;
      
      // 필수 필드 검증
      if (!categoryData.name) {
        return res.status(400).json({ error: "카테고리명은 필수 항목입니다" });
      }
      
      const category = await storage.createProductCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("상품 카테고리 등록 오류:", error);
      res.status(400).json({ error: "카테고리 등록에 실패했습니다" });
    }
  });

  // 상품 카테고리 수정
  app.put("/api/products/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 카테고리 ID입니다" });
      }
      
      const payload = req.body;
      
      const updated = await storage.updateProductCategory(id, payload);
      
      if (!updated) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("상품 카테고리 수정 오류:", error);
      res.status(400).json({ error: "카테고리 수정에 실패했습니다" });
    }
  });

  // 상품 카테고리 삭제
  app.delete("/api/products/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 카테고리 ID입니다" });
      }
      
      const deleted = await storage.deleteProductCategory(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("상품 카테고리 삭제 오류:", error);
      res.status(400).json({ error: "카테고리 삭제에 실패했습니다" });
    }
  });

  // ==================== 새로운 기능 API 핸들러들 ====================
  
  // 찜한 케어 매니저 API
  app.get('/api/favorites/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const favorites = await storage.getFavorites(userId);
      const enriched = await Promise.all(
        favorites.map(async (f: any) => {
          const manager = await storage.getCareManager(Number(f.careManagerId));
          return { ...f, manager };
        })
      );
      res.json(enriched);
    } catch (error) {
      console.error("찜한 케어 매니저 조회 오류:", error);
      res.status(500).json({ error: "찜한 케어 매니저 목록을 불러오는데 실패했습니다" });
    }
  });

  app.post('/api/favorites', async (req, res) => {
    try {
      const favoriteData = req.body;
      
      if (!favoriteData.userId || !favoriteData.careManagerId) {
        return res.status(400).json({ error: "사용자 ID와 케어 매니저 ID는 필수 항목입니다" });
      }
      
      const favorite = await storage.addFavorite(favoriteData);
      res.status(201).json(favorite);
        } catch (error) {
      console.error("찜하기 추가 오류:", error);
      res.status(400).json({ error: "찜하기 추가에 실패했습니다" });
    }
  });

  app.delete('/api/favorites/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 찜하기 ID입니다" });
      }
      
      const deleted = await storage.removeFavorite(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "찜하기를 찾을 수 없습니다" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("찜하기 삭제 오류:", error);
      res.status(400).json({ error: "찜하기 삭제에 실패했습니다" });
    }
  });

  // 사용자 설정 API (알림 설정 + 개인정보 보호 설정)
  app.get('/api/user-settings/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const { type } = req.query;
      
      if (type === 'notification') {
        const settings = await storage.getUserNotificationSettings(userId);
        res.json(settings || {});
      } else if (type === 'privacy') {
        const settings = await storage.getUserPrivacySettings(userId);
        res.json(settings || {});
      } else {
        // 둘 다 반환
        const [notificationSettings, privacySettings] = await Promise.all([
          storage.getUserNotificationSettings(userId),
          storage.getUserPrivacySettings(userId)
        ]);

      res.json({ 
          notification: notificationSettings || {},
          privacy: privacySettings || {}
      });
      }
    } catch (error) {
      console.error("사용자 설정 조회 오류:", error);
      res.status(500).json({ error: "사용자 설정을 불러오는데 실패했습니다" });
    }
  });

  app.put('/api/user-settings/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const { type } = req.query;
      const settingsData = req.body;
      
      if (type === 'notification') {
        const settings = await storage.updateUserNotificationSettings(userId, settingsData);
        res.json(settings);
      } else if (type === 'privacy') {
        const settings = await storage.updateUserPrivacySettings(userId, settingsData);
        res.json(settings);
      } else {
        return res.status(400).json({ error: "설정 타입(type)을 지정해주세요: notification 또는 privacy" });
      }
    } catch (error) {
      console.error("사용자 설정 업데이트 오류:", error);
      res.status(400).json({ error: "사용자 설정 업데이트에 실패했습니다" });
    }
  });

  // 문의 관리 API
  app.get('/api/inquiries', async (req, res) => {
    try {
      const inquiries = await storage.getAllInquiries();
      res.json(inquiries);
    } catch (error) {
      console.error("문의사항 목록 조회 오류:", error);
      res.status(500).json({ error: "문의사항 목록을 불러오는데 실패했습니다" });
    }
  });

  app.get('/api/inquiries/user/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const inquiries = await storage.getUserInquiries(userId);
      res.json(inquiries);
    } catch (error) {
      console.error("사용자 문의사항 조회 오류:", error);
      res.status(500).json({ error: "문의사항을 불러오는데 실패했습니다" });
    }
  });

  app.post('/api/inquiries', async (req, res) => {
    try {
      const inquiryData = req.body;
      
      if (!inquiryData.userId || !inquiryData.subject || !inquiryData.message || !inquiryData.category) {
        return res.status(400).json({ error: "사용자 ID, 제목, 내용, 카테고리는 필수 항목입니다" });
      }
      
      const inquiry = await storage.createInquiry(inquiryData);
      res.status(201).json(inquiry);
    } catch (error) {
      console.error("문의사항 생성 오류:", error);
      res.status(400).json({ error: "문의사항 등록에 실패했습니다" });
    }
  });

  app.put('/api/inquiries/:id/answer', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { answer, answeredBy } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 문의사항 ID입니다" });
      }
      
      if (!answer || !answeredBy) {
        return res.status(400).json({ error: "답변 내용과 답변자는 필수 항목입니다" });
      }
      
      const inquiry = await storage.answerInquiry(id, answer, answeredBy);
      
      if (!inquiry) {
        return res.status(404).json({ error: "문의사항을 찾을 수 없습니다" });
      }
      
      res.json(inquiry);
    } catch (error) {
      console.error("문의사항 답변 오류:", error);
      res.status(400).json({ error: "문의사항 답변에 실패했습니다" });
    }
  });

  app.put('/api/inquiries/:id/status', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "유효하지 않은 문의사항 ID입니다" });
      }
      
      if (!status) {
        return res.status(400).json({ error: "상태는 필수 항목입니다" });
      }
      
      // 유효한 상태 값인지 확인
      if (!['pending', 'in_progress', 'answered', 'closed'].includes(status)) {
        return res.status(400).json({ error: "유효하지 않은 상태입니다" });
      }
      
      const inquiry = await storage.updateInquiryStatus(id, status);
      
      if (!inquiry) {
        return res.status(404).json({ error: "문의사항을 찾을 수 없습니다" });
      }
      
      res.json(inquiry);
    } catch (error) {
      console.error("문의사항 상태 업데이트 오류:", error);
      res.status(400).json({ error: "문의사항 상태 업데이트에 실패했습니다" });
    }
  });

  // ==================== 주문 관리 API ====================
  
  // 관리자 주문 목록 조회
  app.get('/api/orders/admin', async (req, res) => {
    try {
      // 실제 구현에서는 인증 확인 필요
      // const user = await verifyAuthToken(req);
      // if (user.userType !== 'admin') return res.status(403).json({ error: "권한이 없습니다" });
      
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("주문 목록 조회 오류:", error);
      res.status(500).json({ error: "주문 목록을 불러오는데 실패했습니다" });
    }
  });

  // 주문 상태 변경
  app.put('/api/orders/:orderId/status', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      if (!orderId || !status) {
        return res.status(400).json({ error: "주문 ID와 상태는 필수 항목입니다." });
      }
      
      const updated = await storage.updateOrderStatus(String(orderId), status);
      
      if (!updated) {
        return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
      }
      
      res.json({ success: true, order: updated });
      
      // 알림 생성
      if (status === "processing") {
        await storage.createAdminNotification({
          type: "order_processing",
          message: `주문 #${orderId}이(가) 처리 중입니다.`,
          order_id: String(orderId)
        });
      } else if (status === "shipped") {
        await storage.createAdminNotification({
          type: "order_shipped",
          message: `주문 #${orderId}이(가) 발송되었습니다.`,
          order_id: String(orderId)
        });
      } else if (status === "delivered") {
        await storage.createAdminNotification({
          type: "order_delivered",
          message: `주문 #${orderId}이(가) 배송 완료되었습니다.`,
          order_id: String(orderId)
        });
      } else if (status === "canceled") {
        await storage.createAdminNotification({
          type: "order_canceled",
          message: `주문 #${orderId}이(가) 취소되었습니다.`,
          order_id: String(orderId)
        });
      }
    } catch (error) {
      console.error("주문 상태 업데이트 오류:", error);
      res.status(500).json({ error: "주문 상태 업데이트 중 오류가 발생했습니다." });
    }
  });

  // 배송 정보 업데이트
  app.put('/api/orders/:orderId/shipping', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { trackingNumber, shippingCompany } = req.body;
      
      if (!orderId || !trackingNumber || !shippingCompany) {
        return res.status(400).json({ error: "주문 ID, 운송장 번호, 배송사는 필수 항목입니다." });
      }
      
      const updated = await storage.updateOrderShipping(String(orderId), trackingNumber, shippingCompany);
      
      if (!updated) {
        return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
      }
      
      res.json({ success: true, order: updated });
      
      // 배송 시작 알림 생성
      await storage.createAdminNotification({
        type: "shipping_started",
        message: `주문 #${orderId}의 배송이 시작되었습니다. (${shippingCompany}, ${trackingNumber})`,
        order_id: String(orderId)
      });
    } catch (error) {
      console.error("배송 정보 업데이트 오류:", error);
      res.status(500).json({ error: "배송 정보 업데이트 중 오류가 발생했습니다." });
    }
  });

  // 주문 생성 API 추가
  app.post("/api/orders", async (req, res) => {
    try {
      console.log("주문 생성 요청:", req.body);
      const { items, shipping_address_id, payment_method, total_amount } = req.body;
      
      // 필수 정보 검증
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "주문할 상품 정보가 없습니다." });
      }
      
      if (!shipping_address_id) {
        return res.status(400).json({ error: "배송지 정보가 누락되었습니다." });
      }
      
      if (!payment_method) {
        return res.status(400).json({ error: "결제 방법이 누락되었습니다." });
      }
      
      // 주문 생성
      const orderData = {
        items, 
        shipping_address_id, 
        payment_method,
        total_amount: total_amount || 0,
        customer_name: req.body.customer_name || "고객",
        customer_phone: req.body.customer_phone || "",
        order_status: "pending",
        payment_status: payment_method === "card" ? "paid" : "pending"
      };
      
      // 주문 생성
      const order = await storage.createOrder(orderData);
      
      // 주문 생성 후 알림 전송 (관리자에게)
      await storage.createAdminNotification({
        type: "order",
        message: `새로운 주문이 접수되었습니다. (주문번호: ${order.id})`,
        order_id: order.id,
        reference_id: order.id
      });
      
      res.status(201).json(order);
    } catch (error) {
      console.error("주문 생성 오류:", error);
      res.status(500).json({ error: "주문 생성에 실패했습니다." });
    }
  });

  // ==================== 알림 관리 API ====================
  
  // 관리자 알림 목록 조회
  app.get('/api/notifications/admin', async (req, res) => {
    try {
      const notifications = await storage.getAdminNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("알림 목록 조회 오류:", error);
      res.status(500).json({ error: "알림 목록을 불러오는데 실패했습니다" });
    }
  });

  // 알림 읽음 처리
  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      const { id } = req.params;
      
      const updatedNotification = await storage.markAdminNotificationAsRead(id);
      
      if (!updatedNotification) {
        return res.status(404).json({ error: "알림을 찾을 수 없습니다" });
      }
      
      res.json(updatedNotification);
    } catch (error) {
      console.error("알림 읽음 처리 오류:", error);
      res.status(400).json({ error: "알림 읽음 처리에 실패했습니다" });
    }
  });

  // ==================== 판매자(케어 매니저) API ====================
  
  // 판매자 주문 목록 조회
  app.get('/api/orders/seller/:sellerId', async (req, res) => {
    try {
      const { sellerId } = req.params;
      
      // 실제 구현에서는 인증 확인 필요
      // const user = await verifyAuthToken(req);
      // if (user.uid !== sellerId && user.userType !== 'admin') return res.status(403).json({ error: "권한이 없습니다" });
      
      // 임시 더미 데이터 반환 (실제 구현 시 DB에서 조회)
      const orders = [
        {
          id: "ORD-001",
          createdAt: new Date().toISOString(),
          customer_name: "김영희",
          customer_phone: "010-1234-5678",
          orderItems: [
            { product: { title: "신선한 사과" }, quantity: 2, price: 15000 }
          ],
          total_amount: 30000,
          payment_method: "카드결제",
          order_status: "pending",
          shipping_address: {
            name: "김영희",
            phone: "010-1234-5678",
            address: "서울시 강남구 테헤란로 123",
          },
          tracking_number: "",
          shipping_company: "",
          seller_id: sellerId
        },
        {
          id: "ORD-002", 
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          customer_name: "박철수",
          customer_phone: "010-9876-5432",
          orderItems: [
            { product: { title: "유기농 배" }, quantity: 1, price: 25000 }
          ],
          total_amount: 25000,
          payment_method: "무통장입금",
          order_status: "shipped",
          shipping_address: {
            name: "박철수",
            phone: "010-9876-5432", 
            address: "부산시 해운대구 센텀중앙로 456",
          },
          tracking_number: "123456789",
          shipping_company: "CJ대한통운",
          seller_id: sellerId
        }
      ];
      
      res.json(orders);
    } catch (error) {
      console.error("판매자 주문 목록 조회 오류:", error);
      res.status(500).json({ error: "주문 목록을 불러오는데 실패했습니다" });
    }
  });
  
  // 판매자 알림 목록 조회
  app.get('/api/notifications/seller/:sellerId', async (req, res) => {
    try {
      const { sellerId } = req.params;
      
      // 실제 구현에서는 인증 확인 필요
      // const user = await verifyAuthToken(req);
      // if (user.uid !== sellerId && user.userType !== 'admin') return res.status(403).json({ error: "권한이 없습니다" });
      
      // 임시 더미 데이터 반환 (실제 구현 시 DB에서 조회)
      const notifications = [
        {
          id: "NOTIF-001",
          type: "order",
          message: "새로운 주문이 접수되었습니다: ORD-001",
          order_id: "ORD-001",
          is_read: false,
          createdAt: new Date().toISOString(),
          seller_id: sellerId
        },
        {
          id: "NOTIF-002",
          type: "shipping",
          message: "주문 #ORD-002의 배송이 시작되었습니다. 택배사: CJ대한통운, 운송장번호: 123456789",
          order_id: "ORD-002",
          is_read: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          seller_id: sellerId
        },
        {
          id: "NOTIF-003",
          type: "stock",
          message: "유기농 사과 상품의 재고가 10개 미만으로 떨어졌습니다.",
          product_id: "1",
          is_read: true,
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          seller_id: sellerId
        }
      ];
      
      res.json(notifications);
    } catch (error) {
      console.error("판매자 알림 목록 조회 오류:", error);
      res.status(500).json({ error: "알림 목록을 불러오는데 실패했습니다" });
    }
  });

  // ==================== 상품 리뷰 및 문의 API ====================

  // 상품 리뷰 목록 조회
  app.get('/api/products/:productId/reviews', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "유효하지 않은 상품 ID입니다." });
      }
      
      const reviews = await storage.getProductReviews(productId);
      
      // 리뷰와 함께 작성자 정보 가져오기
      const reviewsWithUser = await Promise.all(reviews.map(async (review) => {
        try {
          const user = await storage.getUser(review.userId);
          return {
            ...review,
            username: user?.name || "알 수 없음",
            display_name: user?.name || "알 수 없음",
          };
        } catch (error) {
          return {
            ...review,
            username: "알 수 없음",
            display_name: "알 수 없음",
          };
        }
      }));
      
      res.json(reviewsWithUser);
    } catch (error) {
      console.error("상품 리뷰 조회 오류:", error);
      res.status(500).json({ error: "상품 리뷰를 불러오는데 실패했습니다." });
    }
  });

  // 사용자 상품 구매 여부 확인 (리뷰 작성 자격 확인)
  app.get('/api/users/:userId/purchases/verify/:productId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const productId = parseInt(req.params.productId);
      
      if (isNaN(userId) || isNaN(productId)) {
        return res.status(400).json({ error: "유효하지 않은 사용자 ID 또는 상품 ID입니다." });
      }
      
      // 실제 구현에서는 사용자 인증도 필요
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "권한이 없습니다." });
      
      // 사용자의 해당 상품 구매 여부 확인
      const hasPurchased = await storage.checkUserPurchase(userId, productId);
      
      // 개발용 임시 코드 (항상 구매한 것으로 처리)
      // 실제 운영에서는 제거 필요
      const verified = true; // hasPurchased;
      
      res.json({ verified });
    } catch (error) {
      console.error("구매 확인 오류:", error);
      res.status(500).json({ error: "구매 여부 확인에 실패했습니다." });
    }
  });

  // 사용자 구매 내역 조회 (리뷰 작성 가능한 상품 확인)
  app.get('/api/users/:userId/purchases', async (req, res) => {
    try {
      const userId = req.params.userId; // 문자열 형태로 받음
      
      if (!userId) {
        return res.status(400).json({ error: "유효하지 않은 사용자 ID입니다." });
      }
      
      // 실제 구현에서는 사용자 인증도 필요
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "권한이 없습니다." });
      
      // 개발용 임시 코드 (항상 모든 상품을 구매한 것으로 처리)
      // 실제 구현에서는 주석 해제하여 실제 구매 내역을 조회
      // const orderItems = await storage.getUserOrderItems(userId);
      
      const products = await storage.getAllProducts();
      const purchases = products.map(product => ({
        productId: product.id,
        product_id: product.id, // 호환성을 위해 두 형태 모두 제공
        title: product.title,
        purchaseDate: new Date().toISOString(),
        orderId: 'temp-order-' + Math.floor(Math.random() * 1000)
      }));
      
      res.json(purchases);
    } catch (error) {
      console.error("구매 내역 조회 오류:", error);
      res.status(500).json({ error: "구매 내역을 불러오는데 실패했습니다." });
    }
  });

  // 리뷰 작성 API
  app.post('/api/products/:productId/reviews', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const { userId, rating, comment } = req.body;
      
      if (isNaN(productId) || !userId || !rating || !comment) {
        return res.status(400).json({ error: "필수 입력값이 누락되었습니다." });
      }
      
      // 실제 구현에서는 사용자 인증도 필요
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "권한이 없습니다." });
      
      // 사용자의 해당 상품 구매 여부 확인
      // 개발용으로 항상 true 반환하도록 설정되어 있음
      const hasPurchased = await storage.checkUserPurchase(parseInt(userId), productId);
      
      const newReview = await storage.createProductReview({
        userId: parseInt(userId),
        productId,
        rating: parseInt(rating),
        comment,
        isVerifiedPurchase: true, // 항상 구매 확인으로 표시 (실제에서는 hasPurchased 사용)
        status: "active"
      });
      
      // 상품의 평점 업데이트
      const product = await storage.getProduct(productId);
      if (product) {
        const reviews = await storage.getProductReviews(productId);
        const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
        
        await storage.updateProduct(productId, {
          rating: String(averageRating),
          reviewCount: reviews.length
        });
      }
      
      const user = await storage.getUser(parseInt(userId));
      
      res.status(201).json({
        ...newReview,
        username: user?.name || "알 수 없음",
        display_name: user?.name || "알 수 없음"
      });
    } catch (error) {
      console.error("리뷰 작성 오류:", error);
      res.status(500).json({ error: "리뷰 작성에 실패했습니다." });
    }
  });

  // 상품 문의 목록 조회
  app.get('/api/products/:productId/comments', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "유효하지 않은 상품 ID입니다." });
      }
      
      const comments = await storage.getProductComments(productId);
      
      // 문의사항 그룹화 (부모 문의와 답변들)
      const parentComments = comments.filter(comment => !comment.parentId);
      const groupedComments = parentComments.map(parent => {
        const replies = comments.filter(comment => comment.parentId === parent.id);
        return {
          ...parent,
          replies
        };
      });
      
      // 문의와 함께 작성자 정보 가져오기
      const commentsWithUser = await Promise.all(groupedComments.map(async (comment) => {
        try {
          const user = await storage.getUser(comment.userId);
          
          // 답글에도 사용자 정보 추가
          const repliesWithUser = await Promise.all((comment.replies || []).map(async (reply) => {
            try {
              const replyUser = await storage.getUser(reply.userId);
              return {
                ...reply,
                username: replyUser?.name || "알 수 없음",
                display_name: replyUser?.name || (reply.isAdmin ? "관리자" : "알 수 없음"),
              };
            } catch (error) {
              return {
                ...reply,
                username: "알 수 없음",
                display_name: reply.isAdmin ? "관리자" : "알 수 없음",
              };
            }
          }));
          
          return {
            ...comment,
            username: user?.name || "알 수 없음",
            display_name: user?.name || "알 수 없음",
            replies: repliesWithUser
          };
        } catch (error) {
          return {
            ...comment,
            username: "알 수 없음",
            display_name: "알 수 없음",
            replies: comment.replies || []
          };
        }
      }));
      
      res.json(commentsWithUser);
    } catch (error) {
      console.error("상품 문의 조회 오류:", error);
      res.status(500).json({ error: "상품 문의를 불러오는데 실패했습니다." });
    }
  });

  // 문의 작성 API
  app.post('/api/products/:productId/comments', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const { userId, content, isPrivate } = req.body;
      
      if (isNaN(productId) || !userId || !content) {
        return res.status(400).json({ error: "필수 입력값이 누락되었습니다." });
      }
      
      // 실제 구현에서는 사용자 인증도 필요
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "권한이 없습니다." });
      
      const newComment = await storage.createProductComment({
        userId: parseInt(userId),
        productId,
        content,
        isPrivate: !!isPrivate,
        status: "active"
      });
      
      const user = await storage.getUser(parseInt(userId));
      
      res.status(201).json({
        ...newComment,
        username: user?.name || "알 수 없음",
        display_name: user?.name || "알 수 없음",
        replies: []
      });
    } catch (error) {
      console.error("문의 작성 오류:", error);
      res.status(500).json({ error: "문의 작성에 실패했습니다." });
    }
  });

  // 문의 답글 작성 API
  app.post('/api/products/:productId/comments/:commentId/replies', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const commentId = parseInt(req.params.commentId);
      const { userId, content } = req.body;
      
      if (isNaN(productId) || isNaN(commentId) || !userId || !content) {
        return res.status(400).json({ error: "필수 입력값이 누락되었습니다." });
      }
      
      // 원본 문의 확인
      const parentComment = (await storage.getProductComments(productId))
        .find(comment => comment.id === commentId);
      
      if (!parentComment) {
        return res.status(404).json({ error: "원본 문의를 찾을 수 없습니다." });
      }
      
      // 실제 구현에서는 사용자 인증과 관리자 여부 확인
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "권한이 없습니다." });
      // const isAdmin = user.userType === 'admin';
      
      // 개발용 임시 코드 - 사용자 이메일에 'admin'이 포함되면 관리자로 간주
      const user = await storage.getUser(parseInt(userId));
      const isAdmin = user?.email?.includes('admin') || false;
      
      const newReply = await storage.createProductComment({
        userId: parseInt(userId),
        productId,
        content,
        parentId: commentId,
        isPrivate: parentComment.isPrivate,
        isAdmin,
        status: "active"
      });
      
      // 원본 문의의 상태를 '답변 완료'로 변경
      if (isAdmin) {
        await storage.updateProductComment(commentId, { status: "answered" });
      }
      
      res.status(201).json({
        ...newReply,
        username: user?.name || "알 수 없음",
        display_name: isAdmin ? "관리자" : (user?.name || "알 수 없음")
      });
    } catch (error) {
      console.error("답글 작성 오류:", error);
      res.status(500).json({ error: "답글 작성에 실패했습니다." });
    }
  });

  // 케어 매니저 소개글 콘텐츠 API
  app.post("/api/caremanager/:id/intro-contents", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { introContents } = req.body;

      if (!introContents || !Array.isArray(introContents)) {
        return res.status(400).json({ error: "올바른 소개글 콘텐츠 형식이 아닙니다." });
      }

      // 기존 케어 매니저 확인
      const careManager = await storage.getCareManager(id);
      if (!careManager) {
        return res.status(404).json({ error: "케어 매니저를 찾을 수 없습니다." });
      }

      // 소개글 콘텐츠 저장
      await storage.updateCareManagerIntroContents(id, introContents);

      res.json({
        success: true,
        message: "소개글 콘텐츠가 성공적으로 저장되었습니다."
      });
    } catch (error) {
      console.error("소개글 콘텐츠 저장 오류:", error);
      res.status(500).json({
        error: "소개글 콘텐츠 저장 중 오류가 발생했습니다."
      });
    }
  });

  // 케어 매니저 소개글 콘텐츠 조회 API
  app.get("/api/caremanager/:id/intro-contents", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // 케어 매니저 확인
      const careManager = await storage.getCareManager(id);
      if (!careManager) {
        return res.status(404).json({ error: "케어 매니저를 찾을 수 없습니다." });
      }

      // 소개글 콘텐츠 조회
      const introContents = await storage.getCareManagerIntroContents(id);

      res.json({
        success: true,
        introContents: introContents || []
      });
    } catch (error) {
      console.error("소개글 콘텐츠 조회 오류:", error);
      res.status(500).json({
        error: "소개글 콘텐츠 조회 중 오류가 발생했습니다."
      });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      res.json(user);
    } catch (error) {
      console.error("사용자 정보 조회 오류:", error);
      res.status(500).json({ error: "사용자 정보를 불러오는데 실패했습니다" });
    }
  });

  // 사용자 인증 상태 조회 API
  app.get("/api/users/:id/certification", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      res.json({
        isCertified: user.isCertified || false,
        certificationDate: user.certificationDate || null,
        certificationPaymentId: user.certificationPaymentId || null
      });
    } catch (error) {
      console.error("인증 상태 조회 오류:", error);
      res.status(500).json({ error: "인증 상태를 조회하는데 실패했습니다" });
    }
  });
  
  // 사용자 인증 활성화 API
  app.post("/api/users/:id/certification", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { paymentId } = req.body;
      
      if (!paymentId) {
        return res.status(400).json({ error: "결제 ID가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      // 인증 활성화 처리
      await db.update(users)
        .set({ 
          isCertified: true, 
          certificationDate: new Date(), 
          certificationPaymentId: paymentId 
        })
        .where(eq(users.id, userId));
      
      res.json({ 
        success: true,
        message: "인증이 성공적으로 활성화되었습니다",
        isCertified: true,
        certificationDate: new Date(),
        certificationPaymentId: paymentId
      });
    } catch (error) {
      console.error("인증 활성화 오류:", error);
      res.status(500).json({ error: "인증 활성화에 실패했습니다" });
    }
  });

  // ==================== 장바구니 API ====================
  app.get('/api/users/:userId/cart', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: '유효하지 않은 사용자 ID입니다.' });
      const items = await storage.getCartItems(userId);

      // 각 아이템에 상품 정보 합쳐서 반환
      const enriched = await Promise.all(items.map(async (item: any) => {
        const product = await storage.getProduct(item.productId);
        return { ...item, product };
      }));

      res.json(enriched);
    } catch (error) {
      console.error('장바구니 조회 오류:', error);
      res.status(500).json({ error: '장바구니를 불러오는데 실패했습니다.' });
    }
  });

  app.post('/api/users/:userId/cart', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { productId, quantity, selected_options } = req.body as { productId?: number | string; quantity?: number; selected_options?: any };
      if (isNaN(userId) || !productId) return res.status(400).json({ error: '필수 입력값이 누락되었습니다.' });
      const pid = parseInt(productId as any);
      const qty = Math.max(1, Number(quantity || 1));

      // 동일 옵션 상품 존재 시 수량만 증가
      const existing = await storage.findCartItem(userId, pid, selected_options ?? null);
      if (existing) {
        const updated = await storage.updateCartItem(existing.id as any, { quantity: (existing.quantity || 1) + qty });
        const product = await storage.getProduct(pid);
        return res.status(200).json({ ...updated, product });
      }

      const inserted = await storage.addCartItem({ userId, productId: pid, quantity: qty, selectedOptions: selected_options ?? null } as any);
      const product = await storage.getProduct(pid);
      res.status(201).json({ ...inserted, product });
    } catch (error) {
      console.error('장바구니 추가 오류:', error);
      res.status(500).json({ error: '장바구니 추가에 실패했습니다.' });
    }
  });

  app.put('/api/users/:userId/cart/:itemId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const itemId = parseInt(req.params.itemId);
      const { quantity } = req.body as { quantity?: number };
      if (isNaN(userId) || isNaN(itemId)) return res.status(400).json({ error: '유효하지 않은 요청입니다.' });
      if (quantity == null || Number(quantity) < 1) return res.status(400).json({ error: '수량은 1 이상이어야 합니다.' });

      const updated = await storage.updateCartItem(itemId, { quantity: Number(quantity) });
      if (!updated) return res.status(404).json({ error: '장바구니 항목을 찾을 수 없습니다.' });
      res.json(updated);
    } catch (error) {
      console.error('장바구니 업데이트 오류:', error);
      res.status(500).json({ error: '장바구니 업데이트에 실패했습니다.' });
    }
  });

  app.delete('/api/users/:userId/cart/:itemId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(userId) || isNaN(itemId)) return res.status(400).json({ error: '유효하지 않은 요청입니다.' });
      const ok = await storage.removeCartItem(itemId);
      if (!ok) return res.status(404).json({ error: '장바구니 항목을 찾을 수 없습니다.' });
      res.json({ success: true });
    } catch (error) {
      console.error('장바구니 삭제 오류:', error);
      res.status(500).json({ error: '장바구니 삭제에 실패했습니다.' });
    }
  });

  app.delete('/api/users/:userId/cart', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: '유효하지 않은 사용자 ID입니다.' });
      await storage.clearCart(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('장바구니 비우기 오류:', error);
      res.status(500).json({ error: '장바구니 비우기에 실패했습니다.' });
    }
  });

  // 장바구니 API 엔드포인트 추가
  // 사용자의 장바구니 조회
  app.get("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }
      
      console.log(`[SERVER] 사용자 ${userId}의 장바구니 조회 요청`);
      
      // 메모리 기반 장바구니 데이터 (실제로는 DB에서 가져와야 함)
      const cartItems = [];
      
      return res.status(200).json({ cartItems });
    } catch (error) {
      console.error("장바구니 조회 오류:", error);
      return res.status(500).json({ error: "장바구니 조회 중 오류가 발생했습니다." });
    }
  });

  // 장바구니에 상품 추가
  app.post("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;
      const { productId, quantity, selected_options } = req.body;
      
      if (!userId || !productId) {
        return res.status(400).json({ error: "사용자 ID와 상품 ID가 필요합니다." });
      }
      
      console.log(`[SERVER] 사용자 ${userId}의 장바구니에 상품 ${productId} 추가 요청`);
      
      // 메모리 기반 장바구니 데이터 (실제로는 DB에 저장해야 함)
      const cartItem = {
        id: Date.now().toString(),
        userId,
        productId,
        quantity: quantity || 1,
        selected_options: selected_options || null,
        createdAt: new Date()
      };
      
      return res.status(201).json(cartItem);
    } catch (error) {
      console.error("장바구니 상품 추가 오류:", error);
      return res.status(500).json({ error: "장바구니에 상품을 추가하는 중 오류가 발생했습니다." });
    }
  });

  // 장바구니 상품 수정
  app.put("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const { userId, itemId } = req.params;
      const { quantity, selected_options } = req.body;
      
      if (!userId || !itemId) {
        return res.status(400).json({ error: "사용자 ID와 상품 ID가 필요합니다." });
      }
      
      console.log(`[SERVER] 사용자 ${userId}의 장바구니 상품 ${itemId} 수정 요청`);
      
      // 메모리 기반 장바구니 데이터 (실제로는 DB에서 수정해야 함)
      const cartItem = {
        id: itemId,
        userId,
        quantity: quantity || 1,
        selected_options: selected_options || null,
        updatedAt: new Date()
      };
      
      return res.status(200).json(cartItem);
    } catch (error) {
      console.error("장바구니 상품 수정 오류:", error);
      return res.status(500).json({ error: "장바구니 상품을 수정하는 중 오류가 발생했습니다." });
    }
  });

  // 장바구니 상품 삭제
  app.delete("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const { userId, itemId } = req.params;
      
      if (!userId || !itemId) {
        return res.status(400).json({ error: "사용자 ID와 상품 ID가 필요합니다." });
      }
      
      console.log(`[SERVER] 사용자 ${userId}의 장바구니에서 상품 ${itemId} 삭제 요청`);
      
      // 메모리 기반 장바구니 데이터 (실제로는 DB에서 삭제해야 함)
      
      return res.status(200).json({ success: true, message: "상품이 장바구니에서 삭제되었습니다." });
    } catch (error) {
      console.error("장바구니 상품 삭제 오류:", error);
      return res.status(500).json({ error: "장바구니에서 상품을 삭제하는 중 오류가 발생했습니다." });
    }
  });

  // 장바구니 비우기
  app.delete("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }
      
      console.log(`[SERVER] 사용자 ${userId}의 장바구니 비우기 요청`);
      
      // 메모리 기반 장바구니 데이터 (실제로는 DB에서 삭제해야 함)
      
      return res.status(200).json({ success: true, message: "장바구니가 비워졌습니다." });
    } catch (error) {
      console.error("장바구니 비우기 오류:", error);
      return res.status(500).json({ error: "장바구니를 비우는 중 오류가 발생했습니다." });
    }
  });
}
