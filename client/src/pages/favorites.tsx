import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Heart, 
  Star, 
  MessageCircle, 
  Calendar,
  MapPin,
  Clock,
  HeartOff
} from "lucide-react";
import { normalizeImageUrl } from '@/lib/url';
import { favoritesAPI } from "@/lib/api";

interface FavoriteEnriched {
  favoriteId: number;
  careManagerId: number;
  manager: any | null;
  createdAt: string;
}

export default function FavoritesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 찜한 케어 매니저 조회
  const { data: favorites = [], isLoading } = useQuery<FavoriteEnriched[]>({
    queryKey: ["favorites", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const favs = await favoritesAPI.getFavorites(user.uid);
      const enriched = await Promise.all(
        favs.map(async (f: any) => {
          try {
            const res = await fetch(`/api/care-managers/${f.careManagerId}`);
            const mgr = res.ok ? await res.json() : null;
            return {
              favoriteId: f.id,
              careManagerId: f.careManagerId,
              manager: mgr,
              createdAt: f.createdAt,
            } as FavoriteEnriched;
          } catch {
            return {
              favoriteId: f.id,
              careManagerId: f.careManagerId,
              manager: null,
              createdAt: f.createdAt,
            } as FavoriteEnriched;
          }
        })
      );
      return enriched;
    },
    enabled: !!user?.uid,
  });

  // 찜 해제 뮤테이션
  const removeFavoriteMutation = useMutation({
    mutationFn: async (favoriteId: number) => {
      return favoritesAPI.removeFavorite(favoriteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast({
        title: "찜 해제 완료",
        description: "케어 매니저를 찜 목록에서 제거했습니다.",
      });
    },
    onError: () => {
      toast({
        title: "찜 해제 실패",
        description: "찜 해제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString() + '원';
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating 
                ? "fill-yellow-400 text-yellow-400" 
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const handleRemoveFavorite = (favoriteId: number, managerName: string) => {
    if (confirm(`정말로 ${managerName} 케어 매니저를 찜 목록에서 제거하시겠습니까?`)) {
      removeFavoriteMutation.mutate(favoriteId);
    }
  };

  const handleViewProfile = (managerId: string) => {
    setLocation(`/care-manager/${managerId}`);
  };

  const handleMessage = (managerId: string) => {
    setLocation(`/care-manager/${managerId}`);
  };

  if (!user) {
    setLocation('/');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/profile')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          마이페이지로 돌아가기
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Heart className="h-6 w-6 text-pink-600" />
          <h1 className="text-2xl font-bold text-gray-800">찜한 케어 매니저</h1>
        </div>
        <p className="text-gray-600">관심 있는 케어 매니저들을 관리할 수 있습니다.</p>
      </div>

      {/* 찜 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-pink-600 mb-1">
              {favorites.length}명
            </div>
            <div className="text-sm text-gray-600">총 찜한 케어 매니저</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600 mb-1 flex items-center justify-center gap-1">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              {favorites.length > 0 
                ? (favorites.reduce((sum, fav) => sum + (fav.manager?.rating ?? 0), 0) / favorites.length).toFixed(1)
                : "0.0"
              }
            </div>
            <div className="text-sm text-gray-600">평균 평점</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {favorites.filter(fav => fav.manager?.certified).length}명
            </div>
            <div className="text-sm text-gray-600">인증된 케어 매니저</div>
          </CardContent>
        </Card>
      </div>

      {/* 찜한 케어 매니저 목록 */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">찜한 케어 매니저를 불러오는 중...</p>
            </CardContent>
          </Card>
        ) : favorites.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800 mb-2">찜한 케어 매니저가 없습니다</h3>
              <p className="text-gray-600 mb-4">마음에 드는 케어 매니저를 찜해보세요!</p>
              <Button onClick={() => setLocation('/search')}>
                케어 매니저 찾기
              </Button>
            </CardContent>
          </Card>
        ) : (
          favorites.map((fav) => (
            <Card key={fav.favoriteId} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* 케어 매니저 이미지 */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                      <img
                        src={normalizeImageUrl(fav.manager?.imageUrl)}
                        alt={fav.manager?.name || `케어 매니저 #${fav.careManagerId}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  
                  {/* 케어 매니저 정보 */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-800 text-lg">{fav.manager?.name || `케어 매니저 #${fav.careManagerId}`}</h3>
                          {fav.manager?.certified && (
                            <Badge className="bg-blue-500 text-white text-xs">인증</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          {fav.manager?.age ? <span>{fav.manager.age}세</span> : null}
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            경력 {fav.manager?.experience ?? '-'}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {fav.manager?.location ?? '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          {renderStars(fav.manager?.rating ?? 0)}
                          <span className="text-sm font-medium">{fav.manager?.rating ?? 0}</span>
                          <span className="text-xs text-gray-500">({fav.manager?.reviews ?? 0}개 리뷰)</span>
                        </div>
                      </div>
                      
                      {/* 시간당 요금 */}
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          {fav.manager?.hourlyRate ? formatPrice(fav.manager.hourlyRate) : '-'}
                        </div>
                        <div className="text-xs text-gray-500">시간당</div>
                      </div>
                    </div>
                    
                    {fav.manager?.description ? (
                      <p className="text-sm text-gray-700 mb-3">{fav.manager.description}</p>
                    ) : null}
                    
                    {/* 서비스 태그 */}
                    {Array.isArray(fav.manager?.services) && (
                      <div className="flex flex-wrap gap-2 mb-4">
                      {(fav.manager.services as any[]).map((service, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        찜한 날짜: {formatDate(fav.createdAt)}
                      </div>
                      
                      {/* 액션 버튼들 */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(String(fav.careManagerId))}
                        >
                          프로필 보기
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMessage(String(fav.careManagerId))}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          메시지
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFavorite(fav.favoriteId, fav.manager?.name || `케어 매니저 #${fav.careManagerId}`)}
                          disabled={removeFavoriteMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <HeartOff className="h-4 w-4 mr-1" />
                          찜 해제
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
} 