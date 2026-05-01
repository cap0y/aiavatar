import admin from "firebase-admin";

let adminAuth: admin.auth.Auth | null = null;

try {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.warn("⚠️ Firebase Admin: 환경 변수 누락 (FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL). Firebase 기능 비활성화.");
  } else {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID || "aiavata",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: "googleapis.com",
    } as admin.ServiceAccount;

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    adminAuth = admin.auth();
    console.log("✅ Firebase Admin 초기화 완료");
  }
} catch (error) {
  console.error("❌ Firebase Admin 초기화 실패:", error);
}

export { adminAuth };
