import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Notice } from "@shared/schema";

interface NoticeDetailProps {
  id: string;
}

const NoticeDetail = ({ id }: NoticeDetailProps) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [notice, setNotice] = useState<Notice | null>(null);
  
  console.log(`NoticeDetail 컴포넌트 렌더링: ID ${id}`);

  // 특정 공지사항 조회
  const { data: noticeData, isLoading, isError } = useQuery({
    queryKey: [`/api/notices/${id}`],
    queryFn: async () => {
      try {
        console.log(`공지사항 데이터 요청 시작: ID ${id}`);
        // API 요청이 구현되어 있지 않을 경우를 대비해 모든 공지를 가져와서 필터링
        const res = await apiRequest('GET', '/api/notices');
        if (!res.ok) {
          throw new Error('공지사항 API 응답 오류');
        }
        const notices = await res.json();
        console.log(`전체 공지사항 데이터 로드됨: ${notices.length}개`, notices);
        
        // ID 문자열을 숫자로 변환하여 비교
        const idNum = parseInt(id);
        const foundNotice = notices.find((notice: Notice) => notice.id === idNum);
        
        console.log(`공지사항 찾음:`, foundNotice);
        return foundNotice || null;
      } catch (error) {
        console.error("공지사항 조회 오류:", error);
        toast({
          title: "공지사항 조회 실패",
          description: "공지사항을 불러오는데 실패했습니다.",
          variant: "destructive"
        });
        return null;
      }
    },
    // 에러 재시도 기능 추가
    retry: 2,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (noticeData) {
      console.log("공지사항 데이터 상태 업데이트:", noticeData);
      setNotice(noticeData);
    }
  }, [noticeData]);

  const handleBack = () => {
    setLocation("/");
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
    } catch (e) {
      console.error("날짜 포맷팅 오류:", e);
      return dateString; // 원본 문자열 반환
    }
  };

  // 디버깅 정보 표시
  console.log("현재 상태:", { isLoading, isError, notice, id });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            className="flex items-center text-gray-600 hover:text-gray-900"
            onClick={handleBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> 돌아가기
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">공지사항</h1>
          <p className="text-gray-600 mt-2">케어매니저 플랫폼의 중요 소식을 확인하세요</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : notice ? (
          <Card className="shadow-md">
            <CardHeader className="border-b bg-gray-50 flex flex-col gap-2 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {notice.title?.includes('중요') && (
                    <span className="inline-block px-2 py-1 bg-red-500 text-white text-xs rounded">중요</span>
                  )}
                  {notice.title?.toLowerCase().includes('시스템') && (
                    <span className="inline-block px-2 py-1 bg-blue-500 text-white text-xs rounded">시스템</span>
                  )}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(notice.date || '')}
                </div>
              </div>
              <h2 className="text-xl font-bold">{notice.title}</h2>
            </CardHeader>
            <CardContent className="py-6">
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-gray-700">{notice.content}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-10">
            <div className="text-4xl mb-4">😢</div>
            <h3 className="text-xl font-semibold mb-2">공지사항을 찾을 수 없습니다</h3>
            <p className="text-gray-600 mb-6">요청하신 공지사항이 존재하지 않거나 삭제되었을 수 있습니다.</p>
            <Button onClick={handleBack}>홈으로 돌아가기</Button>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={handleBack}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NoticeDetail; 