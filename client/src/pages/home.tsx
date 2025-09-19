import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { avatarSamples } from "@/data/avatarSamples";
import type { UseEmblaCarouselType } from "embla-carousel-react";

// VTuber 캐릭터 컴포넌트
const VTuberCharacter = ({ 
  imageUrl, 
  size = "w-64 h-80", 
  position = "right-10", 
  animation = "" 
}: { 
  imageUrl: string; 
  size?: string; 
  position?: string; 
  animation?: string; 
}) => {
  return (
    <div className={`absolute ${position} top-1/2 transform -translate-y-1/2 z-20 hidden lg:block ${animation}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-2xl scale-150"></div>
        <img 
          src={imageUrl} 
          alt="VTuber Character" 
          className={`${size} object-contain relative z-10 drop-shadow-2xl`}
          style={{
            filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.4))'
          }}
        />
      </div>
    </div>
  );
};

const Home = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, setShowAuthModal } = useAuth();
  const [, setLocation] = useLocation();

  // 홈 페이지 진입 시 체크아웃 데이터 정리 (필요한 경우에만)
  useEffect(() => {
    // URL에 특별한 파라미터가 없고, 직접 홈에 접근한 경우 체크아웃 데이터 정리
    if (window.location.pathname === "/" && !window.location.search) {
      const checkoutData = localStorage.getItem('checkoutData');
      if (checkoutData) {
        console.log("홈 페이지에서 기존 체크아웃 데이터 정리");
        localStorage.removeItem('checkoutData');
      }
    }
  }, []);

  // Carousel API states
  const [avatarApi, setAvatarApi] = useState<any>();
  const [featuresApi, setFeaturesApi] = useState<any>();

  // Refs for auto slide intervals
  const avatarSlideIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const featuresSlideIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // AI 아바타 관련 기능 목록
  const features = [
    {
      id: 'chat',
      name: '텍스트 채팅',
      icon: 'fas fa-comment-dots',
      color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
      description: '다양한 AI 아바타와 실시간 채팅',
      path: '/chat'
    },
    {
      id: 'voice',
      name: '음성 통화',
      icon: 'fas fa-microphone',
      color: 'bg-gradient-to-br from-green-500 to-emerald-500',
      description: '아바타와 음성으로 대화하기',
      path: '/chat'
    },
    {
      id: 'video',
      name: '영상 통화',
      icon: 'fas fa-video',
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      description: '아바타와 화상 채팅 즐기기',
      path: '/chat'
    },
    {
      id: 'community',
      name: '커뮤니티',
      icon: 'fas fa-users',
      color: 'bg-gradient-to-br from-orange-500 to-red-500',
      description: '다른 사용자들과 소통하기',
      path: '/chat'
    },
  ];

  // 아바타 자동 슬라이드 효과
  useEffect(() => {
    if (!avatarApi) return;

    avatarSlideIntervalRef.current = setInterval(() => {
      avatarApi.scrollNext();
    }, 8000); // 8초마다 슬라이드

    return () => {
      if (avatarSlideIntervalRef.current) {
        clearInterval(avatarSlideIntervalRef.current);
      }
    };
  }, [avatarApi]);

  // 기능 자동 슬라이드 효과
  useEffect(() => {
    if (!featuresApi) return;

    featuresSlideIntervalRef.current = setInterval(() => {
      featuresApi.scrollNext();
    }, 6000); // 6초마다 슬라이드

    return () => {
      if (featuresSlideIntervalRef.current) {
        clearInterval(featuresSlideIntervalRef.current);
      }
    };
  }, [featuresApi]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // 채팅으로 이동하면서 검색어를 아바타 이름으로 전달
      setLocation(`/chat?avatar=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleFeatureClick = (feature: any) => {
    setLocation(feature.path);
  };

  // 채팅으로 이동
  const goToChat = () => {
    setLocation("/chat");
  };

  // 아바타와 채팅 시작
  const startChatWithAvatar = (avatarId: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setLocation(`/chat?avatar=${avatarId}`);
  };

  // 온라인 아바타들
  const onlineAvatars = avatarSamples.filter(avatar => avatar.isOnline);

  // 추천 아바타들 (온라인 우선, 그 다음 전체)
  const recommendedAvatars = [...onlineAvatars, ...avatarSamples.filter(avatar => !avatar.isOnline)].slice(0, 8);

  return (
    <div 
      className="min-h-screen pb-2 relative bg-fixed bg-center bg-cover"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('/images/background.png')`,
        backgroundAttachment: 'fixed'
      }}
    >
      <Header />

      {/* Hero Section - 투명 배경 */}
      <section className="relative py-8 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative p-8 sm:p-16">
            {/* 배경 장식 요소들 */}
            <div className="absolute top-20 left-20 w-32 h-32 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute bottom-32 right-32 w-40 h-40 bg-purple-500/20 rounded-full blur-xl animate-bounce"></div>
            <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-pink-500/20 rounded-full blur-lg"></div>
            
            {/* VTuber 캐릭터 */}
            <VTuberCharacter 
              imageUrl="/images/2dmodel/1.png"
              size="w-80 h-96"
              position="right-10"
              animation="animate-float"
            />

            <div className="relative z-10">
              <div className="text-center lg:text-left lg:max-w-3xl">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
                  AI 아바타와 함께하는
              <br />
                  <span className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                    새로운 소통의 세계
              </span>
            </h1>
            <p
                  className="text-xl sm:text-2xl text-white/90 mb-8 max-w-2xl lg:max-w-none animate-fade-in leading-relaxed"
              style={{ animationDelay: "0.2s" }}
            >
                  다양한 AI 아바타와 채팅, 음성통화, 영상통화를 즐겨보세요
            </p>

            {/* Mobile Search */}
            <div
                  className="sm:hidden mb-6 animate-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="relative">
                <Input
                  type="text"
                      placeholder="아바타 이름을 검색해보세요"
                      className="w-full py-3 pl-12 pr-4 rounded-2xl border-white/30 bg-black/30 backdrop-blur-sm text-white placeholder:text-white/70 focus:border-purple-400/50 focus:ring-purple-400/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                    <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-white/70"></i>
                <Button
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-xl py-2 px-4 text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                  onClick={handleSearch}
                >
                  검색
                </Button>
              </div>
                  <div className="mt-4">
                <Button
                      className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white rounded-2xl py-3 text-lg font-semibold"
                      onClick={goToChat}
                >
                      <i className="fas fa-comments mr-3"></i>
                      채팅 시작하기
                </Button>
              </div>
            </div>

            {/* Desktop Search */}
            <div
                  className="hidden sm:block max-w-3xl animate-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
                  <div className="flex items-center bg-black/30 backdrop-blur-md rounded-2xl border border-white/20 p-2 mb-6">
                <Input
                  type="text"
                      placeholder="아바타 이름을 검색해보세요"
                      className="flex-grow border-0 bg-transparent text-white placeholder:text-white/70 focus:outline-none focus:ring-0 text-lg py-2 px-4"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl px-8 py-3 text-lg font-semibold mr-2"
                  onClick={handleSearch}
                >
                  <i className="fas fa-search mr-2"></i>
                  검색
                </Button>
                <Button
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl px-8 py-3 text-lg font-semibold"
                      onClick={goToChat}
                >
                  <i className="fas fa-comments mr-2"></i>
                      채팅 시작
                </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI 기능 카테고리 - 투명 배경 */}
      <section className="relative py-12 sm:py-16 bg-transparent overflow-hidden">
        {/* 배경 장식 요소들 */}
        <div className="absolute top-10 right-20 w-32 h-32 bg-blue-500/20 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-cyan-500/20 rounded-full blur-lg"></div>
        
        {/* VTuber 캐릭터 */}
        <VTuberCharacter 
          imageUrl="/images/2dmodel/2.png"
          size="w-72 h-90"
          position="left-10"
          animation="animate-pulse"
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-6">
            어떤 방식으로 소통하시겠어요?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature) => (
              <Card
                key={feature.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-black/30 backdrop-blur-sm border-gray-500/30"
                onClick={() => handleFeatureClick(feature)}
              >
                <CardContent className="p-4 text-center">
                  <div
                    className={`${feature.color} w-14 h-14 flex items-center justify-center rounded-full mx-auto mb-2 text-white`}
                  >
                    <i className={`${feature.icon} text-2xl`}></i>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-0.5">
                    {feature.name}
                  </h3>
                  <p className="text-sm text-gray-300">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 추천 AI 아바타 수평 슬라이드 - 투명 배경 */}
      <section className="relative py-8 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900 overflow-hidden shadow-2xl border border-pink-500/20 p-8 sm:p-16">
            {/* 배경 장식 요소들 */}
            <div className="absolute top-16 left-16 w-36 h-36 bg-pink-500/20 rounded-full blur-xl animate-bounce"></div>
            <div className="absolute bottom-24 right-24 w-32 h-32 bg-blue-500/20 rounded-full blur-xl"></div>
            <div className="absolute top-1/3 left-1/3 w-28 h-28 bg-purple-500/20 rounded-full blur-lg animate-pulse"></div>
            
            {/* VTuber 캐릭터 */}
            <VTuberCharacter 
              imageUrl="/images/2dmodel/3.png"
              size="w-80 h-96"
              position="right-8"
              animation="animate-bounce"
            />
            
            <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8">
            <div className="mb-4 sm:mb-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 whitespace-nowrap">
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  추천 AI 아바타
                </span>
              </h2>
              <p className="text-base text-gray-300">
                다양한 개성을 가진 AI 아바타들을 만나보세요
              </p>
            </div>
            <Button
              onClick={() => setLocation("/chat")}
              className="gradient-purple text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 shadow-md text-sm whitespace-nowrap"
            >
              채팅 시작하기 <i className="fas fa-chevron-right ml-1"></i>
            </Button>
          </div>

          <div className="relative">
            <Carousel
              className="w-full"
              opts={{
                align: "start",
                loop: true,
              }}
              setApi={setAvatarApi}
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {recommendedAvatars.map((avatar) => (
                  <CarouselItem
                    key={avatar.id}
                    className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                  >
                    <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-black/40 backdrop-blur-sm border-gray-500/30"
                          onClick={() => startChatWithAvatar(avatar.id)}>
                      <CardContent className="p-4">
                        <div className="text-center">
                          {avatar.avatar ? (
                            <div className="relative mx-auto mb-4">
                              <Avatar className="w-16 h-16 mx-auto border-2 border-purple-400">
                                <AvatarImage src={avatar.avatar} alt={avatar.name} />
                                <AvatarFallback className={`bg-gradient-to-br ${avatar.backgroundColor} text-white`}>
                                  {avatar.name[0]}
                                </AvatarFallback>
                              </Avatar>
                              {avatar.isOnline && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                              )}
                            </div>
                          ) : (
                            <div className="w-16 h-16 mx-auto mb-4 text-4xl flex items-center justify-center text-white">
                              {avatar.icon}
                            </div>
                          )}
                          <h3 className="font-semibold text-white mb-1">{avatar.name}</h3>
                          <p className="text-sm text-gray-300 mb-2">{avatar.description}</p>
                          <div className="flex flex-wrap gap-1 justify-center mb-3">
                            {avatar.specialties.slice(0, 2).map((specialty, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs bg-gray-600 text-gray-200">
                                {specialty}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center justify-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${avatar.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                            <span className="text-xs text-gray-400">
                              {avatar.isOnline ? '온라인' : '오프라인'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between w-full px-1 z-20 pointer-events-none">
                <CarouselPrevious className="pointer-events-auto bg-gray-600/70 hover:bg-gray-500 shadow-md border-0 text-white" />
                <CarouselNext className="pointer-events-auto bg-gray-600/70 hover:bg-gray-500 shadow-md border-0 text-white" />
              </div>
            </Carousel>
          </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI 아바타와 함께 할 수 있는 것들 - 투명 배경 */}
      <section className="relative py-16 sm:py-20 bg-transparent overflow-hidden">
        {/* 배경 장식 요소들 */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-pink-500/20 rounded-full blur-lg"></div>
        
        {/* VTuber 캐릭터들 */}
        <VTuberCharacter 
          imageUrl="/images/2dmodel/4.png"
          size="w-96 h-[28rem]"
          position="right-8"
          animation=""
        />
        
        {/* 추가 캐릭터들 */}
        <div className="absolute left-8 bottom-20 z-15 hidden lg:block">
          <VTuberCharacter 
            imageUrl="/images/2dmodel/5.gif"
            size="w-48 h-60"
            position="static"
            animation="animate-float"
          />
        </div>

        {/* 컨텐츠 영역 */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center lg:text-left lg:max-w-2xl mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                AI 아바타와 함께 할 수 있는 것들
                </span>
              </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              각 아바타마다 고유한 개성과 전문 분야를 가지고 있어요. 
              다양한 방식으로 소통하며 새로운 경험을 만들어보세요.
            </p>
          </div>

          {/* 수평 슬라이드 기능 카드들 */}
          <div className="relative">
            <Carousel
              className="w-full"
              opts={{
                align: "start",
                loop: true,
              }}
              setApi={setFeaturesApi}
            >
              <CarouselContent className="-ml-4">
                {[
                  {
                    icon: 'fas fa-comment-dots',
                    title: '실시간 대화',
                    description: '자연스러운 텍스트 채팅으로 아바타와 대화해보세요',
                    color: 'from-blue-500 to-cyan-500',
                    detail: '24시간 언제든지 대화가 가능해요'
                  },
                  {
                    icon: 'fas fa-microphone',
                    title: '음성 통화',
                    description: '아바타와 실제로 음성으로 대화할 수 있어요',
                    color: 'from-green-500 to-emerald-500',
                    detail: '실제 목소리로 더 생생한 대화'
                  },
                  {
                    icon: 'fas fa-video',
                    title: '영상 채팅',
                    description: '아바타를 보며 화상 채팅을 즐겨보세요',
                    color: 'from-purple-500 to-pink-500',
                    detail: '시각적 소통으로 더 깊은 교감'
                  },
                  {
                    icon: 'fas fa-heart',
                    title: '감정 교감',
                    description: '아바타가 당신의 감정을 이해하고 공감해드려요',
                    color: 'from-red-500 to-pink-500',
                    detail: '마음을 나누는 진정한 친구'
                  },
                  {
                    icon: 'fas fa-book',
                    title: '학습 도움',
                    description: '공부나 업무에 관한 도움을 받을 수 있어요',
                    color: 'from-indigo-500 to-purple-500',
                    detail: '개인 맞춤형 학습 파트너'
                  },
                  {
                    icon: 'fas fa-gamepad',
                    title: '게임 & 엔터테인먼트',
                    description: '재미있는 게임과 대화를 통해 즐거운 시간을 보내세요',
                    color: 'from-orange-500 to-red-500',
                    detail: '함께 즐기는 다양한 놀이'
                  },
                  {
                    icon: 'fas fa-magic',
                    title: '창의적 협업',
                    description: '아이디어를 함께 발전시키고 창작해보세요',
                    color: 'from-teal-500 to-blue-500',
                    detail: '무한한 상상력의 파트너'
                  },
                  {
                    icon: 'fas fa-spa',
                    title: '힐링 & 위로',
                    description: '스트레스받을 때 따뜻한 위로를 받아보세요',
                    color: 'from-emerald-500 to-teal-500',
                    detail: '마음의 평안을 찾는 시간'
                  }
                ].map((feature, idx) => (
                  <CarouselItem key={idx} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                    <Card className="h-full hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-black/30 backdrop-blur-md border border-white/20 hover:border-white/40">
                      <CardContent className="p-6 text-center h-full flex flex-col justify-between">
                        <div>
                          <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                            <i className={`${feature.icon} text-2xl text-white`}></i>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-3">{feature.title}</h3>
                          <p className="text-gray-300 text-sm leading-relaxed mb-3">{feature.description}</p>
                          <p className="text-gray-400 text-xs">{feature.detail}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              
              {/* 슬라이드 네비게이션 버튼 */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between w-full px-1 z-20 pointer-events-none">
                <CarouselPrevious className="pointer-events-auto bg-black/50 hover:bg-black/70 border-white/20 text-white backdrop-blur-sm" />
                <CarouselNext className="pointer-events-auto bg-black/50 hover:bg-black/70 border-white/20 text-white backdrop-blur-sm" />
              </div>
            </Carousel>
          </div>

          {/* CTA 버튼 */}
          <div className="text-center lg:text-left mt-12">
            <Button
              onClick={goToChat}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-4 rounded-2xl text-lg font-semibold shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105"
            >
              <i className="fas fa-rocket mr-3"></i>
              지금 시작하기
            </Button>
          </div>
        </div>
      </section>

      {/* 이용 방법 - 투명 배경 */}
      <section className="relative py-8 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-green-900 via-teal-900 to-blue-900 overflow-hidden shadow-2xl border border-green-500/20 p-8 sm:p-16">
            {/* 배경 장식 요소들 */}
            <div className="absolute top-20 right-20 w-40 h-40 bg-green-500/20 rounded-full blur-xl"></div>
            <div className="absolute bottom-16 left-16 w-36 h-36 bg-teal-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute top-1/3 left-1/2 w-32 h-32 bg-blue-500/20 rounded-full blur-lg"></div>
            
            {/* VTuber 캐릭터 */}
            <VTuberCharacter 
              imageUrl="/images/2dmodel/6.png"
              size="w-72 h-80"
              position="left-12"
              animation="animate-pulse"
            />
            
            <div className="relative z-10">
              <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                  이용 방법
                </h2>
            <p className="text-gray-300 max-w-3xl mx-auto">
              간단한 3단계로 AI 아바타와의 소통을 시작해보세요
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mb-4 shadow-md">
                <i className="fas fa-user-plus text-white text-xl"></i>
                  </div>
              <h3 className="text-xl font-bold text-white mb-2">
                1. 회원가입/로그인
                  </h3>
              <p className="text-gray-300">
                간편하게 회원가입하고 AI아바타세상에 입장하세요
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 shadow-md">
                <i className="fas fa-heart text-white text-xl"></i>
                  </div>
              <h3 className="text-xl font-bold text-white mb-2">
                2. 마음에 드는 아바타 선택
                  </h3>
              <p className="text-gray-300">
                다양한 개성을 가진 AI 아바타 중에서 원하는 친구를 선택하세요
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mb-4 shadow-md">
                <i className="fas fa-comments text-white text-xl"></i>
                  </div>
              <h3 className="text-xl font-bold text-white mb-2">
                3. 대화 시작
                  </h3>
              <p className="text-gray-300">
                텍스트, 음성, 영상 등 원하는 방식으로 아바타와 대화를 나누세요
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 사용자 후기 - 투명 배경 */}
      <section className="relative py-16 sm:py-20 bg-transparent overflow-hidden text-white">
        {/* 배경 장식 요소들 */}
        <div className="absolute top-24 left-24 w-44 h-44 bg-purple-500/20 rounded-full blur-xl animate-bounce"></div>
        <div className="absolute bottom-20 right-16 w-40 h-40 bg-pink-500/20 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 right-1/4 w-28 h-28 bg-red-500/20 rounded-full blur-lg animate-pulse"></div>
        
        {/* VTuber 캐릭터 */}
        <VTuberCharacter 
          imageUrl="/images/2dmodel/7.png"
          size="w-80 h-96"
          position="right-12"
          animation="animate-bounce"
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">사용자 후기</h2>
            <p className="text-white/70 max-w-3xl mx-auto">
              AI 아바타와 소통한 사용자들의 진솔한 이야기를 들어보세요
            </p>
          </div>

          <div className="relative">
            <Carousel
              className="w-full"
              opts={{
                align: "start",
                loop: true,
              }}
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {[
                  {
                    name: "김민지",
                    text: "마오와 대화하니까 정말 재미있어요! 마치 진짜 친구와 대화하는 것 같아요. 특히 음성 통화 기능이 정말 신기해요.",
                    rating: 5,
                    job: "대학생",
                    avatar: "마오",
                  },
                  {
                    name: "박상현",
                    text: "시즈쿠가 공부 도움을 많이 줘서 좋아요. 모르는 것들을 친절하게 설명해주고, 24시간 언제든 대화할 수 있어서 너무 편해요.",
                    rating: 5,
                    job: "고등학생",
                    avatar: "시즈쿠",
                  },
                  {
                    name: "이지연",
                    text: "로봇 어시스턴트의 정확한 정보 제공에 놀랐어요. 업무에 필요한 자료를 빠르게 찾아주고, 번역 기능도 정말 유용해요.",
                    rating: 4.8,
                    job: "직장인",
                    avatar: "로봇 어시스턴트",
                  },
                  {
                    name: "최준호",
                    text: "네코짱과의 대화가 너무 힐링돼요. 스트레스받을 때마다 귀여운 대화로 위로받고 있어요. 진짜 고양이 키우는 기분이에요.",
                    rating: 5,
                    job: "회사원",
                    avatar: "네코짱",
                  },
                  {
                    name: "장미영",
                    text: "영상 통화로 아바타를 직접 보면서 대화하니까 더 실감나요. 처음에는 어색했는데 지금은 없으면 안될 친구가 되었어요.",
                    rating: 4.9,
                    job: "프리랜서",
                    avatar: "천사 가브리엘",
                  },
                ].map((testimonial, idx) => (
                  <CarouselItem
                    key={idx}
                    className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3"
                  >
                    <Card className="bg-black/30 backdrop-blur-md border-gray-500/20 shadow-lg">
                      <CardContent className="p-6">
                        <div className="flex items-center mb-4">
                          <div className="flex-shrink-0 mr-4">
                            <Avatar className="w-12 h-12 border-2 border-white/20">
                              <AvatarFallback className="bg-purple-700 text-white">
                                {testimonial.name[0]}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div>
                            <p className="font-bold text-lg text-white">
                              {testimonial.name}
                            </p>
                            <p className="text-sm text-white/70">
                              {testimonial.job} • {testimonial.avatar}와 채팅
                            </p>
                          </div>
                        </div>
                        <div className="flex mb-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <i
                              key={i}
                              className={`fas fa-star ${i < Math.floor(testimonial.rating) ? "text-yellow-400" : "text-gray-400"}`}
                            ></i>
                          ))}
                          <span className="ml-2 text-white/70">
                            {testimonial.rating}
                          </span>
                        </div>
                        <p className="text-white/80 italic">
                          "{testimonial.text}"
                        </p>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between w-full px-1 z-20 pointer-events-none">
                <CarouselPrevious className="pointer-events-auto bg-gray-600/70 hover:bg-gray-500 shadow-md border-0 text-white" />
                <CarouselNext className="pointer-events-auto bg-gray-600/70 hover:bg-gray-500 shadow-md border-0 text-white" />
              </div>
            </Carousel>
          </div>
        </div>
      </section>

      <Footer />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .gradient-hero {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .gradient-orange {
          background: linear-gradient(135deg, #ff8a00 0%, #ff5630 100%);
        }

        .gradient-purple {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }

        .gradient-green {
          background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-in-out forwards;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `,
        }}
      />
    </div>
  );
};

export default Home;
