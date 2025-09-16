import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import NoticesPage from "@/components/admin/NoticesPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
// 관리자 서브페이지 컴포넌트
import MembersPage from "@/components/admin/MembersPage";
import ServicesPaymentsPage from "@/components/admin/ServicesPaymentsPage";
import SettlementsPage from "@/components/admin/SettlementsPage";
import DisputesPage from "@/components/admin/DisputesPage";
import ContentsPage from "@/components/admin/ContentsPage";
import ShopPage from "@/components/admin/ShopPage";
import InquiriesPage from "@/components/admin/InquiriesPage";
import { normalizeImageUrl } from '@/lib/url';
import { changePassword } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AdminProfileProps {
  user: any;
}

// 관리자 대시보드 탭 목록
const adminTabs = [
  { id: "dashboard", label: "대시보드", icon: "fas fa-tachometer-alt" },
  { id: "members", label: "회원 관리", icon: "fas fa-users" },
  { id: "caremanagers", label: "케어매니저 관리", icon: "fas fa-user-nurse" },
  { id: "services", label: "서비스/결제 관리", icon: "fas fa-credit-card" },
  { id: "settlement", label: "정산 관리", icon: "fas fa-calculator" },
  { id: "disputes", label: "분쟁 조정", icon: "fas fa-balance-scale" },
  { id: "inquiries", label: "문의 관리", icon: "fas fa-comments" },
  { id: "shop", label: "쇼핑몰 관리", icon: "fas fa-store" },
  { id: "notice", label: "공지사항", icon: "fas fa-bullhorn" }
];

