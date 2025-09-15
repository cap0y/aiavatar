import { useState } from "react";
import { Send, Plus, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  channelName: string;
  onSendMessage?: (message: string) => void;
  placeholder?: string;
}

export default function MessageInput({ channelName, onSendMessage, placeholder }: MessageInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage?.(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="px-4 pb-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-end gap-2 bg-card rounded-lg p-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0"
            data-testid="button-attach-file"
          >
            <Plus className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || `#${channelName}에 메시지 보내기`}
              rows={1}
              data-testid="input-message"
              className={cn(
                "w-full resize-none bg-transparent border-0 outline-0",
                "text-sm placeholder:text-muted-foreground",
                "min-h-[20px] max-h-32 overflow-y-auto"
              )}
              style={{
                height: 'auto',
                minHeight: '20px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              data-testid="button-emoji"
            >
              <Smile className="w-4 h-4" />
            </Button>
            
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={!message.trim()}
              data-testid="button-send-message"
              className="disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}