// VTuber 서버 관련 타입 정의

export interface VTuberMessage {
  type: string;
  text?: string;
  content?: string;
  client_id?: string;
  data?: any;
  timestamp?: number;
  audioUrl?: string;
  volumes?: number[];
}

export interface WebSocketMessage {
  type: 'request-init-config' | 'text-input' | 'ai-speak-signal' | 'heartbeat' | 'interrupt-signal' | 'fetch-configs' | 'switch-config';
  text?: string;
  content?: string;
  client_id?: string;
  data?: any;
  model?: string;
  emotion?: string;
  audioUrl?: string;
  volumes?: number[];
  personality?: string;
}

export interface ClientConnection {
  id: string;
  ws: any; // WebSocket connection
  isAlive: boolean;
  lastHeartbeat: number;
  currentModel: string;
  currentEmotion: string;
  conversationHistory: ConversationMessage[];
  personality?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  emotion?: string;
  model?: string;
}

export interface Live2DModelConfig {
  name: string;
  description: string;
  url: string;
  kScale: number;
  initialXshift: number;
  initialYshift: number;
  kXOffset: number;
  idleMotionGroupName: string;
  emotionMap: {
    [emotion: string]: number;
  };
  tapMotions: {
    [area: string]: {
      [motion: string]: number;
    };
  };
}

export interface VTuberConfig {
  system_prompt: string;
  character_name: string;
  character_description: string;
  personality: string;
  live2d_model: string;
  openai_api_key?: string;
  model: string;
  max_tokens: number;
  temperature: number;
  emotion_keywords: {
    [keyword: string]: string;
  };
}

export interface AIResponse {
  text: string;
  emotion: string;
  confidence: number;
  metadata?: any;
}

export interface EmotionAnalysis {
  emotion: string;
  confidence: number;
  keywords: string[];
}
