import ServerIcon from '../ServerIcon';

export default function ServerIconExample() {
  return (
    <div className="flex flex-col gap-2 p-4 bg-sidebar">
      <ServerIcon name="홈" isActive onClick={() => console.log('홈 서버 클릭')} />
      <ServerIcon name="개발자 모임" hasNotification onClick={() => console.log('개발자 모임 클릭')} />
      <ServerIcon name="게임 친구들" onClick={() => console.log('게임 친구들 클릭')} />
      <ServerIcon name="스터디 그룹" onClick={() => console.log('스터디 그룹 클릭')} />
    </div>
  );
}