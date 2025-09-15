import { Hash, Users, Pin, Search, Bell, Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import Message from "./Message";
import MessageInput from "./MessageInput";

interface ChatMessage {
  id: string;
  author: {
    name: string;
    avatar?: string;
    role?: string;
  };
  content: string;
  timestamp: Date;
  isSystemMessage?: boolean;
}

interface ChatAreaProps {
  channelName: string;
  channelType: "text" | "voice" | "private";
  messages: ChatMessage[];
  onSendMessage?: (message: string) => void;
}

export default function ChatArea({ channelName, channelType, messages, onSendMessage }: ChatAreaProps) {
  const getChannelIcon = () => {
    switch (channelType) {
      case "text": return Hash;
      case "voice": return Users;
      case "private": return Pin;
      default: return Hash;
    }
  };

  const ChannelIcon = getChannelIcon();

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Channel header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <ChannelIcon className="w-5 h-5 text-muted-foreground" />
          <h1 className="font-semibold text-foreground" data-testid={`channel-header-${channelName}`}>
            {channelName}
          </h1>
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <Button size="icon" variant="ghost" data-testid="button-pin-messages">
            <Pin className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" data-testid="button-search-messages">
            <Search className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" data-testid="button-notifications">
            <Bell className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" data-testid="button-more-options">
            <Ellipsis className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <ChannelIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              #{channelName}에 오신 것을 환영합니다!
            </h3>
            <p className="text-muted-foreground">
              이 채널의 첫 번째 메시지를 보내보세요.
            </p>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <Message key={message.id} {...message} />
            ))}
          </div>
        )}
      </div>
      
      {/* Message input */}
      <MessageInput
        channelName={channelName}
        onSendMessage={onSendMessage}
      />
    </div>
  );
}