import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CareManagerCard from "@/components/care-manager-card";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import BookingModal from "@/components/booking-modal";
import type { Service, CareManager } from "@shared/schema";
import { normalizeImageUrl } from '@/lib/url';
import BottomNavigation from "@/components/bottom-navigation";

const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card'); // 카드/리스트 스타일 전환 상태로 변경
  const [location, setLocation] = useLocation();
  const { user, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const [bookingModal, setBookingModal] = useState<{
    isOpen: boolean;
    manager?: CareManager;
    serviceId?: number;
  }>({
    isOpen: false
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const { data: careManagers = [] } = useQuery<CareManager[]>({
    queryKey: ['/api/care-managers'],
  });

  // Parse URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const query = urlParams.get('q') || '';
    const service = urlParams.get('service') || '';
    
    setSearchQuery(query);
    setSelectedService(service);
  }, [location]);

  const filteredManagers = careManagers.filter(manager => {
    const matchesSearch = !searchQuery || 
      manager.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (manager.specialization && manager.specialization.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesSearch;
  });

  const sortedManagers = [...filteredManagers].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        const ratingA = a.rating ? parseFloat(a.rating) : 0;
        const ratingB = b.rating ? parseFloat(b.rating) : 0;
        return ratingB - ratingA;
      case 'reviews':
        return 0; // 후기 수 필드가 없으므로 정렬 안함
      case 'experience':
        return 0; // 경력 필드 형식이 다르므로 정렬 안함
      case 'price':
        const priceA = a.hourlyRate ? parseFloat(a.hourlyRate) : 0;
        const priceB = b.hourlyRate ? parseFloat(b.hourlyRate) : 0;
        return priceA - priceB;
      default:
        return 0;
    }
  });

  const handleBookingClick = async (manager: CareManager) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    setBookingModal({
      isOpen: true,
      manager
    });
  };

  const handleMessageClick = async (manager: CareManager) => {
    if (!user) { 
      setShowAuthModal(true); 
      return; 
    }
    
    // AI 크리에이터의 상세 페이지로 이동
    setLocation(`/care-manager/${manager.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Search Header */}
      <div className="bg-gray-800/90 backdrop-blur-sm shadow-sm px-4 py-6 sticky top-0 z-30 border-b border-gray-700">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-1 relative">
              <Input
                placeholder="크리에이터 이름, 전문 분야로 검색해보세요"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 bg-gray-700 text-white border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
            </div>
            <Button variant="default" className="px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700">
              <i className="fas fa-filter"></i>
            </Button>
          </div>
          
          {/* 필터 칩 제거 (서비스 필터 사용 안함) */}
        </div>
      </div>

      {/* Filter Options */}
      <div className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4 text-sm">
              <Button
                variant={sortBy === 'rating' ? "default" : "ghost"}
                size="sm"
                className="rounded-full text-white"
                onClick={() => setSortBy('rating')}
              >
                평점순 <i className="fas fa-chevron-down ml-1"></i>
              </Button>
              <Button
                variant={sortBy === 'price' ? "default" : "ghost"}
                size="sm"
                className="rounded-full text-white"
                onClick={() => setSortBy('price')}
              >
                요금순 <i className="fas fa-chevron-down ml-1"></i>
              </Button>
            </div>
            
            {/* 카드/리스트 스타일 전환 버튼 */}
            <div className="flex items-center space-x-1">
              <Button 
                variant={viewMode === 'card' ? "default" : "ghost"}
                size="sm" 
                className="p-2 rounded-l-lg text-white"
                onClick={() => setViewMode('card')}
              >
                <i className="fas fa-th-large"></i>
              </Button>
              <Button 
                variant={viewMode === 'list' ? "default" : "ghost"}
                size="sm" 
                className="p-2 rounded-r-lg text-white"
                onClick={() => setViewMode('list')}
              >
                <i className="fas fa-list"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-300">
              총 <span className="font-semibold text-purple-400">{sortedManagers.length}</span>명의 AI 크리에이터
            </span>
          </div>
        </div>

        {sortedManagers.length === 0 ? (
          <div className="text-center py-20">
            <i className="fas fa-search text-gray-600 text-6xl mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">검색 결과가 없습니다</h3>
            <p className="text-gray-500">다른 키워드로 검색해보세요</p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedManagers.map((manager) => (
              <CareManagerCard
                key={manager.id}
                manager={manager}
                onMessage={() => handleMessageClick(manager)}
                onBook={() => handleBookingClick(manager)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedManagers.map((manager) => (
              <Card 
                key={manager.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-300 bg-gray-800 border-gray-700"
                onClick={() => setLocation(`/care-manager/${manager.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12 border-2 border-purple-500">
                      <AvatarImage src={normalizeImageUrl(manager.photoURL || undefined)} alt={manager.name} />
                      <AvatarFallback className="bg-purple-500 text-white">{manager.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white">
                          {manager.name} 
                          <span className="text-sm font-normal text-gray-400 ml-2">AI 크리에이터</span>
                        </h4>
                        <div className="text-lg font-bold text-purple-400">
                          {manager.hourlyRate ? Math.round(parseFloat(manager.hourlyRate)).toLocaleString() : "50,000"}원
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <span className="mr-3">경력 {manager.experience || "3년 이상"}</span>
                        <span>{manager.specialization || "AI 아바타 전문가"}</span>
                        <div className="flex items-center ml-auto">
                          <i className="fas fa-star text-yellow-400 mr-1"></i>
                          <span>{manager.rating ? (parseFloat(manager.rating) / 10).toFixed(1) : "5.0"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 mt-3">
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="text-xs bg-gray-700 hover:bg-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMessageClick(manager);
                      }}
                    >
                      <i className="fas fa-comment mr-1"></i> 문의
                    </Button>
                    <Button 
                      size="sm" 
                      className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookingClick(manager);
                      }}
                    >
                      <i className="fas fa-palette mr-1"></i> 의뢰하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 의뢰 모달 */}
      {bookingModal.isOpen && bookingModal.manager && (
        <BookingModal
          isOpen={bookingModal.isOpen}
          onClose={() => setBookingModal({ isOpen: false })}
          manager={bookingModal.manager}
          userId={user?.uid ? parseInt(user.uid) : 1}
          onSuccess={() => {
            toast({
              title: "의뢰 성공",
              description: "의뢰가 성공적으로 등록되었습니다.",
            });
          }}
        />
      )}
      
      <BottomNavigation />
    </div>
  );
};

export default Search;
