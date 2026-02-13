import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingFriendRequests, respondToFriendRequest } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { FriendRequest } from '@/types/friend';
import { Loader2, UserPlus, Check, X } from 'lucide-react';

interface FriendRequestNotificationProps {
  isOpen: boolean;
  onClose: () => void;
}

const FriendRequestNotification: React.FC<FriendRequestNotificationProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // 친구 요청 목록 로드
  useEffect(() => {
    if (isOpen && user) {
      loadFriendRequests();
    }
  }, [isOpen, user]);

  const loadFriendRequests = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const result = await getPendingFriendRequests(user.uid);
      if (result.success) {
        setFriendRequests(result.requests);
      } else {
        console.error("친구 요청 로드 실패:", result.error);
      }
    } catch (error) {
      console.error("친구 요청 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFriendRequest = async (requestId: string, response: 'accepted' | 'rejected') => {
    setProcessingIds(prev => new Set(prev).add(requestId));

    try {
      const result = await respondToFriendRequest(requestId, response);
      
      if (result.success) {
        // 처리된 요청을 목록에서 제거
        setFriendRequests(prev => prev.filter(req => req.id !== requestId));
        
        toast({
          title: response === 'accepted' ? "친구 요청 수락" : "친구 요청 거절",
          description: response === 'accepted' 
            ? "새로운 친구가 추가되었습니다!" 
            : "친구 요청을 거절했습니다.",
          variant: response === 'accepted' ? "default" : "destructive",
        });
      } else {
        toast({
          title: "오류",
          description: "친구 요청 처리 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("친구 요청 처리 오류:", error);
      toast({
        title: "오류",
        description: "친구 요청 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            친구 요청
            {friendRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {friendRequests.length}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            받은 친구 요청을 확인하고 수락하거나 거절하세요.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-500">로딩 중...</span>
            </div>
          ) : friendRequests.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">받은 친구 요청이 없습니다.</p>
              <p className="text-sm text-gray-400">새로운 친구 요청이 오면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {friendRequests.map((request) => (
                <div key={request.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={request.fromUserPhoto || undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {request.fromUserName[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 truncate">
                        {request.fromUserName}
                      </h4>
                      <span className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded-full">
                        친구 요청
                      </span>
                    </div>
                    
                    {request.message && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        "{request.message}"
                      </p>
                    )}
                    
                    <p className="text-xs text-gray-400">
                      {new Date(request.createdAt).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleFriendRequest(request.id, 'accepted')}
                      disabled={processingIds.has(request.id)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {processingIds.has(request.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFriendRequest(request.id, 'rejected')}
                      disabled={processingIds.has(request.id)}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      {processingIds.has(request.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FriendRequestNotification;
