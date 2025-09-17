import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import MainContent from './MainContent';
import VoiceChannel from './VoiceChannel';
import ShopPage from '../../pages/shop';

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'video' | 'shop';
}

const DiscordLayout: React.FC = () => {
  const [, setLocation] = useLocation();
  const [activeChannel, setActiveChannel] = useState<Channel>({
    id: 'general',
    name: '일반',
    type: 'text'
  });

  // 컴포넌트 마운트 시 localStorage에서 이전 채널 정보 가져오기
  useEffect(() => {
    const previousChannelJson = localStorage.getItem('previousChannel');
    if (previousChannelJson) {
      try {
        const previousChannel = JSON.parse(previousChannelJson);
        if (previousChannel && previousChannel.id) {
          setActiveChannel(previousChannel);
        }
      } catch (e) {
        console.error('이전 채널 정보 파싱 오류:', e);
      }
    }
  }, []);

  const handleChannelChange = (channel: Channel) => {
    console.log('채널 변경:', channel);
    setActiveChannel(channel);
    
    // 현재 활성화된 채널 정보를 localStorage에 저장
    localStorage.setItem('previousChannel', JSON.stringify({
      id: channel.id,
      name: channel.name,
      type: channel.type
    }));
  };

  const handleProductClick = (productId: string) => {
    console.log('상품 클릭:', productId);
    
    // 현재 활성화된 채널 정보를 localStorage에 저장 (뒤로가기 용)
    localStorage.setItem('previousChannel', JSON.stringify({
      id: activeChannel.id,
      name: activeChannel.name,
      type: activeChannel.type
    }));
    
    // 상품 상세 페이지로 이동 (Discord 레이아웃 내에서)
    setLocation(`/product/${productId}`);
  };

  const renderMainContent = () => {
    // 아바타-채팅 채널은 특별 처리
    if (activeChannel.id === 'avatar-chat') {
      return <MainContent currentChannel={activeChannel.id} channelType="vtuber" />;
    }

    switch (activeChannel.type) {
      case 'text':
        return <MainContent currentChannel={activeChannel.id} />;
      case 'voice':
      case 'video':
        return (
          <VoiceChannel 
            channelId={activeChannel.id} 
            channelName={activeChannel.name} 
            channelType={activeChannel.type}
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
        return <MainContent currentChannel={activeChannel.id} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <ServerSidebar />
      <ChannelSidebar activeChannelId={activeChannel.id} onChannelChange={handleChannelChange} />
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-gray-700 flex items-center px-4 shadow-sm">
          <div className="flex items-center">
            {activeChannel.type === 'text' && <span className="text-gray-400 mr-2">#</span>}
            {activeChannel.type === 'voice' && <i className="fas fa-volume-up text-gray-400 mr-2"></i>}
            {activeChannel.type === 'video' && <i className="fas fa-video text-gray-400 mr-2"></i>}
            {activeChannel.type === 'shop' && <i className="fas fa-store text-gray-400 mr-2"></i>}
            <h2 className="font-semibold text-white">{activeChannel.name}</h2>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            {activeChannel.type === 'text' && (
              <>
                <button className="text-gray-400 hover:text-white">
                  <i className="fas fa-bell"></i>
                </button>
                <button className="text-gray-400 hover:text-white">
                  <i className="fas fa-thumbtack"></i>
                </button>
                <button className="text-gray-400 hover:text-white">
                  <i className="fas fa-user-plus"></i>
                </button>
              </>
            )}
            <button className="text-gray-400 hover:text-white">
              <i className="fas fa-search"></i>
            </button>
            <button className="text-gray-400 hover:text-white">
              <i className="fas fa-inbox"></i>
            </button>
            <button className="text-gray-400 hover:text-white">
              <i className="fas fa-question-circle"></i>
            </button>
          </div>
        </div>
        {renderMainContent()}
      </div>
    </div>
  );
};

export default DiscordLayout;
