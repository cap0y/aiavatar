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
      careManagerName: '아이린',
      serviceType: '대화 상담',
      amount: 45000,
      paymentStatus: 'completed',
      paymentDate: '2024-01-15',
      serviceDate: '2024-01-16',
    },
    {
      id: 2,
      serviceId: 'SV-2024-002',
      memberName: '박민정',
      careManagerName: '루나',
      serviceType: '엔터테인먼트',
      amount: 35000,
      paymentStatus: 'pending',
      paymentDate: null,
      serviceDate: '2024-01-17',
    },
    {
      id: 3,
      serviceId: 'SV-2024-003',
      memberName: '이수진',
      careManagerName: '소피아',
      serviceType: '교육 도우미',
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
      reporterType: 'AI아바타',
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
      completed: { label: '완료', className: 'bg-green-600 text-white' },
      pending: { label: '대기', className: 'bg-yellow-600 text-white' },
      failed: { label: '실패', className: 'bg-red-600 text-white' },
      refunded: { label: '환불', className: 'bg-blue-600 text-white' },
      received: { label: '접수', className: 'bg-gray-600 text-white' },
      processing: { label: '처리중', className: 'bg-yellow-600 text-white' },
      customer: { label: '고객', className: 'bg-green-600 text-white' },
      careManager: { label: 'AI아바타', className: 'bg-blue-600 text-white' },
      answered: { label: '답변 완료', className: 'bg-purple-600 text-white' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // 대시보드 렌더링
  const renderDashboard = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">총 회원수</p>
                <p className="text-2xl font-bold text-white">{statsData.totalUsers}</p>
                <p className="text-xs text-gray-500">
                  <span className="text-green-400">↑ 12%</span> 전월 대비
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <i className="fas fa-users text-blue-400 text-xl"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">총 AI아바타</p>
                <p className="text-2xl font-bold text-blue-400">{statsData.totalCareManagers}</p>
                <p className="text-xs text-gray-500">
                  <span className="text-green-400">↑ 8%</span> 전월 대비
                </p>
              </div>
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                <i className="fas fa-user-nurse text-green-400 text-xl"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">총 매출</p>
                <p className="text-2xl font-bold text-purple-400">{statsData.totalRevenue.toLocaleString()}원</p>
                <p className="text-xs text-gray-500">
                  <span className="text-green-400">↑ 15%</span> 전월 대비
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <i className="fas fa-won-sign text-purple-400 text-xl"></i>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base font-semibold text-white">최근 가입 회원</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-3">
            <div className="space-y-3">
              {recentUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between border-b border-gray-600/50 pb-2 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                      <i className="fas fa-user text-gray-400 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{getStatusBadge(user.type)}</div>
                    <p className="text-xs text-gray-400 mt-1">{user.joinDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="default" 
              size="sm"
              className="w-full mt-3 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-xs"
              onClick={() => setSelectedMenu('members')}
            >
              모든 회원 보기
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base font-semibold text-white">최근 서비스 요청</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {serviceRequests.slice(0, 3).map(request => (
                <div key={request.id} className="flex items-center justify-between border-b border-gray-600/50 pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-white">{request.serviceType}</p>
                    <p className="text-xs text-gray-400">{request.memberName} → {request.careManagerName}</p>
                  </div>
                  <div className="text-right">
                    <div>{getStatusBadge(request.paymentStatus)}</div>
                    <p className="text-xs text-gray-400 mt-1">{request.serviceDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="default" 
              size="sm"
              className="w-full mt-3 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-xs"
              onClick={() => setSelectedMenu('services')}
            >
              모든 서비스 보기
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base font-semibold text-white">최근 분쟁</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {disputes.map(dispute => (
                <div key={dispute.id} className="flex items-center justify-between border-b border-gray-600/50 pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-white">{dispute.disputeType}</p>
                    <p className="text-xs text-gray-400">{dispute.reporterName} vs {dispute.targetName}</p>
                  </div>
                  <div className="text-right">
                    <div>{getStatusBadge(dispute.status)}</div>
                    <p className="text-xs text-gray-400 mt-1">{dispute.reportDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="default" 
              size="sm"
              className="w-full mt-3 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-xs"
              onClick={() => setSelectedMenu('disputes')}
            >
              모든 분쟁 보기
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base font-semibold text-white">최근 문의</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
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
                <div key={inquiry.id} className="flex items-center justify-between border-b border-gray-600/50 pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-white">{inquiry.subject}</p>
                    <p className="text-xs text-gray-400">{inquiry.userName}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex gap-1 justify-end mb-1">
                      {getStatusBadge(inquiry.status)}
                      {inquiry.urgency === 'urgent' && (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{inquiry.createdAt}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="default" 
              size="sm"
              className="w-full mt-3 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-xs"
              onClick={() => setSelectedMenu('inquiries')}
            >
              모든 문의 보기
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base font-semibold text-white">관리자 작업</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-3">
            <div className="space-y-2">
              <Card className="border border-yellow-500/30 bg-yellow-900/20">
                <CardContent className="p-2 flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-yellow-600/30 rounded-lg flex items-center justify-center mr-2">
                      <i className="fas fa-user-check text-yellow-400 text-xs"></i>
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">승인 대기 AI아바타</p>
                      <p className="text-xs text-gray-400">{statsData.pendingApprovals}명 대기중</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="border-yellow-500 text-yellow-400 hover:bg-yellow-900/30"
                    onClick={() => setSelectedMenu('members')}
                  >
                    처리
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="border border-red-500/30 bg-red-900/20">
                <CardContent className="p-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-red-600/30 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-exclamation-triangle text-red-400 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-white">미해결 분쟁</p>
                      <p className="text-xs text-gray-400">{statsData.disputes}건 처리 필요</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="border-red-500 text-red-400 hover:bg-red-900/30"
                    onClick={() => setSelectedMenu('disputes')}
                  >
                    처리
                  </Button>
                </CardContent>
              </Card>

              <Card className="border border-blue-500/30 bg-blue-900/20">
                <CardContent className="p-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-coins text-blue-400 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-white">정산 필요</p>
                      <p className="text-xs text-gray-400">15건 정산 대기중</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="border-blue-500 text-blue-400 hover:bg-blue-900/30"
                    onClick={() => setSelectedMenu('settlement')}
                  >
                    정산
                  </Button>
                </CardContent>
              </Card>

              <Card className="border border-purple-500/30 bg-purple-900/20">
                <CardContent className="p-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-600/30 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-comments text-purple-400 text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-white">미답변 문의</p>
                      <p className="text-xs text-gray-400">8건 답변 대기중</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="border-purple-500 text-purple-400 hover:bg-purple-900/30"
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
    <div className="min-h-screen bg-gray-900 text-white w-full" style={{ margin: 0, padding: 0 }}>
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ top: '12px' }}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 ease-in-out z-30 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
      style={{ top: '30px', height: 'calc(100vh - 30px)' }}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-user-shield text-white text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-white">{userDisplay}</p>
                <Button size="sm" variant="default" className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500" onClick={() => setShowPasswordDialog(true)}>비번변경</Button>
              </div>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-3 space-y-2">
            <div className="mb-4">
              <div className="flex items-center space-x-3 px-4 py-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={normalizeImageUrl(user.photoURL || undefined)} />
                  <AvatarFallback className="bg-indigo-600 text-white">
                    {userDisplay[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-white">{userDisplay}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
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
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <i className={`${item.icon} text-lg`}></i>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors cursor-pointer whitespace-nowrap text-red-400 hover:bg-red-900/20 hover:text-red-300"
              >
                <i className="fas fa-sign-out-alt text-lg"></i>
                <span className="font-medium">로그아웃</span>
              </button>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 bg-gray-900" style={{ minHeight: '100vh', marginTop: '12px' }}>
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-1 sticky top-8 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <i className="fas fa-bars text-lg"></i>
              </Button>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {adminTabs.find(tab => tab.id === selectedMenu)?.label || '대시보드'}
                </h2>
                <p className="text-sm text-gray-400">AI 아바타 서비스 관리 플랫폼</p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-2 bg-gray-900 min-h-[calc(100vh-70px)]">
          {/* Dashboard */}
          {selectedMenu === 'dashboard' && (
            <div className="bg-gray-900">
              {renderDashboard()}
            </div>
          )}

          {/* 각 메뉴별 실제 페이지 */}
          {selectedMenu === 'members' && (
            <div className="bg-gray-900 min-h-full">
              <MembersPage />
            </div>
          )}
          {selectedMenu === 'services' && (
            <div className="bg-gray-900 min-h-full">
              <ServicesPaymentsPage />
            </div>
          )}
          {selectedMenu === 'settlement' && (
            <div className="bg-gray-900 min-h-full">
              <SettlementsPage />
            </div>
          )}
          {selectedMenu === 'disputes' && (
            <div className="bg-gray-900 min-h-full">
              <DisputesPage />
            </div>
          )}
          {selectedMenu === 'shop' && (
            <div className="bg-gray-900 min-h-full">
              <ShopPage />
            </div>
          )}
          {selectedMenu === 'notice' && (
            <div className="bg-gray-900 min-h-full">
              <NoticesPage />
            </div>
          )}
          {selectedMenu === 'inquiries' && (
            <div className="bg-gray-900 min-h-full">
              <InquiriesPage />
            </div>
          )}

          {/* 구현되지 않은 탭용 플레이스홀더 */}
          {!['dashboard','members','services','settlement','disputes','shop','notice','inquiries'].includes(selectedMenu) && (
            <div className="bg-gray-900 min-h-full">
              <div className="text-center py-10">
                <i className={`${adminTabs.find(tab => tab.id === selectedMenu)?.icon || 'fas fa-tools'} text-6xl text-gray-600 mb-4`}></i>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {adminTabs.find(tab => tab.id === selectedMenu)?.label || '관리자 기능'}
                </h2>
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gray-800/70 rounded-lg border border-gray-600/50 p-8 mt-6">
                    <p className="text-gray-400 mb-6">
                      이 기능에 대한 상세 구현이 필요합니다. 각 메뉴의 기능은 필요에 따라 추가 구현할 수 있습니다.
                    </p>
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                      구현 시작하기
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {/* 비밀번호 변경 모달 */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[420px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">비밀번호 변경</DialogTitle>
            <DialogDescription className="text-gray-400">현재 비밀번호를 확인하고 새 비밀번호로 변경하세요.</DialogDescription>
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
      <Input type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} required className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" />
      <Input type="password" placeholder="새 비밀번호(6자 이상)" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" />
      <Input type="password" placeholder="새 비밀번호 확인" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" />
      <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">{loading ? '변경 중...' : '비밀번호 변경'}</Button>
    </form>
  );
}

export default AdminProfile; 