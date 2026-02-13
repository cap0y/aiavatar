import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createCustomChannel } from '@/firebase';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channel: CustomChannel) => void;
  channelType?: 'text' | 'voice' | 'video';
}

interface CustomChannel {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'voice' | 'video';
  isPrivate: boolean;
  ownerId: string;
  ownerName: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ isOpen, onClose, onChannelCreated, channelType = 'text' }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channelName, setChannelName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !channelName.trim()) {
      toast({
        title: "오류",
        description: "채널 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 채널 ID 생성 (custom- 접두사 + 타임스탬프 + 랜덤)
      const channelId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newChannel: CustomChannel = {
        id: channelId,
        name: channelName.trim(),
        description: description.trim() || undefined,
        type: channelType,
        isPrivate: true,
        ownerId: user.uid,
        ownerName: user.displayName || '사용자',
        members: [user.uid], // 생성자는 기본 멤버
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Firebase에 채널 정보 저장
      const result = await createCustomChannel(newChannel);
      
      if (!result.success) {
        throw new Error(String(result.error) || "채널 생성에 실패했습니다.");
      }

      console.log('🎉 커스텀 채널 생성 완료:', newChannel);

      toast({
        title: "채널 생성 완료! 🎉",
        description: `"${channelName}" 채널이 생성되었습니다.`,
      });

      onChannelCreated(newChannel);
      setChannelName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error("채널 생성 오류:", error);
      toast({
        title: "오류",
        description: "채널 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setChannelName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">새 채널 만들기</DialogTitle>
          <DialogDescription>
            비공개 채널을 만들어 친구들과 소통해보세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="channelName" className="text-sm font-medium">
              채널 이름 *
            </Label>
            <Input
              id="channelName"
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="예: 우리만의 채널"
              maxLength={50}
              className="mt-1"
              disabled={isLoading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {channelName.length}/50자
            </p>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              채널 설명 (선택사항)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 채널에 대한 간단한 설명을 입력하세요..."
              maxLength={200}
              rows={3}
              className="mt-1 resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {description.length}/200자
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <i className="fas fa-lock text-blue-500 mt-0.5"></i>
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">비공개 채널</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>채널 생성자만 친구를 초대할 수 있습니다</li>
                  <li>초대받은 친구만 채널에 참여할 수 있습니다</li>
                  <li>다른 사람들에게는 보이지 않습니다</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="px-6"
            >
              취소
            </Button>

            <Button
              type="submit"
              disabled={isLoading || !channelName.trim()}
              className="bg-purple-600 hover:bg-purple-700 px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <i className="fas fa-plus w-4 h-4 mr-2" aria-hidden="true"></i>
                  채널 만들기
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChannelModal;
