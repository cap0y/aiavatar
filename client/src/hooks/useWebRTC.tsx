import { useState, useRef, useCallback, useEffect } from 'react';

interface UseWebRTCOptions {
  roomId?: string;
  userId?: string;
}

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export const useWebRTC = (options: UseWebRTCOptions = {}) => {
  const { roomId, userId } = options;
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  
  const peerConnections = useRef<Map<string, PeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);

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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: audio,
      });

      setLocalStream(stream);
      setIsVideoEnabled(video);
      setIsAudioEnabled(audio);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '미디어 액세스 오류';
      setError(errorMessage);
      console.error('미디어 스트림 오류:', err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 미디어 스트림 중지
  const stopMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
    }
  }, [localStream]);

  // 피어 연결 생성
  const createPeerConnection = useCallback((targetId: string) => {
    const pc = new RTCPeerConnection(servers);
    
    // 로컬 스트림 추가
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // 원격 스트림 처리
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => new Map(prev).set(targetId, remoteStream));
    };

    // ICE 후보 처리
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate:', event.candidate);
        // TODO: Socket.io나 다른 시그널링 서버로 ICE candidate 전송
      }
    };

    // 연결 상태 모니터링
    pc.onconnectionstatechange = () => {
      console.log(`피어 연결 상태 (${targetId}):`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeerConnection(targetId);
      }
    };

    const peerConnection: PeerConnection = {
      id: targetId,
      connection: pc,
    };

    peerConnections.current.set(targetId, peerConnection);
    return pc;
  }, [localStream]);

  // 피어 연결 제거
  const removePeerConnection = useCallback((targetId: string) => {
    const pc = peerConnections.current.get(targetId);
    if (pc) {
      pc.connection.close();
      peerConnections.current.delete(targetId);
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.delete(targetId);
        return newMap;
      });
    }
  }, []);

  // 통화 시작
  const startCall = useCallback(async (targetId: string, video: boolean = false) => {
    if (!userId) return;

    try {
      await startMedia(video, true);
      const pc = createPeerConnection(targetId);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('Call offer created:', offer);
      // TODO: Socket.io나 다른 시그널링 서버로 offer 전송
      
    } catch (err) {
      console.error('통화 시작 오류:', err);
    }
  }, [userId, startMedia, createPeerConnection]);

  // 통화 응답
  const answerCall = useCallback(async (callerId: string, offer: RTCSessionDescriptionInit, isVideo: boolean) => {
    try {
      await startMedia(isVideo, true);
      const pc = createPeerConnection(callerId);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log('Call answer created:', answer);
      // TODO: Socket.io나 다른 시그널링 서버로 answer 전송
      
    } catch (err) {
      console.error('통화 응답 오류:', err);
    }
  }, [startMedia, createPeerConnection]);

  // 통화 종료
  const endCall = useCallback(() => {
    // 모든 피어 연결 종료
    peerConnections.current.forEach((pc, targetId) => {
      removePeerConnection(targetId);
    });
    
    stopMedia();
    
    console.log('Call ended');
    // TODO: Socket.io나 다른 시그널링 서버로 통화 종료 알림
    
    setParticipants([]);
  }, [removePeerConnection, stopMedia]);

  // 오디오 토글
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // 비디오 토글
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // TODO: 시그널링 서버 연결 및 이벤트 처리
  // WebRTC는 시그널링 서버가 필요합니다. Socket.io, WebSocket, 또는 Firebase 등을 사용하여
  // offer, answer, ICE candidate 교환을 처리해야 합니다.

  // 정리
  useEffect(() => {
    return () => {
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
    answerCall,
    endCall,
    toggleAudio,
    toggleVideo,
    startMedia,
    stopMedia,
  };
};
