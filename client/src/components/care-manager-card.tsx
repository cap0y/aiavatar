import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CareManager } from "@shared/schema";
import { useLocation } from "wouter";
import { normalizeImageUrl } from '@/lib/url';
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { favoritesAPI } from "@/lib/api";

interface CareManagerCardProps {
  manager: CareManager;
  compact?: boolean;
  onMessage?: () => void;
  onBook?: () => void;
}

const CareManagerCard = ({ manager, compact = false, onMessage, onBook }: CareManagerCardProps) => {
  const rating = manager.rating / 10; // Convert from integer to decimal
  const [, setLocation] = useLocation();
  const { user, setShowAuthModal } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user?.uid],
    queryFn: () => favoritesAPI.getFavorites(user!.uid),
    enabled: !!user?.uid,
  });

  const existingFavorite = Array.isArray(favorites)
    ? favorites.find((f: any) => Number(f.careManagerId) === Number(manager.id))
    : undefined;

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error("로그인이 필요합니다.");
      return favoritesAPI.addFavorite(user.uid, manager.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.uid] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!existingFavorite) return;
      return favoritesAPI.removeFavorite(existingFavorite.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.uid] });
    },
  });

  const handleCardClick = () => {
    setLocation(`/care-manager/${manager.id}`);
  };

  const handleMessageClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    if (onMessage) {
      onMessage();
    } else {
      // 문의하기 버튼 클릭 시 상세 페이지로 이동
      setLocation(`/care-manager/${manager.id}`);
    }
  };

  const handleBookClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    if (onBook) {
      onBook();
    }
  };

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (existingFavorite) {
      removeMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  if (compact) {
    return (
      <Card 
        className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-orange-100 rounded-2xl overflow-hidden"
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full font-bold text-xl shadow-lg">
              1
            </div>
            <Avatar className="w-16 h-16 border-2 border-orange-100 shadow-md">
              <AvatarImage src={normalizeImageUrl(manager.imageUrl || undefined)} alt={manager.name} />
              <AvatarFallback className="bg-gradient-to-r from-red-500 to-orange-500 text-white">{manager.name[0]}</AvatarFallback>
            </Avatar>
            {user && (
              <button
                onClick={toggleFavorite}
                className="ml-auto text-pink-500 hover:text-pink-600"
                aria-label="즐겨찾기"
              >
                <Heart className={`h-5 w-5 ${existingFavorite ? 'fill-pink-500' : ''}`} />
              </button>
            )}
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="text-xl font-bold text-gray-800">{manager.name}</h4>
                <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white animate-pulse">
                  HOT
                </Badge>
              </div>
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <span className="text-gray-600 mr-2">({manager.age}세)</span>
                <i className="fas fa-star text-yellow-400 mr-1"></i>
                <span className="font-semibold">{rating}</span>
                <span className="ml-1">({manager.reviews})</span>
                <span className="ml-3 text-red-500 font-semibold">오늘 5건 예약</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-red-600">{manager.hourlyRate.toLocaleString()}원</div>
              <div className="text-sm text-gray-500">시간당</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get gradient color based on manager index
  const getGradientColor = (id: number) => {
    const colors = [
      'from-blue-50 to-cyan-50 border-blue-100',
      'from-purple-50 to-pink-50 border-purple-100',
      'from-green-50 to-teal-50 border-green-100'
    ];
    return colors[(id - 1) % colors.length];
  };

  const getButtonColor = (id: number) => {
    const colors = [
      { outline: 'border-blue-200 text-blue-600 hover:bg-blue-50', filled: 'gradient-blue' },
      { outline: 'border-purple-200 text-purple-600 hover:bg-purple-50', filled: 'gradient-purple' },
      { outline: 'border-green-200 text-green-600 hover:bg-green-50', filled: 'gradient-green' }
    ];
    return colors[(id - 1) % colors.length];
  };

  const gradientClass = getGradientColor(manager.id);
  const buttonColors = getButtonColor(manager.id);

  return (
    <Card 
      className={`bg-gradient-to-br ${gradientClass} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border rounded-2xl overflow-hidden cursor-pointer h-full`}
      onClick={handleCardClick}
    >
      <CardContent className="p-6 pb-4 h-full flex flex-col">
        <div className="flex items-start space-x-4 mb-6 relative">
          <div className="relative">
            <Avatar className="w-20 h-20 border-2 border-white/50 shadow-md">
              <AvatarImage src={normalizeImageUrl(manager.imageUrl || undefined)} alt={manager.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xl">{manager.name[0]}</AvatarFallback>
            </Avatar>
            {manager.certified && (
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full p-1 shadow-md">
                <i className="fas fa-check text-white text-xs"></i>
              </div>
            )}
          </div>
          {user && (
            <button
              onClick={toggleFavorite}
              className="absolute top-0 right-0 text-pink-500 hover:text-pink-600"
              aria-label="즐겨찾기"
            >
              <Heart className={`h-6 w-6 ${existingFavorite ? 'fill-pink-500' : ''}`} />
            </button>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-2xl font-bold text-gray-800">{manager.name}</h3>
              {manager.certified && (
                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs">인증</Badge>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
              <span className="text-gray-500">({manager.age}세)</span>
              <div className="flex items-center">
                <i className="fas fa-star text-yellow-400 mr-1"></i>
                <span className="font-semibold">{rating}</span>
                <span className="ml-1">({manager.reviews})</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              경력 {manager.experience}
            </p>
            <p className="text-sm text-gray-500 mb-3">
              {manager.location}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(manager.services as any[]).map((service: any, index) => (
            <Badge key={index} variant="secondary" className="text-xs rounded-full">
              {typeof service === "string" ? service : service.name}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-3xl font-bold text-blue-600">{manager.hourlyRate.toLocaleString()}원</div>
            <div className="text-sm text-gray-500">시간당</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">이번 달 예약</div>
            <div className="text-lg font-semibold text-gray-800">{Math.floor(Math.random() * 30) + 15}회</div>
          </div>
        </div>

        {/* 버튼을 하단에 배치하되 absolute 제거 */}
        <div className="flex space-x-3 mt-auto">
          <Button
            onClick={handleMessageClick}
            variant="outline"
            className={`flex-1 bg-white border-2 ${buttonColors.outline} py-4 rounded-full transition-all duration-200 font-medium text-base`}
          >
            <i className="fas fa-comment mr-2"></i>
            문의하기
          </Button>
          <Button
            onClick={handleBookClick}
            className={`flex-1 ${buttonColors.filled} text-white py-4 rounded-full hover:opacity-90 transition-all duration-200 font-medium transform hover:scale-105 text-base`}
          >
            <i className="fas fa-calendar mr-2"></i>
            예약하기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CareManagerCard;
