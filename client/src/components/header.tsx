import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { normalizeImageUrl } from "@/lib/url";
import { cartAPI } from "@/lib/api";
import axios from "axios";

interface HeaderProps {}

const Header = ({}: HeaderProps) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, setShowAuthModal, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const userDisplay = user
    ? (user.displayName ?? user.email?.split("@")[0] ?? "")
    : "";
  const [, setLocation] = useLocation();
  
  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 알림 데이터 가져오기
  const { data: notifications = [] } = useQuery({
    queryKey: ["header-notifications", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      try {
        const sellerId = user?.uid || (user as any)?.id || user?.email;
        const response = await fetch(`/api/notifications/seller/${sellerId}`);
        if (!response.ok) {
          if (response.status === 500) {
            console.warn("알림 서버 연결 실패 - 서버가 실행되지 않았을 수 있습니다.");
          }
          return [];
        }
        return await response.json();
      } catch (error) {
        console.warn("알림 서비스 일시적 오류 - 기본 기능은 정상 작동합니다:", error);
        return [];
      }
    },
    enabled: !!user?.uid,
    retry: false, // 재시도 비활성화
    staleTime: 30000, // 30초간 캐시 유지
  });

  // 읽지 않은 알림 개수
  const unreadCount = notifications.filter(
    (notif: any) => !notif.is_read,
  ).length;

  // 장바구니 수량 가져오기
  const { data: cartItems = [], refetch: refetchCart } = useQuery({
    queryKey: ["header-cart", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      try {
        const items = await cartAPI.getCart(user.uid);
        return Array.isArray(items) ? items : [];
      } catch (e: any) {
        console.warn("장바구니 서버 연결 실패:", e);
        return [];
      }
    },
    enabled: !!user?.uid,
    retry: false, // 재시도 비활성화
    staleTime: 30000, // 30초간 캐시 유지
  });
  const cartCount = Array.isArray(cartItems)
    ? cartItems.reduce(
        (sum: number, it: any) => sum + (Number(it.quantity) || 0),
        0,
      )
    : 0;

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowSearchResults(false);
      }
      setShowProfileMenu(false);
      setShowNotifications(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLoginClick = () => {
    setShowAuthModal(true);
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(!showProfileMenu);
    setShowNotifications(false);
  };

  const handleNotificationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowNotifications(!showNotifications);
    setShowProfileMenu(false);
  };

  // 검색 실행
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(`/api/feed/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data);
      setShowSearchResults(true);
    } catch (error) {
      console.error("검색 실패:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 검색어 변경 시 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 검색 결과 클릭
  const handleSearchResultClick = (postId: number) => {
    setShowSearchResults(false);
    setSearchQuery("");
    setLocation(`/discord?post=${postId}`);
  };

  const handleCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setLocation("/cart");
  };

  const handleProfileMenuClick = (path: string) => {
    setShowProfileMenu(false);
    if (path === "logout") {
      logout();
    } else {
      setLocation(path);
    }
  };

  const formatNotificationTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return "방금 전";
    } else if (diffMin < 60) {
      return `${diffMin}분 전`;
    } else if (diffHour < 24) {
      return `${diffHour}시간 전`;
    } else if (diffDay < 7) {
      return `${diffDay}일 전`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <header className="bg-white dark:bg-[#0B0B0B] shadow-lg border-b border-gray-200 dark:border-[#1A1A1B] fixed top-0 left-0 right-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-2 sm:px-3">
        <div className="flex items-center h-10 relative">
          {/* 왼쪽 로고 */}
          <div className="flex items-center space-x-2 cursor-pointer select-none" onClick={() => setLocation("/")}>
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <i className="fas fa-robot text-white text-sm"></i>
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white hidden sm:block">AI아바타세상</span>
          </div>
          
          {/* 중앙 검색 박스 */}
          <div className="absolute left-1/2 transform -translate-x-1/2 w-full max-w-xl px-32 hidden md:block search-container">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm"></i>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                placeholder="게시물 검색..."
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full py-1.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
              
              {/* 검색 결과 드롭다운 */}
              {showSearchResults && (
                <div className="absolute top-full mt-2 w-full bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-[#1A1A1B] rounded-lg shadow-xl max-h-[400px] overflow-y-auto z-50">
                  {isSearching ? (
                    <div className="p-4 text-center text-gray-600 dark:text-gray-400">
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      검색 중...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-gray-600 dark:text-gray-400">
                      검색 결과가 없습니다
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700">
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="p-3 hover:bg-gray-700 cursor-pointer transition-colors"
                          onClick={() => handleSearchResultClick(result.id)}
                        >
                          <div className="flex items-start gap-3">
                            {result.mediaUrl && (
                              <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-700">
                                {result.mediaType === "image" ? (
                                  <img
                                    src={result.mediaUrl}
                                    alt={result.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <video
                                    src={result.mediaUrl}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  r/{result.userName || "익명"}
                                </span>
                                <span className="text-xs text-gray-600">•</span>
                                <span className="text-xs text-gray-500">
                                  {result.commentCount || 0} 댓글
                                </span>
                              </div>
                              <h4 className="text-sm font-medium text-white line-clamp-2 mb-1">
                                {result.title}
                              </h4>
                              {result.content && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                                  {result.content}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          
          {/* 오른쪽 아이콘들 */}
          <div className="ml-auto flex items-center space-x-2">

            {/* 장바구니 아이콘 */}
            <button
              className="relative p-1.5 rounded-full hover:bg-gray-700"
              onClick={handleCartClick}
              aria-label="장바구니"
            >
              <i className="fas fa-shopping-cart text-gray-700 dark:text-gray-300 text-sm"></i>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* 알림 아이콘 */}
            {user && (
              <div className="relative">
                <button
                  className="p-1.5 rounded-full hover:bg-gray-700 relative"
                  onClick={handleNotificationClick}
                >
                  <i className="fas fa-bell text-gray-700 dark:text-gray-300 text-sm"></i>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* 알림 목록 패널 */}
                {showNotifications && (
                  <div
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-[#1A1A1B] rounded-xl shadow-lg py-2 z-50 max-h-[70vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                      <h3 className="font-medium text-white">알림</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setLocation("/notifications")}
                      >
                        모두 보기
                      </Button>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
                        알림이 없습니다
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-700">
                        {notifications.slice(0, 5).map((notification: any) => (
                          <div
                            key={notification.id}
                            className={`p-3 hover:bg-gray-700 cursor-pointer ${!notification.is_read ? "bg-blue-900/20" : ""}`}
                          >
                            <div className="flex justify-between">
                              <span
                                className={`text-sm font-medium ${!notification.is_read ? "text-blue-500 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}
                              >
                                {notification.type === "order" && "새 주문"}
                                {notification.type === "shipping" &&
                                  "배송 상태"}
                                {notification.type === "stock" && "재고 알림"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatNotificationTime(notification.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {user ? (
              <div className="relative">
                <Avatar
                  className="w-7 h-7 rounded-full cursor-pointer border-2 border-purple-200"
                  onClick={handleProfileClick}
                >
                  <AvatarImage
                    src={normalizeImageUrl(user.photoURL || undefined)}
                    alt={userDisplay}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                    {userDisplay[0]}
                  </AvatarFallback>
                </Avatar>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-[#1A1A1B] rounded-xl shadow-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-700">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">
                        {userDisplay}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{user.email}</p>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center"
                      onClick={() => handleProfileMenuClick("/profile")}
                    >
                      <i className="fas fa-user w-5 text-center mr-2 text-purple-400"></i>
                      프로필
                    </button>
                    {(user.userType === "careManager" ||
                      user.userType === "admin") && (
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center"
                        onClick={() => handleProfileMenuClick("/profile")}
                      >
                        <i className="fas fa-chart-line w-5 text-center mr-2 text-blue-400"></i>
                        AI아바타 대시보드
                      </button>
                    )}
                    <div className="border-t border-gray-700 my-1"></div>
                    {/* 다크모드 토글 */}
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center justify-between"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTheme();
                      }}
                    >
                      <div className="flex items-center">
                        <i className={`fas ${isDarkMode ? 'fa-moon' : 'fa-sun'} w-5 text-center mr-2 text-yellow-400`}></i>
                        다크 모드
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-600'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'right-0.5' : 'left-0.5'}`}></div>
                      </div>
                    </button>
                    <div className="border-t border-gray-700 my-1"></div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center"
                      onClick={() => handleProfileMenuClick("logout")}
                    >
                      <i className="fas fa-sign-out-alt w-5 text-center mr-2 text-red-400"></i>
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="ghost"
                className="text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white text-gray-700 dark:text-gray-300 px-3 py-1.5"
                onClick={handleLoginClick}
              >
                <i className="fas fa-sign-in-alt mr-2"></i>
                로그인
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
