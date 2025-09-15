import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "away" | "busy" | "offline";
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm", 
  lg: "w-10 h-10 text-base"
};

const statusColors = {
  online: "bg-status-online",
  away: "bg-status-away", 
  busy: "bg-status-busy",
  offline: "bg-status-offline"
};

export default function Avatar({ src, name, size = "md", status, className }: AvatarProps) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  
  return (
    <div className={cn("relative", className)}>
      <div className={cn(
        "rounded-full flex items-center justify-center font-medium",
        "bg-primary text-primary-foreground",
        sizeClasses[size]
      )}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
        ) : (
          initials
        )}
      </div>
      {status && (
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
          statusColors[status]
        )} />
      )}
    </div>
  );
}