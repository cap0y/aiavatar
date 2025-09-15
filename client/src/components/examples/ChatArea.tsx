import { useState } from 'react';
import ChatArea from '../ChatArea';

const mockMessages = [
  {
    id: "1",
    author: { name: "김개발", role: "관리자" },
    content: "안녕하세요! 새로운 프로젝트에 대해 논의해보겠습니다.",
    timestamp: new Date(Date.now() - 10 * 60 * 1000)
  },
  {
    id: "2", 
    author: { name: "이디자인" },
    content: "좋은 아이디어네요! UI 디자인은 어떻게 할까요?",
    timestamp: new Date(Date.now() - 8 * 60 * 1000)
  },
  {
    id: "3",
    author: { name: "박기획" },
    content: "사용자 피드백을 먼저 분석해보는 게 좋을 것 같아요. 📊\n\n데이터를 기반으로 한 결정이 중요하죠!",
    timestamp: new Date(Date.now() - 5 * 60 * 1000)
  },
  {
    id: "4",
    author: { name: "" },
    content: "최지혜님이 채널에 참여했습니다",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    isSystemMessage: true
  },
  {
    id: "5",
    author: { name: "최지혜" },
    content: "안녕하세요! 늦어서 죄송합니다. 어떤 이야기를 하고 계셨나요?",
    timestamp: new Date(Date.now() - 1 * 60 * 1000)
  }
];

export default function ChatAreaExample() {
  const [messages, setMessages] = useState(mockMessages);

  const handleSendMessage = (content: string) => {
    const newMessage = {
      id: Date.now().toString(),
      author: { name: "나" },
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  return (
    <div className="w-full h-96">
      <ChatArea
        channelName="일반"
        channelType="text"
        messages={messages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}