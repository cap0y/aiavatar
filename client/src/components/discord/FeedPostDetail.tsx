import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface FeedPost {
  id: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  title: string;
  content: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  mediaUrls: string[] | null; // 다중 이미지 URL 배열
  thumbnailUrl: string | null;
  youtubeUrl: string | null;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  viewCount: number;
  reportCount: number; // 신고 횟수 추가
  createdAt: string;
  userVote: string | null;
}

interface FeedComment {
  id: number;
  postId: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  parentId: number | null;
  content: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  userVote: string | null;
}

interface FeedPostDetailProps {
  postId: number;
}

// 이미지 URL 변환 함수 (Cloudinary URL은 그대로 반환, 레거시 URL도 호환)
const convertImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  
  // data URL은 그대로 반환
  if (url.startsWith('data:')) return url;
  
  // Cloudinary URL은 그대로 반환 (CDN이므로 변환 불필요)
  if (url.includes('res.cloudinary.com')) return url;
  
  // 이미 상대 경로면 그대로 반환
  if (url.startsWith('/')) return url;
  
  try {
    // 프로필 이미지 URL 변환
    if (url.includes('decomsoft.com/images/profile') || url.includes('aiavatar.decomsoft.com/images/profile')) {
      const path = url.replace(/https?:\/\/[^\/]+/, '');
      return path;
    }
    
    // 레거시 피드 미디어 URL 변환 (이전 Windows CDN 서버의 데이터 호환)
    if (url.includes('/aiavatar/feed-media') || url.includes('decomsoft.com')) {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search;
      return path;
    }
  } catch (e) {
    console.warn('이미지 URL 변환 실패:', url, e);
  }
  
  return url;
};

