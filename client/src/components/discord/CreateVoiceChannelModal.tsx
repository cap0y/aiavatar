import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectValue, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createCustomChannel } from '@/firebase';

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
  maxUsers?: number;
}

interface CreateVoiceChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channel: CustomChannel) => void;
}

const CreateVoiceChannelModal: React.FC<CreateVoiceChannelModalProps> = ({
  isOpen,
  onClose,
  onChannelCreated
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'voice' as 'voice' | 'video',
    maxUsers: 10
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "채널을 생성하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "채널명 필요",
        description: "채널명을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const channelId = `custom-voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const newChannel: CustomChannel = {
        id: channelId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        isPrivate: true,
        ownerId: user.uid,
        ownerName: user.displayName || user.email || '알 수 없음',
        members: [user.uid],
        createdAt: now,
        updatedAt: now,
        maxUsers: formData.maxUsers
      };

      // Firebase에 채널 정보 저장
      const result = await createCustomChannel(newChannel);
      
      if (!result.success) {
        throw new Error(String(result.error) || "채널 생성에 실패했습니다.");
      }

      console.log(`🎤 새 ${formData.type} 채널 생성:`, newChannel);

      toast({
        title: "채널 생성 완료",
        description: `"${formData.name}" ${formData.type === 'video' ? '영상' : '음성'} 채널이 생성되었습니다.`,
      });

      onChannelCreated(newChannel);
      
      // 폼 리셋
      setFormData({
        name: '',
        description: '',
        type: 'voice',
        maxUsers: 10
      });
      
      onClose();
    } catch (error) {
      console.error('채널 생성 오류:', error);
      toast({
        title: "생성 실패",
        description: "채널 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      type: 'voice',
      maxUsers: 10
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-plus text-blue-600"></i>
            새 음성/영상 채널 만들기
          </DialogTitle>
          <DialogDescription>
            친구들과 함께 사용할 비공개 음성 또는 영상 채널을 만드세요.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="channelType" className="text-sm font-medium">
              채널 유형
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'voice' | 'video') => 
                setFormData(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voice">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-volume-up text-green-600"></i>
                    음성 채널
                  </div>
                </SelectItem>
                <SelectItem value="video">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-video text-blue-600"></i>
                    영상 채널
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="channelName" className="text-sm font-medium">
              채널명 *
            </Label>
            <Input
              id="channelName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="채널명을 입력하세요"
              maxLength={50}
              required
            />
          </div>

          <div>
            <Label htmlFor="maxUsers" className="text-sm font-medium">
              최대 참여자 수
            </Label>
            <Select
              value={formData.maxUsers.toString()}
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, maxUsers: parseInt(value) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5명</SelectItem>
                <SelectItem value="10">10명</SelectItem>
                <SelectItem value="15">15명</SelectItem>
                <SelectItem value="20">20명</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="channelDescription" className="text-sm font-medium">
              채널 설명 (선택사항)
            </Label>
            <Textarea
              id="channelDescription"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="채널에 대한 간단한 설명을 입력하세요"
              maxLength={200}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !formData.name.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  생성 중...
                </>
              ) : (
                <>
                  <i className="fas fa-plus mr-2"></i>
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

export default CreateVoiceChannelModal;