const AdminProfile = ({ user }: AdminProfileProps) => {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // @ts-ignore – user 객체에 name/displayName 존재 여부를 런타임에서만 확인
  const userDisplay = user ? ((user as any).name ?? (user as any).displayName ?? user.email?.split("@")[0] ?? "") : "";
  // 비밀번호 변경 모달 상태
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const handleLogout = () => {
    logout();
    toast({
      title: "로그아웃",
      description: "성공적으로 로그아웃되었습니다.",
    });
    setLocation('/');
  };

  // 데이터 fetch
  const { data: statsData = { totalUsers:0, totalCareManagers:0, totalRevenue:0 } } = useQuery<any>({
    queryKey:['/api/admin/stats']
  });

  const { data: usersData = [] } = useQuery<any[]>({
    queryKey:['/api/users']
  });

  const recentUsers = usersData.slice(-5).reverse();

  // 서비스 요청 목록 (실제로는 API에서 가져와야 함)
  const serviceRequests = [
    {
      id: 1,
      serviceId: 'SV-2024-001',
      memberName: '김영수',
      careManagerName: '김영희',
      serviceType: '병원 동행',
      amount: 45000,
      paymentStatus: 'completed',
      paymentDate: '2024-01-15',
      serviceDate: '2024-01-16',
    },
    {
      id: 2,
      serviceId: 'SV-2024-002',
      memberName: '박민정',
      careManagerName: '박민수',
      serviceType: '가사 도움',
      amount: 35000,
      paymentStatus: 'pending',
      paymentDate: null,
      serviceDate: '2024-01-17',
    },
    {
      id: 3,
      serviceId: 'SV-2024-003',
      memberName: '이수진',
      careManagerName: '이수진',
      serviceType: '말벗',
      amount: 25000,
      paymentStatus: 'failed',
      paymentDate: '2024-01-14',
      serviceDate: '2024-01-15',
    },
  ];

  // 분쟁 목록 (실제로는 API에서 가져와야 함)
  const disputes = [
    {
      id: 1,
      disputeId: 'DSP-2024-001',
      reporterType: '회원',
      reporterName: '김철수',
      targetName: '김영희',
      disputeType: '서비스 품질',
      reportDate: '2024-01-15',
      status: 'received'
    },
    {
      id: 2,
      disputeId: 'DSP-2024-002',
      reporterType: '케어매니저',
      reporterName: '이수진',
      targetName: '박영수',
      disputeType: '비용',
      reportDate: '2024-01-16',
      status: 'processing'
    }
  ];

  // 상태별 배지 스타일
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      completed: { label: '완료', className: 'bg-green-100 text-green-800' },
      pending: { label: '대기', className: 'bg-yellow-100 text-yellow-800' },
      failed: { label: '실패', className: 'bg-red-100 text-red-800' },
      refunded: { label: '환불', className: 'bg-blue-100 text-blue-800' },
      received: { label: '접수', className: 'bg-gray-100 text-gray-800' },
      processing: { label: '처리중', className: 'bg-yellow-100 text-yellow-800' },
      customer: { label: '고객', className: 'bg-green-100 text-green-800' },
      careManager: { label: '케어매니저', className: 'bg-blue-100 text-blue-800' },
      answered: { label: '답변 완료', className: 'bg-purple-100 text-purple-800' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // 대시보드 렌더링
  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 회원수</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.totalUsers}</p>
                <p className="text-xs text-gray-500">
                  <span className="text-green-600">↑ 12%</span> 전월 대비
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-users text-blue-600 text-xl"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 케어매니저</p>
                <p className="text-2xl font-bold text-blue-600">{statsData.totalCareManagers}</p>
                <p className="text-xs text-gray-500">
                  <span className="text-green-600">↑ 8%</span> 전월 대비
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-user-nurse text-green-600 text-xl"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 매출</p>
                <p className="text-2xl font-bold text-purple-600">{statsData.totalRevenue.toLocaleString()}원</p>
                <p className="text-xs text-gray-500">
                  <span className="text-green-600">↑ 15%</span> 전월 대비
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-won-sign text-purple-600 text-xl"></i>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">최근 가입 회원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-user text-gray-500 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{getStatusBadge(user.type)}</div>
                    <p className="text-xs text-gray-500 mt-1">{user.joinDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="w-full mt-4"
              onClick={() => setSelectedMenu('members')}
            >
              모든 회원 보기
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">최근 서비스 요청</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceRequests.slice(0, 3).map(request => (
                <div key={request.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-gray-800">{request.serviceType}</p>
                    <p className="text-xs text-gray-500">{request.memberName} → {request.careManagerName}</p>
                  </div>
                  <div className="text-right">
                    <div>{getStatusBadge(request.paymentStatus)}</div>
                    <p className="text-xs text-gray-500 mt-1">{request.serviceDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="w-full mt-4"
              onClick={() => setSelectedMenu('services')}
            >
              모든 서비스 보기
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">최근 분쟁</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {disputes.map(dispute => (
                <div key={dispute.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-gray-800">{dispute.disputeType}</p>
                    <p className="text-xs text-gray-500">{dispute.reporterName} vs {dispute.targetName}</p>
                  </div>
                  <div className="text-right">
                    <div>{getStatusBadge(dispute.status)}</div>
                    <p className="text-xs text-gray-500 mt-1">{dispute.reportDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="w-full mt-4"
              onClick={() => setSelectedMenu('disputes')}
            >
              모든 분쟁 보기
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">최근 문의</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  id: 1,
                  subject: "계정 로그인 문제",
                  userName: "한미영",
                  urgency: "urgent",
                  status: "pending",
                  createdAt: "2024-01-22"
                },
                {
                  id: 2,
                  subject: "환불 요청",
                  userName: "최영수",
                  urgency: "high",
                  status: "pending",
                  createdAt: "2024-01-21"
                },
                {
                  id: 3,
                  subject: "결제 오류 문의",
                  userName: "김철수",
                  urgency: "high",
                  status: "answered",
                  createdAt: "2024-01-15"
                }
              ].map(inquiry => (
                <div key={inquiry.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-gray-800">{inquiry.subject}</p>
                    <p className="text-xs text-gray-500">{inquiry.userName}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex gap-1 justify-end mb-1">
                      {getStatusBadge(inquiry.status)}
                      {inquiry.urgency === 'urgent' && (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{inquiry.createdAt}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="w-full mt-4"
              onClick={() => setSelectedMenu('inquiries')}
            >
              모든 문의 보기
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">관리자 작업</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Card className="border border-yellow-200">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-user-check text-yellow-600 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">승인 대기 케어매니저</p>
                      <p className="text-xs text-gray-500">{statsData.pendingApprovals}명 대기중</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-yellow-200 text-yellow-800 hover:bg-yellow-50"
                    onClick={() => setSelectedMenu('caremanagers')}
                  >
                    처리
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="border border-red-200">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-exclamation-triangle text-red-600 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">미해결 분쟁</p>
                      <p className="text-xs text-gray-500">{statsData.disputes}건 처리 필요</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-800 hover:bg-red-50"
                    onClick={() => setSelectedMenu('disputes')}
                  >
                    처리
                  </Button>
                </CardContent>
              </Card>

              <Card className="border border-blue-200">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-coins text-blue-600 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">정산 필요</p>
                      <p className="text-xs text-gray-500">15건 정산 대기중</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-200 text-blue-800 hover:bg-blue-50"
                    onClick={() => setSelectedMenu('settlement')}
                  >
                    정산
                  </Button>
                </CardContent>
              </Card>

              <Card className="border border-purple-200">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-comments text-purple-600 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">미답변 문의</p>
                      <p className="text-xs text-gray-500">8건 답변 대기중</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-200 text-purple-800 hover:bg-purple-50"
                    onClick={() => setSelectedMenu('inquiries')}
                  >
                    답변
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-user-shield text-white text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-800">{userDisplay}</p>
                <Button size="sm" variant="outline" onClick={() => setShowPasswordDialog(true)}>비번변경</Button>
              </div>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-4 space-y-2">
            <div className="mb-4">
              <div className="flex items-center space-x-3 px-4 py-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={normalizeImageUrl(user.photoURL || undefined)} />
                  <AvatarFallback className="bg-red-500 text-white">
                    {userDisplay[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-800">{userDisplay}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
            </div>

            {adminTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedMenu(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors cursor-pointer whitespace-nowrap ${
                  selectedMenu === item.id
                    ? 'bg-red-50 text-red-700 border-r-2 border-red-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <i className={`${item.icon} text-lg`}></i>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors cursor-pointer whitespace-nowrap text-red-600 hover:bg-red-50"
              >
                <i className="fas fa-sign-out-alt text-lg"></i>
                <span className="font-medium">로그아웃</span>
              </button>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <i className="fas fa-bars text-lg"></i>
              </Button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {adminTabs.find(tab => tab.id === selectedMenu)?.label || '대시보드'}
                </h2>
                <p className="text-gray-600">케어 서비스 관리 플랫폼 슈퍼유저 모드</p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Dashboard */}
          {selectedMenu === 'dashboard' && renderDashboard()}

          {/* 각 메뉴별 실제 페이지 */}
          {selectedMenu === 'members' && <MembersPage />}
          {selectedMenu === 'services' && <ServicesPaymentsPage />}
          {selectedMenu === 'settlement' && <SettlementsPage />}
          {selectedMenu === 'disputes' && <DisputesPage />}
          {selectedMenu === 'shop' && <ShopPage />}
          {selectedMenu === 'notice' && <NoticesPage />}
          {selectedMenu === 'inquiries' && <InquiriesPage />}

          {/* 구현되지 않은 탭(예: caremanagers)용 플레이스홀더 */}
          {!['dashboard','members','services','settlement','disputes','shop','notice','inquiries'].includes(selectedMenu) && (
            <div className="text-center py-10">
              <i className={`${adminTabs.find(tab => tab.id === selectedMenu)?.icon || 'fas fa-tools'} text-6xl text-gray-300 mb-4`}></i>
              <h2 className="text-2xl font-bold text-gray-500 mb-2">
                {adminTabs.find(tab => tab.id === selectedMenu)?.label || '관리자 기능'}
              </h2>
              
              {/* 케어매니저 관리 탭에 예약 승인 기능 추가 */}
              {selectedMenu === 'caremanagers' && (
                <>
                  <div className="mt-6 max-w-3xl mx-auto">
                    <Tabs defaultValue="pending">
                      <TabsList className="grid grid-cols-3">
                        <TabsTrigger value="pending">승인 대기</TabsTrigger>
                        <TabsTrigger value="approved">활동 중</TabsTrigger>
                        <TabsTrigger value="blocked">비활성화</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="pending" className="mt-4">
                        <div className="bg-white rounded-lg shadow-sm p-4">
                          <h3 className="text-xl font-bold text-left mb-4">승인 대기 예약 목록</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b">
                                  <th className="py-3 px-4">ID</th>
                                  <th className="py-3 px-4">사용자</th>
                                  <th className="py-3 px-4">케어매니저</th>
                                  <th className="py-3 px-4">서비스</th>
                                  <th className="py-3 px-4">예약일시</th>
                                  <th className="py-3 px-4">금액</th>
                                  <th className="py-3 px-4">작업</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  { id: 1, userId: 'U001', userName: '김철수', careManagerId: 'CM001', careManagerName: '김영희', service: '병원 동행', date: '2025-07-25 14:00', amount: 45000 },
                                  { id: 2, userId: 'U002', userName: '이민지', careManagerId: 'CM002', careManagerName: '박정수', service: '가사 도움', date: '2025-07-26 10:00', amount: 35000 },
                                  { id: 3, userId: 'U003', userName: '박지훈', careManagerId: 'CM003', careManagerName: '이순희', service: '말벗', date: '2025-07-27 15:00', amount: 25000 },
                                ].map(booking => (
                                  <tr key={booking.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-4">#{booking.id}</td>
                                    <td className="py-3 px-4">{booking.userName}</td>
                                    <td className="py-3 px-4">{booking.careManagerName}</td>
                                    <td className="py-3 px-4">{booking.service}</td>
                                    <td className="py-3 px-4">{booking.date}</td>
                                    <td className="py-3 px-4">{booking.amount.toLocaleString()}원</td>
                                    <td className="py-3 px-4">
                                      <div className="flex space-x-2">
                                        <Button 
                                          size="sm" 
                                          className="bg-green-600 hover:bg-green-700 text-white"
                                          onClick={() => {
                                            toast({
                                              title: "승인 완료",
                                              description: `예약 #${booking.id}이 승인되었습니다.`,
                                            });
                                          }}
                                        >
                                          승인
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          className="border-red-200 text-red-600"
                                          onClick={() => {
                                            toast({
                                              title: "거절 완료",
                                              description: `예약 #${booking.id}이 거절되었습니다.`,
                                              variant: "destructive",
                                            });
                                          }}
                                        >
                                          거절
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="approved" className="mt-4">
                        <div className="bg-white rounded-lg shadow-sm p-4">
                          <h3 className="text-xl font-bold text-left mb-4">진행 중인 예약</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b">
                                  <th className="py-3 px-4">ID</th>
                                  <th className="py-3 px-4">사용자</th>
                                  <th className="py-3 px-4">케어매니저</th>
                                  <th className="py-3 px-4">서비스</th>
                                  <th className="py-3 px-4">예약일시</th>
                                  <th className="py-3 px-4">상태</th>
                                  <th className="py-3 px-4">작업</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  { id: 4, userId: 'U004', userName: '최영수', careManagerId: 'CM001', careManagerName: '김영희', service: '병원 동행', date: '2025-07-20 14:00', status: '진행 중' },
                                  { id: 5, userId: 'U005', userName: '한미영', careManagerId: 'CM003', careManagerName: '이순희', service: '말벗', date: '2025-07-21 15:00', status: '완료' },
                                ].map(booking => (
                                  <tr key={booking.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-4">#{booking.id}</td>
                                    <td className="py-3 px-4">{booking.userName}</td>
                                    <td className="py-3 px-4">{booking.careManagerName}</td>
                                    <td className="py-3 px-4">{booking.service}</td>
                                    <td className="py-3 px-4">{booking.date}</td>
                                    <td className="py-3 px-4">
                                      <Badge className={booking.status === '진행 중' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                                        {booking.status}
                                      </Badge>
                                    </td>
                                    <td className="py-3 px-4">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => {
                                          toast({
                                            title: "상세 정보",
                                            description: `예약 #${booking.id}의 상세 정보를 확인합니다.`,
                                          });
                                        }}
                                      >
                                        상세보기
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="blocked" className="mt-4 text-center py-10 text-gray-500">
                        <i className="fas fa-ban text-4xl mb-4 text-gray-300"></i>
                        <p>비활성화된 예약이 없습니다</p>
                      </TabsContent>
                    </Tabs>
                  </div>
                </>
              )}
              
              {selectedMenu !== 'caremanagers' && (
                <p className="text-gray-400">
                  이 기능에 대한 상세 구현이 필요합니다. 각 메뉴의 기능은 필요에 따라 추가 구현할 수 있습니다.
                </p>
              )}
              
              {selectedMenu !== 'caremanagers' && (
                <Button className="mt-6 bg-red-600 hover:bg-red-700">
                  구현 시작하기
                </Button>
              )}
            </div>
          )}
        </main>
      </div>
      {/* 비밀번호 변경 모달 */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>비밀번호 변경</DialogTitle>
            <DialogDescription>현재 비밀번호를 확인하고 새 비밀번호로 변경하세요.</DialogDescription>
          </DialogHeader>
          <PasswordChangeForm userId={user.uid || user.id} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

function PasswordChangeForm({ userId }: { userId: string | number }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return alert('새 비밀번호는 6자 이상이어야 합니다.');
    if (newPassword !== confirmPassword) return alert('새 비밀번호가 일치하지 않습니다.');
    try {
      setLoading(true);
      await changePassword({ userId, currentPassword, newPassword });
      alert('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err.message || '비밀번호 변경 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} required />
      <Input type="password" placeholder="새 비밀번호(6자 이상)" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required />
      <Input type="password" placeholder="새 비밀번호 확인" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required />
      <Button type="submit" disabled={loading}>{loading ? '변경 중...' : '비밀번호 변경'}</Button>
    </form>
  );
}

export default AdminProfile; 