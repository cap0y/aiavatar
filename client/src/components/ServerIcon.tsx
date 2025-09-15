import { cn } from "@/lib/utils";

interface ServerIconProps {
  name: string;
  icon?: string;
  isActive?: boolean;
  hasNotification?: boolean;
  onClick?: () => void;
}

export default function ServerIcon({ name, icon, isActive, hasNotification, onClick }: ServerIconProps) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  
  return (
    <div className="relative group">
      {/* Active indicator */}
      <div className={cn(
        "absolute -left-1 top-1/2 -translate-y-1/2 w-1 bg-foreground rounded-r transition-all duration-200",
        isActive ? "h-8" : "h-2 group-hover:h-4"
      )} />
      
      {/* Server icon */}
      <button
        onClick={onClick}
        data-testid={`server-${name.toLowerCase().replace(/\s+/g, '-')}`}
        className={cn(
          "relative w-12 h-12 rounded-2xl flex items-center justify-center",
          "font-semibold text-sm transition-all duration-200",
          "hover:rounded-xl hover-elevate active-elevate-2",
          isActive 
            ? "bg-primary text-primary-foreground rounded-xl" 
            : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
        )}
      >
        {icon ? (
          <img src={icon} alt={name} className="w-full h-full rounded-inherit object-cover" />
        ) : (
          initials
        )}
      </button>
      
      {/* Notification indicator */}
      {hasNotification && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full border-2 border-background" />
      )}
    </div>
  );
}