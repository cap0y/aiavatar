import { useState, useRef, useCallback } from 'react';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  transcription: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearTranscription: () => void;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setIsProcessing(false);
      
      // 마이크 권한 요청 및 오디오 스트림 획득
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // MediaRecorder 설정
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // 웹 호환성 향상
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          // 오디오 블롭 생성
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm;codecs=opus' 
          });

          // FormData로 서버에 전송
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          // 음성 인식 API 호출 (liv2d 서버의 /asr 엔드포인트 사용)
          const response = await fetch('/api/speech/transcribe', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`음성 인식 실패: ${response.status}`);
          }

          const result = await response.json();
          setTranscription(result.text || '음성을 인식할 수 없습니다.');
          
        } catch (err) {
          console.error('음성 인식 오류:', err);
          setError(err instanceof Error ? err.message : '음성 인식 중 오류가 발생했습니다.');
        } finally {
          setIsProcessing(false);
          // 스트림 정리
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (err) {
      console.error('녹음 시작 오류:', err);
      setError(err instanceof Error ? err.message : '마이크 접근 권한이 필요합니다.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const clearTranscription = useCallback(() => {
    setTranscription(null);
    setError(null);
  }, []);

  return {
    isRecording,
    isProcessing,
    error,
    transcription,
    startRecording,
    stopRecording,
    clearTranscription
  };
}; 