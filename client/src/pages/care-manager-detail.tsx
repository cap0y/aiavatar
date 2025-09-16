import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Star,
  Truck,
  ShieldCheck,
  Clock,
  Package,
  Plus,
  Minus,
  ShoppingBag,
  Send,
  MessageSquare,
  Reply,
  AlertCircle,
} from "lucide-react";
import { Heart } from "lucide-react";
import { useQuery as useRQ, useMutation as useMut, useQueryClient as useQC } from "@tanstack/react-query";
import { favoritesAPI } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import BookingModal from "@/components/booking-modal";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { CareManager } from "@shared/schema";
import { useLocation } from "wouter";
import { normalizeImageUrl } from '@/lib/url';

// 소개글 콘텐츠 인터페이스 추가
interface IntroContent {
  id: string;
  type: 'text' | 'image' | 'link' | 'youtube';
  content: string;
  link?: string;
  description?: string;
}

interface CareManagerDetailProps {
  id: string;
}

interface Comment {
  id: number;
  userId: number;
  careManagerId: number;
  username: string;
  userImage?: string;
  content: string;
  createdAt: string;
  replies?: Reply[];
}

interface Reply {
  id: number;
  commentId: number;
  userId: number;
  username: string;
  userImage?: string;
  content: string;
  createdAt: string;
}

