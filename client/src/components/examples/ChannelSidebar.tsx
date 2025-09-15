import { useState } from 'react';
import ChannelSidebar from '../ChannelSidebar';

const mockCategories = [
  {
    id: "text",
    name: "텍스트 채널",
    isCollapsed: false,
    channels: [
      { id: "general", name: "일반", type: "text" as const },
      { id: "dev", name: "개발 이야기", type: "text" as const, hasNotification: true, notificationCount: 3 },
      { id: "random", name: "자유 게시판", type: "text" as const },
    ]
  },
  {
    id: "voice", 
    name: "음성 채널",
    isCollapsed: false,
    channels: [
      { id: "general-voice", name: "일반", type: "voice" as const },
      { id: "meeting", name: "회의실", type: "voice" as const },
    ]
  },
  {
    id: "private",
    name: "비공개",
    isCollapsed: false,
    channels: [
      { id: "admin", name: "관리자만", type: "private" as const, hasNotification: true },
    ]
  }
];

export default function ChannelSidebarExample() {
  const [activeChannel, setActiveChannel] = useState("general");
  const [categories, setCategories] = useState(mockCategories);

  const handleToggleCategory = (categoryId: string) => {
    setCategories(prev => 
      prev.map(cat => 
        cat.id === categoryId 
          ? { ...cat, isCollapsed: !cat.isCollapsed }
          : cat
      )
    );
  };

  return (
    <div className="h-96">
      <ChannelSidebar
        serverName="개발자 모임"
        categories={categories}
        activeChannelId={activeChannel}
        currentUser={{
          name: "김개발자",
          status: "online"
        }}
        onSelectChannel={setActiveChannel}
        onCreateChannel={(categoryId) => console.log(`${categoryId}에 채널 생성`)}
        onToggleCategory={handleToggleCategory}
      />
    </div>
  );
}