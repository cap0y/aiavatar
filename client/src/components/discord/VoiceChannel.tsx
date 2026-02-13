import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAuth } from '@/contexts/AuthContext';
import { 
  sendChatMessage, 
  subscribeToMessages
} from '@/firebase';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  channelType: 'voice' | 'video';
}

interface Message {
  id: string;
  content: string;
  sender: string;
  senderName?: string;
  senderAvatar?: string;
  timestamp: string;
  imageUrl?: string;
}

const VoiceChannel: React.FC<VoiceChannelProps> = ({ 
  channelId, 
  channelName, 
  channelType 
}) => {
  const { user } = useAuth();
  const [isInChannel, setIsInChannel] = useState(false);
  const [showCallControls, setShowCallControls] = useState(false);
  
  // 메시지 관련 상태
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [imageUploads, setImageUploads] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 이미지 확대 상태
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    isConnecting,
    error,
    participants,
    localVideoRef,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
  } = useWebRTC({
    roomId: channelId,
    userId: user?.uid,
  });

  // Firebase 메시지 구독
  useEffect(() => {
    if (!channelId || !user) return;

    const unsubscribe = subscribeToMessages(channelId, (newMessages: any[]) => {
      const formattedMessages: Message[] = newMessages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.senderId,
        senderName: msg.senderName || '익명',
        senderAvatar: msg.senderAvatar,
        timestamp: new Date(msg.timestamp.seconds * 1000).toISOString(),
        imageUrl: msg.imageUrl,
      }));
      setMessages(formattedMessages);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [channelId, user]);

  // 자동 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleJoinChannel = async () => {
    if (!user) return;
    
    try {
      setIsInChannel(true);
      setShowCallControls(true);
      
      // 음성 또는 영상 채널에 따라 시작
      await startCall('channel', channelType === 'video');
      
    } catch (err) {
      console.error('채널 참여 오류:', err);
      setIsInChannel(false);
      setShowCallControls(false);
    }
  };

  const handleLeaveChannel = () => {
    endCall();
    setIsInChannel(false);
    setShowCallControls(false);
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      const validFiles: File[] = [];

      files.forEach((file) => {
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert(`${file.name}의 크기가 5MB를 초과합니다.`);
          return;
        }
        if (!file.type.startsWith('image/')) {
          alert(`${file.name}은(는) 이미지 파일이 아닙니다.`);
          return;
        }
        validFiles.push(file);
      });

      setImageUploads((prevFiles) => [...prevFiles, ...validFiles]);
    }
  };

  // 파일 첨부 버튼 클릭
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  // 이미지 제거
  const handleRemoveImage = (index: number) => {
    setImageUploads((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!message.trim() && imageUploads.length === 0) return;
    if (!user) return;

    try {
      setIsUploading(true);
      let imageUrls: string[] = [];

      // 이미지 업로드 - 환경에 따라 적절한 서버로 전송
      if (imageUploads.length > 0) {
        const uploadPromises = imageUploads.map(async (file) => {
          console.log("📤 이미지 업로드 시작:", file.name);

          // 업로드 URL 결정 (환경에 따라)
          let uploadUrl = import.meta.env.VITE_IMAGE_UPLOAD_URL;
          
          if (!uploadUrl) {
            const isHttps = window.location.protocol === 'https:';
            const currentHost = window.location.hostname;
            
            if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
              // 로컬 개발 환경 - PM2로 실행 중인 CDN 서버 (웹서버 없이 직접 접속)
              uploadUrl = "http://115.160.0.166:3008/upload";
            } else {
              // 프로덕션 환경 - 현재 도메인의 /api/upload 사용
              uploadUrl = `${isHttps ? 'https' : 'http'}://${currentHost}/api/upload`;
            }
          }
          
          console.log("📤 업로드 URL:", uploadUrl);

          // 이미지 업로드
          const formData = new FormData();
          formData.append("image", file); // 서버가 'image' 필드를 기대함

          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(`이미지 업로드 실패: ${uploadResponse.status}`);
          }

          const uploadResult = await uploadResponse.json();
          // 서버 응답 형식에 맞게 처리 (url 또는 imageUrl)
          const imageUrl = uploadResult.url || uploadResult.imageUrl;
          
          if (uploadResult.success && imageUrl) {
            console.log("✅ 이미지 업로드 성공:", imageUrl);
            return imageUrl;
          } else {
            throw new Error("이미지 업로드 응답이 올바르지 않습니다");
          }
        });

        imageUrls = await Promise.all(uploadPromises);
      }

      // 메시지 전송 (첫 번째 이미지 URL만 사용)
      await sendChatMessage(
        channelId,
        user.uid,
        message.trim(),
        imageUrls[0] // 단일 이미지 URL
      );

      setMessage('');
      setImageUploads([]);
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      alert('메시지 전송에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 엔터키로 메시지 전송
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'speaking': return 'ring-green-400';
      case 'muted': return 'ring-red-400';
      default: return 'ring-gray-400';
    }
  };

  return (
    <div className="flex-1 bg-white dark:bg-[#030303] flex flex-col transition-colors">
      {/* 채널 헤더 */}
      <div className="h-12 bg-gray-50 dark:bg-[#0B0B0B] border-b border-gray-200 dark:border-[#1A1A1B] flex items-center px-4 shadow-sm transition-colors">
        <div className="flex items-center">
          <i className={`${channelType === 'video' ? 'fas fa-video' : 'fas fa-volume-up'} text-gray-900 dark:text-gray-300 mr-2`}></i>
          <h2 className="text-gray-900 dark:text-white font-semibold">{channelName}</h2>
        </div>
        <div className="ml-4 text-sm text-gray-700 dark:text-gray-300">
          {channelType === 'video' ? '영상 채팅 채널' : '음성 채팅 채널'}
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* 왼쪽: 음성/영상 영역 */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!isInChannel ? (
            /* 채널 참여 전 */
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-[#0B0B0B] rounded-lg transition-colors p-8">
              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-gray-100 dark:bg-[#1A1A1B] rounded-full flex items-center justify-center mb-6 mx-auto transition-colors">
                  <i className={`${channelType === 'video' ? 'fas fa-video' : 'fas fa-volume-up'} text-4xl text-gray-600 dark:text-gray-300`}></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{channelName}</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  {channelType === 'video' 
                    ? '영상 채팅에 참여하여 다른 사용자들과 화상으로 소통해보세요.' 
                    : '음성 채팅에 참여하여 다른 사용자들과 대화해보세요.'}
                </p>
              </div>
              
              {user ? (
                <Button
                  onClick={handleJoinChannel}
                  disabled={isConnecting}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                >
                  {isConnecting ? '연결 중...' : `${channelName} 참여하기`}
                </Button>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">음성 채널에 참여하려면 로그인이 필요합니다.</p>
                  <Button className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white">
                    로그인하기
                  </Button>
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-500 dark:bg-opacity-20 rounded-lg border border-red-300 dark:border-red-500">
                  <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}
            </div>
          ) : (
            /* 채널 참여 후 */
            <div className="flex flex-col h-full">
                {/* 비디오 영역 (비디오 채널인 경우) */}
                {channelType === 'video' && (
                  <div className="flex-1 grid grid-cols-2 gap-4 mb-4">
                    {/* 로컬 비디오 */}
                    <div className="relative bg-gray-100 dark:bg-[#0B0B0B] rounded-lg overflow-hidden transition-colors">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">
                        나 {!isVideoEnabled && '(카메라 꺼짐)'}
                      </div>
                    </div>
                    
                    {/* 원격 비디오들 */}
                    {Array.from(remoteStreams.entries()).map(([participantId, stream]) => (
                      <div key={participantId} className="relative bg-gray-100 dark:bg-[#0B0B0B] rounded-lg overflow-hidden transition-colors">
                        <video
                          autoPlay
                          className="w-full h-full object-cover"
                          ref={(video) => {
                            if (video) video.srcObject = stream;
                          }}
                        />
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">
                          사용자 {participantId}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 참여자 목록 */}
                <div className="bg-gray-50 dark:bg-[#0B0B0B] rounded-lg p-4 transition-colors">
                  <h4 className="text-gray-900 dark:text-white font-medium mb-3">
                    참여자 ({participants.length + 1}명)
                  </h4>
                  <div className="space-y-2">
                    {/* 내 정보 */}
                    <div className="flex items-center space-x-3">
                      <div className={`relative ring-2 ${isAudioEnabled ? 'ring-green-400 dark:ring-green-500' : 'ring-red-400 dark:ring-red-500'} rounded-full`}>
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user?.photoURL || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-sm">
                            {user?.displayName?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <span className="text-gray-900 dark:text-white text-sm">
                        {user?.displayName || '나'} (나)
                      </span>
                      <div className="flex space-x-1 ml-auto">
                        {!isAudioEnabled && <i className="fas fa-microphone-slash text-red-600 dark:text-red-400 text-xs"></i>}
                        {channelType === 'video' && !isVideoEnabled && <i className="fas fa-video-slash text-red-600 dark:text-red-400 text-xs"></i>}
                      </div>
                    </div>
                    
                    {/* 다른 참여자들 */}
                    {participants.map((participant, index) => (
                      <div key={participant.userId || `participant-${index}`} className="flex items-center space-x-3">
                        <div className="relative ring-2 ring-gray-400 dark:ring-gray-500 rounded-full">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={participant.photoURL} />
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
                              {participant.userName?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <span className="text-gray-900 dark:text-white text-sm">{participant.userName || '사용자'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 컨트롤 버튼 */}
                <div className="flex justify-center space-x-4 mt-4">
                  <Button
                    onClick={toggleAudio}
                    variant={isAudioEnabled ? "default" : "destructive"}
                    size="lg"
                    className="w-12 h-12 rounded-full p-0"
                  >
                    <i className={`fas fa-${isAudioEnabled ? 'microphone' : 'microphone-slash'}`}></i>
                  </Button>
                  
                  {channelType === 'video' && (
                    <Button
                      onClick={toggleVideo}
                      variant={isVideoEnabled ? "default" : "destructive"}
                      size="lg"
                      className="w-12 h-12 rounded-full p-0"
                    >
                      <i className={`fas fa-${isVideoEnabled ? 'video' : 'video-slash'}`}></i>
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleLeaveChannel}
                    variant="destructive"
                    size="lg"
                    className="w-12 h-12 rounded-full p-0 bg-red-600 hover:bg-red-700"
                  >
                    <i className="fas fa-phone-slash"></i>
                  </Button>
                </div>
              </div>
            )}
          </div>
        
        {/* 오른쪽: 채팅 영역 (항상 표시) */}
        <div className="w-96 flex-shrink-0 flex flex-col bg-gray-50 dark:bg-[#0B0B0B] rounded-lg transition-colors overflow-hidden">
                {/* 채팅 헤더 */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                  <h4 className="text-gray-900 dark:text-white font-medium flex items-center">
                    <i className="fas fa-comments mr-2"></i>
                    채팅
                  </h4>
                </div>

                {/* 메시지 목록 */}
                <ScrollArea className="flex-1 p-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      <i className="fas fa-comment-slash text-3xl mb-2"></i>
                      <p className="text-sm">아직 메시지가 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <div key={msg.id} className="flex space-x-2">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={msg.senderAvatar} />
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                              {msg.senderName?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {msg.senderName}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: ko })}
                              </span>
                            </div>
                            {msg.content && (
                              <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
                                {msg.content}
                              </p>
                            )}
                            {msg.imageUrl && (
                              <div className="mt-2">
                                <div 
                                  className="relative rounded-lg overflow-hidden max-w-sm cursor-pointer group bg-gray-100 dark:bg-gray-700"
                                  onClick={() => setSelectedImage(msg.imageUrl!)}
                                >
                                  <img
                                    src={msg.imageUrl}
                                    alt="첨부 이미지"
                                    className="w-full h-auto max-h-64 object-cover hover:opacity-90 transition-opacity"
                                    onError={(e) => {
                                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E이미지 로드 실패%3C/text%3E%3C/svg%3E';
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200">
                                    <i className="fas fa-expand text-white opacity-0 group-hover:opacity-80 text-lg"></i>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* 이미지 미리보기 */}
                {imageUploads.length > 0 && (
                  <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex flex-wrap gap-2">
                      {imageUploads.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`미리보기 ${index + 1}`}
                            className="w-16 h-16 object-cover rounded border border-gray-300 dark:border-gray-600"
                          />
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 메시지 입력 */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="bg-gray-200 dark:bg-[#1A1A1B] rounded-lg">
                    <div className="flex items-end p-3 space-x-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 w-10 h-10 p-0 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
                        onClick={handleAttachClick}
                        disabled={isUploading}
                        title="파일 첨부"
                        style={{ minWidth: '40px', minHeight: '40px' }}
                      >
                        <span style={{ fontSize: '22px', lineHeight: 1 }}>📎</span>
                      </Button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        multiple
                        className="hidden"
                      />

                      <div className="flex-1">
                        <Input
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder={
                            isUploading
                              ? "이미지 업로드 중..."
                              : "메시지를 입력하세요..."
                          }
                          className="bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                          disabled={isUploading}
                          style={{
                            outline: "none",
                            boxShadow: "none",
                            border: "none",
                          }}
                          onFocus={(e) => {
                            e.target.style.outline = "none";
                            e.target.style.boxShadow = "none";
                            e.target.style.border = "none";
                          }}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        {(message.trim() || imageUploads.length > 0) && (
                          <Button
                            onClick={handleSendMessage}
                            size="sm"
                            className="flex-shrink-0 w-10 h-10 p-0 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                            disabled={isUploading}
                            style={{ minWidth: '40px', minHeight: '40px' }}
                          >
                            {isUploading ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <span style={{ fontSize: '18px', lineHeight: 1 }}>✈️</span>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
        </div>
      </div>
      
      {/* 이미지 확대 모달 */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-screen p-4">
            <img 
              src={selectedImage} 
              alt="확대 이미지" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 w-10 h-10 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full flex items-center justify-center text-white transition-all"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 px-4 py-2 rounded-full text-white text-sm">
              클릭하여 닫기
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceChannel;
