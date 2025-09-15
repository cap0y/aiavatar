import { Settings, Mic, MicOff, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import Avatar from "./Avatar";

interface UserProfileProps {
  user: {
    name: string;
    avatar?: string;
    status: "online" | "away" | "busy" | "offline";
  };
  isMuted?: boolean;
  isDeafened?: boolean;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onOpenSettings?: () => void;
}

export default function UserProfile({ 
  user, 
  isMuted, 
  isDeafened, 
  onToggleMute, 
  onToggleDeafen, 
  onOpenSettings 
}: UserProfileProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-sidebar-accent/50">
      <Avatar name={user.name} src={user.avatar} status={user.status} size="md" />
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-sidebar-foreground truncate">
          {user.name}
        </div>
        <div className="text-xs text-sidebar-foreground/70 capitalize">
          {user.status}
        </div>
      </div>
      
      <div className="flex items-center">
        <Button
          size="icon"
          variant="ghost"
          onClick={onToggleMute}
          data-testid="button-toggle-mute"
          className={`w-8 h-8 ${isMuted ? 'text-destructive' : 'text-sidebar-foreground/70'}`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          onClick={onToggleDeafen}
          data-testid="button-toggle-deafen"
          className={`w-8 h-8 ${isDeafened ? 'text-destructive' : 'text-sidebar-foreground/70'}`}
        >
          <Headphones className="w-4 h-4" />
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          onClick={onOpenSettings}
          data-testid="button-open-settings"
          className="w-8 h-8 text-sidebar-foreground/70"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}