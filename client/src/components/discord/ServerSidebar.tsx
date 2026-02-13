import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { getFriends, subscribeFriendsPresence, updateUserPresence, getPendingFriendRequests, removeFriend } from '@/firebase';
import { Friend, FriendRequest } from '@/types/friend';
import AddFriendModal from './AddFriendModal';
import FriendRequestNotification from './FriendRequestNotification';
import { useToast } from '@/hooks/use-toast';

const ServerSidebar: React.FC = () => {
  const [activeServerId, setActiveServerId] = useState('home');
  const { user, setShowAuthModal } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // 친구 관련 상태
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    friendId: string;
    friendName: string;
  }>({ show: false, x: 0, y: 0, friendId: '', friendName: '' });

  // 사용자 온라인 상태 설정
  useEffect(() => {
    if (user) {
      updateUserPresence(user.uid, { status: 'online' });
      
      // 페이지 언로드 시 오프라인 상태로 변경
      const handleBeforeUnload = () => {
        updateUserPresence(user.uid, { status: 'offline' });
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        updateUserPresence(user.uid, { status: 'offline' });
      };
    }
  }, [user]);

  // 친구 목록 로드 및 실시간 구독
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setFriendRequestCount(0);
      return;
    }

    setIsLoadingFriends(true);

    // 실시간 친구 목록 구독
    const unsubscribe = subscribeFriendsPresence(user.uid, (updatedFriends) => {
      console.log("친구 목록 업데이트:", updatedFriends);
      setFriends(updatedFriends);
      setIsLoadingFriends(false);
    });

    // 친구 요청 개수 확인
    const loadFriendRequestCount = async () => {
      try {
        const result = await getPendingFriendRequests(user.uid);
        if (result.success) {
          setFriendRequestCount(result.requests.length);
        }
      } catch (error) {
        console.error("친구 요청 개수 로드 오류:", error);
      }
    };

    loadFriendRequestCount();

    // 주기적으로 친구 요청 개수 확인 (30초마다)
    const interval = setInterval(loadFriendRequestCount, 30000);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearInterval(interval);
    };
  }, [user]);

  const handleItemClick = (itemId: string, isHome: boolean = false, friendName?: string, isFriend: boolean = false) => {
    setActiveServerId(itemId);
    if (isHome) {
      setLocation('/');
    } else if (!isHome && friendName && isFriend) {
      // 친구 클릭 시 개인 채팅으로 이동
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      setLocation(`/chat?to=${itemId}&name=${encodeURIComponent(friendName)}`);
    }
  };

  const handleAddFriend = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowAddFriendModal(true);
  };

  const handleShowFriendRequests = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowFriendRequests(true);
  };

  const handleFriendRequestModalClose = () => {
    setShowFriendRequests(false);
    // 모달이 닫힐 때 친구 요청 개수 다시 로드
    if (user) {
      getPendingFriendRequests(user.uid).then(result => {
        if (result.success) {
          setFriendRequestCount(result.requests.length);
        }
      });
    }
  };

  // 우클릭 컨텍스트 메뉴 핸들러
  const handleRightClick = (e: React.MouseEvent, friendId: string, friendName: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      friendId,
      friendName
    });
  };

  // 친구 삭제 핸들러
  const handleRemoveFriend = async () => {
    if (!user) return;

    const { friendId, friendName } = contextMenu;
    setContextMenu({ show: false, x: 0, y: 0, friendId: '', friendName: '' });

    try {
      const result = await removeFriend(user.uid, friendId);
      
      if (result.success) {
        toast({
          title: "친구 삭제 완료",
          description: `${friendName}님이 친구 목록에서 제거되었습니다.`,
        });
      } else {
        toast({
          title: "친구 삭제 실패",
          description: String(result.error || "친구를 삭제할 수 없습니다."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("친구 삭제 오류:", error);
      toast({
        title: "오류",
        description: "친구 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, friendId: '', friendName: '' });
  };

  // 전역 클릭 이벤트로 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.show) {
        closeContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.show]);

  // 홈 아이템과 친구 목록을 결합한 전체 목록
  const allItems = [
    {
      id: 'home',
      name: 'AI아바타세상',
      icon: '🏠',
      photoURL: undefined,
      isHome: true,
      description: '홈으로 돌아가기',
      isOnline: false,
      backgroundColor: 'from-purple-500 to-pink-500',
      isFriend: false,
      status: 'offline' as const,
    },
    ...friends.map(friend => ({
      id: friend.uid,
      name: friend.displayName,
      photoURL: friend.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.displayName)}&background=6366f1&color=fff&size=96`,
      icon: friend.displayName[0] || '?',
      description: friend.customStatus || (friend.isOnline ? '온라인' : `마지막 접속: ${new Date(friend.lastSeen).toLocaleDateString()}`),
      isOnline: friend.isOnline,
      backgroundColor: 'from-blue-500 to-purple-500',
      isHome: false,
      isFriend: true,
      status: friend.status,
    })),
  ];

  return (
    <div className="w-16 bg-gray-200 dark:bg-black flex flex-col items-center py-3 space-y-2 transition-colors">
      {allItems.map((item) => (
        <div
          key={item.id}
          className={`relative group cursor-pointer transition-all duration-200 ${
            activeServerId === item.id ? 'transform-none' : 'hover:rounded-2xl'
          }`}
          onClick={() => handleItemClick(item.id, item.isHome, item.name, item.isFriend)}
          onContextMenu={item.isFriend ? (e) => handleRightClick(e, item.id, item.name) : undefined}
        >
          <div
            className={`w-12 h-12 flex items-center justify-center transition-all duration-200 ${
              activeServerId === item.id
                ? 'rounded-2xl bg-purple-600'
                : 'rounded-full bg-gray-300 dark:bg-gray-700 hover:bg-purple-600 hover:rounded-2xl'
            }`}
          >
            {item.isHome ? (
              <i className={`fas fa-home text-lg ${activeServerId === item.id ? 'text-white' : 'text-gray-700 dark:text-white'}`}></i>
            ) : (
              <Avatar className="w-10 h-10">
                <AvatarImage src={item.photoURL} alt={item.name} />
                <AvatarFallback className={`bg-gradient-to-br ${item.backgroundColor || 'from-purple-500 to-pink-500'} text-white`}>
                  {item.name[0]}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* 온라인 상태 표시기 */}
          {item.isOnline && !item.isHome && (
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-gray-200 dark:border-black rounded-full"></div>
          )}

          {/* 활성 상태 표시기 */}
          <div
            className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1 bg-white rounded-r-full transition-all duration-200 ${
              activeServerId === item.id ? 'h-10 -translate-x-0' : 'h-0 -translate-x-1'
            }`}
          />

          {/* 호버 툴팁 */}
          <div className="absolute left-16 top-1/2 transform -translate-y-1/2 bg-black text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap max-w-xs">
            <div className="font-semibold">{item.name}</div>
            {item.description && (
              <div className="text-xs text-gray-300 mt-1">{item.description}</div>
            )}
            {!item.isHome && !user && (
              <div className="text-xs text-yellow-400 mt-1 flex items-center">
                <i className="fas fa-lock mr-1"></i>
                채팅하려면 로그인 필요
              </div>
            )}
            {!item.isHome && item.isFriend && (
              <div className={`text-xs mt-1 flex items-center ${
                item.isOnline ? 'text-green-400' : 'text-gray-400'
              }`}>
                <div className={`w-2 h-2 ${
                  item.isOnline ? 'bg-green-400' : 'bg-gray-400'
                } rounded-full mr-1`}></div>
                {item.status === 'online' ? '온라인' :
                 item.status === 'away' ? '자리비움' :
                 item.status === 'busy' ? '다른 용무 중' : '오프라인'}
              </div>
            )}
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black"></div>
          </div>
        </div>
      ))}

      {/* 구분선 */}
      <div className="w-8 h-px bg-gray-400 dark:bg-gray-600 my-2"></div>

      {/* 친구 요청 알림 버튼 */}
      <div className="group cursor-pointer relative" onClick={handleShowFriendRequests}>
        <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center hover:bg-blue-600 hover:rounded-2xl transition-all duration-200">
          <i className="fas fa-bell text-blue-500 dark:text-blue-400 group-hover:text-white text-lg"></i>
        </div>
        
        {/* 알림 배지 */}
        {friendRequestCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {friendRequestCount > 9 ? '9+' : friendRequestCount}
          </div>
        )}
        
        {/* 툴팁 */}
        <div className="absolute left-16 top-1/2 transform -translate-y-1/2 bg-black text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
          {user ? `친구 요청 ${friendRequestCount > 0 ? `(${friendRequestCount})` : ''}` : '로그인 후 알림 확인'}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black"></div>
        </div>
      </div>

      {/* 친구 추가 버튼 */}
      <div className="group cursor-pointer" onClick={handleAddFriend}>
        <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center hover:bg-green-600 hover:rounded-2xl transition-all duration-200">
          <i className="fas fa-plus text-green-500 dark:text-green-400 group-hover:text-white text-lg"></i>
        </div>
        
        {/* 툴팁 */}
        <div className="absolute left-16 top-1/2 transform -translate-y-1/2 bg-black text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
          {user ? '새 친구 추가' : '로그인 후 친구 추가'}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black"></div>
        </div>
      </div>

      {/* 로딩 중 표시 */}
      {isLoadingFriends && (
        <div className="text-gray-600 dark:text-gray-400 text-xs mt-2 px-2">
          <i className="fas fa-spinner fa-spin"></i>
        </div>
      )}

      {/* 친구 요청 알림 모달 */}
      <FriendRequestNotification 
        isOpen={showFriendRequests}
        onClose={handleFriendRequestModalClose}
      />

      {/* 친구 추가 모달 */}
      <AddFriendModal 
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
      />

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu.show && (
        <div
          className="fixed z-50 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-[#1A1A1B] rounded-lg shadow-xl py-2 min-w-[150px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-[#1A1A1B]">
            {contextMenu.friendName}
          </div>
          
          <button
            className="w-full px-3 py-2 text-sm text-left text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-2"
            onClick={handleRemoveFriend}
          >
            <i className="fas fa-user-minus text-xs"></i>
            친구 삭제
          </button>
          
          <button
            className="w-full px-3 py-2 text-sm text-left text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-300 flex items-center gap-2"
            onClick={closeContextMenu}
          >
            <i className="fas fa-times text-xs"></i>
            취소
          </button>
        </div>
      )}
    </div>
  );
};

export default ServerSidebar;

