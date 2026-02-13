import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// PWA: 서비스 워커 등록
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("✅ Service Worker 등록 성공:", registration.scope);
        
        // PWA 설치 가능 여부 확인
        setTimeout(() => {
          console.log("🔍 PWA 설치 조건 확인:");
          console.log("- Service Worker:", "serviceWorker" in navigator ? "✅" : "❌");
          console.log("- Manifest:", document.querySelector('link[rel="manifest"]') ? "✅" : "❌");
          console.log("- HTTPS:", location.protocol === 'https:' || location.hostname === 'localhost' ? "✅" : "❌");
          console.log("- 아이콘:", "확인 필요");
          
          // beforeinstallprompt 이벤트가 발생하지 않는 경우를 위한 디버깅
          if (!window.matchMedia('(display-mode: standalone)').matches) {
            console.log("💡 PWA 설치 팁: Chrome에서 주소창 우측의 설치 버튼을 확인해보세요.");
          }
        }, 2000);
      })
      .catch((err) => {
        console.error("❌ Service Worker 등록 실패:", err);
      });
  });
}
