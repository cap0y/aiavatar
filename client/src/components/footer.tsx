import { Link } from "wouter";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-br from-gray-800 to-gray-900 py-4 px-4 mt-6 mb-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center justify-center md:justify-start">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <i className="fas fa-robot text-white text-sm"></i>
              </div>
              <span className="ml-2 text-lg font-bold text-white">AI아바타세상</span>
            </div>
            <p className="text-xs text-gray-300 mt-1 text-center md:text-left">
              © 2025 AI아바타세상. All rights reserved.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Link href="/chat">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                채팅
              </span>
            </Link>
            <Link href="/">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                홈
              </span>
            </Link>
            <Link href="/privacy">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                개인정보 보호
              </span>
            </Link>
            <Link href="/profile">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                프로필
              </span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
