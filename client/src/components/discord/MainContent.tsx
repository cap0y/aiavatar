import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  createOrGetChatRoom,
  sendChatMessage,
  getChatMessages,
  subscribeToMessages,
  getUserChatRooms,
  markMessagesAsRead,
  updateMessageReaction,
  deleteMessage,
  db,
} from "@/firebase";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { AvatarSamples } from "@/data/avatarSamples";
import { normalizeImageUrl } from "@/lib/url";
import { parseEmotionMessage, isValidEmotion } from "@/lib/utils";
import Live2DAvatarPixi from "@/components/live2d/Live2DAvatarPixi";
import { Live2DModel } from "pixi-live2d-display";
import { useToast } from "@/hooks/use-toast";
import ChannelIntroSection from "@/components/discord/ChannelIntroSection";
import {
  getChannelDescription,
  vtuberChannelDescription,
} from "@/data/channelDescriptions";
import { useVoiceActivityDetection } from "@/hooks/useVoiceActivityDetection";
import FeedView from "@/components/discord/FeedView";
import FeedPostDetail from "@/components/discord/FeedPostDetail";

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
  reactions?: { [emoji: string]: string[] }; // 반응: { "👍": ["userId1", "userId2"] }
  replyTo?: string; // 답글 대상 메시지 ID
  isDeleted?: boolean; // 삭제된 메시지 여부
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
  replyTo?: string; // 답글 대상 메시지 ID
  reactions?: { [emoji: string]: string[] }; // 반응 객체
  isDeleted?: boolean; // 삭제 상태
}

interface MainContentProps {
  children?: React.ReactNode;
  currentChannel?: string;
  channelType?: "firebase" | "vtuber";
  feedSortBy?: 'latest' | 'popular' | 'subscribed' | 'trending';
}

