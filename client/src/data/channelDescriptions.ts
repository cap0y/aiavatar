// 채널 설명 데이터 타입 정의
export interface ChannelDescription {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  description: string;
  detailDescription: string;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    backgroundGradient: string;
    borderColor: string;
  };
  decorations: {
    topLeft: string;
    bottomRight: string;
    center: string;
  };
  mainCharacter: {
    image: string;
    filter: string;
    animation: string;
  };
  subCharacter: {
    image: string;
    filter: string;
    animation: string;
  };
  badges: Array<{
    icon: string;
    text: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }>;
  features: Array<{
    icon: string;
    text: string;
    color: string;
  }>;
}

// 채널 설명 데이터
export const channelDescriptions: Record<string, ChannelDescription> = {
  general: {
    id: 'general',
    name: '일반',
    title: '일반 채널에 오신 것을 환영합니다!',
    subtitle: 'AI 아바타들과 함께하는 특별한 대화 공간입니다.',
    description: '다양한 개성을 가진 AI 아바타들과 자유롭게 대화하고, 다른 사용자들과도 소통해보세요.',
    detailDescription: '이미지 공유, 실시간 채팅, 그리고 즐거운 커뮤니티 경험을 만끽하실 수 있습니다.',
    theme: {
      primary: 'from-purple-500 to-pink-500',
      secondary: 'from-gray-700/80 via-gray-600/70 to-gray-800/90',
      accent: 'text-yellow-400',
      backgroundGradient: 'bg-gradient-to-br from-gray-700/80 via-gray-600/70 to-gray-800/90',
      borderColor: 'border-gray-500'
    },
    decorations: {
      topLeft: 'bg-purple-500/20',
      bottomRight: 'bg-blue-500/20',
      center: 'bg-pink-500/20'
    },
    mainCharacter: {
      image: '/images/2dmodel/1.png',
      filter: 'drop-shadow(0 0 15px rgba(168, 85, 247, 0.4))',
      animation: 'float 6s ease-in-out infinite'
    },
    subCharacter: {
      image: '/images/2dmodel/3.png',
      filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.3))',
      animation: 'float 4s ease-in-out infinite 1s'
    },
    badges: [
      {
        icon: 'fas fa-users',
        text: '커뮤니티',
        bgColor: 'bg-purple-500/20',
        textColor: 'text-purple-200',
        borderColor: 'border-purple-400/30'
      },
      {
        icon: 'fas fa-comments',
        text: '실시간 채팅',
        bgColor: 'bg-blue-500/20',
        textColor: 'text-blue-200',
        borderColor: 'border-blue-400/30'
      }
    ],
    features: [
      {
        icon: 'fas fa-circle text-green-400 mr-2 text-xs animate-pulse',
        text: '실시간 연결됨',
        color: 'text-green-300'
      },
      {
        icon: 'fas fa-image',
        text: '이미지 공유 가능',
        color: 'text-blue-300'
      },
      {
        icon: 'fas fa-robot',
        text: 'AI 아바타 대화',
        color: 'text-purple-300'
      }
    ]
  },

  random: {
    id: 'random',
    name: '잡담',
    title: '잡담 채널에서 편하게 이야기해요!',
    subtitle: '일상 이야기부터 취미, 관심사까지 자유롭게 나눠보세요!',
    description: '격식 없이 편안한 분위기에서 AI 아바타들과 즐거운 대화를 나누세요.',
    detailDescription: '오늘 있었던 일, 좋아하는 것들, 그리고 재미있는 이야기들을 공유해보세요.',
    theme: {
      primary: 'from-orange-500 to-yellow-500',
      secondary: 'from-gray-700/80 via-gray-600/70 to-gray-800/90',
      accent: 'text-red-400',
      backgroundGradient: 'bg-gradient-to-br from-gray-700/80 via-gray-600/70 to-gray-800/90',
      borderColor: 'border-gray-500'
    },
    decorations: {
      topLeft: 'bg-orange-500/20',
      bottomRight: 'bg-yellow-500/20',
      center: 'bg-red-500/20'
    },
    mainCharacter: {
      image: '/images/2dmodel/2.png',
      filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.4))',
      animation: 'float 5s ease-in-out infinite'
    },
    subCharacter: {
      image: '/images/2dmodel/4.png',
      filter: 'drop-shadow(0 0 10px rgba(234, 179, 8, 0.3))',
      animation: 'float 3s ease-in-out infinite 0.5s'
    },
    badges: [
      {
        icon: 'fas fa-coffee',
        text: '자유로운 대화',
        bgColor: 'bg-orange-500/20',
        textColor: 'text-orange-200',
        borderColor: 'border-orange-400/30'
      },
      {
        icon: 'fas fa-smile',
        text: '재미있는 이야기',
        bgColor: 'bg-yellow-500/20',
        textColor: 'text-yellow-200',
        borderColor: 'border-yellow-400/30'
      }
    ],
    features: [
      {
        icon: 'fas fa-circle text-green-400 mr-2 text-xs animate-pulse',
        text: '편안한 분위기',
        color: 'text-green-300'
      },
      {
        icon: 'fas fa-laugh',
        text: '유머 환영',
        color: 'text-orange-300'
      },
      {
        icon: 'fas fa-star',
        text: '자유 주제',
        color: 'text-yellow-300'
      }
    ]
  },

  help: {
    id: 'help',
    name: '도움말',
    title: '도움이 필요하시면 언제든 말씀하세요!',
    subtitle: 'AI 아바타 사용법부터 기능 설명까지, 궁금한 모든 것을 도와드려요!',
    description: '플랫폼 사용에 어려움이 있거나 새로운 기능에 대해 알고 싶으시다면 언제든 질문해주세요.',
    detailDescription: '친절한 AI 아바타들이 상세하고 이해하기 쉽게 안내해드립니다.',
    theme: {
      primary: 'from-blue-500 to-green-500',
      secondary: 'from-gray-700/80 via-gray-600/70 to-gray-800/90',
      accent: 'text-yellow-400',
      backgroundGradient: 'bg-gradient-to-br from-gray-700/80 via-gray-600/70 to-gray-800/90',
      borderColor: 'border-gray-500'
    },
    decorations: {
      topLeft: 'bg-blue-500/20',
      bottomRight: 'bg-green-500/20',
      center: 'bg-cyan-500/20'
    },
    mainCharacter: {
      image: '/images/2dmodel/6.png',
      filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.4))',
      animation: 'float 7s ease-in-out infinite'
    },
    subCharacter: {
      image: '/images/2dmodel/7.png',
      filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.3))',
      animation: 'float 2.5s ease-in-out infinite 1.5s'
    },
    badges: [
      {
        icon: 'fas fa-life-ring',
        text: '고객 지원',
        bgColor: 'bg-blue-500/20',
        textColor: 'text-blue-200',
        borderColor: 'border-blue-400/30'
      },
      {
        icon: 'fas fa-book',
        text: '가이드',
        bgColor: 'bg-green-500/20',
        textColor: 'text-green-200',
        borderColor: 'border-green-400/30'
      }
    ],
    features: [
      {
        icon: 'fas fa-circle text-green-400 mr-2 text-xs animate-pulse',
        text: '24시간 지원',
        color: 'text-green-300'
      },
      {
        icon: 'fas fa-graduation-cap',
        text: '친절한 안내',
        color: 'text-blue-300'
      },
      {
        icon: 'fas fa-search',
        text: '빠른 해결',
        color: 'text-cyan-300'
      }
    ]
  },

  game: {
    id: 'game',
    name: '게임',
    title: '게임 이야기를 나눠보세요!',
    subtitle: '좋아하는 게임부터 최신 게임 소식까지 함께 이야기해요!',
    description: '다양한 장르의 게임에 대해 자유롭게 토론하고 정보를 공유하세요.',
    detailDescription: '게임 리뷰, 공략, 추천 등 게임과 관련된 모든 이야기를 환영합니다.',
    theme: {
      primary: 'from-indigo-500 to-purple-500',
      secondary: 'from-gray-700/80 via-gray-600/70 to-gray-800/90',
      accent: 'text-cyan-400',
      backgroundGradient: 'bg-gradient-to-br from-gray-700/80 via-gray-600/70 to-gray-800/90',
      borderColor: 'border-gray-500'
    },
    decorations: {
      topLeft: 'bg-indigo-500/20',
      bottomRight: 'bg-purple-500/20',
      center: 'bg-cyan-500/20'
    },
    mainCharacter: {
      image: '/images/2dmodel/5.png',
      filter: 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.4))',
      animation: 'float 4s ease-in-out infinite'
    },
    subCharacter: {
      image: '/images/2dmodel/2.png',
      filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.3))',
      animation: 'float 6s ease-in-out infinite 1.2s'
    },
    badges: [
      {
        icon: 'fas fa-gamepad',
        text: '게임 토론',
        bgColor: 'bg-indigo-500/20',
        textColor: 'text-indigo-200',
        borderColor: 'border-indigo-400/30'
      },
      {
        icon: 'fas fa-trophy',
        text: '게임 공략',
        bgColor: 'bg-purple-500/20',
        textColor: 'text-purple-200',
        borderColor: 'border-purple-400/30'
      }
    ],
    features: [
      {
        icon: 'fas fa-circle text-green-400 mr-2 text-xs animate-pulse',
        text: '실시간 토론',
        color: 'text-green-300'
      },
      {
        icon: 'fas fa-star',
        text: '게임 추천',
        color: 'text-indigo-300'
      },
      {
        icon: 'fas fa-users',
        text: '파티 모집',
        color: 'text-purple-300'
      }
    ]
  }
};

