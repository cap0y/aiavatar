import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { avatarSamples } from '@/data/avatarSamples';

const ServerSidebar: React.FC = () => {
  const [activeServerId, setActiveServerId] = useState('home');
  const { user, setShowAuthModal } = useAuth();
  const [, setLocation] = useLocation();

  const handleItemClick = (itemId: string, isHome: boolean = false, avatarName?: string) => {
    setActiveServerId(itemId);
    if (isHome) {
      setLocation('/');
    } else if (!isHome && avatarName) {
      // 아바타 클릭 시 개인 채팅으로 이동
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      setLocation(`/chat?to=avatar_${itemId}&name=${encodeURIComponent(avatarName)}`);
    }
  };

  // 홈 아이템을 추가한 전체 목록
  const allItems = [
    {
      id: 'home',
      name: 'AI아바타세상',
      icon: '🏠',
      avatar: undefined,
      isHome: true,
      description: '홈으로 돌아가기',
      isOnline: false,
      backgroundColor: 'from-purple-500 to-pink-500',
    },
    ...avatarSamples.map(avatar => ({
      id: avatar.id,
      name: avatar.name,
      avatar: avatar.avatar,
      icon: avatar.icon,
      description: avatar.description,
      isOnline: avatar.isOnline,
      backgroundColor: avatar.backgroundColor,
      isHome: false,
    })),
  ];

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-3 space-y-2">
      {allItems.map((item) => (
        <div
          key={item.id}
          className={`relative group cursor-pointer transition-all duration-200 ${
            activeServerId === item.id ? 'transform-none' : 'hover:rounded-2xl'
          }`}
          onClick={() => handleItemClick(item.id, item.isHome, item.name)}
        >
          <div
            className={`w-12 h-12 flex items-center justify-center transition-all duration-200 ${
              activeServerId === item.id
                ? 'rounded-2xl bg-purple-600'
                : 'rounded-full bg-gray-700 hover:bg-purple-600 hover:rounded-2xl'
            }`}
          >
            {item.isHome ? (
              <i className="fas fa-home text-white text-lg"></i>
            ) : item.avatar ? (
              <Avatar className="w-10 h-10">
                <AvatarImage src={item.avatar} alt={item.name} />
                <AvatarFallback className={`bg-gradient-to-br ${item.backgroundColor || 'from-purple-500 to-pink-500'} text-white`}>
                  {item.name[0]}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-2xl">{item.icon}</span>
            )}
          </div>

          {/* 온라인 상태 표시기 */}
          {item.isOnline && !item.isHome && (
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-gray-900 rounded-full"></div>
          )}

          {/* 활성 상태 표시기 */}
          <div
            className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1 bg-white rounded-r-full transition-all duration-200 ${
              activeServerId === item.id ? 'h-10 -translate-x-0' : 'h-0 -translate-x-1'
            }`}
          />

          {/* 호버 툴팁 */}
          <div className="absolute left-16 top-1/2 transform -translate-y-1/2 bg-black text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
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
            {!item.isHome && item.isOnline && (
              <div className="text-xs text-green-400 mt-1 flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                온라인
              </div>
            )}
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black"></div>
          </div>
        </div>
      ))}

      {/* 구분선 */}
      <div className="w-8 h-px bg-gray-600 my-2"></div>

      {/* 아바타 추가 버튼 */}
      <div className="group cursor-pointer">
        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center hover:bg-green-600 hover:rounded-2xl transition-all duration-200">
          <i className="fas fa-plus text-green-400 group-hover:text-white text-lg"></i>
        </div>
        
        {/* 툴팁 */}
        <div className="absolute left-16 top-1/2 transform -translate-y-1/2 bg-black text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
          새 아바타 추가
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black"></div>
        </div>
      </div>
    </div>
  );
};

export default ServerSidebar;
