import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  connectSocket, 
  joinVoiceChannel, 
  leaveVoiceChannel,
  sendWebRTCOffer,
  sendWebRTCAnswer,
  sendICECandidate,
  onChannelParticipants,
  onUserJoinedChannel,
  onUserLeftChannel,
  onWebRTCOffer,
  onWebRTCAnswer,
  onWebRTCICECandidate,
  offWebRTCEvents
} from '@/lib/socket';

interface UseWebRTCOptions {
  roomId?: string;
  userId?: string;
  userName?: string;
  photoURL?: string;
}

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

interface Participant {
  userId: string;
  userName: string;
  photoURL?: string;
  stream?: MediaStream;
}

export const useWebRTC = (options: UseWebRTCOptions = {}) => {
  const { roomId, userId, userName, photoURL } = options;
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const peerConnections = useRef<Map<string, PeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // 미디어 스트림 시작
  const startMedia = useCallback(async (video: boolean = false, audio: boolean = true) => {
    try {
      setIsConnecting(true);
      setError(null);

      console.log('🎥 미디어 스트림 요청:', { video, audio });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      });

      console.log('✅ 미디어 스트림 획득 성공:', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsVideoEnabled(video && stream.getVideoTracks().length > 0);
      setIsAudioEnabled(audio && stream.getAudioTracks().length > 0);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '미디어 액세스 오류';
      setError(errorMessage);
      console.error('❌ 미디어 스트림 오류:', err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 미디어 스트림 중지
  const stopMedia = useCallback(() => {
    if (localStreamRef.current) {
      console.log('🛑 미디어 스트림 중지');
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
      localStreamRef.current = null;
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
    }
  }, []);

  // 피어 연결 생성
  const createPeerConnection = useCallback((targetUserId: string) => {
    console.log(`🔗 피어 연결 생성: ${targetUserId}`);
    
    const pc = new RTCPeerConnection(servers);
    
    // 로컬 스트림 추가
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`➕ 트랙 추가:`, track.kind);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // 원격 스트림 처리
    pc.ontrack = (event) => {
      console.log(`📥 원격 트랙 수신 (${targetUserId}):`, event.track.kind);
      const [remoteStream] = event.streams;
      
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(targetUserId, remoteStream);
        return newMap;
      });
      
      // 참여자 목록 업데이트
      setParticipants(prev => {
        const existingParticipant = prev.find(p => p.userId === targetUserId);
        if (existingParticipant) {
          return prev.map(p => 
            p.userId === targetUserId 
              ? { ...p, stream: remoteStream }
              : p
          );
        }
        return prev;
      });
    };

    // ICE 후보 처리
    pc.onicecandidate = (event) => {
      if (event.candidate && roomId) {
        console.log(`🧊 ICE Candidate 생성 (${targetUserId})`);
        sendICECandidate(roomId, targetUserId, event.candidate.toJSON());
      }
    };

    // 연결 상태 모니터링
    pc.onconnectionstatechange = () => {
      console.log(`🔌 피어 연결 상태 (${targetUserId}):`, pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        console.log(`✅ ${targetUserId}와 연결됨`);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log(`❌ ${targetUserId}와 연결 끊김`);
        removePeerConnection(targetUserId);
      }
    };

    // ICE 연결 상태 모니터링
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE 연결 상태 (${targetUserId}):`, pc.iceConnectionState);
    };

    const peerConnection: PeerConnection = {
      id: targetUserId,
      connection: pc,
    };

    peerConnections.current.set(targetUserId, peerConnection);
    return pc;
  }, [roomId]);

  // 피어 연결 제거
  const removePeerConnection = useCallback((targetUserId: string) => {
    console.log(`🗑️ 피어 연결 제거: ${targetUserId}`);
    
    const pc = peerConnections.current.get(targetUserId);
    if (pc) {
      pc.connection.close();
      peerConnections.current.delete(targetUserId);
      
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.delete(targetUserId);
        return newMap;
      });
      
      setParticipants(prev => prev.filter(p => p.userId !== targetUserId));
    }
  }, []);

  // Offer 생성 및 전송
  const createAndSendOffer = useCallback(async (targetUserId: string) => {
    if (!roomId || !userId) return;
    
    try {
      console.log(`📤 Offer 생성 중: ${targetUserId}`);
      
      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log(`📤 Offer 전송: ${targetUserId}`);
      sendWebRTCOffer(roomId, targetUserId, offer);
    } catch (err) {
      console.error(`❌ Offer 생성 오류 (${targetUserId}):`, err);
    }
  }, [roomId, userId, createPeerConnection]);

  // Answer 생성 및 전송
  const createAndSendAnswer = useCallback(async (
    targetUserId: string, 
    offer: RTCSessionDescriptionInit
  ) => {
    if (!roomId || !userId) return;
    
    try {
      console.log(`📥 Answer 생성 중: ${targetUserId}`);
      
      const pc = createPeerConnection(targetUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log(`📥 Answer 전송: ${targetUserId}`);
      sendWebRTCAnswer(roomId, targetUserId, answer);
    } catch (err) {
      console.error(`❌ Answer 생성 오류 (${targetUserId}):`, err);
    }
  }, [roomId, userId, createPeerConnection]);

  // 통화 시작 (채널 참여)
  const startCall = useCallback(async (callType: string, video: boolean = false) => {
    if (!userId || !roomId) {
      console.error('❌ userId 또는 roomId가 없습니다');
      return;
    }

    try {
      console.log(`🚀 통화 시작: ${callType}, video: ${video}`);
      
      // 소켓 연결
      connectSocket(userId);
      
      // 미디어 스트림 시작
      await startMedia(video, true);
      
      // 채널 참여
      console.log(`🎤 채널 참여: ${roomId}`);
      joinVoiceChannel(roomId, userName || '사용자', photoURL);
      
    } catch (err) {
      console.error('❌ 통화 시작 오류:', err);
      setError(err instanceof Error ? err.message : '통화 시작 실패');
    }
  }, [userId, roomId, userName, photoURL, startMedia]);

  // 통화 종료
  const endCall = useCallback(() => {
    console.log('📞 통화 종료');
    
    // 모든 피어 연결 종료
    peerConnections.current.forEach((pc, targetUserId) => {
      removePeerConnection(targetUserId);
    });
    
    // 채널 나가기
    if (roomId) {
      leaveVoiceChannel(roomId);
    }
    
    // 미디어 스트림 중지
    stopMedia();
    
    // 상태 초기화
    setParticipants([]);
    setRemoteStreams(new Map());
    
  }, [roomId, removePeerConnection, stopMedia]);

  // 오디오 토글
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('🎤 오디오 토글:', audioTrack.enabled);
      }
    }
  }, []);

  // 비디오 토글
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log('📹 비디오 토글:', videoTrack.enabled);
      }
    }
  }, []);

  // WebRTC 시그널링 이벤트 처리
  useEffect(() => {
    if (!userId || !roomId) return;

    console.log('🎧 WebRTC 이벤트 리스너 등록');

    // 현재 참여자 목록 수신
    onChannelParticipants((data) => {
      console.log('👥 참여자 목록 수신:', data.participants);
      
      // 참여자 목록 업데이트 (기존 참여자들)
      setParticipants(data.participants.map((participantId: string) => ({
        userId: participantId,
        userName: 'User',
        photoURL: undefined
      })));
      
      // 각 참여자에게 Offer 전송
      data.participants.forEach(participantId => {
        if (participantId !== userId) {
          console.log(`🤝 새 참여자에게 연결 시작: ${participantId}`);
          createAndSendOffer(participantId);
        }
      });
    });

    // 새 사용자 참여
    onUserJoinedChannel((data) => {
      console.log('👋 새 사용자 참여:', data.userId, data.userName);
      
      setParticipants(prev => {
        if (prev.find(p => p.userId === data.userId)) {
          return prev;
        }
        return [...prev, {
          userId: data.userId,
          userName: data.userName,
          photoURL: data.photoURL
        }];
      });
    });

    // 사용자 나감
    onUserLeftChannel((data) => {
      console.log('👋 사용자 나감:', data.userId);
      removePeerConnection(data.userId);
    });

    // Offer 수신
    onWebRTCOffer((data) => {
      console.log('📨 Offer 수신:', data.fromUserId);
      createAndSendAnswer(data.fromUserId, data.offer);
    });

    // Answer 수신
    onWebRTCAnswer(async (data) => {
      console.log('📨 Answer 수신:', data.fromUserId);
      
      const pc = peerConnections.current.get(data.fromUserId);
      if (pc) {
        try {
          await pc.connection.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('✅ Remote description 설정 완료');
        } catch (err) {
          console.error('❌ Remote description 설정 오류:', err);
        }
      }
    });

    // ICE Candidate 수신
    onWebRTCICECandidate(async (data) => {
      console.log('📨 ICE Candidate 수신:', data.fromUserId);
      
      const pc = peerConnections.current.get(data.fromUserId);
      if (pc && data.candidate) {
        try {
          await pc.connection.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('✅ ICE Candidate 추가 완료');
        } catch (err) {
          console.error('❌ ICE Candidate 추가 오류:', err);
        }
      }
    });

    // 정리
    return () => {
      console.log('🧹 WebRTC 이벤트 리스너 제거');
      offWebRTCEvents();
    };
  }, [userId, roomId, createAndSendOffer, createAndSendAnswer, removePeerConnection]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      console.log('🧹 useWebRTC 정리');
      endCall();
    };
  }, [endCall]);

  return {
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
    startMedia,
    stopMedia,
  };
};
