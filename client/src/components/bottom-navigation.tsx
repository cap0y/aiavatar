import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const BottomNavigation = () => {
  const [location, setLocation] = useLocation();
  const { user, setShowAuthModal } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return location === '/';
    return location.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0B0B0B]/95 backdrop-blur-md border-t border-gray-200 dark:border-[#1A1A1B] shadow-lg z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          {/* 홈 */}
          <button
            onClick={() => setLocation('/')}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors duration-200 ${
              isActive('/') && location === '/' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            <i className="fas fa-home text-xl mb-1"></i>
            <span className="text-xs font-medium">홈</span>
          </button>

          {/* 쇼핑몰 */}
          <button
            onClick={() => setLocation('/shop')}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors duration-200 ${
              isActive('/shop') || isActive('/product') || isActive('/shop') ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            <i className="fas fa-shopping-bag text-xl mb-1"></i>
            <span className="text-xs font-medium">쇼핑몰</span>
          </button>

          {/* AI아바타 */}
          <button
            onClick={() => {
              if (!user) {
                setShowAuthModal(true);
                return;
              }
              setLocation('/chat?model=mao');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors duration-200 ${
              isActive('/chat') ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            <i className="fas fa-robot text-xl mb-1"></i>
            <span className="text-xs font-medium">AI아바타</span>
          </button>

          {/* 채팅 */}
          <button
            onClick={() => {
              if (!user) {
                setShowAuthModal(true);
                return;
              }
              setLocation('/chat');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors duration-200 ${
              isActive('/chat') ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            <i className="fas fa-comments text-xl mb-1"></i>
            <span className="text-xs font-medium">채팅</span>
          </button>

          {/* 마이페이지 */}
          <button
            onClick={() => {
              if (!user) {
                setShowAuthModal(true);
                return;
              }
              setLocation('/profile');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors duration-200 ${
              isActive('/profile') ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            <i className="fas fa-user text-xl mb-1"></i>
            <span className="text-xs font-medium">마이페이지</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default BottomNavigation;

