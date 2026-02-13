import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Upload } from 'lucide-react';

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

interface PersonalAvatarSidebarProps {
  onAvatarSelect?: (avatar: PersonalAvatar) => void;
  activeChannelId?: string;
  className?: string;
}

const PersonalAvatarSidebar: React.FC<PersonalAvatarSidebarProps> = ({ 
  onAvatarSelect,
  activeChannelId,
  className = ""
}) => {
  const { user, setShowAuthModal } = useAuth();
  const [avatars, setAvatars] = useState<PersonalAvatar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [avatarName, setAvatarName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    avatar: PersonalAvatar | null;
  }>({
    show: false,
    x: 0,
    y: 0,
    avatar: null,
  });

  // 개인 아바타 목록 로드
  const loadUserAvatars = async () => {
    if (!user?.uid) {
      console.log('⚠️ 사용자 UID가 없어 아바타 목록을 로드할 수 없습니다');
      return;
    }
    
    console.log('📂 개인 아바타 목록 로드 시작:', user.uid);
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/model-editor/user-avatars/${user.uid}`);
      const data = await response.json();
      
      console.log('📂 서버 응답:', {
        ok: response.ok,
        status: response.status,
        avatarsCount: data.avatars?.length || 0,
        avatars: data.avatars
      });
      
      if (response.ok) {
        setAvatars(data.avatars || []);
        console.log('✅ 아바타 목록 설정 완료:', data.avatars?.length || 0, '개');
      } else {
        console.error('❌ 아바타 목록 로드 실패:', data.error);
      }
    } catch (error) {
      console.error('❌ 아바타 목록 로드 오류:', error);
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

  // 아바타와 채팅하기
  const startChatWithAvatar = (avatar: PersonalAvatar) => {
    console.log('🎯 개인 아바타 클릭됨:', {
      displayName: avatar.displayName,
      id: avatar.id,
      modelUrl: avatar.modelUrl,
      hasOnAvatarSelect: !!onAvatarSelect
    });
    
    if (onAvatarSelect) {
      console.log('✅ onAvatarSelect 콜백 호출');
      onAvatarSelect(avatar);
    } else {
      console.error('❌ onAvatarSelect prop이 없습니다!');
    }
  };

  // 아바타 삭제 함수
  const deleteAvatar = async (avatar: PersonalAvatar, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.uid) return;
    
    if (!confirm(`"${avatar.displayName}" 아바타를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/model-editor/user-avatar/${user.uid}/${avatar.displayName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '삭제 실패');
      }

      console.log('개인 아바타 삭제 완료:', avatar.displayName);
      
      // 아바타 목록 새로고침
      loadUserAvatars();
      
    } catch (error) {
      console.error('아바타 삭제 오류:', error);
      alert(`아바타 삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 우클릭 이벤트 핸들러 
  const handleContextMenu = (avatar: PersonalAvatar, e: React.MouseEvent) => {
    e.preventDefault();
    
    // 컨텍스트 메뉴가 화면 밖으로 나가지 않도록 위치 조정
    const menuWidth = 120; // 컨텍스트 메뉴 예상 너비
    const menuHeight = 40; // 컨텍스트 메뉴 예상 높이
    
    let x = e.clientX;
    let y = e.clientY;
    
    // 화면 오른쪽 경계 확인
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    
    // 화면 아래쪽 경계 확인
    if (y + menuHeight > window.innerHeight) {
      y = y - menuHeight;
    }
    
    setContextMenu({
      show: true,
      x: x,
      y: y,
      avatar: avatar,
    });
  };

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = () => {
    setContextMenu({
      show: false,
      x: 0,
      y: 0,
      avatar: null,
    });
  };

  // 컨텍스트 메뉴에서 삭제 선택
  const handleDeleteFromContext = async () => {
    if (!contextMenu.avatar || !user?.uid) return;
    
    closeContextMenu();
    
    if (!confirm(`"${contextMenu.avatar.displayName}" 아바타를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/model-editor/user-avatar/${user.uid}/${contextMenu.avatar.displayName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '삭제 실패');
      }

      console.log('개인 아바타 삭제 완료:', contextMenu.avatar.displayName);
      
      // 아바타 목록 새로고침
      loadUserAvatars();
      
    } catch (error) {
      console.error('아바타 삭제 오류:', error);
      alert(`아바타 삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 컴포넌트 마운트 시 아바타 목록 로드
  useEffect(() => {
    if (user?.uid) {
      loadUserAvatars();
    }
  }, [user?.uid]);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.show) {
        closeContextMenu();
      }
    };

    if (contextMenu.show) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [contextMenu.show]);

  if (!user) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        <div className="px-2 py-1 mx-2 text-gray-500 dark:text-gray-500 text-xs text-center">
          로그인이 필요합니다
        </div>
        <div 
          className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer group text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-300"
          onClick={() => setShowAuthModal(true)}
        >
          <i className="fas fa-sign-in-alt text-sm mr-3 w-4"></i>
          <span className="text-sm">로그인하기</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-0.5 ${className}`}>
      {/* 업로드 폼 */}
      {showUploadForm && (
        <div className="mx-2 mb-2 p-3 bg-gray-100 dark:bg-[#1A1A1B] border border-gray-300 dark:border-[#272729] rounded-lg">
          <div className="space-y-2">
            <Input
              type="text"
              value={avatarName}
              onChange={(e) => setAvatarName(e.target.value)}
              placeholder="아바타 이름"
              className="bg-white dark:bg-[#0B0B0B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white text-sm h-8"
            />
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="block w-full text-xs text-gray-300 
                file:mr-2 file:py-1 file:px-2
                file:rounded file:border-0
                file:text-xs file:font-medium
                file:bg-purple-600 file:text-white
                hover:file:bg-purple-700
                file:disabled:opacity-50 file:disabled:cursor-not-allowed"
            />

            <div className="flex gap-1">
              <Button
                onClick={() => {
                  setShowUploadForm(false);
                  setAvatarName('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                variant="outline"
                size="sm"
                disabled={isUploading}
                className="text-xs h-7 flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                취소
              </Button>
            </div>

            {isUploading && (
              <div className="text-center text-purple-400 text-xs">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400 mx-auto mb-1"></div>
                업로드 중...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 아바타 목록 */}
      {(() => {
        console.log('🎨 PersonalAvatarSidebar 렌더링:', {
          isLoading,
          avatarsCount: avatars.length,
          avatars: avatars.map(a => ({ id: a.id, displayName: a.displayName, modelUrl: a.modelUrl }))
        });
        return null;
      })()}
      
      {isLoading ? (
        <div className="flex items-center px-2 py-1 mx-2 text-gray-600 dark:text-gray-400">
          <i className="fas fa-spinner fa-spin text-sm mr-3 w-4"></i>
          <span className="text-sm">로딩 중...</span>
        </div>
      ) : avatars.length === 0 ? (
        <div className="px-2 py-1 mx-2 text-gray-500 dark:text-gray-500 text-xs text-center">
          업로드한 아바타가 없습니다
        </div>
      ) : (
        avatars.map((avatar, index) => {
          console.log(`🎯 아바타 아이템 렌더링 [${index}]:`, {
            id: avatar.id,
            displayName: avatar.displayName,
            modelUrl: avatar.modelUrl,
            hasOnClick: true
          });
          
          return (
            <div
              key={avatar.id || avatar.displayName}
              className={`flex items-center px-2 py-1 mx-2 rounded cursor-pointer group text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100 ${
                activeChannelId === `user-avatar-${avatar.id || avatar.displayName}` ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white' : ''
              }`}
              onClick={() => {
                console.log('👆 아바타 클릭 이벤트 발생:', avatar.displayName);
                startChatWithAvatar(avatar);
              }}
              onContextMenu={(e) => handleContextMenu(avatar, e)}
              title={`좌클릭: 채팅 시작, 우클릭: 삭제`}
            >
            <Avatar className="w-4 h-4 mr-3">
              <AvatarFallback className={`text-white text-xs bg-gradient-to-br ${
                index % 6 === 0 ? 'from-purple-500 to-pink-500' :
                index % 6 === 1 ? 'from-blue-500 to-cyan-500' :
                index % 6 === 2 ? 'from-green-500 to-teal-500' :
                index % 6 === 3 ? 'from-yellow-500 to-orange-500' :
                index % 6 === 4 ? 'from-red-500 to-rose-500' :
                'from-indigo-500 to-purple-500'
              }`}>
                {avatar.displayName[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm truncate flex-1">{avatar.displayName}</span>
            
            {/* 삭제 버튼 (호버 시 표시) */}
            <button
              onClick={(e) => deleteAvatar(avatar, e)}
              className="w-4 h-4 mr-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
              title="삭제"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
            
            <div className="w-2 h-2 bg-purple-500 rounded-full opacity-80" title="개인 아바타"></div>
          </div>
          );
        })
      )}
      
      {/* 아바타 추가 버튼 */}
      <div 
        className="flex items-center px-2 py-1 mx-2 rounded cursor-pointer group text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-purple-600 dark:hover:text-purple-400"
        onClick={() => setShowUploadForm(!showUploadForm)}
      >
        <i className="fas fa-plus text-sm mr-3 w-4"></i>
        <span className="text-sm truncate">아바타 업로드</span>
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu.show && (
        <div
          className="fixed z-50 bg-white dark:bg-[#0B0B0B] border border-gray-300 dark:border-[#1A1A1B] rounded-lg shadow-lg py-1 min-w-32"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDeleteFromContext}
            className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-700 dark:hover:text-red-300 flex items-center"
          >
            <i className="fas fa-trash-alt text-xs mr-2"></i>
            삭제
          </button>
        </div>
      )}
    </div>
  );
};

export default PersonalAvatarSidebar;
