import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { normalizeImageUrl } from "@/lib/url";
import { cartAPI } from "@/lib/api";

interface HeaderProps {}

const Header = ({}: HeaderProps) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, setShowAuthModal, logout } = useAuth();
  const userDisplay = user
    ? (user.displayName ?? user.email?.split("@")[0] ?? "")
    : "";
  const [, setLocation] = useLocation();

  // 알림 데이터 가져오기
  const { data: notifications = [] } = useQuery({
    queryKey: ["header-notifications", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      try {
        const sellerId = user?.uid || (user as any)?.id || user?.email;
        const response = await fetch(`/api/notifications/seller/${sellerId}`);
        if (!response.ok) return [];
        return await response.json();
      } catch (error) {
        console.error("알림 로드 오류:", error);
        return [];
      }
    },
    enabled: !!user?.uid,
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
      } catch (e) {
        return [];
      }
    },
    enabled: !!user?.uid,
  });
  const cartCount = Array.isArray(cartItems)
    ? cartItems.reduce(
        (sum: number, it: any) => sum + (Number(it.quantity) || 0),
        0,
      )
    : 0;

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
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

  const handleSearchClick = () => {
    setLocation("/search");
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
    <header className="bg-gray-900/80 backdrop-blur-sm shadow-sm border-b border-gray-700/20 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center space-x-2">
            <div 
              className="flex items-center space-x-2 cursor-pointer select-none"
              onClick={() => setLocation("/")}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <i className="fas fa-robot text-white text-lg"></i>
              </div>
              <span className="font-bold text-xl text-white hidden sm:block">AI아바타세상</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* 검색 아이콘 */}
            <button
              className="p-2 rounded-full hover:bg-gray-700"
              onClick={handleSearchClick}
            >
              <i className="fas fa-search text-gray-300"></i>
            </button>

            {/* 장바구니 아이콘 */}
            <button
              className="relative p-2 rounded-full hover:bg-gray-700"
              onClick={handleCartClick}
              aria-label="장바구니"
            >
              <i className="fas fa-shopping-cart text-gray-300"></i>
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
                  className="p-2 rounded-full hover:bg-gray-700 relative"
                  onClick={handleNotificationClick}
                >
                  <i className="fas fa-bell text-gray-300"></i>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* 알림 목록 패널 */}
                {showNotifications && (
                  <div
                    className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg py-2 z-50 max-h-[70vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-medium text-gray-800">알림</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => setLocation("/notifications")}
                      >
                        모두 보기
                      </Button>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        알림이 없습니다
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {notifications.slice(0, 5).map((notification: any) => (
                          <div
                            key={notification.id}
                            className={`p-3 hover:bg-gray-50 cursor-pointer ${!notification.is_read ? "bg-blue-50" : ""}`}
                          >
                            <div className="flex justify-between">
                              <span
                                className={`text-sm font-medium ${!notification.is_read ? "text-blue-600" : "text-gray-700"}`}
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
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
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
                  className="w-8 h-8 rounded-full cursor-pointer border-2 border-purple-200"
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
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-medium text-sm text-gray-800">
                        {userDisplay}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 flex items-center"
                      onClick={() => handleProfileMenuClick("/profile")}
                    >
                      <i className="fas fa-user w-5 text-center mr-2 text-purple-500"></i>
                      프로필
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 flex items-center"
                      onClick={() => handleProfileMenuClick("/bookings")}
                    >
                      <i className="fas fa-calendar w-5 text-center mr-2 text-purple-500"></i>
                      예약내역
                    </button>
                    {(user.userType === "careManager" ||
                      user.userType === "admin") && (
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 flex items-center"
                        onClick={() => handleProfileMenuClick("/profile")}
                      >
                        <i className="fas fa-chart-line w-5 text-center mr-2 text-blue-500"></i>
                        케어매니저 대시보드
                      </button>
                    )}
                    <div className="border-t border-gray-100 my-1"></div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                      onClick={() => handleProfileMenuClick("logout")}
                    >
                      <i className="fas fa-sign-out-alt w-5 text-center mr-2 text-red-500"></i>
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="ghost"
                className="text-sm font-medium hover:bg-gray-700 hover:text-white text-gray-300 px-3 py-1.5"
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
