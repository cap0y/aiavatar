import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import MainContent from './MainContent';
import VoiceVideoCall from './VoiceVideoCall';
import ShopPage from '../../pages/shop';
import ChannelPage from '@/pages/channel';

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'video' | 'shop';
}

interface DiscordLayoutProps {
  children?: React.ReactNode;
}

const DiscordLayout: React.FC<DiscordLayoutProps> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Feed 정렬 상태
  const [feedSortBy, setFeedSortBy] = useState<'latest' | 'popular' | 'subscribed' | 'trending'>(() => {
    const saved = localStorage.getItem('feedSortBy');
    return (saved as any) || 'latest';
  });
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  // URL에 따라 초기 채널 설정
  const getInitialChannel = (): Channel => {
    // URL 파라미터에서 model 값 읽기
    const urlParams = new URLSearchParams(window.location.search);
    const modelParam = urlParams.get('model');
    const channelParam = urlParams.get('channel');
    const typeParam = urlParams.get('type');
    const nameParam = urlParams.get('name');
    
    // 공유 링크를 통한 채널 접속
    if (channelParam && typeParam && nameParam) {
      console.log('🔗 공유 링크로 채널 접속:', { channelParam, typeParam, nameParam });
      return {
        id: channelParam,
        name: decodeURIComponent(nameParam),
        type: typeParam as 'text' | 'voice' | 'video' | 'shop'
      };
    }
    
    // model 파라미터가 있으면 해당 아바타 채널로 설정
    if (modelParam) {
      return {
        id: `avatar-${modelParam}`,
        name: `${modelParam}와 채팅`,
        type: 'text'
      };
    }
    
    // /shop 경로일 때는 상점 채널로 설정
    if (location === '/shop') {
      return {
        id: 'shop-all',
        name: '상점',
        type: 'shop'
      };
    }
    
    // 이전 채널 정보 확인
    const previousChannelJson = localStorage.getItem('previousChannel');
    if (previousChannelJson) {
      try {
        const previousChannel = JSON.parse(previousChannelJson);
        if (previousChannel && previousChannel.id) {
          return previousChannel;
        }
      } catch (e) {
        console.error('이전 채널 정보 파싱 오류:', e);
      }
    }
    
    // 기본 채널
    return {
      id: 'general',
      name: '일반',
      type: 'text'
    };
  };
  
  const [activeChannel, setActiveChannel] = useState<Channel>(getInitialChannel());

  // 모바일에서 채널 변경 시 사이드바 자동 닫기
  const handleChannelChange = (channel: Channel) => {
    console.log('채널 변경:', channel);
    setActiveChannel(channel);
    
    // 모바일에서는 채널 선택 후 사이드바 닫기
    if (isMobile) {
      setSidebarOpen(false);
    }
    
    // 현재 활성화된 채널 정보를 localStorage에 저장
    localStorage.setItem('previousChannel', JSON.stringify({
      id: channel.id,
      name: channel.name,
      type: channel.type
    }));
  };

  // URL 변경 감지 - /shop으로 이동하면 상점 채널 활성화, model 파라미터 변경 시 아바타 채널 변경
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modelParam = urlParams.get('model');
    const channelParam = urlParams.get('channel');
    const typeParam = urlParams.get('type');
    const nameParam = urlParams.get('name');
    
    // 공유 링크를 통한 채널 접속
    if (channelParam && typeParam && nameParam) {
      console.log('🔗 공유 링크로 채널 입장:', { channelParam, typeParam, nameParam });
      setActiveChannel({
        id: channelParam,
        name: decodeURIComponent(nameParam),
        type: typeParam as 'text' | 'voice' | 'video' | 'shop'
      });
      return;
    }
    
    // model 파라미터가 있으면 해당 아바타 채널로 변경
    if (modelParam) {
      setActiveChannel({
        id: `avatar-${modelParam}`,
        name: `${modelParam}와 채팅`,
        type: 'text'
      });
      return;
    }
    
    // /shop으로 이동하면 상점 채널 활성화
    if (location === '/shop') {
      setActiveChannel({
        id: 'shop-all',
        name: '상점',
        type: 'shop'
      });
    }
  }, [location]);

  // 모바일에서 화면 크기 변경 시 사이드바 닫기
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // ESC 키로 사이드바 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    if (isMobile) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMobile, sidebarOpen]);

  // 스와이프 제스처 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || !sidebarOpen) return;
    const touch = e.touches[0];
    const startX = touch.clientX;
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentTouch = moveEvent.touches[0];
      const deltaX = currentTouch.clientX - startX;
      
      // 왼쪽으로 50px 이상 스와이프하면 사이드바 닫기
      if (deltaX < -50) {
        setSidebarOpen(false);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      }
    };
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleProductClick = (productId: string) => {
    console.log('상품 클릭:', productId);
    
    // 현재 활성화된 채널 정보를 localStorage에 저장 (뒤로가기 용)
    localStorage.setItem('previousChannel', JSON.stringify({
      id: activeChannel.id,
      name: activeChannel.name,
      type: activeChannel.type
    }));
    
    // 상품 상세 페이지로 이동 (헤더 + 사이드바 + 네비게이션 모두 포함)
    setLocation(`/product/${productId}`);
  };

  const renderMainContent = () => {
    // URL에서 채널 페이지 확인 (/channel/:userId)
    const channelMatch = location.match(/^\/channel\/(.+)$/);
    if (channelMatch) {
      const userId = channelMatch[1];
      return <ChannelPage userId={userId} />;
    }

    // children이 있으면 children을 우선 렌더링
    if (children) {
      return children;
    }

    switch (activeChannel.type) {
      case 'text':
        // 동적으로 생성된 아바타 채널들 확인 (avatar- 또는 user-avatar- 접두사)
        const isAvatarChannel = activeChannel.id.startsWith('avatar-') || 
                               activeChannel.id.startsWith('user-avatar-') ||
                               activeChannel.name.includes('아바타') || 
                               activeChannel.id.includes('Avatar');
        
        // 커스텀 채널인지 확인 (custom- 접두사)
        const isCustomChannel = activeChannel.id.startsWith('custom-');
        
        // 커스텀 채널은 Firebase 타입으로, 아바타 채널은 VTuber 타입으로 처리
        const channelType = isAvatarChannel ? "vtuber" : "firebase";
        
        return <MainContent currentChannel={activeChannel.id} channelType={channelType} feedSortBy={feedSortBy} />;
      case 'voice':
        return (
          <VoiceVideoCall
            channelId={activeChannel.id}
            channelName={activeChannel.name}
            isVideoCall={false}
            onLeave={() => setActiveChannel({ id: 'general', name: '일반', type: 'text' })}
          />
        );
      case 'video':
        return (
          <VoiceVideoCall
            channelId={activeChannel.id}
            channelName={activeChannel.name}
            isVideoCall={true}
            onLeave={() => setActiveChannel({ id: 'general', name: '일반', type: 'text' })}
          />
        );
      case 'shop':
        return (
          <ShopPage 
            initialCategory={activeChannel.name === '상점' ? '전체' : activeChannel.name} 
            onProductClick={handleProductClick} 
          />
        );
      default:
        return <MainContent currentChannel={activeChannel.id} feedSortBy={feedSortBy} />;
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-[#030303] text-gray-900 dark:text-white transition-colors">
      {/* 데스크톱 사이드바 또는 모바일 오버레이 */}
      {!isMobile ? (
        // 데스크톱 - 기존 동작
        <>
          <ServerSidebar />
          <ChannelSidebar activeChannelId={activeChannel.id} onChannelChange={handleChannelChange} />
        </>
      ) : (
        // 모바일 - 오버레이
        <>
          {/* 백드롭 */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          
          {/* 사이드바 오버레이 */}
          <div 
            className={`fixed left-0 top-0 h-full z-50 flex transition-transform duration-300 ease-in-out shadow-2xl ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            onTouchStart={handleTouchStart}
          >
            <ServerSidebar />
            <ChannelSidebar activeChannelId={activeChannel.id} onChannelChange={handleChannelChange} />
          </div>
        </>
      )}
      
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <div className={`h-12 bg-gray-100/95 dark:bg-[#0B0B0B]/95 backdrop-blur-sm border-b border-gray-200 dark:border-[#1A1A1B] flex items-center justify-between px-4 shadow-sm transition-colors ${
          isMobile ? 'relative z-40' : ''
        }`}>
          <div className="flex items-center gap-2">
            {/* 모바일 햄버거 메뉴 버튼 */}
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 md:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="사이드바 열기"
              >
                <i className="fas fa-bars text-lg"></i>
              </Button>
            )}

            {/* 정렬 드롭다운 (일반 feed 채널일 때만) */}
            {activeChannel.id === 'general' && activeChannel.type === 'text' && (
              <div className="relative">
                <button
                  ref={sortButtonRef}
                  onClick={() => {
                    if (!showSortDropdown && sortButtonRef.current) {
                      const rect = sortButtonRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        top: rect.bottom + 4,
                        left: rect.left
                      });
                    }
                    setShowSortDropdown(!showSortDropdown);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  {feedSortBy === 'latest' && (
                    <>
                      <i className="fas fa-clock"></i>
                      <span>최신순</span>
                    </>
                  )}
                  {feedSortBy === 'popular' && (
                    <>
                      <i className="fas fa-heart"></i>
                      <span>좋아요순</span>
                    </>
                  )}
                  {feedSortBy === 'subscribed' && (
                    <>
                      <i className="fas fa-bell"></i>
                      <span>구독순</span>
                    </>
                  )}
                  {feedSortBy === 'trending' && (
                    <>
                      <i className="fas fa-fire"></i>
                      <span>급상승</span>
                    </>
                  )}
                  <i className="fas fa-chevron-down text-xs ml-1"></i>
                </button>

                {/* Portal을 사용하여 드롭다운을 body에 렌더링 */}
                {showSortDropdown && createPortal(
                  <>
                    {/* 백드롭 */}
                    <div
                      className="fixed inset-0 z-[9998]"
                      onClick={() => setShowSortDropdown(false)}
                    />
                    
                    {/* 드롭다운 메뉴 - fixed 포지션 */}
                    <div 
                      className="fixed w-40 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-[#1A1A1B] rounded-lg shadow-lg z-[9999] py-1"
                      style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                      }}
                    >
                      <button
                        onClick={() => {
                          setFeedSortBy('latest');
                          localStorage.setItem('feedSortBy', 'latest');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] transition-colors ${
                          feedSortBy === 'latest' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <i className="fas fa-clock w-4"></i>
                        <span>최신순</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setFeedSortBy('popular');
                          localStorage.setItem('feedSortBy', 'popular');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] transition-colors ${
                          feedSortBy === 'popular' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <i className="fas fa-heart w-4"></i>
                        <span>좋아요순</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setFeedSortBy('subscribed');
                          localStorage.setItem('feedSortBy', 'subscribed');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] transition-colors ${
                          feedSortBy === 'subscribed' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <i className="fas fa-bell w-4"></i>
                        <span>구독순</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setFeedSortBy('trending');
                          localStorage.setItem('feedSortBy', 'trending');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#1A1A1B] transition-colors ${
                          feedSortBy === 'trending' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <i className="fas fa-fire w-4"></i>
                        <span>급상승</span>
                      </button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            )}
            
            {activeChannel.type === 'text' && <span className="text-gray-600 dark:text-gray-400 mr-2">#</span>}
            {activeChannel.type === 'voice' && <i className="fas fa-volume-up text-gray-600 dark:text-gray-400 mr-2"></i>}
            {activeChannel.type === 'video' && <i className="fas fa-video text-gray-600 dark:text-gray-400 mr-2"></i>}
            {activeChannel.type === 'shop' && <i className="fas fa-store text-gray-600 dark:text-gray-400 mr-2"></i>}
            <h2 className="font-semibold text-gray-900 dark:text-white">{activeChannel.name}</h2>
          </div>
        </div>
        {renderMainContent()}
      </div>
    </div>
  );
};

export default DiscordLayout;
