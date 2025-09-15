import Avatar from "./Avatar";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface MessageProps {
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

export default function Message({ author, content, timestamp, isSystemMessage }: MessageProps) {
  if (isSystemMessage) {
    return (
      <div className="flex items-center gap-2 px-4 py-1 text-sm text-muted-foreground">
        <div className="h-px bg-border flex-1" />
        <span>{content}</span>
        <div className="h-px bg-border flex-1" />
      </div>
    );
  }

  return (
    <div className="group flex gap-3 px-4 py-2 hover:bg-card/30" data-testid={`message-${author.name}`}>
      <Avatar name={author.name} src={author.avatar} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-foreground">{author.name}</span>
          {author.role && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
              {author.role}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(timestamp, { addSuffix: true, locale: ko })}
          </span>
        </div>
        <div className="text-foreground break-words">
          {content}
        </div>
      </div>
    </div>
  );
}