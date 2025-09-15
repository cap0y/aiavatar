import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import ServerSidebar from "./ServerSidebar";
import ChannelSidebar from "./ChannelSidebar";
import ChatArea from "./ChatArea";

// Mock data - todo: remove mock functionality
const mockServers = [
  { id: "1", name: "개발자 모임", hasNotification: true },
  { id: "2", name: "게임 친구들" },
  { id: "3", name: "스터디 그룹", hasNotification: true },
  { id: "4", name: "취미 공유" }
];

const mockCategories = [
  {
    id: "text",
    name: "텍스트 채널",
    isCollapsed: false,
    channels: [
      { id: "general", name: "일반", type: "text" as const },
      { id: "dev", name: "개발 이야기", type: "text" as const, hasNotification: true, notificationCount: 3 },
      { id: "random", name: "자유 게시판", type: "text" as const },
      { id: "announcements", name: "공지사항", type: "text" as const },
    ]
  },
  {
    id: "voice", 
    name: "음성 채널",
    isCollapsed: false,
    channels: [
      { id: "general-voice", name: "일반", type: "voice" as const },
      { id: "meeting", name: "회의실", type: "voice" as const },
      { id: "study", name: "스터디룸", type: "voice" as const },
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

const mockMessages = [
  {
    id: "1",
    author: { name: "김개발", role: "관리자" },
    content: "안녕하세요! 새로운 프로젝트에 대해 논의해보겠습니다. 이번에는 React와 TypeScript를 사용한 채팅 애플리케이션을 만들어볼 예정입니다.",
    timestamp: new Date(Date.now() - 15 * 60 * 1000)
  },
  {
    id: "2", 
    author: { name: "이디자인" },
    content: "좋은 아이디어네요! UI 디자인은 어떻게 할까요? 디스코드 스타일로 가는 게 어떨까요?",
    timestamp: new Date(Date.now() - 12 * 60 * 1000)
  },
  {
    id: "3",
    author: { name: "박기획" },
    content: "사용자 피드백을 먼저 분석해보는 게 좋을 것 같아요. 📊\n\n데이터를 기반으로 한 결정이 중요하죠! 어떤 기능들을 우선순위로 둘까요?",
    timestamp: new Date(Date.now() - 8 * 60 * 1000)
  },
  {
    id: "4",
    author: { name: "" },
    content: "최지혜님이 채널에 참여했습니다",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    isSystemMessage: true
  },
  {
    id: "5",
    author: { name: "최지혜" },
    content: "안녕하세요! 늦어서 죄송합니다. 어떤 이야기를 하고 계셨나요? 진행 상황 공유해주실 수 있나요?",
    timestamp: new Date(Date.now() - 3 * 60 * 1000)
  },
  {
    id: "6",
    author: { name: "김개발", role: "관리자" },
    content: "지금까지 기본 UI 구성과 컴포넌트 설계를 완료했습니다. 다음은 실시간 채팅 기능을 구현할 예정이에요.",
    timestamp: new Date(Date.now() - 1 * 60 * 1000)
  }
];

export default function DiscordApp() {
  const [isDark, setIsDark] = useState(true);
  const [activeServer, setActiveServer] = useState("1");
  const [activeChannel, setActiveChannel] = useState("general");
  const [messages, setMessages] = useState(mockMessages);

  // todo: remove mock functionality - Initialize dark mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleSendMessage = (content: string) => {
    const newMessage = {
      id: Date.now().toString(),
      author: { name: "나" }, // todo: remove mock functionality - replace with actual user
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const getCurrentChannel = () => {
    for (const category of mockCategories) {
      const channel = category.channels.find(ch => ch.id === activeChannel);
      if (channel) return channel;
    }
    return mockCategories[0].channels[0];
  };

  const currentChannel = getCurrentChannel();
  const currentServer = mockServers.find(s => s.id === activeServer) || mockServers[0];

  return (
    <div className="h-screen flex bg-background text-foreground">
      {/* Theme toggle - positioned absolutely */}
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsDark(!isDark)}
        className="absolute top-4 right-4 z-50"
        data-testid="button-theme-toggle"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>

      {/* Server sidebar */}
      <ServerSidebar
        servers={mockServers}
        activeServerId={activeServer}
        onSelectServer={setActiveServer}
        onCreateServer={() => console.log('새 서버 만들기')} // todo: remove mock functionality
      />

      {/* Channel sidebar */}
      <ChannelSidebar
        serverName={currentServer.name}
        categories={mockCategories}
        activeChannelId={activeChannel}
        currentUser={{
          name: "김개발자", // todo: remove mock functionality - replace with actual user
          status: "online"
        }}
        onSelectChannel={setActiveChannel}
        onCreateChannel={(categoryId) => console.log(`${categoryId}에 채널 생성`)} // todo: remove mock functionality
        onToggleCategory={(categoryId) => console.log(`${categoryId} 토글`)} // todo: remove mock functionality
      />

      {/* Main chat area */}
      <ChatArea
        channelName={currentChannel.name}
        channelType={currentChannel.type}
        messages={messages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}