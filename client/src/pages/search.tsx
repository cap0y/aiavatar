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
import CareManagerMap from "@/components/care-manager-map";
import { normalizeImageUrl } from '@/lib/url';

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
      manager.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesService = !selectedService || 
      (manager.services as any[]).some((s:any)=> (typeof s === "string" ? s : s.name) === selectedService);
    
    return matchesSearch && matchesService;
  });

  const sortedManagers = [...filteredManagers].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'reviews':
        return b.reviews - a.reviews;
      case 'experience':
        return parseInt(b.experience) - parseInt(a.experience);
      case 'price':
        return a.hourlyRate - b.hourlyRate;
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
      manager,
      serviceId: (manager.services as string[]).length > 0 
        ? services.find(s => (manager.services as string[]).includes(s.name))?.id || 1
        : 1
    });
  };

  const handleMessageClick = async (manager: CareManager) => {
    if (!user) { 
      setShowAuthModal(true); 
      return; 
    }
    
    // 케어매니저의 상세 페이지로 이동
    setLocation(`/care-manager/${manager.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-20">
      {/* Search Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm px-4 py-6 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-1 relative">
              <Input
                placeholder="지역, 서비스명으로 검색해보세요"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
            </div>
            <Button variant="outline" className="px-4 py-3 rounded-xl">
              <i className="fas fa-filter"></i>
            </Button>
          </div>
          
          {/* Filter Chips */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            <Button
              variant={selectedService === '' ? "default" : "outline"}
              size="sm"
              className="rounded-full whitespace-nowrap"
              onClick={() => setSelectedService('')}
            >
              전체
            </Button>
            {services.map((service) => (
              <Button
                key={service.id}
                variant={selectedService === service.name ? "default" : "outline"}
                size="sm"
                className="rounded-full whitespace-nowrap"
                onClick={() => setSelectedService(selectedService === service.name ? '' : service.name)}
              >
                {service.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Options */}
      <div className="bg-white/90 backdrop-blur-sm border-b px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4 text-sm">
              <Button
                variant={sortBy === 'rating' ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                onClick={() => setSortBy('rating')}
              >
                평점순 <i className="fas fa-chevron-down ml-1"></i>
              </Button>
              <Button
                variant={sortBy === 'reviews' ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                onClick={() => setSortBy('reviews')}
              >
                후기순 <i className="fas fa-chevron-down ml-1"></i>
              </Button>
              <Button
                variant={sortBy === 'experience' ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                onClick={() => setSortBy('experience')}
              >
                경력순 <i className="fas fa-chevron-down ml-1"></i>
              </Button>
              <Button
                variant={sortBy === 'price' ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
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
                className="p-2 rounded-l-lg"
                onClick={() => setViewMode('card')}
              >
                <i className="fas fa-th-large"></i>
              </Button>
              <Button 
                variant={viewMode === 'list' ? "default" : "ghost"}
                size="sm" 
                className="p-2 rounded-r-lg"
                onClick={() => setViewMode('list')}
              >
                <i className="fas fa-list"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 지도 - 항상 표시 */}
      <div className="w-full h-[500px] bg-white mb-6" id="search-map-container">
        {/* key 속성을 추가하여 컴포넌트가 다시 마운트되도록 함 */}
        <CareManagerMap key="search-map" searchQuery={searchQuery} />
      </div>

      {/* Search Results */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              총 <span className="font-semibold text-purple-600">{sortedManagers.length}</span>명의 케어 매니저
            </span>
            {selectedService && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                {selectedService}
              </Badge>
            )}
          </div>
        </div>

        {sortedManagers.length === 0 ? (
          <div className="text-center py-20">
            <i className="fas fa-search text-gray-300 text-6xl mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-500 mb-2">검색 결과가 없습니다</h3>
            <p className="text-gray-400">다른 키워드로 검색해보세요</p>
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
                className="cursor-pointer hover:shadow-lg transition-all duration-300"
                onClick={() => setLocation(`/care-manager/${manager.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12 border border-gray-200">
                      <AvatarImage src={normalizeImageUrl(manager.imageUrl || undefined)} alt={manager.name} />
                      <AvatarFallback>{manager.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-800">{manager.name} <span className="text-sm font-normal text-gray-500">({manager.age}세)</span></h4>
                        <div className="text-lg font-bold text-blue-600">{manager.hourlyRate.toLocaleString()}원</div>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="mr-3">경력 {manager.experience}</span>
                        <span>{manager.location}</span>
                        <div className="flex items-center ml-auto">
                          <i className="fas fa-star text-yellow-400 mr-1"></i>
                          <span>{manager.rating / 10}</span>
                          <span className="text-gray-400 ml-1">({manager.reviews})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(manager.services as any[]).slice(0, 3).map((service:any, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {typeof service === "string" ? service : service.name}
                      </Badge>
                    ))}
                    {(manager.services as any[]).length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{(manager.services as any[]).length - 3}
                      </Badge>
                    )}
                  </div>
                  <div className="flex space-x-2 mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMessageClick(manager);
                      }}
                    >
                      <i className="fas fa-comment mr-1"></i> 문의
                    </Button>
                    <Button 
                      size="sm" 
                      className="text-xs bg-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookingClick(manager);
                      }}
                    >
                      <i className="fas fa-calendar-check mr-1"></i> 예약
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 예약 모달 */}
      {bookingModal.isOpen && bookingModal.manager && (
        <BookingModal
          isOpen={bookingModal.isOpen}
          onClose={() => setBookingModal({ isOpen: false })}
          manager={bookingModal.manager}
          userId={user?.uid ? parseInt(user.uid) : 1}
          serviceId={bookingModal.serviceId || 1}
          onSuccess={() => {
            toast({
              title: "예약 성공",
              description: "예약이 성공적으로 등록되었습니다.",
            });
          }}
        />
      )}
    </div>
  );
};

export default Search;
