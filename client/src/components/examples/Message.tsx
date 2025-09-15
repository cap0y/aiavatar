import Message from '../Message';

export default function MessageExample() {
  return (
    <div className="w-full bg-background space-y-0">
      <Message
        id="1"
        author={{ name: "김개발", role: "관리자" }}
        content="안녕하세요! 새로운 기능에 대해 논의해보겠습니다."
        timestamp={new Date(Date.now() - 5 * 60 * 1000)}
      />
      <Message
        id="2"
        author={{ name: "이디자인" }}
        content="좋은 아이디어네요! UI 디자인은 어떻게 할까요?"
        timestamp={new Date(Date.now() - 3 * 60 * 1000)}
      />
      <Message
        id="3"
        author={{ name: "박기획" }}
        content="사용자 피드백을 먼저 분석해보는 게 좋을 것 같아요. 📊"
        timestamp={new Date(Date.now() - 1 * 60 * 1000)}
      />
      <Message
        id="system"
        author={{ name: "" }}
        content="최지혜님이 채널에 참여했습니다"
        timestamp={new Date()}
        isSystemMessage
      />
    </div>
  );
}