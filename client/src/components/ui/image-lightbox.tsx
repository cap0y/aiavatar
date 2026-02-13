import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * ImageLightbox 컴포넌트
 * 
 * 이미지 라이트박스 슬라이더 컴포넌트입니다.
 * - 이미지를 클릭하면 원본 크기로 모달에 표시
 * - 여러 이미지가 있는 경우 슬라이더로 탐색 가능
 * - 좌/우 화살표 키보드 단축키 지원
 * - 터치 스와이프 제스처 지원 (모바일)
 */

interface ImageLightboxProps {
  images: string[]; // 이미지 URL 배열
  initialIndex?: number; // 초기 표시할 이미지 인덱스
  isOpen: boolean; // 라이트박스 열림 상태
  onClose: () => void; // 닫기 콜백
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // 이미지 인덱스가 변경되면 currentIndex 업데이트
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  // 다음 이미지로 이동
  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  // 이전 이미지로 이동
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // 키보드 단축키 처리
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, images.length]);

  // 터치 스와이프 처리
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  // 이미지가 없으면 null 반환
  if (images.length === 0) return null;

  const currentImage = images[currentIndex];
  const isVideo = currentImage?.match(/\.(mp4|webm|mov)$/i);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-black/80 border-none [&>button]:hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative flex items-center justify-center w-full h-full group">
          {/* 닫기 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 right-6 z-50 text-white hover:bg-white/20 rounded-full w-12 h-12"
            onClick={onClose}
          >
            <i className="fas fa-times text-2xl"></i>
          </Button>

          {/* 블러 배경 - 확대된 이미지 배경 */}
          <div
            className="absolute inset-0 bg-cover bg-center blur-3xl opacity-50 pointer-events-none"
            style={{ backgroundImage: `url(${currentImage})` }}
          />

          {/* 좌측 그라디언트 배경 - 데스크톱만 */}
          {images.length > 1 && (
            <div className="hidden md:block absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none"></div>
          )}

          {/* 이전 버튼 - 데스크톱만 */}
          {images.length > 1 && (
            <button
              onClick={handlePrev}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/90 hover:bg-gray-700 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg"
              aria-label="이전 이미지"
            >
              <i className="fas fa-chevron-left text-xl"></i>
            </button>
          )}

          {/* 이미지/비디오 표시 - 일반 피드와 동일 */}
          <div className="relative w-full h-full flex items-center justify-center z-10 p-4">
            {isVideo ? (
              <video
                src={currentImage}
                controls
                autoPlay
                className="relative max-w-[90%] max-h-[85vh] object-contain"
              />
            ) : (
              <img
                src={currentImage}
                alt={`Image ${currentIndex + 1}`}
                className="relative max-w-[90%] max-h-[85vh] object-contain"
              />
            )}
          </div>

          {/* 우측 그라디언트 배경 - 데스크톱만 */}
          {images.length > 1 && (
            <div className="hidden md:block absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none"></div>
          )}

          {/* 다음 버튼 - 데스크톱만 */}
          {images.length > 1 && (
            <button
              onClick={handleNext}
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/90 hover:bg-gray-700 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg"
              aria-label="다음 이미지"
            >
              <i className="fas fa-chevron-right text-xl"></i>
            </button>
          )}

          {/* 페이지네이션 인디케이터 (점 형태) - 하단 중앙, 일반 피드와 동일 */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex justify-center gap-1.5 z-50">
              {images.map((_, idx) => {
                const isActive = currentIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-white w-6' 
                        : 'bg-white/60 hover:bg-white/90'
                    }`}
                    aria-label={`이미지 ${idx + 1}로 이동`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

