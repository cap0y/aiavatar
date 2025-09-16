import React from 'react';
import DiscordLayout from '@/components/discord/DiscordLayout';

const DiscordHome: React.FC = () => {
  return (
    <DiscordLayout>
      {/* MainContent에서 children이 전달되면 기본 채팅 UI 대신 이 컨텐츠가 표시됩니다 */}
    </DiscordLayout>
  );
};

export default DiscordHome;
