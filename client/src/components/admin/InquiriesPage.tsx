import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  Calendar,
  Send,
  User,
  Filter
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
  userId: string;
  userName: string;
  userEmail: string;
}

export default function InquiriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // 모든 문의 조회 (임시 더미 데이터)
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["admin-inquiries"],
    queryFn: async () => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return [
        {
          id: "inq_001",
          subject: "결제 오류 문의",
          category: "payment",
          message: "카드 결제 시 오류가 발생합니다. 결제는 완료되었는데 예약이 되지 않았어요. 해결 방법을 알려주세요.",
          urgency: "high",
          status: "answered",
          createdAt: "2024-01-15T10:30:00Z",
          updatedAt: "2024-01-16T14:20:00Z",
          answer: "안녕하세요. 문의해주신 결제 오류 건에 대해 확인해드렸습니다. 시스템 오류로 인해 일시적으로 발생한 문제였으며, 고객님의 예약이 정상적으로 처리되었습니다. 결제 내역과 예약 확인서를 이메일로 발송해드렸으니 확인 부탁드립니다.",
          answeredAt: "2024-01-16T14:20:00Z",
          answeredBy: "고객지원팀 김민수",
          userId: "user_001",
          userName: "김철수",
          userEmail: "kim@example.com"
        },
        {
          id: "inq_002",
          subject: "크리에이터변경 요청",
          category: "service",
          message: "현재 배정된 케어 매니저와 일정이 맞지 않아 변경을 요청드립니다. 가능한 빠른 시일 내에 처리 부탁드려요.",
          urgency: "normal",
          status: "in_progress",
          createdAt: "2024-01-18T09:15:00Z",
          updatedAt: "2024-01-18T11:30:00Z",
          userId: "user_002",
          userName: "박민정",
          userEmail: "park@example.com"
        },
        {
          id: "inq_003",
          subject: "서비스 이용 방법 문의",
          category: "service",
          message: "처음 이용하는데 예약 과정이 어려워요. 자세한 설명 부탁드립니다. 특히 결제 부분이 복잡합니다.",
          urgency: "low",
          status: "pending",
          createdAt: "2024-01-20T16:45:00Z",
          userId: "user_003",
          userName: "이수진",
          userEmail: "lee@example.com"
        },
        {
          id: "inq_004",
          subject: "환불 요청",
          category: "cancel",
          message: "예약한 서비스가 취소되어 환불을 요청드립니다. 언제 처리되나요?",
          urgency: "high",
          status: "pending",
          createdAt: "2024-01-21T08:30:00Z",
          userId: "user_004",
          userName: "최영수",
          userEmail: "choi@example.com"
        },
        {
          id: "inq_005",
          subject: "계정 로그인 문제",
          category: "account",
          message: "로그인이 안 됩니다. 비밀번호를 재설정했는데도 계속 오류가 나요.",
          urgency: "urgent",
          status: "pending",
          createdAt: "2024-01-22T12:15:00Z",
          userId: "user_005",
          userName: "한미영",
          userEmail: "han@example.com"
        }
      ] as Inquiry[];
    },
  });

  // 답변 작성 뮤테이션
  const answerMutation = useMutation({
    mutationFn: async ({ inquiryId, answer }: { inquiryId: string; answer: string }) => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { inquiryId, answer };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
      setAnswerText("");
      setSelectedInquiry(null);
    },
    onError: () => {
      toast({
        title: "답변 실패",
        description: "답변 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  // 상태 변경 뮤테이션
  const statusMutation = useMutation({
    mutationFn: async ({ inquiryId, status }: { inquiryId: string; status: string }) => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 500));
      return { inquiryId, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
    },
    onError: () => {
      toast({
        title: "상태 변경 실패",
        description: "상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
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
        return <Badge className="bg-yellow-600 text-white">접수 대기</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-600 text-white">처리 중</Badge>;
      case 'answered':
        return <Badge className="bg-green-600 text-white">답변 완료</Badge>;
      case 'closed':
        return <Badge className="bg-gray-600 text-white">해결 완료</Badge>;
      default:
        return <Badge className="bg-gray-600 text-white">알 수 없음</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return <Badge className="bg-red-600 text-white">긴급</Badge>;
      case 'high':
        return <Badge className="bg-orange-600 text-white">높음</Badge>;
      case 'normal':
        return <Badge className="bg-gray-600 text-white">보통</Badge>;
      case 'low':
        return <Badge className="bg-gray-500 text-white">낮음</Badge>;
      default:
        return <Badge className="bg-gray-600 text-white">보통</Badge>;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'account': return '계정/로그인';
      case 'service': return 'AI 아바타 서비스';
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

  const handleAnswer = () => {
    if (!selectedInquiry || !answerText.trim()) {
      toast({
        title: "입력 오류",
        description: "답변 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    answerMutation.mutate({
      inquiryId: selectedInquiry.id,
      answer: answerText
    });
  };

  const handleStatusChange = (inquiryId: string, newStatus: string) => {
    statusMutation.mutate({
      inquiryId,
      status: newStatus
    });
  };

  // 필터링된 문의 목록
  const filteredInquiries = inquiries.filter(inquiry => {
    const statusMatch = filterStatus === "all" || inquiry.status === filterStatus;
    const categoryMatch = filterCategory === "all" || inquiry.category === filterCategory;
    return statusMatch && categoryMatch;
  });

  // 통계 계산
  const stats = {
    total: inquiries.length,
    pending: inquiries.filter(inq => inq.status === 'pending').length,
    in_progress: inquiries.filter(inq => inq.status === 'in_progress').length,
    answered: inquiries.filter(inq => inq.status === 'answered').length,
    urgent: inquiries.filter(inq => inq.urgency === 'urgent').length
  };

  return (
    <div className="space-y-4">
      {/* AI 아바타 문의 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {stats.total}건
            </div>
            <div className="text-sm text-gray-300">총 문의</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              {stats.pending}건
            </div>
            <div className="text-sm text-gray-300">접수 대기</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {stats.in_progress}건
            </div>
            <div className="text-sm text-gray-300">처리 중</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {stats.answered}건
            </div>
            <div className="text-sm text-gray-300">답변 완료</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-400 mb-1">
              {stats.urgent}건
            </div>
            <div className="text-sm text-gray-300">긴급 문의</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <Card className="bg-gray-800/70 border-gray-600/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-300" />
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label htmlFor="status-filter" className="text-gray-300">상태</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white hover:bg-gray-700">전체</SelectItem>
                    <SelectItem value="pending" className="text-white hover:bg-gray-700">접수 대기</SelectItem>
                    <SelectItem value="in_progress" className="text-white hover:bg-gray-700">처리 중</SelectItem>
                    <SelectItem value="answered" className="text-white hover:bg-gray-700">답변 완료</SelectItem>
                    <SelectItem value="closed" className="text-white hover:bg-gray-700">해결 완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-filter" className="text-gray-300">카테고리</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white hover:bg-gray-700">전체</SelectItem>
                    <SelectItem value="account" className="text-white hover:bg-gray-700">계정/로그인</SelectItem>
                    <SelectItem value="service" className="text-white hover:bg-gray-700">AI 아바타 서비스</SelectItem>
                    <SelectItem value="payment" className="text-white hover:bg-gray-700">결제</SelectItem>
                    <SelectItem value="cancel" className="text-white hover:bg-gray-700">취소/환불</SelectItem>
                    <SelectItem value="technical" className="text-white hover:bg-gray-700">기술적 문제</SelectItem>
                    <SelectItem value="other" className="text-white hover:bg-gray-700">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 문의 목록 */}
      <Card className="bg-gray-800/70 border-gray-600/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <MessageSquare className="h-5 w-5 text-gray-400" />
            AI 아바타 문의 관리 ({filteredInquiries.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">문의 목록을 불러오는 중...</p>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">조건에 맞는 문의가 없습니다</h3>
              <p className="text-gray-400">필터 조건을 변경해보세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInquiries.map((inquiry) => (
                <Card key={inquiry.id} className="bg-gray-800/70 border-gray-600/50 border-l-4 border-l-blue-400">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(inquiry.status)}
                          <h3 className="font-bold text-white text-lg">{inquiry.subject}</h3>
                          {getStatusBadge(inquiry.status)}
                          {getUrgencyBadge(inquiry.urgency)}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {inquiry.userName} ({inquiry.userEmail})
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(inquiry.createdAt)}
                          </span>
                          <Badge variant="default" className="text-xs">
                            {getCategoryName(inquiry.category)}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-300 mb-4 line-clamp-2">{inquiry.message}</p>
                      </div>
                    </div>
                    
                    {inquiry.status === 'answered' && inquiry.answer && (
                      <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span className="font-medium text-green-300">답변 완료</span>
                          {inquiry.answeredAt && (
                            <span className="text-sm text-green-400">
                              {formatDate(inquiry.answeredAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-green-200 text-sm">{inquiry.answer}</p>
                        {inquiry.answeredBy && (
                          <p className="text-xs text-green-400 mt-2">답변자: {inquiry.answeredBy}</p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <Select 
                          value={inquiry.status} 
                          onValueChange={(value) => handleStatusChange(inquiry.id, value)}
                        >
                          <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="pending" className="text-white hover:bg-gray-700">접수 대기</SelectItem>
                            <SelectItem value="in_progress" className="text-white hover:bg-gray-700">처리 중</SelectItem>
                            <SelectItem value="answered" className="text-white hover:bg-gray-700">답변 완료</SelectItem>
                            <SelectItem value="closed" className="text-white hover:bg-gray-700">해결 완료</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => {
                              setSelectedInquiry(inquiry);
                              setAnswerText(inquiry.answer || "");
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {inquiry.status === 'answered' ? '답변 수정' : '답변 작성'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl bg-gray-800 border-gray-700">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-white">
                              {getStatusIcon(inquiry.status)}
                              {inquiry.subject}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {getStatusBadge(inquiry.status)}
                              {getUrgencyBadge(inquiry.urgency)}
                              <Badge variant="default">{getCategoryName(inquiry.category)}</Badge>
                            </div>
                            
                            <div className="bg-gray-700/50 p-4 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-white">{inquiry.userName}</span>
                                <span className="text-gray-400">({inquiry.userEmail})</span>
                              </div>
                              <p className="text-gray-300 whitespace-pre-wrap">{inquiry.message}</p>
                              <p className="text-xs text-gray-400 mt-2">
                                접수일시: {formatDate(inquiry.createdAt)}
                              </p>
                            </div>
                            
                            <div>
                              <Label htmlFor="answer" className="text-base font-medium text-gray-300">답변 작성</Label>
                              <Textarea
                                id="answer"
                                placeholder="고객에게 보낼 답변을 작성해주세요..."
                                className="mt-2 min-h-[120px] bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                                value={answerText}
                                onChange={(e) => setAnswerText(e.target.value)}
                              />
                            </div>
                            
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={handleAnswer}
                                disabled={answerMutation.isPending || !answerText.trim()}
                              >
                                {answerMutation.isPending ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    답변 처리 중...
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-4 w-4 mr-2" />
                                    답변 완료
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 