import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Server as HTTPServer } from 'http';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import {
  VTuberMessage,
  WebSocketMessage,
  ClientConnection,
  ConversationMessage,
  Live2DModelConfig,
  VTuberConfig,
  AIResponse,
  EmotionAnalysis
} from './types/vtuber.js';

export class VTuberServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private openai: OpenAI | null = null;
  private config: VTuberConfig;
  private modelConfigs: Live2DModelConfig[] = [];
  
  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      noServer: true
    });
    
    // 수동으로 upgrade 이벤트 처리 (/client-ws 경로만)
    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
      
      if (pathname === '/client-ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
      // Socket.io 경로는 건드리지 않음
    });
    
    this.config = this.getDefaultConfig();
    this.setupOpenAI();
    this.setupWebSocketHandlers();
    this.loadModelConfigs();
    this.startHeartbeat();
    
    console.log('🤖 VTuber WebSocket 서버가 /client-ws 경로에서 준비되었습니다.');
  }

  private getDefaultConfig(): VTuberConfig {
    return {
      system_prompt: `당신은 친근하고 활발한 AI 아바타입니다. 
다음과 같은 성격을 가지고 있습니다:
- 밝고 긍정적인 성격
- 사용자와 친근하게 대화
- 감정 표현이 풍부함
- 궁금한 것이 많고 호기심이 강함

응답할 때 다음 감정 태그 중 하나를 포함해주세요:
[neutral], [joy], [anger], [sadness], [surprise], [fear]

짧고 간결하게 대답해주세요. 2-3문장 이내로 답변하세요.

예시: "[joy] 안녕하세요! 오늘 기분이 정말 좋아요!"`,
      character_name: "AI 아바타",
      character_description: "친근하고 활발한 AI 아바타 캐릭터",
      personality: "밝고 긍정적이며 호기심이 많음",
      live2d_model: "",
      model: "gpt-4o-mini",
      max_tokens: 150,  // 빠른 응답을 위해 줄임
      temperature: 0.7,
      emotion_keywords: {
        "기쁨": "joy",
        "행복": "joy",
        "좋아": "joy",
        "웃음": "joy",
        "화남": "anger",
        "화가": "anger",
        "짜증": "anger",
        "슬픔": "sadness",
        "슬퍼": "sadness",
        "우울": "sadness",
        "놀람": "surprise",
        "깜짝": "surprise",
        "와": "surprise",
        "무서": "fear",
        "걱정": "fear",
        "평범": "neutral",
        "그냥": "neutral"
      }
    };
  }

  private async setupOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    console.log('🔍 OpenAI API 키 확인:', {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `있음 (${process.env.OPENAI_API_KEY.substring(0, 20)}...)` : '없음',
      VITE_OPENAI_API_KEY: process.env.VITE_OPENAI_API_KEY ? `있음 (${process.env.VITE_OPENAI_API_KEY.substring(0, 20)}...)` : '없음',
      선택된키: apiKey ? `${apiKey.substring(0, 20)}...` : '없음'
    });
    
    if (apiKey && apiKey.length > 20) {
      try {
        this.openai = new OpenAI({
          apiKey: apiKey
        });
        console.log('✅ OpenAI API 설정 완료');
      } catch (error) {
        console.error('❌ OpenAI API 초기화 오류:', error);
      }
    } else {
      console.warn('⚠️ OpenAI API 키가 설정되지 않았거나 유효하지 않습니다.');
      console.warn('💡 .env 파일에 OPENAI_API_KEY=your_api_key_here 를 추가해주세요.');
    }
  }

  private async loadModelConfigs() {
    try {
      const modelDictPath = path.join(process.cwd(), 'public', 'model_dict.json');
      const data = await fs.readFile(modelDictPath, 'utf-8');
      this.modelConfigs = JSON.parse(data);
      console.log(`📊 ${this.modelConfigs.length}개의 Live2D 모델 설정을 로드했습니다.`);
    } catch (error) {
      console.error('❌ Live2D 모델 설정 로드 실패:', error);
      this.modelConfigs = [];
    }
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      
      const client: ClientConnection = {
        id: clientId,
        ws: ws,
        isAlive: true,
        lastHeartbeat: Date.now(),
        currentModel: this.config.live2d_model,
        currentEmotion: 'neutral',
        conversationHistory: []
      };

      this.clients.set(clientId, client);
      console.log(`🔗 새 클라이언트 연결: ${clientId} (총 ${this.clients.size}명)`);

      // 연결 직후 바로 초기 설정 전송 (지연 없음)
      setImmediate(() => {
        if (this.clients.has(clientId)) {
          this.sendInitialConfig(client);
        }
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(client, message);
        } catch (error) {
          console.error('메시지 처리 오류:', error);
          this.sendError(client, '메시지 처리 중 오류가 발생했습니다.');
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        const reasonStr = reason?.toString() || 'No reason';
        console.log(`👋 클라이언트 연결 종료: ${clientId} (코드: ${code}, 사유: ${reasonStr})`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket 오류 (${clientId}):`, error);
        // 오류 발생 시 클라이언트에게 알리고 정리
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            this.sendError(client, 'WebSocket 연결 오류가 발생했습니다.');
          }
        } catch (e) {
          // 이미 연결이 끊어진 경우
        }
        
        // 잠시 후 클라이언트 정리
        setTimeout(() => {
          if (this.clients.has(clientId)) {
            this.clients.delete(clientId);
            console.log(`🧹 오류로 인한 클라이언트 정리: ${clientId}`);
          }
        }, 1000);
      });

      ws.on('pong', () => {
        client.isAlive = true;
        client.lastHeartbeat = Date.now();
      });
    });
  }

  private async sendInitialConfig(client: ClientConnection) {
    try {
      // 간단한 초기화 메시지 (필수 정보만)
      const configMessage = {
        type: 'init-config',
        currentModel: client.currentModel,
        modelName: client.currentModel,
        character_name: this.config.character_name,
        status: 'ready',
        timestamp: Date.now()
      };

      console.log(`📤 간단한 초기 설정 전송 (${client.id}):`, {
        model: client.currentModel,
        status: 'ready'
      });
      
      this.sendMessage(client, configMessage);
      
      // 연결 확인 메시지
      setTimeout(() => {
        if (this.clients.has(client.id)) {
          this.sendMessage(client, {
            type: 'system',
            content: '🤖 AI 아바타 서버에 연결되었습니다!',
            timestamp: Date.now()
          });
        }
      }, 500);
      
    } catch (error) {
      console.error(`초기 설정 전송 오류 (${client.id}):`, error);
    }
  }

  private getAvailableEmotions(modelName: string): string[] {
    const model = this.modelConfigs.find(m => m.name === modelName);
    return model ? Object.keys(model.emotionMap) : ['neutral', 'joy', 'anger', 'sadness', 'surprise'];
  }

  private async handleMessage(client: ClientConnection, message: WebSocketMessage) {
    console.log(`📨 메시지 수신 (${client.id}):`, message.type);

    // 개성 정보가 있으면 클라이언트 연결에 저장
    if (message.personality) {
      client.personality = message.personality;
      console.log(`🎭 클라이언트 개성 설정 (${client.id}):`, message.personality);
    }

    switch (message.type) {
      case 'request-init-config':
        await this.sendInitialConfig(client);
        break;

      case 'text-input':
        await this.handleTextInput(client, message.text || message.content || '');
        break;

      case 'ai-speak-signal':
        await this.handleTextInput(client, message.text || message.content || '');
        break;

      case 'heartbeat':
        client.lastHeartbeat = Date.now();
        client.isAlive = true;
        this.sendMessage(client, { type: 'heartbeat-response', timestamp: Date.now() });
        break;

      case 'interrupt-signal':
        await this.handleInterrupt(client);
        break;

      case 'fetch-configs':
        await this.sendInitialConfig(client);
        break;

      case 'switch-config':
        await this.handleModelSwitch(client, message.data?.model || message.model);
        break;

      default:
        console.log(`⚠️  알 수 없는 메시지 타입: ${message.type}`);
    }
  }

  private async handleTextInput(client: ClientConnection, text: string) {
    if (!text.trim()) return;

    console.log(`💬 텍스트 입력 (${client.id}): ${text}`);

    // 사용자 메시지를 히스토리에 추가
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    client.conversationHistory.push(userMessage);

    // 대화 시작 신호 전송
    this.sendMessage(client, { 
      type: 'conversation-started', 
      timestamp: Date.now() 
    });

    try {
      // AI 응답 생성
      const aiResponse = await this.generateAIResponse(client, text);
      
      // TTS 오디오 생성
      let audioUrl = '';
      let volumes: number[] = [];
      
      if (this.openai && aiResponse.text) {
        try {
          const ttsResult = await this.generateTTS(aiResponse.text, client.personality);
          audioUrl = ttsResult.audioUrl;
          volumes = ttsResult.volumes;
          console.log('🎵 TTS 오디오 생성 완료:', {
            audioUrl: audioUrl ? 'URL 생성됨' : '생성 실패',
            volumesCount: volumes.length
          });
        } catch (error) {
          console.error('🚫 TTS 생성 오류:', error);
          // TTS 실패해도 텍스트는 전송
        }
      }
      
      // AI 응답을 히스토리에 추가
      const assistantMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: aiResponse.text,
        timestamp: Date.now(),
        emotion: aiResponse.emotion
      };
      client.conversationHistory.push(assistantMessage);

      // 감정 변경
      client.currentEmotion = aiResponse.emotion;

      // 응답 전송 (TTS 데이터 포함)
      this.sendMessage(client, {
        type: 'llm-response',
        text: aiResponse.text,
        emotion: aiResponse.emotion,
        model: client.currentModel,
        timestamp: Date.now(),
        audioUrl: audioUrl,
        volumes: volumes
      });

      // 대화 완료 신호
      this.sendMessage(client, {
        type: 'conversation-ended',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('AI 응답 생성 오류:', error);
      this.sendError(client, 'AI 응답 생성 중 오류가 발생했습니다.');
    }
  }

  private async generateAIResponse(client: ClientConnection, userInput: string): Promise<AIResponse> {
    if (!this.openai) {
      // OpenAI가 설정되지 않은 경우 기본 응답
      const emotion = this.analyzeEmotion(userInput);
      return {
        text: `[${emotion}] 죄송해요, AI 기능을 사용하려면 OpenAI API 키가 필요해요. 하지만 여전히 Live2D 아바타와 상호작용할 수 있어요!`,
        emotion: emotion,
        confidence: 0.5
      };
    }

    try {
      // 개성이 설정되어 있으면 시스템 프롬프트에 추가
      let systemPrompt = this.config.system_prompt;
      if (client.personality) {
        systemPrompt = `${this.config.system_prompt}

[캐릭터 개성 설정]
당신은 다음과 같은 개성을 가진 캐릭터입니다:
${client.personality}

위의 개성에 맞춰서 대화하고 응답해주세요.`;
        console.log(`🎭 개성이 포함된 시스템 프롬프트 사용:`, client.personality);
      }

      // 대화 히스토리 준비 (최근 3개 메시지만 - 빠른 응답)
      const recentHistory = client.conversationHistory.slice(-3);
      const messages = [
        {
          role: 'system' as const,
          content: systemPrompt
        },
        ...recentHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      ];

      // OpenAI API 호출
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: messages,
        max_tokens: this.config.max_tokens,
        temperature: this.config.temperature,
        stream: false
      });

      const responseText = completion.choices[0]?.message?.content || '응답을 생성할 수 없었습니다.';
      const emotion = this.extractEmotion(responseText);
      
      return {
        text: responseText,
        emotion: emotion,
        confidence: 0.8,
        metadata: {
          tokens_used: completion.usage?.total_tokens || 0,
          model: completion.model
        }
      };

    } catch (error) {
      console.error('OpenAI API 오류:', error);
      const emotion = this.analyzeEmotion(userInput);
      return {
        text: `[${emotion}] 죄송해요, 잠시 응답하는데 문제가 있어요. 다시 시도해주세요!`,
        emotion: emotion,
        confidence: 0.3
      };
    }
  }

  private extractEmotion(text: string): string {
    // 텍스트에서 감정 태그 추출 [emotion] 형태
    const emotionRegex = /\[(\w+)\]/g;
    const matches = text.match(emotionRegex);
    
    if (matches && matches.length > 0) {
      const emotionTag = matches[0].replace(/[\[\]]/g, '');
      const validEmotions = ['neutral', 'joy', 'anger', 'sadness', 'surprise', 'fear'];
      return validEmotions.includes(emotionTag) ? emotionTag : 'neutral';
    }

    return this.analyzeEmotion(text);
  }

  private analyzeEmotion(text: string): string {
    // 감정 키워드 분석
    const lowerText = text.toLowerCase();
    
    for (const [keyword, emotion] of Object.entries(this.config.emotion_keywords)) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return emotion;
      }
    }

    // 기본값
    return 'neutral';
  }

  private selectVoiceFromPersonality(personality?: string): "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" {
    if (!personality) return "nova"; // 기본값: 여성 목소리
    
    const lowerPersonality = personality.toLowerCase();
    
    // 남성 관련 키워드
    const maleKeywords = ['남자', '남성', '남자목소리', '남성적', '남자 목소리', '깊은 목소리', '저음'];
    // 여성 관련 키워드
    const femaleKeywords = ['여자', '여성', '여자목소리', '여성적', '여자 목소리', '밝은 목소리', '고음'];
    
    // 남성 키워드 확인
    if (maleKeywords.some(keyword => lowerPersonality.includes(keyword))) {
      console.log('🎙️ 남성 목소리 선택: onyx');
      return "onyx"; // 깊은 남성 목소리
    }
    
    // 여성 키워드 확인
    if (femaleKeywords.some(keyword => lowerPersonality.includes(keyword))) {
      console.log('🎙️ 여성 목소리 선택: nova');
      return "nova"; // 여성 목소리
    }
    
    // 키워드가 없으면 기본값
    console.log('🎙️ 기본 목소리 선택: nova');
    return "nova";
  }

  private async generateTTS(text: string, personality?: string): Promise<{ audioUrl: string; volumes: number[] }> {
    if (!this.openai) {
      throw new Error('OpenAI API가 설정되지 않았습니다');
    }

    try {
      // 감정 태그 제거
      const cleanText = text.replace(/\[[\w]+\]\s*/g, '').trim();
      
      // 개성에 따라 목소리 선택
      const selectedVoice = this.selectVoiceFromPersonality(personality);
      
      console.log('🎵 TTS 생성 시작:', {
        originalText: text.substring(0, 50) + '...',
        cleanText: cleanText.substring(0, 50) + '...',
        textLength: cleanText.length,
        personality: personality || '없음',
        selectedVoice: selectedVoice
      });

      // OpenAI TTS API 호출 (opus 포맷 - 더 빠름)
      const audioResponse = await this.openai.audio.speech.create({
        model: "tts-1",  // tts-1-hd는 더 느림
        voice: selectedVoice,   // 개성에 따라 선택된 목소리
        input: cleanText,
        response_format: "opus",  // opus는 mp3보다 빠르고 작음
        speed: 1.1  // 약간 빠르게
      });

      // 오디오 데이터를 Buffer로 변환
      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      
      // 임시 파일 생성 (public 폴더에 저장)
      const filename = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.opus`;
      const audioPath = path.join(process.cwd(), 'public', 'audio', filename);
      
      // audio 디렉토리가 없으면 생성
      const audioDir = path.dirname(audioPath);
      await fs.mkdir(audioDir, { recursive: true });
      
      // 파일 저장
      await fs.writeFile(audioPath, buffer);
      
      // 파일이 실제로 생성되었는지 확인
      try {
        await fs.access(audioPath);
        const stats = await fs.stat(audioPath);
        console.log('✅ 파일 생성 확인:', {
          path: audioPath,
          size: stats.size,
          exists: true
        });
      } catch (error) {
        console.error('❌ 파일 생성 실패:', audioPath, error);
        throw new Error('TTS 파일 생성 실패');
      }
      
      // URL 생성
      const audioUrl = `/audio/${filename}`;
      
      // 볼륨 데이터 생성 (간단한 더미 데이터, 실제로는 오디오 분석 필요)
      const volumes = this.generateVolumeData(cleanText.length);
      
      console.log('🎵 TTS 생성 완료:', {
        filename,
        audioUrl,
        absolutePath: audioPath,
        fileSize: buffer.length,
        volumesCount: volumes.length
      });

      // 5분 후 임시 파일 삭제 스케줄링
      setTimeout(async () => {
        try {
          await fs.unlink(audioPath);
          console.log('🗑️  임시 TTS 파일 삭제:', filename);
        } catch (error) {
          console.warn('⚠️ TTS 파일 삭제 실패:', filename, error);
        }
      }, 5 * 60 * 1000); // 5분

      return { audioUrl, volumes };

    } catch (error) {
      console.error('🚫 OpenAI TTS API 오류:', error);
      throw error;
    }
  }

  private generateVolumeData(textLength: number): number[] {
    // 텍스트 길이를 기반으로 볼륨 데이터 생성
    // 실제로는 오디오 분석이 필요하지만, 임시로 간단한 패턴 생성
    const duration = Math.max(textLength * 0.1, 2); // 최소 2초
    const frameRate = 60; // 60fps
    const totalFrames = Math.floor(duration * frameRate);
    
    const volumes: number[] = [];
    
    for (let i = 0; i < totalFrames; i++) {
      // 사인파 기반의 자연스러운 볼륨 변화
      const progress = i / totalFrames;
      const baseVolume = 0.3 + Math.sin(progress * Math.PI * 4) * 0.2;
      const randomVariation = (Math.random() - 0.5) * 0.1;
      const volume = Math.max(0, Math.min(1, baseVolume + randomVariation));
      volumes.push(volume);
    }
    
    return volumes;
  }

  private async handleInterrupt(client: ClientConnection) {
    console.log(`⚠️  대화 중단 요청 (${client.id})`);
    
    this.sendMessage(client, {
      type: 'conversation-interrupted',
      timestamp: Date.now()
    });
  }

  private async handleModelSwitch(client: ClientConnection, modelName: string) {
    if (!modelName) return;

    const model = this.modelConfigs.find(m => m.name === modelName);
    if (!model) {
      this.sendError(client, `모델 '${modelName}'을(를) 찾을 수 없습니다.`);
      return;
    }

    client.currentModel = modelName;
    client.currentEmotion = 'neutral';

    console.log(`🔄 모델 변경 (${client.id}): ${modelName}`);

    this.sendMessage(client, {
      type: 'model-switched',
      model: modelName,
      emotions: this.getAvailableEmotions(modelName),
      timestamp: Date.now()
    });
  }

  private sendMessage(client: ClientConnection, message: any) {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        const messageStr = JSON.stringify(message);
        console.log(`📤 메시지 전송 (${client.id}):`, message.type, messageStr.length, 'bytes');
        client.ws.send(messageStr);
      } else {
        console.warn(`❌ 클라이언트 ${client.id} WebSocket이 열려있지 않습니다. 상태: ${client.ws.readyState}`);
      }
    } catch (error) {
      console.error(`❌ 메시지 전송 오류 (${client.id}):`, error);
    }
  }

  private sendError(client: ClientConnection, error: string) {
    this.sendMessage(client, {
      type: 'error',
      message: error,
      timestamp: Date.now()
    });
  }

  private startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        // 각 클라이언트의 생존 확인
        const client = Array.from(this.clients.values()).find(c => c.ws === ws);
        if (client) {
          // 연결 안정성을 위해 타임아웃 조건 완화
          if (!client.isAlive && client.ws.readyState !== WebSocket.OPEN) {
            console.log(`💀 클라이언트 연결 종료 (타임아웃): ${client.id}`);
            client.ws.terminate();
            this.clients.delete(client.id);
            return;
          }
          
          // ping만 전송하고 즉시 종료하지 않음
          if (client.ws.readyState === WebSocket.OPEN) {
            client.isAlive = false;
            client.ws.ping();
          }
        }
      });
    }, 60000); // 60초마다 체크 (간격 증가)
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      availableModels: this.modelConfigs.length,
      openaiConfigured: !!this.openai,
      uptime: process.uptime()
    };
  }
}
