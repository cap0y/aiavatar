// @ts-nocheck
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { auth } from "@/firebase";
// @ts-ignore
import { signInWithCustomToken } from "firebase/auth";

export default function KakaoCallback() {
  const [, setLocation] = useLocation();
  const { setShowAuthModal } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) {
        setLocation("/login");
        return;
      }

      const res = await fetch("/api/auth/kakao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        console.error("kakao auth failed");
        setLocation("/login");
        return;
      }
      const { token } = await res.json();
      await signInWithCustomToken(auth, token);
      setShowAuthModal(false);
      setLocation("/");
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