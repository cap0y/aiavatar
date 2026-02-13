import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ChannelDescription } from '@/data/channelDescriptions';

interface ChannelIntroSectionProps {
  description: ChannelDescription;
  isVtuber?: boolean;
}

const ChannelIntroSection: React.FC<ChannelIntroSectionProps> = ({ 
  description, 
  isVtuber = false 
}) => {
  const { 
    title, 
    subtitle, 
    description: desc, 
    detailDescription, 
    theme, 
    decorations, 
    mainCharacter, 
    subCharacter, 
    badges, 
    features 
  } = description;

  // VTuber 채널의 경우 다른 아이콘 사용
  const titleIcon = isVtuber ? 'fas fa-magic' : 
    description.id === 'general' ? 'fas fa-hashtag' :
    description.id === 'random' ? 'fas fa-laugh' :
    'fas fa-question-circle';

  return (
    <div className={`relative ${theme.backgroundGradient} ${theme.borderColor} border rounded-lg overflow-hidden mb-3`}>
      {/* 배경 장식 요소들 */}
      <div className={`absolute top-4 left-4 sm:left-8 w-16 h-16 sm:w-20 sm:h-20 ${decorations.topLeft} rounded-full blur-xl`}></div>
      <div className={`absolute bottom-6 right-8 sm:right-16 w-20 h-20 sm:w-24 sm:h-24 ${decorations.bottomRight} rounded-full blur-xl`}></div>
      <div className={`absolute top-1/2 left-1/4 w-12 h-12 sm:w-16 sm:h-16 ${decorations.center} rounded-full blur-lg`}></div>
      
      {/* 메인 캐릭터 - 오른쪽 배치 (모바일에서도 표시) */}
      <div className="absolute right-2 sm:right-6 top-1/2 transform -translate-y-1/2 z-20">
        <div className="relative">
          <div className={`absolute inset-0 bg-gradient-to-br ${
            isVtuber ? 'from-purple-400/30 to-pink-400/30' :
            description.id === 'general' ? 'from-purple-400/20 to-pink-400/20' :
            description.id === 'random' ? 'from-orange-400/20 to-yellow-400/20' :
            'from-blue-400/20 to-green-400/20'
          } rounded-full blur-2xl scale-150 animate-pulse`}></div>
          <img 
            src={mainCharacter.image}
            alt="AI Avatar Character" 
            className={`${
              isVtuber 
                ? 'w-20 h-24 sm:w-28 sm:h-32 lg:w-36 lg:h-44' 
                : 'w-16 h-20 sm:w-24 sm:h-28 lg:w-32 lg:h-40'
            } object-contain relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-300`}
            style={{
              filter: mainCharacter.filter,
              animation: mainCharacter.animation
            }}
          />
        </div>
      </div>
      
      {/* 서브 캐릭터 - 왼쪽 하단 (모바일에서도 표시) */}
      <div className={`absolute left-2 sm:left-6 bottom-4 z-15 ${isVtuber ? 'opacity-80' : 'opacity-70'}`}>
        <div className="relative">
          <img 
            src={subCharacter.image}
            alt="AI Avatar Character" 
            className={`${
              isVtuber 
                ? 'w-12 h-14 sm:w-16 sm:h-20 lg:w-24 lg:h-28' 
                : 'w-10 h-12 sm:w-14 sm:h-16 lg:w-20 lg:h-24'
            } object-contain drop-shadow-lg hover:scale-110 transition-transform duration-300`}
            style={{
              filter: subCharacter.filter,
              animation: subCharacter.animation
            }}
          />
        </div>
      </div>

      {/* 컨텐츠 영역 - 단일 그룹 섹션 */}
      <div className={`relative z-10 px-3 sm:px-6 py-6 sm:py-8 ${isVtuber ? 'bg-black/30' : 'bg-black/20'} backdrop-blur-sm rounded-2xl border ${
        isVtuber ? 'border-purple-300/20' : 'border-white/10'
      }`}>
        <div className="flex items-center mb-4">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br ${theme.primary} rounded-full flex items-center justify-center mr-3 sm:mr-4`}>
            <i className={`${titleIcon} text-white text-sm sm:text-lg`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 pr-16 sm:pr-20">{title}</h3>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {badges.map((badge, index) => (
                <Badge 
                  key={index}
                  variant="default" 
                  className={`${badge.bgColor} ${badge.textColor} ${badge.borderColor} text-xs`}
                >
                  <i className={`${badge.icon} mr-1`}></i>
                  {badge.text}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        
        <div className={`space-y-3 ${isVtuber ? 'text-gray-100' : 'text-gray-200'} pr-16 sm:pr-20`}>
          <p className="text-base sm:text-lg leading-relaxed">
            <i className={`fas fa-${isVtuber ? 'wand-magic-sparkles' : 'sparkles'} ${theme.accent} mr-2`}></i>
            {subtitle}
          </p>
          <p className="text-sm leading-relaxed opacity-90">
            {desc} {detailDescription}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-2">
            {features.map((feature, index) => (
              <div key={index} className={`flex items-center text-xs sm:text-sm ${feature.color}`}>
                <i className={`${feature.icon} mr-1 sm:mr-2`}></i>
                {feature.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelIntroSection;
