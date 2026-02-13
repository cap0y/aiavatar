import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { sendFriendRequest } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddFriendModal: React.FC<AddFriendModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !email.trim()) {
      toast({
        title: "오류",
        description: "이메일을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await sendFriendRequest(user.uid, email.trim(), message.trim() || undefined);
      
      if (result.success) {
        toast({
          title: "친구 요청 전송",
          description: "친구 요청이 성공적으로 전송되었습니다.",
        });
        setEmail('');
        setMessage('');
        onClose();
      } else {
        const errorMessage = String(result.error || "친구 요청을 전송할 수 없습니다.");
        
        // 사용자를 찾을 수 없는 경우 수동 추가 제안
        if (errorMessage.includes("찾을 수 없습니다")) {
          toast({
            title: "친구 요청 실패",
            description: `${errorMessage} 아래 "사용자 추가" 버튼을 눌러보세요.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "친구 요청 실패",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("친구 요청 오류:", error);
      toast({
        title: "오류",
        description: "친구 요청 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  const handleClose = () => {
    if (!isLoading) {
      setEmail('');
      setMessage('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-user-plus text-purple-500"></i>
            새 친구 추가
          </DialogTitle>
          <DialogDescription>
            친구의 이메일 주소를 입력하여 친구 요청을 보내세요.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">친구의 이메일 주소</Label>
            <Input
              id="email"
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
            <p className="text-sm text-gray-500">
              친구의 계정에 등록된 이메일 주소를 입력하세요.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">메시지 (선택사항)</Label>
            <Textarea
              id="message"
              placeholder="안녕하세요! 친구가 되어요."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              rows={3}
              maxLength={200}
              className="resize-none"
            />
            <p className="text-sm text-gray-500">
              {message.length}/200자
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-6">
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
              disabled={isLoading || !email.trim()}
              className="bg-purple-600 hover:bg-purple-700 px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  전송 중...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane w-4 h-4 mr-2" aria-hidden="true"></i>
                  친구 요청 보내기
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">친구 추가 안내</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>친구 요청 보내기</strong>: 정식 친구 요청을 보냅니다</li>
                <li>상대방에게 알림이 전송되며, 수락/거절할 수 있습니다</li>
                <li>상대방이 수락하면 친구 목록에 추가됩니다</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
