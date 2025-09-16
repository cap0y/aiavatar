import admin from "firebase-admin";

// 서비스 계정 키 – 실제 서비스에서는 환경 변수로 주입 권장
const serviceAccount = {
  "type": "service_account",
  "project_id": "carelink-e3811",
  "private_key_id": "fb0852ee10254983f00f0fee0671bb1f1f52a897",
  "private_key": `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDI4CIXqMz3EM6M\nRv0Abig2A5xsgn/zhVbXPzpaGnxUmTOrJLgX3vhtKbv2XTWNguOD87HPRrWBMCGI\nC6RVAHfLGq7mIKtqAKR5s8kSsoSgjJyD4qFMmsETUTTUCoMiD3P1cPFDtRyJ04ZV\nab9SvmIhLN6K8ymofJHi5FbyW1aIxhK4KOGD08lV8001gMCuJ8OVRlIHx08IuXl6\nSDOco6nTBd1bXZowIVppmzwF02c1EG0AXG2WtI81TJTxuh84wI1DzFDaLa54gtDl\nHIhcradz43VekeEepMz2Rl/A8hkLQsjxnwuF2Oq5pNBtMq0+6X/DKJBV5RDXkvAj\n8yVYXjbNAgMBAAECggEALDVRo3nZpA09m9c6spfLvzlzuVjOHpLLniMS7UYTc03l\nNmbmIhDHBUVQUePJF6wE9OMS0J6L7xLf6lA/mhp4gslMUSbC+tkJ2aP03mnN8QSJ\nJKhhndmYIO94DCuFGR+kAlIZMvC+x2F3WMBlZCk0sP7uOk/SLPu/YpskvIFYDdD/\n9OZ9+u99KtXEn+qdzAdv6D6aqp+sUyOymo9MrEWfqAUMOdT/CONrLkj9TLUZ3Jcz\nf72RgSkiKieNDCIVFuwLl+GE9jXzy1oV6y8EuXTVT3FPVashs3ZbrW+AT0qDsCKd\nUOObnUO/Rvujz5lpJSG3maQTMH6SoyOT++DxjwBUCQKBgQDml9T4Xm04xb9jX499\nhn6y53Wawfb7f0rnakbXbqr7CP/3hvY2glveO+NSxWT4w+w1HxD5q7nsjmWJA7/z\n3MJFgbB/Y44Lkumf16fU4VRna3Rxl4uyonGNO6s7Hm1d3UopoBZoqoON1v3i5fGR\nJT5h4eDZumzxGUJ6IIWXugDHhQKBgQDfAhRqVZgwfYyzHcg7P+JBAtMS3O2eIqIP\nlYwGf7Wwow9if0nYCQL4ouCYVZp4XoM9tQ3JuxbnaC2AqYwxHm2Vs0uGtXhluTtv\nmsQ/9k387pNTFLVNGKYVUQ7GNpSQUljZnYuypHbpkLOPXE5wgELC1qHJ5jy4REfl\nFW5oATiAqQKBgDC4jdf4Y41mQrzlWPUFsMluHCwZpWyYBaSFkPg9usSVrzeGfYkg\n2/ZFow8/A8mH4+WJbdXC0eLIZ22erDUDRMzYzQjtaPrLDK+oKh7RiTrculqx0WNp\n7SIRJGm2URdPBTdsSq/Mr0UN0tDZEsQ/IUIfLpnySMhcNO6G5pMbSsTdAoGBALaN\nbUjeaIbJP7QgXRijYwL03PREBf+9OgynzshDIuhFkwJ+UGSYe+Ys7s3ExX5jX+vT\nmkXY8RbdIOKB6FENJ4e0Dc9oHfanexARETWK2qyCX/dSrFdAJjSs9fssEtFRl4oM\nfZ7vIqhv240vcsaFOCFmsWolHu94daIBuS9KUIaBAoGAEwO6SascrvNZRyMu1eVk\nN2hPRn5lA1nSuH6OvWxKv8keyEvkmgux2Vvh7gFU2hLvcOhmlwx6A4h/LuzE/euy\nmhgIIbGMYlfRK5DbkscvBDilRHYlHYJI3cd7rSnRqkwyCiLiXJi3AqNZeyuZmgv2\nuo/5FzfmJfM/n1nLijFM+Lg=\n-----END PRIVATE KEY-----\n`,
  "client_email": "firebase-adminsdk-fbsvc@carelink-e3811.iam.gserviceaccount.com",
  "client_id": "111144446741854848970",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40carelink-e3811.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
} as admin.ServiceAccount;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const adminAuth = admin.auth(); 