import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Headphones,
  MessageCircle,
  Phone,
  Mail,
  Clock,
  HelpCircle,
  Send,
  ExternalLink,
  CheckCircle,
  Search,
} from "lucide-react";

interface SupportTicket {
  subject: string;
  category: string;
  message: string;
  urgency: string;
}

export default function SupportPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // 문의 폼 상태
  const [ticket, setTicket] = useState<SupportTicket>({
    subject: "",
    category: "",
    message: "",
    urgency: "normal",
  });

  const [activeTab, setActiveTab] = useState<"contact" | "faq">("contact");

  // 문의 제출 뮤테이션
  const submitTicketMutation = useMutation({
    mutationFn: async (ticketData: SupportTicket) => {
      // 실제 API 호출로 대체 예정
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return ticketData;
    },
    onSuccess: () => {
      toast({
        title: "문의 접수 완료",
        description:
          "문의가 성공적으로 접수되었습니다. 빠른 시일 내에 답변 드리겠습니다.",
      });
      // 폼 초기화
      setTicket({
        subject: "",
        category: "",
        message: "",
        urgency: "normal",
      });
    },
    onError: () => {
      toast({
        title: "문의 접수 실패",
        description: "문의 접수 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof SupportTicket, value: string) => {
    setTicket((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitTicket = () => {
    if (!ticket.subject.trim() || !ticket.category || !ticket.message.trim()) {
      toast({
        title: "입력 오류",
        description: "제목, 카테고리, 내용을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    submitTicketMutation.mutate(ticket);
  };

  // FAQ 데이터
  const faqData = [
    {
      id: "1",
      category: "계정/로그인",
      question: "비밀번호를 잊어버렸어요. 어떻게 재설정하나요?",
      answer:
        "로그인 페이지에서 '비밀번호 찾기'를 클릭하시면 이메일로 재설정 링크를 보내드립니다. 이메일을 확인하시고 새로운 비밀번호를 설정해주세요.",
    },
    {
      id: "2",
      category: "서비스 이용",
      question: "AI 아바타는 어떻게 구매하나요?",
      answer:
        "상점에서 원하는 AI 아바타를 선택한 후, 상세 정보를 확인하고 '구매하기' 버튼을 클릭하세요. 결제 완료 후 바로 아바타를 이용할 수 있습니다.",
    },
    {
      id: "3",
      category: "결제",
      question: "어떤 결제 수단을 사용할 수 있나요?",
      answer:
        "신용카드, 체크카드, 계좌이체, 간편결제(카카오페이, 네이버페이 등)를 지원합니다. 모든 결제는 안전하게 암호화되어 처리됩니다.",
    },
    {
      id: "4",
      category: "취소/환불",
      question: "작품 의뢰를 취소하려면 어떻게 해야 하나요?",
      answer:
        "마이페이지 > 작품 의뢰 내역에서 취소하고자 하는 의뢰를 선택하여 취소할 수 있습니다. 제작 진행 상황에 따라 취소 수수료가 발생할 수 있습니다.",
    },
    {
      id: "5",
      category: "서비스 이용",
      question: "AI 크리에이터와 연락이 안 될 때는 어떻게 하나요?",
      answer:
        "플랫폼 내 메시지 기능을 이용해보시고, 그래도 연락이 안 되면 고객센터로 연락주세요. 즉시 담당자가 확인하여 도움을 드리겠습니다.",
    },
    {
      id: "6",
      category: "계정/로그인",
      question: "회원 탈퇴는 어떻게 하나요?",
      answer:
        "마이페이지 > 개인정보 보호 > 계정 삭제에서 탈퇴 신청이 가능합니다. 탈퇴 시 모든 데이터가 삭제되며, 복구가 불가능합니다.",
    },
  ];

  const [searchTerm, setSearchTerm] = useState("");
  const filteredFAQ = faqData.filter(
    (item) =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!user) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/profile")}
          className="mb-4 text-white hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          마이페이지로 돋아가기
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Headphones className="h-6 w-6 text-emerald-600" />
          <h1 className="text-2xl font-bold text-white">고객 지원</h1>
        </div>
        <p className="text-gray-400">
          AI 아바타 플랫폼 이용에 궁금한 사항이 있으시면 언제든지 문의해주세요.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex mb-6 border-b">
        <button
          onClick={() => setActiveTab("contact")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "contact"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <MessageCircle className="h-4 w-4 mr-2 inline" />
          문의하기
        </button>
        <button
          onClick={() => setActiveTab("faq")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "faq"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <HelpCircle className="h-4 w-4 mr-2 inline" />
          자주 묻는 질문
        </button>
      </div>

      {/* 연락처 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gray-800/70 border-gray-600/50 text-center">
          <CardContent className="p-6">
            <Phone className="h-8 w-8 text-green-400 mx-auto mb-3" />
            <h3 className="font-medium mb-2 text-white">전화 상담</h3>
            <p className="text-sm text-gray-300 mb-2">1588-1234</p>
            <p className="text-xs text-gray-400">평일 09:00 - 18:00</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/70 border-gray-600/50 text-center">
          <CardContent className="p-6">
            <Mail className="h-8 w-8 text-blue-400 mx-auto mb-3" />
            <h3 className="font-medium mb-2 text-white">이메일 문의</h3>
            <p className="text-sm text-gray-300 mb-2">support@aiavatar.co.kr</p>
            <p className="text-xs text-gray-400">24시간 접수</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/70 border-gray-600/50 text-center">
          <CardContent className="p-6">
            <MessageCircle className="h-8 w-8 text-purple-400 mx-auto mb-3" />
            <h3 className="font-medium mb-2 text-white">카카오톡 상담</h3>
            <p className="text-sm text-gray-300 mb-2">@AI아바타플랫폼</p>
            <p className="text-xs text-gray-400">평일 09:00 - 22:00</p>
          </CardContent>
        </Card>
      </div>

      {activeTab === "contact" ? (
        /* 문의하기 탭 */
        <div className="space-y-6">
          <Card className="bg-gray-800/70 border-gray-600/50">
            <CardHeader>
              <CardTitle className="text-white">1:1 문의</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 제목 */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-white">제목 *</Label>
                <Input
                  id="subject"
                  placeholder="문의 제목을 입력해주세요"
                  value={ticket.subject}
                  onChange={(e) => handleInputChange("subject", e.target.value)}
                />
              </div>

              {/* 카테고리 */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-white">카테고리 *</Label>
                <Select
                  value={ticket.category}
                  onValueChange={(value) =>
                    handleInputChange("category", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="문의 카테고리를 선택해주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">계정/로그인</SelectItem>
                    <SelectItem value="service">AI 아바타 이용</SelectItem>
                    <SelectItem value="payment">구매/결제</SelectItem>
                    <SelectItem value="cancel">취소/환불</SelectItem>
                    <SelectItem value="technical">기술적 문제</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 긴급도 */}
              <div className="space-y-2">
                <Label htmlFor="urgency" className="text-white">긴급도</Label>
                <Select
                  value={ticket.urgency}
                  onValueChange={(value) => handleInputChange("urgency", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">낮음</SelectItem>
                    <SelectItem value="normal">보통</SelectItem>
                    <SelectItem value="high">높음</SelectItem>
                    <SelectItem value="urgent">긴급</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 내용 */}
              <div className="space-y-2">
                <Label htmlFor="message" className="text-white">내용 *</Label>
                <Textarea
                  id="message"
                  placeholder="문의 내용을 자세히 적어주세요&#10;&#10;• 발생한 문제의 상황&#10;• 오류 메시지 (있는 경우)&#10;• 이용 중인 기기 및 브라우저 정보"
                  className="min-h-[120px]"
                  value={ticket.message}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                />
                <p className="text-xs text-gray-400">
                  개인정보(주민등록번호, 카드번호 등)는 입력하지 마세요.
                </p>
              </div>

              {/* 제출 버튼 */}
              <Button
                onClick={handleSubmitTicket}
                disabled={submitTicketMutation.isPending}
                className="w-full"
              >
                {submitTicketMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    문의 접수 중...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    문의 접수
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 문의 접수 안내 */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">
                    문의 처리 시간 안내
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>
                      • <strong>일반 문의:</strong> 1-2 영업일 내 답변
                    </li>
                    <li>
                      • <strong>긴급 문의:</strong> 당일 내 답변
                    </li>
                    <li>
                      • <strong>기술적 문제:</strong> 즉시 확인 후 답변
                    </li>
                    <li>
                      • <strong>휴일/주말:</strong> 다음 영업일에 순차 처리
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* FAQ 탭 */
        <div className="space-y-6">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="궁금한 내용을 검색해보세요..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* FAQ 목록 */}
          <Card className="bg-gray-800/70 border-gray-600/50">
            <CardHeader>
              <CardTitle className="text-white">자주 묻는 질문</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredFAQ.length === 0 ? (
                <div className="text-center py-8">
                  <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">검색 결과가 없습니다.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    다른 키워드로 검색하거나 1:1 문의를 이용해주세요.
                  </p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {filteredFAQ.map((item) => (
                    <AccordionItem key={item.id} value={item.id}>
                      <AccordionTrigger className="text-left">
                        <div className="flex items-start gap-3">
                          <Badge variant="default" className="text-xs">
                            {item.category}
                          </Badge>
                          <span className="flex-1">{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pl-14 text-gray-300">{item.answer}</div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* 추가 도움말 */}
          <Card className="bg-gray-800/70 border-gray-600/50">
            <CardContent className="p-6">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="font-medium text-white mb-2">
                  원하는 답변을 찾지 못하셨나요?
                </h3>
                <p className="text-gray-400 mb-4">
                  1:1 문의를 통해 더 자세한 도움을 받아보세요.
                </p>
                <Button onClick={() => setActiveTab("contact")}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  1:1 문의하기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 추가 링크 */}
      <Card className="bg-gray-800/70 border-gray-600/50 mt-8">
        <CardContent className="p-6">
          <h3 className="font-medium text-white mb-4">더 많은 도움말</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="default" className="justify-start h-auto p-4">
              <div className="text-left">
                <div className="font-medium mb-1 text-white">이용 가이드</div>
                <div className="text-sm text-gray-400">
                  AI 아바타 이용 방법을 자세히 알아보세요
                </div>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>

            <Button
              variant="default"
              className="justify-start h-auto p-4"
              onClick={() => setLocation("/")}
            >
              <div className="text-left">
                <div className="font-medium mb-1 text-white">공지사항</div>
                <div className="text-sm text-gray-400">
                  최신 소식과 업데이트를 확인하세요
                </div>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
     </div>
  );
}
