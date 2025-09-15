import { Hash, Volume2, Lock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelItemProps {
  name: string;
  type: "text" | "voice" | "private";
  isActive?: boolean;
  hasNotification?: boolean;
  notificationCount?: number;
  onClick?: () => void;
}

const icons = {
  text: Hash,
  voice: Volume2,
  private: Lock
};

export default function ChannelItem({ 
  name, 
  type, 
  isActive, 
  hasNotification, 
  notificationCount,
  onClick 
}: ChannelItemProps) {
  const Icon = icons[type];
  
  return (
    <button
      onClick={onClick}
      data-testid={`channel-${name.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1 rounded group",
        "text-sm font-medium transition-colors duration-150",
        "hover-elevate active-elevate-2",
        isActive 
          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{name}</span>
      
      <div className="flex items-center gap-1 ml-auto">
        {hasNotification && notificationCount && (
          <span className="px-1.5 py-0.5 text-xs font-medium bg-destructive text-destructive-foreground rounded-full">
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        )}
        {hasNotification && !notificationCount && (
          <div className="w-2 h-2 bg-destructive rounded-full" />
        )}
        <Settings className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}