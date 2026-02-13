// @ts-nocheck
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const AuthModal = () => {
  const { showAuthModal, setShowAuthModal, login, emailPasswordLogin, googleLogin, kakaoLogin } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState<'customer' | 'careManager'>('customer');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    // AI크리에이터 추가 정보
    experience: '',
    specialization: '',
    serviceCategories: [],
    portfolio: '',
    creationStyle: ''
  });
  const { toast } = useToast();

  const creationCategories = [
    { id: 'anime', name: '애니메이션 스타일' },
    { id: 'realistic', name: '리얼리스틱' },
    { id: 'fantasy', name: '판타지' },
    { id: 'chibi', name: '치비/미니어처' },
    { id: 'vtuber', name: '버츄얼 유튜버' },
    { id: 'game', name: '게임 캐릭터' }
  ];

  // 창작 카테고리 선택 핸들러
  const handleCategoryChange = (categoryId) => {
    setFormData(prev => {
      const current = [...prev.serviceCategories];
      if (current.includes(categoryId)) {
        return { ...prev, serviceCategories: current.filter(id => id !== categoryId) };
      } else {
        return { ...prev, serviceCategories: [...current, categoryId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authMode === 'login') {
        // 로그인 처리
        try {
          console.log("로그인 요청:", { email: formData.email, password: formData.password });
          const user = await emailPasswordLogin(formData.email, formData.password);
        } catch (error) {
          console.error("로그인 오류:", error);
          throw error;
        }
      } else {
        // 회원가입 처리
        const userData = {
          email: formData.email,
          password: formData.password,
          username: formData.name, // 서버 스키마에 맞게 username으로 변경
          displayName: formData.name, // displayName도 함께 설정
          userType: userType
          // phone 필드는 서버 스키마에 없으므로 제외
        };

        // AI크리에이터인 경우 추가 정보 포함
        if (userType === 'careManager') {
          userData.creatorInfo = {
            experience: formData.experience,
            specialization: formData.specialization,
            serviceCategories: formData.serviceCategories,
            portfolio: formData.portfolio,
            creationStyle: formData.creationStyle
          };
        }

        const response = await apiRequest('POST', '/api/auth/register', userData);
        const data = await response.json();

        if (data.user) {
          login(data.user);
        }
      }
    } catch (error: any) {
      toast({
        title: "오류가 발생했습니다",
        description: error.message || "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "kakao") => {
    try {
      if (provider === "google") {
        await googleLogin();
      } else {
        await kakaoLogin(); // 리다이렉트 방식
      }
    } catch (error: any) {
      toast({
        title: "로그인 실패",
        description: error?.message || "소셜 로그인 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (!showAuthModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-scale-in overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-white">
            {authMode === 'login' ? '로그인' : '회원가입'}
          </h2>
          <button 
            onClick={() => setShowAuthModal(false)}
            className="text-gray-400 hover:text-white transition-colors duration-200"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {authMode === 'signup' && (
          <div className="mb-6">
            <Tabs 
              defaultValue="customer" 
              value={userType} 
              onValueChange={(value) => setUserType(value as 'customer' | 'careManager')}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="customer">일반 사용자</TabsTrigger>
                <TabsTrigger value="careManager">AI크리에이터</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-300">이름 *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-300">전화번호 *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="전화번호를 입력하세요"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-gray-300">이메일 *</Label>
            <Input
              id="email"
              type="email"
              placeholder="이메일을 입력하세요"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-gray-300">비밀번호 *</Label>
            <Input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* AI크리에이터 추가 정보 필드 */}
          {authMode === 'signup' && userType === 'careManager' && (
            <div className="space-y-4 border-t border-gray-600 pt-4 mt-4">
              <h3 className="font-medium text-gray-300 flex items-center gap-2">
                <i className="fas fa-palette text-purple-400"></i>
                AI크리에이터 정보
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="experience" className="text-sm font-medium text-gray-300">창작 경험 *</Label>
                <Select
                  value={formData.experience}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, experience: value }))}
                  required
                >
                  <SelectTrigger id="experience" className="w-full">
                    <SelectValue placeholder="창작 경험을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="초보자">초보자 (1년 미만)</SelectItem>
                    <SelectItem value="아마추어">아마추어 (1-2년)</SelectItem>
                    <SelectItem value="세미프로">세미프로 (3-5년)</SelectItem>
                    <SelectItem value="프로페셔널">프로페셔널 (5년 이상)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="specialization" className="text-sm font-medium text-gray-300">전문 분야</Label>
                <Input
                  id="specialization"
                  type="text"
                  placeholder="전문 분야를 입력하세요 (예: 캐릭터 디자인, 스토리텔링, 3D 모델링)"
                  value={formData.specialization}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">창작 스타일 *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {creationCategories.map(category => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={category.id} 
                        checked={formData.serviceCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryChange(category.id)}
                      />
                      <label
                        htmlFor={category.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-300"
                      >
                        {category.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="portfolio" className="text-sm font-medium text-gray-300">포트폴리오 링크</Label>
                <Input
                  id="portfolio"
                  type="url"
                  placeholder="포트폴리오 웹사이트나 소셜미디어 링크를 입력하세요"
                  value={formData.portfolio}
                  onChange={(e) => setFormData(prev => ({ ...prev, portfolio: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="creationStyle" className="text-sm font-medium text-gray-300">창작 철학 & 스타일</Label>
                <Input
                  id="creationStyle"
                  type="text"
                  placeholder="당신만의 창작 스타일과 철학을 간단히 소개해주세요"
                  value={formData.creationStyle}
                  onChange={(e) => setFormData(prev => ({ ...prev, creationStyle: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <i className="fas fa-store text-purple-500 mt-0.5"></i>
                  <div className="text-sm text-purple-700 dark:text-purple-300">
                    <p className="font-medium mb-1">AI크리에이터 혜택</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>자신만의 AI 캐릭터를 생성하고 판매</li>
                      <li>마켓플레이스에서 작품 전시 및 판매</li>
                      <li>수익 창출 및 창작자 커뮤니티 참여</li>
                      <li>고객 맞춤 캐릭터 주문 제작 서비스</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gradient-purple text-white py-3 rounded-xl hover:opacity-90 transition-all duration-200 transform hover:scale-105 font-medium"
          >
            {loading ? '처리 중...' : (authMode === 'login' ? '로그인' : '회원가입')}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-800 text-gray-400">또는</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => handleSocialLogin('google')}
            variant="default"
            className="w-full bg-gray-700 border-2 border-gray-600 text-white py-3 rounded-xl hover:bg-gray-600 transition-all duration-200 font-medium"
          >
            <i className="fab fa-google mr-2 text-red-400"></i>
            Google로 계속하기
          </Button>

          <Button
            onClick={() => handleSocialLogin('kakao')}
            className="w-full bg-yellow-500 text-gray-900 py-3 rounded-xl hover:bg-yellow-400 transition-all duration-200 font-medium"
          >
            <i className="fas fa-comment mr-2"></i>
            카카오로 계속하기
          </Button>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            className="text-sm text-purple-400 hover:text-purple-300 hover:underline transition-colors"
          >
            {authMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
