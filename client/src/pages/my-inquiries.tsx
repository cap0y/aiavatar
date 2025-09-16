import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  Calendar
} from "lucide-react";

interface Inquiry {
  id: string;
  subject: string;
  category: string;
  message: string;
  urgency: string;
  status: 'pending' | 'in_progress' | 'answered' | 'closed';
  createdAt: string;
  updatedAt?: string;
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;
}

export default function MyInquiriesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  // 문의 내역 조회
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["my-inquiries", user?.uid || user?.email],
    queryFn: async () => {
      if (!user?.uid && !user?.email) return [];
      
      const userId = user?.uid || user?.email;
      const response = await fetch(`/api/inquiries/user/${userId}`);
      
      if (!response.ok) {
        throw new Error('문의 내역을 불러오는데 실패했습니다');
      }
      
      return await response.json();
    },
    enabled: !!user,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: Inquiry['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">접수 대기</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">처리 중</Badge>;
      case 'answered':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">답변 완료</Badge>;
      case 'closed':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">해결 완료</Badge>;
      default:
        return <Badge variant="outline">알 수 없음</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return <Badge className="bg-red-500 text-white">긴급</Badge>;
      case 'high':
        return <Badge className="bg-orange-500 text-white">높음</Badge>;
      case 'normal':
        return <Badge variant="outline">보통</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-gray-500">낮음</Badge>;
      default:
        return <Badge variant="outline">보통</Badge>;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'account': return '계정/로그인';
      case 'service': return '서비스 이용';
      case 'payment': return '결제';
      case 'cancel': return '취소/환불';
      case 'technical': return '기술적 문제';
      case 'other': return '기타';
      default: return category;
    }
  };

  const getStatusIcon = (status: Inquiry['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case 'answered':
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  // 통계 계산
  const stats = {
    total: inquiries.length,
    pending: inquiries.filter((inq: Inquiry) => inq.status === 'pending').length,
    in_progress: inquiries.filter((inq: Inquiry) => inq.status === 'in_progress').length,
    answered: inquiries.filter((inq: Inquiry) => inq.status === 'answered').length,
    urgent: inquiries.filter((inq: Inquiry) => inq.urgency === 'urgent').length
  };

  if (!user) {
    setLocation('/');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/profile')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          마이페이지로 돌아가기
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">내 문의</h1>
        </div>
        <p className="text-gray-600">접수한 1:1 문의 내역을 확인할 수 있습니다.</p>
      </div>

      {/* 문의 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {inquiries.length}건
            </div>
            <div className="text-sm text-gray-600">총 문의</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600 mb-1">
              {inquiries.filter((inq: Inquiry) => inq.status === 'pending').length}건
            </div>
            <div className="text-sm text-gray-600">접수 대기</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {inquiries.filter((inq: Inquiry) => inq.status === 'in_progress').length}건
            </div>
            <div className="text-sm text-gray-600">처리 중</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {inquiries.filter((inq: Inquiry) => inq.status === 'answered' || inq.status === 'closed').length}건
            </div>
            <div className="text-sm text-gray-600">답변 완료</div>
          </CardContent>
        </Card>
      </div>

      {/* 새 문의 버튼 */}
      <div className="mb-6">
        <Button onClick={() => setLocation('/support')} className="w-full md:w-auto">
          <MessageSquare className="h-4 w-4 mr-2" />
          새 문의 작성
        </Button>
      </div>

      {/* 문의 목록 */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">문의 내역을 불러오는 중...</p>
            </CardContent>
          </Card>
        ) : inquiries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800 mb-2">문의 내역이 없습니다</h3>
              <p className="text-gray-600 mb-4">궁금한 사항이 있으시면 언제든지 문의해주세요!</p>
              <Button onClick={() => setLocation('/support')}>
                <MessageSquare className="h-4 w-4 mr-2" />
                첫 문의 작성하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          inquiries.map((inquiry: Inquiry) => (
            <Card key={inquiry.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(inquiry.status)}
                      <h3 className="font-bold text-gray-800 text-lg">{inquiry.subject}</h3>
                      {getStatusBadge(inquiry.status)}
                      {getUrgencyBadge(inquiry.urgency)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(inquiry.createdAt)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getCategoryName(inquiry.category)}
                      </Badge>
                    </div>
                    <p className="text-gray-700 mb-4 line-clamp-2">{inquiry.message}</p>
                  </div>
                </div>
                
                {inquiry.status === 'answered' && inquiry.answer && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">답변 완료</span>
                      {inquiry.answeredAt && (
                        <span className="text-sm text-green-600">
                          {formatDate(inquiry.answeredAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-green-700 text-sm line-clamp-3">{inquiry.answer}</p>
                    {inquiry.answeredBy && (
                      <p className="text-xs text-green-600 mt-2">답변자: {inquiry.answeredBy}</p>
                    )}
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  {inquiry.updatedAt && inquiry.updatedAt !== inquiry.createdAt && (
                    <div className="text-xs text-gray-500">
                      최종 업데이트: {formatDate(inquiry.updatedAt)}
                    </div>
                  )}
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedInquiry(inquiry)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        자세히 보기
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          {getStatusIcon(inquiry.status)}
                          {inquiry.subject}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {getStatusBadge(inquiry.status)}
                          {getUrgencyBadge(inquiry.urgency)}
                          <Badge variant="outline">{getCategoryName(inquiry.category)}</Badge>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">문의 내용</h4>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-gray-700 whitespace-pre-wrap">{inquiry.message}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            접수일시: {formatDate(inquiry.createdAt)}
                          </p>
                        </div>
                        
                        {inquiry.answer && (
                          <div>
                            <h4 className="font-medium mb-2 text-green-800">답변 내용</h4>
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                              <p className="text-green-700 whitespace-pre-wrap">{inquiry.answer}</p>
                            </div>
                            <div className="flex justify-between items-center text-xs text-green-600 mt-2">
                              {inquiry.answeredBy && <span>답변자: {inquiry.answeredBy}</span>}
                              {inquiry.answeredAt && <span>답변일시: {formatDate(inquiry.answeredAt)}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 안내사항 */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">문의 처리 안내</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 일반 문의는 1-2 영업일 내에 답변드립니다.</li>
                <li>• 긴급 문의는 당일 내에 답변드립니다.</li>
                <li>• 답변 완료 시 이메일로도 알림을 보내드립니다.</li>
                <li>• 추가 문의사항이 있으시면 언제든지 새 문의를 작성해주세요.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 