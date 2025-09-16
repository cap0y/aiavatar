import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { avatarSamples } from '@/data/avatarSamples';
import { useLocation } from 'wouter';

interface ChannelSidebarProps {
  activeChannelId: string;
  onChannelChange: (channel: { id: string; name: string; type: 'text' | 'voice' | 'video' }) => void;
}

const ChannelSidebar: React.FC<ChannelSidebarProps> = ({ 
  activeChannelId, 
  onChannelChange 
}) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['text', 'voice', 'dm']);
  const { user, setShowAuthModal } = useAuth();
  const [, setLocation] = useLocation();

  // 채널 데이터
  const channels = {
    text: [
      {
        id: 'general',
        name: '일반',
        icon: 'fas fa-hashtag',
        type: 'text',
        unread: 0,
      },
      {
        id: 'avatar-chat',
        name: '아바타-채팅',
        icon: 'fas fa-hashtag',
        type: 'text',
        unread: 3,
      },
      {
        id: 'random',
        name: '잡담',
        icon: 'fas fa-hashtag',
        type: 'text',
        unread: 0,
      },
      {
        id: 'help',
        name: '도움말',
        icon: 'fas fa-hashtag',
        type: 'text',
        unread: 0,
      },
    ],
    voice: [
      {
        id: 'voice-general',
        name: '일반 음성',
        icon: 'fas fa-volume-up',
        type: 'voice',
        users: ['user1', 'user2'],
        maxUsers: 10,
      },
      {
        id: 'voice-avatar',
        name: '아바타 음성',
        icon: 'fas fa-volume-up',
        type: 'voice',
        users: [],
        maxUsers: 5,
      },
      {
        id: 'video-chat',
        name: '영상 채팅',
        icon: 'fas fa-video',
        type: 'video',
        users: ['user3'],
        maxUsers: 8,
      },
    ],
  };

  const onlineMembers = [
    {
      id: 'user1',
      name: '사용자1',
      status: 'online',
      activity: '아바타 채팅 중',
    },
    {
      id: 'user2', 
      name: '사용자2',
      status: 'away',
      activity: '자리 비움',
    },
    {
      id: 'user3',
      name: '사용자3',
      status: 'dnd',
      activity: '방해금지',
    },
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="w-60 bg-gray-700 flex flex-col h-full">
      {/* 서버 헤더 */}
      <div className="h-12 border-b border-gray-600 flex items-center px-4 shadow-sm">
        <h1 className="text-white font-semibold text-sm truncate">AI아바타세상</h1>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto w-6 h-6 p-0 text-gray-400 hover:text-white hover:bg-gray-600"
        >
          <i className="fas fa-chevron-down text-xs"></i>
        </Button>
      </div>

      {/* 채널 목록 */}
      <div className="flex-1 overflow-y-auto">
        {/* 텍스트 채널 */}
        <div className="mt-4">
          <div 
            className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer hover:bg-gray-600 group"
            onClick={() => toggleCategory('text')}
          >
            <i className={`fas fa-chevron-${expandedCategories.includes('text') ? 'down' : 'right'} text-xs text-gray-400 mr-2`}></i>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">텍스트 채널</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto w-4 h-4 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
            >
              <i className="fas fa-plus text-xs"></i>
            </Button>
          </div>

          {expandedCategories.includes('text') && (
            <div className="mt-1 space-y-0.5">
              {channels.text.map(channel => (
                <div
                  key={channel.id}
                  className={`flex items-center px-2 py-1 mx-2 rounded cursor-pointer group ${
                    activeChannelId === channel.id
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-300 hover:bg-gray-600 hover:text-gray-100'
                  }`}
                  onClick={() => onChannelChange({
                    id: channel.id,
                    name: channel.name,
                    type: 'text'
                  })}
                >
                  <i className={`${channel.icon} text-sm text-gray-400 mr-3 w-4`}></i>
                  <span className="text-sm truncate">{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                      {channel.unread}
                    </span>
                  )}
                  <div className="ml-auto opacity-0 group-hover:opacity-100 flex space-x-1">
                    <Button variant="ghost" size="sm" className="w-4 h-4 p-0 text-gray-400 hover:text-white">
                      <i className="fas fa-user-plus text-xs"></i>
                    </Button>
                    <Button variant="ghost" size="sm" className="w-4 h-4 p-0 text-gray-400 hover:text-white">
                      <i className="fas fa-cog text-xs"></i>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 다이렉트 메시지 */}
        <div className="mt-6">
          <div 
            className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer hover:bg-gray-600 group"
            onClick={() => toggleCategory('dm')}
          >
            <i className={`fas fa-chevron-${expandedCategories.includes('dm') ? 'down' : 'right'} text-xs text-gray-400 mr-2`}></i>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">아바타와 채팅</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto w-4 h-4 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
            >
              <i className="fas fa-plus text-xs"></i>
            </Button>
          </div>

          {expandedCategories.includes('dm') && (
            <div className="mt-1 space-y-0.5">
              {avatarSamples.slice(0, 6).map(avatar => ( // 상위 6개 아바타만 표시
                <div
                  key={avatar.id}
                  className={`flex items-center px-2 py-1 mx-2 rounded cursor-pointer group text-gray-300 hover:bg-gray-600 hover:text-gray-100`}
                  onClick={() => {
                    if (!user) {
                      setShowAuthModal(true);
                      return;
                    }
                    setLocation(`/chat?to=avatar_${avatar.id}&name=${encodeURIComponent(avatar.name)}`);
                  }}
                >
                  <Avatar className="w-4 h-4 mr-3">
                    <AvatarImage src={avatar.avatar} />
                    <AvatarFallback className={`text-white text-xs bg-gradient-to-br ${avatar.backgroundColor || 'from-purple-500 to-pink-500'}`}>
                      {avatar.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate flex-1">{avatar.name}</span>
                  {avatar.isOnline && (
                    <div className="w-2 h-2 bg-green-500 rounded-full ml-auto"></div>
                  )}
                  {!user && (
                    <i className="fas fa-lock text-xs text-gray-500 ml-2"></i>
                  )}
                </div>
              ))}
              
              {/* 더 많은 아바타 보기 */}
              <div
                className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer group text-gray-400 hover:bg-gray-600 hover:text-gray-300"
                onClick={() => {
                  // 여기에 아바타 목록 전체 보기 기능 추가 가능
                  console.log("더 많은 아바타 보기");
                }}
              >
                <i className="fas fa-ellipsis-h text-sm mr-3 w-4"></i>
                <span className="text-sm truncate">더 많은 아바타...</span>
              </div>
            </div>
          )}
        </div>

        {/* 음성 채널 */}
        <div className="mt-6">
          <div 
            className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer hover:bg-gray-600 group"
            onClick={() => toggleCategory('voice')}
          >
            <i className={`fas fa-chevron-${expandedCategories.includes('voice') ? 'down' : 'right'} text-xs text-gray-400 mr-2`}></i>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">음성 채널</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto w-4 h-4 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
            >
              <i className="fas fa-plus text-xs"></i>
            </Button>
          </div>

          {expandedCategories.includes('voice') && (
            <div className="mt-1 space-y-0.5">
              {channels.voice.map(channel => (
                <div key={channel.id} className="mx-2">
                  <div
                    className={`flex items-center px-2 py-1 rounded cursor-pointer group ${
                      activeChannelId === channel.id
                        ? 'bg-gray-600 text-white'
                        : 'text-gray-300 hover:bg-gray-600 hover:text-gray-100'
                    }`}
                    onClick={() => onChannelChange({
                      id: channel.id,
                      name: channel.name,
                      type: channel.type as 'voice' | 'video'
                    })}
                  >
                    <i className={`${channel.icon} text-sm text-gray-400 mr-3 w-4`}></i>
                    <span className="text-sm truncate flex-1">{channel.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {channel.users.length}/{channel.maxUsers}
                    </span>
                  </div>

                  {/* 음성 채널에 연결된 사용자들 */}
                  {channel.users.length > 0 && (
                    <div className="ml-8 mt-1 space-y-1">
                      {channel.users.map((userId, index) => (
                        <div key={`${channel.id}-${userId}-${index}`} className="flex items-center px-2 py-1 text-gray-300">
                          <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center mr-2">
                            <i className="fas fa-user text-xs"></i>
                          </div>
                          <span className="text-xs">{userId}</span>
                          <div className="ml-auto flex space-x-1">
                            <i className="fas fa-microphone text-xs text-green-400"></i>
                            <i className="fas fa-headphones text-xs text-gray-400"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 사용자 정보 */}
      <div className="h-14 bg-gray-800 flex items-center px-2">
        {user ? (
          // 로그인한 사용자
          <>
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
                {user?.displayName?.[0] || user?.email?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="ml-2 flex-1">
              <div className="text-sm font-medium text-white truncate">
                {user?.displayName || user?.email?.split('@')[0] || '게스트'}
              </div>
              <div className="text-xs text-gray-400">온라인</div>
            </div>
            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-white hover:bg-gray-600">
                <i className="fas fa-microphone text-sm"></i>
              </Button>
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-white hover:bg-gray-600">
                <i className="fas fa-headphones text-sm"></i>
              </Button>
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-white hover:bg-gray-600">
                <i className="fas fa-cog text-sm"></i>
              </Button>
            </div>
          </>
        ) : (
          // 로그인하지 않은 사용자
          <div className="flex items-center w-full">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white text-sm">
                <i className="fas fa-user"></i>
              </AvatarFallback>
            </Avatar>
            <div className="ml-2 flex-1">
              <div className="text-sm font-medium text-gray-400">
                게스트
              </div>
              <div className="text-xs text-gray-500">오프라인</div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600 text-xs px-3"
              onClick={() => setShowAuthModal(true)}
            >
              로그인
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelSidebar;
