import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { createChatRoom } from "@/lib/socket";
import { normalizeImageUrl } from '@/lib/url';

interface Booking {
  id: number;
  userId: string;
  careManagerId: number;
  serviceId: number;
  date: string;
  duration: number;
  status: string;
  totalAmount: number;
  notes: string;
  careManager?: {
    id: number;
    name: string;
    imageUrl?: string;
    // 추가 필드가 있다면 여기에 정의
  };
  service?: {
    name: string;
    // 추가 필드가 있다면 여기에 정의
  };
}

const statusMap = {
  pending: { label: "승인 대기", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  confirmed: { label: "예약 확정", color: "bg-blue-100 text-blue-700 border-blue-200" },
  ongoing: { label: "서비스 진행 중", color: "bg-green-100 text-green-700 border-green-200" },
  completed: { label: "완료", color: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelled: { label: "취소됨", color: "bg-red-100 text-red-700 border-red-200" },
};

const Bookings = () => {
  const { user, setShowAuthModal } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [needAuth, setNeedAuth] = useState(false);
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // 인증이 필요한 경우 모달 표시 처리
  useEffect(() => {
    if (needAuth) {
      setShowAuthModal(true);
    }
  }, [needAuth, setShowAuthModal]);

  // 로그인 상태 확인
  useEffect(() => {
    if (!user) {
      setNeedAuth(true);
    } else {
      setNeedAuth(false);
    }
  }, [user]);

  // 직접 API를 호출하여 데이터 가져오기
  const fetchBookingsDirectly = async () => {
    try {
      // 로그인한 사용자의 ID를 사용
      const userId = user?.uid || "";
      console.log("로그인 사용자 정보:", { 
        uid: userId, 
        displayName: user?.displayName,
        email: user?.email,
        idType: typeof userId
      });
      
      if (!userId) {
        console.log("로그인한 사용자 ID가 없습니다");
        return []; // 로그인하지 않은 경우 빈 배열 반환
      }
      
      // 실제 로그인한 사용자의 ID로 예약 조회
      console.log(`예약 API 호출: /api/bookings/user/${userId}`);
      const response = await apiRequest("GET", `/api/bookings/user/${userId}`);
      const data = await response.json();
      console.log(`예약 API 응답 데이터:`, data);
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log("API에서 데이터를 받지 못했거나 빈 배열을 받음");
        return []; 
      }

      // 예약 데이터 전처리 - 케어 매니저 정보가 없는 경우 기본값 설정
      return data.map(booking => ({
        ...booking,
        careManager: booking.careManager || {
          id: booking.careManagerId,
          name: `케어 매니저 #${booking.careManagerId}`,
          imageUrl: undefined
        },
        service: booking.service || {
          name: "서비스 정보 없음"
        }
      }));
    } catch (error) {
      console.error("예약 목록 가져오기 실패:", error);
      return []; // 오류 발생 시 빈 배열 반환
    }
  };

  // 수동으로 데이터 가져오기 위한 함수
  const manualFetch = async () => {
    try {
      console.log("수동으로 예약 데이터 가져오기 시도");
      
      // 로그인한 사용자의 ID를 사용
      const userId = user?.uid || "";
      if (!userId) {
        toast({
          title: "로그인 필요",
          description: "예약 조회를 위해 로그인이 필요합니다.",
          variant: "destructive"
        });
        return [];
      }
      
      const response = await fetch(`/api/bookings/user/${userId}`);
      const data = await response.json();
      console.log("수동 API 응답:", data);
      
      // 데이터가 있으면 React Query 캐시 업데이트
      if (Array.isArray(data) && data.length > 0) {
        queryClient.setQueryData(["/api/bookings/user", user?.uid], data);
        toast({
          title: "데이터 로드 성공",
          description: `${data.length}개의 예약 데이터를 가져왔습니다.`,
        });
      } else {
        toast({
          title: "데이터 없음",
          description: "예약 데이터가 없습니다.",
          variant: "destructive"
        });
      }
      
      return data;
    } catch (error) {
      console.error("수동 데이터 가져오기 실패:", error);
      toast({
        title: "데이터 가져오기 실패",
        description: "API 호출 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      return [];
    }
  };

  // 예약 목록 조회 쿼리
  const { data: bookings, isLoading: isQueryLoading, refetch } = useQuery<Booking[]>({
    queryKey: ["/api/bookings/user", user?.uid],
    queryFn: fetchBookingsDirectly,
    enabled: true, // 항상 활성화
    staleTime: 0, // 항상 최신 데이터를 요청하도록 설정
    refetchOnWindowFocus: true, // 윈도우에 포커스가 돌아올 때 다시 요청
    refetchOnMount: true, // 컴포넌트가 마운트될 때 다시 요청
  });

  // 컴포넌트 마운트 및 사용자 변경 시 예약 목록 갱신
  useEffect(() => {
    console.log("컴포넌트 마운트 또는 사용자 변경, 예약 목록 갱신 시도");
    refetch();
  }, [refetch]); // user?.uid 의존성 제거하여 항상 데이터를 가져오도록 함

  // 로그인 상태 확인 후 로그인이 필요하면 빈 화면 반환
  if (needAuth) {
    return null;
  }

  // 모든 예약 데이터 표시 (디버깅용으로 필터링 일시 제거)
  const allBookings = bookings || [];
  console.log("모든 예약 데이터:", allBookings);

  // 상태에 따라 예약 필터링
  const filteredBookings = bookings?.filter(booking => {
    // 필터링 전에 유효한 데이터인지 확인
    if (!booking) return false;
    
    // 수정된 필터링 로직: 'confirmed'는 'ongoing' 탭으로 이동
    switch (activeTab) {
      case "upcoming":
        // 예약 대기 중인 예약만 표시 (confirmed는 더 이상 여기에 포함되지 않음)
        return booking.status === "pending";
      case "ongoing":
        // 진행 중 + 확정된 예약을 이 탭에 표시
        return booking.status === "ongoing" || booking.status === "confirmed";
      case "completed":
        return booking.status === "completed" || booking.status === "cancelled";
      default:
        return true;
    }
  }) || [];

  console.log("예약 현황:", {
    total: bookings?.length || 0,
    filtered: filteredBookings.length,
    activeTab,
    rawData: bookings
  });

  // handleChatClick 함수 수정 - 연결 유지 보장
  const handleChatClick = async (careManagerId: number, careManagerName?: string) => {
    try {
      if (!user) {
        toast({
          title: "로그인 필요",
          description: "채팅을 시작하려면 로그인이 필요합니다.",
        });
        return;
      }

      // 로딩 상태 설정
      setIsLoading(true);
      console.log(`채팅 시작: 케어매니저 ID=${careManagerId}, 사용자 ID=${user.uid}`);
      
      // SPA 방식으로 페이지 이동 (소켓 연결 유지) - 케어매니저 이름도 함께 전달
      const params = new URLSearchParams();
      params.set('to', careManagerId.toString());
      if (careManagerName) {
        params.set('name', encodeURIComponent(careManagerName));
      }
      setLocation(`/chat?${params.toString()}`);
      
    } catch (error) {
      console.error("채팅 시작 오류:", error);
      toast({
        title: "채팅 시작 실패",
        description: "오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallClick = () => {
    toast({
      title: "전화 연결",
      description: "케어 매니저와 전화를 연결하시겠습니까?",
    });
  };
  
  const handleBookingClick = (careManagerId: number) => {
    // 예약 항목 클릭 시 해당 케어매니저의 댓글 페이지로 이동
    setLocation(`/care-manager/${careManagerId}#comments`);
  };

  // 실제 예약 데이터만 표시 (더미 데이터 사용 안함)
  const displayBookings = filteredBookings;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-20">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">예약 현황</h1>
          <p className="text-gray-600">케어 서비스 예약 현황을 확인하세요</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="upcoming" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 bg-white/90 backdrop-blur-sm rounded-xl p-1">
            <TabsTrigger value="upcoming" className="rounded-lg">예정된 예약</TabsTrigger>
            <TabsTrigger value="ongoing" className="rounded-lg">진행 중</TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg">완료된 예약</TabsTrigger>
          </TabsList>

          {isQueryLoading || isLoading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
              <p className="text-gray-500">예약 정보를 불러오는 중입니다...</p>
            </div>
          ) : displayBookings.length === 0 ? (
            <div className="py-20 text-center">
              <i className="fas fa-calendar-times text-gray-400 text-4xl mb-4"></i>
              <p className="text-gray-500">예약 내역이 없습니다</p>
              <div className="flex flex-col space-y-2 items-center mt-4">
                <Button 
                  onClick={() => refetch()}
                  variant="outline"
                  className="mb-2"
                >
                  <i className="fas fa-sync-alt mr-2"></i>
                  새로고침
                </Button>
                <Button 
                  onClick={manualFetch}
                  variant="default"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <i className="fas fa-cloud-download-alt mr-2"></i>
                  수동으로 예약 가져오기
                </Button>
              </div>
            </div>
          ) : (
            <>
              <TabsContent value="upcoming" className="mt-6 space-y-4">
                {displayBookings.map(booking => (
                  <Card 
                    key={booking.id} 
                    className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100 shadow-lg cursor-pointer hover:shadow-xl transition-all"
                    onClick={() => handleBookingClick(booking.careManagerId)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Avatar className="w-16 h-16 border-2 border-white shadow-md">
                          <AvatarImage src={normalizeImageUrl(booking.careManager?.imageUrl)} />
                          <AvatarFallback>{booking.careManager?.name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xl font-bold text-gray-800">{booking.careManager?.name || "케어 매니저"}</h3>
                            <Badge className={statusMap[booking.status as keyof typeof statusMap]?.color || ""}>
                              {statusMap[booking.status as keyof typeof statusMap]?.label || booking.status}
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <i className="fas fa-calendar mr-3 w-4 text-blue-500"></i>
                              <span>{format(new Date(booking.date), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}</span>
                            </div>
                            <div className="flex items-center">
                              <i className="fas fa-clock mr-3 w-4 text-blue-500"></i>
                              <span>{booking.duration}시간</span>
                            </div>
                            <div className="flex items-center">
                              <i className="fas fa-hospital mr-3 w-4 text-blue-500"></i>
                              <span>{booking.service?.name || booking.notes}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-2xl font-bold text-blue-600">{booking.totalAmount.toLocaleString()}원</span>
                            <div className="flex space-x-2" onClick={e => e.stopPropagation()}>
                              {/* 대기 중일 때는 채팅/통화 버튼 비활성화 (상태 설명 추가) */}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleChatClick(booking.careManagerId, booking.careManager?.name);
                                }}
                                disabled={true}
                                title="예약 승인 후 채팅이 가능합니다"
                              >
                                <i className="fas fa-comment mr-2"></i>
                                채팅
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCallClick();
                                }}
                                disabled={true}
                                title="예약 승인 후 통화가 가능합니다"
                              >
                                <i className="fas fa-phone mr-2"></i>
                                통화
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="ongoing" className="mt-6 space-y-4">
                {filteredBookings.map(booking => (
                  <Card 
                    key={booking.id} 
                    className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100 shadow-lg cursor-pointer hover:shadow-xl transition-all"
                    onClick={() => handleBookingClick(booking.careManagerId)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Avatar className="w-16 h-16 border-2 border-white shadow-md">
                          <AvatarImage src={normalizeImageUrl(booking.careManager?.imageUrl)} />
                          <AvatarFallback>{booking.careManager?.name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xl font-bold text-gray-800">{booking.careManager?.name || "케어 매니저"}</h3>
                            <Badge className={statusMap[booking.status as keyof typeof statusMap]?.color || ""}>
                              {statusMap[booking.status as keyof typeof statusMap]?.label || booking.status}
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <i className="fas fa-clock mr-3 w-4 text-green-500"></i>
                              <span>시작 시간: {format(new Date(booking.date), 'HH:mm', { locale: ko })}</span>
                            </div>
                            <div className="flex items-center">
                              <i className="fas fa-home mr-3 w-4 text-green-500"></i>
                              <span>{booking.service?.name || booking.notes}</span>
                            </div>
                          </div>
                          
                          {/* Real-time Status */}
                          <div className="bg-green-100 rounded-lg p-3 mt-4 border border-green-200">
                            <div className="flex items-center text-sm text-green-700">
                              <i className="fas fa-check-circle mr-2"></i>
                              <span>
                                {booking.status === 'confirmed' ? '예약이 확정되었습니다' : '서비스가 진행중입니다'} 
                                ({format(new Date(), 'HH:mm', { locale: ko })})
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-2xl font-bold text-green-600">{booking.totalAmount.toLocaleString()}원</span>
                            <div className="flex space-x-2" onClick={e => e.stopPropagation()}>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-lg border-green-200 text-green-600 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleChatClick(booking.careManagerId, booking.careManager?.name);
                                }}
                                disabled={isLoading}
                              >
                                {isLoading ? (
                                  <div className="w-4 h-4 border-2 border-t-transparent border-green-600 rounded-full animate-spin mx-2" />
                                ) : (
                                  <>
                                    <i className="fas fa-comment mr-2"></i>
                                    채팅
                                  </>
                                )}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-lg border-green-200 text-green-600 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCallClick();
                                }}
                              >
                                <i className="fas fa-phone mr-2"></i>
                                통화
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="completed" className="mt-6 space-y-4">
                {filteredBookings.map(booking => (
                  <Card 
                    key={booking.id} 
                    className="bg-white/90 backdrop-blur-sm border-gray-200 shadow-lg cursor-pointer hover:shadow-xl transition-all"
                    onClick={() => handleBookingClick(booking.careManagerId)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Avatar className="w-16 h-16 border-2 border-white shadow-md">
                          <AvatarImage src={normalizeImageUrl(booking.careManager?.imageUrl)} />
                          <AvatarFallback>{booking.careManager?.name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xl font-bold text-gray-800">{booking.careManager?.name || "케어 매니저"}</h3>
                            <Badge variant="secondary" className={statusMap[booking.status as keyof typeof statusMap]?.color || ""}>
                              {statusMap[booking.status as keyof typeof statusMap]?.label || booking.status}
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <i className="fas fa-calendar mr-3 w-4 text-gray-500"></i>
                              <span>{format(new Date(booking.date), 'yyyy년 MM월 dd일', { locale: ko })} 완료</span>
                            </div>
                            <div className="flex items-center">
                              <i className="fas fa-clock mr-3 w-4 text-gray-500"></i>
                              <span>서비스 시간: {booking.duration}시간</span>
                            </div>
                            <div className="flex items-center">
                              <i className="fas fa-star mr-3 w-4 text-yellow-500"></i>
                              <span>서비스: {booking.service?.name || booking.notes}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-xl font-bold text-gray-600">{booking.totalAmount.toLocaleString()}원</span>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-lg border-yellow-200 text-yellow-600 hover:bg-yellow-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/care-manager/${booking.careManagerId}#comments`);
                              }}
                            >
                              <i className="fas fa-star mr-2"></i>
                              리뷰 작성
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Bookings;
