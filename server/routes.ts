// @ts-nocheck
import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import {
  insertUserSchema,
  insertBookingSchema,
  insertMessageSchema,
  createUserWithHash,
  verifyPassword,
  users,
} from "../shared/schema.ts";
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
import modelEditorRouter from "./routes/model-editor.js";
import feedRouter from "./routes/feed.js";
import { uploadToCloudinary } from "./cloudinary.js";

// Cloudinary를 사용하므로 메모리 스토리지 사용
const memoryStorage = multer.memoryStorage();

// 이미지 업로드용 Multer (메모리 → Cloudinary)
const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다."));
    }
  },
});

// 작품 완료 / 주문 파일 전용 Multer (다양한 파일 형식 허용)
const uploadCompletionFile = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB 제한
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/zip", "application/x-zip-compressed",
      "application/x-rar-compressed", "application/x-7z-compressed",
      "application/x-tar", "application/gzip",
      "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
      "video/mp4", "video/quicktime", "video/x-msvideo",
      "application/pdf", "application/x-photoshop",
      "image/vnd.adobe.photoshop", "application/postscript",
      "application/octet-stream",
    ];

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      file.originalname.match(
        /\.(zip|rar|7z|tar|gz|png|jpg|jpeg|gif|mp4|mov|psd|ai|pdf)$/i,
      )
    ) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다: ${file.mimetype}`));
    }
  },
});

export async function registerRoutes(app: Express): Promise<void> {
  // 정적 파일 서빙 (로컬 public 폴더 - 기존 호환용)
  const imageUploadDir = path.join(process.cwd(), "public", "images");
  if (fs.existsSync(imageUploadDir)) {
    app.use(
      "/images",
      (req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET");
        res.header("Access-Control-Allow-Headers", "Content-Type");
        next();
      },
      express.static(imageUploadDir),
    );
  }

  // 결제 라우트 등록
  registerPaymentRoutes(app);

  // 모델 에디터 라우트 등록
  app.use("/api/model-editor", modelEditorRouter);

  // 피드 라우트 등록
  app.use("/api/feed", feedRouter);

  // 사용자 정보 조회 API
  app.get("/api/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      console.log(`👤 사용자 정보 조회 요청: ${userId}`);

      const [user] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          photoURL: users.photoURL,
          bio: users.bio,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        console.log(`❌ 사용자 찾을 수 없음: ${userId}`);
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      console.log(
        `✅ 사용자 정보 조회 성공: ${user.displayName} (${user.email})`,
      );
      res.json(user);
    } catch (error) {
      console.error("사용자 정보 조회 실패:", error);
      res.status(500).json({ error: "사용자 정보를 불러오는데 실패했습니다." });
    }
  });

  // ==================== Cloudinary 이미지 업로드 API ====================

  // 프로필 이미지 업로드 → Cloudinary
  app.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      console.log("🖼️ 프로필 이미지 업로드 요청 받음 (Cloudinary)");

      if (!req.file) {
        return res
          .status(400)
          .json({ error: "이미지가 업로드되지 않았습니다." });
      }

      const result = await uploadToCloudinary(req.file.buffer, "profile");

      console.log("✅ 프로필 이미지 Cloudinary 업로드 성공:", {
        originalName: req.file.originalname,
        url: result.url,
      });

      res.json({
        success: true,
        imageUrl: result.url,
      });
    } catch (error) {
      console.error("🚫 이미지 업로드 오류:", error);
      res.status(500).json({ error: "이미지 업로드 중 오류가 발생했습니다" });
    }
  });

  // 상품 이미지 업로드 → Cloudinary
  app.post(
    "/api/upload/product-image",
    upload.single("image"),
    async (req, res) => {
      try {
        console.log("🖼️ 상품 이미지 업로드 요청 받음 (Cloudinary)");

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "이미지가 업로드되지 않았습니다." });
        }

        const result = await uploadToCloudinary(req.file.buffer, "products");

        console.log("✅ 상품 이미지 Cloudinary 업로드 성공:", {
          originalName: req.file.originalname,
          url: result.url,
        });

        return res.json({
          success: true,
          imageUrl: result.url,
        });
      } catch (error) {
        console.error("🚫 상품 이미지 업로드 오류:", error);
        return res.status(500).json({
          error: "이미지 업로드 중 오류가 발생했습니다",
        });
      }
    },
  );

  // 채팅 이미지 업로드 → Cloudinary
  app.post(
    "/api/upload/chat-image",
    upload.single("image"),
    async (req, res) => {
      try {
        console.log("🖼️ 채팅 이미지 업로드 요청 받음 (Cloudinary)");

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "이미지가 업로드되지 않았습니다." });
        }

        const roomId = req.query.roomId || "general";

        const result = await uploadToCloudinary(req.file.buffer, `chat/${roomId}`);

        console.log("✅ 채팅 이미지 Cloudinary 업로드 성공:", {
          roomId,
          originalName: req.file.originalname,
          url: result.url,
        });

        return res.json({
          success: true,
          url: result.url,
        });
      } catch (error) {
        console.error("🚫 채팅 이미지 업로드 오류:", error);
        return res.status(500).json({
          error: "이미지 업로드 중 오류가 발생했습니다",
        });
      }
    },
  );

  // 작품 완료 파일 업로드 → Cloudinary
  app.post(
    "/api/upload/completion-file",
    uploadCompletionFile.single("file"),
    async (req, res) => {
      try {
        console.log("📦 작품 완료 파일 업로드 요청 받음 (Cloudinary)");

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "파일이 업로드되지 않았습니다." });
        }

        // 파일 타입에 따라 리소스 유형 결정
        const resourceType = req.file.mimetype.startsWith("video/")
          ? "video" as const
          : req.file.mimetype.startsWith("image/")
            ? "image" as const
            : "raw" as const;

        const result = await uploadToCloudinary(req.file.buffer, "completion", {
          resourceType,
        });

        console.log("✅ 작품 완료 파일 Cloudinary 업로드 성공:", {
          originalName: req.file.originalname,
          url: result.url,
        });

        return res.json({
          success: true,
          fileUrl: result.url,
        });
      } catch (error) {
        console.error("🚫 작품 완료 파일 업로드 오류:", error);
        return res.status(500).json({
          error: "파일 업로드 중 오류가 발생했습니다",
        });
      }
    },
  );

  // 주문 상품 배송용 디지털 파일 업로드 → Cloudinary
  app.post(
    "/api/upload/order-file",
    uploadCompletionFile.single("file"),
    async (req, res) => {
      try {
        console.log("📦 주문 배송 파일 업로드 요청 받음 (Cloudinary)");

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "파일이 업로드되지 않았습니다." });
        }

        const resourceType = req.file.mimetype.startsWith("video/")
          ? "video" as const
          : req.file.mimetype.startsWith("image/")
            ? "image" as const
            : "raw" as const;

        const result = await uploadToCloudinary(req.file.buffer, "order-files", {
          resourceType,
        });

        console.log("✅ 주문 배송 파일 Cloudinary 업로드 성공:", {
          originalName: req.file.originalname,
          url: result.url,
        });

        return res.json({
          success: true,
          fileUrl: result.url,
          fileName: req.file.originalname,
        });
      } catch (error) {
        console.error("🚫 주문 배송 파일 업로드 오류:", error);
        return res.status(500).json({
          error: "파일 업로드 중 오류가 발생했습니다",
        });
      }
    },
  );

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("📝 회원가입 요청:", req.body);
      const userData = await insertUserSchema.parseAsync(req.body);
      console.log("✅ 스키마 검증 통과:", userData);

      const existingUser = await storage.getUserByEmail(userData.email);

      if (existingUser) {
        console.log("❌ 이미 존재하는 이메일:", userData.email);
        return res.status(400).json({ error: "이미 존재하는 이메일입니다" });
      }

      // 비밀번호 암호화 적용
      const userWithHashedPassword = await createUserWithHash(userData);
      console.log(
        "🔒 비밀번호 암호화 완료, 길이:",
        userWithHashedPassword.password?.length,
      );

      const user = await storage.createUser(userWithHashedPassword);
      console.log("🎉 사용자 생성 완료:", {
        id: user.id,
        email: user.email,
        username: user.username,
      });

      // 민감한 정보는 제외하고 반환
      res.json({
        user: {
          id: user.id,
          uid: String(user.id), // Firebase 호환성
          email: user.email,
          name: user.name,
          displayName: user.displayName || user.name, // displayName 우선, 없으면 name
          photoURL: user.photoURL || null, // 프로필 사진 추가
          userType: user.userType,
          grade: user.grade,
        },
      });
    } catch (error) {
      console.error("회원가입 오류:", error);
      res.status(400).json({ error: "회원가입에 실패했습니다" });
    }
  });

  // Firebase 사용자 등록/업데이트 API
  app.post("/api/auth/register-firebase-user", async (req, res) => {
    try {
      console.log("🔥 Firebase 사용자 DB 저장/업데이트:", req.body);
      const {
        uid,
        username,
        displayName,
        email,
        password,
        userType,
        photoURL,
      } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "이메일과 비밀번호는 필수입니다" });
      }

      // Firebase UID로 먼저 확인
      if (uid) {
        const existingUserById = await db
          .select()
          .from(users)
          .where(eq(users.id, uid))
          .limit(1);

        if (existingUserById.length > 0) {
          // UID로 사용자를 찾았으면 업데이트
          console.log("✅ Firebase UID로 사용자 정보 업데이트:", uid);
          await db
            .update(users)
            .set({
              photoURL: photoURL || null,
              displayName: displayName || existingUserById[0].displayName,
              email: email,
            })
            .where(eq(users.id, uid));

          return res.json({
            success: true,
            user: {
              id: uid,
              email: email,
              displayName: displayName || existingUserById[0].displayName,
              photoURL: photoURL || null,
              userType: existingUserById[0].userType,
            },
          });
        }
      }

      // 이메일로 기존 사용자 확인
      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        // 기존 사용자가 있으면 photoURL과 displayName 업데이트
        console.log("✅ 이메일로 사용자 정보 업데이트:", email);
        await db
          .update(users)
          .set({
            photoURL: photoURL || null,
            displayName: displayName || existingUser.displayName,
          })
          .where(eq(users.id, existingUser.id));

        return res.json({
          success: true,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            displayName: displayName || existingUser.displayName,
            photoURL: photoURL || null,
            userType: existingUser.userType,
          },
        });
      }

      // 새 사용자 생성 - Firebase UID를 id로 사용
      const userData = {
        id: uid || password, // Firebase UID를 id로 사용
        username: username || email.split("@")[0],
        displayName: displayName || username || email.split("@")[0],
        email,
        password, // Firebase UID를 비밀번호로도 사용
        userType: userType || "customer",
        photoURL: photoURL || null,
      };

      console.log("🆕 새 Firebase 사용자 생성:", {
        id: userData.id,
        email: userData.email,
      });
      const user = await storage.createUser(userData);
      console.log("🎉 Firebase 사용자 DB 저장 완료:", email);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          userType: user.userType,
        },
      });
    } catch (error) {
      console.error("Firebase 사용자 DB 저장 오류:", error);
      res.status(500).json({ error: "사용자 정보 저장에 실패했습니다" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("🔐 로그인 요청:", req.body);
      let { email, password } = req.body;
      email = typeof email === "string" ? email.trim().toLowerCase() : email;
      password = typeof password === "string" ? password.trim() : password;

      console.log(
        `📧 처리된 이메일: "${email}", 비밀번호 길이: ${password?.length}`,
      );

      if (!email || !password) {
        console.log("이메일 또는 비밀번호 누락");
        return res
          .status(400)
          .json({ error: "이메일과 비밀번호는 필수 항목입니다" });
      }

      const user = await storage.getUserByEmail(email);

      if (!user) {
        console.log(`❌ 사용자 없음: ${email}`);
        console.log(
          `📋 저장된 모든 사용자 이메일:`,
          Array.from((storage as any).users?.values() || []).map(
            (u: any) => u.email,
          ),
        );
        return res
          .status(401)
          .json({ error: "이메일 또는 비밀번호가 잘못되었습니다" });
      }

      console.log(
        `✅ 사용자 찾음: ${email}, 저장된 비밀번호 길이: ${user.password?.length}`,
      );

      // 비밀번호 검증
      const bcryptFormat = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
      const storedLooksHashedInitial =
        typeof user.password === "string" && bcryptFormat.test(user.password);
      console.log(
        `[auth] 로그인 검사 시작: email=${email}, storedFmt=${storedLooksHashedInitial ? "bcrypt" : "plain"} len=${(user.password || "").length}`,
      );
      let isPasswordValid = await verifyPassword(password, user.password);
      console.log(`[auth] bcrypt.compare 결과: ${isPasswordValid}`);

      // 레거시 폴백: DB에 평문이 저장되어 있거나, 사용자가 해시 문자열 자체를 입력하는 경우 처리
      if (!isPasswordValid) {
        const storedLooksHashed =
          typeof user.password === "string" && bcryptFormat.test(user.password);
        if (password === user.password) {
          if (storedLooksHashed) {
            // 사용자가 저장된 해시와 동일한 문자열을 입력한 경우: 통과만 시키고 DB는 변경하지 않음
            isPasswordValid = true;
            console.log(
              `[auth] 해시 문자열 입력으로 통과(변경 없음): user=${email}`,
            );
          } else {
            // 저장된 값이 평문이고 입력도 동일 평문 → bcrypt로 업그레이드 저장
            const upgraded = bcrypt.hashSync(password, 10);
            await storage.updatePassword(user.id, upgraded);
            isPasswordValid = true;
            console.log(
              `[auth] 레거시 평문 비밀번호를 bcrypt로 업그레이드: user=${email}`,
            );
          }
        }
      }

      if (!isPasswordValid) {
        console.log(
          `❌ 비밀번호 불일치: ${email}, 입력된 비밀번호: "${password}", 저장된 비밀번호: "${user.password}"`,
        );
        return res
          .status(401)
          .json({ error: "이메일 또는 비밀번호가 잘못되었습니다" });
      }

      console.log(`로그인 성공: ${email}`);

      // Firebase 사용자 정보와 호환되도록 응답 형식 수정
      res.json({
        user: {
          id: user.id,
          uid: String(user.id), // Firebase uid 호환성
          email: user.email,
          name: user.name,
          displayName: user.displayName || user.name, // displayName 우선, 없으면 name
          photoURL: user.photoURL || null, // 프로필 사진 추가
          userType: user.userType,
          grade: user.grade,
          isApproved: user.isApproved || user.userType !== "careManager",
        },
      });
    } catch (error) {
      console.error("로그인 오류:", error);
      res.status(400).json({ error: "로그인에 실패했습니다" });
    }
  });

  // Firebase 사용자 비밀번호 변경 (Firebase UID 사용) - 제거됨, 통합 엔드포인트 사용

  // 사용자 비밀번호 변경 (UUID 및 숫자 ID 모두 지원)
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      let { userId, currentPassword, newPassword } = req.body as {
        userId?: string | number;
        currentPassword?: string;
        newPassword?: string;
      };

      // 입력 정리
      if (typeof currentPassword === "string")
        currentPassword = currentPassword.trim();
      if (typeof newPassword === "string") newPassword = newPassword.trim();

      if (!userId || !currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "userId, currentPassword, newPassword는 필수입니다" });
      }

      // userId를 문자열로 변환
      const userIdStr = String(userId);

      const user = await storage.getUser(userIdStr);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      let isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        const bcryptFormat = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
        const storedLooksHashed =
          typeof user.password === "string" && bcryptFormat.test(user.password);
        const inputLooksHashed =
          typeof currentPassword === "string" &&
          bcryptFormat.test(currentPassword);
        // 1) DB에 평문 저장되어 있었고 입력도 동일 평문인 경우 허용
        // 2) DB에 해시가 저장되어 있고 사용자가 그 해시 문자열을 그대로 입력한 경우도 허용(정상화 목적)
        if (
          currentPassword === user.password ||
          (storedLooksHashed &&
            inputLooksHashed &&
            currentPassword === user.password)
        ) {
          isValid = true;
        }
      }
      if (!isValid) {
        return res
          .status(401)
          .json({ error: "현재 비밀번호가 일치하지 않습니다" });
      }

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res
          .status(400)
          .json({ error: "새 비밀번호는 6자 이상이어야 합니다" });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await storage.updatePassword(userIdStr, hashedPassword);

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
      console.log("🔑 카카오 로그인 요청 받음, code:", code ? "있음" : "없음");
      
      if (!code) {
        console.log("❌ 카카오 코드 누락");
        return res.status(400).json({ error: "code required" });
      }

      // 환경 변수 확인
      console.log("🔧 카카오 환경 변수 확인:", {
        KAKAO_REST_KEY: process.env.KAKAO_REST_KEY ? "설정됨" : "❌ 누락",
        KAKAO_REDIRECT_URI: process.env.KAKAO_REDIRECT_URI || "❌ 누락"
      });

      if (!process.env.KAKAO_REST_KEY || !process.env.KAKAO_REDIRECT_URI) {
        console.error("❌ 카카오 환경 변수가 설정되지 않았습니다");
        return res.status(500).json({ error: "카카오 로그인 설정이 완료되지 않았습니다" });
      }

      console.log("📡 카카오 토큰 요청 중...");
      const { data: tokenData } = await axios.post(
        "https://kauth.kakao.com/oauth/token",
        qs.stringify({
          grant_type: "authorization_code",
          client_id: process.env.KAKAO_REST_KEY,
          redirect_uri: process.env.KAKAO_REDIRECT_URI,
          code,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );

      const accessToken = tokenData.access_token;
      console.log("✅ 카카오 액세스 토큰 받음");

      console.log("📡 카카오 사용자 정보 요청 중...");
      const { data: me } = await axios.get(
        "https://kapi.kakao.com/v2/user/me",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      console.log("📦 카카오 API 원본 응답:", JSON.stringify(me, null, 2));

      const kakaoId: string = me.id.toString();
      const email: string | undefined = me.kakao_account?.email;
      const nickname: string | undefined = me.properties?.nickname || me.kakao_account?.profile?.nickname;
      const photoURL: string | undefined = me.properties?.profile_image || me.kakao_account?.profile?.profile_image_url;

      console.log("✅ 카카오 사용자 정보 받음:", {
        kakaoId,
        email: email || "이메일 없음",
        nickname: nickname || "닉네임 없음",
        photoURL: photoURL ? photoURL.substring(0, 50) + "..." : "프로필 사진 없음"
      });

      // 사용자 찾기/생성
      // 1. 실제 이메일이 있으면 실제 이메일로 찾기
      let user = email
        ? await storage.getUserByEmail(email).catch(() => undefined)
        : undefined;

      // 2. 실제 이메일이 없거나 찾지 못한 경우, 임시 이메일로 찾기
      const tempEmail = `kakao_${kakaoId}@example.com`;
      if (!user) {
        user = await storage.getUserByEmail(tempEmail).catch(() => undefined);
        if (user) {
          console.log("✅ 임시 이메일로 기존 카카오 사용자 찾음:", user.email);
        }
      } else {
        console.log("✅ 실제 이메일로 기존 사용자 찾음:", user.email);
      }

      // 3. 사용자가 없으면 새로 생성
      if (!user) {
        console.log("🆕 새 카카오 사용자 생성 중...");
        // 랜덤 비밀번호 생성 (소셜 로그인이므로 실제 사용되지 않음)
        const randomPassword = Math.random().toString(36).slice(-10);

        const userData = {
          username: nickname || `kakao_${kakaoId.slice(-6)}`,
          email: email || tempEmail,
          password: randomPassword,
          name: nickname || `카카오사용자_${kakaoId.slice(-6)}`, // null 대신 기본값 설정
          phone: null,
          userType: "customer" as const, // 타입 명시적 캐스팅
        };

        // 비밀번호 암호화 적용
        const userWithHashedPassword = await createUserWithHash(userData);
        
        try {
          user = await storage.createUser(userWithHashedPassword);
          console.log("✅ 새 카카오 사용자 생성 완료:", user.email);
        } catch (createError: any) {
          // 중복 키 에러인 경우 다시 조회
          if (createError.code === '23505') {
            console.log("⚠️ 중복 에러 발생, 다시 조회 중...");
            user = await storage.getUserByEmail(email || tempEmail);
            if (user) {
              console.log("✅ 재조회로 기존 사용자 찾음:", user.email);
            } else {
              throw new Error("사용자 생성 실패: 중복 에러 후 재조회 실패");
            }
          } else {
            throw createError;
          }
        }
      }

      console.log("🔥 Firebase 커스텀 토큰 생성 중...");
      // DB에 생성된 사용자 ID를 사용하여 Firebase 커스텀 토큰 생성
      // 추가 클레임에 사용자 정보 포함
      const additionalClaims = {
        email: user.email,
        displayName: user.displayName || user.name,
        photoURL: user.photoURL || photoURL || null,
        userType: user.userType
      };
      
      const customToken = await adminAuth.createCustomToken(user.id, additionalClaims);
      console.log("✅ Firebase 커스텀 토큰 생성 완료, user.id:", user.id);
      console.log("📝 토큰에 포함된 클레임:", additionalClaims);

      res.json({
        token: customToken,
        user: {
          id: user.id,
          uid: user.id, // Firebase uid로도 전달
          email: user.email,
          name: user.name,
          displayName: user.displayName || user.name,
          photoURL: user.photoURL || photoURL || null,
          userType: user.userType,
          grade: user.grade,
        },
      });
    } catch (err: any) {
      console.error("❌ [KakaoAuth] 에러 발생:");
      console.error("  - 메시지:", err.message);
      console.error("  - 스택:", err.stack);
      if (err.response) {
        console.error("  - 응답 상태:", err.response.status);
        console.error("  - 응답 데이터:", JSON.stringify(err.response.data, null, 2));
      }
      res.status(500).json({ error: "kakao auth failed", details: err.message });
    }
  });

  // 사용자 유형 변경 API
  app.post("/api/users/:id/change-type", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { userType } = req.body;

      // 유효한 사용자 유형인지 확인
      if (!["customer", "careManager", "admin"].includes(userType)) {
        return res
          .status(400)
          .json({ error: "유효하지 않은 사용자 유형입니다" });
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
          userType: user.userType,
        },
      });
    } catch (error) {
      console.error("사용자 유형 변경 오류:", error);
      res.status(400).json({ error: "사용자 유형 변경에 실패했습니다" });
    }
  });

  // Firebase 사용자 프로필 사진 업데이트 API
  app.put("/api/users/firebase/:uid/profile-photo", async (req, res) => {
    try {
      const firebaseUid = req.params.uid;
      const { photoURL } = req.body;

      console.log("🖼️ Firebase 프로필 사진 업데이트:", {
        firebaseUid,
        photoURL,
      });

      if (!photoURL) {
        return res.status(400).json({ error: "프로필 사진 URL이 필요합니다." });
      }

      // Firebase UID로 사용자 찾기 (id 필드에 Firebase UID가 저장되어 있음)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, firebaseUid))
        .limit(1);

      if (user) {
        // DB에 photoURL 업데이트
        await db
          .update(users)
          .set({ photoURL })
          .where(eq(users.id, firebaseUid));

        console.log(
          "✅ Firebase 사용자 프로필 사진 DB 업데이트 완료:",
          firebaseUid,
        );
      } else {
        console.warn("⚠️ Firebase UID로 사용자를 찾을 수 없음:", firebaseUid);
      }

      return res.status(200).json({
        success: true,
        message: "Firebase 사용자 프로필 사진 업데이트 완료",
        photoURL,
      });
    } catch (error: any) {
      console.error("Firebase 프로필 사진 업데이트 오류:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 기존 사용자 프로필 사진 업데이트 API (문자열 또는 숫자 ID 사용)
  app.put("/api/users/:id/profile-photo", async (req, res) => {
    try {
      const userId = req.params.id; // 문자열 ID (Firebase UID 또는 일반 숫자 ID)
      const { photoURL } = req.body;

      console.log("🖼️ 프로필 사진 업데이트:", {
        userId,
        photoURL: photoURL ? photoURL.substring(0, 50) + "..." : "(삭제)",
      });

      if (photoURL === undefined || photoURL === null) {
        return res.status(400).json({ error: "프로필 사진 URL이 필요합니다." });
      }

      // DB에서 사용자 찾기 (문자열 ID로 검색)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      // DB에 photoURL 업데이트 (빈 문자열이면 null로 저장)
      const photoValue = photoURL || null;
      await db.update(users).set({ photoURL: photoValue }).where(eq(users.id, userId));

      console.log("✅ 프로필 사진 DB 업데이트 완료:", userId);

      // 응답 객체에 명시적으로 타입 지정
      const result: {
        success: boolean;
        photoURL: string;
        careManagerUpdated?: boolean;
      } = {
        success: true,
        photoURL,
      };

      // 사용자가 케어 매니저인 경우 크리에이터프로필 이미지도 업데이트
      if (user.userType === "careManager") {
        try {
          // userId로 연결된 케어매니저 찾기
          const careManager = await storage.getCareManagerByUserId(userId);
          if (careManager) {
            await storage.updateCareManager(careManager.id, {
              photoURL: photoURL,
            });
            result.careManagerUpdated = true;
            console.log("✅ 크리에이터 프로필 이미지도 업데이트 완료");
          }
        } catch (error) {
          console.error("크리에이터프로필 사진 업데이트 실패:", error);
        }
      }

      res.json(result);
    } catch (error) {
      console.error("프로필 사진 업데이트 오류:", error);
      res
        .status(500)
        .json({ error: "프로필 사진 업데이트 중 오류가 발생했습니다." });
    }
  });

  // 크리에이터승인 API
  app.post("/api/care-managers/:id/approve", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      const user = await storage.approveCareManager(userId);

      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      res.json({
        success: true,
        message: "크리에이터승인이 완료되었습니다",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.userType,
          isApproved: user.isApproved,
        },
      });
    } catch (error) {
      console.error("크리에이터승인 오류:", error);
      res.status(400).json({ error: "크리에이터승인에 실패했습니다" });
    }
  });

  // 크리ot�이터예약 목록 조회 API
  app.get("/api/bookings/care-manager/:careManagerId", async (req, res) => {
    try {
      const careManagerId = parseInt(req.params.careManagerId);

      if (isNaN(careManagerId)) {
        return res
          .status(400)
          .json({ error: "유효하지 않은 케어매니저 ID입니다" });
      }

      const bookings = await storage.getBookingsByCareManager(careManagerId);

      // 각 예약에 대한 의뢰자 정보 추가
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          // 의뢰자 정보 가져오기
          let user = null;
          if (booking.userId) {
            user = await storage.getUserByFirebaseId(booking.userId);
          }

          return {
            ...booking,
            date: booking.bookingDate || booking.createdAt || new Date(), // bookingDate를 date로 매핑
            userName:
              user?.username ||
              user?.displayName ||
              user?.email ||
              booking.userId, // username 우선, 없으면 displayName, email, 마지막으로 UID
            userEmail: user?.email || null,
            userPhone: user?.phone || null,
          };
        }),
      );

      res.json(enrichedBookings);
    } catch (error) {
      console.error("크리에이터예약 목록 조회 오류:", error);
      res.status(500).json({ error: "예약 목록 조회에 실패했습니다" });
    }
  });

  // 날짜별 크리에이터예약 조회 API
  app.get(
    "/api/bookings/care-manager-date/:careManagerId/:date",
    async (req, res) => {
      try {
        const careManagerId = parseInt(req.params.careManagerId);
        const date = req.params.date;

        const bookings = await storage.getBookingsByCareManagerAndDate(
          careManagerId,
          date,
        );

        // 각 예약에 대한 의뢰자 정보 추가
        const enrichedBookings = await Promise.all(
          bookings.map(async (booking) => {
            // 의뢰자 정보 가져오기
            let user = null;
            if (booking.userId) {
              user = await storage.getUserByFirebaseId(booking.userId);
            }

            return {
              ...booking,
              date: booking.bookingDate || booking.createdAt || new Date(), // bookingDate를 date로 매핑
              userName:
                user?.username ||
                user?.displayName ||
                user?.email ||
                booking.userId, // username 우선, 없으면 displayName, email, 마지막으로 UID
              userEmail: user?.email || null,
              userPhone: user?.phone || null,
            };
          }),
        );

        res.json(enrichedBookings);
      } catch (error) {
        console.error("날짜별 크리에이터예약 조회 오류:", error);
        res.status(500).json({ error: "날짜별 예약 조회에 실패했습니다" });
      }
    },
  );

  // 예약 상태 변경 API
  app.put("/api/bookings/:id/status", async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { status, completionFiles, completionNote, completedAt } = req.body;

      // 유효한 상태 값인지 확인
      if (!["pending", "confirmed", "completed", "canceled"].includes(status)) {
        return res.status(400).json({ error: "유효하지 않은 예약 상태입니다" });
      }

      // 작업 완료 시 추가 데이터 업데이트
      if (
        status === "completed" &&
        (completionFiles || completionNote || completedAt)
      ) {
        const booking = await storage.updateBookingWithCompletion(
          bookingId,
          status,
          completionFiles || [],
          completionNote || "",
          completedAt,
        );

        if (!booking) {
          return res.status(404).json({ error: "예약을 찾을 수 없습니다" });
        }

        res.json(booking);
      } else {
        const booking = await storage.updateBookingStatus(bookingId, status);

        if (!booking) {
          return res.status(404).json({ error: "예약을 찾을 수 없습니다" });
        }

        res.json(booking);
      }
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
      console.error("크리에이터목록 조회 오류:", error);
      res
        .status(500)
        .json({ error: "크리에이터목록을 불러오는데 실패했습니다" });
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

  // 크리에이터정보 업데이트 API
  app.put("/api/care-managers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payload = req.body;

      console.log("📝 크리에이터 업데이트 요청:", {
        id,
        name: payload.name,
        age: payload.age,
        description: payload.description?.substring(0, 50),
        descriptionLength: payload.description?.length || 0,
        hourlyRate: payload.hourlyRate,
        location: payload.location,
      });

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
        console.log("✅ 크리에이터 생성 완료 (description 포함)");
        return res.status(201).json(updated);
      }

      console.log("✅ 크리에이터 업데이트 완료:", {
        name: updated.name,
        age: updated.age,
        description: updated.description?.substring(0, 50),
        descriptionLength: updated.description?.length || 0,
        hourlyRate: updated.hourlyRate,
      });

      res.json(updated);
    } catch (error) {
      console.error("크리에이터업데이트 오류:", error);
      res.status(400).json({ error: "크리에이터업데이트에 실패했습니다" });
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

      // date 필드를 bookingDate로 변환 (클라이언트 호환성)
      if (req.body.date) {
        req.body.bookingDate =
          typeof req.body.date === "string"
            ? new Date(req.body.date)
            : req.body.date;
        delete req.body.date;
      }

      // bookingDate가 없으면 현재 시간으로 설정
      if (!req.body.bookingDate) {
        req.body.bookingDate = new Date();
      }

      // totalAmount를 문자열로 변환
      if (req.body.totalAmount && typeof req.body.totalAmount === "number") {
        req.body.totalAmount = req.body.totalAmount.toString();
      }

      const bookingData = insertBookingSchema.parse(req.body);
      console.log("스키마 검증 후 데이터:", bookingData);

      // 케어매니저 존재 여부 확인
      const careManager = await storage.getCareManager(
        bookingData.careManagerId,
      );
      if (!careManager) {
        return res.status(400).json({
          error: `AI 크리에이터 ID ${bookingData.careManagerId}가 존재하지 않습니다`,
        });
      }

      // 서비스 존재 여부 확인 (선택 사항 - AI 아바타 플랫폼에서는 서비스가 필요하지 않을 수 있음)
      if (bookingData.serviceId) {
        const service = await storage.getService(bookingData.serviceId);
        if (!service) {
          console.warn(
            `서비스 ID ${bookingData.serviceId}가 존재하지 않지만, 예약을 계속 진행합니다.`,
          );
          // 서비스가 없어도 예약을 계속 진행 (AI 크리에이터 의뢰는 서비스 없이 가능)
        }
      }

      const booking = await storage.createBooking(bookingData);
      res.json(booking);
    } catch (error) {
      console.error("예약 생성 오류:", error);
      if (error instanceof Error) {
        res
          .status(400)
          .json({ error: `예약 생성에 실패했습니다: ${error.message}` });
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

      // 각 예약에 대한 케어매니저 정보와 서비스 정보, 사용자 정보 추가
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          // 케어매니저 정보 가져오기
          let careManager = await storage.getCareManager(booking.careManagerId);
          if (!careManager) {
            careManager = {
              id: booking.careManagerId,
              name: `크리에이터#${booking.careManagerId}`,
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
              averageDuration: null,
            };
          }

          // 사용자 정보 가져오기
          let user = null;
          if (booking.userId) {
            user = await storage.getUserByFirebaseId(booking.userId);
          }

          // 정보 합치기
          return {
            ...booking,
            date: booking.bookingDate || booking.createdAt || new Date(), // bookingDate를 date로 매핑
            userName:
              user?.username ||
              user?.displayName ||
              user?.email ||
              booking.userId, // username 우선
            userEmail: user?.email || null,
            userPhone: user?.phone || null,
            careManager: {
              id: careManagerSafe.id,
              name: careManagerSafe.name,
              imageUrl: careManagerSafe.imageUrl,
            },
            service: {
              name: service.name,
            },
          };
        }),
      );

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
      const bookings = await storage.getBookingsByCareManagerAndDate(
        managerId,
        date,
      );
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

  // 사용자 정보 업데이트 API
  app.put("/api/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const payload = req.body;

      console.log("사용자 업데이트 요청:", { userId, payload });

      const updatedUser = await storage.updateUser(userId, payload);

      if (!updatedUser) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("사용자 업데이트 오류:", error);
      res.status(500).json({ error: "사용자 정보 업데이트에 실패했습니다" });
    }
  });

  // 데이터베이스 마이그레이션 실행 (관리자 전용)
  app.post("/api/admin/run-migration", async (req, res) => {
    try {
      const { sql: sqlStatement } = req.body;

      if (!sqlStatement) {
        return res.status(400).json({ error: "SQL 문이 필요합니다" });
      }

      console.log("마이그레이션 실행:", sqlStatement);

      // Neon 데이터베이스에 직접 SQL 실행
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);

      await sql(sqlStatement);

      res.json({
        success: true,
        message: "마이그레이션이 성공적으로 실행되었습니다",
      });
    } catch (error: any) {
      console.error("마이그레이션 실행 오류:", error);
      res
        .status(500)
        .json({ error: error.message || "마이그레이션 실행에 실패했습니다" });
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
      const totalRevenue = bookings
        .filter((b) => (b as any).status === "completed")
        .reduce((sum, b) => sum + (b as any).totalAmount, 0);
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
      if (!updated)
        return res.status(404).json({ error: "분쟁을 찾을 수 없습니다" });
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
      if (!title || !content)
        return res.status(400).json({ error: "title, content required" });
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
      res
        .status(500)
        .json({ error: "상품 카테고리 목록을 불러오는데 실패했습니다" });
    }
  });

  // 상품 카테고리 상세 조회
  app.get("/api/products/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ error: "유효하지 않은 카테고리 ID입니다" });
      }

      const category = await storage.getProductCategory(id);

      if (!category) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }

      res.json(category);
    } catch (error) {
      console.error("상품 카테고리 상세 조회 오류:", error);
      res
        .status(500)
        .json({ error: "카테고리 정보를 불러오는데 실패했습니다" });
    }
  });

  // 상품 목록 조회
  app.get("/api/products", async (req, res) => {
    try {
      const {
        seller_id,
        category_id,
        category,
        search,
        limit = 50,
        offset = 0,
      } = req.query;

      const params: any = {};
      if (seller_id) params.sellerId = String(seller_id);
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

      // 클라이언트 호환성을 위해 모든 상품에 status 필드 추가 및 가격 숫자 변환
      const productsWithStatus = products.map((product) => ({
        ...product,
        status: product.isActive ? "active" : "hidden",
        price: product.price ? Math.floor(Number(product.price)) : 0,
        discountPrice: product.discountPrice
          ? Math.floor(Number(product.discountPrice))
          : null,
      }));

      res.json(productsWithStatus);
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

      // 클라이언트 호환성을 위해 status 필드 추가 및 가격 숫자 변환
      const productWithStatus = {
        ...product,
        status: product.isActive ? "active" : "hidden",
        price: product.price ? Math.floor(Number(product.price)) : 0,
        discountPrice: product.discountPrice
          ? Math.floor(Number(product.discountPrice))
          : null,
      };

      res.json(productWithStatus);
    } catch (error) {
      console.error("상품 상세 조회 오류:", error);
      res.status(500).json({ error: "상품 정보를 불러오는데 실패했습니다" });
    }
  });

  // 상품 등록
  app.post("/api/products", async (req, res) => {
    try {
      const productData = req.body;

      console.log("📦 상품 등록 요청 받음:", {
        title: productData.title,
        price: productData.price,
        category_id: productData.category_id,
        images: productData.images,
      });

      // 필수 필드 검증
      if (!productData.title || !productData.price) {
        return res
          .status(400)
          .json({ error: "상품명과 가격은 필수 항목입니다" });
      }

      // 데이터베이스 스키마에 맞게 필드명 변환
      const dbProductData: any = {
        name: productData.title, // DB의 name 필드 (필수)
        title: productData.title, // DB의 title 필드 (선택)
        description: productData.description,
        price: Number(productData.price),
        discountPrice: productData.discount_price
          ? Number(productData.discount_price)
          : null,
        stock: Number(productData.stock) || 0,
        images: productData.images,
        digitalFiles: productData.digital_files || [], // 디지털 파일 URL 배열
        isDigital: productData.is_digital || false, // 디지털 상품 여부
        // status를 isActive로 변환
        isActive: !productData.status || productData.status === "active",
      };

      // seller_id를 sellerId로 변환 (varchar 타입)
      if (productData.seller_id) {
        dbProductData.sellerId = String(productData.seller_id);
      }

      // category_id를 categoryId로 변환
      if (productData.category_id) {
        dbProductData.categoryId = parseInt(productData.category_id);
      }

      console.log("📦 DB에 저장할 데이터:", dbProductData);

      const product = await storage.createProduct(dbProductData);

      console.log("📦 상품 등록 성공:", {
        id: product.id,
        name: product.name,
        title: product.title,
      });

      // 클라이언트 호환성을 위해 status 필드 추가 및 가격 숫자 변환
      const productWithStatus = {
        ...product,
        status: product.isActive ? "active" : "hidden",
        price: product.price ? Math.floor(Number(product.price)) : 0,
        discountPrice: product.discountPrice
          ? Math.floor(Number(product.discountPrice))
          : null,
      };

      res.status(201).json(productWithStatus);
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
      if (productData.title) {
        dbProductData.name = productData.title; // DB의 name 필드도 함께 업데이트
        dbProductData.title = productData.title;
      }
      if (productData.description !== undefined)
        dbProductData.description = productData.description;
      if (productData.price) dbProductData.price = Number(productData.price);
      if (productData.discount_price !== undefined) {
        dbProductData.discountPrice = productData.discount_price
          ? Number(productData.discount_price)
          : null;
      }
      if (productData.stock !== undefined)
        dbProductData.stock = Number(productData.stock) || 0;
      if (productData.images !== undefined)
        dbProductData.images = productData.images;
      if (productData.digital_files !== undefined)
        dbProductData.digitalFiles = productData.digital_files; // 디지털 파일
      if (productData.is_digital !== undefined)
        dbProductData.isDigital = productData.is_digital; // 디지털 상품 여부
      // status를 isActive로 변환
      if (productData.status !== undefined) {
        dbProductData.isActive = productData.status === "active";
      }

      // seller_id를 sellerId로 변환 (varchar 타입)
      if (productData.seller_id) {
        dbProductData.sellerId = String(productData.seller_id);
      }

      // category_id를 categoryId로 변환 (0도 유효한 값으로 처리)
      if (
        productData.category_id !== undefined &&
        productData.category_id !== null &&
        productData.category_id !== ""
      ) {
        dbProductData.categoryId = parseInt(productData.category_id);
      }

      const updated = await storage.updateProduct(id, dbProductData);

      if (!updated) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다" });
      }

      // 클라이언트 호환성을 위해 status 필드 추가 및 가격 숫자 변환
      const productWithStatus = {
        ...updated,
        status: updated.isActive ? "active" : "hidden",
        price: updated.price ? Math.floor(Number(updated.price)) : 0,
        discountPrice: updated.discountPrice
          ? Math.floor(Number(updated.discountPrice))
          : null,
      };

      res.json(productWithStatus);
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
        return res
          .status(400)
          .json({ error: "유효하지 않은 카테고리 ID입니다" });
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
        return res
          .status(400)
          .json({ error: "유효하지 않은 카테고리 ID입니다" });
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

  // 찜한 크리에이터API
  app.get("/api/favorites/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const favorites = await storage.getFavorites(userId);
      const enriched = await Promise.all(
        favorites.map(async (f: any) => {
          const manager = await storage.getCareManager(Number(f.careManagerId));
          return { ...f, manager };
        }),
      );
      res.json(enriched);
    } catch (error) {
      console.error("찜한 크리에이터조회 오류:", error);
      res
        .status(500)
        .json({ error: "찜한 크리에이터목록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/favorites", async (req, res) => {
    try {
      const favoriteData = req.body;

      if (!favoriteData.userId || !favoriteData.careManagerId) {
        return res
          .status(400)
          .json({ error: "사용자 ID와 크리에이터ID는 필수 항목입니다" });
      }

      const favorite = await storage.addFavorite(favoriteData);
      res.status(201).json(favorite);
    } catch (error) {
      console.error("찜하기 추가 오류:", error);
      res.status(400).json({ error: "찜하기 추가에 실패했습니다" });
    }
  });

  app.delete("/api/favorites/:id", async (req, res) => {
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
  app.get("/api/user-settings/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { type } = req.query;

      if (type === "notification") {
        const settings = await storage.getUserNotificationSettings(userId);
        res.json(settings || {});
      } else if (type === "privacy") {
        const settings = await storage.getUserPrivacySettings(userId);
        res.json(settings || {});
      } else {
        // 둘 다 반환
        const [notificationSettings, privacySettings] = await Promise.all([
          storage.getUserNotificationSettings(userId),
          storage.getUserPrivacySettings(userId),
        ]);

        res.json({
          notification: notificationSettings || {},
          privacy: privacySettings || {},
        });
      }
    } catch (error) {
      console.error("사용자 설정 조회 오류:", error);
      res.status(500).json({ error: "사용자 설정을 불러오는데 실패했습니다" });
    }
  });

  app.put("/api/user-settings/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { type } = req.query;
      const settingsData = req.body;

      if (type === "notification") {
        const settings = await storage.updateUserNotificationSettings(
          userId,
          settingsData,
        );
        res.json(settings);
      } else if (type === "privacy") {
        const settings = await storage.updateUserPrivacySettings(
          userId,
          settingsData,
        );
        res.json(settings);
      } else {
        return res.status(400).json({
          error: "설정 타입(type)을 지정해주세요: notification 또는 privacy",
        });
      }
    } catch (error) {
      console.error("사용자 설정 업데이트 오류:", error);
      res.status(400).json({ error: "사용자 설정 업데이트에 실패했습니다" });
    }
  });

  // 문의 관리 API
  app.get("/api/inquiries", async (req, res) => {
    try {
      const inquiries = await storage.getAllInquiries();
      res.json(inquiries);
    } catch (error) {
      console.error("문의사항 목록 조회 오류:", error);
      res
        .status(500)
        .json({ error: "문의사항 목록을 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/inquiries/user/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const inquiries = await storage.getUserInquiries(userId);
      res.json(inquiries);
    } catch (error) {
      console.error("사용자 문의사항 조회 오류:", error);
      res.status(500).json({ error: "문의사항을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/inquiries", async (req, res) => {
    try {
      const inquiryData = req.body;

      if (
        !inquiryData.userId ||
        !inquiryData.subject ||
        !inquiryData.message ||
        !inquiryData.category
      ) {
        return res
          .status(400)
          .json({ error: "사용자 ID, 제목, 내용, 카테고리는 필수 항목입니다" });
      }

      const inquiry = await storage.createInquiry(inquiryData);
      res.status(201).json(inquiry);
    } catch (error) {
      console.error("문의사항 생성 오류:", error);
      res.status(400).json({ error: "문의사항 등록에 실패했습니다" });
    }
  });

  app.put("/api/inquiries/:id/answer", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { answer, answeredBy } = req.body;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ error: "유효하지 않은 문의사항 ID입니다" });
      }

      if (!answer || !answeredBy) {
        return res
          .status(400)
          .json({ error: "답변 내용과 답변자는 필수 항목입니다" });
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

  app.put("/api/inquiries/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ error: "유효하지 않은 문의사항 ID입니다" });
      }

      if (!status) {
        return res.status(400).json({ error: "상태는 필수 항목입니다" });
      }

      // 유효한 상태 값인지 확인
      if (!["pending", "in_progress", "answered", "closed"].includes(status)) {
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
  // 고객 주문 조회 API
  app.get("/api/orders/customer/:customerId", async (req, res) => {
    try {
      const { customerId } = req.params;
      console.log("고객 주문 조회 API 호출:", customerId);

      if (!customerId) {
        return res.status(400).json({ error: "고객 ID가 필요합니다." });
      }

      const orders = await storage.getOrdersByCustomer(customerId);
      console.log("조회된 주문:", orders.length, "개");
      res.json(orders);
    } catch (error) {
      console.error("고객 주문 조회 오류:", error);
      res.status(500).json({ error: "주문 목록을 불러오는데 실패했습니다" });
    }
  });

  // 판매자 주문 조회 API
  app.get("/api/orders/seller/:sellerId", async (req, res) => {
    try {
      const { sellerId } = req.params;
      console.log("판매자 주문 조회 API 호출:", sellerId);

      if (!sellerId) {
        return res.status(400).json({ error: "판매자 ID가 필요합니다." });
      }

      const orders = await storage.getOrdersBySeller(sellerId);
      console.log("조회된 주문:", orders.length, "개");
      res.json(orders);
    } catch (error) {
      console.error("판매자 주문 조회 오류:", error);
      res.status(500).json({ error: "주문 목록을 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/orders/admin", async (req, res) => {
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
  app.put("/api/orders/:orderId/status", async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      if (!orderId || !status) {
        return res
          .status(400)
          .json({ error: "주문 ID와 상태는 필수 항목입니다." });
      }

      const updated = await storage.updateOrderStatus(String(orderId), status);

      if (!updated) {
        return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
      }

      // 입금대기 → 결제완료로 변경 시 디지털 상품 다운로드 링크 자동 제공
      if (status === "pending") {
        try {
          // 주문 정보 조회
          const numericOrderId = parseInt(
            String(orderId).replace(/^ORD-0*/, ""),
          );
          const order = await storage.getOrderById(numericOrderId);

          if (order && order.orderItems && order.orderItems.length > 0) {
            // 주문한 상품들의 정보 조회
            const productIds = order.orderItems
              .map((item: any) => item.productId)
              .filter(Boolean);
            if (productIds.length > 0) {
              const products = await Promise.all(
                productIds.map((pid: number) => storage.getProduct(pid)),
              );

              // 디지털 상품이 있는지 확인
              const digitalProduct = products.find(
                (p: any) =>
                  p &&
                  p.isDigital &&
                  p.digitalFiles &&
                  p.digitalFiles.length > 0,
              );

              if (
                digitalProduct &&
                digitalProduct.digitalFiles &&
                digitalProduct.digitalFiles.length > 0
              ) {
                // 첫 번째 디지털 파일을 다운로드 링크로 제공
                const downloadUrl = digitalProduct.digitalFiles[0];

                console.log(
                  "입금 확인됨, 디지털 상품 다운로드 링크 제공:",
                  downloadUrl,
                );

                // 자동으로 배송 정보 업데이트 (다운로드 링크)
                await storage.updateOrderShipping(
                  orderId,
                  downloadUrl,
                  "직접 다운로드",
                );
              }
            }
          }
        } catch (digitalProductError) {
          console.error(
            "디지털 상품 처리 오류 (상태 변경은 완료됨):",
            digitalProductError,
          );
        }
      }

      res.json({ success: true, order: updated });

      // 알림 생성
      if (status === "processing") {
        await storage.createAdminNotification({
          type: "order_processing",
          message: `주문 #${orderId}이(가) 처리 중입니다.`,
          order_id: String(orderId),
        });
      } else if (status === "shipped") {
        await storage.createAdminNotification({
          type: "order_shipped",
          message: `주문 #${orderId}이(가) 발송되었습니다.`,
          order_id: String(orderId),
        });
      } else if (status === "delivered") {
        await storage.createAdminNotification({
          type: "order_delivered",
          message: `주문 #${orderId}이(가) 배송 완료되었습니다.`,
          order_id: String(orderId),
        });
      } else if (status === "canceled") {
        await storage.createAdminNotification({
          type: "order_canceled",
          message: `주문 #${orderId}이(가) 취소되었습니다.`,
          order_id: String(orderId),
        });
      }
    } catch (error) {
      console.error("주문 상태 업데이트 오류:", error);
      res
        .status(500)
        .json({ error: "주문 상태 업데이트 중 오류가 발생했습니다." });
    }
  });

  // 배송 정보 업데이트
  app.put("/api/orders/:orderId/shipping", async (req, res) => {
    try {
      const { orderId } = req.params;
      const { trackingNumber, shippingCompany } = req.body;

      if (!orderId || !trackingNumber || !shippingCompany) {
        return res
          .status(400)
          .json({ error: "주문 ID, 운송장 번호, 배송사는 필수 항목입니다." });
      }

      const updated = await storage.updateOrderShipping(
        String(orderId),
        trackingNumber,
        shippingCompany,
      );

      if (!updated) {
        return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
      }

      res.json({ success: true, order: updated });

      // 배송 시작 알림 생성
      await storage.createAdminNotification({
        type: "shipping_started",
        message: `주문 #${orderId}의 배송이 시작되었습니다. (${shippingCompany}, ${trackingNumber})`,
        order_id: String(orderId),
      });
    } catch (error) {
      console.error("배송 정보 업데이트 오류:", error);
      res
        .status(500)
        .json({ error: "배송 정보 업데이트 중 오류가 발생했습니다." });
    }
  });

  // 주문 생성 API 추가
  app.post("/api/orders", async (req, res) => {
    try {
      console.log("주문 생성 요청:", req.body);
      const {
        items,
        shipping_address_id,
        payment_method,
        total_amount,
        customer_id,
        seller_id,
      } = req.body;

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

      // 주문 생성 데이터
      const orderData = {
        customer_id: customer_id || req.body.user_id,
        seller_id: seller_id,
        items,
        shipping_address_id,
        payment_method,
        total_amount: total_amount || 0,
        customer_name: req.body.customer_name || "고객",
        customer_phone: req.body.customer_phone || "",
        shipping_address: req.body.shipping_address || {},
        notes: req.body.notes || "",
        order_status:
          payment_method === "bank" || payment_method === "bank_transfer"
            ? "awaiting_deposit"
            : "pending",
        payment_status:
          payment_method === "bank" || payment_method === "bank_transfer"
            ? "awaiting_deposit"
            : payment_method === "card"
              ? "paid"
              : "pending",
      };

      console.log("주문 생성 데이터 (변환 전):", orderData);

      // 주문 생성
      const order = await storage.createOrder(orderData);

      console.log("주문 생성 완료:", order);

      // 디지털 상품인 경우 자동으로 다운로드 링크 제공 (카드 결제만)
      // 무통장입금은 입금 확인 후 상태 변경 시 제공
      if (payment_method === "card") {
        try {
          // 주문한 상품들의 정보 조회
          const productIds = items
            .map((item: any) => item.product_id)
            .filter(Boolean);
          if (productIds.length > 0) {
            const products = await Promise.all(
              productIds.map((pid: number) => storage.getProduct(pid)),
            );

            // 디지털 상품이 있는지 확인
            const digitalProduct = products.find(
              (p: any) =>
                p && p.isDigital && p.digitalFiles && p.digitalFiles.length > 0,
            );

            if (
              digitalProduct &&
              digitalProduct.digitalFiles &&
              digitalProduct.digitalFiles.length > 0
            ) {
              // 첫 번째 디지털 파일을 다운로드 링크로 제공
              const downloadUrl = digitalProduct.digitalFiles[0];

              console.log(
                "디지털 상품 감지, 자동 다운로드 링크 제공:",
                downloadUrl,
              );

              // 자동으로 배송 정보 업데이트 (다운로드 링크)
              await storage.updateOrderShipping(
                order.id,
                downloadUrl,
                "직접 다운로드",
              );
            }
          }
        } catch (digitalProductError) {
          console.error(
            "디지털 상품 처리 오류 (주문은 생성됨):",
            digitalProductError,
          );
        }
      }

      res.status(201).json(order);
    } catch (error) {
      console.error("주문 생성 오류:", error);
      res
        .status(500)
        .json({ error: "주문 생성에 실패했습니다.", details: error.message });
    }
  });

  // ==================== 알림 관리 API ====================

  // 관리자 알림 목록 조회
  app.get("/api/notifications/admin", async (req, res) => {
    try {
      const notifications = await storage.getAdminNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("알림 목록 조회 오류:", error);
      res.status(500).json({ error: "알림 목록을 불러오는데 실패했습니다" });
    }
  });

  // 알림 읽음 처리
  app.put("/api/notifications/:id/read", async (req, res) => {
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
  app.get("/api/orders/seller/:sellerId", async (req, res) => {
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
            { product: { title: "테크노" }, quantity: 2, price: 15000 },
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
          seller_id: sellerId,
        },
        {
          id: "ORD-002",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          customer_name: "박철수",
          customer_phone: "010-9876-5432",
          orderItems: [
            { product: { title: "사쿠라" }, quantity: 1, price: 25000 },
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
          seller_id: sellerId,
        },
      ];

      res.json(orders);
    } catch (error) {
      console.error("판매자 주문 목록 조회 오류:", error);
      res.status(500).json({ error: "주문 목록을 불러오는데 실패했습니다" });
    }
  });

  // 판매자 알림 목록 조회
  app.get("/api/notifications/seller/:sellerId", async (req, res) => {
    try {
      const { sellerId } = req.params;

      // 실제 구현에서는 인증 확인 필요
      // const user = await verifyAuthToken(req);
      // if (user.uid !== sellerId && user.userType !== 'admin') return res.status(403).json({ error: "권한이 없습니다" });

      // 데이터베이스에서 판매자 알림 조회
      const notifications = await storage.getSellerNotifications(sellerId);

      res.json(notifications);
    } catch (error) {
      console.error("판매자 알림 목록 조회 오류:", error);
      res.status(500).json({ error: "알림 목록을 불러오는데 실패했습니다" });
    }
  });

  // 판매자 알림 읽음 처리
  app.put(
    "/api/notifications/seller/:notificationId/read",
    async (req, res) => {
      try {
        const { notificationId } = req.params;

        const updated = await storage.markSellerNotificationAsRead(
          parseInt(notificationId),
        );

        if (!updated) {
          return res.status(404).json({ error: "알림을 찾을 수 없습니다" });
        }

        res.json(updated);
      } catch (error) {
        console.error("알림 읽음 처리 오류:", error);
        res.status(500).json({ error: "알림 처리에 실패했습니다" });
      }
    },
  );

  // ==================== 상품 리뷰 및 문의 API ====================

  // 상품 리뷰 목록 조회
  app.get("/api/products/:productId/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "유효하지 않은 상품 ID입니다." });
      }

      const reviews = await storage.getProductReviews(productId);

      // 리뷰와 함께 작성자 정보 가져오기
      const reviewsWithUser = await Promise.all(
        reviews.map(async (review) => {
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
        }),
      );

      res.json(reviewsWithUser);
    } catch (error) {
      console.error("상품 리뷰 조회 오류:", error);
      res.status(500).json({ error: "상품 리뷰를 불러오는데 실패했습니다." });
    }
  });

  // 사용자 상품 구매 여부 확인 (리뷰 작성 자격 확인)
  app.get(
    "/api/users/:userId/purchases/verify/:productId",
    async (req, res) => {
      try {
        const userId = parseInt(req.params.userId);
        const productId = parseInt(req.params.productId);

        if (isNaN(userId) || isNaN(productId)) {
          return res
            .status(400)
            .json({ error: "유효하지 않은 사용자 ID 또는 상품 ID입니다." });
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
    },
  );

  // 사용자 구매 내역 조회 (리뷰 작성 가능한 상품 확인)
  app.get("/api/users/:userId/purchases", async (req, res) => {
    try {
      const userId = req.params.userId; // 문자열 형태로 받음

      if (!userId) {
        return res
          .status(400)
          .json({ error: "유효하지 않은 사용자 ID입니다." });
      }

      // 실제 구현에서는 사용자 인증도 필요
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "권한이 없습니다." });

      // 개발용 임시 코드 (항상 모든 상품을 구매한 것으로 처리)
      // 실제 구현에서는 주석 해제하여 실제 구매 내역을 조회
      // const orderItems = await storage.getUserOrderItems(userId);

      const products = await storage.getAllProducts();
      const purchases = products.map((product) => ({
        productId: product.id,
        product_id: product.id, // 호환성을 위해 두 형태 모두 제공
        title: product.title,
        purchaseDate: new Date().toISOString(),
        orderId: "temp-order-" + Math.floor(Math.random() * 1000),
      }));

      res.json(purchases);
    } catch (error) {
      console.error("구매 내역 조회 오류:", error);
      res.status(500).json({ error: "구매 내역을 불러오는데 실패했습니다." });
    }
  });

  // 리뷰 작성 API
  app.post("/api/products/:productId/reviews", async (req, res) => {
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
      const hasPurchased = await storage.checkUserPurchase(
        parseInt(userId),
        productId,
      );

      const newReview = await storage.createProductReview({
        userId: parseInt(userId),
        productId,
        rating: parseInt(rating),
        comment,
        isVerifiedPurchase: true, // 항상 구매 확인으로 표시 (실제에서는 hasPurchased 사용)
        status: "active",
      });

      // 상품의 평점 업데이트
      const product = await storage.getProduct(productId);
      if (product) {
        const reviews = await storage.getProductReviews(productId);
        const averageRating =
          reviews.reduce((acc, review) => acc + review.rating, 0) /
          reviews.length;

        await storage.updateProduct(productId, {
          rating: String(averageRating),
          reviewCount: reviews.length,
        });
      }

      const user = await storage.getUser(userId);

      res.status(201).json({
        ...newReview,
        username: user?.name || "알 수 없음",
        display_name: user?.name || "알 수 없음",
      });
    } catch (error) {
      console.error("리뷰 작성 오류:", error);
      res.status(500).json({ error: "리뷰 작성에 실패했습니다." });
    }
  });

  // 상품 문의 목록 조회
  app.get("/api/products/:productId/comments", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "유효하지 않은 상품 ID입니다." });
      }

      const comments = await storage.getProductComments(productId);

      // 문의사항 그룹화 (부모 문의와 답변들)
      const parentComments = comments.filter((comment) => !comment.parentId);
      const groupedComments = parentComments.map((parent) => {
        const replies = comments.filter(
          (comment) => comment.parentId === parent.id,
        );
        return {
          ...parent,
          replies,
        };
      });

      // 문의와 함께 작성자 정보 가져오기
      const commentsWithUser = await Promise.all(
        groupedComments.map(async (comment) => {
          try {
            const user = await storage.getUser(comment.userId);

            // 답글에도 사용자 정보 추가
            const repliesWithUser = await Promise.all(
              (comment.replies || []).map(async (reply) => {
                try {
                  const replyUser = await storage.getUser(reply.userId);
                  return {
                    ...reply,
                    username: replyUser?.name || "알 수 없음",
                    display_name:
                      replyUser?.name ||
                      (reply.isAdmin ? "관리자" : "알 수 없음"),
                  };
                } catch (error) {
                  return {
                    ...reply,
                    username: "알 수 없음",
                    display_name: reply.isAdmin ? "관리자" : "알 수 없음",
                  };
                }
              }),
            );

            return {
              ...comment,
              username: user?.name || "알 수 없음",
              display_name: user?.name || "알 수 없음",
              replies: repliesWithUser,
            };
          } catch (error) {
            return {
              ...comment,
              username: "알 수 없음",
              display_name: "알 수 없음",
              replies: comment.replies || [],
            };
          }
        }),
      );

      res.json(commentsWithUser);
    } catch (error) {
      console.error("상품 문의 조회 오류:", error);
      res.status(500).json({ error: "상품 문의를 불러오는데 실패했습니다." });
    }
  });

  // 문의 작성 API
  app.post("/api/products/:productId/comments", async (req, res) => {
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
        status: "active",
      });

      const user = await storage.getUser(userId);

      res.status(201).json({
        ...newComment,
        username: user?.name || "알 수 없음",
        display_name: user?.name || "알 수 없음",
        replies: [],
      });
    } catch (error) {
      console.error("문의 작성 오류:", error);
      res.status(500).json({ error: "문의 작성에 실패했습니다." });
    }
  });

  // 문의 답글 작성 API
  app.post(
    "/api/products/:productId/comments/:commentId/replies",
    async (req, res) => {
      try {
        const productId = parseInt(req.params.productId);
        const commentId = parseInt(req.params.commentId);
        const { userId, content } = req.body;

        if (isNaN(productId) || isNaN(commentId) || !userId || !content) {
          return res
            .status(400)
            .json({ error: "필수 입력값이 누락되었습니다." });
        }

        // 원본 문의 확인
        const parentComment = (
          await storage.getProductComments(productId)
        ).find((comment) => comment.id === commentId);

        if (!parentComment) {
          return res
            .status(404)
            .json({ error: "원본 문의를 찾을 수 없습니다." });
        }

        // 실제 구현에서는 사용자 인증과 관리자 여부 확인
        // const user = await verifyAuthToken(req);
        // if (user.id !== userId) return res.status(403).json({ error: "권한이 없습니다." });
        // const isAdmin = user.userType === 'admin';

        // 개발용 임시 코드 - 사용자 이메일에 'admin'이 포함되면 관리자로 간주
        const user = await storage.getUser(userId);
        const isAdmin = user?.email?.includes("admin") || false;

        const newReply = await storage.createProductComment({
          userId: parseInt(userId),
          productId,
          content,
          parentId: commentId,
          isPrivate: parentComment.isPrivate,
          isAdmin,
          status: "active",
        });

        // 원본 문의의 상태를 '답변 완료'로 변경
        if (isAdmin) {
          await storage.updateProductComment(commentId, { status: "answered" });
        }

        res.status(201).json({
          ...newReply,
          username: user?.name || "알 수 없음",
          display_name: isAdmin ? "관리자" : user?.name || "알 수 없음",
        });
      } catch (error) {
        console.error("답글 작성 오류:", error);
        res.status(500).json({ error: "답글 작성에 실패했습니다." });
      }
    },
  );

  // 크리에이터소개글 콘텐츠 API
  app.post("/api/caremanager/:id/intro-contents", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { introContents } = req.body;

      if (!introContents || !Array.isArray(introContents)) {
        return res
          .status(400)
          .json({ error: "올바른 소개글 콘텐츠 형식이 아닙니다." });
      }

      // 기존 크리에이터확인
      const careManager = await storage.getCareManager(id);
      if (!careManager) {
        return res
          .status(404)
          .json({ error: "케어 매니저를 찾을 수 없습니다." });
      }

      // 소개글 콘텐츠 저장
      await storage.updateCareManagerIntroContents(id, introContents);

      res.json({
        success: true,
        message: "소개글 콘텐츠가 성공적으로 저장되었습니다.",
      });
    } catch (error) {
      console.error("소개글 콘텐츠 저장 오류:", error);
      res.status(500).json({
        error: "소개글 콘텐츠 저장 중 오류가 발생했습니다.",
      });
    }
  });

  // 크리에이터소개글 콘텐츠 조회 API (uid 지원)
  app.get("/api/caremanager/:id/intro-contents", async (req, res) => {
    try {
      const idParam = req.params.id;
      let careManagerId: number | undefined;

      // uid인지 숫자 ID인지 확인
      if (isNaN(parseInt(idParam))) {
        // uid로 케어매니저 찾기
        const allManagers = await storage.getAllCareManagers();
        const manager = allManagers.find((m) => (m as any).uid === idParam);
        if (!manager) {
          return res
            .status(404)
            .json({ error: "케어 매니저를 찾을 수 없습니다." });
        }
        careManagerId = manager.id;
      } else {
        careManagerId = parseInt(idParam);
      }

      // 크리에이터확인
      const careManager = await storage.getCareManager(careManagerId);
      if (!careManager) {
        return res
          .status(404)
          .json({ error: "케어 매니저를 찾을 수 없습니다." });
      }

      // 소개글 콘텐츠 조회
      const introContents =
        await storage.getCareManagerIntroContents(careManagerId);

      res.json({
        success: true,
        introContents: introContents || [],
      });
    } catch (error) {
      console.error("소개글 콘텐츠 조회 오류:", error);
      res.status(500).json({
        error: "소개글 콘텐츠 조회 중 오류가 발생했습니다.",
      });
    }
  });

  // 서비스 패키지 저장 API
  app.post("/api/caremanager/:id/service-packages", async (req, res) => {
    try {
      const idParam = req.params.id;
      const { packages } = req.body;
      let careManagerId: number | undefined;

      if (!packages || !Array.isArray(packages)) {
        return res
          .status(400)
          .json({ error: "올바른 패키지 형식이 아닙니다." });
      }

      // uid인지 숫자 ID인지 확인
      if (isNaN(parseInt(idParam))) {
        const allManagers = await storage.getAllCareManagers();
        const manager = allManagers.find((m) => (m as any).uid === idParam);
        if (!manager) {
          return res
            .status(404)
            .json({ error: "케어 매니저를 찾을 수 없습니다." });
        }
        careManagerId = manager.id;
      } else {
        careManagerId = parseInt(idParam);
      }

      // 케어매니저 확인
      const careManager = await storage.getCareManager(careManagerId);
      if (!careManager) {
        return res
          .status(404)
          .json({ error: "케어 매니저를 찾을 수 없습니다." });
      }

      // 서비스 패키지 저장
      const success = await storage.updateCareManagerServicePackages(
        careManagerId,
        packages,
      );

      if (success) {
        res.json({
          success: true,
          message: "서비스 패키지가 저장되었습니다.",
        });
      } else {
        res.status(500).json({ error: "서비스 패키지 저장에 실패했습니다." });
      }
    } catch (error) {
      console.error("서비스 패키지 저장 오류:", error);
      res.status(500).json({
        error: "서비스 패키지 저장 중 오류가 발생했습니다.",
      });
    }
  });

  // 서비스 패키지 조회 API
  app.get("/api/caremanager/:id/service-packages", async (req, res) => {
    try {
      const idParam = req.params.id;
      let careManagerId: number | undefined;

      // uid인지 숫자 ID인지 확인
      if (isNaN(parseInt(idParam))) {
        const allManagers = await storage.getAllCareManagers();
        const manager = allManagers.find((m) => (m as any).uid === idParam);
        if (!manager) {
          return res
            .status(404)
            .json({ error: "케어 매니저를 찾을 수 없습니다." });
        }
        careManagerId = manager.id;
      } else {
        careManagerId = parseInt(idParam);
      }

      // 케어매니저 확인
      const careManager = await storage.getCareManager(careManagerId);
      if (!careManager) {
        return res
          .status(404)
          .json({ error: "케어 매니저를 찾을 수 없습니다." });
      }

      // 서비스 패키지 조회
      const packages =
        await storage.getCareManagerServicePackages(careManagerId);

      res.json({
        success: true,
        packages: packages || [],
      });
    } catch (error) {
      console.error("서비스 패키지 조회 오류:", error);
      res.status(500).json({
        error: "서비스 패키지 조회 중 오류가 발생했습니다.",
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
        certificationPaymentId: user.certificationPaymentId || null,
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
      await db
        .update(users)
        .set({
          isCertified: true,
          certificationDate: new Date(),
          certificationPaymentId: paymentId,
        })
        .where(eq(users.id, userId));

      res.json({
        success: true,
        message: "인증이 성공적으로 활성화되었습니다",
        isCertified: true,
        certificationDate: new Date(),
        certificationPaymentId: paymentId,
      });
    } catch (error) {
      console.error("인증 활성화 오류:", error);
      res.status(500).json({ error: "인증 활성화에 실패했습니다" });
    }
  });

  // ==================== 장바구니 API ====================
  app.get("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      console.log(`[SERVER] Firebase UID ${userId}의 장바구니 조회 요청`);

      // Firebase UID를 그대로 사용하여 장바구니 조회
      const items = await storage.getCartItemsByFirebaseId(userId);

      // 각 아이템에 상품 정보 합쳐서 반환
      const enriched = await Promise.all(
        items.map(async (item: any) => {
          const product = await storage.getProduct(item.productId);
          return { ...item, product };
        }),
      );

      return res.status(200).json({ cartItems: enriched });
    } catch (error) {
      console.error("장바구니 조회 오류:", error);
      return res
        .status(500)
        .json({ error: "장바구니 조회 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;
      const { productId, quantity, selected_options } = req.body as {
        productId?: number | string;
        quantity?: number;
        selected_options?: any;
      };

      if (!userId || !productId) {
        return res.status(400).json({ error: "필수 입력값이 누락되었습니다." });
      }

      const pid = parseInt(productId as any);
      const qty = Math.max(1, Number(quantity || 1));

      console.log(
        `[SERVER] Firebase UID ${userId}의 장바구니에 상품 ${pid} 추가 요청`,
      );

      // 동일 옵션 상품 존재 시 수량만 증가
      const existing = await storage.findCartItemByFirebaseId(
        userId,
        pid,
        selected_options ?? null,
      );
      if (existing) {
        const updated = await storage.updateCartItem(existing.id as any, {
          quantity: (existing.quantity || 1) + qty,
        });
        const product = await storage.getProduct(pid);
        return res.status(200).json({ ...updated, product });
      }

      // Firebase UID를 사용하여 새 아이템 추가
      const inserted = await storage.addCartItemByFirebaseId(
        userId,
        pid,
        qty,
        selected_options ?? null,
      );
      const product = await storage.getProduct(pid);
      res.status(201).json({ ...inserted, product });
    } catch (error) {
      console.error("장바구니 추가 오류:", error);
      res.status(500).json({ error: "장바구니 추가에 실패했습니다." });
    }
  });

  app.put("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const itemId = parseInt(req.params.itemId);
      const { quantity } = req.body as { quantity?: number };
      if (isNaN(userId) || isNaN(itemId))
        return res.status(400).json({ error: "유효하지 않은 요청입니다." });
      if (quantity == null || Number(quantity) < 1)
        return res.status(400).json({ error: "수량은 1 이상이어야 합니다." });

      console.log(
        `[SERVER] 사용자 ${userId}의 장바구니 상품 ${itemId} 수정 요청`,
      );

      const updated = await storage.updateCartItem(itemId, {
        quantity: Number(quantity),
      });
      if (!updated)
        return res
          .status(404)
          .json({ error: "장바구니 항목을 찾을 수 없습니다." });
      res.json(updated);
    } catch (error) {
      console.error("장바구니 업데이트 오류:", error);
      res.status(500).json({ error: "장바구니 업데이트에 실패했습니다." });
    }
  });

  app.delete("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(userId) || isNaN(itemId))
        return res.status(400).json({ error: "유효하지 않은 요청입니다." });

      console.log(
        `[SERVER] 사용자 ${userId}의 장바구니에서 상품 ${itemId} 삭제 요청`,
      );

      const ok = await storage.removeCartItem(itemId);
      if (!ok)
        return res
          .status(404)
          .json({ error: "장바구니 항목을 찾을 수 없습니다." });
      res.json({ success: true });
    } catch (error) {
      console.error("장바구니 삭제 오류:", error);
      res.status(500).json({ error: "장바구니 삭제에 실패했습니다." });
    }
  });

  app.delete("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      console.log(`[SERVER] Firebase UID ${userId}의 장바구니 비우기 요청`);

      // Firebase UID를 사용하여 장바구니 비우기
      const success = await storage.clearCartByFirebaseId(userId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "장바구니 비우기에 실패했습니다." });
      }
    } catch (error) {
      console.error("장바구니 비우기 오류:", error);
      res.status(500).json({ error: "장바구니 비우기에 실패했습니다." });
    }
  });

  // 장바구니 상품 수정
  app.put("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const { userId, itemId } = req.params;
      const { quantity, selected_options } = req.body;

      if (!userId || !itemId) {
        return res
          .status(400)
          .json({ error: "사용자 ID와 상품 ID가 필요합니다." });
      }

      console.log(
        `[SERVER] 사용자 ${userId}의 장바구니 상품 ${itemId} 수정 요청`,
      );

      // 메모리 기반 장바구니 데이터 (실제로는 DB에서 수정해야 함)
      const cartItem = {
        id: itemId,
        userId,
        quantity: quantity || 1,
        selected_options: selected_options || null,
        updatedAt: new Date(),
      };

      return res.status(200).json(cartItem);
    } catch (error) {
      console.error("장바구니 상품 수정 오류:", error);
      return res
        .status(500)
        .json({ error: "장바구니 상품을 수정하는 중 오류가 발생했습니다." });
    }
  });

  // 장바구니 상품 삭제
  app.delete("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const { userId, itemId } = req.params;

      if (!userId || !itemId) {
        return res
          .status(400)
          .json({ error: "사용자 ID와 상품 ID가 필요합니다." });
      }

      console.log(
        `[SERVER] 사용자 ${userId}의 장바구니에서 상품 ${itemId} 삭제 요청`,
      );

      // 메모리 기반 장바구니 데이터 (실제로는 DB에서 삭제해야 함)

      return res.status(200).json({
        success: true,
        message: "상품이 장바구니에서 삭제되었습니다.",
      });
    } catch (error) {
      console.error("장바구니 상품 삭제 오류:", error);
      return res.status(500).json({
        error: "장바구니에서 상품을 삭제하는 중 오류가 발생했습니다.",
      });
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

      return res
        .status(200)
        .json({ success: true, message: "장바구니가 비워졌습니다." });
    } catch (error) {
      console.error("장바구니 비우기 오류:", error);
      return res
        .status(500)
        .json({ error: "장바구니를 비우는 중 오류가 발생했습니다." });
    }
  });

  // 음성 인식 API 엔드포인트
  app.post("/api/speech/transcribe", multer().single('audio'), async (req, res) => {
    try {
      console.log("🎤 음성 인식 요청 받음");
      
      // OpenAI Whisper 서비스 가져오기
      const { getOpenAIWhisperService } = await import("./speech/openai-whisper.js");
      const whisperService = getOpenAIWhisperService();
      
      if (!whisperService) {
        console.error("❌ OpenAI Whisper 서비스가 초기화되지 않음");
        return res.status(500).json({ 
          error: "음성 인식 서비스가 사용할 수 없습니다. OpenAI API 키를 확인해주세요." 
        });
      }

      // FormData에서 오디오 파일 추출
      if (!req.file) {
        return res.status(400).json({ error: "오디오 파일이 필요합니다." });
      }

      const audioFile = req.file;
      const filename = audioFile.originalname || "audio.webm";
      
      console.log(`🎧 음성 인식 시작: ${filename} (${audioFile.size} bytes)`);

      // 파일 버퍼로 음성 인식 실행
      const transcription = await whisperService.transcribeBuffer(audioFile.buffer, filename);
      
      console.log(`✅ 음성 인식 완료: "${transcription}"`);
      
      res.json({ 
        success: true, 
        text: transcription,  // 클라이언트에서 기대하는 필드명
        transcription: transcription,
        filename: filename
      });
      
    } catch (error) {
      console.error("❌ 음성 인식 오류:", error);
      
      let errorMessage = "음성 인식 중 오류가 발생했습니다.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      res.status(500).json({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
