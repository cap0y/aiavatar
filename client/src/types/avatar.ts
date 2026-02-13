export interface AvatarSample {
  id: string;
  name: string;
  description: string;
  Avatar?: string;
  icon?: string;
  personality: string;
  specialties: string[];
  isOnline: boolean;
  isBot: boolean;
  backgroundColor: string;
  textColor: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  activity?: string;
}

export interface AvatarMessage {
  id: string;
  AvatarId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'voice' | 'video';
  reactions?: AvatarReaction[];
}

export interface AvatarReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface VoiceChannel {
  id: string;
  name: string;
  type: 'voice' | 'video';
  maxUsers: number;
  connectedUsers: string[];
  isPrivate: boolean;
}

export interface TextChannel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  lastMessage?: AvatarMessage;
  unreadCount: number;
}
