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
      
      // 留덉씠??沅뚰븳 ?붿껌 諛??ㅻ뵒???ㅽ듃由??띾뱷
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

      // MediaRecorder ?ㅼ젙
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // ???명솚???μ긽
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
          // ?ㅻ뵒??釉붾∼ ?앹꽦
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm;codecs=opus' 
          });

          // FormData濡??쒕쾭???꾩넚 (Gemini API ???ы븿)
          const geminiApiKey = localStorage.getItem('gemini_api_key_global') || '';
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('geminiApiKey', geminiApiKey);

          const response = await fetch('/api/speech/transcribe', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`?뚯꽦 ?몄떇 ?ㅽ뙣: ${response.status}`);
          }

          const result = await response.json();
          setTranscription(result.text || '?뚯꽦???몄떇?????놁뒿?덈떎.');
          
        } catch (err) {
          console.error('?뚯꽦 ?몄떇 ?ㅻ쪟:', err);
          setError(err instanceof Error ? err.message : '?뚯꽦 ?몄떇 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
        } finally {
          setIsProcessing(false);
          // ?ㅽ듃由??뺣━
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
      console.error('?뱀쓬 ?쒖옉 ?ㅻ쪟:', err);
      setError(err instanceof Error ? err.message : '留덉씠???묎렐 沅뚰븳???꾩슂?⑸땲??');
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
