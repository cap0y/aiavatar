import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";
import { normalizeImageUrl } from '@/lib/url';
import { changePassword } from '@/lib/api';
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CustomerProfileProps {
  user: any;
}

const CustomerProfile = ({ user }: CustomerProfileProps) => {
  const { logout, updateUserPhoto } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // @ts-ignore – user 객체에 name/displayName 존재 여부를 런타임에서만 확인
  const userDisplay = user ? ((user as any).name ?? (user as any).displayName ?? user.email?.split("@")[0] ?? "") : "";

  // 비밀번호 변경 모달 상태
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const handleMenuClick = (action: string) => {
    switch (action) {
      case 'bookings':
        setLocation('/bookings');
        break;
      case 'payments':
        setLocation('/payment-history');
        break;
      case 'reviews':
        setLocation('/my-reviews');
        break;
      case 'inquiries':
        setLocation('/my-inquiries');
        break;
      case 'favorites':
        setLocation('/favorites');
        break;
      case 'notifications':
        setLocation('/notifications');
        break;
      case 'privacy':
        setLocation('/privacy');
        break;
      case 'support':
        setLocation('/support');
        break;
      case 'editProfile':
        // setIsEditing(true); // This state variable is not defined in the original file
        break;
      case 'logout':
        logout();
        toast({
          title: "로그아웃",
          description: "성공적으로 로그아웃되었습니다.",
        });
        setLocation('/');
        break;
      default:
        toast({
          title: "기능 준비중",
          description: "해당 기능은 준비 중입니다.",
        });
    }
  };

  const handleEditProfile = () => {
    fileInputRef.current?.click();
  };

  // 프로필 사진 변경 핸들러
  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 파일 크기 제한 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "이미지 크기는 5MB 이하여야 합니다.",
          variant: "destructive",
        });
        return;
      }

      // 이미지 타입 체크
      if (!file.type.startsWith("image/")) {
        toast({
          title: "잘못된 파일 형식",
          description: "이미지 파일만 업로드 가능합니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "프로필 사진 업로드 중",
        description: "잠시만 기다려주세요...",
      });

      // 이미지 압축 함수
      const compressImage = (file: File, maxWidth: number = 400, quality: number = 0.8): Promise<string> => {
        return new Promise((resolve, reject) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            // 이미지 크기 조정
            const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            
            // 이미지 그리기
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Base64로 변환 (압축 적용)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
          };
          
          img.onerror = () => reject(new Error('이미지 로드 실패'));
          img.src = URL.createObjectURL(file);
        });
      };

      const compressedImage = await compressImage(file);
      
      // Firebase와 케어매니저 프로필 모두 업데이트
      const result = await updateUserPhoto(compressedImage);
      
      if (result) {
        toast({
          title: "프로필 사진 업데이트 완료",
          description: "프로필 사진이 성공적으로 변경되었습니다.",
        });
      }
    } catch (error) {
      console.error("프로필 사진 업데이트 오류:", error);
      toast({
        title: "프로필 사진 업데이트 실패",
        description: "오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">마이페이지</h1>
          <p className="text-gray-600">계정 정보와 서비스 이용 현황을 확인하세요</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Section */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-6">
              {/* 숨겨진 파일 입력 추가 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleProfileImageChange}
                accept="image/*"
                className="hidden"
              />
              <Avatar className="w-20 h-20 border-4 border-white shadow-lg cursor-pointer" onClick={handleEditProfile}>
                <AvatarImage src={normalizeImageUrl(user.photoURL || undefined)} />
                <AvatarFallback className="gradient-purple text-white text-2xl font-bold">
                  {userDisplay[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-2xl font-bold text-gray-800">{userDisplay}</h2>
                  <Button size="sm" variant="outline" onClick={() => setShowPasswordDialog(true)}>
                    비번변경
                  </Button>
                </div>
                <p className="text-gray-600 mb-1">{user.email}</p>
                <p className="text-gray-600">010-1234-5678</p>
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-700">
                    일반 회원
                  </span>
                </div>
              </div>
              <Button
                onClick={handleEditProfile}
                variant="outline"
                className="gradient-purple text-white border-0 hover:opacity-90 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                <i className="fas fa-edit mr-2"></i>
                편집
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg mb-6">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              <button
                onClick={() => handleMenuClick('bookings')}
                className="w-full p-6 text-left hover:bg-purple-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-calendar-alt text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">예약 내역</h3>
                    <p className="text-sm text-gray-500">케어 서비스 예약 현황 확인</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('payments')}
                className="w-full p-6 text-left hover:bg-purple-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-credit-card text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">결제 내역</h3>
                    <p className="text-sm text-gray-500">서비스 이용 요금 및 결제 정보</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('reviews')}
                className="w-full p-6 text-left hover:bg-purple-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-star text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">내가 쓴 리뷰</h3>
                    <p className="text-sm text-gray-500">케어 매니저 리뷰 관리</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('inquiries')}
                className="w-full p-6 text-left hover:bg-purple-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-comments text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">내 문의</h3>
                    <p className="text-sm text-gray-500">내가 한 문의 내역 확인</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('favorites')}
                className="w-full p-6 text-left hover:bg-purple-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-heart text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">찜한 케어 매니저</h3>
                    <p className="text-sm text-gray-500">즐겨찾기한 케어 매니저 목록</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg mb-6">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              <button
                onClick={() => handleMenuClick('notifications')}
                className="w-full p-6 text-left hover:bg-purple-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-bell text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">알림 설정</h3>
                    <p className="text-sm text-gray-500">푸시 알림 및 이메일 설정</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('privacy')}
                className="w-full p-6 text-left hover:bg-purple-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-shield-alt text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">개인정보 보호</h3>
                    <p className="text-sm text-gray-500">개인정보 처리 및 보안 설정</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('support')}
                className="w-full p-6 text-left hover:bg-purple-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-question-circle text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">고객 지원</h3>
                    <p className="text-sm text-gray-500">FAQ, 1:1 문의 및 고객센터</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('logout')}
                className="w-full p-6 text-left hover:bg-red-50 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-sign-out-alt text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-600">로그아웃</h3>
                    <p className="text-sm text-red-400">계정에서 안전하게 로그아웃</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-red-400 group-hover:text-red-500 transition-colors duration-200"></i>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-100 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">이용 통계</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <CardContent className="p-6">
                    <div className="text-3xl font-bold text-white mb-2">12</div>
                    <div className="text-blue-100 font-medium">총 예약 횟수</div>
                  </CardContent>
                </Card>
              </div>
              <div className="text-center">
                <Card className="bg-gradient-to-br from-green-500 to-teal-500 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <CardContent className="p-6">
                    <div className="text-3xl font-bold text-white mb-2">36시간</div>
                    <div className="text-green-100 font-medium">총 서비스 시간</div>
                  </CardContent>
                </Card>
              </div>
              <div className="text-center">
                <Card className="bg-gradient-to-br from-purple-500 to-pink-500 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <CardContent className="p-6">
                    <div className="text-3xl font-bold text-white mb-2">4.8</div>
                    <div className="text-purple-100 font-medium">평균 만족도</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
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
    </>
  );
};

function PasswordChangeForm({ userId }: { userId: string | number }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return alert('사용자 정보가 없습니다. 다시 로그인 해주세요.');
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

export default CustomerProfile; 