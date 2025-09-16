import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  createOrGetChatRoom, 
  sendChatMessage, 
  getChatMessages,
  subscribeToMessages,
  getUserChatRooms,
  markMessagesAsRead,
  db
} from '@/firebase';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { avatarSamples } from '@/data/avatarSamples';
import { normalizeImageUrl } from '@/lib/url';
import { useToast } from '@/hooks/use-toast';

// 메시지 타입에 이미지 URL 추가
interface Message {
  id: number | string;
  content: string;
  sender: string;
  timestamp: string;
  raw?: any; // Firestore 원본 데이터 (필요시)
  imageUrl?: string; // 이미지 URL 필드 추가
  senderName?: string;
  senderAvatar?: string;
  isBot?: boolean;
}

// 채팅 파트너 정보 타입
interface ChatPartner {
  id: number | string;
  name: string;
  imageUrl?: string;
}

// 채팅 목록 항목 타입
interface ChatListItem {
  id: number | string;
  senderId: number | string;
  senderName: string;
  senderImage?: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

// Firestore 채팅방 타입 정의
interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastActivity?: {
    seconds: number;
    nanoseconds: number;
  };
  createdAt?: any;
}

// Firestore 메시지 타입에 이미지 URL 추가
interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  };
  read: boolean;
  imageUrl?: string; // 이미지 URL 필드 추가
}

interface MainContentProps {
  children?: React.ReactNode;
  currentChannel?: string;
  channelType?: 'firebase' | 'vtuber';
}

