// @ts-nocheck
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { auth } from "@/firebase";
// @ts-ignore
import { signInWithCustomToken } from "firebase/auth";

export default function KakaoCallback() {
  const [, setLocation] = useLocation();
  const { setShowAuthModal } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    // 중복 실행 방지 (HMR, StrictMode 대응)
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        
        console.log("🔑 카카오 콜백 처리 시작, code:", code ? "있음" : "없음");
        
        if (!code) {
          console.log("❌ 카카오 인증 코드 없음");
          setLocation("/login");
          return;
        }

        console.log("📡 서버에 카카오 로그인 요청 중...");
        const res = await fetch("/api/auth/kakao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          console.error("❌ 카카오 로그인 실패:", {
            status: res.status,
            statusText: res.statusText,
            error: errorData
          });
          alert(`카카오 로그인 실패: ${errorData.error || errorData.details || res.statusText}`);
          setLocation("/login");
          return;
        }
        
        const { token, user } = await res.json();
        console.log("✅ 카카오 로그인 성공:", user);
        
        console.log("🔥 Firebase 커스텀 토큰으로 로그인 중...");
        console.log("토큰 길이:", token?.length);
        console.log("토큰 앞부분:", token?.substring(0, 50) + "...");
        
        try {
          const userCredential = await signInWithCustomToken(auth, token);
          console.log("✅ Firebase 로그인 완료");
          
          // Firebase Auth 프로필 업데이트 (서버에서 받은 정보로)
          try {
            const { updateProfile } = await import("firebase/auth");
            if (user.displayName || user.photoURL) {
              await updateProfile(userCredential.user, {
                displayName: user.displayName || user.name,
                photoURL: user.photoURL
              });
              console.log("✅ Firebase Auth 프로필 업데이트 완료:", {
                displayName: user.displayName || user.name,
                photoURL: user.photoURL
              });
            }
          } catch (profileError) {
            console.warn("⚠️ Firebase Auth 프로필 업데이트 실패 (계속 진행):", profileError);
          }
          
          // Firestore에 사용자 정보 저장
          try {
            const { saveUserToFirestore } = await import("@/firebase");
            await saveUserToFirestore({
              uid: user.uid || user.id,
              email: user.email,
              displayName: user.displayName || user.name,
              photoURL: user.photoURL
            });
            console.log("✅ Firestore 사용자 정보 저장 완료");
          } catch (firestoreError) {
            console.warn("⚠️ Firestore 사용자 정보 저장 실패 (계속 진행):", firestoreError);
          }
          
          setShowAuthModal(false);
          setLocation("/");
        } catch (firebaseError: any) {
          console.error("❌ Firebase 로그인 실패:", {
            code: firebaseError.code,
            message: firebaseError.message,
            stack: firebaseError.stack
          });
          
          // Firebase 에러 코드별 처리
          if (firebaseError.code === 'auth/invalid-custom-token') {
            alert("카카오 로그인 실패: 유효하지 않은 인증 토큰입니다.");
          } else if (firebaseError.code === 'auth/custom-token-mismatch') {
            alert("카카오 로그인 실패: 인증 토큰이 프로젝트와 일치하지 않습니다.");
          } else {
            alert(`카카오 로그인 실패: ${firebaseError.message}`);
          }
          
          setLocation("/login");
        }
      } catch (error: any) {
        console.error("❌ 카카오 로그인 처리 중 오류:", error);
        alert("카카오 로그인 중 오류가 발생했습니다.");
        setLocation("/login");
      }
    };

    handleCallback();
  }, [setLocation, setShowAuthModal]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-4">카카오 로그인 처리 중...</span>
    </div>
  );
} 