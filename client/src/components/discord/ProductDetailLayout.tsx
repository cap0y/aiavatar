import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import ProductDetailPage from '../../pages/product-detail';
import { useIsMobile } from '../../hooks/use-mobile';
import Header from '../header';
import BottomNavigation from '../bottom-navigation';

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'video' | 'shop';
}

interface ProductDetailLayoutProps {
  productId: string;
}

const ProductDetailLayout: React.FC<ProductDetailLayoutProps> = ({ productId }) => {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [activeChannel, setActiveChannel] = useState<Channel>({
    id: 'shop-all',
    name: '상점',
    type: 'shop'
  });

  // 컴포넌트 마운트 시 productId가 비어있으면 Discord 홈으로 리디렉션
  useEffect(() => {
    if (!productId) {
      setLocation('/discord-home');
    }
    
    // localStorage에서 이전 채널 정보 가져오기
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
  }, [productId, setLocation]);

  const handleChannelChange = (channel: Channel) => {
    console.log('채널 변경:', channel);
    setActiveChannel(channel);
    
    // 상점 채널로 변경된 경우 상점 페이지로 이동
    if (channel.type === 'shop') {
      setLocation('/discord-home');
    } else if (channel.type === 'text' || channel.type === 'voice' || channel.type === 'video') {
      setLocation('/discord-home');
    }
  };
  
  // 뒤로 가기 처리 함수
  const handleGoBack = () => {
    // localStorage에서 이전 채널 정보 가져오기
    const previousChannelJson = localStorage.getItem('previousChannel');
    
    if (previousChannelJson) {
      try {
        const previousChannel = JSON.parse(previousChannelJson);
        if (previousChannel && previousChannel.id) {
          // 이전 채널 정보가 있으면 해당 채널로 이동
          setLocation('/discord-home');
          return;
        }
      } catch (e) {
        console.error('이전 채널 정보 파싱 오류:', e);
      }
    }
    
    // 이전 채널 정보가 없으면 기본적으로 Discord 홈으로 이동
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
          <div className="h-12 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 shadow-sm bg-white dark:bg-[#0B0B0B]">
            <div className="flex items-center">
              <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mr-3" onClick={handleGoBack}>
                <i className="fas fa-arrow-left mr-1"></i>
                <span className="text-sm">돌아가기</span>
              </button>
              <i className="fas fa-store text-gray-600 dark:text-gray-400 mr-2"></i>
              <h2 className="font-semibold text-gray-900 dark:text-white">상품 상세</h2>
            </div>
            <div className="ml-auto flex items-center space-x-4">
              <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <i className="fas fa-search"></i>
              </button>
              <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <i className="fas fa-inbox"></i>
              </button>
              <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <i className="fas fa-question-circle"></i>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white dark:bg-[#030303]">
            <ProductDetailPage productId={productId} />
          </div>
        </div>
      </div>
      
      {/* 하단 네비게이션 */}
      <BottomNavigation />
    </div>
  );
};

export default ProductDetailLayout; 