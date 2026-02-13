import OpenAI from "openai";
import fs from "fs";
import path from "path";

export class OpenAIWhisperService {
  private client: OpenAI;
  private model: string;
  private language: string;

  constructor(apiKey?: string, model: string = "whisper-1", language: string = "ko") {
    if (!apiKey) {
      throw new Error("OpenAI API 키가 필요합니다. 환경변수 OPENAI_API_KEY를 설정해주세요.");
    }
    
    this.client = new OpenAI({
      apiKey: apiKey
    });
    this.model = model;
    this.language = language;
    
    console.log(`🎤 OpenAI Whisper ASR 서비스 초기화됨 (모델: ${model}, 언어: ${language})`);
  }

  /**
   * 오디오 파일을 텍스트로 변환
   */
  async transcribeFile(filePath: string): Promise<string> {
    try {
      console.log(`🎧 음성 인식 시작: ${path.basename(filePath)}`);
      
      // 파일 존재 확인
      if (!fs.existsSync(filePath)) {
        throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
      }

      // 파일 크기 확인 (25MB 제한)
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      if (fileSizeInMB > 25) {
        throw new Error(`파일 크기가 너무 큽니다: ${fileSizeInMB.toFixed(2)}MB (최대 25MB)`);
      }

      console.log(`📁 파일 정보: 크기 ${fileSizeInMB.toFixed(2)}MB`);

      // 파일 스트림 생성
      const fileStream = fs.createReadStream(filePath);
      
      // OpenAI Whisper API 호출
      console.log(`🚀 OpenAI Whisper API 호출 중... (모델: ${this.model})`);
      
      const transcription = await this.client.audio.transcriptions.create({
        file: fileStream,
        model: this.model,
        language: this.language,
        response_format: "text",
        temperature: 0.0,
      });

      console.log(`✅ 음성 인식 완료: "${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}"`);
      
      return transcription;
      
    } catch (error) {
      console.error(`❌ 음성 인식 실패:`, error);
      
      if (error instanceof Error) {
        // OpenAI API 특정 오류 처리
        if (error.message.includes('audio file is invalid')) {
          throw new Error(`지원되지 않는 오디오 파일 형식입니다.`);
        } else if (error.message.includes('rate limit')) {
          throw new Error(`API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.`);
        } else if (error.message.includes('invalid api key')) {
          throw new Error(`OpenAI API 키가 유효하지 않습니다.`);
        }
        
        throw new Error(`음성 인식 실패: ${error.message}`);
      } else {
        throw new Error("알 수 없는 음성 인식 오류가 발생했습니다.");
      }
    }
  }

  /**
   * 오디오 버퍼로 직접 변환 (메모리 효율적)
   */
  async transcribeBuffer(audioBuffer: Buffer, filename: string): Promise<string> {
    try {
      console.log(`🎧 버퍼 음성 인식 시작: ${filename} (${audioBuffer.length} bytes)`);
      
      if (audioBuffer.length === 0) {
        throw new Error("오디오 데이터가 비어있습니다.");
      }

      // 파일 크기 확인 (25MB 제한)
      const fileSizeInMB = audioBuffer.length / (1024 * 1024);
      if (fileSizeInMB > 25) {
        throw new Error(`파일 크기가 너무 큽니다: ${fileSizeInMB.toFixed(2)}MB (최대 25MB)`);
      }

      // File 객체 생성 (Web API)
      const file = new File([audioBuffer], filename, {
        type: this.getMimeTypeFromFilename(filename)
      });
      
      console.log(`🚀 OpenAI Whisper API 호출 중... (버퍼 모드)`);
      
      const transcription = await this.client.audio.transcriptions.create({
        file: file,
        model: this.model,
        language: this.language,
        response_format: "text",
        temperature: 0.0,
      });

      console.log(`✅ 버퍼 음성 인식 완료: "${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}"`);
      
      return transcription;
      
    } catch (error) {
      console.error(`❌ 버퍼 음성 인식 실패:`, error);
      throw error;
    }
  }

  /**
   * 파일명에서 MIME 타입 추측
   */
  private getMimeTypeFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac'
    };
    
    return mimeTypes[ext] || 'audio/wav';
  }

  /**
   * 지원되는 오디오 형식 확인
   */
  isSupportedFormat(filename: string): boolean {
    const supportedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.flac', '.aac'];
    const ext = path.extname(filename).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  /**
   * 서비스 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 간단한 API 키 검증 (실제 요청 없이)
      return !!this.client.apiKey;
    } catch (error) {
      console.error("OpenAI Whisper 서비스 상태 확인 실패:", error);
      return false;
    }
  }
}

// 환경변수에서 API 키 가져오기
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 싱글톤 인스턴스 생성
let whisperInstance: OpenAIWhisperService | null = null;

export function getOpenAIWhisperService(): OpenAIWhisperService | null {
  try {
    if (!whisperInstance && OPENAI_API_KEY) {
      whisperInstance = new OpenAIWhisperService(OPENAI_API_KEY);
    }
    return whisperInstance;
  } catch (error) {
    console.warn("⚠️ OpenAI Whisper 서비스 초기화 실패:", error);
    return null;
  }
} 