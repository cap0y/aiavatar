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
  const rating = manager.rating ? parseFloat(manager.rating) / 10 : 5.0;
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
    e.stopPropagation();
    if (onMessage) {
      onMessage();
    } else {
      setLocation(`/care-manager/${manager.id}`);
    }
  };

  const handleBookClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
        className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gray-800 border-gray-700 rounded-2xl overflow-hidden"
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-bold text-xl shadow-lg">
              1
            </div>
            <Avatar className="w-16 h-16 border-2 border-purple-500 shadow-md">
              <AvatarImage src={normalizeImageUrl(manager.photoURL || undefined)} alt={manager.name} />
              <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">{manager.name[0]}</AvatarFallback>
            </Avatar>
            {user && (
              <button
                onClick={toggleFavorite}
                className="ml-auto text-pink-400 hover:text-pink-500"
                aria-label="즐겨찾기"
              >
                <Heart className={`h-5 w-5 ${existingFavorite ? 'fill-pink-400' : ''}`} />
              </button>
            )}
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="text-xl font-bold text-white">{manager.name}</h4>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white animate-pulse">
                  HOT
                </Badge>
              </div>
              <div className="flex items-center text-sm text-gray-300 mb-2">
                <span className="text-gray-400 mr-2">AI 크리에이터</span>
                <i className="fas fa-star text-yellow-400 mr-1"></i>
                <span className="font-semibold">{rating.toFixed(1)}</span>
                <span className="ml-3 text-purple-400 font-semibold">인기작가</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-400">
                {manager.hourlyRate ? Math.round(parseFloat(manager.hourlyRate)).toLocaleString() : "50,000"}원
              </div>
              <div className="text-sm text-gray-400">기본 작업비</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="bg-gray-800 border-gray-700 hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 transform hover:-translate-y-2 rounded-2xl overflow-hidden cursor-pointer h-full"
      onClick={handleCardClick}
    >
      <CardContent className="p-6 pb-4 h-full flex flex-col">
        <div className="flex items-start space-x-4 mb-6 relative">
          <div className="relative">
            <Avatar className="w-20 h-20 border-2 border-purple-500 shadow-md">
              <AvatarImage src={normalizeImageUrl(manager.photoURL || undefined)} alt={manager.name} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xl">{manager.name[0]}</AvatarFallback>
            </Avatar>
            {manager.isApproved && (
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full p-1 shadow-md">
                <i className="fas fa-check-circle text-white text-xs"></i>
              </div>
            )}
          </div>
          {user && (
            <button
              onClick={toggleFavorite}
              className="absolute top-0 right-0 text-pink-400 hover:text-pink-500"
              aria-label="즐겨찾기"
            >
              <Heart className={`h-6 w-6 ${existingFavorite ? 'fill-pink-400' : ''}`} />
            </button>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-2xl font-bold text-white">{manager.name}</h3>
              {manager.isApproved && (
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs">인증</Badge>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-300 mb-3">
              <span className="text-gray-400">AI 크리에이터</span>
              <div className="flex items-center">
                <i className="fas fa-star text-yellow-400 mr-1"></i>
                <span className="font-semibold">{rating.toFixed(1)}</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">
              경력 {manager.experience || "3년 이상"}
            </p>
            <p className="text-sm text-gray-400 mb-3">
              {manager.specialization || "AI 아바타 전문가"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30 text-xs rounded-full">
            AI 아바타 제작
          </Badge>
          <Badge className="bg-pink-600/20 text-pink-300 border-pink-500/30 text-xs rounded-full">
            캐릭터 디자인
          </Badge>
          <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-500/30 text-xs rounded-full">
            Live2D 모델링
          </Badge>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-3xl font-bold text-purple-400">
              {manager.hourlyRate ? Math.round(parseFloat(manager.hourlyRate)).toLocaleString() : "50,000"}원
            </div>
            <div className="text-sm text-gray-400">기본 작업비</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">평점</div>
            <div className="text-lg font-semibold text-white">{rating.toFixed(1)}</div>
          </div>
        </div>

        <div className="flex space-x-3 mt-auto">
          <Button
            onClick={handleMessageClick}
            variant="default"
            className="flex-1 bg-gray-700 hover:bg-gray-600 border-0 text-white py-4 rounded-full transition-all duration-200 font-medium text-base"
          >
            <i className="fas fa-comment mr-2"></i>
            문의하기
          </Button>
          <Button
            onClick={handleBookClick}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-full transition-all duration-200 font-medium transform hover:scale-105 text-base"
          >
            <i className="fas fa-palette mr-2"></i>
            의뢰하기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CareManagerCard;
