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

// Cloudinary瑜??ъ슜?섎?濡?硫붾え由??ㅽ넗由ъ? ?ъ슜
const memoryStorage = multer.memoryStorage();

// ?대?吏 ?낅줈?쒖슜 Multer (硫붾え由???Cloudinary)
const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB ?쒗븳
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("?대?吏 ?뚯씪留??낅줈??媛?ν빀?덈떎."));
    }
  },
});

// ?묓뭹 ?꾨즺 / 二쇰Ц ?뚯씪 ?꾩슜 Multer (?ㅼ뼇???뚯씪 ?뺤떇 ?덉슜)
const uploadCompletionFile = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB ?쒗븳
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
      cb(new Error(`吏?먰븯吏 ?딅뒗 ?뚯씪 ?뺤떇?낅땲?? ${file.mimetype}`));
    }
  },
});

export async function registerRoutes(app: Express): Promise<void> {
  // ==================== Health Check (Railway) ====================
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ?뺤쟻 ?뚯씪 ?쒕튃 (濡쒖뺄 public ?대뜑 - 湲곗〈 ?명솚??
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

  // 寃곗젣 ?쇱슦???깅줉
  registerPaymentRoutes(app);

  // 紐⑤뜽 ?먮뵒???쇱슦???깅줉
  app.use("/api/model-editor", modelEditorRouter);

  // ?쇰뱶 ?쇱슦???깅줉
  app.use("/api/feed", feedRouter);

  // ?ъ슜???뺣낫 議고쉶 API
  app.get("/api/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      console.log(`?뫀 ?ъ슜???뺣낫 議고쉶 ?붿껌: ${userId}`);

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
        console.log(`???ъ슜??李얠쓣 ???놁쓬: ${userId}`);
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎." });
      }

      console.log(
        `???ъ슜???뺣낫 議고쉶 ?깃났: ${user.displayName} (${user.email})`,
      );
      res.json(user);
    } catch (error) {
      console.error("?ъ슜???뺣낫 議고쉶 ?ㅽ뙣:", error);
      res.status(500).json({ error: "?ъ슜???뺣낫瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎." });
    }
  });

  // ==================== Cloudinary ?대?吏 ?낅줈??API ====================

  // ?꾨줈???대?吏 ?낅줈????Cloudinary
  app.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      console.log("?뼹截??꾨줈???대?吏 ?낅줈???붿껌 諛쏆쓬 (Cloudinary)");

      if (!req.file) {
        return res
          .status(400)
          .json({ error: "?대?吏媛 ?낅줈?쒕릺吏 ?딆븯?듬땲??" });
      }

      const result = await uploadToCloudinary(req.file.buffer, "profile");

      console.log("???꾨줈???대?吏 Cloudinary ?낅줈???깃났:", {
        originalName: req.file.originalname,
        url: result.url,
      });

      res.json({
        success: true,
        imageUrl: result.url,
      });
    } catch (error) {
      console.error("?슟 ?대?吏 ?낅줈???ㅻ쪟:", error);
      res.status(500).json({ error: "?대?吏 ?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 ?대?吏 ?낅줈????Cloudinary
  app.post(
    "/api/upload/product-image",
    upload.single("image"),
    async (req, res) => {
      try {
        console.log("?뼹截??곹뭹 ?대?吏 ?낅줈???붿껌 諛쏆쓬 (Cloudinary)");

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "?대?吏媛 ?낅줈?쒕릺吏 ?딆븯?듬땲??" });
        }

        const result = await uploadToCloudinary(req.file.buffer, "products");

        console.log("???곹뭹 ?대?吏 Cloudinary ?낅줈???깃났:", {
          originalName: req.file.originalname,
          url: result.url,
        });

        return res.json({
          success: true,
          imageUrl: result.url,
        });
      } catch (error) {
        console.error("?슟 ?곹뭹 ?대?吏 ?낅줈???ㅻ쪟:", error);
        return res.status(500).json({
          error: "?대?吏 ?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎",
        });
      }
    },
  );

  // 梨꾪똿 ?대?吏 ?낅줈????Cloudinary
  app.post(
    "/api/upload/chat-image",
    upload.single("image"),
    async (req, res) => {
      try {
        console.log("?뼹截?梨꾪똿 ?대?吏 ?낅줈???붿껌 諛쏆쓬 (Cloudinary)");

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "?대?吏媛 ?낅줈?쒕릺吏 ?딆븯?듬땲??" });
        }

        const roomId = req.query.roomId || "general";

        const result = await uploadToCloudinary(req.file.buffer, `chat/${roomId}`);

        console.log("??梨꾪똿 ?대?吏 Cloudinary ?낅줈???깃났:", {
          roomId,
          originalName: req.file.originalname,
          url: result.url,
        });

        return res.json({
          success: true,
          url: result.url,
        });
      } catch (error) {
        console.error("?슟 梨꾪똿 ?대?吏 ?낅줈???ㅻ쪟:", error);
        return res.status(500).json({
          error: "?대?吏 ?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎",
        });
      }
    },
  );

  // ?묓뭹 ?꾨즺 ?뚯씪 ?낅줈????Cloudinary
  app.post(
    "/api/upload/completion-file",
    uploadCompletionFile.single("file"),
    async (req, res) => {
      try {
        console.log("?벀 ?묓뭹 ?꾨즺 ?뚯씪 ?낅줈???붿껌 諛쏆쓬 (Cloudinary)");

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "?뚯씪???낅줈?쒕릺吏 ?딆븯?듬땲??" });
        }

        // ?뚯씪 ??낆뿉 ?곕씪 由ъ냼???좏삎 寃곗젙
        const resourceType = req.file.mimetype.startsWith("video/")
          ? "video" as const
          : req.file.mimetype.startsWith("image/")
            ? "image" as const
            : "raw" as const;

        const result = await uploadToCloudinary(req.file.buffer, "completion", {
          resourceType,
        });

        console.log("???묓뭹 ?꾨즺 ?뚯씪 Cloudinary ?낅줈???깃났:", {
          originalName: req.file.originalname,
          url: result.url,
        });

        return res.json({
          success: true,
          fileUrl: result.url,
        });
      } catch (error) {
        console.error("?슟 ?묓뭹 ?꾨즺 ?뚯씪 ?낅줈???ㅻ쪟:", error);
        return res.status(500).json({
          error: "?뚯씪 ?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎",
        });
      }
    },
  );

  // 二쇰Ц ?곹뭹 諛곗넚???붿????뚯씪 ?낅줈????Cloudinary
  app.post(
    "/api/upload/order-file",
    uploadCompletionFile.single("file"),
    async (req, res) => {
      try {
        console.log("?벀 二쇰Ц 諛곗넚 ?뚯씪 ?낅줈???붿껌 諛쏆쓬 (Cloudinary)");

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "?뚯씪???낅줈?쒕릺吏 ?딆븯?듬땲??" });
        }

        const resourceType = req.file.mimetype.startsWith("video/")
          ? "video" as const
          : req.file.mimetype.startsWith("image/")
            ? "image" as const
            : "raw" as const;

        const result = await uploadToCloudinary(req.file.buffer, "order-files", {
          resourceType,
        });

        console.log("??二쇰Ц 諛곗넚 ?뚯씪 Cloudinary ?낅줈???깃났:", {
          originalName: req.file.originalname,
          url: result.url,
        });

        return res.json({
          success: true,
          fileUrl: result.url,
          fileName: req.file.originalname,
        });
      } catch (error) {
        console.error("?슟 二쇰Ц 諛곗넚 ?뚯씪 ?낅줈???ㅻ쪟:", error);
        return res.status(500).json({
          error: "?뚯씪 ?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎",
        });
      }
    },
  );

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("?뱷 ?뚯썝媛???붿껌:", req.body);
      const userData = await insertUserSchema.parseAsync(req.body);
      console.log("???ㅽ궎留?寃利??듦낵:", userData);

      const existingUser = await storage.getUserByEmail(userData.email);

      if (existingUser) {
        console.log("???대? 議댁옱?섎뒗 ?대찓??", userData.email);
        return res.status(400).json({ error: "?대? 議댁옱?섎뒗 ?대찓?쇱엯?덈떎" });
      }

      // 鍮꾨?踰덊샇 ?뷀샇???곸슜
      const userWithHashedPassword = await createUserWithHash(userData);
      console.log(
        "?뵏 鍮꾨?踰덊샇 ?뷀샇???꾨즺, 湲몄씠:",
        userWithHashedPassword.password?.length,
      );

      const user = await storage.createUser(userWithHashedPassword);
      console.log("?럦 ?ъ슜???앹꽦 ?꾨즺:", {
        id: user.id,
        email: user.email,
        username: user.username,
      });

      // 誘쇨컧???뺣낫???쒖쇅?섍퀬 諛섑솚
      res.json({
        user: {
          id: user.id,
          uid: String(user.id), // Firebase ?명솚??          email: user.email,
          name: user.name,
          displayName: user.displayName || user.name, // displayName ?곗꽑, ?놁쑝硫?name
          photoURL: user.photoURL || null, // ?꾨줈???ъ쭊 異붽?
          userType: user.userType,
          grade: user.grade,
        },
      });
    } catch (error) {
      console.error("?뚯썝媛???ㅻ쪟:", error);
      res.status(400).json({ error: "?뚯썝媛?낆뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // Firebase ?ъ슜???깅줉/?낅뜲?댄듃 API
  app.post("/api/auth/register-firebase-user", async (req, res) => {
    try {
      console.log("?뵦 Firebase ?ъ슜??DB ????낅뜲?댄듃:", req.body);
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
          .json({ error: "?대찓?쇨낵 鍮꾨?踰덊샇???꾩닔?낅땲?? });
      }

      // Firebase UID濡?癒쇱? ?뺤씤
      if (uid) {
        const existingUserById = await db
          .select()
          .from(users)
          .where(eq(users.id, uid))
          .limit(1);

        if (existingUserById.length > 0) {
          // UID濡??ъ슜?먮? 李얠븯?쇰㈃ ?낅뜲?댄듃
          console.log("??Firebase UID濡??ъ슜???뺣낫 ?낅뜲?댄듃:", uid);
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

      // ?대찓?쇰줈 湲곗〈 ?ъ슜???뺤씤
      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        // 湲곗〈 ?ъ슜?먭? ?덉쑝硫?photoURL怨?displayName ?낅뜲?댄듃
        console.log("???대찓?쇰줈 ?ъ슜???뺣낫 ?낅뜲?댄듃:", email);
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

      // ???ъ슜???앹꽦 - Firebase UID瑜?id濡??ъ슜
      const userData = {
        id: uid || password, // Firebase UID瑜?id濡??ъ슜
        username: username || email.split("@")[0],
        displayName: displayName || username || email.split("@")[0],
        email,
        password, // Firebase UID瑜?鍮꾨?踰덊샇濡쒕룄 ?ъ슜
        userType: userType || "customer",
        photoURL: photoURL || null,
      };

      console.log("?넅 ??Firebase ?ъ슜???앹꽦:", {
        id: userData.id,
        email: userData.email,
      });
      const user = await storage.createUser(userData);
      console.log("?럦 Firebase ?ъ슜??DB ????꾨즺:", email);

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
      console.error("Firebase ?ъ슜??DB ????ㅻ쪟:", error);
      res.status(500).json({ error: "?ъ슜???뺣낫 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("?뵍 濡쒓렇???붿껌:", req.body);
      let { email, password } = req.body;
      email = typeof email === "string" ? email.trim().toLowerCase() : email;
      password = typeof password === "string" ? password.trim() : password;

      console.log(
        `?벁 泥섎━???대찓?? "${email}", 鍮꾨?踰덊샇 湲몄씠: ${password?.length}`,
      );

      if (!email || !password) {
        console.log("?대찓???먮뒗 鍮꾨?踰덊샇 ?꾨씫");
        return res
          .status(400)
          .json({ error: "?대찓?쇨낵 鍮꾨?踰덊샇???꾩닔 ??ぉ?낅땲?? });
      }

      const user = await storage.getUserByEmail(email);

      if (!user) {
        console.log(`???ъ슜???놁쓬: ${email}`);
        console.log(
          `?뱥 ??λ맂 紐⑤뱺 ?ъ슜???대찓??`,
          Array.from((storage as any).users?.values() || []).map(
            (u: any) => u.email,
          ),
        );
        return res
          .status(401)
          .json({ error: "?대찓???먮뒗 鍮꾨?踰덊샇媛 ?섎せ?섏뿀?듬땲?? });
      }

      console.log(
        `???ъ슜??李얠쓬: ${email}, ??λ맂 鍮꾨?踰덊샇 湲몄씠: ${user.password?.length}`,
      );

      // 鍮꾨?踰덊샇 寃利?      const bcryptFormat = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
      const storedLooksHashedInitial =
        typeof user.password === "string" && bcryptFormat.test(user.password);
      console.log(
        `[auth] 濡쒓렇??寃???쒖옉: email=${email}, storedFmt=${storedLooksHashedInitial ? "bcrypt" : "plain"} len=${(user.password || "").length}`,
      );
      let isPasswordValid = await verifyPassword(password, user.password);
      console.log(`[auth] bcrypt.compare 寃곌낵: ${isPasswordValid}`);

      // ?덇굅???대갚: DB???됰Ц????λ릺???덇굅?? ?ъ슜?먭? ?댁떆 臾몄옄???먯껜瑜??낅젰?섎뒗 寃쎌슦 泥섎━
      if (!isPasswordValid) {
        const storedLooksHashed =
          typeof user.password === "string" && bcryptFormat.test(user.password);
        if (password === user.password) {
          if (storedLooksHashed) {
            // ?ъ슜?먭? ??λ맂 ?댁떆? ?숈씪??臾몄옄?댁쓣 ?낅젰??寃쎌슦: ?듦낵留??쒗궎怨?DB??蹂寃쏀븯吏 ?딆쓬
            isPasswordValid = true;
            console.log(
              `[auth] ?댁떆 臾몄옄???낅젰?쇰줈 ?듦낵(蹂寃??놁쓬): user=${email}`,
            );
          } else {
            // ??λ맂 媛믪씠 ?됰Ц?닿퀬 ?낅젰???숈씪 ?됰Ц ??bcrypt濡??낃렇?덉씠?????            const upgraded = bcrypt.hashSync(password, 10);
            await storage.updatePassword(user.id, upgraded);
            isPasswordValid = true;
            console.log(
              `[auth] ?덇굅???됰Ц 鍮꾨?踰덊샇瑜?bcrypt濡??낃렇?덉씠?? user=${email}`,
            );
          }
        }
      }

      if (!isPasswordValid) {
        console.log(
          `??鍮꾨?踰덊샇 遺덉씪移? ${email}, ?낅젰??鍮꾨?踰덊샇: "${password}", ??λ맂 鍮꾨?踰덊샇: "${user.password}"`,
        );
        return res
          .status(401)
          .json({ error: "?대찓???먮뒗 鍮꾨?踰덊샇媛 ?섎せ?섏뿀?듬땲?? });
      }

      console.log(`濡쒓렇???깃났: ${email}`);

      // Firebase ?ъ슜???뺣낫? ?명솚?섎룄濡??묐떟 ?뺤떇 ?섏젙
      res.json({
        user: {
          id: user.id,
          uid: String(user.id), // Firebase uid ?명솚??          email: user.email,
          name: user.name,
          displayName: user.displayName || user.name, // displayName ?곗꽑, ?놁쑝硫?name
          photoURL: user.photoURL || null, // ?꾨줈???ъ쭊 異붽?
          userType: user.userType,
          grade: user.grade,
          isApproved: user.isApproved || user.userType !== "careManager",
        },
      });
    } catch (error) {
      console.error("濡쒓렇???ㅻ쪟:", error);
      res.status(400).json({ error: "濡쒓렇?몄뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // Firebase ?ъ슜??鍮꾨?踰덊샇 蹂寃?(Firebase UID ?ъ슜) - ?쒓굅?? ?듯빀 ?붾뱶?ъ씤???ъ슜

  // ?ъ슜??鍮꾨?踰덊샇 蹂寃?(UUID 諛??レ옄 ID 紐⑤몢 吏??
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      let { userId, currentPassword, newPassword } = req.body as {
        userId?: string | number;
        currentPassword?: string;
        newPassword?: string;
      };

      // ?낅젰 ?뺣━
      if (typeof currentPassword === "string")
        currentPassword = currentPassword.trim();
      if (typeof newPassword === "string") newPassword = newPassword.trim();

      if (!userId || !currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "userId, currentPassword, newPassword???꾩닔?낅땲?? });
      }

      // userId瑜?臾몄옄?대줈 蹂??      const userIdStr = String(userId);

      const user = await storage.getUser(userIdStr);
      if (!user) {
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎" });
      }

      let isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        const bcryptFormat = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
        const storedLooksHashed =
          typeof user.password === "string" && bcryptFormat.test(user.password);
        const inputLooksHashed =
          typeof currentPassword === "string" &&
          bcryptFormat.test(currentPassword);
        // 1) DB???됰Ц ??λ릺???덉뿀怨??낅젰???숈씪 ?됰Ц??寃쎌슦 ?덉슜
        // 2) DB???댁떆媛 ??λ릺???덇퀬 ?ъ슜?먭? 洹??댁떆 臾몄옄?댁쓣 洹몃?濡??낅젰??寃쎌슦???덉슜(?뺤긽??紐⑹쟻)
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
          .json({ error: "?꾩옱 鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎" });
      }

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res
          .status(400)
          .json({ error: "??鍮꾨?踰덊샇??6???댁긽?댁뼱???⑸땲?? });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await storage.updatePassword(userIdStr, hashedPassword);

      return res.json({ success: true });
    } catch (error) {
      console.error("鍮꾨?踰덊샇 蹂寃??ㅻ쪟:", error);
      return res.status(500).json({ error: "鍮꾨?踰덊샇 蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // Kakao OAuth 濡쒓렇??  app.post("/api/auth/kakao", async (req, res) => {
    try {
      const { code } = req.body as { code: string };
      console.log("?뵎 移댁뭅??濡쒓렇???붿껌 諛쏆쓬, code:", code ? "?덉쓬" : "?놁쓬");
      
      if (!code) {
        console.log("??移댁뭅??肄붾뱶 ?꾨씫");
        return res.status(400).json({ error: "code required" });
      }

      // ?섍꼍 蹂???뺤씤
      console.log("?뵩 移댁뭅???섍꼍 蹂???뺤씤:", {
        KAKAO_REST_KEY: process.env.KAKAO_REST_KEY ? "?ㅼ젙?? : "???꾨씫",
        KAKAO_REDIRECT_URI: process.env.KAKAO_REDIRECT_URI || "???꾨씫"
      });

      if (!process.env.KAKAO_REST_KEY || !process.env.KAKAO_REDIRECT_URI) {
        console.error("??移댁뭅???섍꼍 蹂?섍? ?ㅼ젙?섏? ?딆븯?듬땲??);
        return res.status(500).json({ error: "移댁뭅??濡쒓렇???ㅼ젙???꾨즺?섏? ?딆븯?듬땲?? });
      }

      console.log("?뱻 移댁뭅???좏겙 ?붿껌 以?..");
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
      console.log("??移댁뭅???≪꽭???좏겙 諛쏆쓬");

      console.log("?뱻 移댁뭅???ъ슜???뺣낫 ?붿껌 以?..");
      const { data: me } = await axios.get(
        "https://kapi.kakao.com/v2/user/me",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      console.log("?벀 移댁뭅??API ?먮낯 ?묐떟:", JSON.stringify(me, null, 2));

      const kakaoId: string = me.id.toString();
      const email: string | undefined = me.kakao_account?.email;
      const nickname: string | undefined = me.properties?.nickname || me.kakao_account?.profile?.nickname;
      const photoURL: string | undefined = me.properties?.profile_image || me.kakao_account?.profile?.profile_image_url;

      console.log("??移댁뭅???ъ슜???뺣낫 諛쏆쓬:", {
        kakaoId,
        email: email || "?대찓???놁쓬",
        nickname: nickname || "?됰꽕???놁쓬",
        photoURL: photoURL ? photoURL.substring(0, 50) + "..." : "?꾨줈???ъ쭊 ?놁쓬"
      });

      // ?ъ슜??李얘린/?앹꽦
      // 1. ?ㅼ젣 ?대찓?쇱씠 ?덉쑝硫??ㅼ젣 ?대찓?쇰줈 李얘린
      let user = email
        ? await storage.getUserByEmail(email).catch(() => undefined)
        : undefined;

      // 2. ?ㅼ젣 ?대찓?쇱씠 ?녾굅??李얠? 紐삵븳 寃쎌슦, ?꾩떆 ?대찓?쇰줈 李얘린
      const tempEmail = `kakao_${kakaoId}@example.com`;
      if (!user) {
        user = await storage.getUserByEmail(tempEmail).catch(() => undefined);
        if (user) {
          console.log("???꾩떆 ?대찓?쇰줈 湲곗〈 移댁뭅???ъ슜??李얠쓬:", user.email);
        }
      } else {
        console.log("???ㅼ젣 ?대찓?쇰줈 湲곗〈 ?ъ슜??李얠쓬:", user.email);
      }

      // 3. ?ъ슜?먭? ?놁쑝硫??덈줈 ?앹꽦
      if (!user) {
        console.log("?넅 ??移댁뭅???ъ슜???앹꽦 以?..");
        // ?쒕뜡 鍮꾨?踰덊샇 ?앹꽦 (?뚯뀥 濡쒓렇?몄씠誘濡??ㅼ젣 ?ъ슜?섏? ?딆쓬)
        const randomPassword = Math.random().toString(36).slice(-10);

        const userData = {
          username: nickname || `kakao_${kakaoId.slice(-6)}`,
          email: email || tempEmail,
          password: randomPassword,
          name: nickname || `移댁뭅?ㅼ궗?⑹옄_${kakaoId.slice(-6)}`, // null ???湲곕낯媛??ㅼ젙
          phone: null,
          userType: "customer" as const, // ???紐낆떆??罹먯뒪??        };

        // 鍮꾨?踰덊샇 ?뷀샇???곸슜
        const userWithHashedPassword = await createUserWithHash(userData);
        
        try {
          user = await storage.createUser(userWithHashedPassword);
          console.log("????移댁뭅???ъ슜???앹꽦 ?꾨즺:", user.email);
        } catch (createError: any) {
          // 以묐났 ???먮윭??寃쎌슦 ?ㅼ떆 議고쉶
          if (createError.code === '23505') {
            console.log("?좑툘 以묐났 ?먮윭 諛쒖깮, ?ㅼ떆 議고쉶 以?..");
            user = await storage.getUserByEmail(email || tempEmail);
            if (user) {
              console.log("???ъ“?뚮줈 湲곗〈 ?ъ슜??李얠쓬:", user.email);
            } else {
              throw new Error("?ъ슜???앹꽦 ?ㅽ뙣: 以묐났 ?먮윭 ???ъ“???ㅽ뙣");
            }
          } else {
            throw createError;
          }
        }
      }

      console.log("?뵦 Firebase 而ㅼ뒪? ?좏겙 ?앹꽦 以?..");
      // DB???앹꽦???ъ슜??ID瑜??ъ슜?섏뿬 Firebase 而ㅼ뒪? ?좏겙 ?앹꽦
      // 異붽? ?대젅?꾩뿉 ?ъ슜???뺣낫 ?ы븿
      const additionalClaims = {
        email: user.email,
        displayName: user.displayName || user.name,
        photoURL: user.photoURL || photoURL || null,
        userType: user.userType
      };
      
      const customToken = await adminAuth.createCustomToken(user.id, additionalClaims);
      console.log("??Firebase 而ㅼ뒪? ?좏겙 ?앹꽦 ?꾨즺, user.id:", user.id);
      console.log("?뱷 ?좏겙???ы븿???대젅??", additionalClaims);

      res.json({
        token: customToken,
        user: {
          id: user.id,
          uid: user.id, // Firebase uid濡쒕룄 ?꾨떖
          email: user.email,
          name: user.name,
          displayName: user.displayName || user.name,
          photoURL: user.photoURL || photoURL || null,
          userType: user.userType,
          grade: user.grade,
        },
      });
    } catch (err: any) {
      console.error("??[KakaoAuth] ?먮윭 諛쒖깮:");
      console.error("  - 硫붿떆吏:", err.message);
      console.error("  - ?ㅽ깮:", err.stack);
      if (err.response) {
        console.error("  - ?묐떟 ?곹깭:", err.response.status);
        console.error("  - ?묐떟 ?곗씠??", JSON.stringify(err.response.data, null, 2));
      }
      res.status(500).json({ error: "kakao auth failed", details: err.message });
    }
  });

  // ?ъ슜???좏삎 蹂寃?API
  app.post("/api/users/:id/change-type", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { userType } = req.body;

      // ?좏슚???ъ슜???좏삎?몄? ?뺤씤
      if (!["customer", "careManager", "admin"].includes(userType)) {
        return res
          .status(400)
          .json({ error: "?좏슚?섏? ?딆? ?ъ슜???좏삎?낅땲?? });
      }

      const user = await storage.updateUserType(userId, userType);

      if (!user) {
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎" });
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
      console.error("?ъ슜???좏삎 蹂寃??ㅻ쪟:", error);
      res.status(400).json({ error: "?ъ슜???좏삎 蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // Firebase ?ъ슜???꾨줈???ъ쭊 ?낅뜲?댄듃 API
  app.put("/api/users/firebase/:uid/profile-photo", async (req, res) => {
    try {
      const firebaseUid = req.params.uid;
      const { photoURL } = req.body;

      console.log("?뼹截?Firebase ?꾨줈???ъ쭊 ?낅뜲?댄듃:", {
        firebaseUid,
        photoURL,
      });

      if (!photoURL) {
        return res.status(400).json({ error: "?꾨줈???ъ쭊 URL???꾩슂?⑸땲??" });
      }

      // Firebase UID濡??ъ슜??李얘린 (id ?꾨뱶??Firebase UID媛 ??λ릺???덉쓬)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, firebaseUid))
        .limit(1);

      if (user) {
        // DB??photoURL ?낅뜲?댄듃
        await db
          .update(users)
          .set({ photoURL })
          .where(eq(users.id, firebaseUid));

        console.log(
          "??Firebase ?ъ슜???꾨줈???ъ쭊 DB ?낅뜲?댄듃 ?꾨즺:",
          firebaseUid,
        );
      } else {
        console.warn("?좑툘 Firebase UID濡??ъ슜?먮? 李얠쓣 ???놁쓬:", firebaseUid);
      }

      return res.status(200).json({
        success: true,
        message: "Firebase ?ъ슜???꾨줈???ъ쭊 ?낅뜲?댄듃 ?꾨즺",
        photoURL,
      });
    } catch (error: any) {
      console.error("Firebase ?꾨줈???ъ쭊 ?낅뜲?댄듃 ?ㅻ쪟:", error);
      return res.status(500).json({ error: "?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." });
    }
  });

  // 湲곗〈 ?ъ슜???꾨줈???ъ쭊 ?낅뜲?댄듃 API (臾몄옄???먮뒗 ?レ옄 ID ?ъ슜)
  app.put("/api/users/:id/profile-photo", async (req, res) => {
    try {
      const userId = req.params.id; // 臾몄옄??ID (Firebase UID ?먮뒗 ?쇰컲 ?レ옄 ID)
      const { photoURL } = req.body;

      console.log("?뼹截??꾨줈???ъ쭊 ?낅뜲?댄듃:", {
        userId,
        photoURL: photoURL ? photoURL.substring(0, 50) + "..." : "(??젣)",
      });

      if (photoURL === undefined || photoURL === null) {
        return res.status(400).json({ error: "?꾨줈???ъ쭊 URL???꾩슂?⑸땲??" });
      }

      // DB?먯꽌 ?ъ슜??李얘린 (臾몄옄??ID濡?寃??
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎." });
      }

      // DB??photoURL ?낅뜲?댄듃 (鍮?臾몄옄?댁씠硫?null濡????
      const photoValue = photoURL || null;
      await db.update(users).set({ photoURL: photoValue }).where(eq(users.id, userId));

      console.log("???꾨줈???ъ쭊 DB ?낅뜲?댄듃 ?꾨즺:", userId);

      // ?묐떟 媛앹껜??紐낆떆?곸쑝濡????吏??      const result: {
        success: boolean;
        photoURL: string;
        careManagerUpdated?: boolean;
      } = {
        success: true,
        photoURL,
      };

      // ?ъ슜?먭? 耳??留ㅻ땲???寃쎌슦 ?щ━?먯씠?고봽濡쒗븘 ?대?吏???낅뜲?댄듃
      if (user.userType === "careManager") {
        try {
          // userId濡??곌껐??耳?대ℓ?덉? 李얘린
          const careManager = await storage.getCareManagerByUserId(userId);
          if (careManager) {
            await storage.updateCareManager(careManager.id, {
              photoURL: photoURL,
            });
            result.careManagerUpdated = true;
            console.log("???щ━?먯씠???꾨줈???대?吏???낅뜲?댄듃 ?꾨즺");
          }
        } catch (error) {
          console.error("?щ━?먯씠?고봽濡쒗븘 ?ъ쭊 ?낅뜲?댄듃 ?ㅽ뙣:", error);
        }
      }

      res.json(result);
    } catch (error) {
      console.error("?꾨줈???ъ쭊 ?낅뜲?댄듃 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "?꾨줈???ъ쭊 ?낅뜲?댄듃 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." });
    }
  });

  // ?щ━?먯씠?곗듅??API
  app.post("/api/care-managers/:id/approve", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      const user = await storage.approveCareManager(userId);

      if (!user) {
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎" });
      }

      res.json({
        success: true,
        message: "?щ━?먯씠?곗듅?몄씠 ?꾨즺?섏뿀?듬땲??,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.userType,
          isApproved: user.isApproved,
        },
      });
    } catch (error) {
      console.error("?щ━?먯씠?곗듅???ㅻ쪟:", error);
      res.status(400).json({ error: "?щ━?먯씠?곗듅?몄뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?щ━ot占쎌씠?곗삁??紐⑸줉 議고쉶 API
  app.get("/api/bookings/care-manager/:careManagerId", async (req, res) => {
    try {
      const careManagerId = parseInt(req.params.careManagerId);

      if (isNaN(careManagerId)) {
        return res
          .status(400)
          .json({ error: "?좏슚?섏? ?딆? 耳?대ℓ?덉? ID?낅땲?? });
      }

      const bookings = await storage.getBookingsByCareManager(careManagerId);

      // 媛??덉빟??????섎ː???뺣낫 異붽?
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          // ?섎ː???뺣낫 媛?몄삤湲?          let user = null;
          if (booking.userId) {
            user = await storage.getUserByFirebaseId(booking.userId);
          }

          return {
            ...booking,
            date: booking.bookingDate || booking.createdAt || new Date(), // bookingDate瑜?date濡?留ㅽ븨
            userName:
              user?.username ||
              user?.displayName ||
              user?.email ||
              booking.userId, // username ?곗꽑, ?놁쑝硫?displayName, email, 留덉?留됱쑝濡?UID
            userEmail: user?.email || null,
            userPhone: user?.phone || null,
          };
        }),
      );

      res.json(enrichedBookings);
    } catch (error) {
      console.error("?щ━?먯씠?곗삁??紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?덉빟 紐⑸줉 議고쉶???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?좎쭨蹂??щ━?먯씠?곗삁??議고쉶 API
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

        // 媛??덉빟??????섎ː???뺣낫 異붽?
        const enrichedBookings = await Promise.all(
          bookings.map(async (booking) => {
            // ?섎ː???뺣낫 媛?몄삤湲?            let user = null;
            if (booking.userId) {
              user = await storage.getUserByFirebaseId(booking.userId);
            }

            return {
              ...booking,
              date: booking.bookingDate || booking.createdAt || new Date(), // bookingDate瑜?date濡?留ㅽ븨
              userName:
                user?.username ||
                user?.displayName ||
                user?.email ||
                booking.userId, // username ?곗꽑, ?놁쑝硫?displayName, email, 留덉?留됱쑝濡?UID
              userEmail: user?.email || null,
              userPhone: user?.phone || null,
            };
          }),
        );

        res.json(enrichedBookings);
      } catch (error) {
        console.error("?좎쭨蹂??щ━?먯씠?곗삁??議고쉶 ?ㅻ쪟:", error);
        res.status(500).json({ error: "?좎쭨蹂??덉빟 議고쉶???ㅽ뙣?덉뒿?덈떎" });
      }
    },
  );

  // ?덉빟 ?곹깭 蹂寃?API
  app.put("/api/bookings/:id/status", async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { status, completionFiles, completionNote, completedAt } = req.body;

      // ?좏슚???곹깭 媛믪씤吏 ?뺤씤
      if (!["pending", "confirmed", "completed", "canceled"].includes(status)) {
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?덉빟 ?곹깭?낅땲?? });
      }

      // ?묒뾽 ?꾨즺 ??異붽? ?곗씠???낅뜲?댄듃
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
          return res.status(404).json({ error: "?덉빟??李얠쓣 ???놁뒿?덈떎" });
        }

        res.json(booking);
      } else {
        const booking = await storage.updateBookingStatus(bookingId, status);

        if (!booking) {
          return res.status(404).json({ error: "?덉빟??李얠쓣 ???놁뒿?덈떎" });
        }

        res.json(booking);
      }
    } catch (error) {
      console.error("?덉빟 ?곹깭 蹂寃??ㅻ쪟:", error);
      res.status(400).json({ error: "?덉빟 ?곹깭 蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // Care Manager routes
  app.get("/api/care-managers", async (req, res) => {
    try {
      console.log("耳?대ℓ?덉? 紐⑸줉 ?붿껌 泥섎━ 以?..");
      const careManagers = await storage.getAllCareManagers();
      console.log(`耳?대ℓ?덉? ${careManagers.length}紐?議고쉶??);
      res.json(careManagers);
    } catch (error) {
      console.error("?щ━?먯씠?곕ぉ濡?議고쉶 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "?щ━?먯씠?곕ぉ濡앹쓣 遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
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

  // ?щ━?먯씠?곗젙蹂??낅뜲?댄듃 API
  app.put("/api/care-managers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payload = req.body;

      console.log("?뱷 ?щ━?먯씠???낅뜲?댄듃 ?붿껌:", {
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
        // ?덉퐫?쒓? ?놁쑝硫??덈줈 ?앹꽦
        const user = await storage.getUser(id);
        const insertData: any = {
          // ?꾩닔 ?꾨뱶 湲곕낯媛?payload
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
        console.log("???щ━?먯씠???앹꽦 ?꾨즺 (description ?ы븿)");
        return res.status(201).json(updated);
      }

      console.log("???щ━?먯씠???낅뜲?댄듃 ?꾨즺:", {
        name: updated.name,
        age: updated.age,
        description: updated.description?.substring(0, 50),
        descriptionLength: updated.description?.length || 0,
        hourlyRate: updated.hourlyRate,
      });

      res.json(updated);
    } catch (error) {
      console.error("?щ━?먯씠?곗뾽?곗씠???ㅻ쪟:", error);
      res.status(400).json({ error: "?щ━?먯씠?곗뾽?곗씠?몄뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // Service routes
  app.get("/api/services", async (req, res) => {
    try {
      const services = await storage.getAllServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: "?쒕퉬??紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // Booking routes
  app.post("/api/bookings", async (req, res) => {
    try {
      console.log("?덉빟 ?붿껌 ?곗씠??", req.body);

      // date ?꾨뱶瑜?bookingDate濡?蹂??(?대씪?댁뼵???명솚??
      if (req.body.date) {
        req.body.bookingDate =
          typeof req.body.date === "string"
            ? new Date(req.body.date)
            : req.body.date;
        delete req.body.date;
      }

      // bookingDate媛 ?놁쑝硫??꾩옱 ?쒓컙?쇰줈 ?ㅼ젙
      if (!req.body.bookingDate) {
        req.body.bookingDate = new Date();
      }

      // totalAmount瑜?臾몄옄?대줈 蹂??      if (req.body.totalAmount && typeof req.body.totalAmount === "number") {
        req.body.totalAmount = req.body.totalAmount.toString();
      }

      const bookingData = insertBookingSchema.parse(req.body);
      console.log("?ㅽ궎留?寃利????곗씠??", bookingData);

      // 耳?대ℓ?덉? 議댁옱 ?щ? ?뺤씤
      const careManager = await storage.getCareManager(
        bookingData.careManagerId,
      );
      if (!careManager) {
        return res.status(400).json({
          error: `AI ?щ━?먯씠??ID ${bookingData.careManagerId}媛 議댁옱?섏? ?딆뒿?덈떎`,
        });
      }

      // ?쒕퉬??議댁옱 ?щ? ?뺤씤 (?좏깮 ?ы빆 - AI ?꾨컮? ?뚮옯?쇱뿉?쒕뒗 ?쒕퉬?ㅺ? ?꾩슂?섏? ?딆쓣 ???덉쓬)
      if (bookingData.serviceId) {
        const service = await storage.getService(bookingData.serviceId);
        if (!service) {
          console.warn(
            `?쒕퉬??ID ${bookingData.serviceId}媛 議댁옱?섏? ?딆?留? ?덉빟??怨꾩냽 吏꾪뻾?⑸땲??`,
          );
          // ?쒕퉬?ㅺ? ?놁뼱???덉빟??怨꾩냽 吏꾪뻾 (AI ?щ━?먯씠???섎ː???쒕퉬???놁씠 媛??
        }
      }

      const booking = await storage.createBooking(bookingData);
      res.json(booking);
    } catch (error) {
      console.error("?덉빟 ?앹꽦 ?ㅻ쪟:", error);
      if (error instanceof Error) {
        res
          .status(400)
          .json({ error: `?덉빟 ?앹꽦???ㅽ뙣?덉뒿?덈떎: ${error.message}` });
      } else {
        res.status(400).json({ error: "?덉빟 ?앹꽦???ㅽ뙣?덉뒿?덈떎" });
      }
    }
  });

  app.get("/api/bookings/user/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;

      // ?덉빟 紐⑸줉 媛?몄삤湲?      const bookings = await storage.getBookingsByUser(userId);

      // 媛??덉빟?????耳?대ℓ?덉? ?뺣낫? ?쒕퉬???뺣낫, ?ъ슜???뺣낫 異붽?
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          // 耳?대ℓ?덉? ?뺣낫 媛?몄삤湲?          let careManager = await storage.getCareManager(booking.careManagerId);
          if (!careManager) {
            careManager = {
              id: booking.careManagerId,
              name: `?щ━?먯씠??${booking.careManagerId}`,
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

          // ?쒕퉬???뺣낫 媛?몄삤湲?          let service = await storage.getService(booking.serviceId);
          if (!service) {
            service = {
              id: booking.serviceId,
              name: "?쒕퉬???뺣낫 ?놁쓬",
              icon: "fas fa-question",
              color: "bg-gray-500",
              description: null,
              averageDuration: null,
            };
          }

          // ?ъ슜???뺣낫 媛?몄삤湲?          let user = null;
          if (booking.userId) {
            user = await storage.getUserByFirebaseId(booking.userId);
          }

          // ?뺣낫 ?⑹튂湲?          return {
            ...booking,
            date: booking.bookingDate || booking.createdAt || new Date(), // bookingDate瑜?date濡?留ㅽ븨
            userName:
              user?.username ||
              user?.displayName ||
              user?.email ||
              booking.userId, // username ?곗꽑
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
      console.error("?덉빟 紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?덉빟 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?뱀젙 ?좎쭨??耳??留ㅻ땲????덉빟 ?뺣낫 媛?몄삤湲?  app.get("/api/bookings/manager/:managerId/date/:date", async (req, res) => {
    try {
      const managerId = parseInt(req.params.managerId);
      const date = req.params.date; // YYYY-MM-DD ?뺤떇

      // ?대떦 ?좎쭨??紐⑤뱺 ?덉빟 媛?몄삤湲?      const bookings = await storage.getBookingsByCareManagerAndDate(
        managerId,
        date,
      );
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "?덉빟 ?뺣낫瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // Message routes
  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: "硫붿떆吏 ?꾩넚???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  app.get("/api/messages/:userId1/:userId2", async (req, res) => {
    try {
      const userId1 = parseInt(req.params.userId1);
      const userId2 = parseInt(req.params.userId2);
      const messages = await storage.getMessagesBetweenUsers(userId1, userId2);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "硫붿떆吏 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?ъ슜??紐⑸줉 議고쉶 API
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "?ъ슜??紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?ъ슜???뺣낫 ?낅뜲?댄듃 API
  app.put("/api/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const payload = req.body;

      console.log("?ъ슜???낅뜲?댄듃 ?붿껌:", { userId, payload });

      const updatedUser = await storage.updateUser(userId, payload);

      if (!updatedUser) {
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("?ъ슜???낅뜲?댄듃 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?ъ슜???뺣낫 ?낅뜲?댄듃???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곗씠?곕쿋?댁뒪 留덉씠洹몃젅?댁뀡 ?ㅽ뻾 (愿由ъ옄 ?꾩슜)
  app.post("/api/admin/run-migration", async (req, res) => {
    try {
      const { sql: sqlStatement } = req.body;

      if (!sqlStatement) {
        return res.status(400).json({ error: "SQL 臾몄씠 ?꾩슂?⑸땲?? });
      }

      console.log("留덉씠洹몃젅?댁뀡 ?ㅽ뻾:", sqlStatement);

      // Neon ?곗씠?곕쿋?댁뒪??吏곸젒 SQL ?ㅽ뻾
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);

      await sql(sqlStatement);

      res.json({
        success: true,
        message: "留덉씠洹몃젅?댁뀡???깃났?곸쑝濡??ㅽ뻾?섏뿀?듬땲??,
      });
    } catch (error: any) {
      console.error("留덉씠洹몃젅?댁뀡 ?ㅽ뻾 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: error.message || "留덉씠洹몃젅?댁뀡 ?ㅽ뻾???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // 愿由ъ옄 ??쒕낫???듦퀎
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
      res.status(500).json({ error: "?듦퀎 ?뺣낫瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // 遺꾩웳 紐⑸줉 議고쉶
  app.get("/api/disputes", async (req, res) => {
    try {
      const disputes = await storage.getAllDisputes();
      res.json(disputes);
    } catch (error) {
      console.error("遺꾩웳 紐⑸줉 議고쉶 ?ㅻ쪟", error);
      res.status(500).json({ error: "遺꾩웳 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // 遺꾩웳 ?곹깭 ?낅뜲?댄듃
  app.put("/api/disputes/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const updated = await storage.updateDisputeStatus(id, status);
      if (!updated)
        return res.status(404).json({ error: "遺꾩웳??李얠쓣 ???놁뒿?덈떎" });
      res.json(updated);
    } catch (error) {
      console.error("遺꾩웳 ?곹깭 ?낅뜲?댄듃 ?ㅻ쪟", error);
      res.status(400).json({ error: "遺꾩웳 ?곹깭 ?낅뜲?댄듃???ㅽ뙣?덉뒿?덈떎" });
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
      res.status(400).json({ error: "怨듭? ?앹꽦 ?ㅽ뙣" });
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

  // ?곹뭹 移댄뀒怨좊━ 紐⑸줉 議고쉶 (?곹뭹 ?곸꽭 ?쇱슦?몃낫??癒쇱? ?????
  app.get("/api/products/categories", async (req, res) => {
    try {
      const categories = await storage.getAllProductCategories();
      res.json({ categories });
    } catch (error) {
      console.error("?곹뭹 移댄뀒怨좊━ 紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "?곹뭹 移댄뀒怨좊━ 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 移댄뀒怨좊━ ?곸꽭 議고쉶
  app.get("/api/products/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ error: "?좏슚?섏? ?딆? 移댄뀒怨좊━ ID?낅땲?? });
      }

      const category = await storage.getProductCategory(id);

      if (!category) {
        return res.status(404).json({ error: "移댄뀒怨좊━瑜?李얠쓣 ???놁뒿?덈떎" });
      }

      res.json(category);
    } catch (error) {
      console.error("?곹뭹 移댄뀒怨좊━ ?곸꽭 議고쉶 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "移댄뀒怨좊━ ?뺣낫瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 紐⑸줉 議고쉶
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

      // 移댄뀒怨좊━ ?대쫫??吏곸젒 storage濡??꾨떖 (留ㅽ븨 ?쒓굅)
      if (category) {
        console.log("[SERVER] 移댄뀒怨좊━ ?대쫫 ?꾨떖:", category);
        params.category = category as string;
      }

      if (search) params.search = search as string;
      if (limit) params.limit = parseInt(limit as string);
      if (offset) params.offset = parseInt(offset as string);

      console.log("[SERVER] ?곹뭹 紐⑸줉 議고쉶 ?뚮씪誘명꽣:", params);

      const products = await storage.getAllProducts(params);
      console.log(`[SERVER] 議고쉶???곹뭹 媛쒖닔: ${products.length}`);

      // ?대씪?댁뼵???명솚?깆쓣 ?꾪빐 紐⑤뱺 ?곹뭹??status ?꾨뱶 異붽? 諛?媛寃??レ옄 蹂??      const productsWithStatus = products.map((product) => ({
        ...product,
        status: product.isActive ? "active" : "hidden",
        price: product.price ? Math.floor(Number(product.price)) : 0,
        discountPrice: product.discountPrice
          ? Math.floor(Number(product.discountPrice))
          : null,
      }));

      res.json(productsWithStatus);
    } catch (error) {
      console.error("?곹뭹 紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?곹뭹 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 ?곸꽭 議고쉶
  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?곹뭹 ID?낅땲?? });
      }

      const product = await storage.getProduct(id);

      if (!product) {
        return res.status(404).json({ error: "?곹뭹??李얠쓣 ???놁뒿?덈떎" });
      }

      // ?대씪?댁뼵???명솚?깆쓣 ?꾪빐 status ?꾨뱶 異붽? 諛?媛寃??レ옄 蹂??      const productWithStatus = {
        ...product,
        status: product.isActive ? "active" : "hidden",
        price: product.price ? Math.floor(Number(product.price)) : 0,
        discountPrice: product.discountPrice
          ? Math.floor(Number(product.discountPrice))
          : null,
      };

      res.json(productWithStatus);
    } catch (error) {
      console.error("?곹뭹 ?곸꽭 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?곹뭹 ?뺣낫瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 ?깅줉
  app.post("/api/products", async (req, res) => {
    try {
      const productData = req.body;

      console.log("?벀 ?곹뭹 ?깅줉 ?붿껌 諛쏆쓬:", {
        title: productData.title,
        price: productData.price,
        category_id: productData.category_id,
        images: productData.images,
      });

      // ?꾩닔 ?꾨뱶 寃利?      if (!productData.title || !productData.price) {
        return res
          .status(400)
          .json({ error: "?곹뭹紐낃낵 媛寃⑹? ?꾩닔 ??ぉ?낅땲?? });
      }

      // ?곗씠?곕쿋?댁뒪 ?ㅽ궎留덉뿉 留욊쾶 ?꾨뱶紐?蹂??      const dbProductData: any = {
        name: productData.title, // DB??name ?꾨뱶 (?꾩닔)
        title: productData.title, // DB??title ?꾨뱶 (?좏깮)
        description: productData.description,
        price: Number(productData.price),
        discountPrice: productData.discount_price
          ? Number(productData.discount_price)
          : null,
        stock: Number(productData.stock) || 0,
        images: productData.images,
        digitalFiles: productData.digital_files || [], // ?붿????뚯씪 URL 諛곗뿴
        isDigital: productData.is_digital || false, // ?붿????곹뭹 ?щ?
        // status瑜?isActive濡?蹂??        isActive: !productData.status || productData.status === "active",
      };

      // seller_id瑜?sellerId濡?蹂??(varchar ???
      if (productData.seller_id) {
        dbProductData.sellerId = String(productData.seller_id);
      }

      // category_id瑜?categoryId濡?蹂??      if (productData.category_id) {
        dbProductData.categoryId = parseInt(productData.category_id);
      }

      console.log("?벀 DB????ν븷 ?곗씠??", dbProductData);

      const product = await storage.createProduct(dbProductData);

      console.log("?벀 ?곹뭹 ?깅줉 ?깃났:", {
        id: product.id,
        name: product.name,
        title: product.title,
      });

      // ?대씪?댁뼵???명솚?깆쓣 ?꾪빐 status ?꾨뱶 異붽? 諛?媛寃??レ옄 蹂??      const productWithStatus = {
        ...product,
        status: product.isActive ? "active" : "hidden",
        price: product.price ? Math.floor(Number(product.price)) : 0,
        discountPrice: product.discountPrice
          ? Math.floor(Number(product.discountPrice))
          : null,
      };

      res.status(201).json(productWithStatus);
    } catch (error) {
      console.error("?곹뭹 ?깅줉 ?ㅻ쪟:", error);
      res.status(400).json({ error: "?곹뭹 ?깅줉???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 ?섏젙
  app.put("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?곹뭹 ID?낅땲?? });
      }

      const productData = req.body;

      // ?곗씠?곕쿋?댁뒪 ?ㅽ궎留덉뿉 留욊쾶 ?꾨뱶紐?蹂??      const dbProductData: any = {};

      // 湲곕낯 ?꾨뱶??蹂듭궗
      if (productData.title) {
        dbProductData.name = productData.title; // DB??name ?꾨뱶???④퍡 ?낅뜲?댄듃
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
        dbProductData.digitalFiles = productData.digital_files; // ?붿????뚯씪
      if (productData.is_digital !== undefined)
        dbProductData.isDigital = productData.is_digital; // ?붿????곹뭹 ?щ?
      // status瑜?isActive濡?蹂??      if (productData.status !== undefined) {
        dbProductData.isActive = productData.status === "active";
      }

      // seller_id瑜?sellerId濡?蹂??(varchar ???
      if (productData.seller_id) {
        dbProductData.sellerId = String(productData.seller_id);
      }

      // category_id瑜?categoryId濡?蹂??(0???좏슚??媛믪쑝濡?泥섎━)
      if (
        productData.category_id !== undefined &&
        productData.category_id !== null &&
        productData.category_id !== ""
      ) {
        dbProductData.categoryId = parseInt(productData.category_id);
      }

      const updated = await storage.updateProduct(id, dbProductData);

      if (!updated) {
        return res.status(404).json({ error: "?곹뭹??李얠쓣 ???놁뒿?덈떎" });
      }

      // ?대씪?댁뼵???명솚?깆쓣 ?꾪빐 status ?꾨뱶 異붽? 諛?媛寃??レ옄 蹂??      const productWithStatus = {
        ...updated,
        status: updated.isActive ? "active" : "hidden",
        price: updated.price ? Math.floor(Number(updated.price)) : 0,
        discountPrice: updated.discountPrice
          ? Math.floor(Number(updated.discountPrice))
          : null,
      };

      res.json(productWithStatus);
    } catch (error) {
      console.error("?곹뭹 ?섏젙 ?ㅻ쪟:", error);
      res.status(400).json({ error: "?곹뭹 ?섏젙???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 ??젣
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?곹뭹 ID?낅땲?? });
      }

      const deleted = await storage.deleteProduct(id);

      if (!deleted) {
        return res.status(404).json({ error: "?곹뭹??李얠쓣 ???놁뒿?덈떎" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("?곹뭹 ??젣 ?ㅻ쪟:", error);
      res.status(400).json({ error: "?곹뭹 ??젣???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 移댄뀒怨좊━ ?깅줉
  app.post("/api/products/categories", async (req, res) => {
    try {
      const categoryData = req.body;

      // ?꾩닔 ?꾨뱶 寃利?      if (!categoryData.name) {
        return res.status(400).json({ error: "移댄뀒怨좊━紐낆? ?꾩닔 ??ぉ?낅땲?? });
      }

      const category = await storage.createProductCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("?곹뭹 移댄뀒怨좊━ ?깅줉 ?ㅻ쪟:", error);
      res.status(400).json({ error: "移댄뀒怨좊━ ?깅줉???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 移댄뀒怨좊━ ?섏젙
  app.put("/api/products/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ error: "?좏슚?섏? ?딆? 移댄뀒怨좊━ ID?낅땲?? });
      }

      const payload = req.body;

      const updated = await storage.updateProductCategory(id, payload);

      if (!updated) {
        return res.status(404).json({ error: "移댄뀒怨좊━瑜?李얠쓣 ???놁뒿?덈떎" });
      }

      res.json(updated);
    } catch (error) {
      console.error("?곹뭹 移댄뀒怨좊━ ?섏젙 ?ㅻ쪟:", error);
      res.status(400).json({ error: "移댄뀒怨좊━ ?섏젙???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?곹뭹 移댄뀒怨좊━ ??젣
  app.delete("/api/products/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ error: "?좏슚?섏? ?딆? 移댄뀒怨좊━ ID?낅땲?? });
      }

      const deleted = await storage.deleteProductCategory(id);

      if (!deleted) {
        return res.status(404).json({ error: "移댄뀒怨좊━瑜?李얠쓣 ???놁뒿?덈떎" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("?곹뭹 移댄뀒怨좊━ ??젣 ?ㅻ쪟:", error);
      res.status(400).json({ error: "移댄뀒怨좊━ ??젣???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ==================== ?덈줈??湲곕뒫 API ?몃뱾?щ뱾 ====================

  // 李쒗븳 ?щ━?먯씠?캚PI
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
      console.error("李쒗븳 ?щ━?먯씠?곗“???ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "李쒗븳 ?щ━?먯씠?곕ぉ濡앹쓣 遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  app.post("/api/favorites", async (req, res) => {
    try {
      const favoriteData = req.body;

      if (!favoriteData.userId || !favoriteData.careManagerId) {
        return res
          .status(400)
          .json({ error: "?ъ슜??ID? ?щ━?먯씠?캧D???꾩닔 ??ぉ?낅땲?? });
      }

      const favorite = await storage.addFavorite(favoriteData);
      res.status(201).json(favorite);
    } catch (error) {
      console.error("李쒗븯湲?異붽? ?ㅻ쪟:", error);
      res.status(400).json({ error: "李쒗븯湲?異붽????ㅽ뙣?덉뒿?덈떎" });
    }
  });

  app.delete("/api/favorites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "?좏슚?섏? ?딆? 李쒗븯湲?ID?낅땲?? });
      }

      const deleted = await storage.removeFavorite(id);

      if (!deleted) {
        return res.status(404).json({ error: "李쒗븯湲곕? 李얠쓣 ???놁뒿?덈떎" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("李쒗븯湲???젣 ?ㅻ쪟:", error);
      res.status(400).json({ error: "李쒗븯湲???젣???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?ъ슜???ㅼ젙 API (?뚮┝ ?ㅼ젙 + 媛쒖씤?뺣낫 蹂댄샇 ?ㅼ젙)
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
        // ????諛섑솚
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
      console.error("?ъ슜???ㅼ젙 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?ъ슜???ㅼ젙??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
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
          error: "?ㅼ젙 ???type)??吏?뺥빐二쇱꽭?? notification ?먮뒗 privacy",
        });
      }
    } catch (error) {
      console.error("?ъ슜???ㅼ젙 ?낅뜲?댄듃 ?ㅻ쪟:", error);
      res.status(400).json({ error: "?ъ슜???ㅼ젙 ?낅뜲?댄듃???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // 臾몄쓽 愿由?API
  app.get("/api/inquiries", async (req, res) => {
    try {
      const inquiries = await storage.getAllInquiries();
      res.json(inquiries);
    } catch (error) {
      console.error("臾몄쓽?ы빆 紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "臾몄쓽?ы빆 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  app.get("/api/inquiries/user/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const inquiries = await storage.getUserInquiries(userId);
      res.json(inquiries);
    } catch (error) {
      console.error("?ъ슜??臾몄쓽?ы빆 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "臾몄쓽?ы빆??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
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
          .json({ error: "?ъ슜??ID, ?쒕ぉ, ?댁슜, 移댄뀒怨좊━???꾩닔 ??ぉ?낅땲?? });
      }

      const inquiry = await storage.createInquiry(inquiryData);
      res.status(201).json(inquiry);
    } catch (error) {
      console.error("臾몄쓽?ы빆 ?앹꽦 ?ㅻ쪟:", error);
      res.status(400).json({ error: "臾몄쓽?ы빆 ?깅줉???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  app.put("/api/inquiries/:id/answer", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { answer, answeredBy } = req.body;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ error: "?좏슚?섏? ?딆? 臾몄쓽?ы빆 ID?낅땲?? });
      }

      if (!answer || !answeredBy) {
        return res
          .status(400)
          .json({ error: "?듬? ?댁슜怨??듬??먮뒗 ?꾩닔 ??ぉ?낅땲?? });
      }

      const inquiry = await storage.answerInquiry(id, answer, answeredBy);

      if (!inquiry) {
        return res.status(404).json({ error: "臾몄쓽?ы빆??李얠쓣 ???놁뒿?덈떎" });
      }

      res.json(inquiry);
    } catch (error) {
      console.error("臾몄쓽?ы빆 ?듬? ?ㅻ쪟:", error);
      res.status(400).json({ error: "臾몄쓽?ы빆 ?듬????ㅽ뙣?덉뒿?덈떎" });
    }
  });

  app.put("/api/inquiries/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ error: "?좏슚?섏? ?딆? 臾몄쓽?ы빆 ID?낅땲?? });
      }

      if (!status) {
        return res.status(400).json({ error: "?곹깭???꾩닔 ??ぉ?낅땲?? });
      }

      // ?좏슚???곹깭 媛믪씤吏 ?뺤씤
      if (!["pending", "in_progress", "answered", "closed"].includes(status)) {
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?곹깭?낅땲?? });
      }

      const inquiry = await storage.updateInquiryStatus(id, status);

      if (!inquiry) {
        return res.status(404).json({ error: "臾몄쓽?ы빆??李얠쓣 ???놁뒿?덈떎" });
      }

      res.json(inquiry);
    } catch (error) {
      console.error("臾몄쓽?ы빆 ?곹깭 ?낅뜲?댄듃 ?ㅻ쪟:", error);
      res.status(400).json({ error: "臾몄쓽?ы빆 ?곹깭 ?낅뜲?댄듃???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ==================== 二쇰Ц 愿由?API ====================

  // 愿由ъ옄 二쇰Ц 紐⑸줉 議고쉶
  // 怨좉컼 二쇰Ц 議고쉶 API
  app.get("/api/orders/customer/:customerId", async (req, res) => {
    try {
      const { customerId } = req.params;
      console.log("怨좉컼 二쇰Ц 議고쉶 API ?몄텧:", customerId);

      if (!customerId) {
        return res.status(400).json({ error: "怨좉컼 ID媛 ?꾩슂?⑸땲??" });
      }

      const orders = await storage.getOrdersByCustomer(customerId);
      console.log("議고쉶??二쇰Ц:", orders.length, "媛?);
      res.json(orders);
    } catch (error) {
      console.error("怨좉컼 二쇰Ц 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "二쇰Ц 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?먮ℓ??二쇰Ц 議고쉶 API
  app.get("/api/orders/seller/:sellerId", async (req, res) => {
    try {
      const { sellerId } = req.params;
      console.log("?먮ℓ??二쇰Ц 議고쉶 API ?몄텧:", sellerId);

      if (!sellerId) {
        return res.status(400).json({ error: "?먮ℓ??ID媛 ?꾩슂?⑸땲??" });
      }

      const orders = await storage.getOrdersBySeller(sellerId);
      console.log("議고쉶??二쇰Ц:", orders.length, "媛?);
      res.json(orders);
    } catch (error) {
      console.error("?먮ℓ??二쇰Ц 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "二쇰Ц 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  app.get("/api/orders/admin", async (req, res) => {
    try {
      // ?ㅼ젣 援ы쁽?먯꽌???몄쬆 ?뺤씤 ?꾩슂
      // const user = await verifyAuthToken(req);
      // if (user.userType !== 'admin') return res.status(403).json({ error: "沅뚰븳???놁뒿?덈떎" });

      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("二쇰Ц 紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "二쇰Ц 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // 二쇰Ц ?곹깭 蹂寃?  app.put("/api/orders/:orderId/status", async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      if (!orderId || !status) {
        return res
          .status(400)
          .json({ error: "二쇰Ц ID? ?곹깭???꾩닔 ??ぉ?낅땲??" });
      }

      const updated = await storage.updateOrderStatus(String(orderId), status);

      if (!updated) {
        return res.status(404).json({ error: "二쇰Ц??李얠쓣 ???놁뒿?덈떎." });
      }

      // ?낃툑?湲???寃곗젣?꾨즺濡?蹂寃????붿????곹뭹 ?ㅼ슫濡쒕뱶 留곹겕 ?먮룞 ?쒓났
      if (status === "pending") {
        try {
          // 二쇰Ц ?뺣낫 議고쉶
          const numericOrderId = parseInt(
            String(orderId).replace(/^ORD-0*/, ""),
          );
          const order = await storage.getOrderById(numericOrderId);

          if (order && order.orderItems && order.orderItems.length > 0) {
            // 二쇰Ц???곹뭹?ㅼ쓽 ?뺣낫 議고쉶
            const productIds = order.orderItems
              .map((item: any) => item.productId)
              .filter(Boolean);
            if (productIds.length > 0) {
              const products = await Promise.all(
                productIds.map((pid: number) => storage.getProduct(pid)),
              );

              // ?붿????곹뭹???덈뒗吏 ?뺤씤
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
                // 泥?踰덉㎏ ?붿????뚯씪???ㅼ슫濡쒕뱶 留곹겕濡??쒓났
                const downloadUrl = digitalProduct.digitalFiles[0];

                console.log(
                  "?낃툑 ?뺤씤?? ?붿????곹뭹 ?ㅼ슫濡쒕뱶 留곹겕 ?쒓났:",
                  downloadUrl,
                );

                // ?먮룞?쇰줈 諛곗넚 ?뺣낫 ?낅뜲?댄듃 (?ㅼ슫濡쒕뱶 留곹겕)
                await storage.updateOrderShipping(
                  orderId,
                  downloadUrl,
                  "吏곸젒 ?ㅼ슫濡쒕뱶",
                );
              }
            }
          }
        } catch (digitalProductError) {
          console.error(
            "?붿????곹뭹 泥섎━ ?ㅻ쪟 (?곹깭 蹂寃쎌? ?꾨즺??:",
            digitalProductError,
          );
        }
      }

      res.json({ success: true, order: updated });

      // ?뚮┝ ?앹꽦
      if (status === "processing") {
        await storage.createAdminNotification({
          type: "order_processing",
          message: `二쇰Ц #${orderId}??媛) 泥섎━ 以묒엯?덈떎.`,
          order_id: String(orderId),
        });
      } else if (status === "shipped") {
        await storage.createAdminNotification({
          type: "order_shipped",
          message: `二쇰Ц #${orderId}??媛) 諛쒖넚?섏뿀?듬땲??`,
          order_id: String(orderId),
        });
      } else if (status === "delivered") {
        await storage.createAdminNotification({
          type: "order_delivered",
          message: `二쇰Ц #${orderId}??媛) 諛곗넚 ?꾨즺?섏뿀?듬땲??`,
          order_id: String(orderId),
        });
      } else if (status === "canceled") {
        await storage.createAdminNotification({
          type: "order_canceled",
          message: `二쇰Ц #${orderId}??媛) 痍⑥냼?섏뿀?듬땲??`,
          order_id: String(orderId),
        });
      }
    } catch (error) {
      console.error("二쇰Ц ?곹깭 ?낅뜲?댄듃 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "二쇰Ц ?곹깭 ?낅뜲?댄듃 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." });
    }
  });

  // 諛곗넚 ?뺣낫 ?낅뜲?댄듃
  app.put("/api/orders/:orderId/shipping", async (req, res) => {
    try {
      const { orderId } = req.params;
      const { trackingNumber, shippingCompany } = req.body;

      if (!orderId || !trackingNumber || !shippingCompany) {
        return res
          .status(400)
          .json({ error: "二쇰Ц ID, ?댁넚??踰덊샇, 諛곗넚?щ뒗 ?꾩닔 ??ぉ?낅땲??" });
      }

      const updated = await storage.updateOrderShipping(
        String(orderId),
        trackingNumber,
        shippingCompany,
      );

      if (!updated) {
        return res.status(404).json({ error: "二쇰Ц??李얠쓣 ???놁뒿?덈떎." });
      }

      res.json({ success: true, order: updated });

      // 諛곗넚 ?쒖옉 ?뚮┝ ?앹꽦
      await storage.createAdminNotification({
        type: "shipping_started",
        message: `二쇰Ц #${orderId}??諛곗넚???쒖옉?섏뿀?듬땲?? (${shippingCompany}, ${trackingNumber})`,
        order_id: String(orderId),
      });
    } catch (error) {
      console.error("諛곗넚 ?뺣낫 ?낅뜲?댄듃 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "諛곗넚 ?뺣낫 ?낅뜲?댄듃 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." });
    }
  });

  // 二쇰Ц ?앹꽦 API 異붽?
  app.post("/api/orders", async (req, res) => {
    try {
      console.log("二쇰Ц ?앹꽦 ?붿껌:", req.body);
      const {
        items,
        shipping_address_id,
        payment_method,
        total_amount,
        customer_id,
        seller_id,
      } = req.body;

      // ?꾩닔 ?뺣낫 寃利?      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "二쇰Ц???곹뭹 ?뺣낫媛 ?놁뒿?덈떎." });
      }

      if (!shipping_address_id) {
        return res.status(400).json({ error: "諛곗넚吏 ?뺣낫媛 ?꾨씫?섏뿀?듬땲??" });
      }

      if (!payment_method) {
        return res.status(400).json({ error: "寃곗젣 諛⑸쾿???꾨씫?섏뿀?듬땲??" });
      }

      // 二쇰Ц ?앹꽦 ?곗씠??      const orderData = {
        customer_id: customer_id || req.body.user_id,
        seller_id: seller_id,
        items,
        shipping_address_id,
        payment_method,
        total_amount: total_amount || 0,
        customer_name: req.body.customer_name || "怨좉컼",
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

      console.log("二쇰Ц ?앹꽦 ?곗씠??(蹂????:", orderData);

      // 二쇰Ц ?앹꽦
      const order = await storage.createOrder(orderData);

      console.log("二쇰Ц ?앹꽦 ?꾨즺:", order);

      // ?붿????곹뭹??寃쎌슦 ?먮룞?쇰줈 ?ㅼ슫濡쒕뱶 留곹겕 ?쒓났 (移대뱶 寃곗젣留?
      // 臾댄넻?μ엯湲덉? ?낃툑 ?뺤씤 ???곹깭 蹂寃????쒓났
      if (payment_method === "card") {
        try {
          // 二쇰Ц???곹뭹?ㅼ쓽 ?뺣낫 議고쉶
          const productIds = items
            .map((item: any) => item.product_id)
            .filter(Boolean);
          if (productIds.length > 0) {
            const products = await Promise.all(
              productIds.map((pid: number) => storage.getProduct(pid)),
            );

            // ?붿????곹뭹???덈뒗吏 ?뺤씤
            const digitalProduct = products.find(
              (p: any) =>
                p && p.isDigital && p.digitalFiles && p.digitalFiles.length > 0,
            );

            if (
              digitalProduct &&
              digitalProduct.digitalFiles &&
              digitalProduct.digitalFiles.length > 0
            ) {
              // 泥?踰덉㎏ ?붿????뚯씪???ㅼ슫濡쒕뱶 留곹겕濡??쒓났
              const downloadUrl = digitalProduct.digitalFiles[0];

              console.log(
                "?붿????곹뭹 媛먯?, ?먮룞 ?ㅼ슫濡쒕뱶 留곹겕 ?쒓났:",
                downloadUrl,
              );

              // ?먮룞?쇰줈 諛곗넚 ?뺣낫 ?낅뜲?댄듃 (?ㅼ슫濡쒕뱶 留곹겕)
              await storage.updateOrderShipping(
                order.id,
                downloadUrl,
                "吏곸젒 ?ㅼ슫濡쒕뱶",
              );
            }
          }
        } catch (digitalProductError) {
          console.error(
            "?붿????곹뭹 泥섎━ ?ㅻ쪟 (二쇰Ц? ?앹꽦??:",
            digitalProductError,
          );
        }
      }

      res.status(201).json(order);
    } catch (error) {
      console.error("二쇰Ц ?앹꽦 ?ㅻ쪟:", error);
      res
        .status(500)
        .json({ error: "二쇰Ц ?앹꽦???ㅽ뙣?덉뒿?덈떎.", details: error.message });
    }
  });

  // ==================== ?뚮┝ 愿由?API ====================

  // 愿由ъ옄 ?뚮┝ 紐⑸줉 議고쉶
  app.get("/api/notifications/admin", async (req, res) => {
    try {
      const notifications = await storage.getAdminNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("?뚮┝ 紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?뚮┝ 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?뚮┝ ?쎌쓬 泥섎━
  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;

      const updatedNotification = await storage.markAdminNotificationAsRead(id);

      if (!updatedNotification) {
        return res.status(404).json({ error: "?뚮┝??李얠쓣 ???놁뒿?덈떎" });
      }

      res.json(updatedNotification);
    } catch (error) {
      console.error("?뚮┝ ?쎌쓬 泥섎━ ?ㅻ쪟:", error);
      res.status(400).json({ error: "?뚮┝ ?쎌쓬 泥섎━???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ==================== ?먮ℓ??耳??留ㅻ땲?) API ====================

  // ?먮ℓ??二쇰Ц 紐⑸줉 議고쉶
  app.get("/api/orders/seller/:sellerId", async (req, res) => {
    try {
      const { sellerId } = req.params;

      // ?ㅼ젣 援ы쁽?먯꽌???몄쬆 ?뺤씤 ?꾩슂
      // const user = await verifyAuthToken(req);
      // if (user.uid !== sellerId && user.userType !== 'admin') return res.status(403).json({ error: "沅뚰븳???놁뒿?덈떎" });

      // ?꾩떆 ?붾? ?곗씠??諛섑솚 (?ㅼ젣 援ы쁽 ??DB?먯꽌 議고쉶)
      const orders = [
        {
          id: "ORD-001",
          createdAt: new Date().toISOString(),
          customer_name: "源?곹씗",
          customer_phone: "010-1234-5678",
          orderItems: [
            { product: { title: "?뚰겕?? }, quantity: 2, price: 15000 },
          ],
          total_amount: 30000,
          payment_method: "移대뱶寃곗젣",
          order_status: "pending",
          shipping_address: {
            name: "源?곹씗",
            phone: "010-1234-5678",
            address: "?쒖슱??媛뺣궓援??뚰뿤?濡?123",
          },
          tracking_number: "",
          shipping_company: "",
          seller_id: sellerId,
        },
        {
          id: "ORD-002",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          customer_name: "諛뺤쿋??,
          customer_phone: "010-9876-5432",
          orderItems: [
            { product: { title: "?ъ퓼?? }, quantity: 1, price: 25000 },
          ],
          total_amount: 25000,
          payment_method: "臾댄넻?μ엯湲?,
          order_status: "shipped",
          shipping_address: {
            name: "諛뺤쿋??,
            phone: "010-9876-5432",
            address: "遺?곗떆 ?댁슫?援??쇳?以묒븰濡?456",
          },
          tracking_number: "123456789",
          shipping_company: "CJ??쒗넻??,
          seller_id: sellerId,
        },
      ];

      res.json(orders);
    } catch (error) {
      console.error("?먮ℓ??二쇰Ц 紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "二쇰Ц 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?먮ℓ???뚮┝ 紐⑸줉 議고쉶
  app.get("/api/notifications/seller/:sellerId", async (req, res) => {
    try {
      const { sellerId } = req.params;

      // ?ㅼ젣 援ы쁽?먯꽌???몄쬆 ?뺤씤 ?꾩슂
      // const user = await verifyAuthToken(req);
      // if (user.uid !== sellerId && user.userType !== 'admin') return res.status(403).json({ error: "沅뚰븳???놁뒿?덈떎" });

      // ?곗씠?곕쿋?댁뒪?먯꽌 ?먮ℓ???뚮┝ 議고쉶
      const notifications = await storage.getSellerNotifications(sellerId);

      res.json(notifications);
    } catch (error) {
      console.error("?먮ℓ???뚮┝ 紐⑸줉 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?뚮┝ 紐⑸줉??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?먮ℓ???뚮┝ ?쎌쓬 泥섎━
  app.put(
    "/api/notifications/seller/:notificationId/read",
    async (req, res) => {
      try {
        const { notificationId } = req.params;

        const updated = await storage.markSellerNotificationAsRead(
          parseInt(notificationId),
        );

        if (!updated) {
          return res.status(404).json({ error: "?뚮┝??李얠쓣 ???놁뒿?덈떎" });
        }

        res.json(updated);
      } catch (error) {
        console.error("?뚮┝ ?쎌쓬 泥섎━ ?ㅻ쪟:", error);
        res.status(500).json({ error: "?뚮┝ 泥섎━???ㅽ뙣?덉뒿?덈떎" });
      }
    },
  );

  // ==================== ?곹뭹 由щ럭 諛?臾몄쓽 API ====================

  // ?곹뭹 由щ럭 紐⑸줉 議고쉶
  app.get("/api/products/:productId/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?곹뭹 ID?낅땲??" });
      }

      const reviews = await storage.getProductReviews(productId);

      // 由щ럭? ?④퍡 ?묒꽦???뺣낫 媛?몄삤湲?      const reviewsWithUser = await Promise.all(
        reviews.map(async (review) => {
          try {
            const user = await storage.getUser(review.userId);
            return {
              ...review,
              username: user?.name || "?????놁쓬",
              display_name: user?.name || "?????놁쓬",
            };
          } catch (error) {
            return {
              ...review,
              username: "?????놁쓬",
              display_name: "?????놁쓬",
            };
          }
        }),
      );

      res.json(reviewsWithUser);
    } catch (error) {
      console.error("?곹뭹 由щ럭 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?곹뭹 由щ럭瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎." });
    }
  });

  // ?ъ슜???곹뭹 援щℓ ?щ? ?뺤씤 (由щ럭 ?묒꽦 ?먭꺽 ?뺤씤)
  app.get(
    "/api/users/:userId/purchases/verify/:productId",
    async (req, res) => {
      try {
        const userId = parseInt(req.params.userId);
        const productId = parseInt(req.params.productId);

        if (isNaN(userId) || isNaN(productId)) {
          return res
            .status(400)
            .json({ error: "?좏슚?섏? ?딆? ?ъ슜??ID ?먮뒗 ?곹뭹 ID?낅땲??" });
        }

        // ?ㅼ젣 援ы쁽?먯꽌???ъ슜???몄쬆???꾩슂
        // const user = await verifyAuthToken(req);
        // if (user.id !== userId) return res.status(403).json({ error: "沅뚰븳???놁뒿?덈떎." });

        // ?ъ슜?먯쓽 ?대떦 ?곹뭹 援щℓ ?щ? ?뺤씤
        const hasPurchased = await storage.checkUserPurchase(userId, productId);

        // 媛쒕컻???꾩떆 肄붾뱶 (??긽 援щℓ??寃껋쑝濡?泥섎━)
        // ?ㅼ젣 ?댁쁺?먯꽌???쒓굅 ?꾩슂
        const verified = true; // hasPurchased;

        res.json({ verified });
      } catch (error) {
        console.error("援щℓ ?뺤씤 ?ㅻ쪟:", error);
        res.status(500).json({ error: "援щℓ ?щ? ?뺤씤???ㅽ뙣?덉뒿?덈떎." });
      }
    },
  );

  // ?ъ슜??援щℓ ?댁뿭 議고쉶 (由щ럭 ?묒꽦 媛?ν븳 ?곹뭹 ?뺤씤)
  app.get("/api/users/:userId/purchases", async (req, res) => {
    try {
      const userId = req.params.userId; // 臾몄옄???뺥깭濡?諛쏆쓬

      if (!userId) {
        return res
          .status(400)
          .json({ error: "?좏슚?섏? ?딆? ?ъ슜??ID?낅땲??" });
      }

      // ?ㅼ젣 援ы쁽?먯꽌???ъ슜???몄쬆???꾩슂
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "沅뚰븳???놁뒿?덈떎." });

      // 媛쒕컻???꾩떆 肄붾뱶 (??긽 紐⑤뱺 ?곹뭹??援щℓ??寃껋쑝濡?泥섎━)
      // ?ㅼ젣 援ы쁽?먯꽌??二쇱꽍 ?댁젣?섏뿬 ?ㅼ젣 援щℓ ?댁뿭??議고쉶
      // const orderItems = await storage.getUserOrderItems(userId);

      const products = await storage.getAllProducts();
      const purchases = products.map((product) => ({
        productId: product.id,
        product_id: product.id, // ?명솚?깆쓣 ?꾪빐 ???뺥깭 紐⑤몢 ?쒓났
        title: product.title,
        purchaseDate: new Date().toISOString(),
        orderId: "temp-order-" + Math.floor(Math.random() * 1000),
      }));

      res.json(purchases);
    } catch (error) {
      console.error("援щℓ ?댁뿭 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "援щℓ ?댁뿭??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎." });
    }
  });

  // 由щ럭 ?묒꽦 API
  app.post("/api/products/:productId/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const { userId, rating, comment } = req.body;

      if (isNaN(productId) || !userId || !rating || !comment) {
        return res.status(400).json({ error: "?꾩닔 ?낅젰媛믪씠 ?꾨씫?섏뿀?듬땲??" });
      }

      // ?ㅼ젣 援ы쁽?먯꽌???ъ슜???몄쬆???꾩슂
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "沅뚰븳???놁뒿?덈떎." });

      // ?ъ슜?먯쓽 ?대떦 ?곹뭹 援щℓ ?щ? ?뺤씤
      // 媛쒕컻?⑹쑝濡???긽 true 諛섑솚?섎룄濡??ㅼ젙?섏뼱 ?덉쓬
      const hasPurchased = await storage.checkUserPurchase(
        parseInt(userId),
        productId,
      );

      const newReview = await storage.createProductReview({
        userId: parseInt(userId),
        productId,
        rating: parseInt(rating),
        comment,
        isVerifiedPurchase: true, // ??긽 援щℓ ?뺤씤?쇰줈 ?쒖떆 (?ㅼ젣?먯꽌??hasPurchased ?ъ슜)
        status: "active",
      });

      // ?곹뭹???됱젏 ?낅뜲?댄듃
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
        username: user?.name || "?????놁쓬",
        display_name: user?.name || "?????놁쓬",
      });
    } catch (error) {
      console.error("由щ럭 ?묒꽦 ?ㅻ쪟:", error);
      res.status(500).json({ error: "由щ럭 ?묒꽦???ㅽ뙣?덉뒿?덈떎." });
    }
  });

  // ?곹뭹 臾몄쓽 紐⑸줉 議고쉶
  app.get("/api/products/:productId/comments", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?곹뭹 ID?낅땲??" });
      }

      const comments = await storage.getProductComments(productId);

      // 臾몄쓽?ы빆 洹몃９??(遺紐?臾몄쓽? ?듬???
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

      // 臾몄쓽? ?④퍡 ?묒꽦???뺣낫 媛?몄삤湲?      const commentsWithUser = await Promise.all(
        groupedComments.map(async (comment) => {
          try {
            const user = await storage.getUser(comment.userId);

            // ?듦??먮룄 ?ъ슜???뺣낫 異붽?
            const repliesWithUser = await Promise.all(
              (comment.replies || []).map(async (reply) => {
                try {
                  const replyUser = await storage.getUser(reply.userId);
                  return {
                    ...reply,
                    username: replyUser?.name || "?????놁쓬",
                    display_name:
                      replyUser?.name ||
                      (reply.isAdmin ? "愿由ъ옄" : "?????놁쓬"),
                  };
                } catch (error) {
                  return {
                    ...reply,
                    username: "?????놁쓬",
                    display_name: reply.isAdmin ? "愿由ъ옄" : "?????놁쓬",
                  };
                }
              }),
            );

            return {
              ...comment,
              username: user?.name || "?????놁쓬",
              display_name: user?.name || "?????놁쓬",
              replies: repliesWithUser,
            };
          } catch (error) {
            return {
              ...comment,
              username: "?????놁쓬",
              display_name: "?????놁쓬",
              replies: comment.replies || [],
            };
          }
        }),
      );

      res.json(commentsWithUser);
    } catch (error) {
      console.error("?곹뭹 臾몄쓽 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?곹뭹 臾몄쓽瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎." });
    }
  });

  // 臾몄쓽 ?묒꽦 API
  app.post("/api/products/:productId/comments", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const { userId, content, isPrivate } = req.body;

      if (isNaN(productId) || !userId || !content) {
        return res.status(400).json({ error: "?꾩닔 ?낅젰媛믪씠 ?꾨씫?섏뿀?듬땲??" });
      }

      // ?ㅼ젣 援ы쁽?먯꽌???ъ슜???몄쬆???꾩슂
      // const user = await verifyAuthToken(req);
      // if (user.id !== userId) return res.status(403).json({ error: "沅뚰븳???놁뒿?덈떎." });

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
        username: user?.name || "?????놁쓬",
        display_name: user?.name || "?????놁쓬",
        replies: [],
      });
    } catch (error) {
      console.error("臾몄쓽 ?묒꽦 ?ㅻ쪟:", error);
      res.status(500).json({ error: "臾몄쓽 ?묒꽦???ㅽ뙣?덉뒿?덈떎." });
    }
  });

  // 臾몄쓽 ?듦? ?묒꽦 API
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
            .json({ error: "?꾩닔 ?낅젰媛믪씠 ?꾨씫?섏뿀?듬땲??" });
        }

        // ?먮낯 臾몄쓽 ?뺤씤
        const parentComment = (
          await storage.getProductComments(productId)
        ).find((comment) => comment.id === commentId);

        if (!parentComment) {
          return res
            .status(404)
            .json({ error: "?먮낯 臾몄쓽瑜?李얠쓣 ???놁뒿?덈떎." });
        }

        // ?ㅼ젣 援ы쁽?먯꽌???ъ슜???몄쬆怨?愿由ъ옄 ?щ? ?뺤씤
        // const user = await verifyAuthToken(req);
        // if (user.id !== userId) return res.status(403).json({ error: "沅뚰븳???놁뒿?덈떎." });
        // const isAdmin = user.userType === 'admin';

        // 媛쒕컻???꾩떆 肄붾뱶 - ?ъ슜???대찓?쇱뿉 'admin'???ы븿?섎㈃ 愿由ъ옄濡?媛꾩＜
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

        // ?먮낯 臾몄쓽???곹깭瑜?'?듬? ?꾨즺'濡?蹂寃?        if (isAdmin) {
          await storage.updateProductComment(commentId, { status: "answered" });
        }

        res.status(201).json({
          ...newReply,
          username: user?.name || "?????놁쓬",
          display_name: isAdmin ? "愿由ъ옄" : user?.name || "?????놁쓬",
        });
      } catch (error) {
        console.error("?듦? ?묒꽦 ?ㅻ쪟:", error);
        res.status(500).json({ error: "?듦? ?묒꽦???ㅽ뙣?덉뒿?덈떎." });
      }
    },
  );

  // ?щ━?먯씠?곗냼媛쒓? 肄섑뀗痢?API
  app.post("/api/caremanager/:id/intro-contents", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { introContents } = req.body;

      if (!introContents || !Array.isArray(introContents)) {
        return res
          .status(400)
          .json({ error: "?щ컮瑜??뚭컻湲 肄섑뀗痢??뺤떇???꾨떃?덈떎." });
      }

      // 湲곗〈 ?щ━?먯씠?고솗??      const careManager = await storage.getCareManager(id);
      if (!careManager) {
        return res
          .status(404)
          .json({ error: "耳??留ㅻ땲?瑜?李얠쓣 ???놁뒿?덈떎." });
      }

      // ?뚭컻湲 肄섑뀗痢????      await storage.updateCareManagerIntroContents(id, introContents);

      res.json({
        success: true,
        message: "?뚭컻湲 肄섑뀗痢좉? ?깃났?곸쑝濡???λ릺?덉뒿?덈떎.",
      });
    } catch (error) {
      console.error("?뚭컻湲 肄섑뀗痢?????ㅻ쪟:", error);
      res.status(500).json({
        error: "?뚭컻湲 肄섑뀗痢????以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
      });
    }
  });

  // ?щ━?먯씠?곗냼媛쒓? 肄섑뀗痢?議고쉶 API (uid 吏??
  app.get("/api/caremanager/:id/intro-contents", async (req, res) => {
    try {
      const idParam = req.params.id;
      let careManagerId: number | undefined;

      // uid?몄? ?レ옄 ID?몄? ?뺤씤
      if (isNaN(parseInt(idParam))) {
        // uid濡?耳?대ℓ?덉? 李얘린
        const allManagers = await storage.getAllCareManagers();
        const manager = allManagers.find((m) => (m as any).uid === idParam);
        if (!manager) {
          return res
            .status(404)
            .json({ error: "耳??留ㅻ땲?瑜?李얠쓣 ???놁뒿?덈떎." });
        }
        careManagerId = manager.id;
      } else {
        careManagerId = parseInt(idParam);
      }

      // ?щ━?먯씠?고솗??      const careManager = await storage.getCareManager(careManagerId);
      if (!careManager) {
        return res
          .status(404)
          .json({ error: "耳??留ㅻ땲?瑜?李얠쓣 ???놁뒿?덈떎." });
      }

      // ?뚭컻湲 肄섑뀗痢?議고쉶
      const introContents =
        await storage.getCareManagerIntroContents(careManagerId);

      res.json({
        success: true,
        introContents: introContents || [],
      });
    } catch (error) {
      console.error("?뚭컻湲 肄섑뀗痢?議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({
        error: "?뚭컻湲 肄섑뀗痢?議고쉶 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
      });
    }
  });

  // ?쒕퉬???⑦궎吏 ???API
  app.post("/api/caremanager/:id/service-packages", async (req, res) => {
    try {
      const idParam = req.params.id;
      const { packages } = req.body;
      let careManagerId: number | undefined;

      if (!packages || !Array.isArray(packages)) {
        return res
          .status(400)
          .json({ error: "?щ컮瑜??⑦궎吏 ?뺤떇???꾨떃?덈떎." });
      }

      // uid?몄? ?レ옄 ID?몄? ?뺤씤
      if (isNaN(parseInt(idParam))) {
        const allManagers = await storage.getAllCareManagers();
        const manager = allManagers.find((m) => (m as any).uid === idParam);
        if (!manager) {
          return res
            .status(404)
            .json({ error: "耳??留ㅻ땲?瑜?李얠쓣 ???놁뒿?덈떎." });
        }
        careManagerId = manager.id;
      } else {
        careManagerId = parseInt(idParam);
      }

      // 耳?대ℓ?덉? ?뺤씤
      const careManager = await storage.getCareManager(careManagerId);
      if (!careManager) {
        return res
          .status(404)
          .json({ error: "耳??留ㅻ땲?瑜?李얠쓣 ???놁뒿?덈떎." });
      }

      // ?쒕퉬???⑦궎吏 ???      const success = await storage.updateCareManagerServicePackages(
        careManagerId,
        packages,
      );

      if (success) {
        res.json({
          success: true,
          message: "?쒕퉬???⑦궎吏媛 ??λ릺?덉뒿?덈떎.",
        });
      } else {
        res.status(500).json({ error: "?쒕퉬???⑦궎吏 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎." });
      }
    } catch (error) {
      console.error("?쒕퉬???⑦궎吏 ????ㅻ쪟:", error);
      res.status(500).json({
        error: "?쒕퉬???⑦궎吏 ???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
      });
    }
  });

  // ?쒕퉬???⑦궎吏 議고쉶 API
  app.get("/api/caremanager/:id/service-packages", async (req, res) => {
    try {
      const idParam = req.params.id;
      let careManagerId: number | undefined;

      // uid?몄? ?レ옄 ID?몄? ?뺤씤
      if (isNaN(parseInt(idParam))) {
        const allManagers = await storage.getAllCareManagers();
        const manager = allManagers.find((m) => (m as any).uid === idParam);
        if (!manager) {
          return res
            .status(404)
            .json({ error: "耳??留ㅻ땲?瑜?李얠쓣 ???놁뒿?덈떎." });
        }
        careManagerId = manager.id;
      } else {
        careManagerId = parseInt(idParam);
      }

      // 耳?대ℓ?덉? ?뺤씤
      const careManager = await storage.getCareManager(careManagerId);
      if (!careManager) {
        return res
          .status(404)
          .json({ error: "耳??留ㅻ땲?瑜?李얠쓣 ???놁뒿?덈떎." });
      }

      // ?쒕퉬???⑦궎吏 議고쉶
      const packages =
        await storage.getCareManagerServicePackages(careManagerId);

      res.json({
        success: true,
        packages: packages || [],
      });
    } catch (error) {
      console.error("?쒕퉬???⑦궎吏 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({
        error: "?쒕퉬???⑦궎吏 議고쉶 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
      });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎" });
      }
      res.json(user);
    } catch (error) {
      console.error("?ъ슜???뺣낫 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?ъ슜???뺣낫瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?ъ슜???몄쬆 ?곹깭 議고쉶 API
  app.get("/api/users/:id/certification", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎" });
      }

      res.json({
        isCertified: user.isCertified || false,
        certificationDate: user.certificationDate || null,
        certificationPaymentId: user.certificationPaymentId || null,
      });
    } catch (error) {
      console.error("?몄쬆 ?곹깭 議고쉶 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?몄쬆 ?곹깭瑜?議고쉶?섎뒗???ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ?ъ슜???몄쬆 ?쒖꽦??API
  app.post("/api/users/:id/certification", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { paymentId } = req.body;

      if (!paymentId) {
        return res.status(400).json({ error: "寃곗젣 ID媛 ?꾩슂?⑸땲?? });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎" });
      }

      // ?몄쬆 ?쒖꽦??泥섎━
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
        message: "?몄쬆???깃났?곸쑝濡??쒖꽦?붾릺?덉뒿?덈떎",
        isCertified: true,
        certificationDate: new Date(),
        certificationPaymentId: paymentId,
      });
    } catch (error) {
      console.error("?몄쬆 ?쒖꽦???ㅻ쪟:", error);
      res.status(500).json({ error: "?몄쬆 ?쒖꽦?붿뿉 ?ㅽ뙣?덉뒿?덈떎" });
    }
  });

  // ==================== ?λ컮援щ땲 API ====================
  app.get("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "?ъ슜??ID媛 ?꾩슂?⑸땲??" });
      }

      console.log(`[SERVER] Firebase UID ${userId}???λ컮援щ땲 議고쉶 ?붿껌`);

      // Firebase UID瑜?洹몃?濡??ъ슜?섏뿬 ?λ컮援щ땲 議고쉶
      const items = await storage.getCartItemsByFirebaseId(userId);

      // 媛??꾩씠?쒖뿉 ?곹뭹 ?뺣낫 ?⑹퀜??諛섑솚
      const enriched = await Promise.all(
        items.map(async (item: any) => {
          const product = await storage.getProduct(item.productId);
          return { ...item, product };
        }),
      );

      return res.status(200).json({ cartItems: enriched });
    } catch (error) {
      console.error("?λ컮援щ땲 議고쉶 ?ㅻ쪟:", error);
      return res
        .status(500)
        .json({ error: "?λ컮援щ땲 議고쉶 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." });
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
        return res.status(400).json({ error: "?꾩닔 ?낅젰媛믪씠 ?꾨씫?섏뿀?듬땲??" });
      }

      const pid = parseInt(productId as any);
      const qty = Math.max(1, Number(quantity || 1));

      console.log(
        `[SERVER] Firebase UID ${userId}???λ컮援щ땲???곹뭹 ${pid} 異붽? ?붿껌`,
      );

      // ?숈씪 ?듭뀡 ?곹뭹 議댁옱 ???섎웾留?利앷?
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

      // Firebase UID瑜??ъ슜?섏뿬 ???꾩씠??異붽?
      const inserted = await storage.addCartItemByFirebaseId(
        userId,
        pid,
        qty,
        selected_options ?? null,
      );
      const product = await storage.getProduct(pid);
      res.status(201).json({ ...inserted, product });
    } catch (error) {
      console.error("?λ컮援щ땲 異붽? ?ㅻ쪟:", error);
      res.status(500).json({ error: "?λ컮援щ땲 異붽????ㅽ뙣?덉뒿?덈떎." });
    }
  });

  app.put("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const itemId = parseInt(req.params.itemId);
      const { quantity } = req.body as { quantity?: number };
      if (isNaN(userId) || isNaN(itemId))
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?붿껌?낅땲??" });
      if (quantity == null || Number(quantity) < 1)
        return res.status(400).json({ error: "?섎웾? 1 ?댁긽?댁뼱???⑸땲??" });

      console.log(
        `[SERVER] ?ъ슜??${userId}???λ컮援щ땲 ?곹뭹 ${itemId} ?섏젙 ?붿껌`,
      );

      const updated = await storage.updateCartItem(itemId, {
        quantity: Number(quantity),
      });
      if (!updated)
        return res
          .status(404)
          .json({ error: "?λ컮援щ땲 ??ぉ??李얠쓣 ???놁뒿?덈떎." });
      res.json(updated);
    } catch (error) {
      console.error("?λ컮援щ땲 ?낅뜲?댄듃 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?λ컮援щ땲 ?낅뜲?댄듃???ㅽ뙣?덉뒿?덈떎." });
    }
  });

  app.delete("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(userId) || isNaN(itemId))
        return res.status(400).json({ error: "?좏슚?섏? ?딆? ?붿껌?낅땲??" });

      console.log(
        `[SERVER] ?ъ슜??${userId}???λ컮援щ땲?먯꽌 ?곹뭹 ${itemId} ??젣 ?붿껌`,
      );

      const ok = await storage.removeCartItem(itemId);
      if (!ok)
        return res
          .status(404)
          .json({ error: "?λ컮援щ땲 ??ぉ??李얠쓣 ???놁뒿?덈떎." });
      res.json({ success: true });
    } catch (error) {
      console.error("?λ컮援щ땲 ??젣 ?ㅻ쪟:", error);
      res.status(500).json({ error: "?λ컮援щ땲 ??젣???ㅽ뙣?덉뒿?덈떎." });
    }
  });

  app.delete("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "?ъ슜??ID媛 ?꾩슂?⑸땲??" });
      }

      console.log(`[SERVER] Firebase UID ${userId}???λ컮援щ땲 鍮꾩슦湲??붿껌`);

      // Firebase UID瑜??ъ슜?섏뿬 ?λ컮援щ땲 鍮꾩슦湲?      const success = await storage.clearCartByFirebaseId(userId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "?λ컮援щ땲 鍮꾩슦湲곗뿉 ?ㅽ뙣?덉뒿?덈떎." });
      }
    } catch (error) {
      console.error("?λ컮援щ땲 鍮꾩슦湲??ㅻ쪟:", error);
      res.status(500).json({ error: "?λ컮援щ땲 鍮꾩슦湲곗뿉 ?ㅽ뙣?덉뒿?덈떎." });
    }
  });

  // ?λ컮援щ땲 ?곹뭹 ?섏젙
  app.put("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const { userId, itemId } = req.params;
      const { quantity, selected_options } = req.body;

      if (!userId || !itemId) {
        return res
          .status(400)
          .json({ error: "?ъ슜??ID? ?곹뭹 ID媛 ?꾩슂?⑸땲??" });
      }

      console.log(
        `[SERVER] ?ъ슜??${userId}???λ컮援щ땲 ?곹뭹 ${itemId} ?섏젙 ?붿껌`,
      );

      // 硫붾え由?湲곕컲 ?λ컮援щ땲 ?곗씠??(?ㅼ젣濡쒕뒗 DB?먯꽌 ?섏젙?댁빞 ??
      const cartItem = {
        id: itemId,
        userId,
        quantity: quantity || 1,
        selected_options: selected_options || null,
        updatedAt: new Date(),
      };

      return res.status(200).json(cartItem);
    } catch (error) {
      console.error("?λ컮援щ땲 ?곹뭹 ?섏젙 ?ㅻ쪟:", error);
      return res
        .status(500)
        .json({ error: "?λ컮援щ땲 ?곹뭹???섏젙?섎뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." });
    }
  });

  // ?λ컮援щ땲 ?곹뭹 ??젣
  app.delete("/api/users/:userId/cart/:itemId", async (req, res) => {
    try {
      const { userId, itemId } = req.params;

      if (!userId || !itemId) {
        return res
          .status(400)
          .json({ error: "?ъ슜??ID? ?곹뭹 ID媛 ?꾩슂?⑸땲??" });
      }

      console.log(
        `[SERVER] ?ъ슜??${userId}???λ컮援щ땲?먯꽌 ?곹뭹 ${itemId} ??젣 ?붿껌`,
      );

      // 硫붾え由?湲곕컲 ?λ컮援щ땲 ?곗씠??(?ㅼ젣濡쒕뒗 DB?먯꽌 ??젣?댁빞 ??

      return res.status(200).json({
        success: true,
        message: "?곹뭹???λ컮援щ땲?먯꽌 ??젣?섏뿀?듬땲??",
      });
    } catch (error) {
      console.error("?λ컮援щ땲 ?곹뭹 ??젣 ?ㅻ쪟:", error);
      return res.status(500).json({
        error: "?λ컮援щ땲?먯꽌 ?곹뭹????젣?섎뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
      });
    }
  });

  // ?λ컮援щ땲 鍮꾩슦湲?  app.delete("/api/users/:userId/cart", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "?ъ슜??ID媛 ?꾩슂?⑸땲??" });
      }

      console.log(`[SERVER] ?ъ슜??${userId}???λ컮援щ땲 鍮꾩슦湲??붿껌`);

      // 硫붾え由?湲곕컲 ?λ컮援щ땲 ?곗씠??(?ㅼ젣濡쒕뒗 DB?먯꽌 ??젣?댁빞 ??

      return res
        .status(200)
        .json({ success: true, message: "?λ컮援щ땲媛 鍮꾩썙議뚯뒿?덈떎." });
    } catch (error) {
      console.error("?λ컮援щ땲 鍮꾩슦湲??ㅻ쪟:", error);
      return res
        .status(500)
        .json({ error: "?λ컮援щ땲瑜?鍮꾩슦??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." });
    }
  });

  // ?뚯꽦 ?몄떇 API ?붾뱶?ъ씤??(Gemini 湲곕컲)
  app.post("/api/speech/transcribe", multer().single('audio'), async (req, res) => {
    try {
      console.log("?렎 ?뚯꽦 ?몄떇 ?붿껌 諛쏆쓬");

      // ?대씪?댁뼵?멸? FormData濡??④퍡 ?꾩넚??Gemini API ??      const geminiApiKey = (req.body?.geminiApiKey as string) || "";

      if (!geminiApiKey) {
        return res.status(400).json({
          error: "Gemini API ?ㅺ? ?꾩슂?⑸땲?? ?꾨컮? 媛쒖꽦 ?ㅼ젙?먯꽌 Gemini API ?ㅻ? ?낅젰?댁＜?몄슂."
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: "?ㅻ뵒???뚯씪???꾩슂?⑸땲??" });
      }

      const { GeminiSpeechService } = await import("./speech/openai-whisper.js");
      const speechService = new GeminiSpeechService(geminiApiKey);

      const audioFile = req.file;
      const filename = audioFile.originalname || "audio.webm";

      console.log(`?렒 Gemini ?뚯꽦 ?몄떇 ?쒖옉: ${filename} (${audioFile.size} bytes)`);

      const transcription = await speechService.transcribeBuffer(audioFile.buffer, filename);

      console.log(`???뚯꽦 ?몄떇 ?꾨즺: "${transcription}"`);

      res.json({
        success: true,
        text: transcription,
        transcription: transcription,
        filename: filename
      });

    } catch (error) {
      console.error("???뚯꽦 ?몄떇 ?ㅻ쪟:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "?뚯꽦 ?몄떇 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}