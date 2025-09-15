import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ServerIcon from "./ServerIcon";

interface Server {
  id: string;
  name: string;
  icon?: string;
  hasNotification?: boolean;
}

interface ServerSidebarProps {
  servers: Server[];
  activeServerId?: string;
  onSelectServer?: (serverId: string) => void;
  onCreateServer?: () => void;
}

export default function ServerSidebar({ 
  servers, 
  activeServerId, 
  onSelectServer, 
  onCreateServer 
}: ServerSidebarProps) {
  return (
    <div className="w-18 bg-sidebar flex flex-col items-center py-3 gap-2 border-r border-sidebar-border">
      {/* Home server */}
      <ServerIcon
        name="홈"
        isActive={activeServerId === "home"}
        onClick={() => onSelectServer?.("home")}
      />
      
      {/* Separator */}
      <div className="w-8 h-px bg-sidebar-border my-1" />
      
      {/* Server list */}
      <div className="flex flex-col gap-2">
        {servers.map((server) => (
          <ServerIcon
            key={server.id}
            name={server.name}
            icon={server.icon}
            isActive={activeServerId === server.id}
            hasNotification={server.hasNotification}
            onClick={() => onSelectServer?.(server.id)}
          />
        ))}
      </div>
      
      {/* Add server button */}
      <Button
        onClick={onCreateServer}
        variant="ghost"
        size="icon"
        data-testid="button-add-server"
        className="w-12 h-12 rounded-2xl bg-sidebar-accent hover:bg-primary hover:text-primary-foreground hover:rounded-xl transition-all duration-200"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}