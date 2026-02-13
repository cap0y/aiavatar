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

  // 사용자 표시 이름 안전하게 가져오기
  const getUserDisplayName = (user: any) => {
    if (!user) return "";
    return user.displayName || user.name || user.username || user.email?.split("@")[0] || "사용자";
  };
  
  const userDisplay = getUserDisplayName(user);

  // 비밀번호 변경 모달 상태
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const handleMenuClick = (action: string) => {
    switch (action) {
      case 'commissions':
        setLocation('/commissions');
        break;
      case 'payments':
        setLocation('/orders');
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
      case 'back':
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
      
      // Firebase와 AI아바타 프로필 모두 업데이트
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
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => handleMenuClick('back')}
              className="text-gray-400 hover:text-white transition-colors duration-200 p-2 rounded-lg hover:bg-gray-700"
              title="뒤로가기"
            >
              <i className="fas fa-arrow-left text-lg"></i>
            </button>
            <h1 className="text-xl font-bold text-white">마이페이지</h1>
          </div>
          <p className="text-sm text-gray-400 ml-11">AI 아바타 플랫폼 계정 정보와 이용 현황을 확인하세요</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Section */}
        <Card className="bg-gray-800/70 border-gray-600/50 shadow-lg mb-6">
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
              <Avatar className="w-20 h-20 border-4 border-gray-600 shadow-lg cursor-pointer" onClick={handleEditProfile}>
                <AvatarImage src={normalizeImageUrl(user.photoURL || undefined)} />
                <AvatarFallback className="bg-purple-600 text-white text-2xl font-bold">
                  {userDisplay[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-2xl font-bold text-white">{userDisplay}</h2>
                  <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white" onClick={() => setShowPasswordDialog(true)}>
                    비번변경
                  </Button>
                </div>
                <p className="text-gray-400 mb-1">{user.email}</p>
                <p className="text-gray-400">010-1234-5678</p>
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-600 text-white">
                    일반 회원
                  </span>
                </div>
              </div>
              <Button
                onClick={handleEditProfile}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200"
              >
                <i className="fas fa-edit mr-2"></i>
                편집
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-700">
              <button
                onClick={() => handleMenuClick('commissions')}
                className="w-full p-6 text-left hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-palette text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">작품 의뢰 내역</h3>
                    <p className="text-sm text-gray-400">AI 크리에이터에게 의뢰한 아바타 작품 현황</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('payments')}
                className="w-full p-6 text-left hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-receipt text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">구매 내역</h3>
                    <p className="text-sm text-gray-400">AI 아바타 구매 및 의뢰 결제 내역</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('reviews')}
                className="w-full p-6 text-left hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-star text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">내 리뷰</h3>
                    <p className="text-sm text-gray-400">구매한 AI 아바타 및 크리에이터 리뷰 관리</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('inquiries')}
                className="w-full p-6 text-left hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-question-circle text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">내 문의</h3>
                    <p className="text-sm text-gray-400">AI 아바타 및 플랫폼 관련 문의 내역</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('favorites')}
                className="w-full p-6 text-left hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-heart text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">관심 아바타</h3>
                    <p className="text-sm text-gray-400">찜한 AI 아바타 및 크리에이터 목록</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="bg-gray-800/70 border-gray-600/50 shadow-lg mb-6">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-700">
              <button
                onClick={() => handleMenuClick('notifications')}
                className="w-full p-6 text-left hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-bell text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">알림 설정</h3>
                    <p className="text-sm text-gray-400">작품 완성 알림 및 플랫폼 소식 설정</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('privacy')}
                className="w-full p-6 text-left hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-shield-alt text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">개인정보 보호</h3>
                    <p className="text-sm text-gray-400">계정 보안 및 개인정보 관리</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-purple-500 transition-colors duration-200"></i>
              </button>

              <button
                onClick={() => handleMenuClick('support')}
                className="w-full p-6 text-left hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <i className="fas fa-headset text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">고객 지원</h3>
                    <p className="text-sm text-gray-400">AI 아바타 플랫폼 이용 도움말 및 지원</p>
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
        <Card className="bg-gray-800/70 border-gray-600/50 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <i className="fas fa-chart-bar text-purple-400"></i>
              AI 아바타 이용 통계
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Card className="bg-blue-600/80 border-blue-500/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-blue-600">
                  <CardContent className="p-6">
                    <div className="text-3xl font-bold text-white mb-2">5</div>
                    <div className="text-blue-200 font-medium">구매한 아바타</div>
                  </CardContent>
                </Card>
              </div>
              <div className="text-center">
                <Card className="bg-green-600/80 border-green-500/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-green-600">
                  <CardContent className="p-6">
                    <div className="text-3xl font-bold text-white mb-2">2</div>
                    <div className="text-green-200 font-medium">진행 중인 의뢰</div>
                  </CardContent>
                </Card>
              </div>
              <div className="text-center">
                <Card className="bg-purple-600/80 border-purple-500/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-purple-600">
                  <CardContent className="p-6">
                    <div className="text-3xl font-bold text-white mb-2">4.9</div>
                    <div className="text-purple-200 font-medium">평균 만족도</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 비밀번호 변경 모달 */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[420px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">비밀번호 변경</DialogTitle>
            <DialogDescription className="text-gray-400">현재 비밀번호를 확인하고 새 비밀번호로 변경하세요.</DialogDescription>
          </DialogHeader>
          <PasswordChangeForm userId={user?.uid || user?.id || ''} />
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
      <Input type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} required className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" />
      <Input type="password" placeholder="새 비밀번호(6자 이상)" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" />
      <Input type="password" placeholder="새 비밀번호 확인" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" />
      <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">{loading ? '변경 중...' : '비밀번호 변경'}</Button>
    </form>
  );
}

export default CustomerProfile; 