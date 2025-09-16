import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const Navigation = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [location, setLocation] = useLocation();
  const { user, setShowAuthModal } = useAuth();

  useEffect(() => {
    const path = location.split('/')[1] || 'home';
    setActiveTab(path);
  }, [location]);

  const handleTabClick = (tabId: string) => {
    if (!user && (tabId === 'bookings' || tabId === 'chat' || tabId === 'profile')) {
      setShowAuthModal(true);
      return;
    }
    
    setActiveTab(tabId);
    const path = tabId === 'home' ? '/' : 
                 tabId === 'discord' ? '/discord-home' : 
                 `/${tabId}`;
    setLocation(path);
  };

  const tabs = [
    { id: 'home', icon: 'fas fa-home', label: '홈', path: '/' },
    { id: 'discord', icon: 'fas fa-comments', label: '디스코드', path: '/discord-home' },
    { id: 'shop', icon: 'fas fa-shopping-bag', label: '쇼핑몰', path: '/shop' },
    { id: 'bookings', icon: 'fas fa-calendar', label: '예약현황', path: '/bookings' },
    { id: 'profile', icon: 'fas fa-user', label: '마이페이지', path: '/profile' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-3 shadow-lg">
        <div className="flex justify-around max-w-md mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200 ${
                activeTab === tab.id 
                  ? 'text-purple-600 bg-purple-50 transform scale-105' 
                  : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
              }`}
            >
              <i className={`${tab.icon} text-lg mb-1`}></i>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Navigation;