// VTuber 채널 설명
export const vtuberChannelDescription: ChannelDescription = {
  id: 'vtuber',
  name: '아바타-채팅',
  title: 'AI 아바타와 실시간 대화하세요!',
  subtitle: '최첨단 AI 기술로 구현된 생생한 대화 경험을 만나보세요!',
  description: '실시간으로 반응하는 AI 아바타와 자연스러운 대화를 나누세요.',
  detailDescription: '감정 표현, 개성 있는 응답, 그리고 놀라운 대화 능력을 체험해보세요.',
  theme: {
    primary: 'from-purple-500 to-pink-500',
    secondary: 'from-purple-700/80 via-pink-600/70 to-purple-800/90',
    accent: 'text-pink-400',
    backgroundGradient: 'bg-gradient-to-br from-purple-700/80 via-pink-600/70 to-purple-800/90',
    borderColor: 'border-purple-500'
  },
  decorations: {
    topLeft: 'bg-purple-500/30',
    bottomRight: 'bg-pink-500/30',
    center: 'bg-violet-500/30'
  },
  mainCharacter: {
    image: '/images/2dmodel/7.png',
    filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.6))',
    animation: 'float 5s ease-in-out infinite'
  },
  subCharacter: {
    image: '/images/2dmodel/1.png',
    filter: 'drop-shadow(0 0 12px rgba(236, 72, 153, 0.4))',
    animation: 'float 3.5s ease-in-out infinite 0.8s'
  },
  badges: [
    {
      icon: 'fas fa-robot',
      text: 'AI 대화',
      bgColor: 'bg-purple-500/30',
      textColor: 'text-purple-200',
      borderColor: 'border-purple-400/40'
    },
    {
      icon: 'fas fa-bolt',
      text: '실시간',
      bgColor: 'bg-pink-500/30',
      textColor: 'text-pink-200',
      borderColor: 'border-pink-400/40'
    }
  ],
  features: [
    {
      icon: 'fas fa-circle text-green-400 mr-2 text-xs animate-pulse',
      text: '실시간 응답',
      color: 'text-green-300'
    },
    {
      icon: 'fas fa-brain',
      text: '고급 AI',
      color: 'text-purple-300'
    },
    {
      icon: 'fas fa-heart',
      text: '감정 표현',
      color: 'text-pink-300'
    }
  ]
};

// 채널 설명 조회 함수
export const getChannelDescription = (channelId: string, channelType: 'firebase' | 'vtuber' = 'firebase'): ChannelDescription | null => {
  if (channelType === 'vtuber') {
    return vtuberChannelDescription;
  }
  
  return channelDescriptions[channelId] || null;
};

// 모든 채널 설명 조회 함수
export const getAllChannelDescriptions = (): ChannelDescription[] => {
  return Object.values(channelDescriptions);
};
