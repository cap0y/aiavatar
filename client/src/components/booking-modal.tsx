import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays, parseISO, addHours, addMonths, isWithinInterval, isAfter } from "date-fns";
import { ko } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import type { CareManager } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import type { DateRange } from "react-day-picker";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  manager: CareManager;
  userId: number | string;
  serviceId?: number;
  onSuccess?: () => void;
}

interface BookingSlot {
  id?: number;
  date: string;
  startTime: string;
  duration: number;
  available: boolean;
}

const BookingModal = ({ isOpen, onClose, manager, userId, serviceId, onSuccess }: BookingModalProps) => {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingSlots, setBookingSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startHours, setStartHours] = useState("10");
  const [startMinutes, setStartMinutes] = useState("00");
  const [endHours, setEndHours] = useState("12");
  const [endMinutes, setEndMinutes] = useState("00");
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [bookingTab, setBookingTab] = useState<'single' | 'range'>('single');
  const { toast } = useToast();
  const setLocation = useLocation()[1];

  // 날짜 선택 처리
  const handleDateSelect = (date: Date | undefined) => {
    if (bookingTab === 'single') {
      setStartDate(date);
      setEndDate(undefined);
    } else {
      if (!startDate) {
        setStartDate(date);
      } else if (!endDate && date && isAfter(date, startDate)) {
        setEndDate(date);
      } else {
        setStartDate(date);
        setEndDate(undefined);
      }
    }
  };
  
  // 예약 가능한 시간대 생성 (9시부터 18시까지, 2시간 단위)
  const generateTimeSlots = (date: Date) => {
    const slots: BookingSlot[] = [];
    const formattedDate = format(date, "yyyy-MM-dd");
    
    for (let hour = 9; hour <= 16; hour += 2) {
      slots.push({
        date: formattedDate,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        duration: 2,
        available: true
      });
    }
    
    return slots;
  };
  
  // 날짜가 변경될 때마다 해당 날짜의 예약 현황 가져오기
  useEffect(() => {
    if (!startDate) return;
    
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const formattedDate = format(startDate, "yyyy-MM-dd");
        
        // 생성할 기본 시간 슬롯
        const slots = generateTimeSlots(startDate);
        
        try {
          // 해당 케어 매니저의 예약 상태 가져오기
          const response = await apiRequest("GET", `/api/bookings/manager/${manager.id}/date/${formattedDate}`);
          const bookings = await response.json();
          
          // 이미 예약된 슬롯 표시
          if (bookings && bookings.length > 0) {
            bookings.forEach((booking: any) => {
              const bookingTime = booking.date.split('T')[1].substring(0, 5);
              const slotIndex = slots.findIndex(slot => slot.startTime === bookingTime);
              
              if (slotIndex !== -1) {
                slots[slotIndex].available = false;
              }
            });
          }
        } catch (error) {
          console.error("예약 정보를 가져오는 데 실패했습니다:", error);
        }
        
        setBookingSlots(slots);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookings();
  }, [startDate, manager.id]);
  
  // 시간 입력 제한
  const validateTimeInput = (value: string, type: 'hours' | 'minutes'): boolean => {
    const numValue = parseInt(value);
    
    if (isNaN(numValue)) return false;
    
    if (type === 'hours') {
      return numValue >= 0 && numValue <= 23;
    } else {
      return numValue >= 0 && numValue <= 59;
    }
  };
  
  // 시간 입력 핸들러
  const handleTimeChange = (value: string, type: 'startHours' | 'startMinutes' | 'endHours' | 'endMinutes') => {
    if (value === '' || (type.includes('Hours') ? validateTimeInput(value, 'hours') : validateTimeInput(value, 'minutes'))) {
      switch (type) {
        case 'startHours':
          setStartHours(value);
          break;
        case 'startMinutes':
          setStartMinutes(value);
          break;
        case 'endHours':
          setEndHours(value);
          break;
        case 'endMinutes':
          setEndMinutes(value);
          break;
      }
    }
  };
  
  // 예약 기간 계산
  const calculateDuration = (): number => {
    if (useCustomTime) {
      const startTimeInMinutes = parseInt(startHours) * 60 + parseInt(startMinutes);
      const endTimeInMinutes = parseInt(endHours) * 60 + parseInt(endMinutes);
      return Math.ceil((endTimeInMinutes - startTimeInMinutes) / 60);
    } else if (selectedTime) {
      return 2; // 기본 2시간
    }
    return 0;
  };
  
  // 예약 신청
  const handleBooking = async () => {
    if (!startDate) return;
    
    // 시작 시간 설정
    let startTimeHours = 9; // 기본값 9시로 설정
    let startTimeMinutes = 0;
    let duration = 0;
    
    if (useCustomTime) {
      startTimeHours = parseInt(startHours || "9");
      startTimeMinutes = parseInt(startMinutes || "0");
      const endTimeHours = parseInt(endHours || "11");
      const endTimeMinutes = parseInt(endMinutes || "0");
      
      if (isNaN(startTimeHours) || isNaN(startTimeMinutes) || 
          isNaN(endTimeHours) || isNaN(endTimeMinutes) || 
          startTimeHours < 0 || startTimeHours > 23 || 
          startTimeMinutes < 0 || startTimeMinutes > 59 ||
          endTimeHours < 0 || endTimeHours > 23 || 
          endTimeMinutes < 0 || endTimeMinutes > 59) {
        toast({
          title: "시간 오류",
          description: "유효한 시간을 입력해주세요.",
          variant: "destructive",
        });
        return;
      }
      
      // 종료 시간이 시작 시간보다 이전인지 확인
      const startTimeTotal = startTimeHours * 60 + startTimeMinutes;
      const endTimeTotal = endTimeHours * 60 + endTimeMinutes;
      
      if (endTimeTotal <= startTimeTotal) {
        toast({
          title: "시간 오류",
          description: "종료 시간은 시작 시간보다 나중이어야 합니다.",
          variant: "destructive",
        });
        return;
      }
      
      duration = Math.ceil((endTimeTotal - startTimeTotal) / 60); // 분 단위를 시간으로 변환
    } else if (!selectedTime) {
      toast({
        title: "시간 선택 필요",
        description: "예약 시간을 선택해주세요.",
        variant: "destructive",
      });
      return;
    } else {
      const [hourStr, minuteStr] = selectedTime.split(':');
      startTimeHours = parseInt(hourStr);
      startTimeMinutes = parseInt(minuteStr);
      duration = 2; // 기본 2시간
    }
    
    // 기간 예약인 경우 날짜 확인
    if (bookingTab === 'range' && !endDate) {
      toast({
        title: "날짜 선택 필요",
        description: "종료 날짜를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // 예약 날짜 시간 설정 - 새로운 Date 객체를 생성하여 날짜와 시간을 명시적으로 설정
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      const day = startDate.getDate();
      
      // 서버 API와 호환되는 형식으로 예약 데이터 구성
      const bookingData = {
        userId: userId.toString(), // userId를 문자열로 변환 (스키마에서 userId가 text로 정의됨)
        careManagerId: parseInt(manager.id.toString()),
        serviceId: serviceId ? parseInt(serviceId.toString()) : 1, // serviceId가 없으면 기본값 1
        date: new Date(year, month, day, startTimeHours, startTimeMinutes, 0, 0),
        duration: duration,
        totalAmount: manager.hourlyRate * duration,
        status: "pending",
        notes: bookingTab === 'range' && endDate ? 
          `${format(startDate, 'yyyy-MM-dd')}부터 ${format(endDate, 'yyyy-MM-dd')}까지` : 
          `${format(startDate, 'yyyy-MM-dd')} ${startTimeHours}:${startTimeMinutes}에 예약`
      };

      console.log("예약 요청:", bookingData);
      
      try {
        const res = await apiRequest("POST", "/api/bookings", bookingData);
        
        const responseText = await res.text();
        console.log(`서버 응답 (${res.status}):`, responseText);
        
        if (!res.ok) {
          let errorMessage = "예약 생성에 실패했습니다";
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            // 파싱 실패 시 원본 텍스트 사용
            errorMessage = responseText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        // 예약 성공
        toast({
          title: "예약 완료",
          description: `${manager.name}님에게 예약이 전송되었습니다.`,
        });
        
        // 캐시 무효화 또는 업데이트를 통해 예약 목록 갱신
        try {
          // 명시적으로 쿼리 캐시 무효화
          await queryClient.invalidateQueries({ queryKey: ["/api/bookings/user", userId.toString()] });
          console.log("예약 목록 쿼리 캐시가 갱신되었습니다.");
        } catch (e) {
          console.error("예약 목록 갱신 실패:", e);
        }
        
        if (onSuccess) {
          onSuccess();
        }
        
        // 예약 후 AI아바타 상세 페이지의 댓글 섹션으로 이동
        // 북마크 페이지로 먼저 이동하고 나서 댓글 페이지로 이동
        onClose();
        setLocation('/bookings');
        setTimeout(() => {
          setLocation(`/care-manager/${manager.id}#comments`);
        }, 100);
      } catch (error: any) {
        console.error("예약 오류:", error);
        toast({
          title: "예약 실패",
          description: error.message || "오류가 발생했습니다",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error("예약 처리 중 오류:", error);
      toast({
        title: "예약 처리 오류",
        description: error.message || "처리 중 오류가 발생했습니다",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };
  
  // 오늘 이전 날짜는 비활성화
  const disabledDays = [
    { from: new Date(2000, 1, 1), to: addDays(new Date(), -1) }
  ];
  
  // 달력 표시 범위 (3개월)
  const today = new Date();
  const threeMonthsLater = addMonths(today, 3);
  
  // 선택 날짜 표시
  const dateRangeText = () => {
    if (bookingTab === 'single' || !startDate) {
      return format(startDate || new Date(), 'yyyy년 MM월 dd일');
    }
    
    if (startDate && !endDate) {
      return `${format(startDate, 'yyyy년 MM월 dd일')} 부터 선택`;
    }
    
    if (startDate && endDate) {
      return `${format(startDate, 'yyyy년 MM월 dd일')} - ${format(endDate, 'yyyy년 MM월 dd일')}`;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] w-[95%] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-center text-xl font-bold">
            {manager.name} 크리에이터예약
          </DialogTitle>
          <DialogDescription className="text-center text-gray-500">
            원하시는 날짜와 시간을 선택해주세요.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 pb-4 space-y-4">
          <Tabs defaultValue="single" value={bookingTab} onValueChange={(v) => setBookingTab(v as 'single' | 'range')}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="single">단일 날짜</TabsTrigger>
              <TabsTrigger value="range">기간 선택</TabsTrigger>
            </TabsList>
            
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">날짜 선택 (3개월 이내)</h4>
              {bookingTab === 'single' ? (
                <div className="w-full flex justify-center">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={disabledDays}
                    locale={ko}
                    fromDate={today}
                    toDate={threeMonthsLater}
                    className="rounded-md border"
                    numberOfMonths={2}
                    classNames={{
                      day_today: "bg-purple-100 text-purple-900 font-bold",
                      day_selected: "bg-purple-600 text-white hover:bg-purple-700 hover:text-white",
                      months: "flex flex-col md:flex-row space-y-4 md:space-x-4 md:space-y-0",
                    }}
                  />
                </div>
              ) : (
                <div className="w-full flex justify-center">
                  <Calendar
                    mode="range"
                    selected={{
                      from: startDate,
                      to: endDate
                    }}
                    onSelect={(range: DateRange | undefined) => {
                      setStartDate(range?.from);
                      setEndDate(range?.to);
                    }}
                    disabled={disabledDays}
                    locale={ko}
                    fromDate={today}
                    toDate={threeMonthsLater}
                    className="rounded-md border"
                    numberOfMonths={2}
                    classNames={{
                      day_today: "bg-purple-100 text-purple-900 font-bold",
                      day_selected: "bg-purple-600 text-white hover:bg-purple-700 hover:text-white",
                      months: "flex flex-col md:flex-row space-y-4 md:space-x-4 md:space-y-0",
                    }}
                  />
                </div>
              )}
            </div>
          </Tabs>
          
          {startDate && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">시간 선택 ({dateRangeText()})</h4>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setUseCustomTime(!useCustomTime)}
                    className="text-xs px-2 py-1 h-auto"
                  >
                    {useCustomTime ? "시간대 선택" : "직접 입력"}
                  </Button>
                </div>
                
                {useCustomTime ? (
                  <div className="space-y-3 p-3 border rounded-md">
                    <div>
                      <Label htmlFor="start-time" className="text-xs mb-1 block">시작 시간</Label>
                      <div className="flex items-center mt-1">
                        <Input
                          id="start-hours"
                          value={startHours}
                          onChange={(e) => handleTimeChange(e.target.value, 'startHours')}
                          className="w-16 text-center mr-1"
                          maxLength={2}
                        />
                        <span className="mx-1">:</span>
                        <Input
                          id="start-minutes"
                          value={startMinutes}
                          onChange={(e) => handleTimeChange(e.target.value, 'startMinutes')}
                          className="w-16 text-center mr-2"
                          maxLength={2}
                        />
                        <span className="text-sm text-gray-500">24시간 형식</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="end-time" className="text-xs mb-1 block">종료 시간</Label>
                      <div className="flex items-center mt-1">
                        <Input
                          id="end-hours"
                          value={endHours}
                          onChange={(e) => handleTimeChange(e.target.value, 'endHours')}
                          className="w-16 text-center mr-1"
                          maxLength={2}
                        />
                        <span className="mx-1">:</span>
                        <Input
                          id="end-minutes"
                          value={endMinutes}
                          onChange={(e) => handleTimeChange(e.target.value, 'endMinutes')}
                          className="w-16 text-center mr-2"
                          maxLength={2}
                        />
                        <span className="text-sm text-gray-500">24시간 형식</span>
                      </div>
                    </div>

                    <div className="pt-1 text-sm text-purple-600 font-medium">
                      총 서비스 시간: 일 {bookingTab === 'range' && startDate && endDate ? 
                        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1}일 × 
                      {useCustomTime ? 
                        ` ${calculateDuration()}시간` : 
                        " 2시간"}
                    </div>
                  </div>
                ) : loading ? (
                  <div className="py-4 text-center text-gray-500">시간대 정보를 불러오는 중...</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {bookingSlots.map((slot, index) => (
                      <Button
                        key={index}
                        variant={selectedTime === slot.startTime ? "default" : "outline"}
                        className={`w-full ${!slot.available ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200" : ""}`}
                        onClick={() => slot.available && setSelectedTime(slot.startTime)}
                        disabled={!slot.available}
                      >
                        {slot.startTime} - {format(addHours(parseISO(`${slot.date}T${slot.startTime}`), 2), 'HH:mm')}
                        {!slot.available && <Badge className="ml-2 bg-red-100 text-red-600 text-xs">예약중</Badge>}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-4 px-6 pb-6 pt-2">
          <Button
            variant="default"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            취소
          </Button>
          <Button
            onClick={handleBooking}
            className="w-full sm:w-auto gradient-purple text-white"
            disabled={!startDate || ((!selectedTime && !useCustomTime) || isSubmitting)}
          >
            {isSubmitting ? "처리 중..." : "예약하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookingModal; 