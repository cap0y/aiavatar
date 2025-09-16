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
    // 케어인력 추가 정보
    experience: '',
    certification: '',
    serviceCategories: [],
    workArea: '',
    introduction: ''
  });
  const { toast } = useToast();

  const serviceCategories = [
    { id: 'hospital', name: '병원 동행' },
    { id: 'shopping', name: '장보기' },
    { id: 'housework', name: '가사 도움' },
    { id: 'companion', name: '말벗' }
  ];

  // 서비스 카테고리 선택 핸들러
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
          toast({
            title: "로그인 성공",
            description: `${user.name || user.displayName}님, 환영합니다!`,
          });
        } catch (error) {
          console.error("로그인 오류:", error);
          throw error;
        }
      } else {
        // 회원가입 처리
        const userData = {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          userType: userType
        };

        // 케어인력인 경우 추가 정보 포함
        if (userType === 'careManager') {
          userData.careManagerInfo = {
            experience: formData.experience,
            certification: formData.certification,
            serviceCategories: formData.serviceCategories,
            workArea: formData.workArea,
            introduction: formData.introduction
          };
        }

        const response = await apiRequest('POST', '/api/auth/register', userData);
        const data = await response.json();

        if (data.user) {
          login(data.user);
          toast({
            title: "회원가입 성공",
            description: `${data.user.name}님, 환영합니다!`,
          });
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
      toast({
        title: "로그인 성공",
        description: `${provider} 계정으로 로그인되었습니다.`,
      });
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
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-scale-in overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800">
            {authMode === 'login' ? '로그인' : '회원가입'}
          </h2>
          <button 
            onClick={() => setShowAuthModal(false)}
            className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
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
                <TabsTrigger value="careManager">케어인력</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">이름 *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">전화번호 *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="전화번호를 입력하세요"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">이메일 *</Label>
            <Input
              id="email"
              type="email"
              placeholder="이메일을 입력하세요"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-gray-700">비밀번호 *</Label>
            <Input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* 케어인력 추가 정보 필드 */}
          {authMode === 'signup' && userType === 'careManager' && (
            <div className="space-y-4 border-t border-gray-200 pt-4 mt-4">
              <h3 className="font-medium text-gray-700">케어인력 추가 정보</h3>
              
              <div className="space-y-2">
                <Label htmlFor="experience" className="text-sm font-medium text-gray-700">경력 *</Label>
                <Select
                  value={formData.experience}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, experience: value }))}
                  required
                >
                  <SelectTrigger id="experience" className="w-full">
                    <SelectValue placeholder="경력을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1년 미만">1년 미만</SelectItem>
                    <SelectItem value="1-3년">1-3년</SelectItem>
                    <SelectItem value="3-5년">3-5년</SelectItem>
                    <SelectItem value="5년 이상">5년 이상</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="certification" className="text-sm font-medium text-gray-700">자격증</Label>
                <Input
                  id="certification"
                  type="text"
                  placeholder="보유 자격증을 입력하세요 (예: 요양보호사)"
                  value={formData.certification}
                  onChange={(e) => setFormData(prev => ({ ...prev, certification: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">서비스 카테고리 *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {serviceCategories.map(category => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={category.id} 
                        checked={formData.serviceCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryChange(category.id)}
                      />
                      <label
                        htmlFor={category.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {category.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="workArea" className="text-sm font-medium text-gray-700">활동 가능 지역 *</Label>
                <Input
                  id="workArea"
                  type="text"
                  placeholder="활동 가능 지역을 입력하세요 (예: 서울 강남구)"
                  value={formData.workArea}
                  onChange={(e) => setFormData(prev => ({ ...prev, workArea: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="introduction" className="text-sm font-medium text-gray-700">자기 소개</Label>
                <Input
                  id="introduction"
                  type="text"
                  placeholder="간단한 자기 소개를 입력하세요"
                  value={formData.introduction}
                  onChange={(e) => setFormData(prev => ({ ...prev, introduction: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
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
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">또는</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => handleSocialLogin('google')}
            variant="outline"
            className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            <i className="fab fa-google mr-2 text-red-500"></i>
            Google로 계속하기
          </Button>

          <Button
            onClick={() => handleSocialLogin('kakao')}
            className="w-full bg-yellow-400 text-gray-800 py-3 rounded-xl hover:bg-yellow-500 transition-all duration-200 font-medium"
          >
            <i className="fas fa-comment mr-2"></i>
            카카오로 계속하기
          </Button>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            className="text-sm text-purple-600 hover:underline"
          >
            {authMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
