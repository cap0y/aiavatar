import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdateAvailable, setShowUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      console.log("PWA가 설치되었습니다");
    };

    // 이벤트 리스너 등록
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Service Worker 업데이트 감지 (등록은 main.tsx에서 수행)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setShowUpdateAvailable(true);
      });
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("사용자가 PWA 설치를 수락했습니다");
    } else {
      console.log("사용자가 PWA 설치를 거부했습니다");
    }
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
  };

  const handleUpdateClick = () => {
    window.location.reload();
  };

  const shouldShowInstallPrompt = () => {
    if (!showInstallPrompt) return false;
    if (window.matchMedia("(display-mode: standalone)").matches) return false;
    return true;
  };

  if (!shouldShowInstallPrompt() && !showUpdateAvailable) return null;

  return (
    <>
      {/* PWA 설치 프롬프트 */}
      {shouldShowInstallPrompt() && (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 md:bottom-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                케어링크 앱 설치
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                더 빠른 접속과 오프라인 사용을 위해 앱을 설치하세요
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="bg-primary hover:bg-primary/90"
              >
                <Download className="w-4 h-4 mr-1" />
                설치
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismissInstall}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 수동 가이드는 제거 (간단 동작 유지) */}

      {/* 업데이트 알림 */}
      {showUpdateAvailable && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium">새 버전 사용 가능</h3>
              <p className="text-xs opacity-90 mt-1">
                새로운 기능과 개선사항이 포함된 업데이트가 있습니다
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleUpdateClick}
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                업데이트
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowUpdateAvailable(false)}
                className="text-white hover:bg-blue-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
