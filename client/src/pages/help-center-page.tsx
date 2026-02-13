import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageCircle, Lock, Reply, HelpCircle, Grid3X3, Package, Truck, CreditCard, Repeat, Settings, Plus, Megaphone, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Footer from '@/components/footer';
import Navigation from '@/components/navigation';

const HelpCenterPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("faq");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [inquiryFile, setInquiryFile] = useState<File | null>(null);
  const [inquiryData, setInquiryData] = useState({
    title: "",
    content: "",
    type: "product",
    isPrivate: false
  });
  const [noticeData, setNoticeData] = useState({
    title: "",
    content: "",
    isImportant: false,
    isPublished: true
  });
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [replyContent, setReplyContent] = useState("");

  // 공지사항 조회
  const { data: noticesData, isLoading: noticesLoading } = useQuery({
    queryKey: ["/api/notices"],
    queryFn: () => fetch("/api/notices").then(res => res.json()),
  });

  // 문의사항 조회 (로그인한 사용자만)
  const { data: inquiriesData, isLoading: inquiriesLoading, refetch: refetchInquiries } = useQuery({
    queryKey: ["/api/inquiries"],
    queryFn: () => {
      const token = localStorage.getItem('auth_token');
      console.log('🔍 문의사항 조회 토큰:', token ? `${token.substring(0, 20)}...` : 'null');
      return fetch("/api/inquiries", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).then(res => res.json());
    },
    enabled: !!user,
  });

  // 문의사항 등록 mutation
  const createInquiryMutation = useMutation({
    mutationFn: async (inquiryData: any) => {
      const token = localStorage.getItem('auth_token');
      console.log('📝 문의사항 등록 토큰:', token ? `${token.substring(0, 20)}...` : 'null');
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inquiryData),
      });
      
      if (!response.ok) {
        throw new Error("문의 등록에 실패했습니다.");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "문의 등록 완료",
        description: "문의가 성공적으로 등록되었습니다. 빠른 시일 내에 답변드리겠습니다.",
      });
      setInquiryDialogOpen(false);
      setInquiryData({
        title: "",
        content: "",
        type: "product",
        isPrivate: false
      });
      refetchInquiries();
    },
    onError: (error: any) => {
      toast({
        title: "문의 등록 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 공지사항 등록 mutation (관리자 전용)
  const createNoticeMutation = useMutation({
    mutationFn: async (noticeData: any) => {
      const token = localStorage.getItem('auth_token');
      console.log('📢 공지사항 등록 토큰:', token ? `${token.substring(0, 20)}...` : 'null');
      const response = await fetch("/api/notices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(noticeData),
      });
      
      if (!response.ok) {
        throw new Error("공지사항 등록에 실패했습니다.");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "공지사항 등록 완료",
        description: "공지사항이 성공적으로 등록되었습니다.",
      });
      setNoticeDialogOpen(false);
      setNoticeData({
        title: "",
        content: "",
        isImportant: false,
        isPublished: true
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
    },
    onError: (error: any) => {
      toast({
        title: "공지사항 등록 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 문의사항 삭제 mutation (관리자 전용)
  const deleteInquiryMutation = useMutation({
    mutationFn: async (inquiryId: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        throw new Error("문의사항 삭제에 실패했습니다.");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "삭제 완료",
        description: "문의사항이 삭제되었습니다.",
      });
      refetchInquiries();
    },
    onError: (error: any) => {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 공지사항 삭제 mutation (관리자 전용)
  const deleteNoticeMutation = useMutation({
    mutationFn: async (noticeId: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/notices/${noticeId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        throw new Error("공지사항 삭제에 실패했습니다.");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "삭제 완료",
        description: "공지사항이 삭제되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
    },
    onError: (error: any) => {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 문의사항 답변 mutation (관리자 전용)
  const replyInquiryMutation = useMutation({
    mutationFn: async ({ inquiryId, answer }: { inquiryId: number; answer: string }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/inquiries/${inquiryId}/answer`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answer }),
      });
      
      if (!response.ok) {
        throw new Error("답변 등록에 실패했습니다.");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "답변 등록 완료",
        description: "답변이 성공적으로 등록되었습니다.",
      });
      setReplyDialogOpen(false);
      setReplyContent("");
      setSelectedInquiry(null);
      refetchInquiries();
    },
    onError: (error: any) => {
      toast({
        title: "답변 등록 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const categories = [
    { id: "all", name: "전체", icon: "grid" },
    { id: "product", name: "AI 아바타", icon: "package" },
    { id: "delivery", name: "사용방법", icon: "truck" },
    { id: "payment", name: "결제/정산", icon: "credit-card" },
    { id: "refund", name: "환불/취소", icon: "repeat" },
    { id: "account", name: "계정 관리", icon: "settings" },
    { id: "etc", name: "기타 문의", icon: "help-circle" }
  ];

  const faqs = [
    {
      id: 1,
      category: "product",
      question: "AI 아바타는 어떻게 생성하나요?",
      answer: "AI 아바타 생성은 매우 간단합니다. 사진이나 설명을 입력하면 AI가 자동으로 고품질 아바타를 생성해드립니다. 다양한 스타일과 표현을 선택할 수 있으며, 생성 후 추가 수정도 가능합니다. 평균 3-5분 정도 소요됩니다."
    },
    {
      id: 2,
      category: "delivery",
      question: "AI 음성 대화는 어떻게 사용하나요?",
      answer: "채팅 페이지에서 음성 버튼을 눌러 말씀하시면 AI가 자연스러운 음성으로 응답합니다. 한국어, 영어 등 다양한 언어를 지원하며, 음성 속도와 톤 조절도 가능합니다. 텍스트로 입력하셔도 음성으로 응답받을 수 있습니다."
    },
    {
      id: 3,
      category: "payment",
      question: "결제 수단은 어떤 것들이 있나요?",
      answer: "신용카드, 체크카드, 계좌이체, 간편결제(카카오페이, 네이버페이 등)를 지원합니다. 정기 구독의 경우 자동결제가 가능하며, 영수증과 세금계산서 발급도 가능합니다. 안전한 결제를 위해 PG사 보안 시스템을 적용하고 있습니다."
    },
    {
      id: 4,
      category: "refund",
      question: "환불 정책은 어떻게 되나요?",
      answer: "서비스 이용 전 또는 7일 이내 취소 시 전액 환불이 가능합니다. 서비스를 이미 이용한 경우 이용 기간을 제외한 금액을 환불해드립니다. 정기 구독은 언제든지 해지 가능하며, 해지 시점부터 과금이 중단됩니다. 환불은 영업일 기준 3-5일 내 처리됩니다."
    },
    {
      id: 5,
      category: "account",
      question: "계정 정보는 어떻게 관리하나요?",
      answer: "프로필 페이지에서 언제든지 개인정보를 수정할 수 있습니다. 비밀번호 변경, 이메일 변경, 프로필 사진 업데이트가 가능하며, 계정 보안을 위해 2단계 인증 설정도 권장드립니다. 개인정보는 안전하게 암호화되어 저장됩니다."
    },
    {
      id: 6,
      category: "product",
      question: "AI 아바타 퀄리티가 마음에 들지 않으면 어떻게 하나요?",
      answer: "생성된 아바타가 만족스럽지 않으면 무료로 재생성할 수 있습니다. 스타일, 표정, 포즈 등을 변경하여 여러 번 시도해보실 수 있으며, 상세한 설명을 추가하면 더 정확한 결과를 얻으실 수 있습니다. 필요시 고객지원팀에 문의하시면 도움을 드립니다."
    },
    {
      id: 7,
      category: "delivery",
      question: "생성된 이미지의 저작권은 누구에게 있나요?",
      answer: "고객님이 생성하신 AI 아바타의 상업적 이용 권한은 유료 구독 회원님께 있습니다. 생성된 이미지는 자유롭게 다운로드하고 사용하실 수 있으며, SNS, 프로필 사진, 마케팅 자료 등에 활용 가능합니다. 단, 불법적이거나 윤리적으로 문제가 되는 용도는 금지됩니다."
    },
    {
      id: 8,
      category: "payment",
      question: "정기 구독 요금제는 어떻게 되나요?",
      answer: "무료 체험, 베이직(월 9,900원), 프로(월 29,900원), 프리미엄(월 49,900원) 요금제를 제공합니다. 요금제별로 월간 생성 가능한 이미지 수와 고급 기능 이용 범위가 다르며, 연간 구독 시 20% 할인 혜택이 있습니다. 언제든지 업그레이드 또는 다운그레이드 가능합니다."
    }
  ];

  // 이용가이드 FAQ 데이터
  const guideItems = [
    {
      id: 1,
      title: "AI아바타세상 시작하기",
      content: `
        <div class="space-y-4">
          <h4 class="font-semibold">1. 회원가입 및 로그인</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>이메일 또는 소셜 로그인(카카오, 구글) 가능</li>
            <li>간단한 프로필 설정 완료</li>
            <li>무료 체험 크레딧 자동 지급</li>
            <li>메인 페이지에서 서비스 시작</li>
          </ul>
          
          <h4 class="font-semibold">2. 이용 시 주의사항</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>공용 기기 사용 시 로그아웃 필수</li>
            <li>개인정보 보호를 위한 비밀번호 관리</li>
            <li>생성된 이미지는 자동 저장됨</li>
            <li>Chrome, Safari 최신 버전 권장</li>
          </ul>
        </div>
      `
    },
    {
      id: 2,
      title: "AI 아바타 생성하기",
      content: `
        <div class="space-y-4">
          <h4 class="font-semibold">1. 이미지 생성 절차</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>아바타 스튜디오 메뉴 선택</li>
            <li>원하는 스타일과 특징 선택</li>
            <li>텍스트 또는 이미지 입력</li>
            <li>생성 버튼 클릭 후 3-5분 대기</li>
            <li>결과 확인 및 다운로드</li>
          </ul>
          
          <h4 class="font-semibold">2. 고급 옵션 활용</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>표정: 미소, 진지함, 활발함 등 선택</li>
            <li>배경: 단색, 그라데이션, 커스텀</li>
            <li>스타일: 사실적, 일러스트, 애니메이션</li>
            <li>해상도: 기본, HD, 4K 선택 가능</li>
          </ul>
        </div>
      `
    },
    {
      id: 3,
      title: "결제 및 구독 안내",
      content: `
        <div class="space-y-4">
          <h4 class="font-semibold">1. 구독 요금제</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>무료: 월 3회 생성 (기본 화질)</li>
            <li>베이직: 월 9,900원 (월 50회, HD)</li>
            <li>프로: 월 29,900원 (월 200회, 4K)</li>
            <li>프리미엄: 월 49,900원 (무제한, 우선처리)</li>
          </ul>
          
          <h4 class="font-semibold">2. 결제 방법</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>신용카드/체크카드 자동결제</li>
            <li>카카오페이, 네이버페이 지원</li>
            <li>계좌이체 (법인 고객)</li>
            <li>영수증/세금계산서 발급 가능</li>
          </ul>
        </div>
      `
    },
    {
      id: 4,
      title: "AI 음성 대화 사용법",
      content: `
        <div class="space-y-4">
          <h4 class="font-semibold">1. 음성 대화 시작</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>채팅 페이지 접속</li>
            <li>마이크 버튼 클릭 또는 탭</li>
            <li>음성으로 질문하기</li>
            <li>AI의 음성 응답 듣기</li>
            <li>대화 내역 자동 저장</li>
          </ul>
          
          <h4 class="font-semibold">2. 음성 설정</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>음성 속도 조절 (0.5x ~ 2.0x)</li>
            <li>언어 선택 (한국어, 영어 등)</li>
            <li>성별 및 톤 선택</li>
            <li>배경음 ON/OFF</li>
          </ul>
        </div>
      `
    },
    {
      id: 5,
      title: "모바일 앱 이용 안내",
      content: `
        <div class="space-y-4">
          <h4 class="font-semibold">1. 모바일 접속 방법</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>PWA 앱 설치 (홈 화면에 추가)</li>
            <li>모바일 웹 브라우저 접속</li>
            <li>반응형 디자인 자동 적용</li>
            <li>주요 기능 모두 지원</li>
          </ul>
          
          <h4 class="font-semibold">2. 모바일 주요 기능</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>AI 아바타 생성 및 편집</li>
            <li>음성 대화 (마이크 권한 필요)</li>
            <li>이미지 갤러리 확인</li>
            <li>알림 및 구독 관리</li>
          </ul>
        </div>
      `
    },
    {
      id: 6,
      title: "고객지원 및 문의",
      content: `
        <div class="space-y-4">
          <h4 class="font-semibold">1. 고객센터 운영시간</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>평일: 09:00 - 18:00</li>
            <li>토요일: 09:00 - 13:00</li>
            <li>일요일 및 공휴일: 휴무</li>
            <li>AI 챗봇 24시간 상담 가능</li>
          </ul>
          
          <h4 class="font-semibold">2. 문의 방법</h4>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>1:1 문의 (24시간 접수)</li>
            <li>이메일: decom2soft@gmail.com</li>
            <li>전화: 055-762-9703</li>
            <li>카카오톡 채널 상담</li>
          </ul>
        </div>
      `
    }
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInquirySubmit = () => {
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "문의를 등록하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    if (!inquiryData.title.trim() || !inquiryData.content.trim()) {
      toast({
        title: "입력 오류",
        description: "제목과 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    createInquiryMutation.mutate(inquiryData);
  };

  const handleNoticeSubmit = () => {
    if (!user || user.userType !== 'admin') {
      toast({
        title: "권한 없음",
        description: "관리자만 공지사항을 등록할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    if (!noticeData.title.trim() || !noticeData.content.trim()) {
      toast({
        title: "입력 오류",
        description: "제목과 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    createNoticeMutation.mutate(noticeData);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      // 유효한 날짜인지 확인
      if (isNaN(date.getTime())) {
        return dateString; // 원본 문자열 반환
      }
      
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('날짜 포맷팅 오류:', error);
      return dateString || '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">답변 대기</Badge>;
      case 'answered':
        return <Badge variant="default">답변 완료</Badge>;
      case 'closed':
        return <Badge variant="outline">종료</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeName = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'product': 'AI 아바타 문의',
      'payment': '결제/정산 문의',
      'delivery': '사용방법 문의',
      'refund': '환불/취소 문의',
      'account': '계정 관리',
      'general': '일반 문의',
      'etc': '기타 문의'
    };
    return typeMap[type] || type;
  };

  const handleDeleteInquiry = (inquiryId: number) => {
    if (window.confirm('정말로 이 문의사항을 삭제하시겠습니까?')) {
      deleteInquiryMutation.mutate(inquiryId);
    }
  };

  const handleDeleteNotice = (noticeId: number) => {
    if (window.confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      deleteNoticeMutation.mutate(noticeId);
    }
  };

  const handleReplyInquiry = (inquiry: any) => {
    setSelectedInquiry(inquiry);
    setReplyContent(inquiry.answer || "");
    setReplyDialogOpen(true);
  };

  const handleSubmitReply = () => {
    if (!selectedInquiry || !replyContent.trim()) {
      toast({
        title: "입력 오류",
        description: "답변 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    replyInquiryMutation.mutate({
      inquiryId: selectedInquiry.id,
      answer: replyContent
    });
  };

  const renderIcon = (iconName: string) => {
    const iconProps = { className: "w-4 h-4 mr-2" };
    
    switch (iconName) {
      case 'grid':
        return <Grid3X3 {...iconProps} />;
      case 'package':
        return <Package {...iconProps} />;
      case 'truck':
        return <Truck {...iconProps} />;
      case 'credit-card':
        return <CreditCard {...iconProps} />;
      case 'repeat':
        return <Repeat {...iconProps} />;
      case 'settings':
        return <Settings {...iconProps} />;
      case 'help-circle':
        return <HelpCircle {...iconProps} />;
      default:
        return <HelpCircle {...iconProps} />;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-gray-100 pb-24">

        {/* Hero Section */}
        <section className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">고객센터</h2>
          <p className="text-xl mb-8">궁금한 것이 있으시면 언제든지 문의해 주세요</p>
          <div className="flex justify-center">
            <div className="relative max-w-md w-full">
              <Input
                type="text"
                placeholder="궁금한 내용을 검색하세요"
                className="pl-4 pr-12 py-3 bg-gray-800 text-white border-gray-700 placeholder:text-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button className="absolute right-1 top-0 bottom-0 px-4 bg-purple-600 hover:bg-purple-700">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="faq" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="faq">자주 묻는 질문</TabsTrigger>
            <TabsTrigger value="inquiry">1:1 문의</TabsTrigger>
            <TabsTrigger value="notice">공지사항</TabsTrigger>
            <TabsTrigger value="guide">이용가이드</TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Categories Sidebar */}
              <div className="lg:col-span-1">
                <Card className="p-4 bg-gray-800 border-gray-700">
                  <h3 className="font-semibold mb-4 text-white">카테고리</h3>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center ${
                          selectedCategory === category.id
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <span className="flex items-center">
                          {renderIcon(category.icon)}
                          <span>{category.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              {/* FAQ List */}
              <div className="lg:col-span-3">
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">
                    자주 묻는 질문 ({filteredFaqs.length}건)
                  </h3>
                </div>

                <Accordion type="single" collapsible className="space-y-2">
                  {filteredFaqs.map((faq) => (
                    <AccordionItem key={faq.id} value={`faq-${faq.id}`} className="border border-gray-700 rounded-lg px-4 bg-gray-800">
                      <AccordionTrigger className="text-left hover:no-underline text-white">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
                            {categories.find(c => c.id === faq.category)?.name}
                          </Badge>
                          <span className="font-medium">{faq.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-300 pt-4 border-t border-gray-700">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {filteredFaqs.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">검색 결과가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 1:1 Inquiry Tab */}
          <TabsContent value="inquiry" className="mt-8">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">1:1 문의</h3>
                {user && (
                  <Dialog open={inquiryDialogOpen} onOpenChange={setInquiryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        <Plus className="w-4 h-4 mr-2" />
                        새 문의 작성
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl bg-gray-800 border-gray-700 text-white">
                      <DialogHeader>
                        <DialogTitle>새 문의 작성</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="inquiry-type">문의 유형</Label>
                          <Select onValueChange={(value) => setInquiryData({...inquiryData, type: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="문의 유형을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="product">AI 아바타 문의</SelectItem>
                              <SelectItem value="payment">결제/정산 문의</SelectItem>
                              <SelectItem value="delivery">사용방법 문의</SelectItem>
                              <SelectItem value="refund">환불/취소 문의</SelectItem>
                              <SelectItem value="account">계정 관리</SelectItem>
                              <SelectItem value="general">일반 문의</SelectItem>
                              <SelectItem value="etc">기타 문의</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="inquiry-title">제목</Label>
                          <Input
                            id="inquiry-title"
                            value={inquiryData.title}
                            onChange={(e) => setInquiryData({...inquiryData, title: e.target.value})}
                            placeholder="문의 제목을 입력하세요"
                          />
                        </div>
                        <div>
                          <Label htmlFor="inquiry-content">내용</Label>
                          <Textarea
                            id="inquiry-content"
                            value={inquiryData.content}
                            onChange={(e) => setInquiryData({...inquiryData, content: e.target.value})}
                            placeholder="문의 내용을 상세히 입력해주세요"
                            className="min-h-[150px]"
                          />
                        </div>
                        <div>
                          <Label htmlFor="inquiry-file">첨부파일</Label>
                          <Input
                            id="inquiry-file"
                            type="file"
                            onChange={(e) => setInquiryFile(e.target.files?.[0] || null)}
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            파일 크기는 10MB 이하로 제한됩니다.
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="inquiry-private"
                            checked={inquiryData.isPrivate}
                            onChange={(e) => setInquiryData({...inquiryData, isPrivate: e.target.checked})}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <Label htmlFor="inquiry-private" className="text-sm">
                            <Lock className="w-3 h-3 mr-1 text-orange-600 inline" />
                            비밀글로 작성 (관리자와 본인만 확인 가능)
                          </Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setInquiryDialogOpen(false)}>
                          취소
                        </Button>
                        <Button onClick={handleInquirySubmit} disabled={createInquiryMutation.isPending}>
                          {createInquiryMutation.isPending ? "등록 중..." : "문의 등록"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {!user && (
                <Card className="p-6 text-center bg-gray-800 border-gray-700">
                  <p className="text-gray-300 mb-4">1:1 문의를 이용하려면 로그인이 필요합니다.</p>
                  <Button onClick={() => window.location.href = '/auth'} className="bg-purple-600 hover:bg-purple-700">
                    로그인하기
                  </Button>
                </Card>
              )}

              {user && (
                <div className="space-y-3">
                  {inquiriesLoading && (
                    <div className="text-center py-8">
                      <p className="text-gray-400">문의 내역을 불러오는 중...</p>
                    </div>
                  )}

                  {inquiriesData?.inquiries?.map((inquiry: any) => (
                    <Card key={inquiry.id} className={`p-4 bg-gray-800 border-gray-700 ${inquiry.isPrivate ? 'border-orange-500' : ''}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(inquiry.status)}
                          <Badge variant="outline" className="text-xs">{getTypeName(inquiry.type)}</Badge>
                          {inquiry.isPrivate && (
                            <Badge variant="outline" className="text-orange-600 border-orange-600 bg-orange-100 text-xs">
                              <Lock className="w-3 h-3 mr-1" />
                              비밀글
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">{formatDate(inquiry.created_at || inquiry.createdAt)}</span>
                          {user && user.userType === 'admin' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReplyInquiry(inquiry)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs px-2 py-1 h-7"
                              >
                                <Reply className="w-3 h-3 mr-1" />
                                답글
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteInquiry(inquiry.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs px-2 py-1 h-7"
                                disabled={deleteInquiryMutation.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center mb-2">
                        {inquiry.isPrivate && (
                          <Lock className="w-4 h-4 text-orange-400 mr-2" />
                        )}
                        <h4 className="font-semibold text-sm text-white">{inquiry.title}</h4>
                      </div>
                      <p className="text-gray-300 mb-3 whitespace-pre-wrap text-sm leading-relaxed">{inquiry.content}</p>
                      
                      {inquiry.answer && (
                        <div className="bg-purple-900/30 p-3 rounded-lg mt-3 border border-purple-700">
                          <div className="flex items-center mb-2">
                            <Reply className="w-4 h-4 text-purple-400 mr-2" />
                            <span className="font-medium text-purple-400 text-sm">답변</span>
                            <span className="text-xs text-gray-400 ml-auto">
                              {formatDate(inquiry.answered_at || inquiry.answeredAt)} | 관리자
                            </span>
                          </div>
                          <p className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">{inquiry.answer}</p>
                        </div>
                      )}
                    </Card>
                  ))}

                  {inquiriesData?.inquiries?.length === 0 && (
                    <div className="text-center py-12">
                      <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">등록된 문의가 없습니다.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* 답글 작성 다이얼로그 */}
          <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
            <DialogContent className="max-w-2xl bg-gray-800 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle>문의 답변 작성</DialogTitle>
              </DialogHeader>
              {selectedInquiry && (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">원본 문의</h4>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>제목:</strong> {selectedInquiry.title}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>유형:</strong> {getTypeName(selectedInquiry.type)}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>작성일:</strong> {formatDate(selectedInquiry.created_at || selectedInquiry.createdAt)}
                    </p>
                    <div className="bg-white p-3 rounded border">
                      <p className="text-sm whitespace-pre-wrap">{selectedInquiry.content}</p>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="reply-content">답변 내용</Label>
                    <Textarea
                      id="reply-content"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="답변 내용을 입력해주세요"
                      className="min-h-[150px] mt-2"
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleSubmitReply} disabled={replyInquiryMutation.isPending}>
                  {replyInquiryMutation.isPending ? "답변 등록 중..." : "답변 등록"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Notice Tab */}
          <TabsContent value="notice" className="mt-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">공지사항</h3>
                {user && user.userType === 'admin' && (
                  <Dialog open={noticeDialogOpen} onOpenChange={setNoticeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        <Plus className="w-4 h-4 mr-2" />
                        새 공지사항 작성
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl bg-gray-800 border-gray-700 text-white">
                      <DialogHeader>
                        <DialogTitle>새 공지사항 작성</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="notice-title">제목</Label>
                          <Input
                            id="notice-title"
                            value={noticeData.title}
                            onChange={(e) => setNoticeData({...noticeData, title: e.target.value})}
                            placeholder="공지사항 제목을 입력하세요"
                          />
                        </div>
                        <div>
                          <Label htmlFor="notice-content">내용</Label>
                          <Textarea
                            id="notice-content"
                            value={noticeData.content}
                            onChange={(e) => setNoticeData({...noticeData, content: e.target.value})}
                            placeholder="공지사항 내용을 입력하세요"
                            className="min-h-[200px]"
                          />
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="notice-important"
                              checked={noticeData.isImportant}
                              onChange={(e) => setNoticeData({...noticeData, isImportant: e.target.checked})}
                              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                            <Label htmlFor="notice-important" className="text-sm">
                              중요 공지사항
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="notice-published"
                              checked={noticeData.isPublished}
                              onChange={(e) => setNoticeData({...noticeData, isPublished: e.target.checked})}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <Label htmlFor="notice-published" className="text-sm">
                              즉시 게시
                            </Label>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNoticeDialogOpen(false)}>
                          취소
                        </Button>
                        <Button onClick={handleNoticeSubmit} disabled={createNoticeMutation.isPending}>
                          {createNoticeMutation.isPending ? "등록 중..." : "공지사항 등록"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              
              {noticesLoading && (
                <div className="text-center py-8">
                  <p className="text-gray-400">공지사항을 불러오는 중...</p>
                </div>
              )}

              <Accordion type="single" collapsible className="space-y-2">
                {noticesData?.notices?.map((notice: any) => (
                  <AccordionItem key={notice.id} value={`notice-${notice.id}`} className="border border-gray-700 rounded-lg px-4 bg-gray-800">
                    <AccordionTrigger className="text-left hover:no-underline text-white">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-3">
                          {notice.isImportant && (
                            <Badge className="bg-red-600">중요</Badge>
                          )}
                          <Megaphone className="w-4 h-4 text-purple-400" />
                          <span className="font-medium">{notice.title}</span>
                        </div>
                        <div className="flex items-center space-x-2 mr-4">
                          <span className="text-sm text-gray-500">{formatDate(notice.created_at || notice.createdAt)}</span>
                          {user && user.userType === 'admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNotice(notice.id);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={deleteNoticeMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 border-t border-gray-700">
                      <div className="text-gray-300">
                        {notice.content ? (
                          <div className="whitespace-pre-wrap">{notice.content}</div>
                        ) : (
                          <p className="text-gray-500 italic">내용이 없습니다.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {noticesData?.notices?.length === 0 && (
                <div className="text-center py-12">
                  <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">등록된 공지사항이 없습니다.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Guide Tab */}
          <TabsContent value="guide" className="mt-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">이용가이드</h3>
              
              <Accordion type="single" collapsible className="space-y-2">
                {guideItems.map((item) => (
                  <AccordionItem key={item.id} value={`guide-${item.id}`} className="border border-gray-700 rounded-lg px-4 bg-gray-800">
                    <AccordionTrigger className="text-left hover:no-underline text-white">
                      <div className="flex items-center space-x-3">
                        <HelpCircle className="w-4 h-4 text-purple-400" />
                        <span className="font-medium">{item.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 border-t border-gray-700 text-gray-300">
                      <div dangerouslySetInnerHTML={{ __html: item.content }} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
    <Navigation />
    </>
  );
};

export default HelpCenterPage;