const FeedPostDetail: React.FC<FeedPostDetailProps> = ({ postId }) => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [expandedCommentId, setExpandedCommentId] = useState<number | null>(
    null,
  );
  const [collapsedComments, setCollapsedComments] = useState<Set<number>>(
    new Set(),
  );
  
  // 현재 슬라이드 인덱스 추적
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // 게시물 수정 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editYoutubeUrl, setEditYoutubeUrl] = useState("");
  const [editMedia, setEditMedia] = useState<File[]>([]);
  const [editMediaPreviews, setEditMediaPreviews] = useState<string[]>([]);

  // 사이드바 데이터
  const [popularChannels, setPopularChannels] = useState<any[]>([]);
  const [subscribedChannels, setSubscribedChannels] = useState<any[]>([]);

  // 이미지 라이트박스 상태
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  // 신고 상태
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [showReportedContent, setShowReportedContent] = useState(false);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // 인기 채널 로드
  const loadPopularChannels = async () => {
    try {
      const response = await axios.get("/api/feed/popular-channels");
      setPopularChannels(response.data);
    } catch (error) {
      console.error("인기 채널 로드 실패:", error);
    }
  };

  // 구독한 채널 로드
  const loadSubscribedChannels = async () => {
    if (!user) return;

    try {
      const response = await axios.get("/api/feed/subscribed-channels", {
        headers: {
          "X-User-ID": user.uid,
        },
      });
      setSubscribedChannels(response.data);
    } catch (error) {
      console.error("구독 채널 로드 실패:", error);
    }
  };

  useEffect(() => {
    loadPost();
    loadComments();
    loadPopularChannels();
  }, [postId]);

  // 구독 채널은 로그인 후 로드
  useEffect(() => {
    if (user) {
      loadSubscribedChannels();
    }
  }, [user]);

  const loadPost = async () => {
    try {
      const response = await axios.get(`/api/feed/posts/${postId}`);
      setPost(response.data);
    } catch (error) {
      console.error("포스트 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const response = await axios.get(`/api/feed/posts/${postId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error("댓글 로드 실패:", error);
    }
  };

  const handleVote = async (voteType: "upvote" | "downvote") => {
    if (!user) {
      return;
    }

    try {
      await axios.post(
        `/api/feed/posts/${postId}/vote`,
        { voteType },
        {
          headers: {
            "X-User-ID": user?.uid || "anonymous",
          },
        },
      );
      loadPost();
    } catch (error) {
      console.error("투표 실패:", error);
    }
  };

  // 신고 처리
  const handleReport = () => {
    setReportReason("");
    setShowReportDialog(true);
  };

  const submitReport = async () => {
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "신고하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    if (!reportReason.trim()) {
      toast({
        title: "신고 사유 필요",
        description: "신고 사유를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsReporting(true);
    try {
      const response = await axios.post(
        `/api/feed/posts/${postId}/report`,
        { reason: reportReason.trim() },
        {
          headers: {
            "X-User-ID": user.uid,
          },
        }
      );

      toast({
        title: "신고 완료",
        description: response.data.message || "신고가 접수되었습니다.",
      });

      // 게시물 다시 로드
      loadPost();

      setShowReportDialog(false);
      setReportReason("");
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "신고에 실패했습니다.";
      toast({
        title: "신고 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsReporting(false);
    }
  };

  // 유튜브 비디오 ID 추출
  const extractYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  // 게시물 수정 모달 열기
  const handleOpenEditModal = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content || "");
    setEditYoutubeUrl(post.youtubeUrl || "");
    // 기존 이미지들을 미리보기로 설정
    const existingImages =
      post.mediaUrls && post.mediaUrls.length > 0
        ? post.mediaUrls
        : post.mediaUrl
          ? [post.mediaUrl]
          : [];
    setEditMediaPreviews(existingImages);
    setEditMedia([]);
    setShowEditModal(true);
  };

  // 미디어 파일 선택 (다중 파일 지원)
  const handleEditMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 최대 10개 파일 제한
    if (files.length > 10) {
      toast({
        title: "파일 개수 초과",
        description: "최대 10개의 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    // 각 파일 크기 체크 (50MB)
    const oversizedFiles = files.filter((file) => file.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "파일 크기 초과",
        description: "각 파일 크기는 50MB를 초과할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setEditMedia(files);

    // 미리보기 생성
    const previews: string[] = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        if (previews.length === files.length) {
          setEditMediaPreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 게시물 수정 제출
  const handleEditPost = async () => {
    if (!editTitle.trim()) {
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
      formData.append("title", editTitle);
      formData.append("content", editContent);

      if (editYoutubeUrl.trim()) {
        formData.append("youtubeUrl", editYoutubeUrl);
        formData.append("mediaType", "youtube");
      }

      // 다중 파일 추가
      if (editMedia.length > 0) {
        editMedia.forEach((file) => {
          formData.append("media", file);
        });
        const hasVideo = editMedia.some((file) =>
          file.type.startsWith("video"),
        );
        formData.append("mediaType", hasVideo ? "video" : "image");
      }

      await axios.put(`/api/feed/posts/${postId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-User-ID": user?.uid || "",
          "X-User-Type": user?.userType || "",
        },
      });

      toast({
        title: "게시물 수정 완료",
        description: "게시물이 성공적으로 수정되었습니다.",
      });

      setShowEditModal(false);
      loadPost(); // 게시물 새로고침
    } catch (error: any) {
      console.error("게시물 수정 실패:", error);
      toast({
        title: "수정 실패",
        description:
          error.response?.data?.error || "게시물 수정에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(
        `/api/feed/posts/${postId}/comments`,
        {
          content: newComment,
          parentId: replyTo,
        },
        {
          headers: {
            "X-User-ID": user?.uid || "anonymous",
          },
        },
      );

      setNewComment("");
      setReplyTo(null);
      setExpandedCommentId(null);
      loadComments();
      loadPost();
    } catch (error) {
      console.error("댓글 작성 실패:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = (commentId: number, userName: string) => {
    if (expandedCommentId === commentId) {
      // 이미 열려있으면 닫기
      setExpandedCommentId(null);
      setReplyTo(null);
      setNewComment("");
    } else {
      // 새로 열기
      setExpandedCommentId(commentId);
      setReplyTo(commentId);
      setNewComment(`@${userName} `);
      setTimeout(() => commentInputRef.current?.focus(), 100);
    }
  };

  const toggleCommentCollapse = (commentId: number) => {
    const newCollapsed = new Set(collapsedComments);
    if (newCollapsed.has(commentId)) {
      newCollapsed.delete(commentId);
    } else {
      newCollapsed.add(commentId);
    }
    setCollapsedComments(newCollapsed);
  };

  const getScore = (upvotes: number, downvotes: number) => {
    return upvotes - downvotes;
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: number) => {
    if (!user) return;

    if (!confirm("댓글을 삭제하시겠습니까?")) return;

    try {
      await axios.delete(`/api/feed/posts/${postId}/comments/${commentId}`, {
        headers: {
          "X-User-ID": user.uid,
          "X-User-Type": user.userType || "",
        },
      });

      loadComments();
      loadPost();
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
    }
  };

  // 댓글 투표
  const handleCommentVote = async (
    commentId: number,
    voteType: "upvote" | "downvote",
  ) => {
    if (!user) return;

    try {
      await axios.post(
        `/api/feed/posts/${postId}/comments/${commentId}/vote`,
        { voteType },
        {
          headers: {
            "X-User-ID": user.uid,
          },
        },
      );

      loadComments();
      loadPost();
    } catch (error) {
      console.error("투표 실패:", error);
    }
  };

  // 공유 (주소 복사)
  const handleShare = () => {
    const url = `${window.location.origin}/discord?post=${postId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        alert("주소가 복사되었습니다!");
      })
      .catch(() => {
        alert("복사에 실패했습니다.");
      });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#030303]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#030303]">
        <i className="fas fa-exclamation-circle text-6xl text-gray-600 mb-4"></i>
        <p className="text-gray-600 dark:text-gray-400 mb-4">포스트를 찾을 수 없습니다.</p>
        <Button onClick={() => setLocation("/discord")}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-white dark:bg-[#030303] overflow-hidden transition-colors">
      <ScrollArea className="flex-1">
        <div className="max-w-[1200px] mx-auto flex gap-4 px-4 py-4">
          {/* 메인 콘텐츠 */}
          <div className="flex-1 max-w-3xl">
            {/* 헤더: 뒤로가기 + 채널 정보 */}
            <div className="bg-gray-50 dark:bg-[#0B0B0B] px-3 py-2 flex items-center gap-3 border-b border-gray-200 dark:border-[#1A1A1B]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/discord")}
                className="text-gray-900 dark:text-white hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full h-8 w-8 p-0 flex-shrink-0"
              >
                <i className="fas fa-arrow-left"></i>
              </Button>
              <Avatar
                className="h-6 w-6 cursor-pointer flex-shrink-0"
                onClick={() => setLocation(`/channel/${post.userId}`)}
              >
                <AvatarImage src={convertImageUrl(post.userAvatar) || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white text-xs font-bold">
                  {post.userName?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <span
                className="text-sm font-medium text-gray-900 dark:text-white hover:underline cursor-pointer"
                onClick={() => setLocation(`/channel/${post.userId}`)}
              >
                r/{post.userName || "익명"}
              </span>
            </div>
            {/* 포스트 카드 */}
            <Card className="bg-white dark:bg-[#0B0B0B] border-0 rounded-none relative">
              {/* 신고된 게시물 오버레이 */}
              {post && (post.reportCount || 0) >= 10 && !showReportedContent && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 rounded-lg">
                  <i className="fas fa-exclamation-triangle text-yellow-500 text-5xl mb-4"></i>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    신고된 게시물
                  </h3>
                  <p className="text-gray-300 text-center mb-4">
                    이 게시물은 {post.reportCount}건의 신고로 인해 가려졌습니다.
                  </p>
                  <Button
                    onClick={() => setShowReportedContent(true)}
                    className="bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    <i className="fas fa-eye mr-2"></i>
                    콘텐츠 보기
                  </Button>
                </div>
              )}
              
              {/* 헤더 정보 */}
              <div className={`px-3 pt-3 pb-2 ${post && (post.reportCount || 0) >= 10 && !showReportedContent ? 'filter blur-sm pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                  <span>
                    {formatDistanceToNow(new Date(post.createdAt), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                  <span>
                    <i className="fas fa-eye mr-1"></i>
                    {post.viewCount}
                  </span>
                </div>

                {/* 제목과 수정 버튼 */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex-1">
                    {post.title}
                  </h1>
                  {user && (user.uid === post.userId || user.userType === 'admin') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                      onClick={handleOpenEditModal}
                    >
                      <i className="fas fa-edit mr-1"></i>
                      수정
                    </Button>
                  )}
                </div>

                {/* 내용 */}
                {post.content && (
                  <p className="text-gray-700 dark:text-gray-400 text-sm mb-2 whitespace-pre-wrap">
                    {post.content}
                  </p>
                )}
              </div>

              {/* 미디어 */}
              {(() => {
                // 이미지 배열 준비 (mediaUrls 우선, 없으면 mediaUrl 사용)
                const imageUrls =
                  post.mediaUrls && post.mediaUrls.length > 0
                    ? post.mediaUrls.map(convertImageUrl)
                    : post.mediaUrl
                      ? [convertImageUrl(post.mediaUrl)]
                      : [];
                const hasMultipleImages = imageUrls.length > 1;

                if (imageUrls.length > 0 && post.mediaType === "image") {
                  return (
                    <div className="px-3 mb-3">
                      {/* 다중 이미지 수평 슬라이드 */}
                      {hasMultipleImages ? (
                        <div className="relative group bg-black/60 rounded-xl overflow-hidden">
                          {/* 수평 스크롤 컨테이너 */}
                          <div 
                            id={`slider-detail-${post.id}`}
                            className="overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory scroll-smooth"
                            onScroll={(e) => {
                              const slider = e.currentTarget;
                              const scrollLeft = slider.scrollLeft;
                              const slideWidth = slider.offsetWidth;
                              const currentIndex = Math.round(scrollLeft / slideWidth);
                              setCurrentSlideIndex(currentIndex);
                            }}
                          >
                            <div className="flex">
                              {imageUrls.map((url, idx) => (
                                <div
                                  key={idx}
                                  className="flex-shrink-0 w-full snap-center relative cursor-pointer hover:opacity-95 transition-opacity"
                                  onClick={() => {
                                    setLightboxImages(imageUrls);
                                    setLightboxInitialIndex(idx);
                                    setLightboxOpen(true);
                                  }}
                                >
                                  {/* 블러 배경 */}
                                  <div
                                    className="absolute inset-0 bg-cover bg-center blur-3xl opacity-50"
                                    style={{ backgroundImage: `url(${url})` }}
                                  />
                                  {/* 메인 이미지 */}
                                  <img
                                    src={url}
                                    alt={`${post.title} - ${idx + 1}`}
                                    className="relative w-full h-[500px] object-contain z-10"
                                    onError={(e) => {
                                      console.error('이미지 로드 실패:', url);
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* 좌측 배경 오버레이 + 화살표 */}
                          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                          <button
                            onClick={() => {
                              const slider = document.getElementById(`slider-detail-${post.id}`);
                              if (slider) {
                                slider.scrollBy({ left: -slider.offsetWidth, behavior: 'smooth' });
                              }
                            }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900/80 dark:bg-gray-800/90 hover:bg-gray-800/90 dark:hover:bg-gray-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg"
                            aria-label="이전 이미지"
                          >
                            <i className="fas fa-chevron-left text-xl"></i>
                          </button>
                          
                          {/* 우측 배경 오버레이 + 화살표 */}
                          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                          <button
                            onClick={() => {
                              const slider = document.getElementById(`slider-detail-${post.id}`);
                              if (slider) {
                                slider.scrollBy({ left: slider.offsetWidth, behavior: 'smooth' });
                              }
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900/80 dark:bg-gray-800/90 hover:bg-gray-800/90 dark:hover:bg-gray-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg"
                            aria-label="다음 이미지"
                          >
                            <i className="fas fa-chevron-right text-xl"></i>
                          </button>
                          
                          {/* 페이지네이션 인디케이터 - 이미지 안 하단 중앙 */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex justify-center gap-1.5 z-40">
                            {imageUrls.map((_, idx) => {
                              const isActive = currentSlideIndex === idx;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    const slider = document.getElementById(`slider-detail-${post.id}`);
                                    if (slider) {
                                      slider.scrollTo({ left: slider.offsetWidth * idx, behavior: 'smooth' });
                                    }
                                  }}
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
                        </div>
                      ) : (
                        // 단일 이미지
                        <div className="relative bg-black/60 rounded-xl overflow-hidden">
                          <div
                            className="relative cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => {
                              setLightboxImages(imageUrls);
                              setLightboxInitialIndex(0);
                              setLightboxOpen(true);
                            }}
                          >
                            {/* 블러 배경 */}
                            <div
                              className="absolute inset-0 bg-cover bg-center blur-3xl opacity-50"
                              style={{ backgroundImage: `url(${imageUrls[0]})` }}
                            />
                            {/* 메인 이미지 */}
                            <img
                              src={imageUrls[0]}
                              alt={post.title}
                              className="relative w-full h-[500px] object-contain z-10"
                              onError={(e) => {
                                console.error('이미지 로드 실패:', imageUrls[0]);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {post.mediaUrl && post.mediaType === "video" && (
                <div className="px-3 mb-3">
                  <div className="relative bg-black/90 backdrop-blur-sm rounded-xl overflow-hidden">
                    <video
                      src={convertImageUrl(post.mediaUrl)}
                      className="relative w-full max-h-[600px] object-contain"
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  </div>
                </div>
              )}

              {/* 유튜브 임베드 */}
              {post.youtubeUrl && extractYoutubeVideoId(post.youtubeUrl) && (
                <div className="px-3 mb-3">
                  <div className="relative bg-black/90 backdrop-blur-sm rounded-xl overflow-hidden aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYoutubeVideoId(post.youtubeUrl)}`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* 액션 버튼들 */}
              <div className="px-2 py-1.5 flex items-center gap-1 text-xs">
                <div
                  className={`flex items-center gap-0.5 rounded-full px-2 py-1 ${
                    post.userVote === "upvote"
                      ? "bg-orange-500/10 text-orange-500"
                      : post.userVote === "downvote"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-transparent"
                    onClick={() => handleVote("upvote")}
                  >
                    <i className="fas fa-arrow-up text-xs"></i>
                  </Button>

                  <span className="font-bold min-w-[20px] text-center">
                    {getScore(post.upvotes, post.downvotes)}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-transparent"
                    onClick={() => handleVote("downvote")}
                  >
                    <i className="fas fa-arrow-down text-xs"></i>
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7 px-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  onClick={handleShare}
                >
                  <i className="fas fa-share text-sm"></i>
                  <span>공유</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7 px-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-600 hover:dark:bg-red-700 hover:text-white"
                  onClick={handleReport}
                >
                  <i className="fas fa-flag text-sm"></i>
                  <span>신고</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 ml-auto"
                >
                  <i className="fas fa-bookmark text-sm"></i>
                </Button>
              </div>
            </Card>

            {/* 댓글 섹션 헤더 */}
            {user && (
              <div className="bg-gray-50 dark:bg-[#0B0B0B] px-3 py-3 border-t border-gray-200 dark:border-[#1A1A1B]">
                <div className="relative">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="댓글을 달아보세요"
                    className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white text-sm resize-none min-h-[100px] rounded-lg placeholder:text-gray-500 dark:placeholder:text-gray-400 pr-2 pb-12"
                  />

                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewComment("")}
                      className="h-7 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                    >
                      취소
                    </Button>
                    <Button
                      onClick={handleSubmitComment}
                      disabled={isSubmitting || !newComment.trim()}
                      className="h-7 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 rounded-full disabled:opacity-50"
                    >
                      {isSubmitting ? "작성 중..." : "댓글"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 댓글 목록 - 트리 구조 */}
            <div className="space-y-0">
              {comments
                .filter((c) => !c.parentId)
                .map((comment) => {
                  const isCollapsed = collapsedComments.has(comment.id);
                  const replyCount = comments.filter(
                    (c) => c.parentId === comment.id,
                  ).length;

                  return (
                    <div key={comment.id}>
                      {/* 부모 댓글 */}
                      <Card className="bg-white dark:bg-[#0B0B0B] border-0 rounded-none p-3 hover:bg-gray-50 dark:hover:bg-[#0F0F0F] transition-colors">
                        <div className="flex gap-2">
                          <div className="flex flex-col items-center gap-1">
                            <Avatar
                              className="h-6 w-6 flex-shrink-0 cursor-pointer"
                              onClick={() => toggleCommentCollapse(comment.id)}
                            >
                              <AvatarImage
                                src={convertImageUrl(comment.userAvatar) || undefined}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-green-500 to-teal-500 text-white text-xs">
                                {comment.userName?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            {replyCount > 0 && (
                              <button
                                onClick={() =>
                                  toggleCommentCollapse(comment.id)
                                }
                                className="w-5 h-5 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-[10px] font-bold"
                              >
                                {isCollapsed ? "+" : "−"}
                              </button>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* 사용자 정보 */}
                            <div className="flex items-center gap-1 mb-1">
                              <button
                                onClick={() =>
                                  toggleCommentCollapse(comment.id)
                                }
                                className="text-xs font-bold text-gray-700 dark:text-gray-300 hover:underline cursor-pointer"
                              >
                                {comment.userName || "익명"}
                              </button>
                              <span className="text-xs text-gray-500 dark:text-gray-600">•</span>
                              <span className="text-xs text-gray-600 dark:text-gray-500">
                                {formatDistanceToNow(
                                  new Date(comment.createdAt),
                                  {
                                    addSuffix: true,
                                    locale: ko,
                                  },
                                )}
                              </span>
                              {isCollapsed && replyCount > 0 && (
                                <span className="text-xs text-blue-400 ml-1">
                                  ({replyCount}개 답글)
                                </span>
                              )}
                            </div>

                            {/* 댓글 내용 */}
                            {!isCollapsed && (
                              <p className="text-gray-200 text-sm mb-2 leading-relaxed">
                                {comment.content}
                              </p>
                            )}

                            {/* 액션 버튼 */}
                            {!isCollapsed && (
                              <div className="flex items-center gap-1">
                                {/* 투표 */}
                                <div
                                  className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 ${
                                    comment.userVote === "upvote"
                                      ? "bg-orange-500/10 text-orange-500"
                                      : comment.userVote === "downvote"
                                        ? "bg-blue-500/10 text-blue-500"
                                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  }`}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-transparent"
                                    onClick={() =>
                                      handleCommentVote(comment.id, "upvote")
                                    }
                                  >
                                    <i className="fas fa-arrow-up text-[10px]"></i>
                                  </Button>
                                  <span className="text-[11px] font-bold min-w-[20px] text-center">
                                    {comment.upvotes - comment.downvotes}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-transparent"
                                    onClick={() =>
                                      handleCommentVote(comment.id, "downvote")
                                    }
                                  >
                                    <i className="fas fa-arrow-down text-[10px]"></i>
                                  </Button>
                                </div>

                                {/* 답글 버튼 */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                                  onClick={() =>
                                    handleReply(comment.id, comment.userName)
                                  }
                                >
                                  <i className="fas fa-comment-dots mr-1"></i>
                                  답글 달기
                                </Button>

                                {/* 공유 버튼 */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                                  onClick={handleShare}
                                >
                                  <i className="fas fa-share mr-1"></i>
                                  공유
                                </Button>

                                {/* 삭제 버튼 */}
                                {user && (comment.userId === user.uid || user.userType === 'admin') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-gray-600 dark:text-gray-300 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full ml-auto"
                                    onClick={() =>
                                      handleDeleteComment(comment.id)
                                    }
                                  >
                                    <i className="fas fa-trash-alt text-xs"></i>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>

                      {/* 답글 목록 - 트리 형태 */}
                      {!isCollapsed &&
                        comments
                          .filter((c) => c.parentId === comment.id)
                          .map((reply, index, arr) => (
                            <div key={reply.id} className="ml-8 relative">
                              {/* 트리 라인 */}
                              <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none">
                                <div className="absolute left-3 top-0 w-0.5 h-full bg-gray-300 dark:bg-gray-700"></div>
                                <div className="absolute left-3 top-6 w-5 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
                              </div>

                              <Card className="bg-gray-100 dark:bg-[#0B0B0B] border-0 rounded-none p-3 pl-10 hover:bg-gray-200 dark:hover:bg-[#0F0F0F] transition-colors">
                                <div className="flex gap-2">
                                  <div className="flex flex-col items-center">
                                    <Avatar className="h-6 w-6 flex-shrink-0">
                                      <AvatarImage
                                        src={convertImageUrl(reply.userAvatar) || undefined}
                                      />
                                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                                        {reply.userName?.[0] || "U"}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    {/* 사용자 정보 */}
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="text-xs font-bold text-gray-300">
                                        {reply.userName || "익명"}
                                      </span>
                                      <span className="text-xs text-gray-600">
                                        •
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {formatDistanceToNow(
                                          new Date(reply.createdAt),
                                          {
                                            addSuffix: true,
                                            locale: ko,
                                          },
                                        )}
                                      </span>
                                    </div>

                                    {/* 답글 내용 */}
                                    <p className="text-gray-200 text-sm mb-2 leading-relaxed">
                                      {reply.content}
                                    </p>

                                    {/* 액션 버튼 */}
                                    <div className="flex items-center gap-1">
                                      {/* 투표 */}
                                      <div
                                        className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 ${
                                          reply.userVote === "upvote"
                                            ? "bg-orange-500/10 text-orange-500"
                                            : reply.userVote === "downvote"
                                              ? "bg-blue-500/10 text-blue-500"
                                              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                        }`}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 hover:bg-transparent"
                                          onClick={() =>
                                            handleCommentVote(
                                              reply.id,
                                              "upvote",
                                            )
                                          }
                                        >
                                          <i className="fas fa-arrow-up text-[10px]"></i>
                                        </Button>
                                        <span className="text-[11px] font-bold min-w-[20px] text-center">
                                          {reply.upvotes - reply.downvotes}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 hover:bg-transparent"
                                          onClick={() =>
                                            handleCommentVote(
                                              reply.id,
                                              "downvote",
                                            )
                                          }
                                        >
                                          <i className="fas fa-arrow-down text-[10px]"></i>
                                        </Button>
                                      </div>

                                      {/* 공유 버튼 */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                                        onClick={handleShare}
                                      >
                                        <i className="fas fa-share mr-1"></i>
                                        공유
                                      </Button>

                                      {/* 삭제 버튼 */}
                                      {user && (reply.userId === user.uid || user.userType === 'admin') && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-gray-600 dark:text-gray-300 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full ml-auto"
                                          onClick={() =>
                                            handleDeleteComment(reply.id)
                                          }
                                        >
                                          <i className="fas fa-trash-alt text-[10px]"></i>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            </div>
                          ))}

                      {/* 답글 입력창 - 아코디언 */}
                      {!isCollapsed &&
                        expandedCommentId === comment.id &&
                        user && (
                          <div className="bg-gray-600 px-3 py-3 ml-8 relative">
                            {/* 트리 라인 */}
                            <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none">
                              <div className="absolute left-3 top-0 w-0.5 h-full bg-blue-500"></div>
                              <div className="absolute left-3 top-6 w-5 h-0.5 bg-blue-500"></div>
                            </div>
                            <div className="pl-10">
                              <div className="relative">
                                <Textarea
                                  ref={commentInputRef}
                                  value={newComment}
                                  onChange={(e) =>
                                    setNewComment(e.target.value)
                                  }
                                  placeholder="답글을 입력하세요..."
                                  className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white text-sm resize-none min-h-[80px] rounded-lg placeholder:text-gray-500 dark:placeholder:text-gray-400 pr-2 pb-10"
                                />

                                <div className="absolute bottom-2 right-2 flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setExpandedCommentId(null);
                                      setReplyTo(null);
                                      setNewComment("");
                                    }}
                                    className="h-7 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                                  >
                                    취소
                                  </Button>
                                  <Button
                                    onClick={handleSubmitComment}
                                    disabled={
                                      isSubmitting || !newComment.trim()
                                    }
                                    className="h-7 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 rounded-full disabled:opacity-50"
                                  >
                                    {isSubmitting ? "작성 중..." : "답글"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  );
                })}

              {comments.length === 0 && (
                <div className="text-center py-12 px-4">
                  <div className="flex flex-col items-center justify-center">
                    <i className="far fa-comment-dots text-5xl text-gray-700 mb-4"></i>
                    <p className="text-gray-600 dark:text-gray-400 text-base font-medium mb-1">
                      댓글이 아직 없어요
                    </p>
                    <p className="text-gray-600 dark:text-gray-500 text-sm">
                      대화를 시작하려면 의견을 적어보세요
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽 사이드바 - 채널 정보 */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-4 space-y-3">
              {/* 채널 정보 카드 */}
              <Card className="bg-gray-50 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B]">
                <div className="p-4">
                  {/* 채널 헤더 */}
                  <div
                    className="flex items-center gap-3 mb-4 cursor-pointer hover:opacity-80"
                    onClick={() => setLocation(`/channel/${post.userId}`)}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={post.userAvatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white font-bold">
                        {post.userName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-gray-900 dark:text-white font-bold text-sm">
                        r/{post.userName || "익명"}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-xs">채널</p>
                    </div>
                  </div>

                  {/* 채널 설명 */}
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
                    {post.userName}님의 채널에 오신 것을 환영합니다.
                  </p>

                  {/* 채널 통계 */}
                  <div className="flex gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="text-gray-900 dark:text-white font-bold text-lg">
                        {post.viewCount || 0}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs">조회수</div>
                    </div>
                    <div>
                      <div className="text-gray-900 dark:text-white font-bold text-lg">
                        {post.commentCount || 0}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs">댓글</div>
                    </div>
                  </div>

                  {/* 생성일 */}
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-xs mb-4">
                    <i className="fas fa-cake-candles"></i>
                    <span>
                      생성일:{" "}
                      {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>

                  {/* 채널 방문 버튼 */}
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setLocation(`/channel/${post.userId}`)}
                  >
                    <i className="fas fa-user-circle mr-2"></i>
                    채널 방문하기
                  </Button>
                </div>
              </Card>

              {/* 인기 채널 */}
              {popularChannels.length > 0 && (
                <Card className="bg-gray-50 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B]">
                  <div className="p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      인기순위 채널
                    </h3>
                    <div className="space-y-3">
                      {popularChannels.map((channel, index) => {
                        const colors = [
                          "from-red-500 to-orange-500",
                          "from-purple-500 to-pink-500",
                          "from-blue-500 to-cyan-500",
                          "from-green-500 to-teal-500",
                          "from-yellow-500 to-orange-500",
                        ];
                        return (
                          <div
                            key={channel.userId}
                            className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors"
                            onClick={() =>
                              setLocation(`/channel/${channel.userId}`)
                            }
                          >
                            {channel.userAvatar ? (
                              <img
                                src={channel.userAvatar}
                                alt={channel.userName}
                                className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div
                                className={`h-8 w-8 rounded-full bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center text-sm flex-shrink-0 font-bold text-white`}
                              >
                                {channel.userName?.[0]?.toUpperCase() || "U"}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-gray-900 dark:text-white text-sm font-medium truncate">
                                r/{channel.userName || "익명"}
                              </div>
                              <div className="text-gray-400 text-xs">
                                {channel.postCount} posts
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {popularChannels.length >= 5 && (
                      <Button
                        variant="outline"
                        className="w-full mt-3 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                        onClick={() => setLocation("/discord")}
                      >
                        더 보기
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {/* 구독한 채널 */}
              {user && (
                <Card className="bg-gray-50 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B]">
                  <div className="p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <i className="fas fa-bell"></i>
                      구독
                    </h3>
                    {subscribedChannels.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <i className="fas fa-bell-slash text-4xl mb-3"></i>
                        <p className="text-sm">
                          아직 구독한 채널이 없습니다.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {subscribedChannels.map((channel, index) => {
                          const colors = [
                            "from-indigo-500 to-purple-500",
                            "from-blue-500 to-indigo-500",
                            "from-pink-500 to-red-500",
                            "from-green-500 to-emerald-500",
                          ];
                          return (
                            <div
                              key={channel.userId}
                              className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors"
                              onClick={() =>
                                setLocation(`/channel/${channel.userId}`)
                              }
                            >
                              {channel.userAvatar ? (
                                <img
                                  src={channel.userAvatar}
                                  alt={channel.userName}
                                  className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div
                                  className={`h-8 w-8 rounded-full bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center text-sm flex-shrink-0 font-bold text-white`}
                                >
                                  {channel.userName?.[0]?.toUpperCase() || "U"}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-gray-900 dark:text-white text-sm font-medium truncate">
                                  r/{channel.userName || "익명"}
                                </div>
                                <div className="text-gray-400 text-xs">
                                  {channel.postCount} posts
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {subscribedChannels.length >= 4 && (
                      <Button
                        variant="outline"
                        className="w-full mt-3 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                        onClick={() => setLocation("/discord")}
                      >
                        더 보기
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {/* 커뮤니티 가이드 */}
              <Card className="bg-gray-50 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B]">
                <div className="p-4">
                  <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-3 flex items-center gap-2">
                    <i className="fas fa-book text-blue-400"></i>
                    커뮤니티 가이드
                  </h3>
                  <div className="space-y-2 text-gray-600 dark:text-gray-300 text-xs">
                    <div className="flex items-start gap-2">
                      <i className="fas fa-check text-green-400 mt-0.5"></i>
                      <span>존중과 예의를 지켜주세요</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <i className="fas fa-check text-green-400 mt-0.5"></i>
                      <span>스팸 및 광고를 금지합니다</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <i className="fas fa-check text-green-400 mt-0.5"></i>
                      <span>불법적인 콘텐츠를 게시하지 마세요</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <i className="fas fa-check text-green-400 mt-0.5"></i>
                      <span>개인정보를 보호해주세요</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* 게시물 수정 모달 */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B] text-gray-900 dark:text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              게시물 수정
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              게시물 내용을 수정하세요
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 제목 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                제목 *
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
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
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="게시물 내용을 입력하세요 (선택사항)"
                className="bg-gray-700 border-gray-600 text-white min-h-[120px]"
                maxLength={2000}
              />
            </div>

            {/* 유튜브 URL */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                <i className="fab fa-youtube text-red-500 mr-2"></i>
                유튜브 링크 (선택사항)
              </label>
              <Input
                value={editYoutubeUrl}
                onChange={(e) => setEditYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="bg-gray-700 border-gray-600 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                유튜브 동영상 URL을 입력하면 게시물에 임베드됩니다
              </p>
            </div>

            {/* 미디어 업로드 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                이미지 또는 동영상 (최대 10개 다중선택)
              </label>
              <input
                id="edit-media-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleEditMediaSelect}
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-600 bg-gray-700 hover:bg-gray-600 text-white"
                onClick={() =>
                  document.getElementById("edit-media-upload")?.click()
                }
              >
                <i className="fas fa-upload mr-2"></i>
                {editMedia.length > 0 ? "파일 다시 선택" : "새 파일 선택"}
              </Button>

              {editMedia.length > 0 && (
                <div className="mt-2 text-sm text-gray-400">
                  <p className="mb-2">
                    <i className="fas fa-images mr-2"></i>
                    {editMedia.length}개 새 파일 선택됨
                  </p>
                  <div className="space-y-1">
                    {editMedia.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs"
                      >
                        <i className="fas fa-file-alt"></i>
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-gray-600">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 미디어 미리보기 (다중 이미지 그리드) */}
              {editMediaPreviews.length > 0 && (
                <div className="mt-3 relative">
                  <p className="text-sm text-gray-400 mb-2">
                    {editMedia.length > 0
                      ? "새로 선택한 이미지:"
                      : "기존 이미지:"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {editMediaPreviews.map((preview, idx) => (
                      <div key={idx} className="relative group">
                        {preview.match(/\.(mp4|webm|mov)$/i) ||
                        editMedia[idx]?.type?.startsWith("video") ? (
                          <video
                            src={preview}
                            className="w-full h-48 object-cover rounded-lg"
                            controls
                          />
                        ) : preview.includes("youtube") ? (
                          <div className="w-full h-48 flex items-center justify-center bg-gray-700 rounded-lg text-gray-400 text-sm">
                            유튜브 비디오
                          </div>
                        ) : (
                          <img
                            src={preview}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        )}
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          {idx + 1}/{editMediaPreviews.length}
                        </div>
                      </div>
                    ))}
                  </div>
                  {editMedia.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => {
                        setEditMedia([]);
                        // 기존 이미지로 복원
                        const existingImages =
                          post?.mediaUrls && post.mediaUrls.length > 0
                            ? post.mediaUrls
                            : post?.mediaUrl
                              ? [post.mediaUrl]
                              : [];
                        setEditMediaPreviews(existingImages);
                      }}
                    >
                      <i className="fas fa-times mr-2"></i>새 파일 선택 취소
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => setShowEditModal(false)}
                disabled={isSubmitting}
              >
                <i className="fas fa-times mr-2"></i>
                취소
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleEditPost}
                disabled={isSubmitting || !editTitle.trim()}
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    수정 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    저장
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 신고 다이얼로그 */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              게시물 신고
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              부적절한 콘텐츠를 신고해주세요. 신고가 10건 이상 누적되면 해당 게시물이 자동으로 가려집니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                신고 사유를 선택하거나 직접 입력하세요
              </label>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] rounded-md py-2 text-gray-900 dark:text-white"
                  onClick={() => setReportReason("스팸 또는 광고")}
                >
                  <i className="fas fa-exclamation-triangle mr-3 text-yellow-500 w-5"></i>
                  스팸 또는 광고
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] rounded-md py-2 text-gray-900 dark:text-white"
                  onClick={() => setReportReason("혐오 발언 또는 차별")}
                >
                  <i className="fas fa-ban mr-3 text-red-500 w-5"></i>
                  혐오 발언 또는 차별
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] rounded-md py-2 text-gray-900 dark:text-white"
                  onClick={() => setReportReason("괴롭힘 또는 괴롭힘 선동")}
                >
                  <i className="fas fa-user-slash mr-3 text-red-500 w-5"></i>
                  괴롭힘 또는 괴롭힘 선동
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] rounded-md py-2 text-gray-900 dark:text-white"
                  onClick={() => setReportReason("성적인 콘텐츠")}
                >
                  <i className="fas fa-image mr-3 text-orange-500 w-5"></i>
                  성적인 콘텐츠
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] rounded-md py-2 text-gray-900 dark:text-white"
                  onClick={() => setReportReason("기타 (개인정보 유출, 폭력 등)")}
                >
                  <i className="fas fa-shield-alt mr-3 text-blue-500 w-5"></i>
                  기타 (개인정보 유출, 폭력 등)
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                신고 사유 상세 입력
              </label>
              <Textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="신고 사유를 자세히 입력해주세요..."
                className="min-h-[100px] bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReportDialog(false);
                  setReportReason("");
                }}
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={isReporting}
              >
                취소
              </Button>
              <Button
                onClick={submitReport}
                disabled={isReporting || !reportReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isReporting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    신고 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-flag mr-2"></i>
                    신고하기
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 이미지 라이트박스 */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxInitialIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};

export default FeedPostDetail;
