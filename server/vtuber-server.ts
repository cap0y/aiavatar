import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Server as HTTPServer } from 'http';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  private config: VTuberConfig;
  private modelConfigs: Live2DModelConfig[] = [];
  
  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      noServer: true
    });
    
    // ?섎룞?쇰줈 upgrade ?대깽??泥섎━ (/client-ws 寃쎈줈留?
    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
      
      if (pathname === '/client-ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
      // Socket.io 寃쎈줈??嫄대뱶由ъ? ?딆쓬
    });
    
    this.config = this.getDefaultConfig();
    this.setupWebSocketHandlers();
    this.loadModelConfigs();
    this.startHeartbeat();
    
    console.log('?쨼 VTuber WebSocket ?쒕쾭媛 /client-ws 寃쎈줈?먯꽌 以鍮꾨릺?덉뒿?덈떎.');
  }

  private getDefaultConfig(): VTuberConfig {
    return {
      system_prompt: `?뱀떊? 移쒓렐?섍퀬 ?쒕컻??AI ?꾨컮??낅땲?? 
?ㅼ쓬怨?媛숈? ?깃꺽??媛吏怨??덉뒿?덈떎:
- 諛앷퀬 湲띿젙?곸씤 ?깃꺽
- ?ъ슜?먯? 移쒓렐?섍쾶 ???- 媛먯젙 ?쒗쁽???띾???- 沅곴툑??寃껋씠 留롪퀬 ?멸린?ъ씠 媛뺥븿

?묐떟?????ㅼ쓬 媛먯젙 ?쒓렇 以??섎굹瑜??ы븿?댁＜?몄슂:
[neutral], [joy], [anger], [sadness], [surprise], [fear]

吏㏐퀬 媛꾧껐?섍쾶 ??듯빐二쇱꽭?? 2-3臾몄옣 ?대궡濡??듬??섏꽭??

?덉떆: "[joy] ?덈뀞?섏꽭?? ?ㅻ뒛 湲곕텇???뺣쭚 醫뗭븘??"`,
      character_name: "AI ?꾨컮?",
      character_description: "移쒓렐?섍퀬 ?쒕컻??AI ?꾨컮? 罹먮┃??,
      personality: "諛앷퀬 湲띿젙?곸씠硫??멸린?ъ씠 留롮쓬",
      live2d_model: "",
      model: "gpt-4o-mini",
      max_tokens: 150,  // 鍮좊Ⅸ ?묐떟???꾪빐 以꾩엫
      temperature: 0.7,
      emotion_keywords: {
        "湲곗겏": "joy",
        "?됰났": "joy",
        "醫뗭븘": "joy",
        "?껋쓬": "joy",
        "?붾궓": "anger",
        "?붽?": "anger",
        "吏쒖쬆": "anger",
        "?ы뵒": "sadness",
        "?ы띁": "sadness",
        "?곗슱": "sadness",
        "???: "surprise",
        "源쒖쭩": "surprise",
        "?": "surprise",
        "臾댁꽌": "fear",
        "嫄깆젙": "fear",
        "?됰쾾": "neutral",
        "洹몃깷": "neutral"
      }
    };
  }


  private async loadModelConfigs() {
    try {
      const modelDictPath = path.join(process.cwd(), 'public', 'model_dict.json');
      const data = await fs.readFile(modelDictPath, 'utf-8');
      this.modelConfigs = JSON.parse(data);
      console.log(`?뱤 ${this.modelConfigs.length}媛쒖쓽 Live2D 紐⑤뜽 ?ㅼ젙??濡쒕뱶?덉뒿?덈떎.`);
    } catch (error) {
      console.error('??Live2D 紐⑤뜽 ?ㅼ젙 濡쒕뱶 ?ㅽ뙣:', error);
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
      console.log(`?뵕 ???대씪?댁뼵???곌껐: ${clientId} (珥?${this.clients.size}紐?`);

      // ?곌껐 吏곹썑 諛붾줈 珥덇린 ?ㅼ젙 ?꾩넚 (吏???놁쓬)
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
          console.error('硫붿떆吏 泥섎━ ?ㅻ쪟:', error);
          this.sendError(client, '硫붿떆吏 泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        const reasonStr = reason?.toString() || 'No reason';
        console.log(`?몝 ?대씪?댁뼵???곌껐 醫낅즺: ${clientId} (肄붾뱶: ${code}, ?ъ쑀: ${reasonStr})`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`??WebSocket ?ㅻ쪟 (${clientId}):`, error);
        // ?ㅻ쪟 諛쒖깮 ???대씪?댁뼵?몄뿉寃??뚮━怨??뺣━
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            this.sendError(client, 'WebSocket ?곌껐 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
          }
        } catch (e) {
          // ?대? ?곌껐???딆뼱吏?寃쎌슦
        }
        
        // ?좎떆 ???대씪?댁뼵???뺣━
        setTimeout(() => {
          if (this.clients.has(clientId)) {
            this.clients.delete(clientId);
            console.log(`?㏏ ?ㅻ쪟濡??명븳 ?대씪?댁뼵???뺣━: ${clientId}`);
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
      // 媛꾨떒??珥덇린??硫붿떆吏 (?꾩닔 ?뺣낫留?
      const configMessage = {
        type: 'init-config',
        currentModel: client.currentModel,
        modelName: client.currentModel,
        character_name: this.config.character_name,
        status: 'ready',
        timestamp: Date.now()
      };

      console.log(`?뱾 媛꾨떒??珥덇린 ?ㅼ젙 ?꾩넚 (${client.id}):`, {
        model: client.currentModel,
        status: 'ready'
      });
      
      this.sendMessage(client, configMessage);
      
      // ?곌껐 ?뺤씤 硫붿떆吏
      setTimeout(() => {
        if (this.clients.has(client.id)) {
          this.sendMessage(client, {
            type: 'system',
            content: '?쨼 AI ?꾨컮? ?쒕쾭???곌껐?섏뿀?듬땲??',
            timestamp: Date.now()
          });
        }
      }, 500);
      
    } catch (error) {
      console.error(`珥덇린 ?ㅼ젙 ?꾩넚 ?ㅻ쪟 (${client.id}):`, error);
    }
  }

  private getAvailableEmotions(modelName: string): string[] {
    const model = this.modelConfigs.find(m => m.name === modelName);
    return model ? Object.keys(model.emotionMap) : ['neutral', 'joy', 'anger', 'sadness', 'surprise'];
  }

  private async handleMessage(client: ClientConnection, message: WebSocketMessage) {
    console.log(`?벂 硫붿떆吏 ?섏떊 (${client.id}):`, message.type);

    // 媛쒖꽦 ?뺣낫媛 ?덉쑝硫??대씪?댁뼵???곌껐?????    if (message.personality) {
      client.personality = message.personality;
      console.log(`?렚 ?대씪?댁뼵??媛쒖꽦 ?ㅼ젙 (${client.id}):`, message.personality);
    }

    // ?쒕??섏씠 API ???뺣낫媛 ?덉쑝硫??대씪?댁뼵???곌껐?????    if (message.geminiApiKey !== undefined) {
      client.geminiApiKey = message.geminiApiKey;
      console.log(`?뵎 ?쒕??섏씠 API ???섏떊 (${client.id}): ${message.geminiApiKey ? `?덉쓬(${String(message.geminiApiKey).substring(0, 10)}...)` : '?놁쓬(鍮덇컪)'}`);
    }

    // ?쒕??섏씠 紐⑤뜽 ?좏깮 ?뺣낫媛 ?덉쑝硫????    if (message.geminiModel !== undefined) {
      client.geminiModel = message.geminiModel;
      console.log(`?쨼 ?쒕??섏씠 紐⑤뜽 ?섏떊 (${client.id}): ${message.geminiModel || '(?놁쓬)'}`);
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
        console.log(`?좑툘  ?????녿뒗 硫붿떆吏 ??? ${message.type}`);
    }
  }

  private async handleTextInput(client: ClientConnection, text: string) {
    if (!text.trim()) return;

    // ?대? ?묐떟 ?앹꽦 以묒씠硫??먯뿉 ?곸옱?섍퀬 ?湲?    if (client.isBusy) {
      if (!client.pendingQueue) client.pendingQueue = [];
      client.pendingQueue.push(text);
      console.log(`???먯뿉 ?곸옱 (${client.id}): "${text}" (?湲?${client.pendingQueue.length}媛?`);
      return;
    }

    client.isBusy = true;
    console.log(`?뮠 ?띿뒪???낅젰 (${client.id}): ${text}`);

    // ?ъ슜??硫붿떆吏瑜??덉뒪?좊━??異붽?
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    client.conversationHistory.push(userMessage);

    // ????쒖옉 ?좏샇 ?꾩넚
    this.sendMessage(client, { 
      type: 'conversation-started', 
      timestamp: Date.now() 
    });

    try {
      // AI ?묐떟 ?앹꽦
      const aiResponse = await this.generateAIResponse(client, text);
      
      // TTS ?ㅻ뵒???앹꽦
      let audioUrl = '';
      let volumes: number[] = [];
      
      if (client.geminiApiKey && aiResponse.text) {
        try {
          const ttsResult = await this.generateTTS(aiResponse.text, client.geminiApiKey, client.personality);
          audioUrl = ttsResult.audioUrl;
          volumes = ttsResult.volumes;
          console.log('?렦 Gemini TTS ?앹꽦 ?꾨즺:', {
            audioUrl: audioUrl ? 'URL ?앹꽦?? : '?앹꽦 ?ㅽ뙣',
            volumesCount: volumes.length
          });
        } catch (error) {
          console.error('?슟 Gemini TTS ?앹꽦 ?ㅻ쪟 (釉뚮씪?곗? TTS ?대갚):', error);
        }
      }
      
      // AI ?묐떟???덉뒪?좊━??異붽?
      const assistantMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: aiResponse.text,
        timestamp: Date.now(),
        emotion: aiResponse.emotion
      };
      client.conversationHistory.push(assistantMessage);

      // 媛먯젙 蹂寃?      client.currentEmotion = aiResponse.emotion;

      // ?묐떟 ?꾩넚 (TTS ?곗씠???ы븿)
      this.sendMessage(client, {
        type: 'llm-response',
        text: aiResponse.text,
        emotion: aiResponse.emotion,
        model: client.currentModel,
        timestamp: Date.now(),
        audioUrl: audioUrl,
        volumes: volumes
      });

      // ????꾨즺 ?좏샇
      this.sendMessage(client, {
        type: 'conversation-ended',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('AI ?묐떟 ?앹꽦 ?ㅻ쪟:', error);
      this.sendError(client, 'AI ?묐떟 ?앹꽦 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
    } finally {
      // 泥섎━ ?꾨즺 ???먯뿉 ?ㅼ쓬 ??ぉ???덉쑝硫?泥섎━
      client.isBusy = false;
      if (client.pendingQueue && client.pendingQueue.length > 0) {
        const next = client.pendingQueue.shift()!;
        console.log(`?띰툘  ???ㅼ쓬 泥섎━ (${client.id}): "${next}"`);
        setImmediate(() => this.handleTextInput(client, next));
      }
    }
  }

  private async generateAIResponse(client: ClientConnection, userInput: string): Promise<AIResponse> {
    let systemPrompt = this.config.system_prompt;
    if (client.personality) {
      systemPrompt = `${this.config.system_prompt}

[罹먮┃??媛쒖꽦 ?ㅼ젙]
?뱀떊? ?ㅼ쓬怨?媛숈? 媛쒖꽦??媛吏?罹먮┃?곗엯?덈떎:
${client.personality}

?꾩쓽 媛쒖꽦??留욎떠????뷀븯怨??묐떟?댁＜?몄슂.`;
      console.log(`?렚 媛쒖꽦???ы븿???쒖뒪???꾨＼?꾪듃 ?ъ슜:`, client.personality);
    }

    // 1. ?쒕??섏씠 API ?ㅺ? ?덈뒗 寃쎌슦 ?곗꽑?곸쑝濡??ъ슜
    if (client.geminiApiKey && client.geminiApiKey.trim().length > 0) {
      const selectedGeminiModel = client.geminiModel && client.geminiModel.trim()
        ? client.geminiModel.trim()
        : "gemini-1.5-flash";
      try {
        console.log(`???쒕??섏씠 API瑜??ъ슜?섏뿬 ?묐떟 ?앹꽦 ?쒕룄 (${client.id}): ${selectedGeminiModel}`);
        const genAI = new GoogleGenerativeAI(client.geminiApiKey);

        // systemInstruction? getGenerativeModel???꾨떖?댁빞 ??(startChat???ｌ쑝硫?400 ?먮윭)
        const model = genAI.getGenerativeModel({
          model: selectedGeminiModel,
          systemInstruction: {
            role: 'user',
            parts: [{ text: systemPrompt }]
          }
        });

        // ????덉뒪?좊━ 以鍮?- Gemini??諛섎뱶??user ??model 援먮? ?쒖꽌
        const recentHistory = client.conversationHistory.slice(-8);
        const rawPaired: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
        for (const msg of recentHistory) {
          if (msg.role === 'system') continue;
          rawPaired.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          });
        }

        // ?꾩옱 ?낅젰? sendMessage濡??꾨떖?섎?濡??덉뒪?좊━?먯꽌 ?쒓굅
        const historyWithoutCurrent = rawPaired.slice(0, -1);

        // 泥???ぉ??'model'?대㈃ ?욎뿉???쒓굅 (諛섎뱶??user濡??쒖옉?댁빞 ??
        while (historyWithoutCurrent.length > 0 && historyWithoutCurrent[0].role === 'model') {
          historyWithoutCurrent.shift();
        }

        // user-model 援먮? 蹂댁옣 (?곗냽 ?숈씪 role ?쒓굅)
        const pairedHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
        for (const msg of historyWithoutCurrent) {
          const lastRole = pairedHistory.length > 0 ? pairedHistory[pairedHistory.length - 1].role : null;
          if (msg.role !== lastRole) pairedHistory.push(msg);
        }

        const chat = model.startChat({
          history: pairedHistory,
          generationConfig: {
            maxOutputTokens: this.config.max_tokens,
            temperature: this.config.temperature,
          },
        });

        const result = await chat.sendMessage(userInput);
        const responseText = result.response.text() || '?묐떟???앹꽦?????놁뿀?듬땲??';
        const emotion = this.extractEmotion(responseText);

        return {
          text: responseText,
          emotion: emotion,
          confidence: 0.8,
          metadata: {
            model: selectedGeminiModel,
            provider: "google"
          }
        };
      } catch (error) {
        return {
          text: '?쒕??섏씠 API ?몄텧 以??ㅻ쪟媛 諛쒖깮?덉뼱?? ?ㅺ? ?щ컮瑜몄? ?뺤씤?댁＜?몄슂!',
          emotion: 'neutral',
          confidence: 0.3
        };
      }
    }

    // 2. ?쒕??섏씠 ?ㅺ? ?놁쑝硫??덈궡 硫붿떆吏 諛섑솚
    return {
      text: '二꾩넚?댁슂, ??뷀븯?ㅻ㈃ ?쒕??섏씠(Google) API ?ㅺ? ?꾩슂?댁슂. ?꾨컮? 媛쒖꽦 ?ㅼ젙?먯꽌 Gemini API ?ㅻ? ?낅젰?댁＜?몄슂!',
      emotion: 'neutral',
      confidence: 0.5
    };
  }

  private extractEmotion(text: string): string {
    // ?띿뒪?몄뿉??媛먯젙 ?쒓렇 異붿텧 [emotion] ?뺥깭
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
    // 媛먯젙 ?ㅼ썙??遺꾩꽍
    const lowerText = text.toLowerCase();
    
    for (const [keyword, emotion] of Object.entries(this.config.emotion_keywords)) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return emotion;
      }
    }

    // 湲곕낯媛?    return 'neutral';
  }

  private selectGeminiVoice(personality?: string): string {
    if (!personality) return 'Kore'; // 湲곕낯: ?⑦샇?섍퀬 紐낇솗???ъ꽦 紐⑹냼由?
    const lowerPersonality = personality.toLowerCase();

    const maleKeywords = ['?⑥옄', '?⑥꽦', '?⑥옄紐⑹냼由?, '?⑥꽦??, '源딆? 紐⑹냼由?, '???];
    const femaleKeywords = ['?ъ옄', '?ъ꽦', '?ъ옄紐⑹냼由?, '?ъ꽦??, '諛앹? 紐⑹냼由?, '怨좎쓬'];
    const youngKeywords = ['?대┛', '?좎븘', '洹?ъ슫', '?꾩씠', '?뚮?', '?뚮뀈'];
    const warmKeywords = ['?곕쑜', '?⑦솕', '遺?쒕윭??, '移쒓렐'];
    const energyKeywords = ['?쒕컻', '?먮꼫吏', '?좊굹', '?κ꺼', '?낅퉬??];

    if (youngKeywords.some(k => lowerPersonality.includes(k))) return 'Leda';      // 諛앷퀬 ?대┛ 紐⑹냼由?    if (energyKeywords.some(k => lowerPersonality.includes(k))) return 'Puck';     // ?좊굹??紐⑹냼由?    if (warmKeywords.some(k => lowerPersonality.includes(k))) return 'Sulafat';    // ?곕쑜??紐⑹냼由?    if (maleKeywords.some(k => lowerPersonality.includes(k))) return 'Fenrir';     // ?⑥꽦??紐⑹냼由?    if (femaleKeywords.some(k => lowerPersonality.includes(k))) return 'Aoede';    // ?ъ꽦 紐⑹냼由?
    return 'Kore'; // 湲곕낯媛?  }

  // PCM raw ?곗씠?곕? WAV ?뚯씪 Buffer濡?蹂??  private pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const wav = Buffer.alloc(headerSize + dataSize);

    wav.write('RIFF', 0, 'ascii');
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write('WAVE', 8, 'ascii');
    wav.write('fmt ', 12, 'ascii');
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);            // PCM
    wav.writeUInt16LE(channels, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(byteRate, 28);
    wav.writeUInt16LE(blockAlign, 32);
    wav.writeUInt16LE(bitsPerSample, 34);
    wav.write('data', 36, 'ascii');
    wav.writeUInt32LE(dataSize, 40);
    pcmBuffer.copy(wav, 44);

    return wav;
  }

  private async generateTTS(text: string, geminiApiKey: string, personality?: string): Promise<{ audioUrl: string; volumes: number[] }> {
    const cleanText = text.replace(/\[[\w]+\]\s*/g, '').trim();
    if (!cleanText) throw new Error('TTS???띿뒪?멸? ?놁뒿?덈떎');

    const voiceName = this.selectGeminiVoice(personality);
    console.log('?렦 Gemini TTS ?쒖옉:', { textLength: cleanText.length, voice: voiceName });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: cleanText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName }
              }
            }
          }
        })
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini TTS API ?ㅻ쪟 (${res.status}): ${errBody}`);
    }

    const json = await res.json() as any;
    const base64Audio: string = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('Gemini TTS: ?ㅻ뵒???곗씠?곌? ?놁뒿?덈떎');

    const pcmBuffer = Buffer.from(base64Audio, 'base64');
    const wavBuffer = this.pcmToWav(pcmBuffer);

    const filename = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`;
    const audioDir = path.join(process.cwd(), 'public', 'audio');
    await fs.mkdir(audioDir, { recursive: true });
    const audioPath = path.join(audioDir, filename);
    await fs.writeFile(audioPath, wavBuffer);

    console.log('??Gemini TTS WAV ???', { filename, size: wavBuffer.length });

    // 5遺????뚯씪 ?먮룞 ??젣
    setTimeout(async () => {
      try { await fs.unlink(audioPath); } catch { /* 臾댁떆 */ }
    }, 5 * 60 * 1000);

    const volumes = this.generateVolumeData(cleanText.length);
    return { audioUrl: `/audio/${filename}`, volumes };
  }

  private generateVolumeData(textLength: number): number[] {
    // ?띿뒪??湲몄씠瑜?湲곕컲?쇰줈 蹂쇰ⅷ ?곗씠???앹꽦
    // ?ㅼ젣濡쒕뒗 ?ㅻ뵒??遺꾩꽍???꾩슂?섏?留? ?꾩떆濡?媛꾨떒???⑦꽩 ?앹꽦
    const duration = Math.max(textLength * 0.1, 2); // 理쒖냼 2珥?    const frameRate = 60; // 60fps
    const totalFrames = Math.floor(duration * frameRate);
    
    const volumes: number[] = [];
    
    for (let i = 0; i < totalFrames; i++) {
      // ?ъ씤??湲곕컲???먯뿰?ㅻ윭??蹂쇰ⅷ 蹂??      const progress = i / totalFrames;
      const baseVolume = 0.3 + Math.sin(progress * Math.PI * 4) * 0.2;
      const randomVariation = (Math.random() - 0.5) * 0.1;
      const volume = Math.max(0, Math.min(1, baseVolume + randomVariation));
      volumes.push(volume);
    }
    
    return volumes;
  }

  private async handleInterrupt(client: ClientConnection) {
    console.log(`?좑툘  ???以묐떒 ?붿껌 (${client.id})`);
    
    this.sendMessage(client, {
      type: 'conversation-interrupted',
      timestamp: Date.now()
    });
  }

  private async handleModelSwitch(client: ClientConnection, modelName: string) {
    if (!modelName) return;

    const model = this.modelConfigs.find(m => m.name === modelName);
    if (!model) {
      this.sendError(client, `紐⑤뜽 '${modelName}'??瑜? 李얠쓣 ???놁뒿?덈떎.`);
      return;
    }

    client.currentModel = modelName;
    client.currentEmotion = 'neutral';

    console.log(`?봽 紐⑤뜽 蹂寃?(${client.id}): ${modelName}`);

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
        console.log(`?뱾 硫붿떆吏 ?꾩넚 (${client.id}):`, message.type, messageStr.length, 'bytes');
        client.ws.send(messageStr);
      } else {
        console.warn(`???대씪?댁뼵??${client.id} WebSocket???대젮?덉? ?딆뒿?덈떎. ?곹깭: ${client.ws.readyState}`);
      }
    } catch (error) {
      console.error(`??硫붿떆吏 ?꾩넚 ?ㅻ쪟 (${client.id}):`, error);
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
        // 媛??대씪?댁뼵?몄쓽 ?앹〈 ?뺤씤
        const client = Array.from(this.clients.values()).find(c => c.ws === ws);
        if (client) {
          // ?곌껐 ?덉젙?깆쓣 ?꾪빐 ??꾩븘??議곌굔 ?꾪솕
          if (!client.isAlive && client.ws.readyState !== WebSocket.OPEN) {
            console.log(`?? ?대씪?댁뼵???곌껐 醫낅즺 (??꾩븘??: ${client.id}`);
            client.ws.terminate();
            this.clients.delete(client.id);
            return;
          }
          
          // ping留??꾩넚?섍퀬 利됱떆 醫낅즺?섏? ?딆쓬
          if (client.ws.readyState === WebSocket.OPEN) {
            client.isAlive = false;
            client.ws.ping();
          }
        }
      });
    }, 60000); // 60珥덈쭏??泥댄겕 (媛꾧꺽 利앷?)
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      availableModels: this.modelConfigs.length,
      uptime: process.uptime()
    };
  }
}