const CareManagerDetail = ({ id }: CareManagerDetailProps) => {
  const { user, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [comment, setComment] = useState("");
  const [replyContent, setReplyContent] = useState<Record<number, string>>({});
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [bookingModal, setBookingModal] = useState<{ isOpen: boolean }>({ isOpen: false });
  const commentRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [introContents, setIntroContents] = useState<IntroContent[]>([]);
  const qc = useQC();
  const { data: myFavorites = [] } = useRQ({
    queryKey: ["favorites", user?.uid],
    queryFn: () => favoritesAPI.getFavorites(user!.uid),
    enabled: !!user?.uid,
  });
  const existingFavorite = Array.isArray(myFavorites)
    ? myFavorites.find((f: any) => Number(f.careManagerId) === Number(id))
    : undefined;
  const addFav = useMut({
    mutationFn: async () => {
      if (!user?.uid) throw new Error("로그인이 필요합니다.");
      const careManagerId = Number(id);
      if (!careManagerId) throw new Error("케어 매니저 정보가 없습니다.");
      return favoritesAPI.addFavorite(user.uid, careManagerId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites", user?.uid] });
    },
  });
  const removeFav = useMut({
    mutationFn: async () => {
      if (!existingFavorite) return;
      return favoritesAPI.removeFavorite(existingFavorite.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites", user?.uid] });
    },
  });
  
  // 케어 매니저 정보 가져오기
  const { data: manager, isLoading } = useQuery<CareManager>({
    queryKey: [`/api/care-managers/${id}`],
  });

  // 소개글 콘텐츠 가져오기
  const { data: introContentsData } = useQuery<{ success: boolean; introContents: IntroContent[] }>({
    queryKey: [`/api/caremanager/${id}/intro-contents`],
    enabled: !!manager,
  });

  // 소개글 콘텐츠 설정
  useEffect(() => {
    if (introContentsData && introContentsData.introContents) {
      setIntroContents(introContentsData.introContents);
    }
  }, [introContentsData]);

  // 해시가 #comments인 경우 댓글 섹션으로 스크롤
  useEffect(() => {
    if (window.location.hash === '#comments' && commentRef.current) {
      commentRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (window.location.hash === '#location' && mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // 댓글 데이터 로드 (예시 데이터로 시작)
  useEffect(() => {
    // 실제 API가 있다면 해당 API로 교체 필요
    const sampleComments: Comment[] = [
      {
        id: 1,
        userId: 1,
        careManagerId: parseInt(id),
        username: "김하나",
        userImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&h=120&auto=format&fit=crop",
        content: "어머니를 잘 돌봐주셔서 감사합니다. 친절하고 세심한 케어에 어머니도 매우 만족하셨습니다.",
        createdAt: "2025-05-15T09:30:00",
        replies: [
          {
            id: 101,
            commentId: 1,
            userId: parseInt(id),
            username: manager?.name || "케어 매니저",
            userImage: manager?.imageUrl || undefined,
            content: "소중한 후기 감사합니다. 앞으로도 최선을 다하겠습니다.",
            createdAt: "2025-05-15T14:22:00"
          }
        ]
      },
      {
        id: 2,
        userId: 2,
        careManagerId: parseInt(id),
        username: "이민호",
        content: "부모님 병원 동행 서비스를 이용했는데 매우 만족스러웠습니다. 병원에서의 대기 시간도 지루하지 않게 잘 대화해주시고 친절했습니다.",
        createdAt: "2025-05-10T15:45:00"
      }
    ];
    
    setComments(sampleComments);
  }, [id, manager?.name, manager?.imageUrl]);

  const handleSubmitComment = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!comment.trim()) {
      toast({
        title: "오류",
        description: "댓글 내용을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    // 실제 API 연결 시 아래 코드 주석 해제
    // try {
    //   const response = await apiRequest("POST", `/api/comments`, {
    //     userId: user.uid,
    //     careManagerId: parseInt(id),
    //     content: comment,
    //   });
    //   const newComment = await response.json();
    //   setComments([newComment, ...comments]);
    //   setComment("");
    // } catch (error) {
    //   toast({
    //     title: "댓글 등록 실패",
    //     description: "댓글을 등록하는 중 오류가 발생했습니다.",
    //     variant: "destructive"
    //   });
    // }

    // 임시 구현 (API 연결 전)
    const newComment: Comment = {
      id: Math.max(0, ...comments.map(c => c.id)) + 1,
      userId: user?.uid ? parseInt(user.uid) : Math.floor(Math.random() * 1000),
      careManagerId: parseInt(id),
      username: user?.displayName || user?.email?.split('@')[0] || "사용자",
      userImage: user?.photoURL || undefined,
      content: comment,
      createdAt: new Date().toISOString(),
      replies: []
    };
    
    setComments([newComment, ...comments]);
    setComment("");
    
    toast({
      title: "댓글이 등록되었습니다.",
      description: "케어 매니저가 곧 답변할 거예요."
    });
  };

  const handleReply = (commentId: number) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    setReplyingTo(replyingTo === commentId ? null : commentId);
  };

  const handleSubmitReply = async (commentId: number) => {
    const content = replyContent[commentId];
    
    if (!content || !content.trim()) {
      toast({
        title: "오류",
        description: "답글 내용을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }
    
    // 실제 API 연결 시 아래 코드 주석 해제
    // try {
    //   const response = await apiRequest("POST", `/api/comments/${commentId}/replies`, {
    //     userId: user.uid,
    //     content,
    //   });
    //   const newReply = await response.json();
    //   
    //   const updatedComments = comments.map(c => {
    //     if (c.id === commentId) {
    //       return {
    //         ...c,
    //         replies: [...(c.replies || []), newReply]
    //       };
    //     }
    //     return c;
    //   });
    //   
    //   setComments(updatedComments);
    //   setReplyContent({ ...replyContent, [commentId]: "" });
    //   setReplyingTo(null);
    // } catch (error) {
    //   toast({
    //     title: "답글 등록 실패",
    //     description: "답글을 등록하는 중 오류가 발생했습니다.",
    //     variant: "destructive"
    //   });
    // }
    
    // 임시 구현 (API 연결 전)
    const newReply: Reply = {
      id: Math.floor(Math.random() * 1000) + 100,
      commentId,
      userId: user?.uid ? parseInt(user.uid) : Math.floor(Math.random() * 1000),
      username: user?.displayName || user?.email?.split('@')[0] || "사용자",
      userImage: user?.photoURL || undefined,
      content,
      createdAt: new Date().toISOString()
    };
    
    const updatedComments = comments.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          replies: [...(c.replies || []), newReply]
        };
      }
      return c;
    });
    
    setComments(updatedComments);
    setReplyContent({ ...replyContent, [commentId]: "" });
    setReplyingTo(null);
    
    toast({
      title: "답글이 등록되었습니다."
    });
  };

  const handleBookingClick = () => {
    if (!manager) return;
    
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setBookingModal({
      isOpen: true
    });
  };

  // 뒤로가기 핸들러
  const handleGoBack = () => {
    window.history.length > 1 ? window.history.back() : setLocation('/');
  };

  // 소개글 콘텐츠 렌더링 함수
  const renderIntroContent = (content: IntroContent) => {
    switch (content.type) {
      case 'text':
        return (
          <div className="mb-4">
            <p className="text-gray-700 whitespace-pre-wrap">{content.content}</p>
          </div>
        );
      case 'image':
        return (
          <div className="mb-4">
            {content.link ? (
              <a href={content.link} target="_blank" rel="noopener noreferrer" className="block">
                <img 
                  src={content.content} 
                  alt={content.description || "이미지"} 
                  className="w-full max-h-96 object-contain rounded-md border border-gray-200"
                />
                {content.description && (
                  <p className="text-sm text-gray-500 mt-1">{content.description}</p>
                )}
              </a>
            ) : (
              <>
                <img 
                  src={normalizeImageUrl(content.content)} 
                  alt={content.description || "이미지"} 
                  className="w-full max-h-96 object-contain rounded-md border border-gray-200"
                  onError={(e) => {
                    console.error("이미지 로드 오류:", content.content);
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // 재귀적 오류 방지
                    target.src = "/images/placeholder.jpg"; // 기본 이미지
                  }}
                />
                {content.description && (
                  <p className="text-sm text-gray-500 mt-1">{content.description}</p>
                )}
              </>
            )}
          </div>
        );
      case 'link':
        return (
          <div className="mb-4 p-3 border rounded-md bg-blue-50">
            <a 
              href={content.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center"
            >
              <i className="fas fa-external-link-alt mr-2"></i>
              {content.content}
            </a>
            {content.description && (
              <p className="text-sm text-gray-600 mt-1">{content.description}</p>
            )}
          </div>
        );
      case 'youtube':
        return (
          <div className="mb-4">
            <div className="aspect-video rounded-md overflow-hidden">
              <iframe 
                src={getYoutubeEmbedUrl(content.content)} 
                title={content.description || "YouTube 영상"}
                className="w-full h-full"
                allowFullScreen
              ></iframe>
            </div>
            {content.description && (
              <p className="text-sm text-gray-500 mt-1">{content.description}</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // YouTube URL을 임베드 URL로 변환하는 함수
  const getYoutubeEmbedUrl = (url: string): string => {
    // 다양한 유튜브 URL 형식 처리
    let videoId = "";
    
    // 표준 URL (https://www.youtube.com/watch?v=VIDEO_ID)
    if (url.includes("youtube.com/watch")) {
      const urlParams = new URL(url).searchParams;
      videoId = urlParams.get("v") || "";
    } 
    // 짧은 URL (https://youtu.be/VIDEO_ID)
    else if (url.includes("youtu.be")) {
      videoId = url.split("/").pop() || "";
    }
    // 이미 임베드 URL인 경우
    else if (url.includes("youtube.com/embed")) {
      return url; // 이미 올바른 형식
    }
    
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  if (isLoading || !manager) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[50vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-gray-500">케어 매니저 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  const rating = manager.rating / 10; // Convert from integer to decimal

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 뒤로가기 버튼 */}
      <div className="mb-4 sm:mb-6 flex items-center">
        <Button 
          variant="ghost" 
          onClick={handleGoBack}
          className="text-gray-600 hover:text-gray-900 flex items-center"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          뒤로가기
        </Button>
      </div>

      <Card className="mb-6 sm:mb-8 border border-gray-200 rounded-2xl shadow-md overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          {/* 프로필 헤더 - 모바일 최적화 */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-5 mb-6">
            {/* 아바타 이미지 - 모바일에서 중앙 정렬 */}
            <div className="flex justify-center sm:justify-start mb-4 sm:mb-0">
              <Avatar className="w-24 h-24 rounded-full border-4 border-white shadow-lg">
                <AvatarImage src={normalizeImageUrl(manager.imageUrl || undefined)} alt={manager.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-2xl">
                  {manager.name[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* 프로필 정보 */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-800">{manager.name}</h1>
                <div className="flex items-center justify-center sm:justify-start space-x-2 mt-1 sm:mt-0">
                  <span className="text-gray-500">({manager.age}세)</span>
                  {manager.certified && (
                    <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                      <i className="fas fa-check mr-1"></i>
                      인증
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center sm:justify-start text-gray-700 mb-2">
                <i className="fas fa-map-marker-alt mr-2 text-red-500"></i>
                {manager.location}
              </div>
              <div className="flex items-center justify-center sm:justify-start mb-2 flex-wrap">
                <div className="flex items-center mr-4">
                  <i className="fas fa-star text-yellow-400 mr-1"></i>
                  <span className="font-semibold">{rating}</span>
                  <span className="text-gray-500 ml-1">({manager.reviews})</span>
                </div>
                <div className="flex items-center">
                  <i className="fas fa-history text-purple-500 mr-1"></i>
                  <span>경력 {manager.experience}</span>
                </div>
              </div>
              <div className="text-xl font-bold text-purple-600 mb-4 sm:mb-0">
                시간당 {manager.hourlyRate.toLocaleString()}원
              </div>
            </div>
            
            {/* 예약 버튼 - 모바일에서는 하단에 표시 */}
            <div className="mt-4 sm:mt-0 flex justify-center sm:justify-start">
              <Button 
                className="gradient-purple text-white rounded-full shadow-md px-6"
                onClick={handleBookingClick}
              >
                <i className="fas fa-calendar-alt mr-2"></i>
                예약하기
              </Button>
            </div>
          </div>

          {/* 서비스 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">제공 서비스</h2>
            <div className="flex flex-wrap gap-2">
              {(manager.services as any[]).map((service: any, index) => (
                <Badge key={index} variant="outline" className="px-3 py-1 text-sm rounded-full">
                  {typeof service === "string" ? service : service.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* 위치 정보 및 지도 섹션 추가 */}
          <div className="mb-6" id="location" ref={mapRef}>
            <h2 className="text-lg font-semibold mb-3 flex items-center">
              <i className="fas fa-map-marker-alt mr-2 text-red-500"></i>
              활동 지역
            </h2>
            <div className="bg-slate-50 rounded-xl p-4 mb-3">
              <p className="text-gray-700">
                {manager.name} 케어 매니저님은 <span className="font-medium">{manager.location}</span> 지역을 중심으로 활동하고 있습니다.
              </p>
            </div>
            <div className="w-full h-[300px] rounded-xl overflow-hidden shadow-md" id="detail-map-container">
              {/* 단일 케어 매니저 위치만 표시하는 지도 */}
              {manager && (
                <iframe 
                  src={`https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(manager.location)}&key=AIzaSyDZZkoRGw9UByZ2vuNC9j95H4EYcxCl1Vs`}
                  width="100%" 
                  height="100%" 
                  style={{ border: 0 }} 
                  allowFullScreen 
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`${manager.name} 케어 매니저 활동 지역`}
                ></iframe>
              )}
            </div>
          </div>

          {/* 소개 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">소개</h2>
            <div className="bg-slate-50 rounded-xl p-4 text-gray-700">
              {manager.description || 
                `안녕하세요, ${manager.experience} 경력의 ${manager.name} 케어 매니저입니다.
                정성을 다해 어르신을 모시겠습니다. 병원 동행, 말벗 서비스 등 다양한 케어 서비스를 제공하고 있으며,
                어르신의 상태와 요구사항에 맞는 맞춤 케어를 제공해 드립니다.`
              }
            </div>
            
            {/* 소개글 콘텐츠 표시 */}
            {introContents && introContents.length > 0 && (
              <div className="mt-4 space-y-2">
                {introContents.map((content) => (
                  <div key={content.id} className="mt-4">
                    {renderIntroContent(content)}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* 경력 및 자격증 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">경력 및 자격증</h2>
            <ul className="space-y-2 ml-6 list-disc text-gray-700">
              {/* 경력 정보가 있으면 표시, 없으면 기본 경력 표시 */}
              {manager.experience ? 
                manager.experience.split('\n').filter(exp => exp.trim()).map((exp, index) => (
                  <li key={`exp-${index}`}>{exp}</li>
                ))
              : (
                <>
                  <li>요양보호사 자격증 보유</li>
                  <li>대형병원 간병인 경력</li>
                  <li>심폐소생술(CPR) 교육 이수</li>
                  <li>치매 환자 케어 전문 교육 이수</li>
                </>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 댓글 섹션 */}
      <div ref={commentRef} className="mt-8 sm:mt-12" id="comments">
        <h2 className="text-xl font-bold mb-4 sm:mb-6 flex items-center">
          <i className="fas fa-comments text-purple-600 mr-2"></i>
          문의 및 후기
        </h2>
        
        {/* 댓글 작성 */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
              <Avatar className="w-10 h-10 mx-auto sm:mx-0">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback className="bg-purple-100 text-purple-600">
                  {user ? (user.displayName?.[0] || user.email?.[0] || "U") : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={user ? "케어 매니저에게 문의하거나 후기를 남겨보세요." : "로그인 후 댓글을 작성할 수 있습니다."}
                  className="mb-3 resize-none"
                  rows={3}
                  disabled={!user}
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSubmitComment} 
                    disabled={!user || !comment.trim()} 
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <i className="fas fa-paper-plane mr-2"></i>
                    등록하기
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 댓글 목록 - 모바일 최적화 */}
        <div className="space-y-6">
          {comments.map((comment) => (
            <Card key={comment.id} className="border-gray-200">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                  <Avatar className="w-10 h-10 mx-auto sm:mx-0">
                    <AvatarImage src={comment.userImage} />
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {comment.username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-2 sm:mb-1 text-center sm:text-left">
                      <span className="font-semibold">{comment.username}</span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(comment.createdAt), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-3 text-center sm:text-left">{comment.content}</p>
                    <div className="flex justify-center sm:justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleReply(comment.id)}
                        className="text-gray-500 hover:text-purple-600"
                      >
                        <i className="fas fa-reply mr-1"></i>
                        답글
                      </Button>
                    </div>
                    
                    {/* 답글 작성 폼 */}
                    {replyingTo === comment.id && (
                      <div className="mt-3 pl-0 sm:pl-4 border-l-0 sm:border-l-2 border-gray-200">
                        <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0 items-start">
                          <Avatar className="w-8 h-8 mx-auto sm:mx-0">
                            <AvatarImage src={user?.photoURL || undefined} />
                            <AvatarFallback className="bg-purple-100 text-purple-600">
                              {user ? (user.displayName?.[0] || user.email?.[0] || "U") : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 w-full">
                            <Input
                              value={replyContent[comment.id] || ''}
                              onChange={(e) => setReplyContent({
                                ...replyContent,
                                [comment.id]: e.target.value
                              })}
                              placeholder="답글을 입력하세요..."
                              className="mb-2"
                            />
                            <div className="flex justify-center sm:justify-end space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setReplyingTo(null)}
                              >
                                취소
                              </Button>
                              <Button 
                                size="sm" 
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={() => handleSubmitReply(comment.id)}
                              >
                                답글 등록
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 답글 목록 */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-4 space-y-4 pl-0 sm:pl-6 border-l-0 sm:border-l-2 border-gray-100">
                        {comment.replies.map(reply => (
                          <div key={reply.id} className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
                            <Avatar className="w-8 h-8 mx-auto sm:mx-0">
                              <AvatarImage src={reply.userImage} />
                              <AvatarFallback className={
                                reply.userId === parseInt(id)
                                  ? "bg-purple-100 text-purple-600"
                                  : "bg-blue-100 text-blue-600"
                              }>
                                {reply.username[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-1 text-center sm:text-left">
                                <span className={`font-semibold ${reply.userId === parseInt(id) ? "text-purple-600" : ""}`}>
                                  {reply.username}
                                  {reply.userId === parseInt(id) && (
                                    <Badge className="ml-2 text-xs bg-purple-100 text-purple-600">
                                      케어 매니저
                                    </Badge>
                                  )}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {format(new Date(reply.createdAt), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                                </span>
                              </div>
                              <p className="text-gray-700 text-center sm:text-left">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 예약 모달 */}
      {bookingModal.isOpen && manager && (
        <BookingModal
          isOpen={bookingModal.isOpen}
          onClose={() => setBookingModal({ isOpen: false })}
          manager={manager}
          userId={user?.uid ? parseInt(user.uid) : 1}
          serviceId={(manager.services as string[]).length > 0 ? 1 : 1}
          onSuccess={() => {
            toast({
              title: "예약 완료",
              description: "예약이 성공적으로 등록되었습니다."
            });
          }}
        />
      )}

      {/* 반응형 스타일 추가 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .gradient-purple {
            width: 100%;
            margin-top: 1rem;
          }
        }
      `}} />
    </div>
  );
};

export default CareManagerDetail; 