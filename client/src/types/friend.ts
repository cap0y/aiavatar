export interface Friend {
  id: string;
  uid: string;
  displayName: string;
  photoURL?: string;
  email?: string;
  isOnline: boolean;
  lastSeen: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
  addedAt: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserPhoto?: string;
  toUserName: string;
  toUserPhoto?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
  message?: string;
}

export interface UserPresence {
  uid: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: string;
  customStatus?: string;
}
