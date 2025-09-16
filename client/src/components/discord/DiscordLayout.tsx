import React, { useState } from 'react';
import MainContent from './MainContent';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import VoiceChannel from './VoiceChannel';

interface DiscordLayoutProps {
  children?: React.ReactNode;
}

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'video';
}

const DiscordLayout: React.FC<DiscordLayoutProps> = ({ children }) => {
  const [activeChannel, setActiveChannel] = useState<Channel>({ 
    id: 'general', 
    name: '일반', 
    type: 'text' 
  });

  const handleChannelChange = (channel: Channel) => {
    setActiveChannel(channel);
  };

  const renderMainContent = () => {
    if (children) {
      return <MainContent>{children}</MainContent>;
    }

    if (activeChannel.type === 'voice' || activeChannel.type === 'video') {
      return (
        <VoiceChannel
          channelId={activeChannel.id}
          channelName={activeChannel.name}
          channelType={activeChannel.type}
        />
      );
    }

    // 채널 타입에 따라 다른 채팅 시스템 사용
    const chatType = activeChannel.id === 'avatar-chat' ? 'vtuber' : 'firebase';
    
    return (
      <MainContent 
        currentChannel={activeChannel.id}
        channelType={chatType}
      />
    );
  };

  return (
    <div className="flex h-screen bg-gray-800 text-white">
      {/* 서버 목록 - 매우 좁은 왼쪽 사이드바 */}
      <ServerSidebar />
      
      {/* 채널 목록 - 중간 사이드바 */}
      <ChannelSidebar 
        activeChannelId={activeChannel.id}
        onChannelChange={handleChannelChange}
      />
      
      {/* 메인 컨텐츠 영역 */}
      {renderMainContent()}
    </div>
  );
};

export default DiscordLayout;
