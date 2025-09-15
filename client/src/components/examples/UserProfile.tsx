import { useState } from 'react';
import UserProfile from '../UserProfile';

export default function UserProfileExample() {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  return (
    <div className="w-60 bg-sidebar">
      <UserProfile
        user={{
          name: "김개발자",
          status: "online"
        }}
        isMuted={isMuted}
        isDeafened={isDeafened}
        onToggleMute={() => setIsMuted(!isMuted)}
        onToggleDeafen={() => setIsDeafened(!isDeafened)}
        onOpenSettings={() => console.log('설정 열기')}
      />
    </div>
  );
}