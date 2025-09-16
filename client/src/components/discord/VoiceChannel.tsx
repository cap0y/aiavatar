import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAuth } from '@/contexts/AuthContext';

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  channelType: 'voice' | 'video';
}

const VoiceChannel: React.FC<VoiceChannelProps> = ({ 
  channelId, 
  channelName, 
  channelType 
}) => {
  const { user } = useAuth();
  const [isInChannel, setIsInChannel] = useState(false);
  const [showCallControls, setShowCallControls] = useState(false);
  
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'speaking': return 'ring-green-400';
      case 'muted': return 'ring-red-400';
      default: return 'ring-gray-400';
    }
  };

  return (
    <div className="flex-1 bg-gray-600 flex flex-col">
      {/* 채널 헤더 */}
      <div className="h-12 bg-gray-600 border-b border-gray-500 flex items-center px-4 shadow-sm">
        <div className="flex items-center">
          <i className={`${channelType === 'video' ? 'fas fa-video' : 'fas fa-volume-up'} text-gray-300 mr-2`}></i>
          <h2 className="text-white font-semibold">{channelName}</h2>
        </div>
        <div className="ml-4 text-sm text-gray-300">
          {channelType === 'video' ? '영상 채팅 채널' : '음성 채팅 채널'}
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 p-4">
        {!isInChannel ? (
          /* 채널 참여 전 */
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gray-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                <i className={`${channelType === 'video' ? 'fas fa-video' : 'fas fa-volume-up'} text-4xl text-gray-300`}></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{channelName}</h3>
              <p className="text-gray-300 mb-6">
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
                <p className="text-gray-400 mb-4">음성 채널에 참여하려면 로그인이 필요합니다.</p>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                  로그인하기
                </Button>
              </div>
            )}
            
            {error && (
              <div className="mt-4 p-3 bg-red-500 bg-opacity-20 rounded-lg border border-red-500">
                <p className="text-red-300 text-sm">{error}</p>
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
                <div className="relative bg-gray-800 rounded-lg overflow-hidden">
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
                  <div key={participantId} className="relative bg-gray-800 rounded-lg overflow-hidden">
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
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <h4 className="text-white font-medium mb-3">
                참여자 ({participants.length + 1}명)
              </h4>
              <div className="space-y-2">
                {/* 내 정보 */}
                <div className="flex items-center space-x-3">
                  <div className={`relative ring-2 ${isAudioEnabled ? 'ring-green-400' : 'ring-red-400'} rounded-full`}>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user?.photoURL || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-sm">
                        {user?.displayName?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="text-white text-sm">
                    {user?.displayName || '나'} (나)
                  </span>
                  <div className="flex space-x-1 ml-auto">
                    {!isAudioEnabled && <i className="fas fa-microphone-slash text-red-400 text-xs"></i>}
                    {channelType === 'video' && !isVideoEnabled && <i className="fas fa-video-slash text-red-400 text-xs"></i>}
                  </div>
                </div>
                
                {/* 다른 참여자들 */}
                {participants.map(participantId => (
                  <div key={participantId} className="flex items-center space-x-3">
                    <div className="relative ring-2 ring-gray-400 rounded-full">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
                          U
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-white text-sm">사용자 {participantId}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 컨트롤 버튼 */}
            <div className="flex justify-center space-x-4">
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
    </div>
  );
};

export default VoiceChannel;
