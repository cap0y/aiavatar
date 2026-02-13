import admin from "firebase-admin";

// Firebase 서비스 계정 키를 환경 변수에서 로드
// FIREBASE_SERVICE_ACCOUNT_KEY: JSON 문자열 (전체 서비스 계정 키)
// 또는 개별 환경 변수 사용
function getServiceAccount(): admin.ServiceAccount {
  // 방법 1: 전체 JSON 문자열이 환경 변수에 있는 경우
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as admin.ServiceAccount;
    } catch (e) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY JSON 파싱 실패:", e);
    }
  }

  // 방법 2: 개별 환경 변수에서 조합
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    return {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "",
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID || "",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || "",
      universe_domain: "googleapis.com"
    } as admin.ServiceAccount;
  }

  throw new Error(
    "Firebase 서비스 계정 키가 설정되지 않았습니다. " +
    "FIREBASE_SERVICE_ACCOUNT_KEY 또는 FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL 환경 변수를 설정하세요."
  );
}

try {
  if (!admin.apps.length) {
    const serviceAccount = getServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin 초기화 성공");
  }
} catch (error) {
  console.error("❌ Firebase Admin 초기화 실패:", error);
}

export const adminAuth = admin.apps.length ? admin.auth() : null as any;