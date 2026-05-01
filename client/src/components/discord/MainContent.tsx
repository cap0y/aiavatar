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

// 硫붿떆吏 ??낆뿉 ?대?吏 URL 異붽?
interface Message {
  id: number | string;
  content: string;
  sender: string;
  timestamp: string;
  raw?: any; // Firestore ?먮낯 ?곗씠??(?꾩슂??
  imageUrl?: string; // ?대?吏 URL ?꾨뱶 異붽?
  senderName?: string;
  senderAvatar?: string;
  isBot?: boolean;
  reactions?: { [emoji: string]: string[] }; // 諛섏쓳: { "?몟": ["userId1", "userId2"] }
  replyTo?: string; // ?듦? ???硫붿떆吏 ID
  isDeleted?: boolean; // ??젣??硫붿떆吏 ?щ?
}

// 梨꾪똿 ?뚰듃???뺣낫 ???interface ChatPartner {
  id: number | string;
  name: string;
  imageUrl?: string;
}

// 梨꾪똿 紐⑸줉 ??ぉ ???interface ChatListItem {
  id: number | string;
  senderId: number | string;
  senderName: string;
  senderImage?: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

// Firestore 梨꾪똿諛?????뺤쓽
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

// Firestore 硫붿떆吏 ??낆뿉 ?대?吏 URL 異붽?
interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  };
  read: boolean;
  imageUrl?: string; // ?대?吏 URL ?꾨뱶 異붽?
  replyTo?: string; // ?듦? ???硫붿떆吏 ID
  reactions?: { [emoji: string]: string[] }; // 諛섏쓳 媛앹껜
  isDeleted?: boolean; // ??젣 ?곹깭
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
  const [chatList, setChatList] = useState<ChatListItem[]>([]); // 鍮?諛곗뿴濡??쒖옉
  const [needAuth, setNeedAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [channelMembers, setChannelMembers] = useState<Array<{uid: string; displayName: string; photoURL?: string}>>([]);
  const messageListenerRef = useRef<(() => void) | null>(null);

  // Live2D 愿???곹깭
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
  ]); // ?ъ슜 媛?ν븳 紐⑤뜽 紐⑸줉
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false); // ?꾨컮? 留먰븯湲??곹깭

  // llm-response ?? ?뚯꽦 ?ъ깮 ?꾨즺 ???쒖감 泥섎━
  const responseQueueRef = useRef<Array<{
    originalText: string;
    cleanText: string;
    emotion: string;
    audioUrl: string;
    volumes: number[];
  }>>([]);
  const isPlayingResponseRef = useRef(false);
  
  // 媛쒖꽦(personality) 愿???곹깭
  const [avatarPersonality, setAvatarPersonality] = useState<string>("");
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [geminiModel, setGeminiModel] = useState<string>("gemini-2.0-flash");
  const [showPersonalityDialog, setShowPersonalityDialog] = useState(false);
  const [personalityInput, setPersonalityInput] = useState("");
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
  const [geminiModelInput, setGeminiModelInput] = useState<string>("gemini-2.0-flash");

  const GEMINI_MODELS = [
    { id: "gemini-1.5-flash",          label: "Gemini 1.5 Flash",         badge: "?덉젙" },
    { id: "gemini-1.5-pro",            label: "Gemini 1.5 Pro",           badge: "?덉젙" },
    { id: "gemini-2.0-flash",          label: "Gemini 2.0 Flash",         badge: "異붿쿇" },
    { id: "gemini-2.0-flash-exp",      label: "Gemini 2.0 Flash Exp",     badge: "?ㅽ뿕" },
    { id: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash",    badge: "理쒖떊" },
    { id: "gemini-2.5-pro-preview-03-25",   label: "Gemini 2.5 Pro",     badge: "理쒖떊" },
  ];

  // localStorage?먯꽌 媛쒖꽦 ?곗씠??遺덈윭?ㅺ린
  // Gemini API ??紐⑤뜽? ?ъ슜???꾩뿭 ??? 媛쒖꽦留??꾨컮?蹂????  useEffect(() => {
    const savedPersonality = localStorage.getItem(`avatar_personality_${selectedModel}`);
    setAvatarPersonality(savedPersonality ?? "");
  }, [selectedModel]);

  // Gemini API ??/ 紐⑤뜽? ???쒖옉 ????踰덈쭔 濡쒕뱶 (?꾨컮? 臾닿?)
  useEffect(() => {
    let savedKey   = localStorage.getItem("gemini_api_key_global");
    let savedModel = localStorage.getItem("gemini_model_global");

    // ?댁쟾 諛⑹떇(avatar_gemini_api_key_*)?쇰줈 ??λ맂 ???꾩닔 留덉씠洹몃젅?댁뀡
    if (!savedKey) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("avatar_gemini_api_key_")) {
          const val = localStorage.getItem(k);
          if (val && val.trim()) {
            savedKey = val.trim();
            localStorage.setItem("gemini_api_key_global", savedKey);
            break;
          }
        }
      }
    }
    if (!savedModel) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("avatar_gemini_model_")) {
          const val = localStorage.getItem(k);
          if (val && val.trim()) {
            savedModel = val.trim();
            localStorage.setItem("gemini_model_global", savedModel);
            break;
          }
        }
      }
    }

    if (savedKey)   setGeminiApiKey(savedKey);
    if (savedModel) setGeminiModel(savedModel);

    console.log("?뵎 Gemini ?ㅼ젙 濡쒕뱶:", {
      key: savedKey ? `${savedKey.substring(0, 10)}...` : "?놁쓬",
      model: savedModel ?? "湲곕낯媛??ъ슜",
    });
  }, []);

  // ?ㅼ씠?쇰줈洹멸? ?대┫/?ロ옄 ???낅젰 ?꾨뱶 ?숆린??  useEffect(() => {
    if (showPersonalityDialog) {
      setPersonalityInput(avatarPersonality);
      setGeminiApiKeyInput(geminiApiKey);
      setGeminiModelInput(geminiModel);
    } else {
      setPersonalityInput(avatarPersonality);
      setGeminiApiKeyInput(geminiApiKey);
      setGeminiModelInput(geminiModel);
    }
  }, [showPersonalityDialog, avatarPersonality, geminiApiKey, geminiModel]);

  // 媛쒖꽦 ????⑥닔
  const handleSavePersonality = () => {
    // 媛쒖꽦? ?꾨컮?蹂꾨줈 ???    setAvatarPersonality(personalityInput.trim());
    localStorage.setItem(`avatar_personality_${selectedModel}`, personalityInput.trim());

    // Gemini API ??쨌 紐⑤뜽? ?꾩뿭 ???(?꾨컮? 臾닿?)
    const trimmedKey = geminiApiKeyInput.trim();
    setGeminiApiKey(trimmedKey);
    localStorage.setItem("gemini_api_key_global", trimmedKey);

    setGeminiModel(geminiModelInput);
    localStorage.setItem("gemini_model_global", geminiModelInput);

    console.log(`?렚 ${selectedModel} 媛쒖꽦 ??λ맖 | Gemini 紐⑤뜽: ${geminiModelInput} | ???ㅼ젙: ${trimmedKey ? "?덉쓬" : "?놁쓬"}`);
    toast({
      title: "?ㅼ젙 ?꾨즺",
      description: "?꾨컮???媛쒖꽦怨?AI ?ㅼ젙???깃났?곸쑝濡???λ릺?덉뒿?덈떎.",
    });
    setShowPersonalityDialog(false);
  };

  // speakFunction ?곹깭 蹂??紐⑤땲?곕쭅 諛?ref ?낅뜲?댄듃
  useEffect(() => {
    console.log("?렎 speakFunction ?곹깭 蹂寃쎈맖:", {
      exists: !!speakFunction,
      type: typeof speakFunction,
      functionName: speakFunction?.name || "none",
      isFunction: typeof speakFunction === "function",
    });

    // ref???④퍡 ?낅뜲?댄듃
    speakFunctionRef.current = speakFunction;
  }, [speakFunction]);

  // ?ъ슜 媛?ν븳 紐⑤뜽 紐⑸줉 遺덈윭?ㅺ린
  useEffect(() => {
    const fetchAvailableModels = async () => {
      try {
        console.log("?뵇 ?ъ슜 媛?ν븳 紐⑤뜽 紐⑸줉 遺덈윭?ㅻ뒗 以?..");
        const response = await fetch("/api/model-editor/scan-models");

        // Content-Type ?뺤씤 (HTML???꾨땶 JSON?몄? 泥댄겕)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn(
            "?좑툘 ?쒕쾭媛 JSON??諛섑솚?섏? ?딆쓬 (HTML ?섏씠吏 諛섑솚), 湲곕낯 紐⑤뜽 ?ъ슜",
          );
          return;
        }

        if (response.ok) {
          const models = await response.json();
          if (Array.isArray(models) && models.length > 0) {
            const modelNames = models.map((model: any) => model.name);
            setAvailableModels(modelNames);
            console.log(
              `??${modelNames.length}媛?紐⑤뜽 濡쒕뱶 ?꾨즺:`,
              modelNames,
            );
          } else {
            console.warn("?좑툘 ?좏슚??紐⑤뜽 ?곗씠???놁쓬, 湲곕낯 紐⑤뜽 ?ъ슜");
          }
        } else {
          console.warn(
            `?좑툘 紐⑤뜽 紐⑸줉 遺덈윭?ㅺ린 ?ㅽ뙣 (${response.status}), 湲곕낯 紐⑤뜽 ?ъ슜`,
          );
        }
      } catch (error) {
        console.warn(
          "?좑툘 紐⑤뜽 紐⑸줉 遺덈윭?ㅺ린 ?ㅻ쪟 (?쒕쾭 誘몄쓳??, 湲곕낯 紐⑤뜽 ?ъ슜:",
          error,
        );
      }
    };

    // ?쒕쾭媛 以鍮꾨맆 ?쒓컙??二쇨린 ?꾪빐 ?쎄컙???쒕젅??異붽?
    const timeoutId = setTimeout(fetchAvailableModels, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  // URL ?뚮씪誘명꽣?먯꽌 紐⑤뜽 ?뺤씤 諛?紐⑤뜽 蹂寃??대깽??泥섎━
  useEffect(() => {
    // URL ?뚮씪誘명꽣?먯꽌 紐⑤뜽 ?뺤씤
    const urlParams = new URLSearchParams(window.location.search);
    const modelParam = urlParams.get('model');
    if (modelParam && channelType === 'vtuber') {
      console.log(`?렞 URL?먯꽌 紐⑤뜽 ?뚮씪誘명꽣 媛먯?: ${modelParam}`);
      setSelectedModel(modelParam);
    }

    // 紐⑤뜽 蹂寃??대깽??由ъ뒪??    const handleModelChange = (event: CustomEvent) => {
      const { modelName } = event.detail;
      console.log(`?봽 ?ъ씠?쒕컮?먯꽌 紐⑤뜽 蹂寃??붿껌: ${modelName}`);
      setSelectedModel(modelName);
    };

    window.addEventListener('modelChange', handleModelChange as EventListener);
    
    return () => {
      window.removeEventListener('modelChange', handleModelChange as EventListener);
    };
  }, [channelType]);

  // 梨꾨꼸 硫ㅻ쾭 濡쒕뱶
  useEffect(() => {
    const loadChannelMembers = () => {
      if (!currentChannel) {
        setChannelMembers([]);
        return;
      }

      // 而ㅼ뒪? 梨꾨꼸??寃쎌슦
      if (currentChannel.startsWith('custom-')) {
        try {
          const stored = localStorage.getItem('customChannels');
          if (stored) {
            const allChannels = JSON.parse(stored);
            const channel = allChannels.find((c: any) => c.id === currentChannel);
            
            if (channel && channel.members) {
              // ?ㅼ젣濡쒕뒗 Firebase?먯꽌 ?ъ슜???뺣낫瑜?媛?몄????섏?留? ?꾩떆濡?濡쒖뺄 ?곗씠???ъ슜
              const members = channel.members.map((uid: string) => ({
                uid,
                displayName: uid === user?.uid ? (user.displayName || '??) : `?ъ슜??{uid.slice(-4)}`,
                photoURL: uid === user?.uid ? user.photoURL : `https://ui-avatars.com/api/?name=${uid.slice(-4)}&background=6366f1&color=fff&size=32`
              }));
              setChannelMembers(members);
              return;
            }
          }
        } catch (error) {
          console.error('梨꾨꼸 硫ㅻ쾭 濡쒕뱶 ?ㅻ쪟:', error);
        }
      }

      // ?쇰컲 梨꾨꼸??寃쎌슦 ?꾩옱 ?ъ슜?먮쭔 ?쒖떆
      if (user) {
        setChannelMembers([{
          uid: user.uid,
          displayName: user.displayName || '??,
          photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366f1&color=fff&size=32`
        }]);
      } else {
        setChannelMembers([]);
      }
    };

    loadChannelMembers();
    
    // ?ㅽ넗由ъ? 蹂寃?媛먯?
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customChannels') {
        loadChannelMembers();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentChannel, user]);

  // VTuber WebSocket ?곌껐 ?곹깭 (?꾨컮? 梨꾪똿??
  const [wsConnected, setWsConnected] = useState(false);
  const [vtuberConnecting, setVtuberConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxReconnectAttempts = 2;

  // ?꾪솕踰덊샇 ?쒖떆 紐⑤떖 ?곹깭
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  // ?뚯꽦 ?몄떇 愿???곹깭 諛???(VAD ?ы븿)
  const voiceDetector = useVoiceActivityDetection(
    0.05, // 移⑤У ?꾧퀎媛?    600,  // 0.6珥?移⑤У ???먮룞 ?꾩넚 (湲곗〈 1.5珥???0.6珥?
    300,  // 理쒖냼 0.3珥??뱀쓬 (湲곗〈 0.8珥???0.3珥?
    isAvatarSpeaking, // ?꾨컮?媛 留먰븯??以묒씠硫??뚯꽦 ?낅젰 李⑤떒
  );

  // ?좊Ъ/?대え?곗퐯 ?앹뾽 ?곹깭 (?붿뒪肄붾뱶 ?ㅽ???
  const [showGiftPopup, setShowGiftPopup] = useState(false);
  const [showEmojiPopup, setShowEmojiPopup] = useState(false);
  
  // 硫붿떆吏 ?곹샇?묒슜 ?곹깭
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // ?앹뾽 ?몃? ?대┃ ???リ린
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // ?좊Ъ ?앹뾽 ?몃? ?대┃ ???リ린
      if (
        !target.closest(".gift-popup") &&
        !target.closest('[title="?좊Ъ 蹂대궡湲?]')
      ) {
        setShowGiftPopup(false);
      }
      
      // ?대え?곗퐯 ?앹뾽 ?몃? ?대┃ ???リ린
      if (
        !target.closest(".emoji-popup") &&
        !target.closest('[title="?대え?곗퐯"]')
      ) {
        setShowEmojiPopup(false);
      }

      // 諛섏쓳 ?좏깮湲??몃? ?대┃ ???リ린
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

  // ?곹깭 愿由?遺遺??섏젙 - ?⑥씪 ?대?吏?먯꽌 ?щ윭 ?대?吏濡?蹂寃?  const [imageUploads, setImageUploads] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // VTuber WebSocket ?곌껐 ?⑥닔
  const connectToVTuber = useCallback(async () => {
    // ?대? ?곌껐 以묒씠嫄곕굹 ?곌껐?섏뼱 ?덉쑝硫?以묐났 ?곌껐 諛⑹?
    if (wsRef.current?.readyState === WebSocket.OPEN || vtuberConnecting) {
      console.log("?봽 ?대? ?곌껐 以묒씠嫄곕굹 ?곌껐?섏뼱 ?덉뒿?덈떎.");
      return;
    }

    console.log("?? VTuber WebSocket ?곌껐 ?쒖옉...");
    setVtuberConnecting(true);

    try {
      // ?숈쟻?쇰줈 WebSocket URL ?앹꽦
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const port =
        window.location.port ||
        (window.location.protocol === "https:" ? "443" : "80");
      // 媛쒕컻 ?섍꼍?먯꽌 ?щ윭 ?ы듃 ?쒕룄
      const devPorts = ["5001", "5000", "3001"];
      const isLocalhost = host === "localhost" || host === "127.0.0.1";
      
      let wsUrl = "";
      if (isLocalhost) {
        // 媛쒕컻 ?섍꼍?먯꽌???ы듃 5001??癒쇱? ?쒕룄
        wsUrl = `${protocol}//${host}:5001/client-ws`;
      } else {
        wsUrl = `${protocol}//${host}:${port}/client-ws`;
      }
      
      console.log("?뱻 ?곌껐 URL:", wsUrl);

      const ws = new WebSocket(wsUrl);

      // ?곌껐 ??꾩븘???ㅼ젙 (10珥?
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log("??WebSocket ?곌껐 ??꾩븘??);
          ws.close();
        }
      }, 10000);

      ws.onopen = () => {
        console.log("??VTuber WebSocket ?곌껐 ?깃났");
        clearTimeout(connectionTimeout);
        setWsConnected(true);
        setVtuberConnecting(false);
        setConnectionAttempts(0);

        // ?곌껐 ?깃났 硫붿떆吏 異붽?
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            content: "?쨼 AI ?꾨컮?? ?곌껐?섏뿀?듬땲?? ??붾? ?쒖옉?대낫?몄슂!",
            sender: "system",
            timestamp: new Date().toISOString(),
            isBot: false,
            senderName: "VTuber System",
            senderAvatar: "",
          },
        ]);

        // ?좎떆 ??珥덇린??硫붿떆吏 ?꾩넚 (?쒕쾭媛 以鍮꾨맆 ?쒓컙 ?쒓났)
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log("?뱾 珥덇린???ㅼ젙 ?붿껌 ?꾩넚");
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
          console.log("?벂 VTuber 硫붿떆吏 ?섏떊:", data.type || "unknown", data);

          // 硫붿떆吏 ??낅퀎 ?덉쟾??泥섎━
          switch (data.type) {
            case "init-config":
              console.log("?렞 珥덇린 ?ㅼ젙 ?섏떊:", {
                model: data.currentModel || data.modelName,
                character: data.character_name,
                status: data.status,
              });

              // 紐⑤뜽 ?뺣낫媛 ?덉쑝硫??낅뜲?댄듃
              if (data.currentModel || data.modelName) {
                setSelectedModel(data.currentModel || data.modelName);
              }
              break;

            case "system":
              console.log("?뱼 ?쒖뒪??硫붿떆吏:", data.content);
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
                    senderAvatar: "?쨼",
                  },
                ]);
              }
              break;

            case "llm-response":
            case "ai-response": {
              const originalResponseText =
                data.text || data.content || data.message || "?묐떟??諛쏆븯?듬땲??";
              const { emotion: parsedEmotion, cleanText: parsedClean } =
                parseEmotionMessage(originalResponseText);

              // ?먯뿉 異붽? (硫붿떆吏 ?쒖떆 + ?뚯꽦 ?ъ깮? ?쒖감 泥섎━)
              responseQueueRef.current.push({
                originalText: originalResponseText,
                cleanText: parsedClean,
                emotion: parsedEmotion || (typeof data.emotion === "string" ? data.emotion : "neutral"),
                audioUrl: data.audioUrl || "",
                volumes: data.volumes || [],
              });
              console.log(`?뱿 ?묐떟 ??異붽?: ${responseQueueRef.current.length}媛??湲?);

              if (!isPlayingResponseRef.current) {
                processNextResponse();
              }
              break;
            }

            case "model-switched":
              if (data.model && typeof data.model === "string") {
                console.log("?봽 紐⑤뜽 ?꾪솚:", data.model);
                setSelectedModel(data.model);
                setCurrentEmotion("neutral");
              }
              break;

            case "heartbeat-ack":
              // ?섑듃鍮꾪듃 ?묐떟 (議곗슜??泥섎━)
              break;

            case "conversation-ended":
              console.log("?뵚 ???醫낅즺:", data.timestamp);
              // ???醫낅즺 ??以묒꽦 ?쒖젙?쇰줈 蹂寃?              setCurrentEmotion("neutral");
              break;

            case "error":
              console.warn("?좑툘 ?쒕쾭 ?ㅻ쪟:", data.message || "Unknown error");
              toast({
                title: "?쒕쾭 ?ㅻ쪟",
                description: data.message || "?????녿뒗 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
                variant: "destructive",
              });
              break;

            default:
              console.log("???????녿뒗 硫붿떆吏 ???", data.type);
          }
        } catch (error) {
          console.error("??硫붿떆吏 ?뚯떛 ?ㅻ쪟:", error, "Raw data:", event.data);
          // ?뚯떛 ?ㅻ쪟媛 ?덉뼱???곌껐???딆? ?딆쓬
        }
      };

        ws.onerror = (error) => {
          console.error("??VTuber WebSocket ?ㅻ쪟:", error);
          clearTimeout(connectionTimeout);
          setVtuberConnecting(false);
          setWsConnected(false);

          // 泥?踰덉㎏ ?곌껐 ?쒕룄 ?ㅽ뙣 ?쒖뿉留??덈궡 硫붿떆吏 ?쒖떆
          if (connectionAttempts === 0) {
            const isLocalhost = host === "localhost" || host === "127.0.0.1";
            const message = isLocalhost 
              ? "?렚 Live2D ?꾨컮????뺤긽 ?묐룞?⑸땲?? ?대┃?댁꽌 媛먯젙??蹂寃쏀빐蹂댁꽭??\n\n?쨼 AI ??붾? ?꾪빐?쒕뒗 諛깆뿏???쒕쾭瑜??ㅽ뻾?섏꽭??\n??`npm run dev:server` (?ы듃 5001)\n???먮뒗 `node server.js`"
              : "?렚 Live2D ?꾨컮????뺤긽 ?묐룞?⑸땲?? ?대┃?댁꽌 媛먯젙??蹂寃쏀빐蹂댁꽭??\n\n?쨼 AI ???湲곕뒫? ?꾩옱 ?쒕쾭???곌껐?????놁뒿?덈떎.";
              
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                content: message,
                sender: "system",
                timestamp: new Date().toISOString(),
                isBot: false,
                senderName: "Live2D System",
                senderAvatar: "?렚",
              },
            ]);
          }
        };

      ws.onclose = (event) => {
        console.log("VTuber WebSocket ?곌껐 醫낅즺:", event.code, event.reason);
        setWsConnected(false);
        setVtuberConnecting(false);

        clearTimeout(connectionTimeout);

        // 媛쒕컻 ?섍꼍?먯꽌???ъ뿰寃??쒕룄瑜????곴쾶, ?꾨줈?뺤뀡?먯꽌????留롮씠
        const isLocalhost = host === "localhost" || host === "127.0.0.1";
        const maxAttempts = isLocalhost ? 1 : maxReconnectAttempts;
        
        // ?뺤긽 醫낅즺媛 ?꾨땶 寃쎌슦?먮쭔 ?ъ뿰寃??쒕룄
        if (
          connectionAttempts < maxAttempts &&
          !event.wasClean &&
          event.code !== 1000
        ) {
          const nextAttempt = connectionAttempts + 1;
          const delay = isLocalhost ? 8000 : 5000; // 媛쒕컻 ?섍꼍?먯꽌????湲??湲?          
          console.log(
            `?봽 ?ъ뿰寃??쒕룄 ?덉빟: ${nextAttempt}/${maxAttempts} (${delay/1000}珥???`,
          );

          setConnectionAttempts(nextAttempt);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `?? ?ъ뿰寃??쒕룄 ${nextAttempt}/${maxAttempts} ?ㅽ뻾`,
            );
            connectToVTuber();
          }, delay);
        } else if (
          connectionAttempts >= maxAttempts ||
          event.code === 1000
        ) {
          if (connectionAttempts >= maxAttempts) {
            console.log("?썞 ?ъ뿰寃??ш린 - Live2D 紐⑤뜽留??쒖떆?⑸땲??");
          } else {
            console.log("???뺤긽 醫낅즺 - ?ъ뿰寃고븯吏 ?딆뒿?덈떎.");
          }
          setCurrentEmotion("neutral");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("??WebSocket ?앹꽦 ?ㅻ쪟:", error);
      setVtuberConnecting(false);
      setWsConnected(false);

      toast({
        title: "?곌껐 珥덇린???ㅽ뙣",
        description: "WebSocket ?앹꽦 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
        variant: "destructive",
      });
    }
  }, [vtuberConnecting, connectionAttempts, toast]);

  // VTuber 硫붿떆吏 ?꾩넚 ?⑥닔
  const sendVTuberMessage = useCallback(async () => {
    if (!message.trim() || !wsConnected) {
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "?곌껐 ?ㅻ쪟",
        description: "AI ?꾨컮? ?쒕쾭???곌껐?섏? ?딆븯?듬땲??",
        variant: "destructive",
      });
      return;
    }

    const messageText = message.trim();

    try {
      // ?ъ슜??硫붿떆吏 異붽?
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          content: messageText,
          sender: "user",
          timestamp: new Date().toISOString(),
          isBot: false,
          senderName:
            user?.displayName || user?.email?.split("@")[0] || "?ъ슜??,
          senderAvatar: user?.photoURL || "",
          replyTo: replyingTo?.id.toString(),
        },
      ]);

      // stale closure 諛⑹?: ?꾩넚 ?쒖젏??localStorage?먯꽌 吏곸젒 ?쎌쓬
      const freshGeminiKey   = localStorage.getItem("gemini_api_key_global") || "";
      const freshGeminiModel = localStorage.getItem("gemini_model_global")   || "gemini-2.0-flash";

      // VTuber ?쒕쾭濡?硫붿떆吏 ?꾩넚
      const vtuberMessage = {
        type: "text-input",
        text: messageText,
        replyTo: replyingTo?.id.toString(),
        personality: avatarPersonality,
        geminiApiKey: freshGeminiKey,
        geminiModel: freshGeminiModel,
      };

      wsRef.current.send(JSON.stringify(vtuberMessage));
      console.log("VTuber 硫붿떆吏 ?꾩넚:", {
        ...vtuberMessage,
        geminiApiKey: freshGeminiKey ? `${freshGeminiKey.substring(0, 10)}...` : "?놁쓬",
      });

      setMessage("");
      // ?듦? ?곹깭 珥덇린??      setReplyingTo(null);
    } catch (error) {
      console.error("VTuber 硫붿떆吏 ?꾩넚 ?ㅻ쪟:", error);
      toast({
        title: "?꾩넚 ?ㅻ쪟",
        description: "硫붿떆吏瑜??꾩넚?????놁뒿?덈떎.",
        variant: "destructive",
      });
    }
  // geminiApiKey쨌geminiModel? ?꾩넚 ??localStorage?먯꽌 吏곸젒 ?쎌쑝誘濡??섏〈??遺덊븘??  }, [message, wsConnected, user, toast, avatarPersonality]);

  // Firestore ?곌껐 ?곹깭 ?ㅼ젙
  useEffect(() => {
    if (db) {
      setIsConnected(true);
    } else {
      setIsConnected(false);
    }

    return () => {
      // ?댁쟾 硫붿떆吏 由ъ뒪?덇? ?덈떎硫??댁젣
      if (messageListenerRef.current) {
        messageListenerRef.current();
      }
    };
  }, []);

  // URL?먯꽌 'to' 留ㅺ컻蹂?섎? 媛?몄????대떦 梨꾪똿諛⑹쑝濡??대룞
  useEffect(() => {
    if (!user) {
      // ?ъ슜?먭? ?놁쑝硫????댁긽 泥섎━?섏? ?딆쓬
      return;
    }

    console.log("?꾩옱 URL:", location);

    // URL 留ㅺ컻蹂??異붿텧
    const urlParams = new URLSearchParams(window.location.search);
    const toParam = urlParams.get("to");
    const nameParam = urlParams.get("name");
    console.log("URL ?뚮씪誘명꽣 'to':", toParam, "name:", nameParam);

    if (toParam) {
      // ?먯떊怨쇱쓽 梨꾪똿?몄? ?뺤씤
      if (toParam === user.uid) {
        console.warn("?먯떊怨쇱쓽 梨꾪똿 ?쒕룄:", toParam);
        alert("?먯떊怨쇱쓽 梨꾪똿? 吏?먮릺吏 ?딆뒿?덈떎.");
        setLocation("/chat");
        return;
      }

      console.log("梨꾪똿諛?吏꾩엯 ?쒕룄 - ID:", toParam);
      setIsLoading(true);
      setShowChatList(false); // 梨꾪똿 紐⑸줉 ?④린湲?
      // 臾몄옄?대줈 ??ID瑜??寃?ID濡?蹂??      const targetId = toParam;

      // Firestore瑜??ъ슜?섏뿬 梨꾪똿諛??앹꽦/李몄뿬
      createOrGetChatRoom(user.uid, targetId)
        .then((result) => {
          if (result.success) {
            const newRoomId = result.roomId || "";
            setRoomId(newRoomId);
            console.log("梨꾪똿諛??앹꽦/李몄뿬 ?깃났:", newRoomId);

            // 梨꾪똿 ?뚰듃???뺣낫 李얘린
            const partnerInfo = chatList.find(
              (m) => m.senderId.toString() === targetId,
            );

            // 梨꾪똿 ?뚰듃???뺣낫 ?ㅼ젙 - URL?먯꽌 諛쏆? ?대쫫 ?곗꽑 ?ъ슜
            let partnerName = partnerInfo?.senderName || `?꾨컮? #${targetId}`;
            if (nameParam) {
              partnerName = decodeURIComponent(nameParam);
            }

            const partner: ChatPartner = {
              id: targetId,
              name: partnerName,
              imageUrl: partnerInfo?.senderImage || "/placeholder-Avatar.png",
            };

            setChatPartner(partner);

            // 硫붿떆吏 ?댁뿭 濡쒕뱶
            if (newRoomId) {
              getChatMessages(newRoomId)
                .then((messageResult) => {
                  if (messageResult.success && messageResult.messages) {
                    // 硫붿떆吏 ?щ㎎ 蹂??- any ??낆쑝濡?泥섎━
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
                      "硫붿떆吏 ?댁뿭 濡쒕뱶 ?꾨즺:",
                      formattedMessages.length,
                      "媛?,
                    );

                    // ?쎌? ?딆? 硫붿떆吏?ㅼ쓣 ?쎌쓬?쇰줈 ?쒖떆
                    markMessagesAsRead(newRoomId, user.uid).catch((err) => {
                      console.log("硫붿떆吏 ?쎌쓬 ?쒖떆 ?ㅽ뙣 (臾댁떆??:", err);
                    });
                  } else {
                    console.log("硫붿떆吏 ?댁뿭???놁뒿?덈떎.");
                    setMessages([]);
                  }

                  // ?댁쟾 由ъ뒪?덇? ?덈떎硫??댁젣
                  if (messageListenerRef.current) {
                    messageListenerRef.current();
                  }

                  // ?ㅼ떆媛?硫붿떆吏 援щ룆
                  messageListenerRef.current = subscribeToMessages(
                    newRoomId,
                    (newMessages: ChatMessage[]) => {
                      const formattedNewMessages = newMessages.map((msg) => ({
                        id: msg.id,
                        content: msg.content,
                        sender: msg.senderId === user.uid ? "user" : "other",
                        timestamp: formatMessageTimestamp(msg.timestamp),
                        imageUrl: msg.imageUrl,
                        replyTo: msg.replyTo, // ?듦? ?뺣낫 異붽?
                        reactions: msg.reactions || {}, // 諛섏쓳 ?뺣낫 異붽?
                        isDeleted: msg.isDeleted || false, // ??젣 ?곹깭 異붽?
                        raw: msg, // ?먮낯 ?곗씠??                      }));

                      setMessages(formattedNewMessages);

                      // ??硫붿떆吏媛 ?꾩갑?섎㈃ ?먮룞?쇰줈 ?쎌쓬 ?쒖떆
                      markMessagesAsRead(newRoomId, user.uid).catch((err) => {
                        console.log("??硫붿떆吏 ?쎌쓬 ?쒖떆 ?ㅽ뙣 (臾댁떆??:", err);
                      });
                    },
                  );

                  setIsLoading(false);
                  setIsInitialized(true);
                })
                .catch((error) => {
                  console.error("硫붿떆吏 ?댁뿭 濡쒕뱶 以??ㅻ쪟:", error);
                  setIsLoading(false);
                  setIsInitialized(true);
                });
            } else {
              setIsLoading(false);
            }

            // ?곷?諛??꾪솕踰덊샇 媛?몄삤湲?(?ㅼ젣濡쒕뒗 API?먯꽌 媛?몄?????
            setPhoneNumber(
              `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            );
          } else {
            console.error("梨꾪똿諛??앹꽦/李몄뿬 ?ㅽ뙣:", result.error);
            setIsLoading(false);

            // ?ㅽ뙣 ??梨꾪똿 紐⑸줉?쇰줈 ?뚯븘媛湲?            setShowChatList(true);
            alert("梨꾪똿諛??앹꽦???ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.");
          }
        })
        .catch((error) => {
          console.error("梨꾪똿諛??앹꽦/李몄뿬 以??ㅻ쪟:", error);
          setIsLoading(false);

          // ?ㅻ쪟 ??梨꾪똿 紐⑸줉?쇰줈 ?뚯븘媛湲?          setShowChatList(true);
          alert("梨꾪똿諛??앹꽦 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.");
        });
    } else {
      console.log("梨꾪똿 紐⑸줉 ?쒖떆 (URL ?뚮씪誘명꽣 ?놁쓬)");
      // 'to' ?뚮씪誘명꽣媛 ?놁쑝硫??쇰컲 梨꾨꼸濡??ㅼ젙
      setShowChatList(false);
      setChatPartner(null);
      setRoomId("general");
      setMessages([]);
      setIsInitialized(false);

      // ?댁쟾 硫붿떆吏 由ъ뒪?덇? ?덈떎硫??댁젣
      if (messageListenerRef.current) {
        messageListenerRef.current();
        messageListenerRef.current = null;
      }
    }
  }, [user, location]); // location???섏〈?깆뿉 異붽??섏뿬 URL 蹂寃쎌떆 ?ㅼ떆 ?ㅽ뻾

  // 硫붿떆吏 紐⑸줉???낅뜲?댄듃???뚮쭏???ㅽ겕濡ㅼ쓣 ?꾨옒濡??대룞
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

  // Firebase 梨꾪똿諛?珥덇린??(Firebase 梨꾨꼸??
  useEffect(() => {
    if (!user || channelType !== "firebase") return;
    if (!db) {
      console.error("Firebase DB媛 珥덇린?붾릺吏 ?딆븯?듬땲??");
      return;
    }

    const initializeFirebaseChatRoom = async () => {
      try {
        console.log("Firebase 梨꾪똿諛?珥덇린???쒖옉:", currentChannel);
        console.log("?ъ슜???몄쬆 ?곹깭:", user.uid, user.email);

        // 梨꾨꼸???곕Ⅸ 梨꾪똿諛?ID ?ㅼ젙
        const chatRoomId = currentChannel || "general";

        // ?ъ슜???몄쬆???꾨즺???뚭퉴吏 ?좎떆 ?湲?        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log("Firebase 梨꾪똿 吏곸젒 珥덇린???쒕룄:", chatRoomId);

        try {
          // 梨꾪똿諛??앹꽦 ?놁씠 諛붾줈 硫붿떆吏 濡쒕뱶 ?쒕룄
          const messageResult = await getChatMessages(chatRoomId);
          if (messageResult.success && messageResult.messages) {
            console.log(
              "硫붿떆吏 濡쒕뱶 ?꾨즺:",
              messageResult.messages.length,
              "媛?,
            );
            
            // 硫붿떆吏?먯꽌 怨좎쑀???ъ슜???뺣낫 異붿텧
            const uniqueMembers = new Map<string, {uid: string; displayName: string; photoURL?: string}>();
            messageResult.messages.forEach((msg: any) => {
              if (msg.senderId && msg.senderId !== user.uid && !msg.senderId.startsWith("Avatar_")) {
                if (msg.senderName || msg.photoURL) {
                  uniqueMembers.set(msg.senderId, {
                    uid: msg.senderId,
                    displayName: msg.senderName || "?ъ슜??,
                    photoURL: msg.photoURL
                  });
                }
              }
            });
            
            // channelMembers 珥덇린??            if (uniqueMembers.size > 0) {
              const members = Array.from(uniqueMembers.values());
              console.log(`?뱥 珥덇린 channelMembers ?ㅼ젙: ${members.length}紐?, members);
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
                  replyTo: msg.replyTo, // ?듦? ?뺣낫 異붽?
                  reactions: msg.reactions || {}, // 諛섏쓳 ?뺣낫 異붽?
                  isDeleted: msg.isDeleted || false, // ??젣 ?곹깭 異붽?
                  raw: msg, // ?먮낯 ?곗씠??異붽?
                };
              }
            );
            setMessages(formattedMessages);
          } else {
            console.log("硫붿떆吏媛 ?놁쓬 - 鍮?梨꾪똿諛⑹쑝濡??쒖옉");
            setMessages([]);
          }

          // ?댁쟾 由ъ뒪???댁젣
          if (messageListenerRef.current) {
            messageListenerRef.current();
          }

          // ?ㅼ떆媛?硫붿떆吏 援щ룆 - ?꾩껜 硫붿떆吏 諛곗뿴??諛쏆쓬
          const unsubscribe = subscribeToMessages(
            chatRoomId,
            (newMessages: any[]) => {
              console.log("?ㅼ떆媛?硫붿떆吏 ?낅뜲?댄듃:", newMessages.length, "媛?);
              
              // 硫붿떆吏?먯꽌 怨좎쑀???ъ슜???뺣낫 異붿텧
              const uniqueMembers = new Map<string, {uid: string; displayName: string; photoURL?: string}>();
              newMessages.forEach((msg: any) => {
                if (msg.senderId && msg.senderId !== user.uid && !msg.senderId.startsWith("Avatar_")) {
                  if (msg.senderName || msg.photoURL) {
                    uniqueMembers.set(msg.senderId, {
                      uid: msg.senderId,
                      displayName: msg.senderName || "?ъ슜??,
                      photoURL: msg.photoURL
                    });
                  }
                }
              });
              
              // channelMembers ?낅뜲?댄듃
              if (uniqueMembers.size > 0) {
                setChannelMembers(prev => {
                  const membersMap = new Map(prev.map(m => [m.uid, m]));
                  uniqueMembers.forEach((member, uid) => {
                    membersMap.set(uid, member);
                  });
                  const updated = Array.from(membersMap.values());
                  console.log(`?뱥 channelMembers ?낅뜲?댄듃: ${updated.length}紐?, updated);
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
                  replyTo: msg.replyTo, // ?듦? ?뺣낫 異붽?
                  reactions: msg.reactions || {}, // 諛섏쓳 ?뺣낫 異붽?
                  isDeleted: msg.isDeleted || false, // ??젣 ?곹깭 異붽?
                  raw: msg, // ?먮낯 ?곗씠??異붽?
                };
              });

              setMessages(formattedMessages);
            },
          );

          messageListenerRef.current = unsubscribe;
          console.log("Firebase 梨꾪똿 珥덇린???꾨즺");
        } catch (directError) {
          console.error("吏곸젒 硫붿떆吏 濡쒕뱶 ?ㅽ뙣:", directError);

          // 洹몃옒??梨꾪똿諛??앹꽦???쒕룄?대낫湲?          console.log("梨꾪똿諛??앹꽦 ?쒕룄:", chatRoomId, `public_${chatRoomId}`);
          const result = await createOrGetChatRoom(
            chatRoomId,
            `public_${chatRoomId}`,
          );

          if (result.success) {
            console.log("Firebase 梨꾪똿諛?以鍮??꾨즺:", result.roomId);
            setMessages([]);
          } else {
            console.error("梨꾪똿諛??앹꽦???ㅽ뙣:", result.error);
            // 沅뚰븳 ?ㅻ쪟??寃쎌슦 ?ъ슜?먯뿉寃??뚮┝
            if (
              result.error &&
              typeof result.error === "object" &&
              "code" in result.error &&
              result.error.code === "permission-denied"
            ) {
              toast({
                title: "沅뚰븳 ?ㅻ쪟",
                description:
                  "梨꾪똿諛⑹뿉 ?묎렐??沅뚰븳???놁뒿?덈떎. ?ㅼ떆 濡쒓렇?명빐二쇱꽭??",
                variant: "destructive",
              });
            }
          }
        }
      } catch (error) {
        console.error("Firebase 梨꾪똿諛?珥덇린???ㅻ쪟:", error);
        toast({
          title: "?곌껐 ?ㅻ쪟",
          description: "梨꾪똿 ?쒕쾭???곌껐?????놁뒿?덈떎.",
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

  // ?ъ슜???뺣낫 罹먯떆
  const userInfoCache = useRef<Map<string, {displayName: string; photoURL?: string}>>(new Map());

  const getSenderName = (senderId: string, msgData?: any): string => {
    // 硫붿떆吏 ?곗씠?곗뿉 senderName???덇퀬 "?ъ슜??媛 ?꾨땲硫??곗꽑 ?ъ슜
    if (msgData?.senderName && msgData.senderName !== "?ъ슜??) {
      return msgData.senderName;
    }

    if (senderId === user?.uid) {
      return user.displayName || user.email?.split("@")[0] || "??;
    }

    // 罹먯떆?먯꽌 李얘린
    const cached = userInfoCache.current.get(senderId);
    if (cached?.displayName) {
      return cached.displayName;
    }

    // channelMembers?먯꽌 李얘린
    const member = channelMembers.find(m => m.uid === senderId);
    if (member?.displayName) {
      return member.displayName;
    }

    // ?꾨컮? ID??寃쎌슦
    if (senderId.startsWith("Avatar_")) {
      const AvatarId = senderId.replace("Avatar_", "");
      const Avatar = AvatarSamples.find((a) => a.id === AvatarId);
      return Avatar?.name || "?꾨컮?";
    }

    // DB?먯꽌 ?ъ슜???뺣낫 媛?몄삤湲?(鍮꾨룞湲?
    fetchUserInfo(senderId);

    return msgData?.senderName || "?ъ슜??;
  };

  const getSenderAvatar = (senderId: string, msgData?: any): string | undefined => {
    let photoURL: string | undefined;

    // 硫붿떆吏 ?곗씠?곗뿉 photoURL???덉쑝硫??곗꽑 ?ъ슜
    if (msgData?.photoURL) {
      photoURL = msgData.photoURL;
    } else if (senderId === user?.uid) {
      photoURL = user.photoURL || undefined;
    } else {
      // 罹먯떆?먯꽌 李얘린
      const cached = userInfoCache.current.get(senderId);
      if (cached?.photoURL) {
        photoURL = cached.photoURL;
      } else {
        // channelMembers?먯꽌 李얘린
        const member = channelMembers.find(m => m.uid === senderId);
        if (member?.photoURL) {
          photoURL = member.photoURL;
        } else if (senderId.startsWith("Avatar_")) {
          // ?꾨컮? ID??寃쎌슦
          const AvatarId = senderId.replace("Avatar_", "");
          const Avatar = AvatarSamples.find((a) => a.id === AvatarId);
          photoURL = Avatar?.Avatar;
        } else {
          // DB?먯꽌 ?ъ슜???뺣낫 媛?몄삤湲?(鍮꾨룞湲?
          fetchUserInfo(senderId);
        }
      }
    }

    // photoURL???덉쑝硫??뺢퇋?뷀븯??諛섑솚, ?놁쑝硫?undefined 諛섑솚
    return photoURL ? normalizeImageUrl(photoURL) : undefined;
  };

  // DB?먯꽌 ?ъ슜???뺣낫 媛?몄삤湲?  const fetchUserInfo = async (userId: string) => {
    // ?대? ?붿껌 以묒씠嫄곕굹 罹먯떆???덉쑝硫??ㅽ궢
    if (userInfoCache.current.has(userId)) return;
    
    // ?꾩떆濡?鍮?媛앹껜 ???(以묐났 ?붿껌 諛⑹?)
    userInfoCache.current.set(userId, { displayName: "?ъ슜?? });

    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        if (userData.displayName || userData.photoURL) {
          userInfoCache.current.set(userId, {
            displayName: userData.displayName || "?ъ슜??,
            photoURL: userData.photoURL
          });
          
          // channelMembers ?낅뜲?댄듃
          setChannelMembers(prev => {
            const exists = prev.find(m => m.uid === userId);
            if (!exists) {
              return [...prev, {
                uid: userId,
                displayName: userData.displayName || "?ъ슜??,
                photoURL: userData.photoURL
              }];
            }
            return prev;
          });

          console.log(`??DB?먯꽌 ?ъ슜???뺣낫 媛?몄샂: ${userData.displayName}`);
        }
      } else if (response.status === 404) {
        // 404???뺤긽?곸씤 ?곹솴 (?ъ슜???뺣낫媛 ?놁쓣 ???덉쓬) - 寃쎄퀬 ?놁씠 泥섎━
        console.debug(`?뱄툘 ?ъ슜???뺣낫 ?놁쓬: ${userId}`);
      }
    } catch (error) {
      // ?ㅽ듃?뚰겕 ?먮윭 ???ㅼ젣 ?ㅻ쪟留?濡쒓렇
      if (error instanceof TypeError) {
        console.warn(`?좑툘 ?ъ슜???뺣낫 媛?몄삤湲??ㅽ뙣: ${userId}`);
      }
    }
  };

  // URL???곷? 寃쎈줈??寃쎌슦 ?덈? 寃쎈줈濡?蹂??  const getAbsoluteImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    return normalizeImageUrl(url);
  };

  // URL 媛먯? 諛?留곹겕 蹂???⑥닔
  const convertLinksToHtml = (text: string) => {
    if (!text) return "";

    // URL ?⑦꽩 (http, https濡??쒖옉?섎뒗 留곹겕)
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // URL??<a> ?쒓렇濡?援먯껜
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" class="text-blue-400 underline hover:text-blue-300" rel="noopener noreferrer">${url}</a>`;
    });
  };

  // ?뚯씪 ?좏깮 ?몃뱾??  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      const validFiles: File[] = [];

      // 媛??뚯씪??????좏슚??寃??      files.forEach((file) => {
        // ?뚯씪 ?ш린 ?쒗븳 (5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert(
            `?뚯씪 '${file.name}'???ш린媛 5MB瑜?珥덇낵?⑸땲?? ???묒? ?대?吏瑜??좏깮?댁＜?몄슂.`,
          );
          return;
        }

        // ?뚯씪 ????쒗븳
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!allowedTypes.includes(file.type)) {
          alert(
            `'${file.name}'?(?? 吏?먮릺吏 ?딅뒗 ?뚯씪 ?뺤떇?낅땲?? JPG, PNG, GIF, WEBP ?뚯씪留??낅줈??媛?ν빀?덈떎.`,
          );
          return;
        }

        validFiles.push(file);
      });

      setImageUploads((prevFiles) => [...prevFiles, ...validFiles]);
      console.log(`${validFiles.length}媛쒖쓽 ?대?吏 ?좏깮??);
    }
  };

  // ?대?吏 泥⑤? 踰꾪듉 ?대┃ ?몃뱾??  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // ?대?吏 ?쒓굅 ?몃뱾??  const handleRemoveImage = (index: number) => {
    setImageUploads((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  // ?좊Ъ ?곗씠??  const gifts = [
    { id: 1, name: "?섑듃", icon: "?뮇", price: 10 },
    { id: 2, name: "?λ?", icon: "?뙶", price: 50 },
    { id: 3, name: "耳?댄겕", icon: "?럟", price: 100 },
    { id: 4, name: "?ㅼ씠?꾨が??, icon: "?뭿", price: 500 },
    { id: 5, name: "?뺢?", icon: "?몣", price: 1000 },
    { id: 6, name: "蹂?, icon: "狩?, price: 25 },
  ];

  // ?대え?곗퐯 ?곗씠??  const emojis = [
    "??",
    "?쁼",
    "?쁽",
    "?쁺",
    "?쁿",
    "?쁾",
    "?ㄳ",
    "?쁻",
    "?셽",
    "?셾",
    "?삂",
    "?삃",
    "?삀",
    "?Ⅰ",
    "?삆",
    "?ㄹ",
    "?삓",
    "?삒",
    "?삖",
    "?삕",
    "?삄",
    "?삗",
    "?삙",
    "?ㄺ",
    "?삇",
    "?쨹",
    "?쭚",
    "?쨺",
    "?삉",
    "?삊",
    "?샄",
    "?ㄽ",
    "?ㄻ",
    "?쨽",
    "?ㄸ",
    "?삈",
    "?삋",
    "?셿",
    "?삱",
    "?ㄵ",
    "?삍",
    "?삫",
    "?ㄴ",
    "?샂",
    "?샆",
    "?쨸",
    "?쨻",
    "?ㄲ",
    "?ㄾ",
    "?ㄷ",
    "?Ⅵ",
    "?Ⅶ",
    "?Ⅴ",
    "?샃",
    "?ㄿ",
    "?쩆",
    "?Ⅳ",
    "?삇",
    "?쨹",
    "?쭚",
  ];

  // ?좊Ъ ?꾩넚 ?몃뱾??  const handleSendGift = async (gift: (typeof gifts)[0]) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const giftMessage = `${user.displayName || "?ъ슜??}?섏씠 ${gift.icon} ${gift.name}??瑜? ?좊Ъ?덉뒿?덈떎! (${gift.price} ?ъ씤??`;

    if (channelType === "vtuber") {
      // VTuber 梨꾨꼸?먯꽌??硫붿떆吏濡??꾩넚
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          content: giftMessage,
          sender: "user",
          timestamp: new Date().toISOString(),
          isBot: false,
          senderName:
            user?.displayName || user?.email?.split("@")[0] || "?ъ슜??,
          senderAvatar: user?.photoURL || "",
        },
      ]);
    } else {
      // Firebase 梨꾨꼸?먯꽌??Firebase濡??꾩넚
      const chatRoomId = currentChannel ?? "general";
      try {
        await sendChatMessage(chatRoomId, giftMessage, user.uid);
      } catch (error) {
        console.error("?좊Ъ 硫붿떆吏 ?꾩넚 ?ㅻ쪟:", error);
        toast({
          title: "?꾩넚 ?ㅻ쪟",
          description: "?좊Ъ???꾩넚?????놁뒿?덈떎.",
          variant: "destructive",
        });
      }
    }

    setShowGiftPopup(false);
  };

  // ?대え?곗퐯 ?꾩넚 ?몃뱾??  const handleSendEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPopup(false);
  };

  // 硫붿떆吏??諛섏쓳 異붽?/?쒓굅
  const handleReaction = async (messageId: string | number, emoji: string) => {
    if (!user) return;
    
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const userReactions = msg.reactions?.[emoji] || [];
    const isAdd = !userReactions.includes(user.uid);

    // 利됱떆 UI ?낅뜲?댄듃
    setMessages(prev => prev.map(message => {
      if (message.id === messageId) {
        const reactions = { ...(message.reactions || {}) };
        const currentUserReactions = reactions[emoji] || [];
        
        if (isAdd) {
          // 諛섏쓳 異붽?
          reactions[emoji] = [...currentUserReactions, user.uid];
        } else {
          // 諛섏쓳 ?쒓굅
          reactions[emoji] = currentUserReactions.filter(uid => uid !== user.uid);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        }
        
        return { ...message, reactions };
      }
      return message;
    }));

    // ?쒕쾭?????(Firebase 梨꾪똿留?
    if (channelType === "firebase" && currentChannel && typeof messageId === 'string') {
      try {
        const result = await updateMessageReaction(currentChannel, messageId, emoji, user.uid, isAdd);
        if (!result.success) {
          console.error("諛섏쓳 ?낅뜲?댄듃 ?ㅽ뙣:", result.error);
          // ?ㅽ뙣 ??UI 濡ㅻ갚
          setMessages(prev => prev.map(message => {
            if (message.id === messageId) {
              return { ...message, reactions: msg.reactions };
            }
            return message;
          }));
        }
      } catch (error) {
        console.error("諛섏쓳 ?낅뜲?댄듃 以??ㅻ쪟:", error);
      }
    }

    setShowReactionPicker(null);
  };

  // ?듦? ?쒖옉
  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setMessage(""); // 硫붿떆吏 ?낅젰李?珥덇린??    // ?낅젰李쎌뿉 ?ъ빱??    setTimeout(() => {
      const inputElement = document.querySelector('input[placeholder*="?듦?"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    }, 100);
  };

  // 硫붿떆吏 ??젣 (?꾩쟾 ?쒓굅)
  const handleDeleteMessage = async (messageId: string | number) => {
    if (!user) return;
    
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    // 利됱떆 UI?먯꽌 ?꾩쟾 ?쒓굅
    setMessages(prev => prev.filter(message => {
      // 蹂몄씤 硫붿떆吏留???젣 媛??      if (message.id === messageId && (message.sender === "user" || user.uid === message.raw?.senderId)) {
        return false; // 硫붿떆吏 ?쒓굅
      }
      return true; // 硫붿떆吏 ?좎?
    }));

    // ?쒕쾭?????(Firebase 梨꾪똿留?
    if (channelType === "firebase" && currentChannel && typeof messageId === 'string') {
      try {
        const result = await deleteMessage(currentChannel, messageId, user.uid);
        if (!result.success) {
          console.error("硫붿떆吏 ??젣 ?ㅽ뙣:", result.error);
          // ?ㅽ뙣 ??UI 濡ㅻ갚 (硫붿떆吏 ?ㅼ떆 異붽?)
          setMessages(prev => [...prev, msg].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ));
        }
      } catch (error) {
        console.error("硫붿떆吏 ??젣 以??ㅻ쪟:", error);
      }
    }
  };

  // ?듦? 痍⑥냼
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // 梨꾨꼸 ??낆뿉 ?곕Ⅸ ?곌껐 ?ㅼ젙
  useEffect(() => {
    console.log("?렞 梨꾨꼸 ?ㅼ젙 蹂寃?", {
      channelType,
      currentChannel,
      user: user?.uid,
      wsConnected,
      vtuberConnecting,
    });

    if (channelType === "vtuber" && user && !wsConnected && !vtuberConnecting) {
      console.log("?쨼 VTuber ?곌껐 議곌굔 異⑹” - ?곌껐 ?쒖옉 (3珥???");
      // 而댄룷?뚰듃 ?덉젙???湲????곌껐
      const connectTimeout = setTimeout(() => {
        console.log("??VTuber ?곌껐 ?쒖옉 ??대㉧ ?ㅽ뻾");
        connectToVTuber();
      }, 3000);

      return () => {
        console.log("?㏏ VTuber ?곌껐 ??대㉧ ?뺣━");
        clearTimeout(connectTimeout);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // 梨꾨꼸 ?꾪솚 ??利됱떆 ?곌껐 醫낅즺?섏? ?딄퀬 ?좎떆 ?湲?        // if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        //   wsRef.current.close(1000, 'Channel switching');
        // }
      };
    } else if (channelType === "firebase") {
      // Firebase ?곌껐 濡쒖쭅? 湲곗〈 useEffect?먯꽌 泥섎━
      console.log("?뵦 Firebase 梨꾨꼸 紐⑤뱶");
    }

    // ?뺣━ ?⑥닔 - ?곌껐 ?좎? 媛쒖꽑
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // 遺덊븘?뷀븳 梨꾨꼸 ?꾪솚?쇰줈 ?명븳 ?곌껐 醫낅즺 諛⑹?
      // if (wsRef.current && channelType !== 'vtuber') {
      //   wsRef.current.close(1000, 'Channel switching');
      // }
    };
  }, [channelType, currentChannel, user]);

  // 梨꾨꼸 ?꾪솚 ??硫붿떆吏 珥덇린??  useEffect(() => {
    console.log("?봽 梨꾨꼸 ?꾪솚 媛먯? - 硫붿떆吏 珥덇린??", {
      channelType,
      currentChannel,
      messagesCount: messages.length
    });
    
    // 梨꾨꼸??蹂寃쎈릺硫?硫붿떆吏瑜?珥덇린??    setMessages([]);
    
    // 硫붿떆吏 由ъ뒪?덈룄 珥덇린??    if (messageListenerRef.current) {
      messageListenerRef.current();
      messageListenerRef.current = null;
    }
  }, [channelType, currentChannel]);

  // ?뚯꽦 ?몄떇 寃곌낵 泥섎━ - ?낅젰李쎌뿉 ?쒖떆 ??利됱떆 ?꾩넚
  useEffect(() => {
    const recognized = voiceDetector.transcription?.trim();
    if (!recognized) return;

    // 癒쇱? ?몄떇 寃곌낵瑜??낅젰李쎌뿉 ?쒖떆
    setMessage(recognized);
    voiceDetector.clearTranscription();

    if (channelType === "vtuber" && wsConnected) {
      // 梨꾪똿 硫붿떆吏 紐⑸줉???ъ슜??硫붿떆吏 異붽?
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          content: recognized,
          sender: "user",
          timestamp: new Date().toISOString(),
          isBot: false,
          senderName: user?.displayName || user?.email?.split("@")[0] || "?ъ슜??,
          senderAvatar: user?.photoURL || "",
        },
      ]);

      setReplyingTo(null);
      setCurrentEmotion("neutral");

      // VTuber ?쒕쾭濡?利됱떆 ?꾩넚
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const freshGeminiKey = localStorage.getItem("gemini_api_key_global") || "";
        const freshGeminiModel = localStorage.getItem("gemini_model_global") || "gemini-2.0-flash";
        wsRef.current.send(JSON.stringify({
          type: "text-input",
          text: recognized,
          personality: avatarPersonality,
          geminiApiKey: freshGeminiKey,
          geminiModel: freshGeminiModel,
        }));
      }

      // ?꾩넚 ???낅젰李?鍮꾩슦湲?      setMessage("");
    }
    // Firebase 梨꾨꼸: ?낅젰李쎌뿉留?梨꾩썙?먭퀬 ?ъ슜?먭? 吏곸젒 ?꾩넚
  }, [
    voiceDetector.transcription,
    channelType,
    wsConnected,
    user,
    avatarPersonality,
    voiceDetector,
  ]);

  // ?? ?묐떟 ???쒖감 泥섎━ ???????????????????????????????????????????
  const processNextResponse = useCallback(() => {
    if (responseQueueRef.current.length === 0) {
      isPlayingResponseRef.current = false;
      return;
    }

    isPlayingResponseRef.current = true;
    const item = responseQueueRef.current.shift()!;

    // 媛먯젙 ?곸슜
    if (item.emotion && isValidEmotion(item.emotion)) {
      setCurrentEmotion(item.emotion);
    }

    // 梨꾪똿 硫붿떆吏 ?쒖떆 (媛먯젙 ?쒓렇 ?쒓굅??cleanText ?ъ슜)
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        content: item.cleanText || item.originalText,
        sender: "ai",
        timestamp: new Date().toISOString(),
        isBot: true,
        senderName: "AI ?꾨컮?",
        senderAvatar: AvatarSamples[0]?.Avatar || "",
      },
    ]);

    // ?뚯꽦 ?ъ깮
    const speakFn = speakFunctionRef.current;
    if (!speakFn) {
      // speakFunction ?놁쑝硫?諛붾줈 ?ㅼ쓬?쇰줈
      isPlayingResponseRef.current = false;
      if (responseQueueRef.current.length > 0) processNextResponse();
      return;
    }

    if (item.audioUrl) {
      let serverUrl = import.meta.env.VITE_API_URL;
      if (!serverUrl) {
        const isHttps = window.location.protocol === "https:";
        const host = window.location.hostname;
        serverUrl = host === "localhost" || host === "127.0.0.1"
          ? "http://localhost:5001"
          : `${isHttps ? "https" : "http"}://${host}`;
      }
      const fullUrl = item.audioUrl.startsWith("/")
        ? `${serverUrl}${item.audioUrl}`
        : item.audioUrl;
      speakFn(fullUrl, "audio", item.volumes);
    } else if (item.cleanText) {
      speakFn(item.cleanText, "text");
    } else {
      isPlayingResponseRef.current = false;
      if (responseQueueRef.current.length > 0) processNextResponse();
    }
  }, [setCurrentEmotion, setMessages, speakFunctionRef]);

  // ?뚯꽦 ?ъ깮???앸굹硫??먯쓽 ?ㅼ쓬 ??ぉ 泥섎━
  useEffect(() => {
    if (!isAvatarSpeaking && isPlayingResponseRef.current) {
      // ?쎄컙??媛꾧꺽???먯뼱 ?먯뿰?ㅻ읇寃??꾪솚
      const t = setTimeout(() => {
        isPlayingResponseRef.current = false;
        if (responseQueueRef.current.length > 0) {
          processNextResponse();
        }
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isAvatarSpeaking, processNextResponse]);
  // ????????????????????????????????????????????????????????????????

  // 留덉씠???좉? ?⑥닔 - VAD ?뚯꽦 ???(??踰??대┃?쇰줈 怨꾩냽 ?ｊ린)
  const toggleMicrophone = useCallback(async () => {
    if (!voiceDetector.isListening) {
      // 由ъ뒪???쒖옉
      try {
        await voiceDetector.startListening();

        // VTuber 紐⑤뱶?먯꽌 寃쎌껌 ?곹깭濡?蹂寃?        if (channelType === "vtuber") {
          setCurrentEmotion("joy"); // 寃쎌껌?섎뒗 湲곗걶 ?쒖젙
        }
      } catch (error) {
        console.error("?뚯꽦 由ъ뒪???쒖옉 ?ㅽ뙣:", error);
        toast({
          title: "留덉씠???ㅻ쪟",
          description: "留덉씠?щ? ?ъ슜?????놁뒿?덈떎. 沅뚰븳???뺤씤?댁＜?몄슂.",
          variant: "destructive",
        });
      }
    } else {
      // 由ъ뒪??以묒?
      await voiceDetector.stopListening();

      // 湲곕낯 ?쒖젙?쇰줈 蹂寃?      if (channelType === "vtuber") {
        setCurrentEmotion("neutral");
      }
    }
  }, [voiceDetector, channelType, toast]);

  // 硫붿떆吏 ?꾩넚 ?⑥닔 - 梨꾨꼸 ??낆뿉 ?곕씪 遺꾧린
  const handleSendMessage = useCallback(async () => {
    if (channelType === "vtuber") {
      await sendVTuberMessage();
    } else {
      await handleFirebaseSendMessage();
    }
  }, [channelType, sendVTuberMessage]);

  // Firebase 硫붿떆吏 ?꾩넚 ?⑥닔
  const handleFirebaseSendMessage = useCallback(async () => {
    if ((!message.trim() && imageUploads.length === 0) || !user) return;

    const chatRoomId = currentChannel ?? "general";

    const trimmedMessage = message.trim();
    const imageUrls: string[] = [];


    // 硫붿떆吏 ?낅젰李?珥덇린??(利됱떆 UI 諛섏쓳)
    setMessage("");

    // ?대?吏媛 ?덉쑝硫??낅줈??    if (imageUploads.length > 0) {
      setIsUploading(true);
      try {
        // 紐⑤뱺 ?대?吏 ?낅줈???묒뾽 蹂묐젹 泥섎━ - ?섍꼍???곕씪 ?곸젅???쒕쾭濡??꾩넚
        const uploadPromises = imageUploads.map(async (file) => {
          console.log("?뱾 ?대?吏 ?낅줈???쒖옉:", file.name);

          // ?낅줈??URL 寃곗젙 (?섍꼍???곕씪)
          let uploadUrl = import.meta.env.VITE_IMAGE_UPLOAD_URL;
          
          if (!uploadUrl) {
            const isHttps = window.location.protocol === 'https:';
            const currentHost = window.location.hostname;
            
            // ??긽 ?꾩옱 ?쒕쾭??API ?ъ슜 (Cloudinary濡??낅줈??
            uploadUrl = `/api/upload`;
          }
          
          console.log("?뱾 ?낅줈??URL:", uploadUrl);

          // ?대?吏 ?낅줈??          const formData = new FormData();
          formData.append("image", file); // ?쒕쾭媛 'image' ?꾨뱶瑜?湲곕???
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(`?대?吏 ?낅줈???ㅽ뙣: ${uploadResponse.status}`);
          }

          const uploadResult = await uploadResponse.json();
          // ?쒕쾭 ?묐떟 ?뺤떇??留욊쾶 泥섎━ (url ?먮뒗 imageUrl)
          const imageUrl = uploadResult.url || uploadResult.imageUrl;
          
          if (uploadResult.success && imageUrl) {
            console.log("???대?吏 ?낅줈???깃났:", imageUrl);
            return imageUrl;
          } else {
            throw new Error("?대?吏 ?낅줈???묐떟???щ컮瑜댁? ?딆뒿?덈떎");
          }
        });

        // 紐⑤뱺 ?낅줈?쒓? ?꾨즺???뚭퉴吏 湲곕떎由?        imageUrls.push(...(await Promise.all(uploadPromises)));
      } catch (error) {
        console.error("?대?吏 ?낅줈??以??ㅻ쪟:", error);
        alert("?쇰? ?대?吏 ?낅줈?쒖뿉 ?ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.");
        setIsUploading(false);
        return; // ?대?吏 ?낅줈???ㅽ뙣 ??硫붿떆吏 ?꾩넚 以묐떒
      } finally {
        setIsUploading(false);
        setImageUploads([]); // ?낅줈???꾨즺 ???대?吏 紐⑸줉 珥덇린??      }
    }

    try {
      console.log(
        "硫붿떆吏 ?꾩넚 ?쒕룄:",
        trimmedMessage,
        "?대?吏:",
        imageUrls.length > 0 ? `${imageUrls.length}媛? : "?놁쓬",
      );


      // ?대?吏? ?띿뒪?몃? ?섎굹??硫붿떆吏濡??꾩넚 (?대?吏瑜?洹몃９??
      // ?쇰컲 ?뚯썝 媛???ъ슜?먮? ?꾪빐 displayName怨?photoURL ?꾨떖
      const result = await sendChatMessage(
        chatRoomId,
        trimmedMessage,
        user.uid,
        imageUrls.join(","),
        replyingTo?.id.toString(),
        user.displayName || user.email?.split("@")[0] || "?ъ슜??,
        user.photoURL || undefined,
      );

      // ?듦? ?곹깭 珥덇린??      setReplyingTo(null);

      if (!result.success) {
        console.error("硫붿떆吏 ?꾩넚 ?ㅽ뙣:", result.error);
        alert("硫붿떆吏 ?꾩넚???ㅽ뙣?덉뒿?덈떎.");
      }
    } catch (error) {
      console.error("硫붿떆吏 ?꾩넚 以??ㅻ쪟:", error);
      alert("硫붿떆吏 ?꾩넚 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
    }
  }, [message, imageUploads, currentChannel, user]);

  // Enter ??泥섎━
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ?꾪솕 踰꾪듉 ?대┃ ?몃뱾??  const handlePhoneClick = () => {
    setShowPhoneModal(true);
  };

  // 硫붿떆吏 ?쒖떆 遺遺??섏젙 - ?щ윭 ?대?吏瑜?洹몃９?쇰줈 ?쒖떆
  const renderMessage = (msg: Message) => {
    // ?쇳몴濡?援щ텇???대?吏 URL??諛곗뿴濡?蹂??    const imageUrls = msg.imageUrl ? msg.imageUrl.split(",") : [];

    // URL??HTML 留곹겕濡?蹂??    const htmlContent = convertLinksToHtml(msg.content);

    // ?듦? ???硫붿떆吏 李얘린
    const replyToMessage = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;

    // ?ъ슜?먭? 硫붿떆吏瑜???젣?????덈뒗吏 ?뺤씤
    const canDelete = user && (msg.sender === "user" || user.uid === msg.raw?.senderId);

    // ??젣??硫붿떆吏???뚮뜑留곹븯吏 ?딆쓬
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
                {msg.senderName || (msg.sender === "user" ? "?? : "?ъ슜??)}
              </span>
              {msg.isBot && (
                <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                  BOT
                </span>
              )}
              {msg.replyTo && (
                <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                  ?듦?
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">{msg.timestamp}</span>
              
              {/* ?쒖쨪 ?듦? ?쒖떆 */}
              {msg.replyTo && (
                <span className="text-xs text-purple-600 dark:text-purple-300 flex items-center space-x-1 bg-gray-200 dark:bg-[#1A1A1B] px-2 py-1 rounded">
                  <i className="fas fa-reply text-xs"></i>
                  <span className="text-gray-600 dark:text-gray-400">
                    {replyToMessage && !replyToMessage.isDeleted 
                      ? `"${replyToMessage.content.substring(0, 20)}${replyToMessage.content.length > 20 ? '...' : ''}"`
                      : "??젣??硫붿떆吏"}
                  </span>
                  <span className="text-purple-400">??/span>
                </span>
              )}
            </div>
            
            {/* ?대?吏 ?쒖떆 */}
            {imageUrls.length > 0 && (
              <div className="mt-2">
                {imageUrls.length === 1 ? (
                  <div 
                    className="relative rounded-lg overflow-hidden max-w-sm cursor-pointer group bg-gray-200 dark:bg-gray-600 border-2 border-red-500"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('?뼹截?而⑦뀒?대꼫 ?대┃! URL:', imageUrls[0]);
                      console.log('?뼹截??대┃ ??selectedImage:', selectedImage);
                      
                      // 媛뺤젣 ?곹깭 蹂?붾? ?꾪빐 癒쇱? null濡?珥덇린??                      setSelectedImage(null);
                      setTimeout(() => {
                        setSelectedImage(imageUrls[0]);
                        console.log('?뼹截?吏?곕맂 setSelectedImage ?꾨즺:', imageUrls[0]);
                      }, 10);
                    }}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <img
                      src={getAbsoluteImageUrl(imageUrls[0])}
                      alt="泥⑤? ?대?吏"
                      className="w-full h-auto max-h-64 object-cover hover:opacity-90 transition-opacity"
                      style={{ pointerEvents: 'none' }}
                      onLoad={() => console.log('?뼹截??대?吏 濡쒕뱶 ?꾨즺:', imageUrls[0])}
                      onError={() => console.log('???대?吏 濡쒕뱶 ?ㅽ뙣:', imageUrls[0])}
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
                          console.log('?뼹截??ㅼ쨷 ?대?吏 而⑦뀒?대꼫 ?대┃! URL:', url);
                          
                          // 媛뺤젣 ?곹깭 蹂?붾? ?꾪빐 癒쇱? null濡?珥덇린??                          setSelectedImage(null);
                          setTimeout(() => {
                            setSelectedImage(url);
                          }, 10);
                        }}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <img
                          src={getAbsoluteImageUrl(url)}
                          alt={`泥⑤? ?대?吏 ${index + 1}`}
                          className="w-full h-32 object-cover"
                          style={{ pointerEvents: 'none' }}
                          onLoad={() => console.log('?뼹截??ㅼ쨷 ?대?吏 濡쒕뱶 ?꾨즺:', url)}
                          onError={() => console.log('???ㅼ쨷 ?대?吏 濡쒕뱶 ?ㅽ뙣:', url)}
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
            
            {/* 硫붿떆吏 ?댁슜 */}
            {msg.content && (
              <div
                className="text-gray-700 dark:text-gray-100 mt-1 break-words"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            )}

            {/* 諛섏쓳 ?쒖떆 */}
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

          {/* 硫붿떆吏 ?≪뀡 踰꾪듉??*/}
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

          {/* 諛섏쓳 ?좏깮湲?*/}
          {showReactionPicker === msg.id.toString() && (
            <div className="reaction-picker absolute top-0 right-0 mt-8 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-2 z-50">
              <div className="flex gap-1">
                {["?몟", "?ㅿ툘", "?쁻", "?삷", "?삟", "?삞", "?몡", "?뵦"].map((emoji) => (
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

  // ?꾨컮?-梨꾪똿 梨꾨꼸 ?ㅻ챸 ?뱀뀡 異붽?
  const renderAvatarChatHeader = () => {
    if (currentChannel === "Avatar-chat" || channelType === "vtuber") {
      return (
        <div className="relative bg-gray-100 dark:bg-[#0B0B0B] border-b border-gray-200 dark:border-purple-500/30 overflow-hidden transition-colors" style={{ zIndex: 0 }}>
          {/* 諛곌꼍 ?μ떇 ?붿냼??- 蹂대씪???묓겕 ??(?ㅽ겕 紐⑤뱶 only) */}
          <div className="absolute top-4 left-8 w-20 h-20 bg-purple-500/10 dark:bg-purple-500/30 rounded-full blur-xl"></div>
          <div className="absolute bottom-6 right-16 w-24 h-24 bg-pink-500/10 dark:bg-pink-500/30 rounded-full blur-xl"></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-violet-500/10 dark:bg-violet-500/30 rounded-full blur-lg"></div>

          {/* VTuber 罹먮┃??- ?ㅻⅨ履?諛곗튂 */}
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

          {/* 異붽? ?묒? 罹먮┃??- ?쇱そ ?섎떒 */}
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

          {/* 而⑦뀗痢??곸뿭 */}
          <div className="relative z-0 px-6 py-8 max-w-2xl">
            <div className="bg-white/80 dark:bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-purple-300/20">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mr-4">
                  <i className="fas fa-magic text-white text-lg"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    AI ?꾨컮?? ?ㅼ떆媛???뷀븯?몄슂!
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant="default"
                      className="bg-purple-200 dark:bg-purple-500/30 text-purple-700 dark:text-purple-200 border-purple-300 dark:border-purple-400/40"
                    >
                      <i className="fas fa-robot mr-1"></i>
                      AI ???                    </Badge>
                    <Badge
                      variant="default"
                      className="bg-pink-200 dark:bg-pink-500/30 text-pink-700 dark:text-pink-200 border-pink-300 dark:border-pink-400/40"
                    >
                      <i className="fas fa-bolt mr-1"></i>
                      ?ㅼ떆媛?                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-gray-700 dark:text-gray-100">
                <p className="text-lg leading-relaxed">
                  <i className="fas fa-wand-magic-sparkles text-pink-500 dark:text-pink-400 mr-2"></i>
                  理쒖꺼??AI 湲곗닠濡?援ы쁽???앹깮?????寃쏀뿕??留뚮굹蹂댁꽭??
                </p>
                <p className="text-sm leading-relaxed opacity-90">
                  ?ㅼ떆媛꾩쑝濡?諛섏쓳?섎뒗 AI ?꾨컮?? ?먯뿰?ㅻ윭????붾? ?섎늻?몄슂.
                  媛먯젙 ?쒗쁽, 媛쒖꽦 ?덈뒗 ?묐떟, 洹몃━怨???쇱슫 ????λ젰??                  泥댄뿕?대낫?몄슂.
                </p>
                <div className="flex items-center space-x-4 pt-2">
                  <div className="flex items-center text-sm text-green-600 dark:text-green-300">
                    <i className="fas fa-circle text-green-500 dark:text-green-400 mr-2 text-xs animate-pulse"></i>
                    ?ㅼ떆媛??묐떟
                  </div>
                  <div className="flex items-center text-sm text-purple-600 dark:text-purple-300">
                    <i className="fas fa-brain mr-2"></i>
                    怨좉툒 AI
                  </div>
                  <div className="flex items-center text-sm text-pink-600 dark:text-pink-300">
                    <i className="fas fa-heart mr-2"></i>
                    媛먯젙 ?쒗쁽
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

  // 濡쒕뵫 以?  if (isLoading) {
    return (
      <div className="flex-1 bg-white dark:bg-[#030303] flex items-center justify-center transition-colors" style={{ height: 'calc(100vh - 40px)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-purple-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">梨꾪똿諛⑹쓣 濡쒕뱶?섎뒗 以?..</p>
        </div>
      </div>
    );
  }

  // 媛쒕퀎 梨꾪똿諛?(DM)
  if (chatPartner) {
    return (
      <div className="flex-1 bg-white dark:bg-[#030303] flex flex-col overflow-hidden transition-colors" style={{ height: 'calc(100vh - 40px)' }}>
        {/* 梨꾨꼸 ?ㅻ뜑 */}
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
            AI ?꾨컮????媛쒖씤 ???          </div>
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

        {/* 硫붿떆吏 ?곸뿭 */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full px-2 sm:px-4 py-1">
            <div className="space-y-4">
              {/* 梨꾪똿 ?쒖옉 硫붿떆吏 */}
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
                    {chatPartner?.name}??????                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    AI ?꾨컮?? ?④퍡 ??붾? ?쒖옉?대낫?몄슂.
                  </p>
                </div>
              )}

              {/* 硫붿떆吏 紐⑸줉 */}
              {messages.map((msg) => renderMessage(msg))}
            </div>
          </ScrollArea>
        </div>

        {/* 硫붿떆吏 ?낅젰 ?곸뿭 */}
        <div
          className={`flex-shrink-0 px-2 sm:px-4 py-3 bg-gray-100 dark:bg-[#0B0B0B] border-t border-gray-200 dark:border-[#1A1A1B] relative transition-colors ${
            isMobile ? "z-30" : ""
          }`}
        >
          {/* ?대?吏 誘몃━蹂닿린 */}
          {imageUploads.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {imageUploads.map((file, index) => (
                <div
                  key={index}
                  className="relative border border-gray-300 dark:border-[#272729] rounded-md overflow-hidden p-1 bg-gray-200 dark:bg-[#1A1A1B]"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`?낅줈???대?吏 ${index + 1}`}
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

          {/* ?듦? ?쒖떆 */}
          {replyingTo && (
            <div className="absolute bottom-full left-0 right-0 mb-0 mx-4 p-3 bg-gray-200 dark:bg-[#1A1A1B] rounded-t-lg border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm">
                  <i className="fas fa-reply text-purple-400"></i>
                  <span className="text-gray-600 dark:text-gray-300">?듦?:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{replyingTo.senderName || "?ъ슜??}</span>
                  <span className="text-gray-500 dark:text-gray-400 truncate max-w-xs">
                    {replyingTo.isDeleted ? "??젣??硫붿떆吏" : replyingTo.content}
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
                      ? `${replyingTo.senderName || "?ъ슜??}?먭쾶 ?듦????낅젰?섏꽭??..`
                      : isUploading
                        ? "?대?吏 ?낅줈??以?.."
                        : "硫붿떆吏瑜??낅젰?섏꽭??.."
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
                {/* ?뚯꽦 ???留덉씠??踰꾪듉 - VAD */}
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
                      ? "?렎 ?뱀쓬 以?.. 留먯쓣 硫덉텛硫??먮룞?쇰줈 AI媛 ?묐떟?⑸땲??
                      : voiceDetector.isProcessing
                        ? "?쨺 AI媛 ?듬???以鍮꾪븯怨??덉뒿?덈떎..."
                        : voiceDetector.isListening
                          ? "?렒 ?뚯꽦 媛먯? 以?.. ?대┃?섎㈃ 以묒??⑸땲??
                          : channelType === "vtuber"
                            ? "?뿣截??대┃?섏뿬 AI? ?뚯꽦 ??뷀븯湲?
                            : "?렎 ?뚯꽦 ?낅젰"
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
                  title="?좊Ъ 蹂대궡湲?
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
                  title="?대え?곗퐯"
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
                ? "AI ?꾨컮? ?쒕쾭???곌껐 以?.."
                : "?곌껐???딄꼈?듬땲?? ?ъ뿰寃곗쓣 ?쒕룄?섎뒗 以?.."}
            </p>
          )}

          {/* ?좊Ъ ?앹뾽 */}
          {showGiftPopup && (
            <div className="gift-popup absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-3 z-50">
              <div className="flex items-center mb-2">
                <i className="fas fa-gift text-pink-400 mr-2"></i>
                <h3 className="text-gray-900 dark:text-white font-semibold text-sm">?좊Ъ 蹂대궡湲?/h3>
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

          {/* ?대え?곗퐯 ?앹뾽 */}
          {showEmojiPopup && (
            <div className="emoji-popup absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-3 z-50">
              <div className="flex items-center mb-2">
                <i className="fas fa-smile text-yellow-400 mr-2"></i>
                <h3 className="text-gray-900 dark:text-white font-semibold text-sm">?대え?곗퐯</h3>
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

        {/* ?꾪솕踰덊샇 ?쒖떆 紐⑤떖 */}
        <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-[#0B0B0B] text-gray-900 dark:text-white border-gray-200 dark:border-[#1A1A1B]">
            <DialogHeader>
              <DialogTitle>?듯솕 ?곌껐</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                ?꾨옒 ?꾪솕踰덊샇濡??곌껐?????덉뒿?덈떎.
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
                  痍⑥냼
                </Button>
                <Button
                  className="w-24 bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    window.location.href = `tel:${phoneNumber.replace(/-/g, "")}`;
                  }}
                >
                  ?꾪솕 嫄멸린
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // general 梨꾨꼸?닿퀬 Firebase ??낆씪 ?뚮뒗 Reddit ?ㅽ????쇰뱶 ?쒖떆
  if (currentChannel === "general" && channelType === "firebase") {
    // ?쇰뱶 ?ъ뒪???곸꽭 ?섏씠吏 ?뺤씤
    const feedPostMatch = location.match(/^\/feed\/(\d+)$/);
    if (feedPostMatch) {
      const postId = parseInt(feedPostMatch[1]);
      return <FeedPostDetail postId={postId} />;
    }
    
    // ?쇰뱶 紐⑸줉 ?쒖떆
    return <FeedView sortBy={feedSortBy} />;
  }

  // 濡쒓렇?명븯吏 ?딆? ?ъ슜?먮룄 ?쇰컲 梨꾨꼸? 蹂????덉쓬
  return (
    <div className="flex-1 bg-white dark:bg-[#030303] flex flex-col overflow-hidden transition-colors" style={{ height: 'calc(100vh - 40px)' }}>
      {/* 梨꾨꼸 ?ㅻ뜑 */}
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
                return `${modelName}? 梨꾪똿`;
              }
              return channelType === "vtuber" ? "?꾨컮?? 梨꾪똿" : "?쇰컲";
            })()}
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {channelType === "vtuber"
              ? "_AI ?꾨컮?? ?ㅼ떆媛?
              : "_AI ?꾨컮??ㅺ낵 ?먯쑀濡?쾶"}
          </div>
          <div className="flex items-center space-x-2">
            {/* 媛쒖꽦 ?꾩씠肄?踰꾪듉 - VTuber 梨꾨꼸?먯꽌留??쒖떆 */}
            {channelType === "vtuber" && (
              <Button
                onClick={() => setShowPersonalityDialog(true)}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all duration-200"
                title={avatarPersonality ? `媛쒖꽦: ${avatarPersonality}` : "?꾨컮? 媛쒖꽦 ?ㅼ젙"}
              >
                <i className={`fas fa-brain text-lg ${avatarPersonality ? 'text-purple-500 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}></i>
              </Button>
            )}

            {/* 梨꾨꼸 李몄뿬???꾨줈???ъ쭊 */}
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
                      title={`+${channelMembers.length - 5}紐???}
                    >
                      +{channelMembers.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                  {channelMembers.length}紐?                </span>
              </div>
            )}

            {/* ?곌껐 ?곹깭 */}
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
                ? "?곌껐??
                : "?곌껐 ?딄?"}
            </Badge>
          </div>
        </div>
      </div>

      {!user ? (
        // 濡쒓렇???덈궡
        <div
          className="flex-1 flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 200px)" }}
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-300 dark:bg-gray-500 rounded-full flex items-center justify-center mb-6 mx-auto">
              <i className="fas fa-user-lock text-3xl text-gray-600 dark:text-gray-300"></i>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              濡쒓렇?몄씠 ?꾩슂?⑸땲??            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md">
              AI ?꾨컮??ㅺ낵 梨꾪똿?섎젮硫?癒쇱? 濡쒓렇?명빐二쇱꽭??
            </p>
            <Button
              onClick={() => setShowAuthModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2"
            >
              濡쒓렇?명븯湲?            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Live2D ?꾨컮? ?곸뿭 - VTuber 梨꾨꼸?먯꽌留??쒖떆 */}
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
                    key="live2d-avatar" // 怨좎젙 key濡?而댄룷?뚰듃 ?щ쭏?댄듃 諛⑹?
                    modelName={selectedModel}
                    width={450}
                    height={700}
                    emotion={currentEmotion}
                    onLoaded={(model: Live2DModel) => {
                      setLive2dInstance(model);
                      console.log(`??紐⑤뜽 濡쒕뱶 ?꾨즺: ${selectedModel}`);
                    }}
                    onError={(error: Error) => {
                      console.error("PIXI.js + WebGL 濡쒕뱶 ?ㅻ쪟:", error);
                    }}
                    onSpeakReady={(speakFn) => {
                      console.log("?렎 MainContent?먯꽌 TTS ?⑥닔 諛쏆쓬:", {
                        speakFnExists: !!speakFn,
                        speakFnType: typeof speakFn,
                        speakFnName: speakFn?.name || "no name",
                      });

                      // React ?⑥닔 state ??????щ컮瑜?諛⑸쾿
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
                          console.log("?렎 speakFunction ?낅뜲?댄듃:", {
                            prevExists: !!prev,
                            newExists: !!speakFn,
                            newType: typeof speakFn,
                          });
                          return speakFn;
                        },
                      );

                      console.log("?렎 setSpeakFunction ?몄텧 ?꾨즺");
                    }}
                    onSpeakingChange={(speaking) => {
                      setIsAvatarSpeaking(speaking);
                      console.log(`?렎 ?꾨컮? 留먰븯湲??곹깭 蹂寃? ${speaking ? '留먰븯??以? : '?湲?以?}`);
                    }}
                    className="mx-auto"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 硫붿떆吏 ?곸뿭 - 怨좎젙 ?믪씠濡??ㅽ겕濡?媛??*/}
          <div className="flex-1 overflow-hidden">
            <ScrollArea ref={scrollAreaRef} className="h-full px-2 sm:px-4">
              <div className="space-y-3">
                {/* 梨꾨꼸蹂??뚭컻 ?곸뿭 - ?ㅽ겕濡?媛?ν븳 ?곸뿭 ?대? */}
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
                        Live2D ?꾨컮?? ??뷀빐蹂댁꽭?? ?꾨컮?瑜??대┃?섎㈃
                        諛섏쓳?⑸땲??
                      </span>
                    </div>

                    {/* ?곌껐 ?곹깭 ?덈궡 */}
                    <div className="text-center">
                      {wsConnected ? (
                        <div className="inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-600/20 rounded-full border border-green-300 dark:border-green-500/30">
                          <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2 animate-pulse"></div>
                          <span className="text-green-700 dark:text-green-200 text-xs">
                            AI ?쒕쾭 ?곌껐??- ???媛??
                          </span>
                        </div>
                      ) : vtuberConnecting ? (
                        <div className="inline-flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-600/20 rounded-full border border-yellow-300 dark:border-yellow-500/30">
                          <div className="w-2 h-2 bg-yellow-500 dark:bg-yellow-400 rounded-full mr-2 animate-bounce"></div>
                          <span className="text-yellow-700 dark:text-yellow-200 text-xs">
                            AI ?쒕쾭 ?곌껐 以?..
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-600/20 rounded-full border border-blue-300 dark:border-blue-500/30">
                          <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-2"></div>
                          <span className="text-blue-700 dark:text-blue-200 text-xs">
                            Live2D ?꾨컮? ?쒖떆 以?- ?대┃?댁꽌 媛먯젙 蹂??泥댄뿕!
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
                          ??붾? ?쒖옉?대낫?몄슂! ?꾨옒??硫붿떆吏瑜??낅젰?섏꽭??
                        </span>
                      </div>
                    )}
                    {currentChannel === "random" && (
                      <div className="inline-flex items-center px-4 py-2 bg-orange-100 dark:bg-orange-600/20 rounded-full border border-orange-300 dark:border-orange-500/30">
                        <i className="fas fa-laugh text-orange-600 dark:text-orange-400 mr-2"></i>
                        <span className="text-gray-700 dark:text-gray-200 text-sm">
                          ?명븯寃??댁빞湲고빐蹂댁꽭?? 臾댁뾿?대뱺 醫뗭븘??
                        </span>
                      </div>
                    )}
                    {currentChannel === "help" && (
                      <div className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-600/20 rounded-full border border-blue-300 dark:border-blue-500/30">
                        <i className="fas fa-question-circle text-blue-600 dark:text-blue-400 mr-2"></i>
                        <span className="text-gray-700 dark:text-gray-200 text-sm">
                          沅곴툑??寃껋씠 ?덉쑝?쒕㈃ ?몄젣??吏덈Ц?댁＜?몄슂!
                        </span>
                      </div>
                    )}
                    {currentChannel === "Avatar-chat" && (
                      <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-600/30 rounded-full border border-purple-300 dark:border-purple-400/40">
                        <i className="fas fa-robot text-purple-600 dark:text-purple-400 mr-2"></i>
                        <span className="text-gray-700 dark:text-gray-200 text-sm">
                          AI ?꾨컮?? ?ㅼ떆媛꾩쑝濡???뷀빐蹂댁꽭??
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ?꾨컮? 梨꾪똿???쒖옉 硫붿떆吏 */}
                {messages.length === 0 && channelType === "vtuber" && (
                  <div className="mb-6 text-center">
                    <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-600/30 rounded-full border border-purple-300 dark:border-purple-400/40">
                      <i className="fas fa-magic text-purple-600 dark:text-purple-400 mr-2"></i>
                      <span className="text-gray-700 dark:text-gray-100 text-sm">
                        AI ?꾨컮?媛 ?묐떟??湲곕떎由ш퀬 ?덉뼱?? ??붾? ?쒖옉?대낫?몄슂.
                      </span>
                    </div>
                  </div>
                )}

                {/* 硫붿떆吏 紐⑸줉 */}
                {messages.map((msg) => renderMessage(msg))}
              </div>
            </ScrollArea>
          </div>

          {/* 硫붿떆吏 ?낅젰 ?곸뿭 - ?섎떒 怨좎젙 */}
          <div
            className={`flex-shrink-0 px-2 sm:px-4 py-3 bg-gray-100 dark:bg-[#0B0B0B] border-t border-gray-200 dark:border-[#1A1A1B] relative transition-colors ${
              isMobile ? "z-30" : ""
            }`}
          >
            {/* ?대?吏 誘몃━蹂닿린 */}
            {imageUploads.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {imageUploads.map((file, index) => (
                  <div
                    key={index}
                    className="relative border border-gray-300 dark:border-[#272729] rounded-md overflow-hidden p-1 bg-gray-200 dark:bg-[#1A1A1B]"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`?낅줈???대?吏 ${index + 1}`}
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
                        ? `${replyingTo.senderName || "?ъ슜??}?먭쾶 ?듦????낅젰?섏꽭??..`
                        : channelType === "vtuber"
                          ? "AI ?꾨컮??먭쾶 硫붿떆吏瑜?蹂대궡?몄슂..."
                          : isUploading
                            ? "?대?吏 ?낅줈??以?.."
                            : "硫붿떆吏瑜??낅젰?섏꽭??.."
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
                  {/* ?뚯꽦 ???留덉씠??踰꾪듉 - VAD */}
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
                        ? "?렎 ?뱀쓬 以?.. 留먯쓣 硫덉텛硫??먮룞?쇰줈 AI媛 ?묐떟?⑸땲??
                        : voiceDetector.isProcessing
                          ? "?쨺 AI媛 ?듬???以鍮꾪븯怨??덉뒿?덈떎..."
                          : voiceDetector.isListening
                            ? "?렒 ?뚯꽦 媛먯? 以?.. ?대┃?섎㈃ 以묒??⑸땲??
                            : "?렎 ?뚯꽦 ?낅젰"
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
                    title="?좊Ъ 蹂대궡湲?
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
                    title="?대え?곗퐯"
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
                ?곌껐???딄꼈?듬땲?? ?ъ뿰寃곗쓣 ?쒕룄?섎뒗 以?..
              </p>
            )}

            {/* VTuber 梨꾪똿 ?듦? ?쒖떆 */}
            {replyingTo && (
              <div className="absolute bottom-full left-0 right-0 mb-0 mx-4 p-3 bg-gray-100 dark:bg-[#1A1A1B] rounded-t-lg border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm">
                    <i className="fas fa-reply text-purple-400"></i>
                    <span className="text-gray-600 dark:text-gray-300">?듦?:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{replyingTo.senderName || "?ъ슜??}</span>
                    <span className="text-gray-400 truncate max-w-xs">
                      {replyingTo.isDeleted ? "??젣??硫붿떆吏" : replyingTo.content}
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

            {/* ?좊Ъ ?앹뾽 */}
            {showGiftPopup && (
              <div className="gift-popup absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-3 z-50">
                <div className="flex items-center mb-2">
                  <i className="fas fa-gift text-pink-400 mr-2"></i>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-sm">?좊Ъ 蹂대궡湲?/h3>
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

            {/* ?대え?곗퐯 ?앹뾽 */}
            {showEmojiPopup && (
              <div className="emoji-popup absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-[#1A1A1B] rounded-lg shadow-2xl border border-gray-200 dark:border-[#272729] p-3 z-50">
                <div className="flex items-center mb-2">
                  <i className="fas fa-smile text-yellow-400 mr-2"></i>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-sm">?대え?곗퐯</h3>
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

      {/* ?대?吏 ?뺣? 紐⑤떖 */}
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
                alt="?뺣????대?吏"
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
                  title="????뿉???닿린"
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
                  title="?ㅼ슫濡쒕뱶"
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 媛쒖꽦 ?ㅼ젙 ?ㅼ씠?쇰줈洹?*/}
      <Dialog open={showPersonalityDialog} onOpenChange={setShowPersonalityDialog}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-900 border-2 border-purple-500/30">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent flex items-center gap-2">
              <i className="fas fa-brain text-purple-500"></i>
              ?꾨컮? 媛쒖꽦 ?ㅼ젙
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              {selectedModel ? `${selectedModel} ?꾨컮?` : '?꾩옱 ?꾨컮?'}??怨좎쑀??媛쒖꽦???ㅼ젙?섏꽭??
              ?ㅼ젙??媛쒖꽦? ??붿? ?뚯꽦 ?앹꽦??諛섏쁺?⑸땲??
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <i className="fas fa-edit text-purple-500"></i>
                罹먮┃??媛쒖꽦 ?낅젰
              </label>
              <textarea
                value={personalityInput}
                onChange={(e) => setPersonalityInput(e.target.value)}
                placeholder="?? 諛앷퀬 湲띿젙?곸씤 ?깃꺽?쇰줈 移쒓렐?섍쾶 ??뷀븯硫? 媛???λ궃?ㅻ윭??留먰닾瑜??ъ슜?⑸땲?? ?곷?諛⑹쓽 ?댁빞湲곕? ???ㅼ뼱二쇨퀬 怨듦컧?섎뒗 ?몄씠?먯슂."
                className="w-full min-h-[150px] p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <i className="fas fa-info-circle"></i>
                ?깃꺽, 留먰닾, ?뱀쭠 ?깆쓣 ?먯쑀濡?쾶 ?낅젰?섏꽭??
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                <i className="fas fa-lightbulb"></i>
                媛쒖꽦 ?ㅼ젙 ?덉떆
              </h4>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <li>??<span className="font-medium">湲띿젙?곸씠怨??쒕컻???깃꺽:</span> "??긽 諛앷퀬 湲띿젙?곸씠硫? ?먮꼫吏媛 ?섏튂???깃꺽"</li>
                <li>??<span className="font-medium">李⑤텇?섍퀬 吏?곸씤 ?깃꺽:</span> "議곗슜?섍퀬 ?щ젮 源딆쑝硫? ?쇰━?곸쑝濡??ㅻ챸?섎뒗 ??</li>
                <li>??<span className="font-medium">移쒓렐?섍퀬 怨듦컧?섎뒗 ?깃꺽:</span> "?곕쑜?섍쾶 怨듦컧?섍퀬 移쒓뎄泥섎읆 ??섎뒗 ?깃꺽"</li>
              </ul>
            </div>

            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <i className="fas fa-key text-blue-500"></i>
                Google Gemini API ??(?좏깮?ы빆)
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs font-normal text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 underline"
                >
                  <i className="fas fa-external-link-alt text-[10px]"></i>
                  API ??諛쒓툒諛쏄린
                </a>
              </label>
              <input
                type="password"
                value={geminiApiKeyInput}
                onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                placeholder="AIza..."
                className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <i className="fas fa-info-circle"></i>
                ?낅젰 ???쒕??섏씠 紐⑤뜽濡???뷀빀?덈떎. (釉뚮씪?곗? 濡쒖뺄?먮쭔 ??λ맖)
              </p>
            </div>

            {/* ?쒕??섏씠 紐⑤뜽 ?좏깮 */}
            {geminiApiKeyInput && (
              <div className="space-y-2 mt-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <i className="fas fa-robot text-indigo-500"></i>
                  Gemini 紐⑤뜽 ?좏깮
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GEMINI_MODELS.map((m) => {
                    const badgeColors: Record<string, string> = {
                      "?덉젙": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      "異붿쿇": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                      "?ㅽ뿕": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                      "理쒖떊": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                    };
                    const isSelected = geminiModelInput === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setGeminiModelInput(m.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                        }`}
                      >
                        <span className={`text-xs font-medium ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300"}`}>
                          {m.label}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badgeColors[m.badge]}`}>
                          {m.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ?꾩옱 ?좏깮: <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{geminiModelInput}</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={() => setShowPersonalityDialog(false)}
              variant="outline"
              className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              痍⑥냼
            </Button>
            <Button
              onClick={handleSavePersonality}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-save mr-2"></i>
              ??ν븯湲?            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MainContent;