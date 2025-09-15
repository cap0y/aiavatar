import Avatar from '../Avatar';

export default function AvatarExample() {
  return (
    <div className="flex gap-4 items-center p-4 bg-background">
      <Avatar name="김철수" size="sm" status="online" />
      <Avatar name="이영희" size="md" status="away" />
      <Avatar name="박민수" size="lg" status="busy" />
      <Avatar name="최지혜" status="offline" />
    </div>
  );
}