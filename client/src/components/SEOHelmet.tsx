import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
}

const DEFAULT_SEO = {
  title: 'AI 아바타세상 - VTuber & 3D 아바타 크리에이터 플랫폼',
  description: 'AI 기반 VTuber, 3D 아바타, Live2D 모델 제작 전문 크리에이터를 만나보세요. 커스텀 아바타 제작부터 음성 합성까지, 모든 AI 창작 서비스를 한 곳에서!',
  keywords: 'AI 아바타, VTuber, 3D 아바타, Live2D, 캐릭터 제작, AI 크리에이터, 음성 합성, 아바타 커스터마이징',
  image: '/images/og-image.jpg',
  url: 'https://aiavatar.decomsoft.com',
  type: 'website' as const,
};

export default function SEOHelmet({
  title = DEFAULT_SEO.title,
  description = DEFAULT_SEO.description,
  keywords = DEFAULT_SEO.keywords,
  image = DEFAULT_SEO.image,
  url = DEFAULT_SEO.url,
  type = DEFAULT_SEO.type,
}: SEOProps) {
  const [location] = useLocation();

  useEffect(() => {
    // 페이지 타이틀 설정
    document.title = title;

    // 메타 태그 업데이트 함수
    const updateMetaTag = (name: string, content: string, property = false) => {
      const attribute = property ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // 기본 메타 태그
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);

    // Open Graph 태그 (Facebook, Discord 등)
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', `${url}${image}`, true);
    updateMetaTag('og:url', `${url}${location}`, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', 'AI 아바타세상', true);
    updateMetaTag('og:locale', 'ko_KR', true);

    // Twitter Card 태그
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', `${url}${image}`);

    // 추가 SEO 태그
    updateMetaTag('robots', 'index, follow');
    updateMetaTag('googlebot', 'index, follow');
    updateMetaTag('author', 'AI 아바타세상');

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${url}${location}`;

  }, [title, description, keywords, image, url, type, location]);

  return null; // 이 컴포넌트는 렌더링하지 않음
}

// 페이지별 SEO 설정 헬퍼
export const pageSEO = {
  home: {
    title: 'AI 아바타세상 - VTuber & 3D 아바타 크리에이터 플랫폼',
    description: 'AI 기반 VTuber, 3D 아바타, Live2D 모델 제작 전문 크리에이터를 만나보세요. 커스텀 아바타 제작부터 음성 합성까지!',
    keywords: 'AI 아바타, VTuber, 3D 아바타, Live2D, 캐릭터 제작',
  },
  
  shop: {
    title: '마켓플레이스 - AI 아바타 & 디지털 콘텐츠 | AI 아바타세상',
    description: '완성된 Live2D 모델, 3D 아바타, 음성 팩, 이모션 팩을 구매하세요. 즉시 다운로드 가능한 고품질 디지털 상품!',
    keywords: 'Live2D 모델, 3D 아바타 구매, 음성 팩, 이모션 팩, 디지털 상품',
  },
  
  chat: {
    title: 'AI 크리에이터 채팅 - 실시간 상담 | AI 아바타세상',
    description: 'AI 크리에이터와 실시간 채팅으로 작업을 상담하세요. 1:1 메시징, 파일 공유, 프로젝트 논의가 가능합니다.',
    keywords: 'AI 크리에이터 상담, 실시간 채팅, 작업 의뢰, 1:1 메시지',
  },
  
  avatarStudio: {
    title: '아바타 스튜디오 - Live2D 모델 테스트 | AI 아바타세상',
    description: 'Live2D 아바타 모델을 실시간으로 테스트하고 커스터마이징하세요. 표정, 포즈, 애니메이션을 미리 확인!',
    keywords: 'Live2D 테스트, 아바타 커스터마이징, 모델 미리보기, 애니메이션',
  },
  
  bookings: {
    title: '의뢰 관리 - 작업 진행 현황 | AI 아바타세상',
    description: '크리에이터와의 작업 일정과 진행 상황을 관리하세요. 예약부터 완료까지 한눈에!',
    keywords: '작업 의뢰, 프로젝트 관리, 예약 현황, 진행 상태',
  },
  
  profile: {
    title: '내 프로필 - 계정 관리 | AI 아바타세상',
    description: '프로필 정보, 주문 내역, 즐겨찾기, 리뷰를 관리하세요.',
    keywords: '프로필 관리, 계정 설정, 주문 내역, 즐겨찾기',
  },
  
  support: {
    title: '고객 지원 - FAQ & 문의하기 | AI 아바타세상',
    description: '자주 묻는 질문과 1:1 문의를 통해 도움을 받으세요. 친절한 고객 지원팀이 응답합니다.',
    keywords: '고객 지원, FAQ, 문의하기, 도움말',
  },
  
  privacy: {
    title: '개인정보 처리방침 | AI 아바타세상',
    description: 'AI 아바타세상의 개인정보 처리방침을 확인하세요.',
    keywords: '개인정보, 처리방침, 프라이버시, 정보보호',
  },
};

