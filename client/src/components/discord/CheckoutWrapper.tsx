import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import CheckoutPage from '../../pages/checkout';
import CheckoutCompletePage from '../../pages/checkout-complete';
import { useIsMobile } from '../../hooks/use-mobile';
import Header from '../header';
import BottomNavigation from '../bottom-navigation';

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'video' | 'shop';
}

interface CheckoutWrapperProps {
  isComplete?: boolean;
}

const CheckoutWrapper: React.FC<CheckoutWrapperProps> = ({ isComplete = false }) => {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [activeChannel, setActiveChannel] = useState<Channel>({
    id: 'shop-all',
    name: '상점',
    type: 'shop'
  });

  // localStorage에서 이전 채널 정보 가져오기
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
    setLocation('/discord-home');
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#030303]">
      {/* 상단 헤더 */}
      <Header />
      
      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: "40px" }}>
        {/* 왼쪽 사이드바들 */}
        {!isMobile && <ServerSidebar />}
        {!isMobile && <ChannelSidebar activeChannelId={activeChannel.id} onChannelChange={handleChannelChange} />}
        
        {/* 메인 컨텐츠 */}
        <div className="flex-1 flex flex-col overflow-auto">
          {isComplete ? <CheckoutCompletePage /> : <CheckoutPage />}
        </div>
      </div>
      
      {/* 하단 네비게이션 */}
      <BottomNavigation />
    </div>
  );
};

export default CheckoutWrapper;

