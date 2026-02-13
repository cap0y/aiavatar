import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

const FeedCreatePage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 로그인 확인
  useEffect(() => {
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "포스트를 작성하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      setShowAuthModal(true);
      setLocation("/discord");
    }
  }, [user, setShowAuthModal, setLocation, toast]);

  // 미디어 파일 선택 핸들러
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "파일 크기는 50MB를 초과할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setMediaFile(file);
    
    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 게시물 작성 핸들러
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "제목 필요",
        description: "게시물 제목을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);
      
      if (mediaFile) {
        formData.append("media", mediaFile);
        formData.append("mediaType", mediaFile.type.startsWith("video") ? "video" : "image");
      }

      await axios.post("/api/feed/posts", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-User-ID": user?.uid || "",
        },
      });

      toast({
        title: "게시물 작성 완료",
        description: "게시물이 성공적으로 작성되었습니다.",
      });
      
      setLocation("/discord");
    } catch (error) {
      console.error("포스트 작성 실패:", error);
      toast({
        title: "작성 실패",
        description: "포스트 작성에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => setLocation("/discord")}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">새 게시물 작성</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* 제목 */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              제목 *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="게시물 제목을 입력하세요"
              className="bg-gray-700 border-gray-600 text-white"
              maxLength={200}
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              내용
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="게시물 내용을 입력하세요 (선택사항)"
              className="bg-gray-700 border-gray-600 text-white min-h-[120px]"
              maxLength={2000}
            />
          </div>

          {/* 미디어 업로드 */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              이미지 또는 동영상 (선택사항)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              최대 50MB, 지원 형식: JPG, PNG, GIF, MP4, MOV, WEBM
            </p>
            
            {/* 드래그 앤 드롭 영역 */}
            <div
              className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-700/50"
              onClick={() => document.getElementById("media-upload-page")?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-blue-500');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-500');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-500');
                const file = e.dataTransfer.files[0];
                if (file) {
                  const fakeEvent = {
                    target: { files: [file] }
                  } as any;
                  handleMediaSelect(fakeEvent);
                }
              }}
            >
              <i className="fas fa-cloud-upload-alt text-4xl text-gray-500 mb-3"></i>
              <p className="text-gray-400 mb-1">
                클릭하거나 파일을 드래그하여 업로드
              </p>
              <Button
                variant="outline"
                className="mt-2 border-gray-600 bg-gray-700 hover:bg-gray-600 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById("media-upload-page")?.click();
                }}
              >
                <i className="fas fa-image mr-2"></i>
                파일 선택
              </Button>
            </div>
            
            <input
              id="media-upload-page"
              type="file"
              accept="image/*,video/*"
              onChange={handleMediaSelect}
              className="hidden"
            />
            
            {mediaFile && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                <i className="fas fa-file-alt"></i>
                <span>{mediaFile.name}</span>
                <span className="text-gray-600">
                  ({(mediaFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            )}

            {/* 미디어 미리보기 */}
            {mediaPreview && (
              <div className="mt-3 relative">
                {mediaFile?.type.startsWith("video") ? (
                  <video
                    src={mediaPreview}
                    className="w-full max-h-80 object-contain rounded-lg"
                    controls
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="w-full max-h-80 object-contain rounded-lg"
                  />
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                >
                  <i className="fas fa-times"></i>
                </Button>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 border-gray-600 bg-gray-700 hover:bg-gray-600 text-white"
              onClick={() => setLocation("/discord")}
              disabled={isSubmitting}
            >
              <i className="fas fa-times mr-2"></i>
              취소
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  작성 중...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane mr-2"></i>
                  게시
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedCreatePage;
