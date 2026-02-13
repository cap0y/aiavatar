import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getFriends } from '@/firebase';
import { Friend } from '@/types/friend';
import { Loader2 } from 'lucide-react';
import { addChannelMember } from '@/firebase';

interface InviteFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  currentMembers: string[];
  onMemberAdded: (friendId: string, friendName: string) => void;
}

const InviteFriendModal: React.FC<InviteFriendModalProps> = ({ 
  isOpen, 
  onClose, 
  channelId, 
  channelName, 
  currentMembers,
  onMemberAdded 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inviting, setInviting] = useState<string[]>([]);

  // 친구 목록 로드
  useEffect(() => {
    if (!isOpen || !user) return;

    const loadFriends = async () => {
      setIsLoading(true);
      try {
        const result = await getFriends(user.uid);
        if (result.success) {
          // 이미 채널에 있는 멤버는 제외
          const availableFriends = result.friends.filter(friend => 
            !currentMembers.includes(friend.uid)
          );
          setFriends(availableFriends);
        }
      } catch (error) {
        console.error("친구 목록 로드 오류:", error);
        toast({
          title: "오류",
          description: "친구 목록을 불러올 수 없습니다.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFriends();
  }, [isOpen, user, currentMembers]);

  const handleInviteFriend = async (friend: Friend) => {
    if (!user) return;

    setInviting(prev => [...prev, friend.uid]);

    try {
      // Firebase에 채널 멤버 추가
      console.log(`👥 Firebase에 ${friend.displayName}님을 ${channelName} 채널에 추가 중...`);
      const result = await addChannelMember(channelId, friend.uid, friend.displayName);
      
      if (!result.success) {
        throw new Error(String(result.error || '채널 멤버 추가 실패'));
      }

      console.log(`✅ ${friend.displayName}님이 ${channelName} 채널에 추가됨 (Firebase)`);

      toast({
        title: "친구 초대 완료! 🎉",
        description: `${friend.displayName}님이 "${channelName}" 채널에 초대되었습니다.`,
      });

      onMemberAdded(friend.uid, friend.displayName);
      
      // 초대된 친구를 목록에서 제거
      setFriends(prev => prev.filter(f => f.uid !== friend.uid));
    } catch (error) {
      console.error("친구 초대 오류:", error);
      toast({
        title: "초대 실패",
        description: error instanceof Error ? error.message : "친구 초대 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setInviting(prev => prev.filter(id => id !== friend.uid));
    }
  };

  const handleClose = () => {
    if (inviting.length === 0) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">친구 초대</DialogTitle>
          <DialogDescription>
            "{channelName}" 채널에 친구를 초대하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm text-gray-500">친구 목록 로딩 중...</span>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-user-friends text-4xl text-gray-400 mb-4"></i>
              <p className="text-sm text-gray-500">초대할 수 있는 친구가 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1">
                모든 친구가 이미 채널에 참여중이거나 친구가 없습니다.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {friends.map((friend) => (
                <div
                  key={friend.uid}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage 
                        src={friend.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.displayName)}&background=6366f1&color=fff&size=40`} 
                        alt={friend.displayName} 
                      />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                        {friend.displayName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{friend.displayName}</p>
                      <p className="text-xs text-gray-500 flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-1 ${
                          friend.isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                        {friend.isOnline ? '온라인' : '오프라인'}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={() => handleInviteFriend(friend)}
                    disabled={inviting.includes(friend.uid)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {inviting.includes(friend.uid) ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        초대중...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-user-plus w-3 h-3 mr-1" aria-hidden="true"></i>
                        초대
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={inviting.length > 0}
              className="px-6"
            >
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteFriendModal;
