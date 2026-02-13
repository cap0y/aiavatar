import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { UserType, UserGrade, isSuperAdmin, ensureAdminRights, SUPER_ADMIN_EMAIL } from "@/contexts/AuthContext";
import CustomerProfile from "@/components/profile/CustomerProfile";
import CareManagerProfile from "@/components/profile/CareManagerProfile";
import AdminProfile from "@/components/profile/AdminProfile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import Header from "@/components/header";
import BottomNavigation from "@/components/bottom-navigation";

// 관리자 대시보드 탭 목록
const adminTabs = [
  { id: "dashboard", label: "대시보드", icon: "fas fa-tachometer-alt" },
  { id: "members", label: "회원 관리", icon: "fas fa-users" },
  { id: "caremanagers", label: "AI아바타 관리", icon: "fas fa-user-nurse" },
  { id: "services", label: "서비스/결제 관리", icon: "fas fa-credit-card" },
  { id: "settlement", label: "정산 관리", icon: "fas fa-calculator" },
  { id: "disputes", label: "분쟁 조정", icon: "fas fa-balance-scale" },
  { id: "content", label: "콘텐츠 관리", icon: "fas fa-edit" }
];

const Profile = () => {
  const { user, setShowAuthModal, logout } = useAuth();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  
  // @ts-ignore – user 객체에 name/displayName 존재 여부를 런타임에서만 확인
  const userDisplay =
    user ? ((user as any).name ?? (user as any).displayName ?? user.email?.split("@")[0] ?? "") : "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // 즉시 디버깅 정보 출력
  console.log("Profile 페이지 - 현재 유저 정보:", { 
    email: user?.email, 
    userType: user?.userType,
    uid: user?.uid 
  });

  // 사이드 이펙트를 useEffect로 이동
  useEffect(() => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // 이메일 체크를 한 번 더 명시적으로 수행
    console.log("이메일 체크 결과:", user.email?.toLowerCase() === "decom2soft@gmail.com" ? "일치" : "불일치");
    
    // 이 부분이 가장 중요: 이메일이 decom2soft@gmail.com이면 무조건 AdminProfile을 렌더링
    const isDecomSoftAdmin = user.email?.toLowerCase() === "decom2soft@gmail.com";
    
    if (isDecomSoftAdmin) {
      console.log("⭐ decom2soft@gmail.com 계정 감지 - 관리자 프로필로 강제 설정");
      
      // 관리자 객체 생성 - 원본 userType 무시하고 강제로 admin 설정
      const newAdminUser = {
        ...user,
        userType: 'admin',
        isApproved: true,
        grade: 'platinum'
      };
      
      setAdminUser(newAdminUser);
      
      // localStorage에도 강제로 설정 저장
      try {
        localStorage.clear();
        const userTypes: Record<string, string> = {};
        if (user.email) {
          userTypes[user.email] = 'admin';
          localStorage.setItem('user_types', JSON.stringify(userTypes));
          console.log('관리자 설정 저장됨');
        }
      } catch (e) {
        console.error('로컬 스토리지 저장 실패', e);
      }
    } else {
      setAdminUser(null);
    }
  }, [user, setShowAuthModal]);

  if (!user) {
    return null;
  }

  // decom2soft@gmail.com 계정은 관리자 프로필로 렌더링
  if (adminUser) {
    return (
      <div className="min-h-screen bg-gray-900 w-full" style={{ margin: 0, padding: 0, paddingTop: '32px' }}>
        <Header />
        <AdminProfile user={adminUser} />
        <BottomNavigation />
      </div>
    );
  }
  
  // 다른 모든 사용자는 원래 유형에 따라 프로필 표시
  switch (user.userType) {
    case 'admin':
      return (
        <div className="min-h-screen bg-gray-900 w-full" style={{ margin: 0, padding: 0, paddingTop: '32px' }}>
          <Header />
          <AdminProfile user={user} />
          <BottomNavigation />
        </div>
      );
    case 'careManager':
      return (
        <div className="min-h-screen bg-gray-900 pb-20 w-full" style={{ margin: 0, padding: 0, paddingTop: '32px' }}>
          <Header />
          <CareManagerProfile user={user} />
          <BottomNavigation />
        </div>
      );
    default:
      return (
        <div className="min-h-screen bg-gray-900 pb-20 w-full" style={{ margin: 0, padding: 0, paddingTop: '32px' }}>
          <Header />
          <CustomerProfile user={user} />
          <BottomNavigation />
        </div>
      );
  }
};

export default Profile;
