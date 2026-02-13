import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatTime } from "@/lib/utils";
import { createChatRoom } from "@/lib/socket";

interface BookingItemProps {
  booking: any;
  onCancel?: (id: number) => void;
  refreshBookings?: () => void;
}

const BookingItem = ({ booking, onCancel, refreshBookings }: BookingItemProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
      pending: { label: "대기 중", variant: "outline" },
      confirmed: { label: "예약 확정", variant: "default" },
      completed: { label: "완료", variant: "secondary" },
      canceled: { label: "취소됨", variant: "destructive" }
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" };

    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const handleCancel = async () => {
    if (!window.confirm("예약을 취소하시겠습니까?")) return;
    
    setIsLoading(true);
    try {
      if (onCancel) {
        await onCancel(booking.id);
        if (refreshBookings) refreshBookings();
      }
    } catch (error) {
      console.error("예약 취소 실패:", error);
      alert("예약 취소에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 채팅 버튼 클릭 핸들러
  const handleChatClick = async () => {
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }

    try {
      setIsLoading(true);
      console.log("채팅 버튼 클릭 - 채팅방 생성 시작");
      
      // 크리에이터ID 추출
      const careManagerId = booking.careManagerId || booking.careManager?.id;
      
      if (!careManagerId) {
        console.error("크리에이터ID를 찾을 수 없음");
        alert("크리에이터정보를 찾을 수 없습니다.");
        return;
      }
      
      console.log(`크리에이터ID: ${careManagerId}, 사용자 ID: ${user.uid}`);
      
      // 채팅방 생성
      const result = await createChatRoom(user.uid, careManagerId.toString());
      
      console.log("채팅방 생성 결과:", result);
      
      if (result && result.success) {
        // 채팅방 생성 성공 - 채팅 페이지로 이동
        const chatUrl = `/chat?to=${careManagerId}`;
        console.log(`채팅 페이지로 이동 시작: ${chatUrl}`);
        console.log(`현재 URL: ${window.location.href}`);
        
        // 페이지 이동 전에 약간의 지연을 추가
        setTimeout(() => {
          setLocation(chatUrl);
          console.log(`이동 명령 후 URL: ${window.location.href}`);
          
          // 페이지 이동 확인을 위한 추가 지연
          setTimeout(() => {
            console.log(`최종 URL: ${window.location.href}`);
            // 만약 이동이 되지 않았다면 직접 이동 시도
            if (!window.location.href.includes(`to=${careManagerId}`)) {
              console.log("페이지 이동이 감지되지 않음, window.location 사용 시도");
              window.location.href = chatUrl;
            }
          }, 500);
        }, 100);
      } else {
        console.error("채팅방 생성 실패:", result?.error || "알 수 없는 오류");
        alert("채팅방 생성에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      console.error("채팅 시작 오류:", error);
      alert("채팅 시작에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  // 예약 정보 로그 출력 (디버깅용)
  console.log(`예약 아이템 렌더링: ID=${booking.id}, 상태=${booking.status}, AI아바타ID=${booking.careManagerId || booking.careManager?.id}`);

  return (
    <Card className="mb-4 shadow-sm hover:shadow transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">
              {booking.service?.name || "서비스명"} {getStatusBadge(booking.status)}
            </CardTitle>
            <CardDescription>
              {formatDate(booking.date)} {formatTime(booking.time)}
              {booking.duration && ` (${booking.duration}시간)`}
            </CardDescription>
          </div>
          <div className="text-lg font-semibold text-primary">
            {Number(booking.totalAmount).toLocaleString()}원
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-gray-100">
            <AvatarImage 
              src={booking.careManager?.imageUrl || "/placeholder-Avatar.png"} 
              alt={booking.careManager?.name || "케어 매니저"} 
            />
            <AvatarFallback>
              {(booking.careManager?.name || "CM").substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium text-lg">
              {booking.careManager?.name || "케어 매니저"}
            </h3>
            <p className="text-gray-600 text-sm">
              {booking.careManager?.location || "지역 정보 없음"}
            </p>
          </div>
        </div>
        
        {booking.notes && (
          <div className="mt-4">
            <h4 className="font-medium text-sm text-gray-700">요청사항</h4>
            <p className="text-gray-600 text-sm mt-1">{booking.notes}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-2">
        {booking.status === 'confirmed' && (
          <Button 
            variant="default" 
            onClick={handleChatClick} 
            disabled={isLoading}
            className={`relative ${isLoading ? 'opacity-70' : ''}`}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-t-transparent border-primary rounded-full animate-spin"></div>
              </div>
            ) : null}
            <i className="fas fa-comment mr-2"></i> 채팅
          </Button>
        )}
        {booking.status === 'pending' && (
          <Button 
            variant="destructive" 
            onClick={handleCancel}
            disabled={isLoading}
          >
            예약 취소
          </Button>
        )}
        <Button variant="default" onClick={() => setLocation(`/bookings/${booking.id}`)}>
          상세보기
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BookingItem; 