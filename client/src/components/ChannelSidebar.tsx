import { ChevronDown, Plus, Settings, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChannelItem from "./ChannelItem";
import UserProfile from "./UserProfile";

interface Channel {
  id: string;
  name: string;
  type: "text" | "voice" | "private";
  hasNotification?: boolean;
  notificationCount?: number;
}

interface ChannelCategory {
  id: string;
  name: string;
  channels: Channel[];
  isCollapsed?: boolean;
}

interface ChannelSidebarProps {
  serverName: string;
  categories: ChannelCategory[];
  activeChannelId?: string;
  currentUser: {
    name: string;
    avatar?: string;
    status: "online" | "away" | "busy" | "offline";
  };
  onSelectChannel?: (channelId: string) => void;
  onCreateChannel?: (categoryId: string) => void;
  onToggleCategory?: (categoryId: string) => void;
}

export default function ChannelSidebar({
  serverName,
  categories,
  activeChannelId,
  currentUser,
  onSelectChannel,
  onCreateChannel,
  onToggleCategory
}: ChannelSidebarProps) {
  return (
    <div className="w-60 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Server header */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <h2 className="font-semibold text-sidebar-foreground truncate">{serverName}</h2>
      </div>
      
      {/* Channels */}
      <div className="flex-1 overflow-y-auto py-2">
        {categories.map((category) => (
          <div key={category.id} className="mb-2">
            {/* Category header */}
            <button
              onClick={() => onToggleCategory?.(category.id)}
              data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="w-full flex items-center gap-1 px-2 py-1 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wide hover:text-sidebar-foreground group"
            >
              <ChevronDown 
                className={`w-3 h-3 transition-transform ${
                  category.isCollapsed ? '-rotate-90' : ''
                }`} 
              />
              <span className="flex-1 text-left">{category.name}</span>
              <Plus 
                className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChannel?.(category.id);
                }}
              />
            </button>
            
            {/* Channel list */}
            {!category.isCollapsed && (
              <div className="space-y-0.5 px-2">
                {category.channels.map((channel) => (
                  <ChannelItem
                    key={channel.id}
                    name={channel.name}
                    type={channel.type}
                    isActive={activeChannelId === channel.id}
                    hasNotification={channel.hasNotification}
                    notificationCount={channel.notificationCount}
                    onClick={() => onSelectChannel?.(channel.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* User profile */}
      <UserProfile
        user={currentUser}
        onOpenSettings={() => console.log('설정 열기')}
      />
    </div>
  );
}