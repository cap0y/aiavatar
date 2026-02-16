import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  isBookmarked?: boolean;
  reactions?: { emoji: string; count: number }[];
  userReactions?: string[];
}

interface FeedViewProps {
  onPostClick?: (postId: number) => void;
  sortBy?: 'latest' | 'popular' | 'subscribed' | 'trending';
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

const FeedView: React.FC<FeedViewProps> = ({ onPostClick, sortBy: propSortBy }) => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [videoRefs] = useState<Map<number, HTMLVideoElement>>(new Map());
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportPostId, setReportPostId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  
  // 각 포스트의 현재 슬라이드 인덱스 추적
  const [currentSlideIndex, setCurrentSlideIndex] = useState<Record<number, number>>({});
  
  // 신고된 게시물 표시 상태 (각 포스트별 관리)
  const [showReportedContent, setShowReportedContent] = useState<Record<number, boolean>>({});

  // 게시물 작성 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostMedia, setNewPostMedia] = useState<File[]>([]); // 다중 파일 배열로 변경
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]); // 다중 미리보기 배열
  const [newPostYoutubeUrl, setNewPostYoutubeUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 사이드바 데이터
  const [popularChannels, setPopularChannels] = useState<any[]>([]);
  const [subscribedChannels, setSubscribedChannels] = useState<any[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<FeedPost[]>([]);

  // 정렬 상태 - prop으로 받거나 localStorage에서 불러오기
  const sortBy = propSortBy || 'latest';

  // 이모티콘 피커 상태
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const availableEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];

  // 이미지 라이트박스 상태
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 포스트 목록 로드
  const loadPosts = useCallback(
    async (pageNum: number) => {
      if (isLoading) return;

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: '20',
          sortBy: sortBy,
        });

        if (sortBy === 'subscribed' && user) {
          params.append('userId', user.uid);
        }

        const response = await axios.get(
          `/api/feed/posts?${params.toString()}`,
        );
        const { posts: newPosts, hasMore: more} = response.data;

        setPosts((prev) => (pageNum === 1 ? newPosts : [...prev, ...newPosts]));
        setHasMore(more);
        setPage(pageNum);
      } catch (error) {
        console.error("포스트 로드 실패:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sortBy, user],
  );

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

  // 초기 로드
  useEffect(() => {
    loadPosts(1);
    loadPopularChannels();
  }, []);

  // 정렬 변경 시 다시 로드
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    loadPosts(1);
  }, [sortBy]);

  // 구독 채널 및 북마크는 로그인 후 로드
  useEffect(() => {
    if (user) {
      loadSubscribedChannels();
      loadBookmarks();
    }
  }, [user]);

  // 무한 스크롤
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          loadPosts(page + 1);
        }
      },
      { threshold: 0.1 },
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, page, loadPosts]);

  // 비디오 자동 재생 관찰자
  useEffect(() => {
    const videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            // 뷰포트에 50% 이상 보이면 재생
            if (entry.intersectionRatio >= 0.5) {
              video.play().catch((err) => console.log("자동 재생 실패:", err));
            }
          } else {
            // 뷰포트에서 벗어나면 일시정지
            video.pause();
          }
        });
      },
      { threshold: [0.5] },
    );

    // 모든 비디오 요소 관찰
    videoRefs.forEach((video) => {
      videoObserver.observe(video);
    });

    return () => {
      videoObserver.disconnect();
    };
  }, [posts, videoRefs]);

  // 투표 처리
  const handleVote = async (
    postId: number,
    voteType: "upvote" | "downvote",
  ) => {
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

      // 포스트 목록 새로고침
      loadPosts(1);
    } catch (error) {
      console.error("투표 실패:", error);
    }
  };

  // 포스트 클릭 처리
  const handlePostClick = (postId: number) => {
    if (onPostClick) {
      onPostClick(postId);
    } else {
      setLocation(`/feed/${postId}`);
    }
  };

  // 비디오 ref 저장
  const setVideoRef = (postId: number, element: HTMLVideoElement | null) => {
    if (element) {
      videoRefs.set(postId, element);
    } else {
      videoRefs.delete(postId);
    }
  };

  // 점수 계산
  const getScore = (upvotes: number, downvotes: number) => {
    return upvotes - downvotes;
  };

  // 유튜브 비디오 ID 추출
  const extractYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;

    // 다양한 유튜브 URL 형식 지원
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

  // 신고 처리
  const handleReport = (postId: number) => {
    setReportPostId(postId);
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
        `/api/feed/posts/${reportPostId}/report`,
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

      // 해당 포스트의 신고 횟수 업데이트
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === reportPostId
            ? { ...post, reportCount: response.data.reportCount || post.reportCount + 1 }
            : post
        )
      );

      setShowReportDialog(false);
      setReportPostId(null);
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

  // 공유 (주소 복사)
  const handleSharePost = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

  // 북마크 토글
  const handleBookmark = async (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      return;
    }

    try {
      const response = await axios.post(
        `/api/feed/posts/${postId}/bookmark`,
        {},
        {
          headers: { "X-User-ID": user.uid },
        },
      );

      // 게시물 북마크 상태 업데이트
      setPosts(
        posts.map((p) =>
          p.id === postId
            ? { ...p, isBookmarked: response.data.bookmarked }
            : p,
        ),
      );

      // 북마크 목록 새로고침
      loadBookmarks();
    } catch (error) {
      console.error("북마크 실패:", error);
    }
  };

  // 이모티콘 반응
  const handleReaction = async (
    postId: number,
    emoji: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!user) {
      return;
    }

    try {
      await axios.post(
        `/api/feed/posts/${postId}/reaction`,
        { emoji },
        {
          headers: { "X-User-ID": user.uid },
        },
      );

      // 해당 게시물의 반응 다시 로드
      loadPostReactions(postId);
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("이모티콘 반응 실패:", error);
    }
  };

  // 게시물 반응 로드
  const loadPostReactions = async (postId: number) => {
    try {
      const response = await axios.get(`/api/feed/posts/${postId}/reactions`, {
        headers: user ? { "X-User-ID": user.uid } : {},
      });

      setPosts(
        posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                reactions: response.data.reactions,
                userReactions: response.data.userReactions,
              }
            : p,
        ),
      );
    } catch (error) {
      console.error("반응 로드 실패:", error);
    }
  };

  // 북마크 목록 로드
  const loadBookmarks = async () => {
    if (!user) return;

    try {
      const response = await axios.get(`/api/feed/bookmarks`, {
        headers: { "X-User-ID": user.uid },
      });
      setBookmarkedPosts(response.data);
    } catch (error) {
      console.error("북마크 목록 로드 실패:", error);
    }
  };

  // 미디어 파일 선택 핸들러 (다중 파일 지원)
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setNewPostMedia(files);

    // 미리보기 생성
    const previews: string[] = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        if (previews.length === files.length) {
          setMediaPreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 게시물 작성 핸들러
  const handleCreatePost = async () => {
    if (!newPostTitle.trim()) {
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
      formData.append("title", newPostTitle);
      formData.append("content", newPostContent);

      if (newPostYoutubeUrl.trim()) {
        formData.append("youtubeUrl", newPostYoutubeUrl);
        formData.append("mediaType", "youtube");
      }

      // 다중 파일 추가
      if (newPostMedia.length > 0) {
        newPostMedia.forEach((file) => {
          formData.append("media", file);
        });
        const hasVideo = newPostMedia.some((file) =>
          file.type.startsWith("video"),
        );
        formData.append("mediaType", hasVideo ? "video" : "image");
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

      // 초기화
      setShowCreateModal(false);
      setNewPostTitle("");
      setNewPostContent("");
      setNewPostMedia([]);
      setMediaPreviews([]);
      setNewPostYoutubeUrl("");

      // 게시물 목록 새로고침
      setPage(1);
      setPosts([]);
      loadPosts(1);
    } catch (error) {
      console.error("게시물 작성 실패:", error);
      toast({
        title: "작성 실패",
        description: "게시물 작성에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex bg-white dark:bg-[#030303] overflow-hidden transition-colors">
      {/* 배경색 통일 */}
      {/* 포스트 목록 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto flex gap-4 px-4 py-4">
          {/* 메인 콘텐츠 */}
          <div className="flex-1 max-w-3xl">
            {posts.map((post) => {
              const isReported = (post.reportCount || 0) >= 10;
              const isContentVisible = showReportedContent[post.id] || false;
              
              return (
              <Card
                key={post.id}
                className="bg-white dark:bg-[#0B0B0B] border-0 border-b border-gray-200 dark:border-[#1A1A1B] rounded-none hover:bg-gray-50 dark:hover:bg-[#0F0F0F] transition-colors cursor-pointer relative"
                onClick={() => !isReported || isContentVisible ? handlePostClick(post.id) : null}
              >
                {/* 신고된 게시물 오버레이 */}
                {isReported && !isContentVisible && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 rounded-lg">
                    <i className="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                    <h3 className="text-xl font-bold text-white mb-2">
                      신고된 게시물
                    </h3>
                    <p className="text-gray-300 text-center mb-4">
                      이 게시물은 {post.reportCount}건의 신고로 인해 가려졌습니다.
                    </p>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReportedContent(prev => ({
                          ...prev,
                          [post.id]: true
                        }));
                      }}
                      className="bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      <i className="fas fa-eye mr-2"></i>
                      콘텐츠 보기
                    </Button>
                  </div>
                )}
                
                {/* 헤더 영역 */}
                <div className={`p-3 ${isReported && !isContentVisible ? 'filter blur-sm pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <Avatar
                        className="h-7 w-7 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/channel/${post.userId}`);
                        }}
                      >
                        <AvatarImage src={convertImageUrl(post.userAvatar) || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white text-xs font-bold">
                          {post.userName?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/channel/${post.userId}`);
                            }}
                          >
                            r/{post.userName || "익명"}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-600">•</span>
                          <span className="text-xs text-gray-600 dark:text-gray-500">
                            {formatDistanceToNow(new Date(post.createdAt), {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {user && post.userId !== user.uid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-blue-500 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await axios.post(
                                `/api/feed/channels/${post.userId}/subscribe`,
                                {},
                                {
                                  headers: {
                                    "X-User-ID": user.uid,
                                  },
                                }
                              );
                              toast({
                                title: "구독 완료",
                                description: `${post.userName} 채널을 구독했습니다.`,
                              });
                              loadSubscribedChannels();
                            } catch (error) {
                              console.error("구독 실패:", error);
                            }
                          }}
                        >
                          <i className="fas fa-bell text-xs mr-1"></i>
                          구독
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReport(post.id);
                        }}
                      >
                        <i className="fas fa-ellipsis-h text-sm"></i>
                      </Button>
                    </div>
                  </div>

                  {/* 제목 */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                    {post.title}
                  </h3>

                  {/* 내용 */}
                  {post.content && (
                    <p className="text-gray-700 dark:text-gray-400 text-sm mb-2 line-clamp-2">
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
                      : post.mediaUrl && post.mediaType === "image"
                        ? [convertImageUrl(post.mediaUrl)]
                        : [];
                  const hasMultipleImages = imageUrls.length > 1;

                  // 디버깅 로그 - 더 자세히
                  console.log(`📸 포스트 ${post.id} 이미지 분석:`, {
                    mediaType: post.mediaType,
                    hasMediaUrl: !!post.mediaUrl,
                    mediaUrl: post.mediaUrl,
                    hasMediaUrls: !!post.mediaUrls,
                    mediaUrls: post.mediaUrls,
                    imageUrlsLength: imageUrls.length,
                    imageUrls: imageUrls,
                    hasMultipleImages: hasMultipleImages,
                    willShowSlider: hasMultipleImages ? '✅ 슬라이더 표시' : '❌ 단일 이미지 표시'
                  });

                  if (imageUrls.length > 0 && (post.mediaType === "image" || !post.mediaType)) {
                    return (
                      <div 
                        className="px-3 mb-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 다중 이미지 수평 슬라이드 */}
                        {hasMultipleImages ? (
                          <div className="relative group bg-black/60 rounded-xl overflow-hidden">
                            {/* 수평 스크롤 컨테이너 */}
                            <div 
                              id={`slider-${post.id}`}
                              className="overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory scroll-smooth"
                              onScroll={(e) => {
                                const slider = e.currentTarget;
                                const scrollLeft = slider.scrollLeft;
                                const slideWidth = slider.offsetWidth;
                                const currentIndex = Math.round(scrollLeft / slideWidth);
                                setCurrentSlideIndex(prev => ({
                                  ...prev,
                                  [post.id]: currentIndex
                                }));
                              }}
                            >
                              <div className="flex h-[400px]">
                                {imageUrls.map((url, idx) => (
                                  <div
                                    key={idx}
                                    className="flex-shrink-0 w-full h-full snap-center relative cursor-pointer hover:opacity-95 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLightboxImages(imageUrls);
                                      setLightboxInitialIndex(idx);
                                      setLightboxOpen(true);
                                    }}
                                  >
                                    {/* 블러 배경 */}
                                    <div
                                      className="absolute inset-0 bg-cover bg-center blur-3xl opacity-50 pointer-events-none"
                                      style={{ backgroundImage: `url(${url})` }}
                                    />
                                    {/* 메인 이미지 */}
                                    <img
                                      src={url}
                                      alt={`${post.title} - ${idx + 1}`}
                                      loading="lazy"
                                      className="relative w-full h-full object-contain z-10"
                                      onLoad={() => console.log(`포스트 ${post.id} 이미지 ${idx + 1}/${imageUrls.length} 로드 성공:`, url)}
                                      onError={(e) => {
                                        console.error(`포스트 ${post.id} 이미지 ${idx + 1} 로드 실패:`, url);
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* 좌측 배경 오버레이 + 화살표 */}
                            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none"></div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const slider = document.getElementById(`slider-${post.id}`);
                                if (slider) {
                                  const scrollAmount = slider.offsetWidth;
                                  slider.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                                  console.log('이전 버튼 클릭, 스크롤:', -scrollAmount);
                                }
                              }}
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900/80 dark:bg-gray-800/90 hover:bg-gray-800/90 dark:hover:bg-gray-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-40 shadow-lg"
                              aria-label="이전 이미지"
                            >
                              <i className="fas fa-chevron-left text-xl"></i>
                            </button>
                            
                            {/* 우측 배경 오버레이 + 화살표 */}
                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none"></div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const slider = document.getElementById(`slider-${post.id}`);
                                if (slider) {
                                  const scrollAmount = slider.offsetWidth;
                                  slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                                  console.log('다음 버튼 클릭, 스크롤:', scrollAmount);
                                }
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900/80 dark:bg-gray-800/90 hover:bg-gray-800/90 dark:hover:bg-gray-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-40 shadow-lg"
                              aria-label="다음 이미지"
                            >
                              <i className="fas fa-chevron-right text-xl"></i>
                            </button>
                            
                            {/* 페이지네이션 인디케이터 - 이미지 안 하단 중앙 */}
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex justify-center gap-1.5 z-40">
                              {imageUrls.map((_, idx) => {
                                const isActive = (currentSlideIndex[post.id] || 0) === idx;
                                return (
                                  <button
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const slider = document.getElementById(`slider-${post.id}`);
                                      if (slider) {
                                        slider.scrollTo({ left: slider.offsetWidth * idx, behavior: 'smooth' });
                                        console.log(`포스트 ${post.id} 인디케이터 클릭:`, idx);
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
                              className="relative cursor-pointer hover:opacity-95 transition-opacity h-[400px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImages(imageUrls);
                                setLightboxInitialIndex(0);
                                setLightboxOpen(true);
                              }}
                            >
                              {/* 블러 배경 */}
                              <div
                                className="absolute inset-0 bg-cover bg-center blur-3xl opacity-50 pointer-events-none"
                                style={{
                                  backgroundImage: `url(${imageUrls[0]})`,
                                }}
                              />
                              {/* 메인 이미지 */}
                              <img
                                src={imageUrls[0]}
                                alt={post.title}
                                loading="lazy"
                                className="relative w-full h-full object-contain z-10"
                                onLoad={() => console.log('단일 이미지 로드 성공:', imageUrls[0])}
                                onError={(e) => {
                                  console.error('단일 이미지 로드 실패:', imageUrls[0]);
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
                        ref={(el) => setVideoRef(post.id, el)}
                        preload="metadata"
                        src={convertImageUrl(post.mediaUrl)}
                        className="relative w-full max-h-[500px] object-contain"
                        controls
                        loop
                        muted
                        playsInline
                        onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(post.id, "upvote");
                      }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(post.id, "downvote");
                      }}
                    >
                      <i className="fas fa-arrow-down text-xs"></i>
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-7 px-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePostClick(post.id);
                    }}
                  >
                    <i className="far fa-comment-alt text-sm"></i>
                    <span>{post.commentCount}</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-7 px-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white"
                    onClick={(e) => handleSharePost(post.id, e)}
                  >
                    <i className="fas fa-share text-sm"></i>
                    <span>공유</span>
                  </Button>

                  {/* 이모티콘 반응 */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEmojiPicker(
                          showEmojiPicker === post.id ? null : post.id,
                        );
                      }}
                    >
                      <i className="fas fa-smile text-sm"></i>
                    </Button>

                    {/* 이모티콘 피커 */}
                    {showEmojiPicker === post.id && (
                      <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 flex gap-1 z-10">
                        {availableEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            className="text-2xl hover:scale-125 transition-transform p-1"
                            onClick={(e) => handleReaction(post.id, emoji, e)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 이모티콘 표시 */}
                  {post.reactions && post.reactions.length > 0 && (
                    <div className="flex gap-1">
                      {post.reactions.map((reaction) => (
                        <button
                          key={reaction.emoji}
                          className={`h-7 px-2 rounded-full text-xs flex items-center gap-1 ${
                            post.userReactions?.includes(reaction.emoji)
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                          }`}
                          onClick={(e) =>
                            handleReaction(post.id, reaction.emoji, e)
                          }
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 w-7 p-0 rounded-full ${
                      post.isBookmarked
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white"
                    } ml-auto`}
                    onClick={(e) => handleBookmark(post.id, e)}
                  >
                    <i className={`fas fa-bookmark text-sm`}></i>
                  </Button>
                </div>
              </Card>
              );
            })}

            {/* 로딩 인디케이터 */}
            {isLoading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}

            {/* 무한 스크롤 트리거 */}
            {hasMore && <div ref={loadMoreRef} className="h-10" />}

            {/* 더 이상 포스트가 없을 때 */}
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                ALL 포스트를 불러왔습니다.
              </div>
            )}

            {/* 포스트가 없을 때 */}
            {!isLoading && posts.length === 0 && (
              <div className="text-center py-16">
                <i className="fas fa-inbox text-6xl text-gray-600 mb-4"></i>
                <p className="text-gray-400">아직 포스트가 없습니다.</p>
                <p className="text-sm text-gray-500 mt-2">
                  첫 번째 포스트를 작성해보세요!
                </p>
              </div>
            )}
          </div>

          {/* 오른쪽 사이드바 */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-4 space-y-3">
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
                                src={convertImageUrl(channel.userAvatar)}
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
                              <div className="text-white text-sm font-medium truncate">
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
                                  src={convertImageUrl(channel.userAvatar)}
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
                                <div className="text-white text-sm font-medium truncate">
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

              {/* 북마크 */}
              {user && bookmarkedPosts.length > 0 && (
                <Card className="bg-gray-50 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B]">
                  <div className="p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <i className="fas fa-bookmark"></i>
                      북마크
                    </h3>
                    <div className="space-y-3">
                      {bookmarkedPosts.slice(0, 5).map((post) => (
                        <div
                          key={post.id}
                          className="flex items-start gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors"
                          onClick={() =>
                            setLocation(`/discord?post=${post.id}`)
                          }
                        >
                          {post.mediaUrl && (
                            <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700">
                              {post.mediaType === "image" ? (
                                <img
                                  src={post.mediaUrl}
                                  alt={post.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <video
                                  src={post.mediaUrl}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium line-clamp-2">
                              {post.title}
                            </div>
                            <div className="text-gray-400 text-xs mt-1">
                              {post.commentCount} 댓글
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {bookmarkedPosts.length > 5 && (
                      <Button
                        variant="outline"
                        className="w-full mt-3 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                        onClick={() => setLocation("/bookmarks")}
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
      </div>

      {/* 플로팅 작성 버튼 */}
      {user && (
        <Button
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-2xl bg-gradient-to-br from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 z-50 border-2 border-black"
          onClick={() => setShowCreateModal(true)}
        >
          <i className="fas fa-plus text-lg text-white"></i>
        </Button>
      )}

      {/* 게시물 작성 모달 */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B] text-gray-900 dark:text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              새 게시물 작성
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 제목 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                제목 *
              </label>
              <Input
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="게시물 제목을 입력하세요"
                className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white"
                maxLength={200}
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                내용
              </label>
              <Textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="게시물 내용을 입력하세요 (선택사항)"
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white min-h-[120px]"
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
                value={newPostYoutubeUrl}
                onChange={(e) => setNewPostYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white"
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
              <p className="text-xs text-gray-500 mb-3">
                최대 50MB, 지원 형식: JPG, PNG, GIF, WEBP, MP4, MOV, WEBM
              </p>

              {/* 드래그 앤 드롭 영역 */}
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-700/50"
                onClick={() =>
                  document.getElementById("feed-media-upload")?.click()
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("border-blue-500");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-blue-500");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-blue-500");
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const fakeEvent = {
                      target: { files: [file] },
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
                  className="mt-2 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById("feed-media-upload")?.click();
                  }}
                >
                  <i className="fas fa-image mr-2"></i>
                  파일 선택
                </Button>
              </div>

              <input
                id="feed-media-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaSelect}
                className="hidden"
              />

              {newPostMedia.length > 0 && (
                <div className="mt-2 text-sm text-gray-400">
                  <p className="mb-2">
                    <i className="fas fa-images mr-2"></i>
                    {newPostMedia.length}개 파일 선택됨
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {newPostMedia.map((file, idx) => (
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
              {mediaPreviews.length > 0 && (
                <div className="mt-3 relative">
                  <div className="grid grid-cols-2 gap-2">
                    {mediaPreviews.map((preview, idx) => (
                      <div key={idx} className="relative group">
                        {newPostMedia[idx]?.type.startsWith("video") ? (
                          <video
                            src={preview}
                            className="w-full h-48 object-cover rounded-lg"
                            controls
                          />
                        ) : (
                          <img
                            src={preview}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        )}
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          {idx + 1}/{mediaPreviews.length}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => {
                      setNewPostMedia([]);
                      setMediaPreviews([]);
                    }}
                  >
                    <i className="fas fa-times mr-2"></i>
                    모든 파일 제거
                  </Button>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPostTitle("");
                  setNewPostContent("");
                  setNewPostMedia([]);
                  setMediaPreviews([]);
                }}
                disabled={isSubmitting}
              >
                <i className="fas fa-times mr-2"></i>
                취소
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleCreatePost}
                disabled={isSubmitting || !newPostTitle.trim()}
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
                  setReportPostId(null);
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

export default FeedView;
