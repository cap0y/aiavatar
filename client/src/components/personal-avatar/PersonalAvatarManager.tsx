import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, Upload, MessageSquare, Plus } from 'lucide-react';

interface PersonalAvatar {
  id: string;
  displayName: string;
  modelUrl: string;
  userId: string;
  createdAt: string;
  // 이전 버전과의 호환성을 위한 필드들 (optional)
  name?: string;
  description?: string;
  url?: string;
  isUserAvatar?: boolean;
  uploadDate?: string;
}

interface PersonalAvatarManagerProps {
  onAvatarSelect?: (avatar: PersonalAvatar) => void;
  className?: string;
}

const PersonalAvatarManager: React.FC<PersonalAvatarManagerProps> = ({ 
  onAvatarSelect,
  className = ""
}) => {
  const { user } = useAuth();
  const [avatars, setAvatars] = useState<PersonalAvatar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [avatarName, setAvatarName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 개인 아바타 목록 로드
  const loadUserAvatars = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/model-editor/user-avatars/${user.uid}`);
      const data = await response.json();
      
      if (response.ok) {
        setAvatars(data.avatars || []);
        console.log('개인 아바타 목록 로드됨:', data.avatars?.length || 0);
      } else {
        console.error('아바타 목록 로드 실패:', data.error);
        toast({
          title: '오류',
          description: '아바타 목록을 불러올 수 없습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('아바타 목록 로드 오류:', error);
      toast({
        title: '오류',
        description: '서버와 연결할 수 없습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.uid) return;

    if (!avatarName.trim()) {
      toast({
        title: '오류',
        description: '아바타 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    // ZIP 파일인지 확인
    if (!file.type.includes('zip') && !file.name.toLowerCase().endsWith('.zip')) {
      toast({
        title: '오류',
        description: 'ZIP 파일만 업로드할 수 있습니다.',
        variant: 'destructive',
      });
      return;
    }

    // 파일 크기 확인 (100MB 제한)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast({
        title: '오류',
        description: '파일 크기는 100MB를 초과할 수 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatarZip', file);
      formData.append('userId', user.uid);
      formData.append('avatarName', avatarName.trim());

      console.log('아바타 업로드 시작:', {
        fileName: file.name,
        fileSize: file.size,
        avatarName: avatarName.trim()
      });

      const response = await fetch('/api/model-editor/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: '성공',
          description: '개인 아바타가 성공적으로 업로드되었습니다!',
        });

        // 목록 새로고침
        await loadUserAvatars();
        
        // 폼 초기화
        setShowUploadForm(false);
        setAvatarName('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        console.log('아바타 업로드 완료:', data.avatar);
      } else {
        toast({
          title: '업로드 실패',
          description: data.error || '알 수 없는 오류가 발생했습니다.',
          variant: 'destructive',
        });
        console.error('업로드 실패:', data);
      }
    } catch (error) {
      console.error('업로드 오류:', error);
      toast({
        title: '오류',
        description: '서버와 연결할 수 없습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 아바타 삭제
  const deleteAvatar = async (avatar: PersonalAvatar) => {
    if (!user?.uid) return;

    if (!confirm(`"${avatar.displayName}" 아바타를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/model-editor/user-avatar/${user.uid}/${avatar.displayName}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: '삭제 완료',
          description: '아바타가 삭제되었습니다.',
        });

        // 목록 새로고침
        await loadUserAvatars();
      } else {
        toast({
          title: '삭제 실패',
          description: data.error || '아바타 삭제에 실패했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('삭제 오류:', error);
      toast({
        title: '오류',
        description: '서버와 연결할 수 없습니다.',
        variant: 'destructive',
      });
    }
  };

  // 아바타와 채팅하기
  const startChatWithAvatar = (avatar: PersonalAvatar) => {
    if (onAvatarSelect) {
      onAvatarSelect(avatar);
    }
    console.log('개인 아바타와 채팅 시작:', avatar.displayName);
  };

  // 컴포넌트 마운트 시 아바타 목록 로드
  useEffect(() => {
    if (user?.uid) {
      loadUserAvatars();
    }
  }, [user?.uid]);

  if (!user) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        개인 아바타를 사용하려면 로그인이 필요합니다.
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">내 아바타와 채팅</h3>
          <p className="text-sm text-gray-400">업로드한 개인 아바타들과 대화해보세요</p>
        </div>
        
        <Button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="bg-purple-600 hover:bg-purple-700"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          아바타 추가
        </Button>
      </div>

      {/* 업로드 폼 */}
      {showUploadForm && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">새 아바타 업로드</CardTitle>
            <CardDescription>
              Live2D 모델 파일(.model3.json 포함)을 ZIP으로 압축하여 업로드하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                아바타 이름
              </label>
              <Input
                type="text"
                value={avatarName}
                onChange={(e) => setAvatarName(e.target.value)}
                placeholder="아바타 이름을 입력하세요"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                모델 파일 (ZIP)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="block w-full text-sm text-gray-300 
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-purple-600 file:text-white
                  hover:file:bg-purple-700
                  file:disabled:opacity-50 file:disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowUploadForm(false);
                  setAvatarName('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                variant="outline"
                disabled={isUploading}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                취소
              </Button>
            </div>

            {isUploading && (
              <div className="text-center text-purple-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400 mx-auto mb-2"></div>
                아바타 업로드 중...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 아바타 목록 */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-2"></div>
          <p className="text-gray-400">아바타 목록을 불러오는 중...</p>
        </div>
      ) : avatars.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="text-center py-8">
            <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">업로드한 개인 아바타가 없습니다</p>
            <p className="text-sm text-gray-500">
              위의 "아바타 추가" 버튼을 눌러 Live2D 모델을 업로드해보세요
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {avatars.map((avatar) => (
            <Card key={avatar.id || avatar.displayName} className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white text-sm">{avatar.displayName}</CardTitle>
                    <CardDescription className="text-xs">
                      {new Date(avatar.createdAt || avatar.uploadDate || Date.now()).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                    개인
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-sm mb-4">{avatar.description || '개인 Live2D 아바타'}</p>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => startChatWithAvatar(avatar)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    size="sm"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    채팅하기
                  </Button>
                  
                  <Button
                    onClick={() => deleteAvatar(avatar)}
                    variant="outline"
                    size="sm"
                    className="border-red-600 text-red-400 hover:bg-red-600/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PersonalAvatarManager;
