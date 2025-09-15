import MessageInput from '../MessageInput';

export default function MessageInputExample() {
  return (
    <div className="w-full bg-background">
      <MessageInput
        channelName="일반"
        onSendMessage={(message) => console.log('메시지 전송:', message)}
        placeholder="여기에 메시지를 입력하세요..."
      />
    </div>
  );
}