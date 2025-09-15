import ChannelItem from '../ChannelItem';

export default function ChannelItemExample() {
  return (
    <div className="w-60 p-2 bg-sidebar space-y-1">
      <ChannelItem 
        name="일반" 
        type="text" 
        isActive 
        onClick={() => console.log('일반 채널 클릭')} 
      />
      <ChannelItem 
        name="개발 이야기" 
        type="text" 
        hasNotification 
        notificationCount={3}
        onClick={() => console.log('개발 이야기 클릭')} 
      />
      <ChannelItem 
        name="음성 채팅" 
        type="voice" 
        onClick={() => console.log('음성 채팅 클릭')} 
      />
      <ChannelItem 
        name="관리자만" 
        type="private" 
        hasNotification
        onClick={() => console.log('관리자만 클릭')} 
      />
    </div>
  );
}