const MainContent: React.FC<MainContentProps> = ({ children, currentChannel, channelType = 'firebase' }) => {
  const { user, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [chatPartner, setChatPartner] = useState<ChatPartner | null>(null);
  const [roomId, setRoomId] = useState<string | null>(currentChannel || 'general');
  const [showChatList, setShowChatList] = useState(true);
  const [chatList, setChatList] = useState<ChatListItem[]>([]); // 빈 배열로 시작
  const [needAuth, setNeedAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messageListenerRef = useRef<(() => void) | null>(null);
  
  // VTuber WebSocket 연결 상태 (아바타 채팅용)
  const [wsConnected, setWsConnected] = useState(false);
  const [vtuberConnecting, setVtuberConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  // 전화번호 표시 모달 상태
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  
  // 상태 관리 부분 수정 - 단일 이미지에서 여러 이미지로 변경
  const [imageUploads, setImageUploads] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // VTuber WebSocket 연결 함수
  const connectToVTuber = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN || vtuberConnecting) {
      return;
    }

    setVtuberConnecting(true);
    
    try {
      const vtuberBaseUrl = "https://decomsoft.com/vtuber";
      const wsUrl = vtuberBaseUrl.replace(/^https?:/, vtuberBaseUrl.startsWith('https:') ? 'wss:' : 'ws:') + '/client-ws';
      console.log('VTuber WebSocket 연결 시도:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('VTuber WebSocket 연결 성공');
        setWsConnected(true);
        setVtuberConnecting(false);
        setConnectionAttempts(0);
        
        // 연결 성공 메시지 추가
        setMessages(prev => [...prev, {
          id: Date.now(),
          content: 'AI 아바타와 연결되었습니다. 대화를 시작해보세요!',
          sender: 'system',
          timestamp: new Date().toISOString(),
          isBot: false,
          senderName: 'System',
          senderAvatar: ''
        }]);

        // 초기화 메시지 전송
        ws.send(JSON.stringify({
          type: 'request-init-config'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('VTuber 서버로부터 메시지:', data);
          
          // AI 응답 처리
          if (data.type === 'llm-response' || data.type === 'ai-response') {
            setMessages(prev => [...prev, {
              id: Date.now(),
              content: data.text || data.content || '응답을 받았습니다.',
              sender: 'ai',
              timestamp: new Date().toISOString(),
              isBot: true,
              senderName: 'AI 아바타',
              senderAvatar: avatarSamples[0]?.avatar || ''
            }]);
          }
        } catch (error) {
          console.error('메시지 파싱 오류:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('VTuber WebSocket 오류:', error);
        setVtuberConnecting(false);
        
        toast({
          title: "연결 오류",
          description: "AI 아바타 서버에 연결할 수 없습니다.",
          variant: "destructive",
        });
      };

      ws.onclose = (event) => {
        console.log('VTuber WebSocket 연결 종료:', event.code, event.reason);
        setWsConnected(false);
        setVtuberConnecting(false);
        
        // 자동 재연결 시도
        if (connectionAttempts < maxReconnectAttempts && !event.wasClean) {
          setConnectionAttempts(prev => prev + 1);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`재연결 시도 ${connectionAttempts + 1}/${maxReconnectAttempts}`);
            connectToVTuber();
          }, 3000 * (connectionAttempts + 1));
        }
      };

      wsRef.current = ws;
      
    } catch (error) {
      console.error('WebSocket 연결 오류:', error);
      setVtuberConnecting(false);
    }
  }, [vtuberConnecting, connectionAttempts, toast]);

  // VTuber 메시지 전송 함수
  const sendVTuberMessage = useCallback(async () => {
    if (!message.trim() || !wsConnected) {
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "연결 오류",
        description: "AI 아바타 서버에 연결되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    const messageText = message.trim();
    
    try {
      // 사용자 메시지 추가
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: messageText,
        sender: 'user',
        timestamp: new Date().toISOString(),
        isBot: false,
        senderName: user?.displayName || user?.email?.split('@')[0] || '사용자',
        senderAvatar: user?.photoURL || ''
      }]);

      // VTuber 서버로 메시지 전송
      const vtuberMessage = {
        type: 'text-input',
        text: messageText
      };
      
      wsRef.current.send(JSON.stringify(vtuberMessage));
      console.log('VTuber 메시지 전송:', vtuberMessage);
      
      setMessage("");
      
    } catch (error) {
      console.error('VTuber 메시지 전송 오류:', error);
      toast({
        title: "전송 오류",
        description: "메시지를 전송할 수 없습니다.",
        variant: "destructive",
      });
    }
  }, [message, wsConnected, user, toast]);
  
  // Firestore 연결 상태 설정
  useEffect(() => {
    if (db) {
      setIsConnected(true);
    } else {
      setIsConnected(false);
    }
    
    return () => {
      // 이전 메시지 리스너가 있다면 해제
      if (messageListenerRef.current) {
        messageListenerRef.current();
      }
    };
  }, []);

  // URL에서 'to' 매개변수를 가져와서 해당 채팅방으로 이동
  useEffect(() => {
    if (!user) {
      // 사용자가 없으면 더 이상 처리하지 않음
      return;
    }
    
    console.log("현재 URL:", location);
    
    // URL 매개변수 추출
    const urlParams = new URLSearchParams(window.location.search);
    const toParam = urlParams.get('to');
    const nameParam = urlParams.get('name');
    console.log("URL 파라미터 'to':", toParam, "name:", nameParam);
    
    if (toParam) {
      // 자신과의 채팅인지 확인
      if (toParam === user.uid) {
        console.warn("자신과의 채팅 시도:", toParam);
        alert("자신과의 채팅은 지원되지 않습니다.");
        setLocation("/chat");
        return;
      }
      
      console.log("채팅방 진입 시도 - ID:", toParam);
      setIsLoading(true);
      setShowChatList(false); // 채팅 목록 숨기기
      
      // 문자열로 된 ID를 타겟 ID로 변환
      const targetId = toParam;
      
      // Firestore를 사용하여 채팅방 생성/참여
      createOrGetChatRoom(user.uid, targetId)
        .then(result => {
          if (result.success) {
            const newRoomId = result.roomId || "";
            setRoomId(newRoomId);
            console.log("채팅방 생성/참여 성공:", newRoomId);
            
            // 채팅 파트너 정보 찾기
            const partnerInfo = chatList.find(m => m.senderId.toString() === targetId);
            
            // 채팅 파트너 정보 설정 - URL에서 받은 이름 우선 사용
            let partnerName = partnerInfo?.senderName || `아바타 #${targetId}`;
            if (nameParam) {
              partnerName = decodeURIComponent(nameParam);
            }
            
            const partner: ChatPartner = {
              id: targetId,
              name: partnerName,
              imageUrl: partnerInfo?.senderImage || "/placeholder-avatar.png"
            };
            
            setChatPartner(partner);
            
            // 메시지 내역 로드
            if (newRoomId) {
              getChatMessages(newRoomId)
                .then(messageResult => {
                  if (messageResult.success && messageResult.messages) {
                    // 메시지 포맷 변환 - any 타입으로 처리
                    const formattedMessages = messageResult.messages.map((msg: any) => ({
                      id: msg.id,
                      content: msg.content || '',
                      sender: msg.senderId === user.uid ? 'user' : 'other',
                      timestamp: formatMessageTimestamp(msg.timestamp),
                      imageUrl: msg.imageUrl,
                      raw: msg
                    }));
                    
                    setMessages(formattedMessages);
                    console.log("메시지 내역 로드 완료:", formattedMessages.length, "개");
                    
                    // 읽지 않은 메시지들을 읽음으로 표시
                    markMessagesAsRead(newRoomId, user.uid).catch(err => {
                      console.log("메시지 읽음 표시 실패 (무시됨):", err);
                    });
                  } else {
                    console.log("메시지 내역이 없습니다.");
                    setMessages([]);
                  }
                  
                  // 이전 리스너가 있다면 해제
                  if (messageListenerRef.current) {
                    messageListenerRef.current();
                  }
                  
                  // 실시간 메시지 구독
                  messageListenerRef.current = subscribeToMessages(newRoomId, (newMessages: ChatMessage[]) => {
                    const formattedNewMessages = newMessages.map(msg => ({
                      id: msg.id,
                      content: msg.content,
                      sender: msg.senderId === user.uid ? 'user' : 'other',
                      timestamp: formatMessageTimestamp(msg.timestamp),
                      imageUrl: msg.imageUrl,
                      raw: msg
                    }));
                    
                    setMessages(formattedNewMessages);
                    
                    // 새 메시지가 도착하면 자동으로 읽음 표시
                    markMessagesAsRead(newRoomId, user.uid).catch(err => {
                      console.log("새 메시지 읽음 표시 실패 (무시됨):", err);
                    });
                  });
                  
                  setIsLoading(false);
                  setIsInitialized(true);
                })
                .catch(error => {
                  console.error("메시지 내역 로드 중 오류:", error);
                  setIsLoading(false);
                  setIsInitialized(true);
                });
            } else {
              setIsLoading(false);
            }
            
            // 상대방 전화번호 가져오기 (실제로는 API에서 가져와야 함)
            setPhoneNumber(`010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`);
            
          } else {
            console.error("채팅방 생성/참여 실패:", result.error);
            setIsLoading(false);
            
            // 실패 시 채팅 목록으로 돌아가기
            setShowChatList(true);
            alert("채팅방 생성에 실패했습니다. 다시 시도해주세요.");
          }
        })
        .catch(error => {
          console.error("채팅방 생성/참여 중 오류:", error);
          setIsLoading(false);
          
          // 오류 시 채팅 목록으로 돌아가기
          setShowChatList(true);
          alert("채팅방 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
        });
    } else {
      console.log("채팅 목록 표시 (URL 파라미터 없음)");
      // 'to' 파라미터가 없으면 일반 채널로 설정
      setShowChatList(false);
      setChatPartner(null);
      setRoomId('general');
      setMessages([]);
      setIsInitialized(false);
      
      // 이전 메시지 리스너가 있다면 해제
      if (messageListenerRef.current) {
        messageListenerRef.current();
        messageListenerRef.current = null;
      }
    }
  }, [user, location]); // location을 의존성에 추가하여 URL 변경시 다시 실행

  // 메시지 목록이 업데이트될 때마다 스크롤을 아래로 이동
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages]);

  // Firebase 채팅방 초기화 (Firebase 채널용)
  useEffect(() => {
    if (!user || channelType !== 'firebase') return;
    if (!db) {
      console.error('Firebase DB가 초기화되지 않았습니다.');
      return;
    }

    const initializeFirebaseChatRoom = async () => {
      try {
        console.log('Firebase 채팅방 초기화 시작:', currentChannel);
        console.log('사용자 인증 상태:', user.uid, user.email);
        
        // 채널에 따른 채팅방 ID 설정
        const chatRoomId = currentChannel || 'general';
        
        // 사용자 인증이 완료될 때까지 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Firebase 채팅 직접 초기화 시도:', chatRoomId);
        
        try {
          // 채팅방 생성 없이 바로 메시지 로드 시도
          const messageResult = await getChatMessages(chatRoomId);
          if (messageResult.success && messageResult.messages) {
            console.log('메시지 로드 완료:', messageResult.messages.length, '개');
            const formattedMessages = messageResult.messages.map((msg: any) => ({
              id: msg.id,
              content: msg.content,
              sender: msg.senderId === user.uid ? 'user' : 'other',
              timestamp: formatMessageTimestamp(msg.timestamp),
              imageUrl: msg.imageUrl,
              senderName: getSenderName(msg.senderId),
              senderAvatar: getSenderAvatar(msg.senderId),
              isBot: msg.senderId !== user.uid && msg.senderId.startsWith('avatar_'),
            }));
            setMessages(formattedMessages);
          } else {
            console.log('메시지가 없음 - 빈 채팅방으로 시작');
            setMessages([]);
          }

          // 이전 리스너 해제
          if (messageListenerRef.current) {
            messageListenerRef.current();
          }

          // 실시간 메시지 구독 - 전체 메시지 배열을 받음
          const unsubscribe = subscribeToMessages(chatRoomId, (newMessages: any[]) => {
            console.log('실시간 메시지 업데이트:', newMessages.length, '개');
            const formattedMessages = newMessages.map((msg: any) => ({
              id: msg.id,
              content: msg.content,
              sender: msg.senderId === user.uid ? 'user' : 'other',
              timestamp: formatMessageTimestamp(msg.timestamp),
              imageUrl: msg.imageUrl,
              senderName: getSenderName(msg.senderId),
              senderAvatar: getSenderAvatar(msg.senderId),
              isBot: msg.senderId !== user.uid && msg.senderId.startsWith('avatar_'),
            }));
            
            setMessages(formattedMessages);
          });

          messageListenerRef.current = unsubscribe;
          console.log('Firebase 채팅 초기화 완료');
          
        } catch (directError) {
          console.error('직접 메시지 로드 실패:', directError);
          
          // 그래도 채팅방 생성을 시도해보기
          console.log('채팅방 생성 시도:', chatRoomId, `public_${chatRoomId}`);
          const result = await createOrGetChatRoom(chatRoomId, `public_${chatRoomId}`);
          
          if (result.success) {
            console.log('Firebase 채팅방 준비 완료:', result.roomId);
            setMessages([]);
          } else {
            console.error('채팅방 생성도 실패:', result.error);
            // 권한 오류인 경우 사용자에게 알림
            if (result.error && typeof result.error === 'object' && 'code' in result.error && result.error.code === 'permission-denied') {
              toast({
                title: "권한 오류",
                description: "채팅방에 접근할 권한이 없습니다. 다시 로그인해주세요.",
                variant: "destructive",
              });
            }
          }
        }
      } catch (error) {
        console.error('Firebase 채팅방 초기화 오류:', error);
        toast({
          title: "연결 오류",
          description: "채팅 서버에 연결할 수 없습니다.",
          variant: "destructive",
        });
      }
    };

    initializeFirebaseChatRoom();
  }, [user, channelType, currentChannel, toast]);

  const formatMessageTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    
    return formatDistanceToNow(date, { addSuffix: true, locale: ko });
  };

  const getSenderName = (senderId: string): string => {
    if (senderId === user?.uid) {
      return user.displayName || user.email?.split('@')[0] || '나';
    }
    
    // 아바타 ID인 경우
    if (senderId.startsWith('avatar_')) {
      const avatarId = senderId.replace('avatar_', '');
      const avatar = avatarSamples.find(a => a.id === avatarId);
      return avatar?.name || '아바타';
    }
    
    return '사용자';
  };

  const getSenderAvatar = (senderId: string): string | undefined => {
    if (senderId === user?.uid) {
      return user.photoURL || undefined;
    }
    
    // 아바타 ID인 경우
    if (senderId.startsWith('avatar_')) {
      const avatarId = senderId.replace('avatar_', '');
      const avatar = avatarSamples.find(a => a.id === avatarId);
      return avatar?.avatar;
    }
    
    return undefined;
  };

  // URL이 상대 경로인 경우 절대 경로로 변환
  const getAbsoluteImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    return normalizeImageUrl(url);
  };

  // URL 감지 및 링크 변환 함수
  const convertLinksToHtml = (text: string) => {
    if (!text) return '';
    
    // URL 패턴 (http, https로 시작하는 링크)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // URL을 <a> 태그로 교체
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" class="text-blue-400 underline hover:text-blue-300" rel="noopener noreferrer">${url}</a>`;
    });
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      const validFiles: File[] = [];
      
      // 각 파일에 대해 유효성 검사
      files.forEach(file => {
        // 파일 크기 제한 (5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert(`파일 '${file.name}'의 크기가 5MB를 초과합니다. 더 작은 이미지를 선택해주세요.`);
          return;
        }
        
        // 파일 타입 제한
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          alert(`'${file.name}'은(는) 지원되지 않는 파일 형식입니다. JPG, PNG, GIF, WEBP 파일만 업로드 가능합니다.`);
          return;
        }
        
        validFiles.push(file);
      });
      
      setImageUploads(prevFiles => [...prevFiles, ...validFiles]);
      console.log(`${validFiles.length}개의 이미지 선택됨`);
    }
  };
  
  // 이미지 첨부 버튼 클릭 핸들러
  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 이미지 제거 핸들러
  const handleRemoveImage = (index: number) => {
    setImageUploads(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  // 채널 타입에 따른 연결 설정
  useEffect(() => {
    if (channelType === 'vtuber' && user && !wsConnected && !vtuberConnecting) {
      connectToVTuber();
    } else if (channelType === 'firebase') {
      // Firebase 연결 로직은 기존 useEffect에서 처리
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && channelType === 'vtuber') {
        wsRef.current.close();
      }
    };
  }, [channelType, user, wsConnected, vtuberConnecting, connectToVTuber]);

  // 메시지 전송 함수 - 채널 타입에 따라 분기
  const handleSendMessage = useCallback(async () => {
    if (channelType === 'vtuber') {
      await sendVTuberMessage();
    } else {
      await handleFirebaseSendMessage();
    }
  }, [channelType, sendVTuberMessage]);

  // Firebase 메시지 전송 함수
  const handleFirebaseSendMessage = useCallback(async () => {
    if ((!message.trim() && imageUploads.length === 0) || !user) return;
    
    const chatRoomId = currentChannel ?? 'general';
    
    const trimmedMessage = message.trim();
    const imageUrls: string[] = [];
    
    // 메시지 입력창 초기화 (즉시 UI 반응)
    setMessage("");
    
    // 이미지가 있으면 업로드
    if (imageUploads.length > 0) {
      setIsUploading(true);
      try {
        // 모든 이미지 업로드 작업 병렬 처리
        const uploadPromises = imageUploads.map(async (file) => {
          console.log("이미지 업로드 시작:", file.name);
          
          // 서버 API로 이미지 업로드
          const formData = new FormData();
          formData.append('image', file);
          
          // 채팅방 ID를 쿼리 파라미터로 전달
          const uploadResponse = await fetch(`/api/upload/chat-image?roomId=${chatRoomId}`, {
            method: 'POST',
            body: formData
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`이미지 업로드 실패: ${uploadResponse.status}`);
          }
          
          const uploadResult = await uploadResponse.json();
          if (uploadResult.success && uploadResult.url) {
            console.log("이미지 업로드 성공:", uploadResult.url);
            return uploadResult.url;
          } else {
            throw new Error("이미지 업로드 응답이 올바르지 않습니다");
          }
        });
        
        // 모든 업로드가 완료될 때까지 기다림
        imageUrls.push(...await Promise.all(uploadPromises));
      } catch (error) {
        console.error("이미지 업로드 중 오류:", error);
        alert("일부 이미지 업로드에 실패했습니다. 다시 시도해주세요.");
        setIsUploading(false);
        return; // 이미지 업로드 실패 시 메시지 전송 중단
      } finally {
        setIsUploading(false);
        setImageUploads([]); // 업로드 완료 후 이미지 목록 초기화
      }
    }
    
    try {
      console.log("메시지 전송 시도:", trimmedMessage, "이미지:", imageUrls.length > 0 ? `${imageUrls.length}개` : "없음");
      
      // 이미지와 텍스트를 하나의 메시지로 전송 (이미지를 그룹화)
      const result = await sendChatMessage(chatRoomId, trimmedMessage, user.uid, imageUrls.join(','));
      
      if (!result.success) {
        console.error("메시지 전송 실패:", result.error);
        alert("메시지 전송에 실패했습니다.");
      }
    } catch (error) {
      console.error("메시지 전송 중 오류:", error);
      alert("메시지 전송 중 오류가 발생했습니다.");
    }
  }, [message, imageUploads, currentChannel, user]);

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 전화 버튼 클릭 핸들러
  const handlePhoneClick = () => {
    setShowPhoneModal(true);
  };

  // 메시지 표시 부분 수정 - 여러 이미지를 그룹으로 표시
  const renderMessage = (msg: Message) => {
    // 쉼표로 구분된 이미지 URL을 배열로 변환
    const imageUrls = msg.imageUrl ? msg.imageUrl.split(',') : [];
    
    // URL을 HTML 링크로 변환
    const htmlContent = convertLinksToHtml(msg.content);
    
    return (
      <div key={msg.id} className="flex items-start space-x-3 hover:bg-gray-700 hover:bg-opacity-30 p-2 rounded group">
        <Avatar className="w-10 h-10 mt-0.5">
          <AvatarImage src={msg.senderAvatar || undefined} />
          <AvatarFallback className={`text-white ${
            msg.isBot 
              ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
              : 'bg-gradient-to-br from-blue-500 to-cyan-500'
          }`}>
            {msg.senderName?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline space-x-2">
            <span className={`font-medium ${
              msg.isBot ? 'text-purple-300' : msg.sender === 'user' ? 'text-blue-300' : 'text-white'
            }`}>
              {msg.senderName || (msg.sender === 'user' ? '나' : '사용자')}
            </span>
            {msg.isBot && (
              <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                BOT
              </span>
            )}
            <span className="text-xs text-gray-400">{msg.timestamp}</span>
          </div>
          {imageUrls.length > 0 && (
            <div className="mt-2">
              {imageUrls.length === 1 ? (
                // 이미지가 하나인 경우
                <div className="rounded-lg overflow-hidden max-w-xs">
                  <img 
                    src={getAbsoluteImageUrl(imageUrls[0])} 
                    alt="첨부 이미지" 
                    className="max-w-full h-auto cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(getAbsoluteImageUrl(imageUrls[0]), '_blank')}
                  />
                </div>
              ) : (
                // 이미지가 여러 개인 경우 - 그리드 형태로 표시
                <div className="grid grid-cols-2 gap-1 max-w-xs">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="rounded-lg overflow-hidden">
                      <img 
                        src={getAbsoluteImageUrl(url)} 
                        alt={`첨부 이미지 ${index + 1}`} 
                        className="w-full h-auto cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(getAbsoluteImageUrl(url), '_blank')}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {msg.content && (
            <div 
              className="text-gray-100 mt-1 break-words" 
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
          <Button variant="ghost" size="sm" className="w-7 h-7 p-0 text-gray-400 hover:text-white">
            <i className="fas fa-smile text-sm"></i>
          </Button>
          <Button variant="ghost" size="sm" className="w-7 h-7 p-0 text-gray-400 hover:text-white">
            <i className="fas fa-reply text-sm"></i>
          </Button>
          <Button variant="ghost" size="sm" className="w-7 h-7 p-0 text-gray-400 hover:text-white">
            <i className="fas fa-ellipsis-h text-sm"></i>
          </Button>
        </div>
      </div>
    );
  };

  if (children) {
    return (
      <div className="flex-1 bg-gray-600 flex flex-col">
        {children}
      </div>
    );
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex-1 bg-gray-600 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-purple-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300">채팅방을 로드하는 중...</p>
        </div>
      </div>
    );
  }

  // 개별 채팅방 (DM)
  if (chatPartner) {
    return (
      <div className="flex-1 bg-gray-600 flex flex-col">
        {/* 채널 헤더 */}
        <div className="h-12 bg-gray-600 border-b border-gray-500 flex items-center px-4 shadow-sm">
          <div className="flex items-center">
            <Avatar className="w-8 h-8 mr-3">
              <AvatarImage src={getAbsoluteImageUrl(chatPartner?.imageUrl)} />
              <AvatarFallback className="bg-purple-100 text-purple-600">{chatPartner?.name?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <h2 className="text-white font-semibold">{chatPartner?.name}</h2>
          </div>
          <div className="ml-4 text-sm text-gray-300">
            AI 아바타와의 개인 대화
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-300 hover:text-white hover:bg-gray-500" onClick={handlePhoneClick}>
              <i className="fas fa-phone"></i>
            </Button>
            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-300 hover:text-white hover:bg-gray-500">
              <i className="fas fa-video"></i>
            </Button>
            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-300 hover:text-white hover:bg-gray-500">
              <i className="fas fa-users"></i>
            </Button>
          </div>
        </div>

        {/* 메시지 영역 */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 py-4">
          <div className="space-y-4">
            {/* 채팅 시작 메시지 */}
            {messages.length === 0 && (
              <div className="mb-8">
                <Avatar className="w-16 h-16 mb-4">
                  <AvatarImage src={getAbsoluteImageUrl(chatPartner?.imageUrl)} />
                  <AvatarFallback className="bg-purple-100 text-purple-600 text-2xl">{chatPartner?.name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <h3 className="text-2xl font-bold text-white mb-2">{chatPartner?.name}와의 대화</h3>
                <p className="text-gray-300">AI 아바타와 함께 대화를 시작해보세요.</p>
              </div>
            )}

            {/* 메시지 목록 */}
            {messages.map(msg => renderMessage(msg))}
          </div>
        </ScrollArea>

        {/* 메시지 입력 영역 */}
        <div className="p-4">
          {/* 이미지 미리보기 */}
          {imageUploads.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {imageUploads.map((file, index) => (
                <div key={index} className="relative border border-gray-500 rounded-md overflow-hidden p-1 bg-gray-700">
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt={`업로드 이미지 ${index + 1}`} 
                    className="h-20 w-auto object-cover"
                  />
                  <button 
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-0 right-0 bg-red-500 bg-opacity-70 text-white rounded-full p-1 text-xs"
                    type="button"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="bg-gray-500 rounded-lg">
            <div className="flex items-end p-3 space-x-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-8 h-8 p-0 text-gray-300 hover:text-white"
                onClick={handleAttachClick}
                disabled={isUploading}
              >
                <i className="fas fa-paperclip"></i>
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
                  placeholder={isUploading ? "이미지 업로드 중..." : "메시지를 입력하세요..."}
                  className="bg-transparent border-none text-white placeholder-gray-400 focus:ring-0 focus:outline-none resize-none"
                  disabled={!isConnected || isUploading}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-300 hover:text-white">
                  <i className="fas fa-gift"></i>
                </Button>
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-300 hover:text-white">
                  <i className="fas fa-smile"></i>
                </Button>
                {(message.trim() || imageUploads.length > 0) && (
                  <Button 
                    onClick={handleSendMessage}
                    size="sm" 
                    className="w-8 h-8 p-0 bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <i className="fas fa-paper-plane"></i>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {!(channelType === 'vtuber' ? wsConnected : isConnected) && (
            <p className="text-xs text-red-400 mt-1">
              {channelType === 'vtuber' 
                ? 'AI 아바타 서버에 연결 중...' 
                : '연결이 끊겼습니다. 재연결을 시도하는 중...'
              }
            </p>
          )}
        </div>

        {/* 전화번호 표시 모달 */}
        <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
          <DialogContent className="sm:max-w-md bg-gray-800 text-white border-gray-600">
            <DialogHeader>
              <DialogTitle>통화 연결</DialogTitle>
              <DialogDescription className="text-gray-400">
                아래 전화번호로 연결할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 flex flex-col items-center">
              <p className="text-xl font-bold mb-3 text-white">{phoneNumber}</p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="w-24 border-gray-600 text-gray-300 hover:bg-gray-700"
                  onClick={() => setShowPhoneModal(false)}
                >
                  취소
                </Button>
                <Button 
                  className="w-24 bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    window.location.href = `tel:${phoneNumber.replace(/-/g, '')}`;
                  }}
                >
                  전화 걸기
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // 로그인하지 않은 사용자도 일반 채널은 볼 수 있음
  return (
    <div className="flex-1 bg-gray-600 flex flex-col">
      {/* 채널 헤더 */}
      <div className="h-12 bg-gray-600 border-b border-gray-500 flex items-center px-4 shadow-sm">
        <div className="flex items-center">
          <i className="fas fa-hashtag text-gray-300 mr-2"></i>
          <h2 className="text-white font-semibold">
            {channelType === 'vtuber' ? '아바타-채팅' : '일반'}
          </h2>
        </div>
        <div className="ml-4 text-sm text-gray-300">
          {channelType === 'vtuber' 
            ? 'AI 아바타와 실시간으로 대화하는 채널입니다' 
            : 'AI 아바타들과 자유롭게 대화하는 채널입니다'
          }
        </div>
        <div className="ml-auto flex items-center space-x-2">
          <Badge variant={(channelType === 'vtuber' ? wsConnected : isConnected) ? "outline" : "destructive"} className={`px-2 py-0 text-xs ${(channelType === 'vtuber' ? wsConnected : isConnected) ? 'bg-green-100 text-green-700 border-green-200' : ''}`}>
            {(channelType === 'vtuber' ? wsConnected : isConnected) ? '연결됨' : '연결 끊김'}
          </Badge>
        </div>
      </div>

      {/* 채널별 소개 영역 */}
      {channelType === 'firebase' && (
        <div className="relative bg-gradient-to-br from-gray-700/80 via-gray-600/70 to-gray-800/90 border-b border-gray-500 overflow-hidden">
          {/* 일반 채널 */}
          {currentChannel === 'general' && (
            <>
              {/* 배경 장식 요소들 */}
              <div className="absolute top-4 left-8 w-20 h-20 bg-purple-500/20 rounded-full blur-xl"></div>
              <div className="absolute bottom-6 right-16 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"></div>
              <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-pink-500/20 rounded-full blur-lg"></div>
              
              {/* VTuber 캐릭터 - 오른쪽 배치 */}
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 hidden lg:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-2xl scale-150 animate-pulse"></div>
                  <img 
                    src="/images/2dmodel/1.png" 
                    alt="AI Avatar Character" 
                    className="w-32 h-40 object-contain relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                    style={{
                      filter: 'drop-shadow(0 0 15px rgba(168, 85, 247, 0.4))',
                      animation: 'float 6s ease-in-out infinite'
                    }}
                  />
                </div>
              </div>
              
              {/* 추가 작은 캐릭터 - 왼쪽 하단 */}
              <div className="absolute left-6 bottom-4 z-15 hidden lg:block opacity-70">
                <div className="relative">
                  <img 
                    src="/images/2dmodel/3.png" 
                    alt="AI Avatar Character" 
                    className="w-20 h-24 object-contain drop-shadow-lg hover:scale-110 transition-transform duration-300"
                    style={{
                      filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.3))',
                      animation: 'float 4s ease-in-out infinite 1s'
                    }}
                  />
                </div>
              </div>

              {/* 컨텐츠 영역 */}
              <div className="relative z-10 px-6 py-8 max-w-2xl">
                <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-4">
                      <i className="fas fa-hashtag text-white text-lg"></i>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">일반 채널에 오신 것을 환영합니다!</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-purple-500/20 text-purple-200 border-purple-400/30">
                          <i className="fas fa-users mr-1"></i>
                          커뮤니티
                        </Badge>
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-200 border-blue-400/30">
                          <i className="fas fa-comments mr-1"></i>
                          실시간 채팅
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-gray-200">
                    <p className="text-lg leading-relaxed">
                      <i className="fas fa-sparkles text-yellow-400 mr-2"></i>
                      AI 아바타들과 함께하는 특별한 대화 공간입니다.
                    </p>
                    <p className="text-sm leading-relaxed opacity-90">
                      다양한 개성을 가진 AI 아바타들과 자유롭게 대화하고, 다른 사용자들과도 소통해보세요. 
                      이미지 공유, 실시간 채팅, 그리고 즐거운 커뮤니티 경험을 만끽하실 수 있습니다.
                    </p>
                    <div className="flex items-center space-x-4 pt-2">
                      <div className="flex items-center text-sm text-green-300">
                        <i className="fas fa-circle text-green-400 mr-2 text-xs animate-pulse"></i>
                        실시간 연결됨
                      </div>
                      <div className="flex items-center text-sm text-blue-300">
                        <i className="fas fa-image mr-2"></i>
                        이미지 공유 가능
                      </div>
                      <div className="flex items-center text-sm text-purple-300">
                        <i className="fas fa-robot mr-2"></i>
                        AI 아바타 대화
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 잡담 채널 */}
          {currentChannel === 'random' && (
            <>
              {/* 배경 장식 요소들 - 더 밝고 활기찬 색상 */}
              <div className="absolute top-4 left-8 w-20 h-20 bg-orange-500/20 rounded-full blur-xl"></div>
              <div className="absolute bottom-6 right-16 w-24 h-24 bg-yellow-500/20 rounded-full blur-xl"></div>
              <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-red-500/20 rounded-full blur-lg"></div>
              
              {/* VTuber 캐릭터 - 오른쪽 배치 */}
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 hidden lg:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-yellow-400/20 rounded-full blur-2xl scale-150 animate-pulse"></div>
                  <img 
                    src="/images/2dmodel/2.png" 
                    alt="AI Avatar Character" 
                    className="w-32 h-40 object-contain relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                    style={{
                      filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.4))',
                      animation: 'float 5s ease-in-out infinite'
                    }}
                  />
                </div>
              </div>
              
              {/* 추가 작은 캐릭터 - 왼쪽 하단 */}
              <div className="absolute left-6 bottom-4 z-15 hidden lg:block opacity-70">
                <div className="relative">
                  <img 
                    src="/images/2dmodel/4.png" 
                    alt="AI Avatar Character" 
                    className="w-20 h-24 object-contain drop-shadow-lg hover:scale-110 transition-transform duration-300"
                    style={{
                      filter: 'drop-shadow(0 0 10px rgba(234, 179, 8, 0.3))',
                      animation: 'float 3s ease-in-out infinite 0.5s'
                    }}
                  />
                </div>
              </div>

              {/* 컨텐츠 영역 */}
              <div className="relative z-10 px-6 py-8 max-w-2xl">
                <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mr-4">
                      <i className="fas fa-laugh text-white text-lg"></i>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">잡담 채널에서 편하게 이야기해요!</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-orange-500/20 text-orange-200 border-orange-400/30">
                          <i className="fas fa-coffee mr-1"></i>
                          자유로운 대화
                        </Badge>
                        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-200 border-yellow-400/30">
                          <i className="fas fa-smile mr-1"></i>
                          재미있는 이야기
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-gray-200">
                    <p className="text-lg leading-relaxed">
                      <i className="fas fa-heart text-red-400 mr-2"></i>
                      일상 이야기부터 취미, 관심사까지 자유롭게 나눠보세요!
                    </p>
                    <p className="text-sm leading-relaxed opacity-90">
                      격식 없이 편안한 분위기에서 AI 아바타들과 즐거운 대화를 나누세요. 
                      오늘 있었던 일, 좋아하는 것들, 그리고 재미있는 이야기들을 공유해보세요.
                    </p>
                    <div className="flex items-center space-x-4 pt-2">
                      <div className="flex items-center text-sm text-green-300">
                        <i className="fas fa-circle text-green-400 mr-2 text-xs animate-pulse"></i>
                        편안한 분위기
                      </div>
                      <div className="flex items-center text-sm text-orange-300">
                        <i className="fas fa-laugh mr-2"></i>
                        유머 환영
                      </div>
                      <div className="flex items-center text-sm text-yellow-300">
                        <i className="fas fa-star mr-2"></i>
                        자유 주제
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 도움말 채널 */}
          {currentChannel === 'help' && (
            <>
              {/* 배경 장식 요소들 - 차분한 블루/그린 톤 */}
              <div className="absolute top-4 left-8 w-20 h-20 bg-blue-500/20 rounded-full blur-xl"></div>
              <div className="absolute bottom-6 right-16 w-24 h-24 bg-green-500/20 rounded-full blur-xl"></div>
              <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-cyan-500/20 rounded-full blur-lg"></div>
              
              {/* VTuber 캐릭터 - 오른쪽 배치 */}
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 hidden lg:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-green-400/20 rounded-full blur-2xl scale-150 animate-pulse"></div>
                  <img 
                    src="/images/2dmodel/6.png" 
                    alt="AI Avatar Character" 
                    className="w-32 h-40 object-contain relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                    style={{
                      filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.4))',
                      animation: 'float 7s ease-in-out infinite'
                    }}
                  />
                </div>
              </div>
              
              {/* 추가 작은 캐릭터 - 왼쪽 하단 */}
              <div className="absolute left-6 bottom-4 z-15 hidden lg:block opacity-70">
                <div className="relative">
                  <img 
                    src="/images/2dmodel/7.png" 
                    alt="AI Avatar Character" 
                    className="w-20 h-24 object-contain drop-shadow-lg hover:scale-110 transition-transform duration-300"
                    style={{
                      filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.3))',
                      animation: 'float 4.5s ease-in-out infinite 1.5s'
                    }}
                  />
                </div>
              </div>

              {/* 컨텐츠 영역 */}
              <div className="relative z-10 px-6 py-8 max-w-2xl">
                <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center mr-4">
                      <i className="fas fa-question-circle text-white text-lg"></i>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">도움이 필요하시면 언제든 물어보세요!</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-200 border-blue-400/30">
                          <i className="fas fa-life-ring mr-1"></i>
                          도움말
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/20 text-green-200 border-green-400/30">
                          <i className="fas fa-book mr-1"></i>
                          가이드
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-gray-200">
                    <p className="text-lg leading-relaxed">
                      <i className="fas fa-lightbulb text-yellow-400 mr-2"></i>
                      AI 아바타 사용법부터 기능 설명까지, 궁금한 모든 것을 도와드려요!
                    </p>
                    <p className="text-sm leading-relaxed opacity-90">
                      플랫폼 사용에 어려움이 있거나 새로운 기능에 대해 알고 싶으시다면 언제든 질문해주세요. 
                      친절한 AI 아바타들이 상세하고 이해하기 쉽게 안내해드립니다.
                    </p>
                    <div className="flex items-center space-x-4 pt-2">
                      <div className="flex items-center text-sm text-green-300">
                        <i className="fas fa-circle text-green-400 mr-2 text-xs animate-pulse"></i>
                        24시간 지원
                      </div>
                      <div className="flex items-center text-sm text-blue-300">
                        <i className="fas fa-graduation-cap mr-2"></i>
                        친절한 안내
                      </div>
                      <div className="flex items-center text-sm text-cyan-300">
                        <i className="fas fa-search mr-2"></i>
                        빠른 해결
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 아바타-채팅 채널 (VTuber) */}
      {channelType === 'vtuber' && (
        <div className="relative bg-gradient-to-br from-purple-700/80 via-pink-600/70 to-purple-800/90 border-b border-purple-500 overflow-hidden">
          {/* 배경 장식 요소들 - 보라색/핑크 톤 */}
          <div className="absolute top-4 left-8 w-20 h-20 bg-purple-500/30 rounded-full blur-xl"></div>
          <div className="absolute bottom-6 right-16 w-24 h-24 bg-pink-500/30 rounded-full blur-xl"></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-violet-500/30 rounded-full blur-lg"></div>
          
          {/* VTuber 캐릭터 - 오른쪽 배치 */}
          <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-2xl scale-150 animate-pulse"></div>
              <img 
                src="/images/2dmodel/7.png" 
                alt="AI Avatar Character" 
                className="w-36 h-44 object-contain relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.6))',
                  animation: 'float 5s ease-in-out infinite'
                }}
              />
            </div>
          </div>
          
          {/* 추가 작은 캐릭터 - 왼쪽 하단 */}
          <div className="absolute left-6 bottom-4 z-15 hidden lg:block opacity-80">
            <div className="relative">
              <img 
                src="/images/2dmodel/1.png" 
                alt="AI Avatar Character" 
                className="w-24 h-28 object-contain drop-shadow-lg hover:scale-110 transition-transform duration-300"
                style={{
                  filter: 'drop-shadow(0 0 12px rgba(236, 72, 153, 0.4))',
                  animation: 'float 3.5s ease-in-out infinite 0.8s'
                }}
              />
            </div>
          </div>

          {/* 컨텐츠 영역 */}
          <div className="relative z-10 px-6 py-8 max-w-2xl">
            <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-300/20">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-4">
                  <i className="fas fa-magic text-white text-lg"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">AI 아바타와 실시간 대화하세요!</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-purple-500/30 text-purple-200 border-purple-400/40">
                      <i className="fas fa-robot mr-1"></i>
                      AI 대화
                    </Badge>
                    <Badge variant="outline" className="bg-pink-500/30 text-pink-200 border-pink-400/40">
                      <i className="fas fa-bolt mr-1"></i>
                      실시간
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 text-gray-100">
                <p className="text-lg leading-relaxed">
                  <i className="fas fa-wand-magic-sparkles text-pink-400 mr-2"></i>
                  최첨단 AI 기술로 구현된 생생한 대화 경험을 만나보세요!
                </p>
                <p className="text-sm leading-relaxed opacity-90">
                  실시간으로 반응하는 AI 아바타와 자연스러운 대화를 나누세요. 
                  감정 표현, 개성 있는 응답, 그리고 놀라운 대화 능력을 체험해보세요.
                </p>
                <div className="flex items-center space-x-4 pt-2">
                  <div className="flex items-center text-sm text-green-300">
                    <i className="fas fa-circle text-green-400 mr-2 text-xs animate-pulse"></i>
                    실시간 응답
                  </div>
                  <div className="flex items-center text-sm text-purple-300">
                    <i className="fas fa-brain mr-2"></i>
                    고급 AI
                  </div>
                  <div className="flex items-center text-sm text-pink-300">
                    <i className="fas fa-heart mr-2"></i>
                    감정 표현
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!user ? (
        // 로그인 안내
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-500 rounded-full flex items-center justify-center mb-6 mx-auto">
              <i className="fas fa-user-lock text-3xl text-gray-300"></i>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">로그인이 필요합니다</h3>
            <p className="text-gray-300 mb-6 max-w-md">
              AI 아바타들과 채팅하려면 먼저 로그인해주세요.
            </p>
            <Button 
              onClick={() => setShowAuthModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2"
            >
              로그인하기
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 메시지 영역 */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 py-4">
            <div className="space-y-4">
              {/* 채널별 시작 메시지 */}
              {messages.length === 0 && channelType === 'firebase' && (
                <div className="mb-6 text-center">
                  {currentChannel === 'general' && (
                    <div className="inline-flex items-center px-4 py-2 bg-purple-600/20 rounded-full border border-purple-500/30">
                      <i className="fas fa-comment-dots text-purple-400 mr-2"></i>
                      <span className="text-gray-200 text-sm">대화를 시작해보세요! 아래에 메시지를 입력하세요.</span>
                    </div>
                  )}
                  {currentChannel === 'random' && (
                    <div className="inline-flex items-center px-4 py-2 bg-orange-600/20 rounded-full border border-orange-500/30">
                      <i className="fas fa-laugh text-orange-400 mr-2"></i>
                      <span className="text-gray-200 text-sm">편하게 이야기해보세요! 무엇이든 좋아요.</span>
                    </div>
                  )}
                  {currentChannel === 'help' && (
                    <div className="inline-flex items-center px-4 py-2 bg-blue-600/20 rounded-full border border-blue-500/30">
                      <i className="fas fa-question-circle text-blue-400 mr-2"></i>
                      <span className="text-gray-200 text-sm">궁금한 것이 있으시면 언제든 질문해주세요!</span>
                    </div>
                  )}
                </div>
              )}

              {/* 아바타 채팅용 시작 메시지 */}
              {messages.length === 0 && channelType === 'vtuber' && (
                <div className="mb-6 text-center">
                  <div className="inline-flex items-center px-4 py-2 bg-purple-600/30 rounded-full border border-purple-400/40">
                    <i className="fas fa-magic text-purple-400 mr-2"></i>
                    <span className="text-gray-100 text-sm">AI 아바타가 응답을 기다리고 있어요! 대화를 시작해보세요.</span>
                  </div>
                </div>
              )}

              {/* 메시지 목록 */}
              {messages.map(msg => renderMessage(msg))}
            </div>
          </ScrollArea>

          {/* 메시지 입력 영역 */}
          <div className="p-4">
            {/* 이미지 미리보기 */}
            {imageUploads.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {imageUploads.map((file, index) => (
                  <div key={index} className="relative border border-gray-500 rounded-md overflow-hidden p-1 bg-gray-700">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={`업로드 이미지 ${index + 1}`} 
                      className="h-20 w-auto object-cover"
                    />
                    <button 
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-0 right-0 bg-red-500 bg-opacity-70 text-white rounded-full p-1 text-xs"
                      type="button"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-gray-500 rounded-lg">
              <div className="flex items-end p-3 space-x-3">
                {channelType === 'firebase' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-8 h-8 p-0 text-gray-300 hover:text-white"
                    onClick={handleAttachClick}
                    disabled={isUploading}
                  >
                    <i className="fas fa-paperclip"></i>
                  </Button>
                )}
                
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
                      channelType === 'vtuber' 
                        ? "AI 아바타에게 메시지를 보내세요..." 
                        : isUploading ? "이미지 업로드 중..." : "메시지를 입력하세요..."
                    }
                    className="bg-transparent border-none text-white placeholder-gray-400 focus:ring-0 focus:outline-none resize-none"
                    disabled={(channelType === 'vtuber' ? !wsConnected : !isConnected) || isUploading}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-300 hover:text-white">
                    <i className="fas fa-gift"></i>
                  </Button>
                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-300 hover:text-white">
                    <i className="fas fa-smile"></i>
                  </Button>
                  {(message.trim() || (channelType === 'firebase' && imageUploads.length > 0)) && (
                    <Button 
                      onClick={handleSendMessage}
                      size="sm" 
                      className="w-8 h-8 p-0 bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={channelType === 'vtuber' ? !wsConnected : isUploading}
                    >
                      {(channelType === 'firebase' && isUploading) ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <i className="fas fa-paper-plane"></i>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            {!isConnected && (
              <p className="text-xs text-red-400 mt-1">연결이 끊겼습니다. 재연결을 시도하는 중...</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MainContent;