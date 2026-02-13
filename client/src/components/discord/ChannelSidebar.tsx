import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { productAPI } from '@/lib/api';
import CreateChannelModal from './CreateChannelModal';
import CreateVoiceChannelModal from './CreateVoiceChannelModal';
import InviteFriendModal from './InviteFriendModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { subscribeToUserChannels, deleteCustomChannel } from '@/firebase';
import PersonalAvatarSidebar from '../personal-avatar/PersonalAvatarSidebar';
import { io, Socket } from 'socket.io-client';

interface ChannelSidebarProps {
  activeChannelId: string;
  onChannelChange: (channel: { id: string; name: string; type: 'text' | 'voice' | 'video' | 'shop' }) => void;
}

interface CustomChannel {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'voice' | 'video';
  isPrivate: boolean;
  ownerId: string;
  ownerName: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
  maxUsers?: number; // 음성/영상 채널용
}

interface ShopCategory {
  id: string | number;
  name: string;
  icon: string;
}

const ChannelSidebar: React.FC<ChannelSidebarProps> = ({ 
  activeChannelId, 
  onChannelChange 
}) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['text', 'voice', 'avatars']);
  // 오디오 컨트롤 상태 추가
  const [micMuted, setMicMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const { user, setShowAuthModal } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // 아바타 모델 목록 상태
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  
  // 커스텀 채널 관련 상태
  const [customChannels, setCustomChannels] = useState<CustomChannel[]>([]);
  const [customVoiceChannels, setCustomVoiceChannels] = useState<CustomChannel[]>([]);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showCreateVoiceChannelModal, setShowCreateVoiceChannelModal] = useState(false);
  const [showInviteFriendModal, setShowInviteFriendModal] = useState(false);
  const [selectedChannelForInvite, setSelectedChannelForInvite] = useState<CustomChannel | null>(null);
  const [channelTypeToCreate, setChannelTypeToCreate] = useState<'text' | 'voice' | 'video'>('text');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<CustomChannel | null>(null);
  const [channelContextMenu, setChannelContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    channel: CustomChannel | null;
  }>({ show: false, x: 0, y: 0, channel: null });

  // 음성/영상 채널 참여자 수 상태
  const [voiceChannelCounts, setVoiceChannelCounts] = useState<{ [channelId: string]: number }>({});

  // 아바타 모델 목록 로드
  useEffect(() => {
    const loadAvailableModels = async () => {
      try {
        console.log("🔍 사용 가능한 모델 목록 불러오는 중...");
        const response = await fetch("/api/model-editor/scan-models");
        const contentType = response.headers.get("content-type");
        
        if (response.ok && contentType?.includes("application/json")) {
          const models = await response.json();
          if (Array.isArray(models) && models.length > 0) {
            const modelNames = models.map((model: any) => model.name);
            setAvailableModels(modelNames);
            console.log(`✅ ${modelNames.length}개 모델 로드 완료:`, modelNames);
          }
        } else {
          console.warn("⚠️ 모델 목록 로드 실패 - API 응답이 올바르지 않음");
        }
      } catch (error) {
        console.error("❌ 모델 목록 로드 중 오류:", error);
        // 기본 모델들로 폴백
        setAvailableModels(["mao", "ichika", "haru", "tororo"]);
      }
    };

    loadAvailableModels();
  }, []);

  // 커스텀 채널 목록 로드 (Firebase)
  useEffect(() => {
    if (!user) {
      setCustomChannels([]);
      setCustomVoiceChannels([]);
      return;
    }

    // Firebase에서 실시간으로 사용자 채널 구독
    
    const unsubscribe = subscribeToUserChannels(user.uid, (channels: CustomChannel[]) => {
      // 텍스트 채널과 음성/영상 채널 분리
      const textChannels = channels.filter(channel => channel.type === 'text');
      const voiceVideoChannels = channels.filter(channel => 
        channel.type === 'voice' || channel.type === 'video'
      );
      
      setCustomChannels(textChannels);
      setCustomVoiceChannels(voiceVideoChannels);
      
      console.log(`📁 Firebase 텍스트 채널 로드: ${textChannels.length}개`);
      console.log(`🎤 Firebase 음성/영상 채널 로드: ${voiceVideoChannels.length}개`);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Socket 연결 및 실시간 채널 참여자 수 업데이트
  useEffect(() => {
    if (!user) return;

    // Socket 연결
    const socket: Socket = io({
      query: {
        userId: user.uid
      }
    });

    // 채널 참여자 수 업데이트 이벤트 구독
    socket.on('voice_channel_counts', (counts: { [channelId: string]: number }) => {
      console.log('📊 채널 참여자 수 업데이트:', counts);
      setVoiceChannelCounts(counts);
    });

    // 연결 성공
    socket.on('connect', () => {
      console.log('✅ Socket 연결 성공 (ChannelSidebar)');
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log('❌ Socket 연결 해제 (ChannelSidebar)');
    });

    // 컴포넌트 언마운트 시 연결 해제
    return () => {
      socket.disconnect();
    };
  }, [user]);

  // 음성/영상 채널 클릭 핸들러
  const handleVoiceVideoChannelClick = (channelId: string, channelName: string, channelType: 'voice' | 'video') => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    onChannelChange({
      id: channelId,
      name: channelName,
      type: channelType
    });
  };

  // 채널 데이터
  const channels = {
    text: [
      {
        id: 'general',
        name: '일반 - feed',
        icon: 'fas fa-hashtag',
        type: 'text',
        unread: 0,
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
      // 상점 채널을 텍스트 채널 밑으로 이동
      {
        id: 'shop-all',
        name: '상점',
        icon: 'fas fa-store',
        type: 'shop',
        unread: 0,
      },
    ],
    voice: [
      {
        id: 'voice-general',
        name: '일반 음성',
        icon: 'fas fa-volume-up',
        type: 'voice',
        users: [],
        maxUsers: 10,
      },
      {
        id: 'video-chat',
        name: '영상 채팅',
        icon: 'fas fa-video',
        type: 'video',
        users: [],
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

  // 상품 카테고리 데이터 가져오기 - 사이드바에서는 사용하지 않으므로 비활성화
  const { data: productCategories = [] } = useQuery<ShopCategory[]>({
    queryKey: ["product-categories"],
    queryFn: async () => {
      // 임시로 빈 배열 반환하여 API 호출 방지
      return [];
    },
    enabled: false, // 쿼리 비활성화
  });

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

  // 마이크 토글 핸들러
  const handleMicToggle = () => {
    setMicMuted(prev => {
      const newState = !prev;
      console.log('🎤 마이크 상태 변경:', newState ? '음소거' : '활성화');
      
      // 여기서 실제 마이크 제어 로직 구현 가능
      if (newState) {
        // 마이크 음소거 로직
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              stream.getAudioTracks().forEach(track => track.enabled = false);
            })
            .catch(console.error);
        }
      } else {
        // 마이크 활성화 로직
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              stream.getAudioTracks().forEach(track => track.enabled = true);
            })
            .catch(console.error);
        }
      }
      
      return newState;
    });
  };

  // 스피커 토글 핸들러
  const handleSpeakerToggle = () => {
    setSpeakerMuted(prev => {
      const newState = !prev;
      console.log('🔊 스피커 상태 변경:', newState ? '음소거' : '활성화');
      
      // 여기서 실제 스피커 제어 로직 구현 가능
      // TTS나 오디오 재생 볼륨 조절 등
      
      return newState;
    });
  };


  // 채널 생성 핸들러 (Firebase 자동 업데이트로 인해 단순화)
  const handleChannelCreated = (newChannel: CustomChannel) => {
    // Firebase 실시간 구독으로 자동 업데이트되므로 상태 직접 변경 불필요
    
    // 새로 생성된 채널로 이동
    onChannelChange({
      id: newChannel.id,
      name: newChannel.name,
      type: newChannel.type as 'text' | 'voice' | 'video' | 'shop'
    });
  };

  // 친구 초대 핸들러
  const handleInviteFriend = (channel: CustomChannel) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    setSelectedChannelForInvite(channel);
    setShowInviteFriendModal(true);
  };

  // 멤버 추가 핸들러 (Firebase 자동 업데이트로 인해 단순화)
  const handleMemberAdded = (friendId: string, friendName: string) => {
    // Firebase 실시간 구독으로 자동 업데이트되므로 상태 직접 변경 불필요
    console.log(`✅ 친구 초대 완료: ${friendName} -> ${selectedChannelForInvite?.name}`);
  };

  // 채널 우클릭 핸들러
  const handleChannelRightClick = (e: React.MouseEvent, channel: CustomChannel) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 소유자만 컨텍스트 메뉴 표시
    if (channel.ownerId === user?.uid) {
      setChannelContextMenu({
        show: true,
        x: e.clientX,
        y: e.clientY,
        channel
      });
    }
  };

  // 채널 공유 링크 복사
  const handleShareChannel = async (channelId: string, channelName: string, channelType: 'text' | 'voice' | 'video' | 'shop') => {
    const shareUrl = `${window.location.origin}/chat?channel=${channelId}&type=${channelType}&name=${encodeURIComponent(channelName)}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "링크 복사 완료!",
        description: `${channelName} 채널 링크가 복사되었습니다.`,
      });
    } catch (error) {
      console.error("링크 복사 실패:", error);
      toast({
        title: "복사 실패",
        description: "링크 복사에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  // 채널 삭제 확인 핸들러
  const handleDeleteChannel = (channel: CustomChannel) => {
    setChannelToDelete(channel);
    setShowDeleteConfirm(true);
    setChannelContextMenu({ show: false, x: 0, y: 0, channel: null });
  };

  // 채널 삭제 실행 (Firebase)
  const executeDeleteChannel = async () => {
    if (!channelToDelete || !user) return;

    try {
      // Firebase에서 채널 삭제
      const result = await deleteCustomChannel(channelToDelete.id, user.uid);
      
      if (!result.success) {
        throw new Error(String(result.error) || "채널 삭제에 실패했습니다.");
      }
      
      // 현재 채널이 삭제된 채널이면 일반 채널로 이동
      if (activeChannelId === channelToDelete.id) {
        onChannelChange({
          id: 'general',
          name: '일반',
          type: 'text'
        });
      }

      console.log(`🗑️ 채널 삭제 완료: ${channelToDelete.name} (${channelToDelete.type})`);
      
      toast({
        title: "채널 삭제 완료",
        description: `"${channelToDelete.name}" 채널이 삭제되었습니다.`,
      });
    } catch (error) {
      console.error('채널 삭제 오류:', error);
      toast({
        title: "삭제 실패",
        description: "채널 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }

    setShowDeleteConfirm(false);
    setChannelToDelete(null);
  };

  // 컨텍스트 메뉴 닫기
  const closeChannelContextMenu = () => {
    setChannelContextMenu({ show: false, x: 0, y: 0, channel: null });
  };

  // 전역 클릭 이벤트로 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (channelContextMenu.show) {
        closeChannelContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [channelContextMenu.show]);

  return (
    <div className="w-60 bg-gray-100 dark:bg-[#0B1416] flex flex-col h-full transition-colors">
      {/* 서버 헤더 */}
      <div className="h-12 border-b border-gray-200 dark:border-gray-900 flex items-center px-4 shadow-sm">
        <h1 className="text-gray-900 dark:text-white font-semibold text-sm truncate">AI아바타세상</h1>
        <Button
          variant="ghost"
          size="sm"
            className="ml-auto w-6 h-6 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800"
        >
          <i className="fas fa-chevron-down text-xs"></i>
        </Button>
      </div>

      {/* 채널 목록 */}
      <div className="flex-1 overflow-y-auto">
        {/* 내 채널 */}
        {user && (
          <div className="mt-4 px-2">
            <div 
              className="flex items-center px-3 py-2 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-900 transition-colors"
              onClick={() => {
                setLocation(`/channel/${user.uid}`);
              }}
            >
              <i className="fas fa-user-circle text-base text-blue-400 mr-3"></i>
              <span className="text-sm text-gray-900 dark:text-gray-100 font-semibold">내 채널</span>
              <i className="fas fa-arrow-right text-xs text-gray-600 dark:text-gray-500 ml-auto"></i>
            </div>
          </div>
        )}

        {/* 텍스트 채널 */}
        <div className="mt-4">
          <div 
            className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-900 group transition-colors"
            onClick={() => toggleCategory('text')}
          >
            <i className={`fas fa-chevron-${expandedCategories.includes('text') ? 'down' : 'right'} text-xs text-gray-600 dark:text-gray-400 mr-2`}></i>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">텍스트 채널</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto w-4 h-4 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  setShowAuthModal(true);
                  return;
                }
                setChannelTypeToCreate('text');
                setShowCreateChannelModal(true);
              }}
              title="새 텍스트 채널 만들기"
            >
              <i className="fas fa-plus text-xs"></i>
            </Button>
          </div>

          {expandedCategories.includes('text') && (
            <div className="mt-1 space-y-0.5">
              {channels.text.map(channel => (
                <div
                  key={channel.id}
                  className={`flex items-center px-2 py-1 mx-2 rounded cursor-pointer group transition-colors ${
                    activeChannelId === channel.id
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                  onClick={() => onChannelChange({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type as 'text' | 'voice' | 'video' | 'shop'
                  })}
                >
                  <i className={`${channel.icon} text-sm text-gray-400 mr-3 w-4`}></i>
                  <span className="text-sm truncate flex-1">{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[16px] text-center mr-2">
                      {channel.unread}
                    </span>
                  )}
                  {/* 공유 아이콘 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-5 h-5 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover:opacity-100 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareChannel(channel.id, channel.name, channel.type as 'text' | 'voice' | 'video' | 'shop');
                    }}
                    title="채널 링크 공유"
                  >
                    <i className="fas fa-share-nodes text-xs"></i>
                  </Button>
                </div>
              ))}
              
              {/* 커스텀 채널 목록 */}
              {customChannels.map(customChannel => (
                <div
                  key={customChannel.id}
                  className={`flex items-center px-2 py-1 mx-2 rounded cursor-pointer group ${
                    activeChannelId === customChannel.id
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-300 hover:bg-gray-600 hover:text-gray-100'
                  }`}
                  onClick={() => onChannelChange({
                    id: customChannel.id,
                    name: customChannel.name,
                    type: 'text'
                  })}
                  onContextMenu={(e) => handleChannelRightClick(e, customChannel)}
                >
                  <i className="fas fa-lock text-sm text-gray-600 dark:text-gray-400 mr-3 w-4" title="비공개 채널"></i>
                  <span className="text-sm truncate flex-1">{customChannel.name}</span>
                  
                  {/* 멤버 수 표시 */}
                  <span className="text-xs text-gray-600 dark:text-gray-500 mr-2">
                    {customChannel.members.length}
                  </span>
                  
                  {/* 공유 및 초대 버튼 */}
                  <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-4 h-4 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareChannel(customChannel.id, customChannel.name, 'text');
                      }}
                      title="채널 링크 공유"
                    >
                      <i className="fas fa-share-nodes text-xs"></i>
                    </Button>
                    {/* 채널 소유자만 친구 초대 가능 */}
                    {customChannel.ownerId === user?.uid && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-4 h-4 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInviteFriend(customChannel);
                        }}
                        title="친구 초대"
                      >
                        <i className="fas fa-user-plus text-xs"></i>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 아바타와 채팅 */}
        <div className="mt-6">
          <div 
            className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-900 group transition-colors"
            onClick={() => toggleCategory('avatars')}
          >
            <i className={`fas fa-chevron-${expandedCategories.includes('avatars') ? 'down' : 'right'} text-xs text-gray-600 dark:text-gray-400 mr-2`}></i>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">아바타와 채팅</span>
            <span className="text-xs text-gray-600 dark:text-gray-500 ml-2">({availableModels.length})</span>
          </div>

          {expandedCategories.includes('avatars') && (
            <div className="mt-1 space-y-0.5">
              {(showAllAvatars ? availableModels : availableModels.slice(0, 12)).map((modelName, index) => (
                <div
                  key={modelName}
                  className={`flex items-center px-2 py-1 mx-2 rounded cursor-pointer group text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors ${
                    activeChannelId === `avatar-${modelName}` ? 'bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-white' : ''
                  }`}
                  onClick={() => {
                    // 해당 캐릭터 전용 채널 생성 및 이동
                    const channelId = `avatar-${modelName}`;
                    const channelName = `${modelName}와 채팅`;
                    
                    console.log(`🎭 ${modelName} 캐릭터 채널 생성:`, channelId);
                    
                    onChannelChange({
                      id: channelId,
                      name: channelName,
                      type: 'text'
                    });
                    
                    // URL에 모델 파라미터 추가해서 해당 모델이 선택되도록 함
                    setTimeout(() => {
                      const currentUrl = new URL(window.location.href);
                      currentUrl.searchParams.set('model', modelName);
                      window.history.pushState({}, '', currentUrl.toString());
                      
                      // 모델 변경 이벤트 디스패치
                      window.dispatchEvent(new CustomEvent('modelChange', { 
                        detail: { modelName } 
                      }));
                    }, 100);
                  }}
                >
                  <Avatar className="w-4 h-4 mr-3">
                    <AvatarFallback className={`text-white text-xs bg-gradient-to-br ${
                      index % 6 === 0 ? 'from-purple-500 to-pink-500' :
                      index % 6 === 1 ? 'from-blue-500 to-cyan-500' :
                      index % 6 === 2 ? 'from-green-500 to-teal-500' :
                      index % 6 === 3 ? 'from-yellow-500 to-orange-500' :
                      index % 6 === 4 ? 'from-red-500 to-rose-500' :
                      'from-indigo-500 to-purple-500'
                    }`}>
                      {modelName[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate flex-1">{modelName}</span>
                  <div className="w-2 h-2 bg-blue-500 rounded-full ml-auto opacity-60"></div>
                </div>
              ))}
              
              {/* 더보기/접기 버튼 */}
              {availableModels.length > 12 && (
                <div 
                  className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer group text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
                  onClick={() => setShowAllAvatars(!showAllAvatars)}
                >
                  <i className={`fas ${showAllAvatars ? 'fa-chevron-up' : 'fa-ellipsis-h'} text-sm mr-3 w-4`}></i>
                  <span className="text-sm truncate">
                    {showAllAvatars 
                      ? '접기' 
                      : `+${availableModels.length - 12}개 더 보기...`
                    }
                  </span>
                </div>
              )}
              
              {/* 로딩 중 표시 */}
              {availableModels.length === 0 && (
                <div className="flex items-center px-2 py-1 mx-2 text-gray-400">
                  <i className="fas fa-spinner fa-spin text-sm mr-3 w-4"></i>
                  <span className="text-sm">아바타 로딩 중...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 내 아바타와 채팅 */}
        <div className="mt-6">
          <div 
            className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-900 group transition-colors"
            onClick={() => toggleCategory('my-avatars')}
          >
            <i className={`fas fa-chevron-${expandedCategories.includes('my-avatars') ? 'down' : 'right'} text-xs text-gray-400 mr-2`}></i>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">내 아바타와 채팅</span>
            <i className="fas fa-star text-xs text-purple-400 ml-2" title="개인 아바타"></i>
          </div>

          {expandedCategories.includes('my-avatars') && (
            <div className="mt-1">
              <PersonalAvatarSidebar
                activeChannelId={activeChannelId}
                onAvatarSelect={(avatar) => {
                  console.log('🎯 ChannelSidebar - onAvatarSelect 호출됨:', {
                    displayName: avatar.displayName,
                    id: avatar.id,
                    modelUrl: avatar.modelUrl,
                    url: avatar.url
                  });
                  
                  // 개인 아바타와 채팅 채널 생성
                  const channelId = `user-avatar-${avatar.id || avatar.displayName}`;
                  const channelName = `${avatar.displayName}와 채팅`;
                  
                  console.log(`💎 개인 아바타 채널 생성:`, channelId);
                  
                  onChannelChange({
                    id: channelId,
                    name: channelName,
                    type: 'text'
                  });
                  
                  // URL에 개인 아바타 파라미터 추가
                  // 500ms 딜레이: 이전 모델의 WebGL 컨텍스트가 완전히 정리되도록 대기
                  setTimeout(() => {
                    const userAvatarModelName = `user_${avatar.displayName}_${Date.now()}`;
                    const avatarModelUrl = avatar.modelUrl || avatar.url || '';
                    
                    console.log('📝 개인 아바타 URL 파라미터 준비:', {
                      userAvatarModelName,
                      avatarModelUrl,
                      hasModelUrl: !!avatarModelUrl
                    });
                    
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.set('userAvatar', avatar.displayName);
                    if (avatarModelUrl) {
                      currentUrl.searchParams.set('avatarUrl', avatarModelUrl);
                    }
                    currentUrl.searchParams.set('selectedModel', userAvatarModelName);
                    currentUrl.searchParams.set('isUserAvatar', 'true');
                    window.history.pushState({}, '', currentUrl.toString());
                    
                    console.log('✅ 개인 아바타 URL 설정 완료:', {
                      userAvatar: avatar.displayName,
                      avatarUrl: avatarModelUrl,
                      selectedModel: userAvatarModelName
                    });
                    
                    // 개인 아바타 변경 이벤트 디스패치 (모델명 포함)
                    console.log('🚀 userAvatarChange 이벤트 디스패치:', {
                      avatar,
                      selectedModel: userAvatarModelName
                    });
                    
                    window.dispatchEvent(new CustomEvent('userAvatarChange', { 
                      detail: { 
                        avatar,
                        selectedModel: userAvatarModelName
                      } 
                    }));
                    
                    console.log('✅ userAvatarChange 이벤트 디스패치 완료');
                  }, 500); // 500ms: WebGL 안정화 대기
                }}
              />
            </div>
          )}
        </div>
        {/* 음성 채널 */}
        <div className="mt-6">
          <div 
            className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-900 group transition-colors"
            onClick={() => toggleCategory('voice')}
          >
            <i className={`fas fa-chevron-${expandedCategories.includes('voice') ? 'down' : 'right'} text-xs text-gray-600 dark:text-gray-400 mr-2`}></i>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">음성/영상 채널</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto w-4 h-4 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  setShowAuthModal(true);
                  return;
                }
                setShowCreateVoiceChannelModal(true);
              }}
              title="새 음성/영상 채널 만들기"
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
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                    onClick={() => handleVoiceVideoChannelClick(
                      channel.id,
                      channel.name,
                      channel.type as 'voice' | 'video'
                    )}
                  >
                    <i className={`${channel.icon} text-sm text-gray-600 dark:text-gray-400 mr-3 w-4`}></i>
                    <span className="text-sm truncate flex-1">{channel.name}</span>
                    <span className="text-xs text-gray-400 mr-2">
                      {voiceChannelCounts[channel.id] || 0}/{channel.maxUsers}
                    </span>
                    {/* 공유 아이콘 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-5 h-5 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareChannel(channel.id, channel.name, channel.type as 'voice' | 'video');
                      }}
                      title="채널 링크 공유"
                    >
                      <i className="fas fa-share-nodes text-xs"></i>
                    </Button>
                  </div>

                  {/* 음성 채널에 연결된 사용자들 */}
                  {(voiceChannelCounts[channel.id] || 0) > 0 && channel.users && channel.users.length > 0 && (
                    <div className="ml-8 mt-1 space-y-1">
                      {channel.users.map((userId, index) => (
                        <div key={`${channel.id}-${userId}-${index}`} className="flex items-center px-2 py-1 text-gray-700 dark:text-gray-300">
                          <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center mr-2">
                            <i className="fas fa-user text-xs"></i>
                          </div>
                          <span className="text-xs">{userId}</span>
                          <div className="ml-auto flex space-x-1">
                            <i className="fas fa-microphone text-xs text-green-400"></i>
                            <i className="fas fa-headphones text-xs text-gray-600 dark:text-gray-400"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* 커스텀 음성/영상 채널 목록 */}
              {customVoiceChannels.map(customChannel => (
                <div key={customChannel.id} className="mx-2">
                  <div
                    className={`flex items-center px-2 py-1 rounded cursor-pointer group ${
                      activeChannelId === customChannel.id
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                    onClick={() => handleVoiceVideoChannelClick(
                      customChannel.id,
                      customChannel.name,
                      customChannel.type as 'voice' | 'video'
                    )}
                    onContextMenu={(e) => handleChannelRightClick(e, customChannel)}
                  >
                    <i className={`fas ${customChannel.type === 'video' ? 'fa-video' : 'fa-volume-up'} text-sm text-gray-600 dark:text-gray-400 mr-3 w-4`}></i>
                    <span className="text-sm truncate flex-1">{customChannel.name}</span>
                    <i className="fas fa-lock text-xs text-gray-600 dark:text-gray-500 mr-2" title="비공개 채널"></i>
                    <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                      {voiceChannelCounts[customChannel.id] !== undefined ? voiceChannelCounts[customChannel.id] : customChannel.members.length}/{customChannel.maxUsers || 10}
                    </span>
                    
                    {/* 공유 및 초대 버튼 */}
                    <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-4 h-4 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareChannel(customChannel.id, customChannel.name, customChannel.type as 'voice' | 'video');
                        }}
                        title="채널 링크 공유"
                      >
                        <i className="fas fa-share-nodes text-xs"></i>
                      </Button>
                      {/* 채널 소유자만 친구 초대 가능 */}
                      {customChannel.ownerId === user?.uid && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-4 h-4 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInviteFriend(customChannel);
                          }}
                          title="친구 초대"
                        >
                          <i className="fas fa-user-plus text-xs"></i>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 상점 카테고리 섹션 제거 */}
      </div>

      {/* 사용자 정보 */}
      <div className="h-14 bg-gray-200 dark:bg-black flex items-center px-2 border-t border-gray-200 dark:border-gray-900 transition-colors">
        {user ? (
          // 로그인한 사용자
          <>
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
                {user?.displayName?.[0] || user?.email?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="ml-2 flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white leading-tight line-clamp-2">
                {user?.displayName || user?.email?.split('@')[0] || '게스트'}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">온라인</div>
            </div>
            <div className="flex space-x-1">
              {/* 마이크 on/off 버튼 */}
              <Button 
                variant="ghost" 
                size="sm" 
                className={`w-8 h-8 p-0 hover:bg-gray-600 transition-colors ${
                  micMuted 
                    ? 'text-red-400 hover:text-red-300 bg-red-900/20' 
                    : 'text-green-400 hover:text-green-300'
                }`}
                onClick={handleMicToggle}
                title={micMuted ? '마이크 켜기' : '마이크 끄기'}
              >
                <i className={`fas fa-${micMuted ? 'microphone-slash' : 'microphone'} text-sm`}></i>
              </Button>
              
              {/* 스피커 on/off 버튼 */}
              <Button 
                variant="ghost" 
                size="sm" 
                className={`w-8 h-8 p-0 hover:bg-gray-600 transition-colors ${
                  speakerMuted 
                    ? 'text-red-400 hover:text-red-300 bg-red-900/20' 
                    : 'text-green-400 hover:text-green-300'
                }`}
                onClick={handleSpeakerToggle}
                title={speakerMuted ? '스피커 켜기' : '스피커 끄기'}
              >
                <i className={`fas fa-${speakerMuted ? 'volume-mute' : 'headphones'} text-sm`}></i>
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
            <div className="ml-2 flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-tight line-clamp-2">
                게스트
              </div>
              <div className="text-xs text-gray-500">오프라인</div>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600 text-xs px-3"
              onClick={() => setShowAuthModal(true)}
            >
              로그인
            </Button>
          </div>
        )}
      </div>

      {/* 모달들 */}
      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
        onChannelCreated={handleChannelCreated}
        channelType={channelTypeToCreate}
      />

      <CreateVoiceChannelModal
        isOpen={showCreateVoiceChannelModal}
        onClose={() => setShowCreateVoiceChannelModal(false)}
        onChannelCreated={handleChannelCreated}
      />

      <InviteFriendModal
        isOpen={showInviteFriendModal}
        onClose={() => {
          setShowInviteFriendModal(false);
          setSelectedChannelForInvite(null);
        }}
        channelId={selectedChannelForInvite?.id || ''}
        channelName={selectedChannelForInvite?.name || ''}
        currentMembers={selectedChannelForInvite?.members || []}
        onMemberAdded={handleMemberAdded}
      />

      {/* 채널 삭제 확인 모달 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">채널 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 채널을 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          
          {channelToDelete && (
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <i className="fas fa-exclamation-triangle text-red-500 text-xl"></i>
                  <div>
                    <p className="font-medium text-red-800">
                      "{channelToDelete.name}" 채널이 영구적으로 삭제됩니다.
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      모든 메시지와 데이터가 사라지며, 복구할 수 없습니다.
                    </p>
                    <p className="text-sm text-red-600">
                      채널 멤버: {channelToDelete.members.length}명
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={executeDeleteChannel}
              className="bg-red-600 hover:bg-red-700"
            >
              <i className="fas fa-trash mr-2"></i>
              삭제하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 채널 우클릭 컨텍스트 메뉴 */}
      {channelContextMenu.show && channelContextMenu.channel && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-2 min-w-[180px]"
          style={{
            left: `${channelContextMenu.x}px`,
            top: `${channelContextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-sm text-gray-300 border-b border-gray-600">
            <i className="fas fa-lock mr-2"></i>
            {channelContextMenu.channel.name}
          </div>
          
          <button
            className="w-full px-3 py-2 text-sm text-left text-blue-400 hover:bg-gray-700 hover:text-blue-300 flex items-center gap-2"
            onClick={() => {
              handleInviteFriend(channelContextMenu.channel!);
              closeChannelContextMenu();
            }}
          >
            <i className="fas fa-user-plus text-xs"></i>
            친구 초대
          </button>
          
          <div className="border-t border-gray-600 my-1"></div>
          
          <button
            className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center gap-2"
            onClick={() => handleDeleteChannel(channelContextMenu.channel!)}
          >
            <i className="fas fa-trash text-xs"></i>
            채널 삭제
          </button>
          
          <button
            className="w-full px-3 py-2 text-sm text-left text-gray-400 hover:bg-gray-700 hover:text-gray-300 flex items-center gap-2"
            onClick={closeChannelContextMenu}
          >
            <i className="fas fa-times text-xs"></i>
            취소
          </button>
        </div>
      )}
    </div>
  );
};

export default ChannelSidebar;
