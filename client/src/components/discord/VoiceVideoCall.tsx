import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { createOrGetChatRoom, sendChatMessage, getChatMessages } from '@/firebase';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWebRTC } from '@/hooks/useWebRTC';

interface VoiceVideoCallProps {
  channelId: string;
  channelName: string;
  isVideoCall?: boolean;
  onLeave?: () => void;
}

interface CallUser {
  id: string;
  name: string;
  photoURL?: string;
  stream?: MediaStream;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

interface ChatMessage {
  id: string;
  uid: string;
  displayName: string;
  photoURL?: string;
  message: string;
  timestamp: string;
  type: 'text' | 'system';
  imageUrl?: string;
}

const VoiceVideoCall: React.FC<VoiceVideoCallProps> = ({
  channelId,
  channelName,
  isVideoCall = false,
  onLeave
}) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // WebRTC 훅 사용
  const {
    localStream,
    remoteStreams,
    isVideoEnabled: webrtcIsVideoEnabled,
    isAudioEnabled: webrtcIsAudioEnabled,
    isConnecting: webrtcIsConnecting,
    error: webrtcError,
    participants: webrtcParticipants,
    localVideoRef: webrtcLocalVideoRef,
    startCall: webrtcStartCall,
    endCall: webrtcEndCall,
    toggleAudio: webrtcToggleAudio,
    toggleVideo: webrtcToggleVideo,
  } = useWebRTC({
    roomId: channelId,
    userId: user?.uid,
    userName: user?.displayName || user?.email || '사용자',
    photoURL: user?.photoURL || undefined,
  });
  
  // 통화 상태
  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<CallUser[]>([]);
  
  // 모바일 탭 상태 ('participants' | 'chat')
  const [mobileActiveTab, setMobileActiveTab] = useState<'participants' | 'chat'>('participants');
  
