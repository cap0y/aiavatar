import { useState } from 'react';
import ServerSidebar from '../ServerSidebar';

const mockServers = [
  { id: "1", name: "개발자 모임", hasNotification: true },
  { id: "2", name: "게임 친구들" },
  { id: "3", name: "스터디 그룹", hasNotification: true },
  { id: "4", name: "취미 공유" }
];

export default function ServerSidebarExample() {
  const [activeServer, setActiveServer] = useState("1");

  return (
    <div className="h-96">
      <ServerSidebar
        servers={mockServers}
        activeServerId={activeServer}
        onSelectServer={setActiveServer}
        onCreateServer={() => console.log('새 서버 만들기')}
      />
    </div>
  );
}