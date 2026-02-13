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
              <span className="ml-2 text-lg font-bold text-white">AI아바타세상 - 사업자등록증 257-37-00989 정보통신업 응용 소프트웨어 개발 및 공급업</span>
            </div>
            <p className="text-xs text-gray-300 mt-1 text-center md:text-left">
            통신판매업 신고: 2024-경남진주-0419 대표자:김영철 상호:디컴소프트 © 2025 AI아바타세상. All rights reserved.
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
            <Link href="/help-center">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                FAQ
              </span>
            </Link>
            <Link href="/profile">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                프로필
              </span>
            </Link>
            <Link href="/privacy-policy">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                개인정보처리방침
              </span>
            </Link>
            <Link href="/terms">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                이용약관
              </span>
            </Link>
            <Link href="/cookie-policy">
              <span className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">
                쿠키정책
              </span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
