import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import BottomNavigation from "@/components/bottom-navigation";

// 소개글 콘텐츠 인터페이스 추가
interface IntroContent {
  id: string;
  type: 'text' | 'image' | 'link' | 'youtube';
  content: string;
  link?: string;
  description?: string;
}

// 서비스 패키지 인터페이스
interface ServicePackage {
  type: 'basic' | 'standard' | 'premium';
  title: string;
  price: number;
  description: string;
  draftCount: number;
  workDays: number;
  revisionCount: number;
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
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);
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
      if (!careManagerId) throw new Error("AI크리에이터 정보가 없습니다.");
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
  
  // AI크리에이터 정보 가져오기
  const { data: manager, isLoading } = useQuery<CareManager>({
    queryKey: [`/api/care-managers/${id}`],
  });

  // 소개글 콘텐츠 가져오기
  const { data: introContentsData } = useQuery<{ success: boolean; introContents: IntroContent[] }>({
    queryKey: [`/api/caremanager/${id}/intro-contents`],
    enabled: !!manager,
  });

  // 서비스 패키지 가져오기
  const { data: servicePackagesData } = useQuery<{ success: boolean; packages: ServicePackage[] }>({
    queryKey: [`/api/caremanager/${id}/service-packages`],
    enabled: !!manager,
  });

  // 소개글 콘텐츠 설정
  useEffect(() => {
    if (introContentsData && introContentsData.introContents) {
      setIntroContents(introContentsData.introContents);
    }
  }, [introContentsData]);

  // 서비스 패키지 설정
  useEffect(() => {
    if (servicePackagesData && servicePackagesData.packages) {
      setServicePackages(servicePackagesData.packages);
    }
  }, [servicePackagesData]);

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
        content: "친절하고 세심한 작업에 매우 만족합니다.",
        createdAt: "2025-05-15T09:30:00",
        replies: [
          {
            id: 101,
            commentId: 1,
            userId: parseInt(id),
            username: manager?.name || "AI 크리에이터",
            userImage: manager?.photoURL || undefined,
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
        content: "AI아바타 캐릭터 작업 이용했는데 매우 만족스러웠습니다. 잘 대화해주시고 친절했습니다.",
        createdAt: "2025-05-10T15:45:00"
      }
    ];
    
    setComments(sampleComments);
  }, [id, manager?.name, manager?.photoURL]);

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
      description: "AI크리에이터 매니저가 곧 답변할 거예요."
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

    // 서비스 패키지가 있으면 패키지 섹션으로 스크롤
    if (servicePackages && servicePackages.length > 0) {
      const packageSection = document.querySelector('[data-package-section]');
      if (packageSection) {
        packageSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast({
          title: "패키지를 선택해주세요",
          description: "원하시는 서비스 패키지를 선택하여 의뢰하실 수 있습니다."
        });
      }
    } else {
      setBookingModal({
        isOpen: true
      });
    }
  };

  // 패키지 선택하여 의뢰하기
  const handlePackageBooking = (pkg: ServicePackage) => {
    if (!manager) return;
    
    if (!user) {
      setShowAuthModal(true);
      toast({
        title: "로그인이 필요합니다",
        description: "의뢰하기 위해서는 로그인이 필요합니다.",
        variant: "destructive"
      });
      return;
    }

    // 기본 작업비 계산
    const basePrice = manager.hourlyRate ? Math.round(parseFloat(manager.hourlyRate)) : 0;
    const packagePrice = pkg.price;
    const totalPrice = basePrice + packagePrice;

    // 결제 정보를 위한 상품 객체 생성
    const checkoutItem = {
      id: `booking_${manager.id}_${pkg.type}_${Date.now()}`,
      type: 'service', // 서비스 상품
      name: `${manager.name} - ${pkg.title}`,
      description: pkg.description,
      price: totalPrice,
      image: normalizeImageUrl(manager.photoURL || undefined),
      quantity: 1,
      // 패키지 상세 정보
      packageInfo: {
        careManagerId: manager.id,
        careManagerName: manager.name,
        careManagerPhoto: manager.photoURL,
        packageType: pkg.type,
        packageTitle: pkg.title,
        packagePrice: packagePrice,
        basePrice: basePrice,
        totalPrice: totalPrice,
        packageDescription: pkg.description,
        draftCount: pkg.draftCount,
        workDays: pkg.workDays,
        revisionCount: pkg.revisionCount
      }
    };

    // localStorage에 결제할 상품 정보 저장
    localStorage.setItem('checkoutItems', JSON.stringify([checkoutItem]));
    localStorage.setItem('checkoutType', 'service'); // 서비스 결제임을 표시
    localStorage.setItem('checkoutReturnUrl', `/care-manager/${manager.id}`); // 뒤로가기용 URL 저장

    // 결제 확인 메시지
    toast({
      title: "결제 페이지로 이동",
      description: `총 ${totalPrice.toLocaleString()}원 (기본 작업비 ${basePrice.toLocaleString()}원 + 패키지 ${packagePrice.toLocaleString()}원)`
    });

    // 결제 페이지로 이동
    setTimeout(() => {
      setLocation('/checkout');
    }, 800);
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
            <p className="text-gray-300 whitespace-pre-wrap">{content.content}</p>
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
                  className="w-full max-h-96 object-contain rounded-md border border-gray-600"
                />
                {content.description && (
                  <p className="text-sm text-gray-400 mt-1">{content.description}</p>
                )}
              </a>
            ) : (
              <>
                <img 
                  src={normalizeImageUrl(content.content)} 
                  alt={content.description || "이미지"} 
                  className="w-full max-h-96 object-contain rounded-md border border-gray-600"
                  onError={(e) => {
                    console.error("이미지 로드 오류:", content.content);
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // 재귀적 오류 방지
                    target.src = "/images/placeholder.jpg"; // 기본 이미지
                  }}
                />
                {content.description && (
                  <p className="text-sm text-gray-400 mt-1">{content.description}</p>
                )}
              </>
            )}
          </div>
        );
      case 'link':
        return (
          <div className="mb-4 p-3 border rounded-md bg-purple-900/20 border-purple-500/30">
            <a 
              href={content.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 hover:underline font-medium flex items-center"
            >
              <i className="fas fa-external-link-alt mr-2"></i>
              {content.content}
            </a>
            {content.description && (
              <p className="text-sm text-gray-400 mt-1">{content.description}</p>
            )}
          </div>
        );
      case 'youtube':
        return (
          <div className="mb-4">
            <div className="aspect-video rounded-md overflow-hidden border border-gray-600">
              <iframe 
                src={getYoutubeEmbedUrl(content.content)} 
                title={content.description || "YouTube 영상"}
                className="w-full h-full"
                allowFullScreen
              ></iframe>
            </div>
            {content.description && (
              <p className="text-sm text-gray-400 mt-1">{content.description}</p>
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
          <p className="text-gray-500">AI크리에이터 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  const rating = manager.rating ? parseFloat(manager.rating) : 5.0; // Use rating as-is

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 뒤로가기 버튼 */}
        <div className="mb-4 sm:mb-6 flex items-center">
          <Button 
            variant="ghost" 
            onClick={handleGoBack}
            className="text-gray-400 hover:text-white flex items-center"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            뒤로가기
          </Button>
        </div>

        <Card className="mb-6 sm:mb-8 bg-gray-800 border-gray-700 rounded-2xl shadow-md overflow-hidden">
          <CardContent className="p-4 sm:p-6">
          {/* 프로필 헤더 - 모바일 최적화 */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-5 mb-6">
            {/* 아바타 이미지 - 모바일에서 중앙 정렬 */}
            <div className="flex justify-center sm:justify-start mb-4 sm:mb-0">
              <Avatar className="w-24 h-24 rounded-full border-4 border-purple-500 shadow-lg">
                <AvatarImage src={normalizeImageUrl(manager.photoURL || undefined)} alt={manager.name} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl">
                  {manager.name[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* 프로필 정보 */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-white">{manager.name}</h1>
                <div className="flex items-center justify-center sm:justify-start space-x-2 mt-1 sm:mt-0">
                  <span className="text-gray-400">AI 크리에이터</span>
                  {manager.isApproved && (
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white">
                      <i className="fas fa-check-circle mr-1"></i>
                      인증
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center sm:justify-start text-gray-300 mb-2">
                <i className="fas fa-palette mr-2 text-purple-400"></i>
                {manager.specialization || "AI 아바타 전문가"}
              </div>
              <div className="flex items-center justify-center sm:justify-start mb-2 flex-wrap">
                <div className="flex items-center mr-4 text-gray-300">
                  <i className="fas fa-star text-yellow-400 mr-1"></i>
                  <span className="font-semibold">{manager.rating ? parseFloat(manager.rating).toFixed(1) : "5.0"}</span>
                  <span className="text-gray-400 ml-1">(후기 다수)</span>
                </div>
                <div className="flex items-center text-gray-300">
                  <i className="fas fa-briefcase text-purple-400 mr-1"></i>
                  <span>경력 {manager.experience || "3년 이상"}</span>
                </div>
              </div>
              <div className="text-xl font-bold text-purple-400 mb-4 sm:mb-0">
              기본 작업비 {manager.hourlyRate ? Math.round(parseFloat(manager.hourlyRate)).toLocaleString() : "50,000"}원
              </div>
            </div>

          </div>

          {/* 전문 분야 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">전문 분야</h2>
            <div className="flex flex-wrap gap-2">
              {manager.specialization && (
                <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30 px-3 py-1 text-sm rounded-full">
                  {manager.specialization}
                </Badge>
              )}
              <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/30 px-3 py-1 text-sm rounded-full">
                AI 아바타 제작
              </Badge>
              <Badge className="bg-pink-600/20 text-pink-300 border-pink-500/30 px-3 py-1 text-sm rounded-full">
                캐릭터 디자인
              </Badge>
              <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-500/30 px-3 py-1 text-sm rounded-full">
                Live2D 모델링
              </Badge>
            </div>
          </div>

          {/* 소개 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">
              <i className="fas fa-user-circle mr-2 text-purple-400"></i>
              크리에이터 소개
            </h2>
            <div className="bg-gray-700/50 rounded-xl p-4 text-gray-300 whitespace-pre-wrap">
              {manager.description || `안녕하세요, ${manager.experience || "3년 이상"} 경력의 AI 크리에이터 ${manager.name}입니다.
AI 아바타 제작과 캐릭터 디자인에 열정을 가지고 있으며, 고객님의 아이디어를 
생동감 있는 AI 아바타로 구현해드립니다. Live2D 모델링과 캐릭터 커스터마이징을 
전문으로 하며, 고품질의 작품을 제공하기 위해 항상 최선을 다하고 있습니다.`}
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

          {/* 서비스 패키지 */}
          {servicePackages && servicePackages.length > 0 && (
            <div className="mb-6" data-package-section>
              <h2 className="text-lg font-semibold text-white mb-4">
                <i className="fas fa-box mr-2 text-purple-400"></i>
                서비스 패키지
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                원하시는 패키지를 선택하여 의뢰하실 수 있습니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {servicePackages.map((pkg) => (
                  <Card key={pkg.type} className="bg-gray-700 border-gray-600 hover:border-purple-500 transition-all flex flex-col">
                    <CardContent className="p-4 flex flex-col flex-1">
                      {/* 카드 헤더 */}
                      <div className="text-center mb-3">
                        <div className="text-xl font-bold text-white mb-2">
                          {pkg.type === 'basic' && '🥉 기본형'}
                          {pkg.type === 'standard' && '🥈 일반형'}
                          {pkg.type === 'premium' && '🥇 고급형'}
                        </div>
                        {/* 가격 세부 내역 */}
                        <div className="mb-2">
                          <div className="text-sm text-gray-400">
                            기본 작업비: {manager.hourlyRate ? Math.round(parseFloat(manager.hourlyRate)).toLocaleString() : '0'}원
                          </div>
                          <div className="text-sm text-gray-400">
                            패키지: {pkg.price.toLocaleString()}원
                          </div>
                        </div>
                        {/* 총 금액 */}
                        <div className="text-2xl font-bold text-purple-400 border-t border-gray-600 pt-2">
                          총 {(pkg.price + (manager.hourlyRate ? Math.round(parseFloat(manager.hourlyRate)) : 0)).toLocaleString()}원
                        </div>
                      </div>

                      {/* 제목 */}
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-gray-400 mb-1">제목</div>
                        <div className="text-sm font-medium text-white">
                          {pkg.title || '제목 없음'}
                        </div>
                      </div>

                      {/* 내용 */}
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-gray-400 mb-1">내용</div>
                        <p className="text-sm text-gray-300">
                          {pkg.description || '내용 없음'}
                        </p>
                      </div>

                      {/* 세부 정보 */}
                      <div className="space-y-2 border-t border-gray-600 pt-3 mb-4">
                        <div className="flex items-center text-sm text-gray-300">
                          <i className="fas fa-image w-5 text-blue-400"></i>
                          <span>시안 {pkg.draftCount}개</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-300">
                          <i className="fas fa-calendar-alt w-5 text-green-400"></i>
                          <span>작업일 {pkg.workDays}일</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-300">
                          <i className="fas fa-redo w-5 text-yellow-400"></i>
                          <span>수정 {pkg.revisionCount}회</span>
                        </div>
                      </div>

                      {/* 의뢰하기 버튼 - 하단에 고정 */}
                      <div className="mt-auto">
                        <Button 
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 rounded-lg shadow-lg transition-all"
                          onClick={() => handlePackageBooking(pkg)}
                        >
                          <i className="fas fa-paper-plane mr-2"></i>
                          의뢰하기
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {/* 경력 및 포트폴리오 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">
              <i className="fas fa-briefcase mr-2 text-purple-400"></i>
              경력 및 포트폴리오
            </h2>
            <ul className="space-y-2 ml-6 list-disc text-gray-300">
              <li>AI 아바타 제작 경력 {manager.experience || "3년 이상"}</li>
              <li>Live2D 모델링 전문가</li>
              <li>캐릭터 디자인 및 일러스트 작업</li>
              <li>VTuber 모델 제작 다수</li>
              <li>고객 맞춤형 아바타 커스터마이징</li>
            </ul>
          </div>
          </CardContent>
        </Card>

        {/* 댓글 섹션 */}
        <div ref={commentRef} className="mt-8 sm:mt-12" id="comments">
          <h2 className="text-xl font-bold text-white mb-4 sm:mb-6 flex items-center">
            <i className="fas fa-comments text-purple-400 mr-2"></i>
            문의 및 후기
          </h2>
          
          {/* 댓글 작성 */}
          <Card className="mb-6 bg-gray-800 border-gray-700">
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
                  placeholder={user ? "AI 크리에이터에게 문의하거나 후기를 남겨보세요." : "로그인 후 댓글을 작성할 수 있습니다."}
                  className="mb-3 resize-none bg-gray-700 text-white border-gray-600"
                  rows={3}
                  disabled={!user}
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSubmitComment} 
                    disabled={!user || !comment.trim()} 
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
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
              <Card key={comment.id} className="bg-gray-800 border-gray-700">
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
                      <span className="font-semibold text-white">{comment.username}</span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(comment.createdAt), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                      </span>
                    </div>
                    <p className="text-gray-300 mb-3 text-center sm:text-left">{comment.content}</p>
                    <div className="flex justify-center sm:justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleReply(comment.id)}
                        className="text-gray-400 hover:text-purple-400"
                      >
                        <i className="fas fa-reply mr-1"></i>
                        답글
                      </Button>
                    </div>
                    
                    {/* 답글 작성 폼 */}
                    {replyingTo === comment.id && (
                      <div className="mt-3 pl-0 sm:pl-4 border-l-0 sm:border-l-2 border-gray-600">
                        <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0 items-start">
                          <Avatar className="w-8 h-8 mx-auto sm:mx-0">
                            <AvatarImage src={user?.photoURL || undefined} />
                            <AvatarFallback className="bg-purple-500 text-white">
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
                              className="mb-2 bg-gray-700 text-white border-gray-600"
                            />
                            <div className="flex justify-center sm:justify-end space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setReplyingTo(null)}
                                className="text-gray-400 hover:text-white"
                              >
                                취소
                              </Button>
                              <Button 
                                size="sm" 
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
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
                      <div className="mt-4 space-y-4 pl-0 sm:pl-6 border-l-0 sm:border-l-2 border-gray-600">
                        {comment.replies.map(reply => (
                          <div key={reply.id} className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
                            <Avatar className="w-8 h-8 mx-auto sm:mx-0">
                              <AvatarImage src={reply.userImage} />
                              <AvatarFallback className={
                                reply.userId === parseInt(id)
                                  ? "bg-purple-500 text-white"
                                  : "bg-blue-500 text-white"
                              }>
                                {reply.username[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-1 text-center sm:text-left">
                                <span className={`font-semibold ${reply.userId === parseInt(id) ? "text-purple-400" : "text-white"}`}>
                                  {reply.username}
                                  {reply.userId === parseInt(id) && (
                                    <Badge className="ml-2 text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                                      AI 크리에이터
                                    </Badge>
                                  )}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {format(new Date(reply.createdAt), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                                </span>
                              </div>
                              <p className="text-gray-300 text-center sm:text-left">{reply.content}</p>
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

        {/* 예약 모달 (서비스 패키지가 없을 때만 사용) */}
        {bookingModal.isOpen && manager && (!servicePackages || servicePackages.length === 0) && (
          <BookingModal
            isOpen={bookingModal.isOpen}
            onClose={() => setBookingModal({ isOpen: false })}
            manager={manager}
            userId={user?.uid ? parseInt(user.uid) : 1}
            onSuccess={() => {
              toast({
                title: "의뢰 완료",
                description: "의뢰가 성공적으로 등록되었습니다."
              });
            }}
          />
        )}
      </div>
      
      <BottomNavigation />
    </div>
  );
};

export default CareManagerDetail; 