const MainContent: React.FC<MainContentProps> = ({
  children,
  currentChannel,
  channelType = "firebase",
  feedSortBy,
}) => {
  const { user, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [chatPartner, setChatPartner] = useState<ChatPartner | null>(null);
  const [roomId, setRoomId] = useState<string | null>(
    currentChannel || "general",
  );
  const [showChatList, setShowChatList] = useState(true);
  const [chatList, setChatList] = useState<ChatListItem[]>([]); // 빈 배열로 시작
  const [needAuth, setNeedAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [channelMembers, setChannelMembers] = useState<Array<{uid: string; displayName: string; photoURL?: string}>>([]);
  const messageListenerRef = useRef<(() => void) | null>(null);

  // Live2D 관련 상태
  const [live2dInstance, setLive2dInstance] = useState<Live2DModel | null>(
    null,
  );
  const [currentEmotion, setCurrentEmotion] = useState<string>("neutral");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [speakFunction, setSpeakFunction] = useState<
    | ((input: string, type?: "text" | "audio", volumes?: number[]) => void)
    | null
  >(null);
  const speakFunctionRef = useRef<
    | ((input: string, type?: "text" | "audio", volumes?: number[]) => void)
    | null
  >(null);
  const [availableModels, setAvailableModels] = useState<string[]>([
    "mao",
    "ichika",
  ]); // 사용 가능한 모델 목록
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false); // 아바타 말하기 상태
  
  // 개성(personality) 관련 상태
  const [avatarPersonality, setAvatarPersonality] = useState<string>("");
  const [showPersonalityDialog, setShowPersonalityDialog] = useState(false);
  const [personalityInput, setPersonalityInput] = useState("");

  // localStorage에서 개성 데이터 불러오기
  useEffect(() => {
    const savedPersonality = localStorage.getItem(`avatar_personality_${selectedModel}`);
    if (savedPersonality) {
      setAvatarPersonality(savedPersonality);
      console.log(`🎭 ${selectedModel} 개성 불러옴:`, savedPersonality);
    } else {
      // 저장된 개성이 없으면 초기화
      setAvatarPersonality("");
      console.log(`🎭 ${selectedModel} 개성 없음 - 초기화`);
    }
  }, [selectedModel]);

  // 다이얼로그가 열릴/닫힐 때 입력 필드 동기화
  useEffect(() => {
    if (showPersonalityDialog) {
      // 팝업 열릴 때: 현재 저장된 개성으로 초기화
      setPersonalityInput(avatarPersonality);
      console.log(`🎭 팝업 열림 - 개성 입력 필드 동기화:`, avatarPersonality);
    } else {
      // 팝업 닫힐 때: 입력 필드를 현재 개성으로 되돌림 (취소 효과)
      setPersonalityInput(avatarPersonality);
      console.log(`🎭 팝업 닫힘 - 입력 필드 초기화`);
    }
  }, [showPersonalityDialog, avatarPersonality]); // 두 값 모두 의존

  // 개성 저장 함수
  const handleSavePersonality = () => {
    if (personalityInput.trim()) {
      setAvatarPersonality(personalityInput.trim());
      localStorage.setItem(`avatar_personality_${selectedModel}`, personalityInput.trim());
      console.log(`🎭 ${selectedModel} 개성 저장됨:`, personalityInput.trim());
      toast({
        title: "개성 설정 완료",
        description: "아바타의 개성이 성공적으로 저장되었습니다.",
      });
      setShowPersonalityDialog(false);
    }
  };

  // speakFunction 상태 변화 모니터링 및 ref 업데이트
  useEffect(() => {
    console.log("🎤 speakFunction 상태 변경됨:", {
      exists: !!speakFunction,
      type: typeof speakFunction,
      functionName: speakFunction?.name || "none",
      isFunction: typeof speakFunction === "function",
    });

    // ref도 함께 업데이트
    speakFunctionRef.current = speakFunction;
  }, [speakFunction]);

  // 사용 가능한 모델 목록 불러오기
  useEffect(() => {
    const fetchAvailableModels = async () => {
      try {
        console.log("🔍 사용 가능한 모델 목록 불러오는 중...");
        const response = await fetch("/api/model-editor/scan-models");

        // Content-Type 확인 (HTML이 아닌 JSON인지 체크)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn(
            "⚠️ 서버가 JSON을 반환하지 않음 (HTML 페이지 반환), 기본 모델 사용",
          );
          return;
        }

        if (response.ok) {
          const models = await response.json();
          if (Array.isArray(models) && models.length > 0) {
            const modelNames = models.map((model: any) => model.name);
            setAvailableModels(modelNames);
            console.log(
              `✅ ${modelNames.length}개 모델 로드 완료:`,
              modelNames,
            );
          } else {
            console.warn("⚠️ 유효한 모델 데이터 없음, 기본 모델 사용");
          }
        } else {
          console.warn(
            `⚠️ 모델 목록 불러오기 실패 (${response.status}), 기본 모델 사용`,
          );
        }
      } catch (error) {
        console.warn(
          "⚠️ 모델 목록 불러오기 오류 (서버 미응답), 기본 모델 사용:",
          error,
        );
      }
    };

    // 서버가 준비될 시간을 주기 위해 약간의 딜레이 추가
    const timeoutId = setTimeout(fetchAvailableModels, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  // URL 파라미터에서 모델 확인 및 모델 변경 이벤트 처리
  useEffect(() => {
    // URL 파라미터에서 모델 확인
    const urlParams = new URLSearchParams(window.location.search);
    const modelParam = urlParams.get('model');
    if (modelParam && channelType === 'vtuber') {
      console.log(`🎯 URL에서 모델 파라미터 감지: ${modelParam}`);
      setSelectedModel(modelParam);
    }

    // 모델 변경 이벤트 리스너
    const handleModelChange = (event: CustomEvent) => {
      const { modelName } = event.detail;
      console.log(`🔄 사이드바에서 모델 변경 요청: ${modelName}`);
      setSelectedModel(modelName);
    };

    window.addEventListener('modelChange', handleModelChange as EventListener);
    
    return () => {
      window.removeEventListener('modelChange', handleModelChange as EventListener);
    };
  }, [channelType]);

  // 채널 멤버 로드
  useEffect(() => {
    const loadChannelMembers = () => {
      if (!currentChannel) {
        setChannelMembers([]);
        return;
      }

      // 커스텀 채널인 경우
      if (currentChannel.startsWith('custom-')) {
        try {
          const stored = localStorage.getItem('customChannels');
          if (stored) {
            const allChannels = JSON.parse(stored);
            const channel = allChannels.find((c: any) => c.id === currentChannel);
            
            if (channel && channel.members) {
              // 실제로는 Firebase에서 사용자 정보를 가져와야 하지만, 임시로 로컬 데이터 사용
              const members = channel.members.map((uid: string) => ({
                uid,
                displayName: uid === user?.uid ? (user.displayName || '나') : `사용자${uid.slice(-4)}`,
                photoURL: uid === user?.uid ? user.photoURL : `https://ui-avatars.com/api/?name=${uid.slice(-4)}&background=6366f1&color=fff&size=32`
              }));
              setChannelMembers(members);
              return;
            }
          }
        } catch (error) {
          console.error('채널 멤버 로드 오류:', error);
        }
      }

      // 일반 채널인 경우 현재 사용자만 표시
      if (user) {
        setChannelMembers([{
          uid: user.uid,
          displayName: user.displayName || '나',
          photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366f1&color=fff&size=32`
        }]);
      } else {
        setChannelMembers([]);
      }
    };

    loadChannelMembers();
    
    // 스토리지 변경 감지
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customChannels') {
        loadChannelMembers();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentChannel, user]);

  // VTuber WebSocket 연결 상태 (아바타 채팅용)
  const [wsConnected, setWsConnected] = useState(false);
  const [vtuberConnecting, setVtuberConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxReconnectAttempts = 2;

  // 전화번호 표시 모달 상태
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  // 음성 인식 관련 상태 및 훅 (VAD 포함)
  const voiceDetector = useVoiceActivityDetection(
    0.05, // 침묵 임계값 (더 높게 설정)
    1500, // 1.5초 침묵 후 자동 전송
    800, // 최소 0.8초 녹음
    isAvatarSpeaking, // 아바타가 말하는 중이면 음성 입력 차단
  );

  // 선물/이모티콘 팝업 상태 (디스코드 스타일)
  const [showGiftPopup, setShowGiftPopup] = useState(false);
  const [showEmojiPopup, setShowEmojiPopup] = useState(false);
  
  // 메시지 상호작용 상태
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // 선물 팝업 외부 클릭 시 닫기
      if (
        !target.closest(".gift-popup") &&
        !target.closest('[title="선물 보내기"]')
      ) {
        setShowGiftPopup(false);
      }
      
      // 이모티콘 팝업 외부 클릭 시 닫기
      if (
        !target.closest(".emoji-popup") &&
        !target.closest('[title="이모티콘"]')
      ) {
        setShowEmojiPopup(false);
      }

      // 반응 선택기 외부 클릭 시 닫기
      if (
        !target.closest('.reaction-picker') && 
        !target.closest('[data-reaction-trigger]')
      ) {
        setShowReactionPicker(null);
      }
    };

    if (showGiftPopup || showEmojiPopup || showReactionPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showGiftPopup, showEmojiPopup, showReactionPicker]);

  // 상태 관리 부분 수정 - 단일 이미지에서 여러 이미지로 변경
  const [imageUploads, setImageUploads] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // VTuber WebSocket 연결 함수
  const connectToVTuber = useCallback(async () => {
    // 이미 연결 중이거나 연결되어 있으면 중복 연결 방지
    if (wsRef.current?.readyState === WebSocket.OPEN || vtuberConnecting) {
      console.log("🔄 이미 연결 중이거나 연결되어 있습니다.");
      return;
    }

    console.log("🚀 VTuber WebSocket 연결 시작...");
    setVtuberConnecting(true);

    try {
      // 동적으로 WebSocket URL 생성
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const port =
        window.location.port ||
        (window.location.protocol === "https:" ? "443" : "80");
      // 개발 환경에서 여러 포트 시도
      const devPorts = ["5001", "5000", "3001"];
      const isLocalhost = host === "localhost" || host === "127.0.0.1";
      
      let wsUrl = "";
      if (isLocalhost) {
        // 개발 환경에서는 포트 5001을 먼저 시도
        wsUrl = `${protocol}//${host}:5001/client-ws`;
      } else {
        wsUrl = `${protocol}//${host}:${port}/client-ws`;
      }
      
      console.log("📡 연결 URL:", wsUrl);

      const ws = new WebSocket(wsUrl);

      // 연결 타임아웃 설정 (10초)
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log("⏰ WebSocket 연결 타임아웃");
          ws.close();
        }
      }, 10000);

      ws.onopen = () => {
        console.log("✅ VTuber WebSocket 연결 성공");
        clearTimeout(connectionTimeout);
        setWsConnected(true);
        setVtuberConnecting(false);
        setConnectionAttempts(0);

        // 연결 성공 메시지 추가
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            content: "🤖 AI 아바타와 연결되었습니다. 대화를 시작해보세요!",
            sender: "system",
            timestamp: new Date().toISOString(),
            isBot: false,
            senderName: "VTuber System",
            senderAvatar: "",
          },
        ]);

        // 잠시 후 초기화 메시지 전송 (서버가 준비될 시간 제공)
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log("📤 초기화 설정 요청 전송");
            ws.send(
              JSON.stringify({
                type: "request-init-config",
              }),
            );
          }
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 VTuber 메시지 수신:", data.type || "unknown", data);

          // 메시지 타입별 안전한 처리
          switch (data.type) {
            case "init-config":
              console.log("🎯 초기 설정 수신:", {
                model: data.currentModel || data.modelName,
                character: data.character_name,
                status: data.status,
              });

              // 모델 정보가 있으면 업데이트
              if (data.currentModel || data.modelName) {
                setSelectedModel(data.currentModel || data.modelName);
              }
              break;

            case "system":
              console.log("📢 시스템 메시지:", data.content);
              if (data.content) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    content: data.content,
                    sender: "system",
                    timestamp: new Date().toISOString(),
                    isBot: false,
                    senderName: "VTuber System",
                    senderAvatar: "🤖",
                  },
                ]);
              }
              break;

            case "llm-response":
            case "ai-response":
              const originalResponseText =
                data.text ||
                data.content ||
                data.message ||
                "응답을 받았습니다.";
              const audioUrl = data.audioUrl; // 🎵 OpenAI TTS 오디오 URL
              const volumes = data.volumes || []; // 🔊 볼륨 데이터 배열

              // 감정 명령 파싱
              const { emotion, cleanText } =
                parseEmotionMessage(originalResponseText);

              console.log("💬 AI 응답 수신:", {
                originalText: originalResponseText,
                extractedEmotion: emotion,
                cleanText: cleanText,
                textLength: cleanText.length,
                hasEmotion: !!emotion,
                isValidEmotion: emotion ? isValidEmotion(emotion) : false,
                hasAudioUrl: !!audioUrl, // 🎵 오디오 URL 존재 여부
                hasVolumes: volumes.length > 0, // 🔊 볼륨 데이터 존재 여부
                volumeCount: volumes.length,
              });

              // 감정이 감지되면 Live2D 모델에 적용
              if (emotion && isValidEmotion(emotion)) {
                console.log("🎭 Live2D 감정 변경:", {
                  previousEmotion: currentEmotion,
                  newEmotion: emotion,
                  emotionApplied: true,
                });
                setCurrentEmotion(emotion);
              } else if (data.emotion && typeof data.emotion === "string") {
                // 기존 감정 처리 방식도 유지 (백업)
                console.log("🎭 서버 감정 변경:", {
                  previousEmotion: currentEmotion,
                  newEmotion: data.emotion,
                  source: "server",
                });
                setCurrentEmotion(data.emotion);
              } else {
                console.log("🎭 감정 변경 없음:", {
                  parsedEmotion: emotion,
                  serverEmotion: data.emotion,
                  currentEmotion: currentEmotion,
                  reason: !emotion ? "no_emotion_parsed" : "invalid_emotion",
                });
              }

              // 메시지는 원본으로 표시 (감정 명령 포함)
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now(),
                  content: originalResponseText,
                  sender: "ai",
                  timestamp: new Date().toISOString(),
                  isBot: true,
                  senderName: "AI 아바타",
                  senderAvatar: AvatarSamples[0]?.Avatar || "",
                },
              ]);

              // TTS로 AI 응답 말하기 - OpenAI TTS 우선, 백업으로 브라우저 TTS
              const tryTTS = (attempts = 0, maxAttempts = 10) => {
                const ttsText = cleanText; // 감정 명령이 제거된 텍스트만 TTS
                const currentSpeakFunction = speakFunctionRef.current; // ref에서 최신 값 가져오기

                console.log("🎤 TTS 시도:", {
                  attempts,
                  maxAttempts,
                  hasOpenAIAudio: !!audioUrl,
                  speakFunctionExists: !!currentSpeakFunction,
                  speakFunctionType: typeof currentSpeakFunction,
                  refExists: !!speakFunctionRef.current,
                  stateExists: !!speakFunction,
                  ttsText: ttsText?.substring(0, 30) + "...",
                  ttsTextLength: ttsText?.length || 0,
                });

                // OpenAI TTS만 사용 (폴백 제거)
                if (audioUrl && currentSpeakFunction) {
                  console.log(
                    "🎵 OpenAI TTS 전용 재생:",
                    audioUrl,
                    "볼륨 데이터:",
                    volumes.length,
                    "개",
                  );

                  try {
                    // 서버 URL 확인 - 환경에 따라 자동 설정
                    let serverUrl = import.meta.env.VITE_API_URL;
                    
                    if (!serverUrl) {
                      // 환경 변수가 없으면 현재 프로토콜과 호스트 기반으로 설정
                      const isHttps = window.location.protocol === 'https:';
                      const currentHost = window.location.hostname;
                      
                      if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
                        // 로컬 개발 환경
                        serverUrl = 'http://localhost:5001';
                      } else {
                        // 프로덕션 환경 - 같은 도메인의 백엔드 사용
                        serverUrl = `${isHttps ? 'https' : 'http'}://${currentHost}`;
                      }
                    }
                    
                    // 오디오 URL이 상대 경로인 경우 서버 URL과 결합
                    const fullAudioUrl = audioUrl.startsWith('/') 
                      ? `${serverUrl}${audioUrl}`
                      : audioUrl;
                    
                    console.log("🎵 전체 오디오 URL:", fullAudioUrl);
                    console.log("🎵 서버 URL:", serverUrl);
                    
                    // 파일 존재 확인 (선택적, 디버깅용)
                    fetch(fullAudioUrl, { method: 'HEAD' })
                      .then(checkResponse => {
                        console.log("🎵 오디오 파일 체크:", {
                          url: fullAudioUrl,
                          status: checkResponse.status,
                          contentType: checkResponse.headers.get('content-type'),
                          exists: checkResponse.ok
                        });
                      })
                      .catch(checkError => {
                        console.warn("⚠️ 오디오 파일 체크 실패:", checkError);
                      });
                    
                    // OpenAI TTS만 재생, 폴백 없음
                    currentSpeakFunction(fullAudioUrl, "audio", volumes);
                    return; // OpenAI TTS만 사용
                  } catch (error) {
                    console.error("❌ OpenAI TTS 재생 실패:", error);
                    console.log(
                      "🚫 브라우저 TTS 폴백 비활성화됨 - OpenAI TTS 전용 모드",
                    );
                    return; // 실패해도 폴백하지 않음
                  }
                } else if (currentSpeakFunction && !audioUrl) {
                  console.log("⚠️ OpenAI TTS 오디오 URL 없음 - 재생 건너뜀");
                  return;
                }

                // speakFunction이 준비되지 않은 경우만 재시도
                if (!currentSpeakFunction && attempts < maxAttempts - 1) {
                  console.log(
                    "🎤 speakFunction 없음 - 재시도 예약:",
                    attempts + 1,
                  );
                  setTimeout(() => tryTTS(attempts + 1, maxAttempts), 500);
                  return;
                } else if (!currentSpeakFunction) {
                  console.log("❌ 최대 재시도 초과 - TTS 실행 실패");
                  return;
                }
              };

              // 즉시 첫 번째 시도 실행
              setTimeout(() => tryTTS(), 100);

              break;

            case "model-switched":
              if (data.model && typeof data.model === "string") {
                console.log("🔄 모델 전환:", data.model);
                setSelectedModel(data.model);
                setCurrentEmotion("neutral");
              }
              break;

            case "heartbeat-ack":
              // 하트비트 응답 (조용히 처리)
              break;

            case "conversation-ended":
              console.log("🔚 대화 종료:", data.timestamp);
              // 대화 종료 시 중성 표정으로 변경
              setCurrentEmotion("neutral");
              break;

            case "error":
              console.warn("⚠️ 서버 오류:", data.message || "Unknown error");
              toast({
                title: "서버 오류",
                description: data.message || "알 수 없는 오류가 발생했습니다.",
                variant: "destructive",
              });
              break;

            default:
              console.log("❓ 알 수 없는 메시지 타입:", data.type);
          }
        } catch (error) {
          console.error("❌ 메시지 파싱 오류:", error, "Raw data:", event.data);
          // 파싱 오류가 있어도 연결을 끊지 않음
        }
      };

        ws.onerror = (error) => {
          console.error("❌ VTuber WebSocket 오류:", error);
          clearTimeout(connectionTimeout);
          setVtuberConnecting(false);
          setWsConnected(false);

          // 첫 번째 연결 시도 실패 시에만 안내 메시지 표시
          if (connectionAttempts === 0) {
            const isLocalhost = host === "localhost" || host === "127.0.0.1";
            const message = isLocalhost 
              ? "🎭 Live2D 아바타는 정상 작동합니다! 클릭해서 감정을 변경해보세요.\n\n🤖 AI 대화를 위해서는 백엔드 서버를 실행하세요:\n• `npm run dev:server` (포트 5001)\n• 또는 `node server.js`"
              : "🎭 Live2D 아바타는 정상 작동합니다! 클릭해서 감정을 변경해보세요.\n\n🤖 AI 대화 기능은 현재 서버에 연결할 수 없습니다.";
              
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                content: message,
                sender: "system",
                timestamp: new Date().toISOString(),
                isBot: false,
                senderName: "Live2D System",
                senderAvatar: "🎭",
              },
            ]);
          }
        };

      ws.onclose = (event) => {
        console.log("VTuber WebSocket 연결 종료:", event.code, event.reason);
        setWsConnected(false);
        setVtuberConnecting(false);

        clearTimeout(connectionTimeout);

        // 개발 환경에서는 재연결 시도를 더 적게, 프로덕션에서는 더 많이
        const isLocalhost = host === "localhost" || host === "127.0.0.1";
        const maxAttempts = isLocalhost ? 1 : maxReconnectAttempts;
        
        // 정상 종료가 아닌 경우에만 재연결 시도
        if (
          connectionAttempts < maxAttempts &&
          !event.wasClean &&
          event.code !== 1000
        ) {
          const nextAttempt = connectionAttempts + 1;
          const delay = isLocalhost ? 8000 : 5000; // 개발 환경에서는 더 긴 대기
          
          console.log(
            `🔄 재연결 시도 예약: ${nextAttempt}/${maxAttempts} (${delay/1000}초 후)`,
          );

          setConnectionAttempts(nextAttempt);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `🚀 재연결 시도 ${nextAttempt}/${maxAttempts} 실행`,
            );
            connectToVTuber();
          }, delay);
        } else if (
          connectionAttempts >= maxAttempts ||
          event.code === 1000
        ) {
          if (connectionAttempts >= maxAttempts) {
            console.log("🛑 재연결 포기 - Live2D 모델만 표시됩니다.");
          } else {
            console.log("✋ 정상 종료 - 재연결하지 않습니다.");
          }
          setCurrentEmotion("neutral");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("❌ WebSocket 생성 오류:", error);
      setVtuberConnecting(false);
      setWsConnected(false);

      toast({
        title: "연결 초기화 실패",
        description: "WebSocket 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
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
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          content: messageText,
          sender: "user",
          timestamp: new Date().toISOString(),
          isBot: false,
          senderName:
            user?.displayName || user?.email?.split("@")[0] || "사용자",
          senderAvatar: user?.photoURL || "",
          replyTo: replyingTo?.id.toString(),
        },
      ]);

      // VTuber 서버로 메시지 전송
      const vtuberMessage = {
        type: "text-input",
        text: messageText,
        replyTo: replyingTo?.id.toString(),
        personality: avatarPersonality, // 개성 정보 포함
      };

      wsRef.current.send(JSON.stringify(vtuberMessage));
      console.log("VTuber 메시지 전송:", vtuberMessage);

      setMessage("");
      // 답글 상태 초기화
      setReplyingTo(null);
    } catch (error) {
      console.error("VTuber 메시지 전송 오류:", error);
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
    const toParam = urlParams.get("to");
    const nameParam = urlParams.get("name");
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
        .then((result) => {
          if (result.success) {
            const newRoomId = result.roomId || "";
            setRoomId(newRoomId);
            console.log("채팅방 생성/참여 성공:", newRoomId);

            // 채팅 파트너 정보 찾기
            const partnerInfo = chatList.find(
              (m) => m.senderId.toString() === targetId,
            );

            // 채팅 파트너 정보 설정 - URL에서 받은 이름 우선 사용
            let partnerName = partnerInfo?.senderName || `아바타 #${targetId}`;
            if (nameParam) {
              partnerName = decodeURIComponent(nameParam);
            }

            const partner: ChatPartner = {
              id: targetId,
              name: partnerName,
              imageUrl: partnerInfo?.senderImage || "/placeholder-Avatar.png",
            };

            setChatPartner(partner);

            // 메시지 내역 로드
            if (newRoomId) {
              getChatMessages(newRoomId)
                .then((messageResult) => {
                  if (messageResult.success && messageResult.messages) {
                    // 메시지 포맷 변환 - any 타입으로 처리
                    const formattedMessages = messageResult.messages.map(
                      (msg: any) => ({
                        id: msg.id,
                        content: msg.content || "",
                        sender: msg.senderId === user.uid ? "user" : "other",
                        timestamp: formatMessageTimestamp(msg.timestamp),
                        imageUrl: msg.imageUrl,
                        raw: msg,
                      }),
                    );

                    setMessages(formattedMessages);
                    console.log(
                      "메시지 내역 로드 완료:",
                      formattedMessages.length,
                      "개",
                    );

                    // 읽지 않은 메시지들을 읽음으로 표시
                    markMessagesAsRead(newRoomId, user.uid).catch((err) => {
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
                  messageListenerRef.current = subscribeToMessages(
                    newRoomId,
                    (newMessages: ChatMessage[]) => {
                      const formattedNewMessages = newMessages.map((msg) => ({
                        id: msg.id,
                        content: msg.content,
                        sender: msg.senderId === user.uid ? "user" : "other",
                        timestamp: formatMessageTimestamp(msg.timestamp),
                        imageUrl: msg.imageUrl,
                        replyTo: msg.replyTo, // 답글 정보 추가
                        reactions: msg.reactions || {}, // 반응 정보 추가
                        isDeleted: msg.isDeleted || false, // 삭제 상태 추가
                        raw: msg, // 원본 데이터
                      }));

                      setMessages(formattedNewMessages);

                      // 새 메시지가 도착하면 자동으로 읽음 표시
                      markMessagesAsRead(newRoomId, user.uid).catch((err) => {
                        console.log("새 메시지 읽음 표시 실패 (무시됨):", err);
                      });
                    },
                  );

                  setIsLoading(false);
                  setIsInitialized(true);
                })
                .catch((error) => {
                  console.error("메시지 내역 로드 중 오류:", error);
                  setIsLoading(false);
                  setIsInitialized(true);
                });
            } else {
              setIsLoading(false);
            }

            // 상대방 전화번호 가져오기 (실제로는 API에서 가져와야 함)
            setPhoneNumber(
              `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            );
          } else {
            console.error("채팅방 생성/참여 실패:", result.error);
            setIsLoading(false);

            // 실패 시 채팅 목록으로 돌아가기
            setShowChatList(true);
            alert("채팅방 생성에 실패했습니다. 다시 시도해주세요.");
          }
        })
        .catch((error) => {
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
      setRoomId("general");
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
      const scrollArea = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages]);

  // Firebase 채팅방 초기화 (Firebase 채널용)
  useEffect(() => {
    if (!user || channelType !== "firebase") return;
    if (!db) {
      console.error("Firebase DB가 초기화되지 않았습니다.");
      return;
    }

    const initializeFirebaseChatRoom = async () => {
      try {
        console.log("Firebase 채팅방 초기화 시작:", currentChannel);
        console.log("사용자 인증 상태:", user.uid, user.email);

        // 채널에 따른 채팅방 ID 설정
        const chatRoomId = currentChannel || "general";

        // 사용자 인증이 완료될 때까지 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log("Firebase 채팅 직접 초기화 시도:", chatRoomId);

        try {
          // 채팅방 생성 없이 바로 메시지 로드 시도
          const messageResult = await getChatMessages(chatRoomId);
          if (messageResult.success && messageResult.messages) {
            console.log(
              "메시지 로드 완료:",
              messageResult.messages.length,
              "개",
            );
            
            // 메시지에서 고유한 사용자 정보 추출
            const uniqueMembers = new Map<string, {uid: string; displayName: string; photoURL?: string}>();
            messageResult.messages.forEach((msg: any) => {
              if (msg.senderId && msg.senderId !== user.uid && !msg.senderId.startsWith("Avatar_")) {
                if (msg.senderName || msg.photoURL) {
                  uniqueMembers.set(msg.senderId, {
                    uid: msg.senderId,
                    displayName: msg.senderName || "사용자",
                    photoURL: msg.photoURL
                  });
                }
              }
            });
            
            // channelMembers 초기화
            if (uniqueMembers.size > 0) {
              const members = Array.from(uniqueMembers.values());
              console.log(`📋 초기 channelMembers 설정: ${members.length}명`, members);
              setChannelMembers(members);
            }
            
            const formattedMessages = messageResult.messages.map(
              (msg: any) => {
                return {
                  id: msg.id,
                  content: msg.content,
                  sender: msg.senderId === user.uid ? "user" : "other",
                  timestamp: formatMessageTimestamp(msg.timestamp),
                  imageUrl: msg.imageUrl,
                  senderName: getSenderName(msg.senderId, msg),
                  senderAvatar: getSenderAvatar(msg.senderId, msg),
                  isBot:
                    msg.senderId !== user.uid &&
                    msg.senderId.startsWith("Avatar_"),
                  replyTo: msg.replyTo, // 답글 정보 추가
                  reactions: msg.reactions || {}, // 반응 정보 추가
                  isDeleted: msg.isDeleted || false, // 삭제 상태 추가
                  raw: msg, // 원본 데이터 추가
                };
              }
            );
            setMessages(formattedMessages);
          } else {
            console.log("메시지가 없음 - 빈 채팅방으로 시작");
            setMessages([]);
          }

          // 이전 리스너 해제
          if (messageListenerRef.current) {
            messageListenerRef.current();
          }

          // 실시간 메시지 구독 - 전체 메시지 배열을 받음
          const unsubscribe = subscribeToMessages(
            chatRoomId,
            (newMessages: any[]) => {
              console.log("실시간 메시지 업데이트:", newMessages.length, "개");
              
              // 메시지에서 고유한 사용자 정보 추출
              const uniqueMembers = new Map<string, {uid: string; displayName: string; photoURL?: string}>();
              newMessages.forEach((msg: any) => {
                if (msg.senderId && msg.senderId !== user.uid && !msg.senderId.startsWith("Avatar_")) {
                  if (msg.senderName || msg.photoURL) {
                    uniqueMembers.set(msg.senderId, {
                      uid: msg.senderId,
                      displayName: msg.senderName || "사용자",
                      photoURL: msg.photoURL
                    });
                  }
                }
              });
              
              // channelMembers 업데이트
              if (uniqueMembers.size > 0) {
                setChannelMembers(prev => {
                  const membersMap = new Map(prev.map(m => [m.uid, m]));
                  uniqueMembers.forEach((member, uid) => {
                    membersMap.set(uid, member);
                  });
                  const updated = Array.from(membersMap.values());
                  console.log(`📋 channelMembers 업데이트: ${updated.length}명`, updated);
                  return updated;
                });
              }
              
              const formattedMessages = newMessages.map((msg: any) => {
                return {
                  id: msg.id,
                  content: msg.content,
                  sender: msg.senderId === user.uid ? "user" : "other",
                  timestamp: formatMessageTimestamp(msg.timestamp),
                  imageUrl: msg.imageUrl,
                  senderName: getSenderName(msg.senderId, msg),
                  senderAvatar: getSenderAvatar(msg.senderId, msg),
                  isBot:
                    msg.senderId !== user.uid &&
                    msg.senderId.startsWith("Avatar_"),
                  replyTo: msg.replyTo, // 답글 정보 추가
                  reactions: msg.reactions || {}, // 반응 정보 추가
                  isDeleted: msg.isDeleted || false, // 삭제 상태 추가
                  raw: msg, // 원본 데이터 추가
                };
              });

              setMessages(formattedMessages);
            },
          );

          messageListenerRef.current = unsubscribe;
          console.log("Firebase 채팅 초기화 완료");
        } catch (directError) {
          console.error("직접 메시지 로드 실패:", directError);

          // 그래도 채팅방 생성을 시도해보기
          console.log("채팅방 생성 시도:", chatRoomId, `public_${chatRoomId}`);
          const result = await createOrGetChatRoom(
            chatRoomId,
            `public_${chatRoomId}`,
          );

          if (result.success) {
            console.log("Firebase 채팅방 준비 완료:", result.roomId);
            setMessages([]);
          } else {
            console.error("채팅방 생성도 실패:", result.error);
            // 권한 오류인 경우 사용자에게 알림
            if (
              result.error &&
              typeof result.error === "object" &&
              "code" in result.error &&
              result.error.code === "permission-denied"
            ) {
              toast({
                title: "권한 오류",
                description:
                  "채팅방에 접근할 권한이 없습니다. 다시 로그인해주세요.",
                variant: "destructive",
              });
            }
          }
        }
      } catch (error) {
        console.error("Firebase 채팅방 초기화 오류:", error);
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
    if (!timestamp) return "";

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

  // 사용자 정보 캐시
  const userInfoCache = useRef<Map<string, {displayName: string; photoURL?: string}>>(new Map());

  const getSenderName = (senderId: string, msgData?: any): string => {
    // 메시지 데이터에 senderName이 있고 "사용자"가 아니면 우선 사용
    if (msgData?.senderName && msgData.senderName !== "사용자") {
      return msgData.senderName;
    }

    if (senderId === user?.uid) {
      return user.displayName || user.email?.split("@")[0] || "나";
    }

    // 캐시에서 찾기
    const cached = userInfoCache.current.get(senderId);
    if (cached?.displayName) {
      return cached.displayName;
    }

    // channelMembers에서 찾기
    const member = channelMembers.find(m => m.uid === senderId);
    if (member?.displayName) {
      return member.displayName;
    }

    // 아바타 ID인 경우
    if (senderId.startsWith("Avatar_")) {
      const AvatarId = senderId.replace("Avatar_", "");
      const Avatar = AvatarSamples.find((a) => a.id === AvatarId);
      return Avatar?.name || "아바타";
    }

    // DB에서 사용자 정보 가져오기 (비동기)
    fetchUserInfo(senderId);

    return msgData?.senderName || "사용자";
  };

  const getSenderAvatar = (senderId: string, msgData?: any): string | undefined => {
    let photoURL: string | undefined;

    // 메시지 데이터에 photoURL이 있으면 우선 사용
    if (msgData?.photoURL) {
      photoURL = msgData.photoURL;
    } else if (senderId === user?.uid) {
      photoURL = user.photoURL || undefined;
    } else {
      // 캐시에서 찾기
      const cached = userInfoCache.current.get(senderId);
      if (cached?.photoURL) {
        photoURL = cached.photoURL;
      } else {
        // channelMembers에서 찾기
        const member = channelMembers.find(m => m.uid === senderId);
        if (member?.photoURL) {
          photoURL = member.photoURL;
        } else if (senderId.startsWith("Avatar_")) {
          // 아바타 ID인 경우
          const AvatarId = senderId.replace("Avatar_", "");
          const Avatar = AvatarSamples.find((a) => a.id === AvatarId);
          photoURL = Avatar?.Avatar;
        } else {
          // DB에서 사용자 정보 가져오기 (비동기)
          fetchUserInfo(senderId);
        }
      }
    }

    // photoURL이 있으면 정규화하여 반환, 없으면 undefined 반환
    return photoURL ? normalizeImageUrl(photoURL) : undefined;
  };

  // DB에서 사용자 정보 가져오기
  const fetchUserInfo = async (userId: string) => {
    // 이미 요청 중이거나 캐시에 있으면 스킵
    if (userInfoCache.current.has(userId)) return;
    
    // 임시로 빈 객체 저장 (중복 요청 방지)
    userInfoCache.current.set(userId, { displayName: "사용자" });

    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        if (userData.displayName || userData.photoURL) {
          userInfoCache.current.set(userId, {
            displayName: userData.displayName || "사용자",
            photoURL: userData.photoURL
          });
          
          // channelMembers 업데이트
          setChannelMembers(prev => {
            const exists = prev.find(m => m.uid === userId);
            if (!exists) {
              return [...prev, {
                uid: userId,
                displayName: userData.displayName || "사용자",
                photoURL: userData.photoURL
              }];
            }
            return prev;
          });

          console.log(`✅ DB에서 사용자 정보 가져옴: ${userData.displayName}`);
        }
      } else if (response.status === 404) {
        // 404는 정상적인 상황 (사용자 정보가 없을 수 있음) - 경고 없이 처리
        console.debug(`ℹ️ 사용자 정보 없음: ${userId}`);
      }
    } catch (error) {
      // 네트워크 에러 등 실제 오류만 로그
      if (error instanceof TypeError) {
        console.warn(`⚠️ 사용자 정보 가져오기 실패: ${userId}`);
      }
    }
  };

  // URL이 상대 경로인 경우 절대 경로로 변환
  const getAbsoluteImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    return normalizeImageUrl(url);
  };

  // URL 감지 및 링크 변환 함수
  const convertLinksToHtml = (text: string) => {
    if (!text) return "";

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
      files.forEach((file) => {
        // 파일 크기 제한 (5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert(
            `파일 '${file.name}'의 크기가 5MB를 초과합니다. 더 작은 이미지를 선택해주세요.`,
          );
          return;
        }

        // 파일 타입 제한
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!allowedTypes.includes(file.type)) {
          alert(
            `'${file.name}'은(는) 지원되지 않는 파일 형식입니다. JPG, PNG, GIF, WEBP 파일만 업로드 가능합니다.`,
          );
          return;
        }

        validFiles.push(file);
      });

      setImageUploads((prevFiles) => [...prevFiles, ...validFiles]);
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
    setImageUploads((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  // 선물 데이터
  const gifts = [
    { id: 1, name: "하트", icon: "💖", price: 10 },
    { id: 2, name: "장미", icon: "🌹", price: 50 },
    { id: 3, name: "케이크", icon: "🎂", price: 100 },
    { id: 4, name: "다이아몬드", icon: "💎", price: 500 },
    { id: 5, name: "왕관", icon: "👑", price: 1000 },
    { id: 6, name: "별", icon: "⭐", price: 25 },
  ];

  // 이모티콘 데이터
  const emojis = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "🤣",
    "😂",
    "🙂",
    "🙃",
    "😉",
    "😊",
    "😇",
    "🥰",
    "😍",
    "🤩",
    "😘",
    "😗",
    "😚",
    "😙",
    "😋",
    "😛",
    "😜",
    "🤪",
    "😎",
    "🤓",
    "🧐",
    "🤔",
    "😐",
    "😑",
    "😶",
    "🤭",
    "🤫",
    "🤗",
    "🤨",
    "😏",
    "😒",
    "🙄",
    "😬",
    "🤥",
    "😔",
    "😪",
    "🤤",
    "😴",
    "😷",
    "🤒",
    "🤕",
    "🤢",
    "🤮",
    "🤧",
    "🥵",
    "🥶",
    "🥴",
    "😵",
    "🤯",
    "🤠",
    "🥳",
    "😎",
    "🤓",
    "🧐",
  ];

  // 선물 전송 핸들러
  const handleSendGift = async (gift: (typeof gifts)[0]) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const giftMessage = `${user.displayName || "사용자"}님이 ${gift.icon} ${gift.name}을(를) 선물했습니다! (${gift.price} 포인트)`;

    if (channelType === "vtuber") {
      // VTuber 채널에서는 메시지로 전송
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          content: giftMessage,
          sender: "user",
          timestamp: new Date().toISOString(),
          isBot: false,
          senderName:
            user?.displayName || user?.email?.split("@")[0] || "사용자",
          senderAvatar: user?.photoURL || "",
        },
      ]);
    } else {
      // Firebase 채널에서는 Firebase로 전송
      const chatRoomId = currentChannel ?? "general";
      try {
        await sendChatMessage(chatRoomId, giftMessage, user.uid);
      } catch (error) {
        console.error("선물 메시지 전송 오류:", error);
        toast({
          title: "전송 오류",
          description: "선물을 전송할 수 없습니다.",
          variant: "destructive",
        });
      }
    }

    setShowGiftPopup(false);
  };

  // 이모티콘 전송 핸들러
  const handleSendEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPopup(false);
  };

  // 메시지에 반응 추가/제거
  const handleReaction = async (messageId: string | number, emoji: string) => {
    if (!user) return;
    
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const userReactions = msg.reactions?.[emoji] || [];
    const isAdd = !userReactions.includes(user.uid);

    // 즉시 UI 업데이트
    setMessages(prev => prev.map(message => {
      if (message.id === messageId) {
        const reactions = { ...(message.reactions || {}) };
        const currentUserReactions = reactions[emoji] || [];
        
        if (isAdd) {
          // 반응 추가
          reactions[emoji] = [...currentUserReactions, user.uid];
        } else {
          // 반응 제거
          reactions[emoji] = currentUserReactions.filter(uid => uid !== user.uid);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        }
        
        return { ...message, reactions };
      }
      return message;
    }));

    // 서버에 저장 (Firebase 채팅만)
    if (channelType === "firebase" && currentChannel && typeof messageId === 'string') {
      try {
        const result = await updateMessageReaction(currentChannel, messageId, emoji, user.uid, isAdd);
        if (!result.success) {
          console.error("반응 업데이트 실패:", result.error);
          // 실패 시 UI 롤백
          setMessages(prev => prev.map(message => {
            if (message.id === messageId) {
              return { ...message, reactions: msg.reactions };
            }
            return message;
          }));
        }
      } catch (error) {
        console.error("반응 업데이트 중 오류:", error);
      }
    }

    setShowReactionPicker(null);
  };

  // 답글 시작
  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setMessage(""); // 메시지 입력창 초기화
    // 입력창에 포커스
    setTimeout(() => {
      const inputElement = document.querySelector('input[placeholder*="답글"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    }, 100);
  };

  // 메시지 삭제 (완전 제거)
  const handleDeleteMessage = async (messageId: string | number) => {
    if (!user) return;
    
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    // 즉시 UI에서 완전 제거
    setMessages(prev => prev.filter(message => {
      // 본인 메시지만 삭제 가능
      if (message.id === messageId && (message.sender === "user" || user.uid === message.raw?.senderId)) {
        return false; // 메시지 제거
      }
      return true; // 메시지 유지
    }));

    // 서버에 저장 (Firebase 채팅만)
    if (channelType === "firebase" && currentChannel && typeof messageId === 'string') {
      try {
        const result = await deleteMessage(currentChannel, messageId, user.uid);
        if (!result.success) {
          console.error("메시지 삭제 실패:", result.error);
          // 실패 시 UI 롤백 (메시지 다시 추가)
          setMessages(prev => [...prev, msg].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ));
        }
      } catch (error) {
        console.error("메시지 삭제 중 오류:", error);
      }
    }
  };

  // 답글 취소
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // 채널 타입에 따른 연결 설정
  useEffect(() => {
    console.log("🎯 채널 설정 변경:", {
      channelType,
      currentChannel,
      user: user?.uid,
      wsConnected,
      vtuberConnecting,
    });

    if (channelType === "vtuber" && user && !wsConnected && !vtuberConnecting) {
      console.log("🤖 VTuber 연결 조건 충족 - 연결 시작 (3초 후)");
      // 컴포넌트 안정화 대기 후 연결
      const connectTimeout = setTimeout(() => {
        console.log("⏰ VTuber 연결 시작 타이머 실행");
        connectToVTuber();
      }, 3000);

      return () => {
        console.log("🧹 VTuber 연결 타이머 정리");
        clearTimeout(connectTimeout);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // 채널 전환 시 즉시 연결 종료하지 않고 잠시 대기
        // if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        //   wsRef.current.close(1000, 'Channel switching');
        // }
      };
    } else if (channelType === "firebase") {
      // Firebase 연결 로직은 기존 useEffect에서 처리
      console.log("🔥 Firebase 채널 모드");
    }

    // 정리 함수 - 연결 유지 개선
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // 불필요한 채널 전환으로 인한 연결 종료 방지
      // if (wsRef.current && channelType !== 'vtuber') {
      //   wsRef.current.close(1000, 'Channel switching');
      // }
    };
  }, [channelType, currentChannel, user]);

  // 채널 전환 시 메시지 초기화
  useEffect(() => {
    console.log("🔄 채널 전환 감지 - 메시지 초기화:", {
      channelType,
      currentChannel,
      messagesCount: messages.length
    });
    
    // 채널이 변경되면 메시지를 초기화
    setMessages([]);
    
    // 메시지 리스너도 초기화
    if (messageListenerRef.current) {
      messageListenerRef.current();
      messageListenerRef.current = null;
    }
  }, [channelType, currentChannel]);

  // 음성 인식 결과 처리 - 바로 AI와 대화
  useEffect(() => {
    if (
      voiceDetector.transcription &&
      channelType === "vtuber" &&
      wsConnected
    ) {
      const userVoiceMessage = voiceDetector.transcription.trim();

      if (userVoiceMessage) {
        // 사용자 음성 메시지를 채팅에 표시
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            content: userVoiceMessage,
            sender: "user",
            timestamp: new Date().toISOString(),
            isBot: false,
            senderName:
              user?.displayName || user?.email?.split("@")[0] || "사용자",
            senderAvatar: user?.photoURL || "",
            replyTo: replyingTo?.id.toString(),
          },
        ]);

        // 답글 상태 초기화
        setReplyingTo(null);

        // AI 아바타를 생각하는 표정으로 변경
        setCurrentEmotion("neutral");

        // AI에게 바로 전송 (메시지 입력창 사용하지 않음)
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const vtuberMessage = {
            type: "text-input",
            text: userVoiceMessage,
            replyTo: replyingTo?.id.toString(),
          };

          wsRef.current.send(JSON.stringify(vtuberMessage));
        }

        // 음성 인식 결과 정리
        voiceDetector.clearTranscription();
      }
    } else if (voiceDetector.transcription && channelType === "firebase") {
      // Firebase 채널에서는 기존 방식대로 입력창에 추가
      setMessage(
        (prev) => prev + (prev ? " " : "") + voiceDetector.transcription,
      );
      voiceDetector.clearTranscription();
    }
  }, [
    voiceDetector.transcription,
    channelType,
    wsConnected,
    user,
    voiceDetector,
  ]);

  // 마이크 토글 함수 - VAD 음성 대화 (한 번 클릭으로 계속 듣기)
  const toggleMicrophone = useCallback(async () => {
    if (!voiceDetector.isListening) {
      // 리스닝 시작
      try {
        await voiceDetector.startListening();

        // VTuber 모드에서 경청 상태로 변경
        if (channelType === "vtuber") {
          setCurrentEmotion("joy"); // 경청하는 기쁜 표정
        }
      } catch (error) {
        console.error("음성 리스닝 시작 실패:", error);
        toast({
          title: "마이크 오류",
          description: "마이크를 사용할 수 없습니다. 권한을 확인해주세요.",
          variant: "destructive",
        });
      }
    } else {
      // 리스닝 중지
      await voiceDetector.stopListening();

      // 기본 표정으로 변경
      if (channelType === "vtuber") {
        setCurrentEmotion("neutral");
      }
    }
  }, [voiceDetector, channelType, toast]);

  // 메시지 전송 함수 - 채널 타입에 따라 분기
  const handleSendMessage = useCallback(async () => {
    if (channelType === "vtuber") {
      await sendVTuberMessage();
    } else {
      await handleFirebaseSendMessage();
    }
  }, [channelType, sendVTuberMessage]);

  // Firebase 메시지 전송 함수
  const handleFirebaseSendMessage = useCallback(async () => {
    if ((!message.trim() && imageUploads.length === 0) || !user) return;

    const chatRoomId = currentChannel ?? "general";

    const trimmedMessage = message.trim();
    const imageUrls: string[] = [];


    // 메시지 입력창 초기화 (즉시 UI 반응)
    setMessage("");

    // 이미지가 있으면 업로드
    if (imageUploads.length > 0) {
      setIsUploading(true);
      try {
        // 모든 이미지 업로드 작업 병렬 처리 - 환경에 따라 적절한 서버로 전송
        const uploadPromises = imageUploads.map(async (file) => {
          console.log("📤 이미지 업로드 시작:", file.name);

          // 업로드 URL 결정 (환경에 따라)
          let uploadUrl = import.meta.env.VITE_IMAGE_UPLOAD_URL;
          
          if (!uploadUrl) {
            const isHttps = window.location.protocol === 'https:';
            const currentHost = window.location.hostname;
            
            // 항상 현재 서버의 API 사용 (Cloudinary로 업로드)
            uploadUrl = `/api/upload`;
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

        // 모든 업로드가 완료될 때까지 기다림
        imageUrls.push(...(await Promise.all(uploadPromises)));
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
      console.log(
        "메시지 전송 시도:",
        trimmedMessage,
        "이미지:",
        imageUrls.length > 0 ? `${imageUrls.length}개` : "없음",
      );


      // 이미지와 텍스트를 하나의 메시지로 전송 (이미지를 그룹화)
      // 일반 회원 가입 사용자를 위해 displayName과 photoURL 전달
      const result = await sendChatMessage(
        chatRoomId,
        trimmedMessage,
        user.uid,
        imageUrls.join(","),
        replyingTo?.id.toString(),
        user.displayName || user.email?.split("@")[0] || "사용자",
        user.photoURL || undefined,
      );

      // 답글 상태 초기화
      setReplyingTo(null);

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
    if (e.key === "Enter" && !e.shiftKey) {
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
    const imageUrls = msg.imageUrl ? msg.imageUrl.split(",") : [];

    // URL을 HTML 링크로 변환
    const htmlContent = convertLinksToHtml(msg.content);

    // 답글 대상 메시지 찾기
    const replyToMessage = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;

    // 사용자가 메시지를 삭제할 수 있는지 확인
    const canDelete = user && (msg.sender === "user" || user.uid === msg.raw?.senderId);

    // 삭제된 메시지는 렌더링하지 않음
    if (msg.isDeleted) {
      return null;
    }

    return (
      <div key={msg.id} className="relative">

        <div className="flex items-start space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-opacity-30 p-2 rounded group relative">
          <Avatar className="w-10 h-10 mt-0.5">
            <AvatarImage src={msg.senderAvatar || undefined} />
            <AvatarFallback
              className={`text-white ${
                msg.isBot
                  ? "bg-gradient-to-br from-purple-500 to-pink-500"
                  : "bg-gradient-to-br from-blue-500 to-cyan-500"
              }`}
            >
              {msg.senderName?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline space-x-2 flex-wrap">
              <span
                className={`font-medium ${
                  msg.isBot
                    ? "text-purple-600 dark:text-purple-300"
                    : msg.sender === "user"
                      ? "text-blue-600 dark:text-blue-300"
                      : "text-gray-900 dark:text-white"
                }`}
              >
                {msg.senderName || (msg.sender === "user" ? "나" : "사용자")}
              </span>
              {msg.isBot && (
                <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                  BOT
                </span>
              )}
              {msg.replyTo && (
                <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                  답글
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">{msg.timestamp}</span>
              
              {/* 한줄 답글 표시 */}
              {msg.replyTo && (
                <span className="text-xs text-purple-600 dark:text-purple-300 flex items-center space-x-1 bg-gray-200 dark:bg-[#1A1A1B] px-2 py-1 rounded">
                  <i className="fas fa-reply text-xs"></i>
                  <span className="text-gray-600 dark:text-gray-400">
                    {replyToMessage && !replyToMessage.isDeleted 
                      ? `"${replyToMessage.content.substring(0, 20)}${replyToMessage.content.length > 20 ? '...' : ''}"`
                      : "삭제된 메시지"}
                  </span>
                  <span className="text-purple-400">→</span>
                </span>
              )}
            </div>
            
            {/* 이미지 표시 */}
            {imageUrls.length > 0 && (
              <div className="mt-2">
                {imageUrls.length === 1 ? (
                  <div 
                    className="relative rounded-lg overflow-hidden max-w-sm cursor-pointer group bg-gray-200 dark:bg-gray-600 border-2 border-red-500"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🖼️ 컨테이너 클릭! URL:', imageUrls[0]);
                      console.log('🖼️ 클릭 전 selectedImage:', selectedImage);
                      
                      // 강제 상태 변화를 위해 먼저 null로 초기화
                      setSelectedImage(null);
                      setTimeout(() => {
                        setSelectedImage(imageUrls[0]);
                        console.log('🖼️ 지연된 setSelectedImage 완료:', imageUrls[0]);
                      }, 10);
                    }}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <img
                      src={getAbsoluteImageUrl(imageUrls[0])}
                      alt="첨부 이미지"
                      className="w-full h-auto max-h-64 object-cover hover:opacity-90 transition-opacity"
                      style={{ pointerEvents: 'none' }}
                      onLoad={() => console.log('🖼️ 이미지 로드 완료:', imageUrls[0])}
                      onError={() => console.log('❌ 이미지 로드 실패:', imageUrls[0])}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 pointer-events-none">
                      <i className="fas fa-expand text-white opacity-0 group-hover:opacity-80 text-lg"></i>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                    {imageUrls.map((url, index) => (
                      <div 
                        key={index} 
                        className="rounded-lg overflow-hidden cursor-pointer group relative bg-gray-200 dark:bg-gray-600 border border-red-400"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🖼️ 다중 이미지 컨테이너 클릭! URL:', url);
                          
                          // 강제 상태 변화를 위해 먼저 null로 초기화
                          setSelectedImage(null);
                          setTimeout(() => {
                            setSelectedImage(url);
                          }, 10);
                        }}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <img
                          src={getAbsoluteImageUrl(url)}
                          alt={`첨부 이미지 ${index + 1}`}
                          className="w-full h-32 object-cover"
                          style={{ pointerEvents: 'none' }}
                          onLoad={() => console.log('🖼️ 다중 이미지 로드 완료:', url)}
                          onError={() => console.log('❌ 다중 이미지 로드 실패:', url)}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 pointer-events-none">
                          <i className="fas fa-expand text-white opacity-0 group-hover:opacity-80 text-sm"></i>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* 메시지 내용 */}
            {msg.content && (
              <div
                className="text-gray-700 dark:text-gray-100 mt-1 break-words"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            )}

            {/* 반응 표시 */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(msg.id, emoji)}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                      user && userIds.includes(user.uid)
                        ? "bg-purple-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{userIds.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 메시지 액션 버튼들 */}
          <div className="opacity-0 group-hover:opacity-100 flex space-x-1 relative">
            <Button
              variant="ghost"
              size="sm"
              className="w-7 h-7 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              data-reaction-trigger
              onClick={() => setShowReactionPicker(showReactionPicker === msg.id.toString() ? null : msg.id.toString())}
            >
              <i className="fas fa-smile text-sm"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-7 h-7 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              onClick={() => handleReply(msg)}
            >
              <i className="fas fa-reply text-sm"></i>
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="w-7 h-7 p-0 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                onClick={() => handleDeleteMessage(msg.id)}
              >
                <i className="fas fa-trash text-sm"></i>
              </Button>
            )}
          </div>

          {/* 반응 선택기 */}
          {showReactionPicker === msg.id.toString() && (
            <div className="reaction-picker absolute top-0 right-0 mt-8 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-2 z-50">
              <div className="flex gap-1">
                {["👍", "❤️", "😂", "😮", "😢", "😡", "👏", "🔥"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(msg.id, emoji)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 아바타-채팅 채널 설명 섹션 추가
  const renderAvatarChatHeader = () => {
    if (currentChannel === "Avatar-chat" || channelType === "vtuber") {
      return (
        <div className="relative bg-gray-100 dark:bg-[#0B0B0B] border-b border-gray-200 dark:border-purple-500/30 overflow-hidden transition-colors" style={{ zIndex: 0 }}>
          {/* 배경 장식 요소들 - 보라색/핑크 톤 (다크 모드 only) */}
          <div className="absolute top-4 left-8 w-20 h-20 bg-purple-500/10 dark:bg-purple-500/30 rounded-full blur-xl"></div>
          <div className="absolute bottom-6 right-16 w-24 h-24 bg-pink-500/10 dark:bg-pink-500/30 rounded-full blur-xl"></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-violet-500/10 dark:bg-violet-500/30 rounded-full blur-lg"></div>

          {/* VTuber 캐릭터 - 오른쪽 배치 */}
          <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-0 hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-200/20 dark:bg-purple-400/30 rounded-full blur-2xl scale-150 animate-pulse"></div>
              <img
                src="/images/2dmodel/7.png"
                alt="AI Avatar Character"
                className="w-36 h-44 object-contain relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(168, 85, 247, 0.3))",
                  animation: "float 5s ease-in-out infinite",
                }}
              />
            </div>
          </div>

          {/* 추가 작은 캐릭터 - 왼쪽 하단 */}
          <div className="absolute left-6 bottom-4 z-0 hidden lg:block opacity-60 dark:opacity-80">
            <div className="relative">
              <img
                src="/images/2dmodel/1.png"
                alt="AI Avatar Character"
                className="w-24 h-28 object-contain drop-shadow-lg hover:scale-110 transition-transform duration-300"
                style={{
                  filter: "drop-shadow(0 0 12px rgba(236, 72, 153, 0.3))",
                  animation: "float 3.5s ease-in-out infinite 0.8s",
                }}
              />
            </div>
          </div>

          {/* 컨텐츠 영역 */}
          <div className="relative z-0 px-6 py-8 max-w-2xl">
            <div className="bg-white/80 dark:bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-purple-300/20">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mr-4">
                  <i className="fas fa-magic text-white text-lg"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    AI 아바타와 실시간 대화하세요!
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant="default"
                      className="bg-purple-200 dark:bg-purple-500/30 text-purple-700 dark:text-purple-200 border-purple-300 dark:border-purple-400/40"
                    >
                      <i className="fas fa-robot mr-1"></i>
                      AI 대화
                    </Badge>
                    <Badge
                      variant="default"
                      className="bg-pink-200 dark:bg-pink-500/30 text-pink-700 dark:text-pink-200 border-pink-300 dark:border-pink-400/40"
                    >
                      <i className="fas fa-bolt mr-1"></i>
                      실시간
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-gray-700 dark:text-gray-100">
                <p className="text-lg leading-relaxed">
                  <i className="fas fa-wand-magic-sparkles text-pink-500 dark:text-pink-400 mr-2"></i>
                  최첨단 AI 기술로 구현된 생생한 대화 경험을 만나보세요!
                </p>
                <p className="text-sm leading-relaxed opacity-90">
                  실시간으로 반응하는 AI 아바타와 자연스러운 대화를 나누세요.
                  감정 표현, 개성 있는 응답, 그리고 놀라운 대화 능력을
                  체험해보세요.
                </p>
                <div className="flex items-center space-x-4 pt-2">
                  <div className="flex items-center text-sm text-green-600 dark:text-green-300">
                    <i className="fas fa-circle text-green-500 dark:text-green-400 mr-2 text-xs animate-pulse"></i>
                    실시간 응답
                  </div>
                  <div className="flex items-center text-sm text-purple-600 dark:text-purple-300">
                    <i className="fas fa-brain mr-2"></i>
                    고급 AI
                  </div>
                  <div className="flex items-center text-sm text-pink-600 dark:text-pink-300">
                    <i className="fas fa-heart mr-2"></i>
                    감정 표현
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (children) {
    return <div className="flex-1 bg-white dark:bg-[#030303] flex flex-col transition-colors" style={{ height: 'calc(100vh - 40px)' }}>{children}</div>;
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex-1 bg-white dark:bg-[#030303] flex items-center justify-center transition-colors" style={{ height: 'calc(100vh - 40px)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-purple-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">채팅방을 로드하는 중...</p>
        </div>
      </div>
    );
  }

  // 개별 채팅방 (DM)
  if (chatPartner) {
    return (
      <div className="flex-1 bg-white dark:bg-[#030303] flex flex-col overflow-hidden transition-colors" style={{ height: 'calc(100vh - 40px)' }}>
        {/* 채널 헤더 */}
        <div
          className={`h-12 bg-gray-100 dark:bg-[#0B0B0B] border-b border-gray-200 dark:border-[#1A1A1B] flex items-center px-4 shadow-sm transition-colors ${
            isMobile ? "relative z-30" : ""
          }`}
        >
          <div className="flex items-center">
            <Avatar className="w-8 h-8 mr-3">
              <AvatarImage src={getAbsoluteImageUrl(chatPartner?.imageUrl)} />
              <AvatarFallback className="bg-purple-100 text-purple-600">
                {chatPartner?.name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-gray-900 dark:text-white font-semibold">{chatPartner?.name}</h2>
          </div>
          <div className="ml-4 text-sm text-gray-600 dark:text-gray-300">
            AI 아바타와의 개인 대화
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={handlePhoneClick}
            >
              <i className="fas fa-phone"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <i className="fas fa-video"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <i className="fas fa-users"></i>
            </Button>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full px-2 sm:px-4 py-1">
            <div className="space-y-4">
              {/* 채팅 시작 메시지 */}
              {messages.length === 0 && (
                <div className="mb-8">
                  <Avatar className="w-16 h-16 mb-4">
                    <AvatarImage
                      src={getAbsoluteImageUrl(chatPartner?.imageUrl)}
                    />
                    <AvatarFallback className="bg-purple-100 text-purple-600 text-2xl">
                      {chatPartner?.name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {chatPartner?.name}와의 대화
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    AI 아바타와 함께 대화를 시작해보세요.
                  </p>
                </div>
              )}

              {/* 메시지 목록 */}
              {messages.map((msg) => renderMessage(msg))}
            </div>
          </ScrollArea>
        </div>

        {/* 메시지 입력 영역 */}
        <div
          className={`flex-shrink-0 px-2 sm:px-4 py-3 bg-gray-100 dark:bg-[#0B0B0B] border-t border-gray-200 dark:border-[#1A1A1B] relative transition-colors ${
            isMobile ? "z-30" : ""
          }`}
        >
          {/* 이미지 미리보기 */}
          {imageUploads.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {imageUploads.map((file, index) => (
                <div
                  key={index}
                  className="relative border border-gray-300 dark:border-[#272729] rounded-md overflow-hidden p-1 bg-gray-200 dark:bg-[#1A1A1B]"
                >
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

          {/* 답글 표시 */}
          {replyingTo && (
            <div className="absolute bottom-full left-0 right-0 mb-0 mx-4 p-3 bg-gray-200 dark:bg-[#1A1A1B] rounded-t-lg border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm">
                  <i className="fas fa-reply text-purple-400"></i>
                  <span className="text-gray-600 dark:text-gray-300">답글:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{replyingTo.senderName || "사용자"}</span>
                  <span className="text-gray-500 dark:text-gray-400 truncate max-w-xs">
                    {replyingTo.isDeleted ? "삭제된 메시지" : replyingTo.content}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  onClick={cancelReply}
                >
                  <i className="fas fa-times text-xs"></i>
                </Button>
              </div>
            </div>
          )}

          <div className="bg-gray-200 dark:bg-[#1A1A1B] rounded-lg">
            <div className="flex items-end p-3 space-x-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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
                  placeholder={
                    replyingTo
                      ? `${replyingTo.senderName || "사용자"}에게 답글을 입력하세요...`
                      : isUploading
                        ? "이미지 업로드 중..."
                        : "메시지를 입력하세요..."
                  }
                  className="bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                  disabled={!isConnected || isUploading}
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
                {/* 음성 대화 마이크 버튼 - VAD */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-8 h-8 p-0 transition-all duration-300 relative ${
                    voiceDetector.isRecording
                      ? "text-red-400 bg-red-900/30 border-red-400/50"
                      : voiceDetector.isProcessing
                        ? "text-yellow-400 bg-yellow-900/30"
                        : voiceDetector.isListening
                          ? "text-green-400 bg-green-900/30 border-green-400/50"
                          : "text-gray-300 hover:text-green-400 hover:bg-green-900/20"
                  }`}
                  onClick={toggleMicrophone}
                  title={
                    voiceDetector.isRecording
                      ? "🎤 녹음 중... 말을 멈추면 자동으로 AI가 응답합니다"
                      : voiceDetector.isProcessing
                        ? "🤔 AI가 답변을 준비하고 있습니다..."
                        : voiceDetector.isListening
                          ? "🎧 음성 감지 중... 클릭하면 중지됩니다"
                          : channelType === "vtuber"
                            ? "🗣️ 클릭하여 AI와 음성 대화하기"
                            : "🎤 음성 입력"
                  }
                  disabled={voiceDetector.isProcessing}
                  style={{
                    transition: "all 0.3s ease",
                    boxShadow: voiceDetector.isRecording
                      ? "0 0 15px rgba(239, 68, 68, 0.5)"
                      : voiceDetector.isListening
                        ? "0 0 15px rgba(34, 197, 94, 0.5)"
                        : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!voiceDetector.isProcessing) {
                      e.currentTarget.style.transform = "scale(1.1)";
                      if (voiceDetector.isRecording) {
                        e.currentTarget.style.boxShadow =
                          "0 0 20px rgba(239, 68, 68, 0.7)";
                      } else if (voiceDetector.isListening) {
                        e.currentTarget.style.boxShadow =
                          "0 0 20px rgba(34, 197, 94, 0.7)";
                      } else {
                        e.currentTarget.style.boxShadow =
                          "0 0 12px rgba(34, 197, 94, 0.4)";
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    if (voiceDetector.isRecording) {
                      e.currentTarget.style.boxShadow =
                        "0 0 15px rgba(239, 68, 68, 0.5)";
                    } else if (voiceDetector.isListening) {
                      e.currentTarget.style.boxShadow =
                        "0 0 15px rgba(34, 197, 94, 0.5)";
                    } else {
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  {voiceDetector.isProcessing ? (
                    <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : voiceDetector.isRecording ? (
                    <div className="relative">
                      <i className="fas fa-microphone animate-pulse text-base"></i>
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                    </div>
                  ) : voiceDetector.isListening ? (
                    <div className="relative">
                      <i className="fas fa-microphone text-base"></i>
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  ) : (
                    <i className="fas fa-microphone-slash text-base"></i>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 text-gray-300 transition-all duration-200"
                  onClick={() => setShowGiftPopup(!showGiftPopup)}
                  title="선물 보내기"
                  style={{
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#f472b6";
                    e.currentTarget.style.transform = "scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#d1d5db";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <i className="fas fa-gift"></i>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 text-gray-300 transition-all duration-200"
                  onClick={() => setShowEmojiPopup(!showEmojiPopup)}
                  title="이모티콘"
                  style={{
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#facc15";
                    e.currentTarget.style.transform = "scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#d1d5db";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
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

          {!(channelType === "vtuber" ? wsConnected : isConnected) && (
            <p className="text-xs text-red-400 mt-1">
              {channelType === "vtuber"
                ? "AI 아바타 서버에 연결 중..."
                : "연결이 끊겼습니다. 재연결을 시도하는 중..."}
            </p>
          )}

          {/* 선물 팝업 */}
          {showGiftPopup && (
            <div className="gift-popup absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-3 z-50">
              <div className="flex items-center mb-2">
                <i className="fas fa-gift text-pink-400 mr-2"></i>
                <h3 className="text-gray-900 dark:text-white font-semibold text-sm">선물 보내기</h3>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {gifts.map((gift) => (
                  <Button
                    key={gift.id}
                    variant="ghost"
                    className="min-w-[120px] h-12 flex items-center justify-start px-3 py-1 hover:bg-purple-900/30 text-white border border-gray-600 hover:border-purple-400 group transition-all duration-200 flex-shrink-0"
                    onClick={() => handleSendGift(gift)}
                  >
                    <span className="text-lg gift-icon-enhance mr-2">
                      {gift.icon}
                    </span>
                    <div className="flex flex-col items-start text-left">
                      <div className="text-white font-medium text-xs truncate max-w-[70px]">{gift.name}</div>
                      <div className="text-yellow-400 font-bold text-xs">
                        {gift.price}P
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 이모티콘 팝업 */}
          {showEmojiPopup && (
            <div className="emoji-popup absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-3 z-50">
              <div className="flex items-center mb-2">
                <i className="fas fa-smile text-yellow-400 mr-2"></i>
                <h3 className="text-gray-900 dark:text-white font-semibold text-sm">이모티콘</h3>
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
                {emojis.map((emoji, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0 text-lg hover:bg-purple-900/20 rounded flex-shrink-0"
                    onClick={() => handleSendEmoji(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 전화번호 표시 모달 */}
        <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-[#0B0B0B] text-gray-900 dark:text-white border-gray-200 dark:border-[#1A1A1B]">
            <DialogHeader>
              <DialogTitle>통화 연결</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                아래 전화번호로 연결할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 flex flex-col items-center">
              <p className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{phoneNumber}</p>
              <div className="flex gap-3">
                <Button
                  variant="default"
                  className="w-24 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setShowPhoneModal(false)}
                >
                  취소
                </Button>
                <Button
                  className="w-24 bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    window.location.href = `tel:${phoneNumber.replace(/-/g, "")}`;
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

  // general 채널이고 Firebase 타입일 때는 Reddit 스타일 피드 표시
  if (currentChannel === "general" && channelType === "firebase") {
    // 피드 포스트 상세 페이지 확인
    const feedPostMatch = location.match(/^\/feed\/(\d+)$/);
    if (feedPostMatch) {
      const postId = parseInt(feedPostMatch[1]);
      return <FeedPostDetail postId={postId} />;
    }
    
    // 피드 목록 표시
    return <FeedView sortBy={feedSortBy} />;
  }

  // 로그인하지 않은 사용자도 일반 채널은 볼 수 있음
  return (
    <div className="flex-1 bg-white dark:bg-[#030303] flex flex-col overflow-hidden transition-colors" style={{ height: 'calc(100vh - 40px)' }}>
      {/* 채널 헤더 */}
      <div
        className={`h-12 bg-gray-100 dark:bg-[#0B0B0B] border-b border-gray-200 dark:border-[#1A1A1B] flex items-center px-2 shadow-sm transition-colors ${
          isMobile ? "relative z-30" : ""
        }`}
      >
        <div className="flex items-center">
          <i className="fas fa-hashtag text-gray-600 dark:text-gray-300 mr-2"></i>
          <h2 className="text-gray-900 dark:text-white font-semibold">
{(() => {
              if (channelType === "vtuber" && currentChannel?.startsWith('avatar-')) {
                const modelName = currentChannel.replace('avatar-', '');
                return `${modelName}와 채팅`;
              }
              return channelType === "vtuber" ? "아바타와 채팅" : "일반";
            })()}
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {channelType === "vtuber"
              ? "_AI 아바타와 실시간"
              : "_AI 아바타들과 자유롭게"}
          </div>
          <div className="flex items-center space-x-2">
            {/* 개성 아이콘 버튼 - VTuber 채널에서만 표시 */}
            {channelType === "vtuber" && (
              <Button
                onClick={() => setShowPersonalityDialog(true)}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all duration-200"
                title={avatarPersonality ? `개성: ${avatarPersonality}` : "아바타 개성 설정"}
              >
                <i className={`fas fa-brain text-lg ${avatarPersonality ? 'text-purple-500 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}></i>
              </Button>
            )}

            {/* 채널 참여자 프로필 사진 */}
            {channelMembers.length > 0 && (
              <div className="flex items-center space-x-1">
                <div className="flex -space-x-2">
                  {channelMembers.slice(0, 5).map((member, index) => (
                    <Avatar 
                      key={member.uid} 
                      className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 hover:z-10 transition-all duration-200"
                      title={member.displayName}
                    >
                      <AvatarImage src={member.photoURL ? normalizeImageUrl(member.photoURL) : undefined} alt={member.displayName} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                        {member.displayName[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {channelMembers.length > 5 && (
                    <div 
                      className="w-6 h-6 bg-gray-300 dark:bg-gray-500 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center text-xs text-gray-900 dark:text-white font-medium"
                      title={`+${channelMembers.length - 5}명 더`}
                    >
                      +{channelMembers.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                  {channelMembers.length}명
                </span>
              </div>
            )}

            {/* 연결 상태 */}
            <Badge
              variant={
                (channelType === "vtuber" ? wsConnected : isConnected)
                  ? "outline"
                  : "destructive"
              }
              className={`px-2 py-1 text-xs whitespace-nowrap ${
                (channelType === "vtuber" ? wsConnected : isConnected)
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-red-100 text-red-700 border-red-200"
              }`}
            >
              {(channelType === "vtuber" ? wsConnected : isConnected)
                ? "연결됨"
                : "연결 끊김"}
            </Badge>
          </div>
        </div>
      </div>

      {!user ? (
        // 로그인 안내
        <div
          className="flex-1 flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 200px)" }}
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-300 dark:bg-gray-500 rounded-full flex items-center justify-center mb-6 mx-auto">
              <i className="fas fa-user-lock text-3xl text-gray-600 dark:text-gray-300"></i>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              로그인이 필요합니다
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md">
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
          {/* Live2D 아바타 영역 - VTuber 채널에서만 표시 */}
          {channelType === "vtuber" && (
            <div
              className={`flex-shrink-0 bg-gray-100 dark:bg-[#0B0B0B] border-b border-gray-200 dark:border-[#1A1A1B] ${
                isMobile ? "relative z-10" : ""
              }`}
              style={{ maxHeight: "400px" }}
            >
              <div className="flex justify-center items-center">
                <div className="relative">
                  <Live2DAvatarPixi
                    key="live2d-avatar" // 고정 key로 컴포넌트 재마운트 방지
                    modelName={selectedModel}
                    width={450}
                    height={700}
                    emotion={currentEmotion}
                    onLoaded={(model: Live2DModel) => {
                      setLive2dInstance(model);
                      console.log(`✅ 모델 로드 완료: ${selectedModel}`);
                    }}
                    onError={(error: Error) => {
                      console.error("PIXI.js + WebGL 로드 오류:", error);
                    }}
                    onSpeakReady={(speakFn) => {
                      console.log("🎤 MainContent에서 TTS 함수 받음:", {
                        speakFnExists: !!speakFn,
                        speakFnType: typeof speakFn,
                        speakFnName: speakFn?.name || "no name",
                      });

                      // React 함수 state 저장 시 올바른 방법
                      setSpeakFunction(
                        (
                          prev:
                            | ((
                                input: string,
                                type?: "text" | "audio",
                                volumes?: number[],
                              ) => void)
                            | null,
                        ) => {
                          console.log("🎤 speakFunction 업데이트:", {
                            prevExists: !!prev,
                            newExists: !!speakFn,
                            newType: typeof speakFn,
                          });
                          return speakFn;
                        },
                      );

                      console.log("🎤 setSpeakFunction 호출 완료");
                    }}
                    onSpeakingChange={(speaking) => {
                      setIsAvatarSpeaking(speaking);
                      console.log(`🎤 아바타 말하기 상태 변경: ${speaking ? '말하는 중' : '대기 중'}`);
                    }}
                    className="mx-auto"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 메시지 영역 - 고정 높이로 스크롤 가능 */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea ref={scrollAreaRef} className="h-full px-2 sm:px-4">
              <div className="space-y-3">
                {/* 채널별 소개 영역 - 스크롤 가능한 영역 내부 */}
                {(() => {
                  if (channelType === "vtuber") {
                    return (
                      <ChannelIntroSection
                        description={vtuberChannelDescription}
                        isVtuber={true}
                      />
                    );
                  }

                  if (channelType === "firebase" && currentChannel) {
                    const description = getChannelDescription(currentChannel);
                    if (description) {
                      return (
                        <ChannelIntroSection
                          description={description}
                          isVtuber={false}
                        />
                      );
                    }
                  }

                  return null;
                })()}

                {messages.length === 0 && channelType === "vtuber" && (
                  <div className="mb-6 text-center space-y-3">
                    <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-600/20 rounded-full border border-purple-300 dark:border-purple-500/30">
                      <i className="fas fa-robot text-purple-600 dark:text-purple-400 mr-2"></i>
                      <span className="text-gray-700 dark:text-gray-200 text-sm">
                        Live2D 아바타와 대화해보세요! 아바타를 클릭하면
                        반응합니다.
                      </span>
                    </div>

                    {/* 연결 상태 안내 */}
                    <div className="text-center">
                      {wsConnected ? (
                        <div className="inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-600/20 rounded-full border border-green-300 dark:border-green-500/30">
                          <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2 animate-pulse"></div>
                          <span className="text-green-700 dark:text-green-200 text-xs">
                            AI 서버 연결됨 - 대화 가능!
                          </span>
                        </div>
                      ) : vtuberConnecting ? (
                        <div className="inline-flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-600/20 rounded-full border border-yellow-300 dark:border-yellow-500/30">
                          <div className="w-2 h-2 bg-yellow-500 dark:bg-yellow-400 rounded-full mr-2 animate-bounce"></div>
                          <span className="text-yellow-700 dark:text-yellow-200 text-xs">
                            AI 서버 연결 중...
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-600/20 rounded-full border border-blue-300 dark:border-blue-500/30">
                          <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-2"></div>
                          <span className="text-blue-700 dark:text-blue-200 text-xs">
                            Live2D 아바타 표시 중 - 클릭해서 감정 변화 체험!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {messages.length === 0 && channelType === "firebase" && (
                  <div className="mb-6 text-center">
                    {currentChannel === "general" && (
                      <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-600/20 rounded-full border border-purple-300 dark:border-purple-500/30">
                        <i className="fas fa-comment-dots text-purple-600 dark:text-purple-400 mr-2"></i>
                        <span className="text-gray-700 dark:text-gray-200 text-sm">
                          대화를 시작해보세요! 아래에 메시지를 입력하세요.
                        </span>
                      </div>
                    )}
                    {currentChannel === "random" && (
                      <div className="inline-flex items-center px-4 py-2 bg-orange-100 dark:bg-orange-600/20 rounded-full border border-orange-300 dark:border-orange-500/30">
                        <i className="fas fa-laugh text-orange-600 dark:text-orange-400 mr-2"></i>
                        <span className="text-gray-700 dark:text-gray-200 text-sm">
                          편하게 이야기해보세요! 무엇이든 좋아요.
                        </span>
                      </div>
                    )}
                    {currentChannel === "help" && (
                      <div className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-600/20 rounded-full border border-blue-300 dark:border-blue-500/30">
                        <i className="fas fa-question-circle text-blue-600 dark:text-blue-400 mr-2"></i>
                        <span className="text-gray-700 dark:text-gray-200 text-sm">
                          궁금한 것이 있으시면 언제든 질문해주세요!
                        </span>
                      </div>
                    )}
                    {currentChannel === "Avatar-chat" && (
                      <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-600/30 rounded-full border border-purple-300 dark:border-purple-400/40">
                        <i className="fas fa-robot text-purple-600 dark:text-purple-400 mr-2"></i>
                        <span className="text-gray-700 dark:text-gray-200 text-sm">
                          AI 아바타와 실시간으로 대화해보세요!
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 아바타 채팅용 시작 메시지 */}
                {messages.length === 0 && channelType === "vtuber" && (
                  <div className="mb-6 text-center">
                    <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-600/30 rounded-full border border-purple-300 dark:border-purple-400/40">
                      <i className="fas fa-magic text-purple-600 dark:text-purple-400 mr-2"></i>
                      <span className="text-gray-700 dark:text-gray-100 text-sm">
                        AI 아바타가 응답을 기다리고 있어요! 대화를 시작해보세요.
                      </span>
                    </div>
                  </div>
                )}

                {/* 메시지 목록 */}
                {messages.map((msg) => renderMessage(msg))}
              </div>
            </ScrollArea>
          </div>

          {/* 메시지 입력 영역 - 하단 고정 */}
          <div
            className={`flex-shrink-0 px-2 sm:px-4 py-3 bg-gray-100 dark:bg-[#0B0B0B] border-t border-gray-200 dark:border-[#1A1A1B] relative transition-colors ${
              isMobile ? "z-30" : ""
            }`}
          >
            {/* 이미지 미리보기 */}
            {imageUploads.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {imageUploads.map((file, index) => (
                  <div
                    key={index}
                    className="relative border border-gray-300 dark:border-[#272729] rounded-md overflow-hidden p-1 bg-gray-200 dark:bg-[#1A1A1B]"
                  >
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

            <div className="bg-gray-200 dark:bg-[#1A1A1B] rounded-lg">
              <div className="flex items-end p-3 space-x-3">
                {channelType === "firebase" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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
                      replyingTo
                        ? `${replyingTo.senderName || "사용자"}에게 답글을 입력하세요...`
                        : channelType === "vtuber"
                          ? "AI 아바타에게 메시지를 보내세요..."
                          : isUploading
                            ? "이미지 업로드 중..."
                            : "메시지를 입력하세요..."
                    }
                    className="bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                    disabled={
                      (channelType === "vtuber"
                        ? !wsConnected
                        : !isConnected) || isUploading
                    }
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
                  {/* 음성 대화 마이크 버튼 - VAD */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-8 h-8 p-0 transition-all duration-300 relative ${
                      voiceDetector.isRecording
                        ? "text-red-400 bg-red-900/30 border-red-400/50"
                        : voiceDetector.isProcessing
                          ? "text-yellow-400 bg-yellow-900/30"
                          : voiceDetector.isListening
                            ? "text-green-400 bg-green-900/30 border-green-400/50"
                            : "text-gray-300 hover:text-green-400 hover:bg-green-900/20"
                    }`}
                    onClick={toggleMicrophone}
                    title={
                      voiceDetector.isRecording
                        ? "🎤 녹음 중... 말을 멈추면 자동으로 AI가 응답합니다"
                        : voiceDetector.isProcessing
                          ? "🤔 AI가 답변을 준비하고 있습니다..."
                          : voiceDetector.isListening
                            ? "🎧 음성 감지 중... 클릭하면 중지됩니다"
                            : "🎤 음성 입력"
                    }
                    disabled={voiceDetector.isProcessing}
                    style={{
                      transition: "all 0.3s ease",
                      boxShadow: voiceDetector.isRecording
                        ? "0 0 15px rgba(239, 68, 68, 0.5)"
                        : voiceDetector.isListening
                          ? "0 0 15px rgba(34, 197, 94, 0.5)"
                          : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!voiceDetector.isProcessing) {
                        e.currentTarget.style.transform = "scale(1.1)";
                        if (voiceDetector.isRecording) {
                          e.currentTarget.style.boxShadow =
                            "0 0 20px rgba(239, 68, 68, 0.7)";
                        } else if (voiceDetector.isListening) {
                          e.currentTarget.style.boxShadow =
                            "0 0 20px rgba(34, 197, 94, 0.7)";
                        } else {
                          e.currentTarget.style.boxShadow =
                            "0 0 12px rgba(34, 197, 94, 0.4)";
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      if (voiceDetector.isRecording) {
                        e.currentTarget.style.boxShadow =
                          "0 0 15px rgba(239, 68, 68, 0.5)";
                      } else if (voiceDetector.isListening) {
                        e.currentTarget.style.boxShadow =
                          "0 0 15px rgba(34, 197, 94, 0.5)";
                      } else {
                        e.currentTarget.style.boxShadow = "none";
                      }
                    }}
                  >
                    {voiceDetector.isProcessing ? (
                      <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : voiceDetector.isRecording ? (
                      <div className="relative">
                        <i className="fas fa-microphone animate-pulse text-base"></i>
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                      </div>
                    ) : voiceDetector.isListening ? (
                      <div className="relative">
                        <i className="fas fa-microphone text-base"></i>
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      </div>
                    ) : (
                      <i className="fas fa-microphone-slash text-base"></i>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 text-gray-600 dark:text-gray-300 transition-all duration-200"
                    onClick={() => setShowGiftPopup(!showGiftPopup)}
                    title="선물 보내기"
                    style={{
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#f472b6";
                      e.currentTarget.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#6b7280";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <i className="fas fa-gift"></i>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 text-gray-600 dark:text-gray-300 transition-all duration-200"
                    onClick={() => setShowEmojiPopup(!showEmojiPopup)}
                    title="이모티콘"
                    style={{
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#facc15";
                      e.currentTarget.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#6b7280";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <i className="fas fa-smile"></i>
                  </Button>
                  {(message.trim() ||
                    (channelType === "firebase" &&
                      imageUploads.length > 0)) && (
                    <Button
                      onClick={handleSendMessage}
                      size="sm"
                      className="w-8 h-8 p-0 bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={
                        channelType === "vtuber" ? !wsConnected : isUploading
                      }
                    >
                      {channelType === "firebase" && isUploading ? (
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
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                연결이 끊겼습니다. 재연결을 시도하는 중...
              </p>
            )}

            {/* VTuber 채팅 답글 표시 */}
            {replyingTo && (
              <div className="absolute bottom-full left-0 right-0 mb-0 mx-4 p-3 bg-gray-100 dark:bg-[#1A1A1B] rounded-t-lg border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm">
                    <i className="fas fa-reply text-purple-400"></i>
                    <span className="text-gray-600 dark:text-gray-300">답글:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{replyingTo.senderName || "사용자"}</span>
                    <span className="text-gray-400 truncate max-w-xs">
                      {replyingTo.isDeleted ? "삭제된 메시지" : replyingTo.content}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    onClick={cancelReply}
                  >
                    <i className="fas fa-times text-xs"></i>
                  </Button>
                </div>
              </div>
            )}

            {/* 선물 팝업 */}
            {showGiftPopup && (
              <div className="gift-popup absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-3 z-50">
                <div className="flex items-center mb-2">
                  <i className="fas fa-gift text-pink-400 mr-2"></i>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-sm">선물 보내기</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {gifts.map((gift) => (
                    <Button
                      key={gift.id}
                      variant="ghost"
                      className="min-w-[120px] h-12 flex items-center justify-start px-3 py-1 text-white border border-gray-600 group transition-all duration-200 flex-shrink-0"
                      onClick={() => handleSendGift(gift)}
                      style={{
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(147, 51, 234, 0.3)";
                        e.currentTarget.style.borderColor = "#a855f7";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.borderColor = "#4b5563";
                      }}
                    >
                      <span
                        className="text-lg transition-transform duration-200 filter mr-2"
                        style={{
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.1)";
                          e.currentTarget.style.filter =
                            "brightness(1.25) drop-shadow(0 0 12px rgba(255, 215, 0, 0.8))";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.filter = "none";
                        }}
                      >
                        {gift.icon}
                      </span>
                      <div className="flex flex-col items-start text-left">
                        <div className="text-white font-medium text-xs truncate max-w-[70px]">
                          {gift.name}
                        </div>
                        <div className="text-yellow-400 font-bold text-xs">
                          {gift.price}P
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* 이모티콘 팝업 */}
            {showEmojiPopup && (
              <div className="emoji-popup absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-3 z-50">
                <div className="flex items-center mb-2">
                  <i className="fas fa-smile text-yellow-400 mr-2"></i>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-sm">이모티콘</h3>
                </div>
                <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
                  {emojis.map((emoji, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 text-lg rounded transition-all duration-200 flex-shrink-0"
                      onClick={() => handleSendEmoji(emoji)}
                      style={{
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(147, 51, 234, 0.2)";
                        e.currentTarget.style.transform = "scale(1.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 이미지 확대 모달 */}
      {selectedImage ? (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50"
          style={{ zIndex: 999999 }}
          onClick={() => {
            setSelectedImage(null);
          }}
        >
          <div className="w-full h-full flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-full">
              <img
                src={selectedImage}
                alt="확대된 이미지"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <button
              onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
              <div className="absolute bottom-4 right-4 flex space-x-2">
                <button
                  onClick={() => window.open(selectedImage, '_blank')}
                  className="text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-colors"
                  title="새 탭에서 열기"
                >
                  <i className="fas fa-external-link-alt"></i>
                </button>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedImage;
                    link.download = 'image.jpg';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-colors"
                  title="다운로드"
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 개성 설정 다이얼로그 */}
      <Dialog open={showPersonalityDialog} onOpenChange={setShowPersonalityDialog}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-900 border-2 border-purple-500/30">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent flex items-center gap-2">
              <i className="fas fa-brain text-purple-500"></i>
              아바타 개성 설정
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              {selectedModel ? `${selectedModel} 아바타` : '현재 아바타'}의 고유한 개성을 설정하세요.
              설정한 개성은 대화와 음성 생성에 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <i className="fas fa-edit text-purple-500"></i>
                캐릭터 개성 입력
              </label>
              <textarea
                value={personalityInput}
                onChange={(e) => setPersonalityInput(e.target.value)}
                placeholder="예: 밝고 긍정적인 성격으로 친근하게 대화하며, 가끔 장난스러운 말투를 사용합니다. 상대방의 이야기를 잘 들어주고 공감하는 편이에요."
                className="w-full min-h-[150px] p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <i className="fas fa-info-circle"></i>
                성격, 말투, 특징 등을 자유롭게 입력하세요.
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                <i className="fas fa-lightbulb"></i>
                개성 설정 예시
              </h4>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <li>• <span className="font-medium">긍정적이고 활발한 성격:</span> "항상 밝고 긍정적이며, 에너지가 넘치는 성격"</li>
                <li>• <span className="font-medium">차분하고 지적인 성격:</span> "조용하고 사려 깊으며, 논리적으로 설명하는 편"</li>
                <li>• <span className="font-medium">친근하고 공감하는 성격:</span> "따뜻하게 공감하고 친구처럼 대하는 성격"</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={() => setShowPersonalityDialog(false)}
              variant="outline"
              className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              취소
            </Button>
            <Button
              onClick={handleSavePersonality}
              disabled={!personalityInput.trim()}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-save mr-2"></i>
              저장하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MainContent;