  // 미디어 상태 (WebRTC 훅의 상태를 기반으로)
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoCall);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  // 참조
  const localVideoRef = webrtcLocalVideoRef; // WebRTC 훅의 ref 사용
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteVideosRef = useRef<{ [userId: string]: HTMLVideoElement }>({});
  
  // 채널별 독립 상태 관리
  const [currentChannelId, setCurrentChannelId] = useState<string>(channelId);
  
  // 채팅 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [actualChatRoomId, setActualChatRoomId] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // 파일 첨부 상태
  const [imageUploads, setImageUploads] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 이미지 확대 상태
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // 비디오 확대 상태
  const [expandedVideo, setExpandedVideo] = useState<{
    userId: string;
    userName: string;
    stream: MediaStream | null;
    isScreenShare: boolean;
  } | null>(null);
  const expandedVideoRef = useRef<HTMLVideoElement>(null);
  
  // 메인 화면에 표시할 화면 공유 상태 
  const [mainScreenShare, setMainScreenShare] = useState<{
    userId: string;
    userName: string;
    stream: MediaStream | null;
  } | null>(null);
  const mainScreenShareRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC 상태 동기화
  useEffect(() => {
    setIsMuted(!webrtcIsAudioEnabled);
    setIsVideoOff(!webrtcIsVideoEnabled);
  }, [webrtcIsAudioEnabled, webrtcIsVideoEnabled]);
  
  // WebRTC 참여자를 CallUser로 변환
  useEffect(() => {
    const users: CallUser[] = webrtcParticipants.map(p => {
      const stream = remoteStreams.get(p.userId);
      return {
        id: p.userId,
        name: p.userName,
        photoURL: p.photoURL,
        stream: stream,
        isMuted: false, // 원격 사용자의 실제 음소거 상태는 추적하지 않음
        isVideoOff: !stream || !stream.getVideoTracks()[0]?.enabled
      };
    });
    
    // 본인 추가
    if (isInCall && user && localStream) {
      users.unshift({
        id: user.uid,
        name: user.displayName || '나',
        photoURL: user.photoURL || undefined,
        stream: localStream,
        isMuted: !webrtcIsAudioEnabled,
        isVideoOff: !webrtcIsVideoEnabled
      });
    }
    
    console.log('👥 참여자 업데이트:', {
      total: users.length,
      withStreams: users.filter(u => u.stream).length,
      users: users.map(u => ({ id: u.id, name: u.name, hasStream: !!u.stream }))
    });
    
    setConnectedUsers(users);
  }, [webrtcParticipants, remoteStreams, localStream, isInCall, user, webrtcIsAudioEnabled, webrtcIsVideoEnabled]);
  
  // 채팅 리스너 관리
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    if (isInCall && actualChatRoomId) {
      const setupListener = async () => {
        const db = getFirestore();
        const messagesRef = collection(db, 'chatRooms', actualChatRoomId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const msg = change.doc.data();
              const isCurrentUser = msg.senderId === user?.uid;
              
              const newMessage: ChatMessage = {
                id: change.doc.id,
                uid: msg.senderId || 'unknown',
                displayName: isCurrentUser 
                  ? (user?.displayName || user?.email || '나')
                  : (msg.senderName || '사용자'),
                photoURL: isCurrentUser 
                  ? user?.photoURL 
                  : (msg.photoURL || undefined),
                message: msg.content || '',
                timestamp: msg.timestamp?.toDate?.()?.toISOString?.() || new Date().toISOString(),
                type: 'text',
                imageUrl: msg.imageUrl
              };
              
              // 중복 방지 - 이미 있는 메시지는 추가하지 않음
              setMessages(prev => {
                const exists = prev.find(m => m.id === newMessage.id);
                if (exists) return prev;
                return [...prev, newMessage];
              });
              
              console.log('💬 새 메시지 수신:', newMessage.displayName, newMessage.message);
            }
          });
        });
      };
      
      setupListener();
    }
    
    return () => {
      if (unsubscribe) {
        console.log('🔇 채팅 리스너 정리');
        unsubscribe();
      }
    };
  }, [isInCall, actualChatRoomId, user]);
  
  // 통화 참여
  const joinCall = async () => {
    if (!user) {
      return;
    }

    try {
    setIsConnecting(true);
    setIsVideoReady(false); // 초기 로딩 상태
    console.log(`🎯 ${isVideoCall ? '영상' : '음성'} 통화 시작 - 채널: ${channelName}`);
      
      // WebRTC 훅을 통해 통화 시작
      await webrtcStartCall('channel', isVideoCall);
      
      // 통화 상태 설정
      setIsInCall(true);
      setIsVideoReady(true);
      
      // 채팅 초기화
      setTimeout(() => {
        initializeChatForChannel();
      }, 100);
      
    } catch (error: any) {
      console.error('❌ 미디어 액세스 오류:', error);
    } finally {
      setIsConnecting(false);
    }
  };
  
  // 통화 종료
  const leaveCall = () => {
    console.log('📞 통화 종료');
    
    // WebRTC 훅을 통해 통화 종료
    webrtcEndCall();
    
    // 화면 공유 스트림 정리
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    
    // 상태 초기화
    setIsInCall(false);
    setConnectedUsers([]);
    setIsMuted(false);
    setIsVideoOff(!isVideoCall);
    setIsVideoReady(false);
    setIsScreenSharing(false);
    
    // 채팅 상태 초기화
    setMessages([]);
    setNewMessage('');
    setActualChatRoomId('');
    setMainScreenShare(null);
    
    if (onLeave) {
      onLeave();
    }
  };
  
  // 채팅 초기화
  const initializeChatForChannel = async () => {
    if (!user) return;
    
    try {
      console.log(`💬 채팅 초기화: ${channelId}`);
      
      // 그룹 채팅방 ID (모든 참여자가 같은 ID 사용)
      const groupChatRoomId = `voice-channel-${channelId}`;
      setActualChatRoomId(groupChatRoomId);
      console.log(`📋 그룹 채팅방 ID 설정: ${groupChatRoomId}`);
      
      // 채팅방 문서 생성 (없으면 자동 생성됨)
      const db = getFirestore();
      const roomRef = doc(db, 'chatRooms', groupChatRoomId);
      await setDoc(roomRef, {
        channelId: channelId,
        channelName: channelName,
        type: 'voice-channel',
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp()
      }, { merge: true });
      
      console.log(`✅ 그룹 채팅방 준비 완료: ${groupChatRoomId}`);
      
      // 메시지 로드
      const messagesResult = await getChatMessages(groupChatRoomId);
      if (messagesResult.success && messagesResult.messages) {
        const formattedMessages: ChatMessage[] = messagesResult.messages.map((msg: any) => {
          // 현재 사용자의 메시지인지 확인
          const isCurrentUser = msg.senderId === user.uid;
          
          return {
            id: msg.id,
            uid: msg.senderId || 'unknown',
            displayName: isCurrentUser 
              ? (user.displayName || user.email || '나')
              : (msg.senderName || '사용자'),
            photoURL: isCurrentUser 
              ? user.photoURL 
              : (msg.photoURL || undefined),
            message: msg.content || '',
            timestamp: msg.timestamp?.toISOString?.() || new Date().toISOString(),
            type: 'text',
            imageUrl: msg.imageUrl
          };
        });
        
        setMessages(formattedMessages);
        console.log(`📝 메시지 로드 완료: ${formattedMessages.length}개`);
      }
      
      // 채팅 참여 시스템 메시지
      const joinMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        uid: 'system',
        displayName: 'System',
        message: `${user.displayName || '사용자'}님이 채널에 참여했습니다.`,
        timestamp: new Date().toISOString(),
        type: 'system'
      };
      
      setMessages(prev => [...prev, joinMessage]);
    } catch (error) {
      console.error('채팅 초기화 오류:', error);
    }
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
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || (!newMessage.trim() && imageUploads.length === 0) || isSendingMessage) return;
    
    setIsSendingMessage(true);
    setIsUploading(true);
    
    try {
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

      // 실제 채팅방 ID 사용 (없으면 기본값)
      const roomIdToUse = actualChatRoomId || `voice-${channelId}`;
      console.log(`💬 메시지 전송 사용할 채팅방 ID: ${roomIdToUse}`);
      // 일반 회원 가입 사용자를 위해 displayName과 photoURL 전달
      const result = await sendChatMessage(
        roomIdToUse, 
        newMessage.trim(), 
        user.uid,
        imageUrls[0], // 첫 번째 이미지 URL
        undefined, // replyTo
        user.displayName || user.email || "사용자",
        user.photoURL || undefined
      );
      
      if (result.success) {
        // onSnapshot 리스너가 자동으로 메시지를 추가하므로 여기서는 입력만 초기화
        setNewMessage('');
        setImageUploads([]);
        console.log('💬 메시지 전송 성공 (실시간 리스너가 자동 추가)');
      } else {
        console.error('메시지 전송 실패:', result.error);
      }
    } catch (error) {
      console.error('메시지 전송 오류:', error);
    } finally {
      setIsSendingMessage(false);
      setIsUploading(false);
    }
  };
  
  // 화면 공유 토글
  const toggleScreenShare = async () => {
    if (!isVideoCall) return;
    
    try {
      if (isScreenSharing) {
        console.log('🖥️ 화면 공유 중지');
        
        // 화면 공유 중지
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
          setScreenStream(null);
        }
        
        // 카메라 스트림 상태 확인 및 재생성
        let cameraStream = localStream;
        
        // 기존 카메라 스트림이 유효하지 않거나 비디오 트랙이 없는 경우 새로 생성
        if (!cameraStream || cameraStream.getVideoTracks().length === 0 || !cameraStream.active) {
          console.log('🔄 카메라 스트림 재생성 필요');
          
          try {
            // 새로운 카메라 스트림 생성
            const newCameraStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 }
              }
            });
            
            console.log('✅ 새 카메라 스트림 생성 완료:', {
              id: newCameraStream.id,
              videoTracks: newCameraStream.getVideoTracks().length,
              audioTracks: newCameraStream.getAudioTracks().length
            });
            
            // 기존 스트림 정리 (화면 공유에서 카메라로 전환)
            // localStream은 WebRTC 훅에서 관리하므로 여기서는 참조만 업데이트
            cameraStream = newCameraStream;
            
            // 사용자 상태 업데이트
            setConnectedUsers(prev => 
              prev.map(u => 
                u.id === user?.uid ? { ...u, stream: newCameraStream } : u
              )
            );
            
            // 오디오 재설정
            if (remoteAudioRef.current && newCameraStream.getAudioTracks().length > 0) {
              const audioOnlyStream = new MediaStream();
              newCameraStream.getAudioTracks().forEach(track => {
                const clonedTrack = track.clone();
                audioOnlyStream.addTrack(clonedTrack);
              });
              
              remoteAudioRef.current.srcObject = audioOnlyStream;
              remoteAudioRef.current.play().catch(console.error);
            }
          } catch (error) {
            console.error('❌ 카메라 스트림 재생성 실패:', error);
            return;
          }
        }
        
        // 카메라로 다시 전환
        if (localVideoRef.current && cameraStream) {
          console.log('📹 카메라 스트림으로 전환 중...');
          localVideoRef.current.srcObject = cameraStream;
          
          try {
            await localVideoRef.current.play();
            console.log('✅ 카메라 영상 재생 성공');
            setIsVideoReady(true);
          } catch (playError: any) {
            // AbortError는 무시
            if (playError?.name === 'AbortError') {
              console.log('⚠️ 카메라 영상 재생 중단됨 (정상)');
            } else {
              console.error('❌ 카메라 영상 재생 실패:', playError);
            }
            // 재생 실패해도 상태는 업데이트
            setIsVideoReady(true);
          }
        }
        
        setIsScreenSharing(false);
      } else {
        console.log('🖥️ 화면 공유 시작');
        
        // 화면 공유 시작
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true // 시스템 오디오도 포함
        });
        
        console.log('✅ 화면 공유 스트림 획득 성공:', {
          id: displayStream.id,
          videoTracks: displayStream.getVideoTracks().length,
          audioTracks: displayStream.getAudioTracks().length
        });
        
        setScreenStream(displayStream);
        
        // 비디오 요소에 화면 공유 스트림 연결
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
          
          // 안전한 재생 시도
          try {
            await localVideoRef.current.play();
            console.log('✅ 화면 공유 영상 재생 성공');
            setIsVideoReady(true);
          } catch (error: any) {
            // AbortError는 무시
            if (error?.name === 'AbortError') {
              console.log('⚠️ 화면 공유 재생 중단됨 (정상)');
            } else {
              console.error('❌ 화면 공유 영상 재생 실패:', error);
            }
            setIsVideoReady(true);
          }
        }
        
        // 화면 공유가 중단될 때 자동으로 카메라로 복원
        displayStream.getVideoTracks()[0].onended = async () => {
          console.log('📺 화면 공유가 사용자에 의해 중단됨');
          setIsScreenSharing(false);
          setScreenStream(null);
          
          // 카메라로 복원 (화면 공유 중지와 동일한 로직)
          let cameraStream = localStream;
          
          if (!cameraStream || cameraStream.getVideoTracks().length === 0 || !cameraStream.active) {
            console.log('🔄 자동 복원: 카메라 스트림 재생성');
            
            try {
              const newCameraStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
                video: {
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                  frameRate: { ideal: 30 }
                }
              });
              
              // localStream은 WebRTC 훅에서 관리
              cameraStream = newCameraStream;
              
              setConnectedUsers(prev => 
                prev.map(u => 
                  u.id === user?.uid ? { ...u, stream: newCameraStream } : u
                )
              );
            } catch (error) {
              console.error('❌ 자동 복원: 카메라 스트림 재생성 실패:', error);
              return;
            }
          }
          
          if (localVideoRef.current && cameraStream) {
            localVideoRef.current.srcObject = cameraStream;
            localVideoRef.current.play().catch((err: any) => {
              // AbortError는 무시
              if (err?.name !== 'AbortError') {
                console.error('❌ 자동 복원 영상 재생 실패:', err);
              }
            });
          }
        };
        
        setIsScreenSharing(true);
        
        // 메인 화면에 내 화면 공유 설정
        if (user) {
          setMainScreenShare({
            userId: user.uid,
            userName: user.displayName || '나',
            stream: displayStream
          });
        }
      }
    } catch (error: any) {
      console.error('❌ 화면 공유 오류:', error);
    }
  };
  
  // 비디오 확대 기능
  const handleExpandVideo = (callUser: CallUser) => {
    if (!callUser || callUser.isVideoOff) return;
    
    const currentStream = callUser.id === user?.uid && isScreenSharing ? screenStream : callUser.stream;
    if (!currentStream) return;
    
    console.log(`🔍 비디오 확대: ${callUser.name}`, {
      isScreenShare: callUser.id === user?.uid && isScreenSharing,
      hasStream: !!currentStream
    });
    
    setExpandedVideo({
      userId: callUser.id,
      userName: callUser.name,
      stream: currentStream,
      isScreenShare: callUser.id === user?.uid && isScreenSharing
    });
  };
  
  // 비디오 확대 닫기
  const handleCloseExpandedVideo = () => {
    console.log('❌ 비디오 확대 닫기');
    setExpandedVideo(null);
  };
  
  // 전체화면 토글
  const handleToggleFullscreen = () => {
    if (!expandedVideoRef.current) return;
    
    if (!document.fullscreenElement) {
      expandedVideoRef.current.requestFullscreen().then(() => {
        console.log('📺 전체화면 진입');
      }).catch(error => {
        console.error('❌ 전체화면 진입 실패:', error);
      });
    } else {
      document.exitFullscreen().then(() => {
        console.log('📺 전체화면 해제');
      }).catch(console.error);
    }
  };
  
  // 확대된 비디오 스트림 연결
  useEffect(() => {
    if (expandedVideo?.stream && expandedVideoRef.current) {
      console.log('🔗 확대된 비디오에 스트림 연결');
      expandedVideoRef.current.srcObject = expandedVideo.stream;
      expandedVideoRef.current.play().catch(console.error);
    }
  }, [expandedVideo]);
  
  // 메인 화면 공유 스트림 연결
  useEffect(() => {
    if (mainScreenShare?.stream && mainScreenShareRef.current) {
      console.log('🔗 메인 화면 공유에 스트림 연결:', mainScreenShare.userName);
      mainScreenShareRef.current.srcObject = mainScreenShare.stream;
      mainScreenShareRef.current.play().catch(console.error);
    }
  }, [mainScreenShare]);
  
  // 다른 사용자의 화면 공유를 메인으로 표시
  const showScreenShareInMain = (callUser: CallUser) => {
    if (!callUser.stream) return;
    
    console.log(`📺 ${callUser.name}의 화면을 메인으로 표시`);
    setMainScreenShare({
      userId: callUser.id,
      userName: callUser.name,
      stream: callUser.stream
    });
  };
  
  // 메인 화면 공유 닫기
  const closeMainScreenShare = () => {
    console.log('❌ 메인 화면 공유 닫기');
    setMainScreenShare(null);
  };
  
  // 마이크 토글
  const toggleMute = () => {
    console.log('🎤 마이크 토글 - 현재:', webrtcIsAudioEnabled);
    webrtcToggleAudio();
    // 상태는 useEffect에서 자동으로 동기화됨
  };
  
  // 비디오 토글
  const toggleVideo = () => {
    if (!isVideoCall) return;
    
    console.log('📹 비디오 토글 - 현재:', webrtcIsVideoEnabled);
    webrtcToggleVideo();
    // 상태는 useEffect에서 자동으로 동기화됨
  };
  
  // 채널 변경 감지 및 정리
  useEffect(() => {
    // 채널이 변경되면 이전 통화 정리
    if (currentChannelId !== channelId) {
      console.log(`🔄 채널 변경 감지: ${currentChannelId} -> ${channelId}`);
      
      if (isInCall) {
        console.log('📞 이전 통화 정리 중...');
        // 로컬 스트림 정리
        // localStream은 WebRTC 훅에서 관리되므로 여기서는 처리하지 않음
        
        // 상태 초기화
        setIsInCall(false);
        setConnectedUsers([]);
        setIsMuted(false);
        setIsVideoOff(!isVideoCall);
        setIsVideoReady(false);
        setIsScreenSharing(false);
        
        // 화면 공유 스트림 정리
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
          setScreenStream(null);
        }
        
        // 채팅 상태 초기화
        setMessages([]);
        setNewMessage('');
        setActualChatRoomId('');
        setMainScreenShare(null);
      }
      
      setCurrentChannelId(channelId);
    }
  }, [channelId, currentChannelId, isInCall, localStream, isVideoCall]);
  
  // 스트림이 설정되면 비디오 요소에 연결 (DOM 렌더링 후)
  useEffect(() => {
    if (localStream && isInCall && isVideoCall) {
      console.log('📹 비디오 준비 완료:', {
        refExists: !!localVideoRef.current,
        isVideoCall,
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length
      });
      
      // WebRTC 훅이 이미 비디오 ref를 처리하므로, 여기서는 준비 상태만 설정
      setTimeout(() => {
        setIsVideoReady(true);
      }, 500);
    }
  }, [localStream, isInCall, isVideoCall]);
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      console.log('🧹 VoiceVideoCall 컴포넌트 언마운트');
      
      // 화면 공유만 정리 (로컬 스트림은 WebRTC 훅이 처리)
      if (screenStream) {
        console.log('🧹 화면 공유 스트림 정리');
        screenStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [screenStream]);
  
  // 모바일 탭 전환 시 비디오 재생 (영상 채팅만)
  useEffect(() => {
    if (!isMobile || !isVideoCall || !isInCall || !localStream) return;
    
    // 참여자 탭으로 전환되고 비디오가 꺼져있지 않을 때
    if (mobileActiveTab === 'participants' && !isVideoOff) {
      console.log('🔄 모바일 탭 전환 - 비디오 재생 재시도');
      
      const replayVideo = async () => {
        try {
          const currentStream = isScreenSharing ? screenStream : localStream;
          
          if (localVideoRef.current && currentStream) {
            // 스트림이 연결되지 않았거나 다른 스트림이면 재연결
            if (!localVideoRef.current.srcObject || localVideoRef.current.srcObject !== currentStream) {
              console.log('📹 비디오 스트림 재연결');
              localVideoRef.current.srcObject = currentStream;
            }
            
            // 비디오 속성 재설정
            localVideoRef.current.muted = true;
            localVideoRef.current.playsInline = true;
            
            // 이미 재생 중이면 재생 시도하지 않음
            if (!localVideoRef.current.paused) {
              console.log('✅ 비디오가 이미 재생 중');
              setIsVideoReady(true);
              return;
            }
            
            // 재생 시도
            await localVideoRef.current.play();
            console.log('✅ 탭 전환 후 비디오 재생 성공');
            setIsVideoReady(true);
          }
        } catch (error: any) {
          // AbortError는 무시 (사용자 경험에 영향 없음)
          if (error?.name === 'AbortError') {
            console.log('⚠️ 탭 전환 비디오 재생 중단됨 (정상)');
            setIsVideoReady(true);
          } else {
            console.error('❌ 탭 전환 후 비디오 재생 실패:', error);
            // 실패해도 준비 상태로 설정 (UI 블로킹 방지)
            setIsVideoReady(true);
          }
        }
      };
      
      // 약간의 지연 후 재생 (DOM 업데이트 완료 대기)
      const timeoutId = setTimeout(replayVideo, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [mobileActiveTab, isMobile, isVideoCall, isInCall, localStream, isVideoOff, isScreenSharing, screenStream]);

  if (!isInCall) {
    return (
      <Card className="w-full max-w-md mx-auto mt-8 bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B] transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <i className={`fas ${isVideoCall ? 'fa-video' : 'fa-volume-up'} text-lg`}></i>
            {channelName}
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isVideoCall ? '영상' : '음성'} 채널에 참여하세요
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="bg-gray-100 dark:bg-[#1A1A1B] rounded-lg p-6 mb-4 transition-colors">
              <i className={`fas ${isVideoCall ? 'fa-video-slash' : 'fa-volume-mute'} text-4xl text-gray-400 dark:text-gray-500 mb-2`}></i>
              <p className="text-gray-600 dark:text-gray-400">
                {isVideoCall 
                  ? '영상 통화에 참여하면 카메라와 마이크를 사용합니다.' 
                  : '음성 통화에 참여하면 마이크를 사용합니다.'
                }
              </p>
            </div>
            
            <Button
              onClick={joinCall}
              disabled={isConnecting}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isConnecting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  연결 중...
                </>
              ) : (
                <>
                  <i className={`fas ${isVideoCall ? 'fa-video' : 'fa-phone'} mr-2`}></i>
                  {isVideoCall ? '영상 통화' : '음성 통화'} 참여
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full bg-white dark:bg-[#030303] text-gray-900 dark:text-white flex overflow-hidden transition-colors">
      {/* 숨겨진 오디오 요소 (원격 오디오용) */}
      <audio 
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="hidden"
        controls={false}
        onLoadedData={() => {
          console.log('🔊 원격 오디오 데이터 로드 완료');
        }}
        onCanPlay={() => {
          console.log('🔊 원격 오디오 재생 가능 상태');
          // 재생 가능해지면 즉시 재생 시도
          if (remoteAudioRef.current) {
            remoteAudioRef.current.play().catch(console.error);
          }
        }}
        onPlay={() => {
          console.log('▶️ 원격 오디오 재생 시작됨');
        }}
        onPause={() => {
          console.log('⏸️ 원격 오디오 일시정지됨');
          // 의도하지 않은 일시정지 시 재시작
          if (remoteAudioRef.current && !remoteAudioRef.current.ended) {
            setTimeout(() => {
              if (remoteAudioRef.current) {
                remoteAudioRef.current.play().catch(console.error);
              }
            }, 100);
          }
        }}
        onError={(e) => {
          console.error('❌ 원격 오디오 재생 오류:', e);
        }}
        onVolumeChange={() => {
          console.log('🔊 원격 오디오 볼륨 변경:', remoteAudioRef.current?.volume);
        }}
      />
      
      {/* 모바일 레이아웃 */}
      {isMobile ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 모바일 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#0B0B0B] border-b border-gray-200 dark:border-[#1A1A1B] transition-colors">
            <div className="flex items-center gap-3">
              <i className={`fas ${isVideoCall ? 'fa-video' : 'fa-volume-up'} text-lg text-gray-900 dark:text-white`}></i>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{channelName}</h2>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {connectedUsers.length}명 참여 중
                </span>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={leaveCall}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20"
            >
              <i className="fas fa-phone-slash"></i>
            </Button>
          </div>
          
          {/* 모바일 메인 콘텐츠 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 참여자 탭 */}
            {mobileActiveTab === 'participants' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* 영상 채팅 - 전체 화면 비디오 */}
                {isVideoCall && connectedUsers.length > 0 && (
                  <div className="flex-1 overflow-auto">
                    <div className="p-2 space-y-2">
                      {connectedUsers.map((callUser) => {
                        // 원격 사용자를 위한 비디오 ref 생성
                        return (
                        <div
                          key={callUser.id}
                          className="relative w-full bg-gray-100 dark:bg-[#0B0B0B] rounded-lg overflow-hidden transition-colors"
                          style={{ aspectRatio: '16/9' }}
                        >
                          {!callUser.isVideoOff ? (
                            <>
                              <video
                                ref={(el) => {
                                  if (el && callUser.stream) {
                                    // 로컬/원격 모두 srcObject 설정
                                    if (el.srcObject !== callUser.stream) {
                                      const isLocal = callUser.id === user?.uid;
                                      console.log(`📹 비디오 연결 (모바일): ${callUser.name} (${isLocal ? '로컬' : '원격'})`);
                                      el.srcObject = callUser.stream;
                                      el.play().catch(err => {
                                        if (err.name !== 'AbortError') {
                                          console.error('비디오 재생 실패:', err);
                                        }
                                      });
                                    }
                                  }
                                }}
                                autoPlay
                                muted={callUser.id === user?.uid}
                                playsInline
                                controls={false}
                                className="w-full h-full object-cover"
                                onClick={() => handleExpandVideo(callUser)}
                                onLoadedMetadata={(e) => {
                                  console.log(`📹 비디오 메타데이터 로드: ${callUser.name}`);
                                }}
                                onCanPlay={(e) => {
                                  const video = e.currentTarget;
                                  if (video.paused) {
                                    video.play().catch(err => {
                                      if (err.name !== 'AbortError') {
                                        console.error('비디오 재생 실패:', err);
                                      }
                                    });
                                  }
                                }}
                                onPlay={() => {
                                  console.log(`▶️ 비디오 재생 시작: ${callUser.name}`);
                                  if (callUser.id === user?.uid) {
                                    setIsVideoReady(true);
                                  }
                                }}
                                onError={(e) => {
                                  console.error(`❌ 비디오 재생 오류 (${callUser.name}):`, e.currentTarget.error);
                                }}
                              />
                              
                              {/* 비디오 정보 오버레이 */}
                              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 rounded px-3 py-1.5 flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={callUser.photoURL} />
                                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                                    {callUser.name[0]?.toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium text-white">{callUser.name}</span>
                                {callUser.isMuted && (
                                  <i className="fas fa-microphone-slash text-red-400 text-xs"></i>
                                )}
                              </div>
                              
                              {/* 본인 표시 */}
                              {callUser.id === user?.uid && (
                                <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                  나
                                </div>
                              )}
                              
                              {/* 로딩 상태 */}
                              {callUser.id === user?.uid && !isVideoReady && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                                  <div className="text-center text-white">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                                    <p className="text-sm">로딩 중...</p>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-[#0B0B0B] transition-colors">
                              <Avatar className="w-20 h-20 mb-3">
                                <AvatarImage src={callUser.photoURL} />
                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl">
                                  {callUser.name[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-gray-900 dark:text-white font-medium mb-1">{callUser.name}</span>
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <i className="fas fa-video-slash text-sm"></i>
                                <span className="text-sm">카메라 꺼짐</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
                
                {/* 음성 채팅 - 참여자 목록 */}
                {!isVideoCall && (
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {connectedUsers.map((callUser) => (
                        <div
                          key={callUser.id}
                          className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#0B0B0B] rounded-lg border-2 border-gray-200 dark:border-[#1A1A1B] transition-colors"
                        >
                          <div className="relative">
                            <Avatar className="w-14 h-14">
                              <AvatarImage src={callUser.photoURL} />
                              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-lg">
                                {callUser.name[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            
                            {/* 말하는 중 애니메이션 */}
                            {!callUser.isMuted && (
                              <div className="absolute inset-0 rounded-full border-3 border-green-400 animate-pulse"></div>
                            )}
                            
                            {/* 상태 아이콘 */}
                            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${
                              callUser.isMuted ? 'bg-red-500' : 'bg-green-500'
                            }`}>
                              <i className={`fas ${callUser.isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-xs`}></i>
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base font-medium text-gray-900 dark:text-white truncate">
                                {callUser.name}
                              </span>
                              {callUser.id === user?.uid && (
                                <span className="text-xs bg-blue-500 dark:bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                  나
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                callUser.isMuted ? 'bg-red-400 dark:bg-red-500' : 'bg-green-400 dark:bg-green-500'
                              }`}></div>
                              <span className={`text-sm ${
                                callUser.isMuted ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                              }`}>
                                {callUser.isMuted ? '음소거' : '활성'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {connectedUsers.length === 0 && (
                        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                          <i className="fas fa-users text-4xl mb-3"></i>
                          <p className="text-base">참여자가 없습니다</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
            
            {/* 채팅 탭 */}
            {mobileActiveTab === 'chat' && (
              <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0B0B0B] transition-colors">
                {/* 채팅 메시지 */}
                <ScrollArea className="flex-1 p-3" ref={chatScrollRef}>
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`${
                          message.type === 'system' 
                            ? 'text-center text-xs text-gray-600 dark:text-gray-400 italic' 
                            : 'flex gap-2'
                        }`}
                      >
                        {message.type === 'text' && (
                          <>
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarImage src={message.photoURL} alt={message.displayName} />
                              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
                                {message.displayName[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {message.displayName}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {new Date(message.timestamp).toLocaleTimeString('ko-KR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              {message.message && (
                                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                                  {message.message}
                                </p>
                              )}
                              {message.imageUrl && (
                                <div className="mt-2">
                                  <div 
                                    className="relative rounded-lg overflow-hidden max-w-sm cursor-pointer group bg-gray-100 dark:bg-gray-700"
                                    onClick={() => setSelectedImage(message.imageUrl!)}
                                  >
                                    <img
                                      src={message.imageUrl}
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
                          </>
                        )}
                        {message.type === 'system' && (
                          <span>{message.message}</span>
                        )}
                      </div>
                    ))}
                    
                    {messages.length === 0 && (
                      <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                        <i className="fas fa-comments text-4xl mb-3"></i>
                        <p className="text-base">아직 메시지가 없습니다.</p>
                        <p className="text-sm">첫 번째 메시지를 보내보세요!</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* 이미지 미리보기 (모바일) */}
                {imageUploads.length > 0 && (
                  <div className="px-3 py-2 bg-gray-100 dark:bg-[#0B0B0B] border-t border-gray-200 dark:border-[#1A1A1B]">
                    <div className="flex flex-wrap gap-2">
                      {imageUploads.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`미리보기 ${index + 1}`}
                            className="w-16 h-16 object-cover rounded border border-gray-300 dark:border-gray-600"
                          />
                          <button
                            type="button"
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

                {/* 채팅 입력 */}
                <div className="p-3 border-t border-gray-200 dark:border-[#1A1A1B]">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleAttachClick}
                      disabled={isUploading}
                      size="sm"
                      variant="ghost"
                      className="flex-shrink-0"
                      title="파일 첨부"
                    >
                      <span style={{ fontSize: '20px' }}>📎</span>
                    </Button>
                    
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={isUploading ? "업로드 중..." : "메시지를 입력하세요..."}
                      className="flex-1 bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      disabled={isSendingMessage || isUploading}
                      maxLength={500}
                    />
                    <Button
                      type="submit"
                      disabled={(!newMessage.trim() && imageUploads.length === 0) || isSendingMessage || isUploading}
                      size="sm"
                      className="px-4"
                    >
                      {isSendingMessage || isUploading ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <span style={{ fontSize: '18px' }}>✈️</span>
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
          
          {/* 모바일 하단 컨트롤 */}
          <div className="bg-gray-50 dark:bg-[#0B0B0B] border-t border-gray-200 dark:border-[#1A1A1B] transition-colors">
            {/* 탭 네비게이션 */}
            <div className="flex border-b border-gray-200 dark:border-[#1A1A1B]">
              <button
                onClick={() => setMobileActiveTab('participants')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  mobileActiveTab === 'participants'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <i className="fas fa-users mr-2"></i>
                참여자 ({connectedUsers.length})
              </button>
              <button
                onClick={() => setMobileActiveTab('chat')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  mobileActiveTab === 'chat'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <i className="fas fa-comments mr-2"></i>
                채팅
              </button>
            </div>
            
            {/* 컨트롤 버튼 */}
            <div className="flex justify-center gap-4 p-4">
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                className={`w-14 h-14 rounded-full ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
              </Button>
              
              {isVideoCall && (
                <>
                  <Button
                    onClick={toggleVideo}
                    variant={isVideoOff ? "destructive" : "secondary"}
                    size="lg"
                    className={`w-14 h-14 rounded-full ${
                      isVideoOff 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-lg`}></i>
                  </Button>
                  
                  <Button
                    onClick={toggleScreenShare}
                    variant={isScreenSharing ? "default" : "secondary"}
                    size="lg"
                    className={`w-14 h-14 rounded-full ${
                      isScreenSharing 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    <i className={`fas ${isScreenSharing ? 'fa-stop' : 'fa-desktop'} text-lg`}></i>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 데스크톱 레이아웃 (기존 유지) */
        <>
          {/* 메인 콘텐츠 영역 */}
          <div className="flex-1 flex flex-col p-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <i className={`fas ${isVideoCall ? 'fa-video' : 'fa-volume-up'} text-lg text-gray-900 dark:text-white`}></i>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{channelName}</h2>
          <span className={`text-sm px-2 py-1 rounded ${
            isVideoCall ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-green-600 dark:bg-green-500 text-white'
          }`}>
            {isVideoCall ? '영상 통화' : '음성 통화'}
          </span>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {connectedUsers.length}명 참여 중
          </span>
        </div>
        
        <Button
          variant="destructive"
          onClick={leaveCall}
          className="bg-red-600 hover:bg-red-700"
        >
          <i className="fas fa-phone-slash mr-2"></i>
          나가기
        </Button>
        </div>
        
        {/* 메인 영역 - 화면 공유 중일 때는 화면 공유 표시, 아닐 때는 채팅만 */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* 화면 공유 메인 영역 */}
          {isVideoCall && mainScreenShare && (
            <div className="flex-1 mb-4">
              <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={mainScreenShareRef}
                  autoPlay
                  muted={mainScreenShare.userId === user?.uid}
                  playsInline
                  controls={false}
                  className="w-full h-full object-contain"
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    console.log('📹 메인 화면 공유 메타데이터 로드됨:', {
                      width: video.videoWidth,
                      height: video.videoHeight,
                      readyState: video.readyState
                    });
                  }}
                  onCanPlay={(e) => {
                    console.log('📹 메인 화면 공유 재생 준비 완료');
                    if (e.currentTarget.paused) {
                      e.currentTarget.play().catch(console.error);
                    }
                  }}
                  onPlay={() => {
                    console.log('▶️ 메인 화면 공유 재생 시작됨');
                  }}
                  onError={(e) => {
                    console.error('❌ 메인 화면 공유 재생 오류:', e.currentTarget.error);
                  }}
                />
                
                {/* 화면 공유 정보 오버레이 */}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage 
                        src={
                          mainScreenShare.userId === user?.uid 
                            ? user?.photoURL || undefined
                            : connectedUsers.find(u => u.id === mainScreenShare.userId)?.photoURL
                        } 
                      />
                      <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-500 text-white text-sm">
                        {mainScreenShare.userName[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium">{mainScreenShare.userName}</p>
                      <p className="text-gray-300 text-sm flex items-center gap-1">
                        <i className="fas fa-desktop text-blue-400"></i>
                        화면 공유 중
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* 화면 공유 컨트롤 */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <Button
                    onClick={() => handleExpandVideo({
                      id: mainScreenShare.userId,
                      name: mainScreenShare.userName,
                      photoURL: mainScreenShare.userId === user?.uid 
                        ? user?.photoURL || undefined
                        : connectedUsers.find(u => u.id === mainScreenShare.userId)?.photoURL,
                      stream: mainScreenShare.stream || undefined,
                      isMuted: false,
                      isVideoOff: false
                    })}
                    variant="secondary"
                    size="sm"
                    className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white border-gray-600"
                  >
                    <i className="fas fa-expand mr-2"></i>
                    확대
                  </Button>
                  
                  <Button
                    onClick={closeMainScreenShare}
                    variant="secondary"
                    size="sm"
                    className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white border-gray-600"
                  >
                    <i className="fas fa-times mr-2"></i>
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* 채팅 영역 */}
          <div className={`${isVideoCall && mainScreenShare ? 'h-60' : 'flex-1'} flex flex-col bg-gray-50 dark:bg-[#0B0B0B] rounded-lg transition-colors`}>
            {/* 채팅 헤더 */}
            <div className="p-3 border-b border-gray-200 dark:border-[#1A1A1B]">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <i className="fas fa-comments text-blue-600 dark:text-blue-400"></i>
                채널 채팅
              </h3>
            </div>
            
            {/* 채팅 메시지 */}
            <ScrollArea className="flex-1 p-3" ref={chatScrollRef}>
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`${
                      message.type === 'system' 
                        ? 'text-center text-xs text-gray-400 italic' 
                        : 'flex gap-2'
                    }`}
                  >
                    {message.type === 'text' && (
                      <>
                        <Avatar className="w-6 h-6 flex-shrink-0">
                          <AvatarImage src={message.photoURL} alt={message.displayName} />
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                            {message.displayName[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {message.displayName}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(message.timestamp).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {message.message && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                              {message.message}
                            </p>
                          )}
                          {message.imageUrl && (
                            <div className="mt-2">
                              <div 
                                className="relative rounded-lg overflow-hidden max-w-xs cursor-pointer group bg-gray-100 dark:bg-gray-700"
                                onClick={() => setSelectedImage(message.imageUrl!)}
                              >
                                <img
                                  src={message.imageUrl}
                                  alt="첨부 이미지"
                                  className="w-full h-auto max-h-48 object-cover hover:opacity-90 transition-opacity"
                                  onError={(e) => {
                                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E이미지 로드 실패%3C/text%3E%3C/svg%3E';
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200">
                                  <i className="fas fa-expand text-white opacity-0 group-hover:opacity-80 text-sm"></i>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {message.type === 'system' && (
                      <span>{message.message}</span>
                    )}
                  </div>
                ))}
                
                {messages.length === 0 && (
                  <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                    <i className="fas fa-comments text-2xl mb-2"></i>
                    <p className="text-sm">아직 메시지가 없습니다.</p>
                    <p className="text-xs">첫 번째 메시지를 보내보세요!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* 이미지 미리보기 (데스크톱) */}
            {imageUploads.length > 0 && (
              <div className="px-3 py-2 bg-gray-100 dark:bg-[#0B0B0B] border-t border-gray-200 dark:border-[#1A1A1B]">
                <div className="flex flex-wrap gap-2">
                  {imageUploads.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`미리보기 ${index + 1}`}
                        className="w-16 h-16 object-cover rounded border border-gray-300 dark:border-gray-600"
                      />
                      <button
                        type="button"
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
            
            {/* 채팅 입력 */}
            <div className="p-3 border-t border-gray-200 dark:border-[#1A1A1B]">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={isUploading}
                  size="sm"
                  variant="ghost"
                  className="flex-shrink-0"
                  title="파일 첨부"
                >
                  <span style={{ fontSize: '20px' }}>📎</span>
                </Button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  multiple
                  className="hidden"
                  style={{ display: 'none' }}
                />
                
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isUploading ? "업로드 중..." : "메시지를 입력하세요..."}
                  className="flex-1 bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  disabled={isSendingMessage || isUploading}
                  maxLength={500}
                />
                <Button
                  type="submit"
                  disabled={(!newMessage.trim() && imageUploads.length === 0) || isSendingMessage || isUploading}
                  size="sm"
                  className="px-3"
                >
                  {isSendingMessage || isUploading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <span style={{ fontSize: '18px' }}>✈️</span>
                  )}
                </Button>
              </form>
            </div>
          </div>
          </div>
        </div>
      
        {/* 오른쪽 사이드바 - 참여자 목록 */}
        <div className="w-74 bg-gray-50 dark:bg-[#0B0B0B] flex flex-col border-l border-gray-200 dark:border-[#1A1A1B] transition-colors">
        {/* 사이드바 헤더 */}
        <div className="p-4 border-b border-gray-200 dark:border-[#1A1A1B]">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <i className="fas fa-users text-green-600 dark:text-green-400"></i>
            참여자 ({connectedUsers.length})
          </h3>
        </div>
        
        {/* 참여자 목록 */}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-3">
            {/* 메인에 화면 공유 표시 중일 때는 해당 사용자 제외하고 표시 */}
            {connectedUsers
              .filter(callUser => {
                // 메인에 화면 공유 표시 중이면 해당 사용자 제외
                if (mainScreenShare && callUser.id === mainScreenShare.userId) {
                  return false;
                }
                return true;
              })
              .map((callUser) => (
              <div
                key={callUser.id}
                className={`flex flex-col gap-3 p-3 rounded-lg transition-all duration-200 ${
                  callUser.isMuted 
                    ? 'bg-gray-100 dark:bg-[#1A1A1B] border border-red-300 dark:border-red-500/20' 
                    : 'bg-gray-100 dark:bg-[#1A1A1B] border border-green-300 dark:border-green-500/20'
                }`}
              >
                {/* 비디오 영역 (영상 채널인 경우) */}
                {isVideoCall && (
                  <div className="relative w-full h-64 bg-gray-200 dark:bg-[#0B0B0B] rounded-lg overflow-hidden group cursor-pointer transition-colors"
                       onClick={() => handleExpandVideo(callUser)}>
                    {!callUser.isVideoOff ? (
                      <div className="w-full h-full relative">
                              <video
                                ref={(el) => {
                                  if (el && callUser.stream) {
                                    // 로컬/원격 모두 srcObject 설정
                                    if (el.srcObject !== callUser.stream) {
                                      const isLocal = callUser.id === user?.uid;
                                      console.log(`📹 비디오 연결 (사이드바): ${callUser.name} (${isLocal ? '로컬' : '원격'})`);
                                      el.srcObject = callUser.stream;
                                      el.play().catch(err => {
                                        if (err.name !== 'AbortError') {
                                          console.error('비디오 재생 실패:', err);
                                        }
                                      });
                                    }
                                  }
                                }}
                                autoPlay
                                muted={callUser.id === user?.uid}
                                playsInline
                                controls={false}
                                className="w-full h-full object-cover"
                                onLoadedMetadata={(e) => {
                                  const video = e.currentTarget;
                                  console.log(`📹 비디오 메타데이터 로드 (${callUser.name}):`, {
                                    width: video.videoWidth,
                                    height: video.videoHeight,
                                    readyState: video.readyState
                                  });
                                }}
                                onCanPlay={(e) => {
                                  console.log(`📹 비디오 재생 준비 완료: ${callUser.name}`);
                                  setIsVideoReady(true);
                                  if (e.currentTarget.paused) {
                                    e.currentTarget.play().catch(err => {
                                      if (err.name !== 'AbortError') {
                                        console.error('비디오 재생 실패:', err);
                                      }
                                    });
                                  }
                                }}
                                onPlay={() => {
                                  console.log(`▶️ 비디오 재생 시작: ${callUser.name}`);
                                  setIsVideoReady(true);
                                }}
                                onError={(e) => {
                                  console.error(`❌ 비디오 재생 오류 (${callUser.name}):`, e.currentTarget.error);
                                }}
                              />
                        
                        {/* 확대/메인 보기 버튼들 (호버 시 표시) */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                          <div 
                            className="bg-black bg-opacity-60 rounded-full p-2 text-white hover:bg-opacity-80 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              showScreenShareInMain(callUser);
                            }}
                            title="메인으로 보기"
                          >
                            <i className="fas fa-tv text-sm"></i>
                          </div>
                          <div className="bg-black bg-opacity-60 rounded-full p-2 text-white hover:bg-opacity-80">
                            <i className="fas fa-expand text-sm" title="확대하기"></i>
                          </div>
                        </div>
                        
                        {/* 비디오 로딩 상태 */}
                        {callUser.id === user?.uid && !isVideoReady && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
                            <div className="text-center text-white">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                              <p className="text-xs">로딩 중...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center text-gray-600 dark:text-gray-400">
                          <i className="fas fa-video-slash text-2xl mb-2"></i>
                          <p className="text-xs">카메라 꺼짐</p>
                        </div>
                      </div>
                    )}
                    
                    {/* 비디오 오버레이 정보 */}
                    <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 rounded px-2 py-1 flex items-center gap-1">
                      <span className="text-xs font-medium text-white">{callUser.name}</span>
                      {callUser.isMuted && (
                        <i className="fas fa-microphone-slash text-red-400 text-xs"></i>
                      )}
                      {callUser.isVideoOff && (
                        <i className="fas fa-video-slash text-red-400 text-xs"></i>
                      )}
                    </div>
                    
                    {/* 본인 표시 */}
                    {callUser.id === user?.uid && (
                      <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        나
                      </div>
                    )}
                  </div>
                )}
                
                {/* 프로필 정보 (음성 채널이거나 비디오가 꺼진 경우) */}
                {!isVideoCall && (
                  <div className="flex items-center gap-3">
                    {/* 프로필 사진 */}
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={callUser.photoURL} alt={callUser.name} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
                          {callUser.name[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* 말하는 중 애니메이션 */}
                      {!callUser.isMuted && (
                        <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-pulse"></div>
                      )}
                      
                      {/* 상태 아이콘 */}
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                        callUser.isMuted ? 'bg-red-500' : 'bg-green-500'
                      }`}>
                        <i className={`fas ${callUser.isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-xs`}></i>
                      </div>
                    </div>
                    
                    {/* 사용자 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {callUser.name}
                        </span>
                        {callUser.id === user?.uid && (
                          <span className="text-xs bg-blue-500 dark:bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                            나
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <div className={`w-2 h-2 rounded-full ${
                          callUser.isMuted ? 'bg-red-400 dark:bg-red-500' : 'bg-green-400 dark:bg-green-500'
                        }`}></div>
                        <span className={`text-xs ${
                          callUser.isMuted ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                          {callUser.isMuted ? '음소거' : '활성'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 영상 채널에서 상태 정보만 표시 */}
                {isVideoCall && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        callUser.isMuted ? 'bg-red-400 dark:bg-red-500' : 'bg-green-400 dark:bg-green-500'
                      }`}></div>
                      <span className={`text-xs ${
                        callUser.isMuted ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {callUser.isMuted ? '음소거' : '활성'}
                      </span>
                    </div>
                    
                    {callUser.isVideoOff && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">카메라 꺼짐</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* 컨트롤 버튼 */}
        <div className="p-4 border-t border-gray-200 dark:border-[#1A1A1B]">
          <div className="flex justify-center gap-3">
        <Button
          onClick={toggleMute}
          variant={isMuted ? "destructive" : "secondary"}
          size="lg"
          className={`w-12 h-12 rounded-full ${
            isMuted 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-gray-600 hover:bg-gray-700'
          }`}
        >
          <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
        </Button>
        
        {isVideoCall && (
            <Button
              onClick={toggleVideo}
              variant={isVideoOff ? "destructive" : "secondary"}
              size="lg"
              className={`w-12 h-12 rounded-full ${
                isVideoOff 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
              title={isVideoOff ? '카메라 켜기' : '카메라 끄기'}
            >
              <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
            </Button>
          )}
          
          {isVideoCall && (
            <Button
              onClick={toggleScreenShare}
              variant={isScreenSharing ? "default" : "secondary"}
              size="lg"
              className={`w-12 h-12 rounded-full ${
                isScreenSharing 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
              title={isScreenSharing ? '화면 공유 중지' : '화면 공유 시작'}
            >
              <i className={`fas ${isScreenSharing ? 'fa-stop' : 'fa-desktop'}`}></i>
            </Button>
          )}
          </div>
        </div>
        </div>
        </>
      )}
      
      {/* 비디오 확대 모달 */}
      {expandedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
             onClick={handleCloseExpandedVideo}>
          <div className="relative w-full h-full max-w-6xl max-h-[90vh] flex items-center justify-center p-4">
            {/* 확대된 비디오 */}
            <video
              ref={expandedVideoRef}
              autoPlay
              muted={expandedVideo.userId === user?.uid}
              playsInline
              controls={false}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* 컨트롤 버튼들 */}
            <div className="absolute top-4 right-4 flex gap-2">
              {/* 전체화면 버튼 */}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFullscreen();
                }}
                variant="secondary"
                size="sm"
                className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white border-gray-600"
              >
                <i className="fas fa-expand mr-2"></i>
                전체화면
              </Button>
              
              {/* 닫기 버튼 */}
              <Button
                onClick={handleCloseExpandedVideo}
                variant="secondary"
                size="sm"
                className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white border-gray-600"
              >
                <i className="fas fa-times mr-2"></i>
                닫기
              </Button>
            </div>
            
            {/* 사용자 정보 */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 rounded-lg px-4 py-2">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={connectedUsers.find(u => u.id === expandedVideo.userId)?.photoURL} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
                    {expandedVideo.userName[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white font-medium">{expandedVideo.userName}</p>
                  <p className="text-gray-300 text-sm flex items-center gap-1">
                    {expandedVideo.isScreenShare ? (
                      <>
                        <i className="fas fa-desktop text-blue-400"></i>
                        화면 공유 중
                      </>
                    ) : (
                      <>
                        <i className="fas fa-video text-green-400"></i>
                        카메라
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            {/* 확대 안내 */}
            <div className="absolute top-4 left-4 bg-black bg-opacity-60 rounded-lg px-3 py-2">
              <p className="text-white text-sm flex items-center gap-2">
                <i className="fas fa-mouse-pointer text-blue-400"></i>
                배경 클릭 시 닫기
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 이미지 확대 모달 */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]"
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

export default VoiceVideoCall;
