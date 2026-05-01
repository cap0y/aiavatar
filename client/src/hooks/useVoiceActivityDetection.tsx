import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseVoiceActivityDetectionReturn {
  isListening: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  transcription: string | null;
  voiceLevel: number;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearTranscription: () => void;
}

export const useVoiceActivityDetection = (
  silenceThreshold: number = 0.01, // 移⑤У ?꾧퀎媛?  silenceDuration: number = 2000,  // 移⑤У 吏???쒓컙 (ms)
  minRecordingTime: number = 1000,  // 理쒖냼 ?뱀쓬 ?쒓컙 (ms)
  isAvatarSpeaking: boolean = false // ?꾨컮?媛 留먰븯怨??덈뒗吏 ?щ?
): UseVoiceActivityDetectionReturn => {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [voiceLevel, setVoiceLevel] = useState<number>(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ?ㅼ떆媛??곹깭 異붿쟻??Refs
  const isListeningRef = useRef(false);
  const isRecordingRef = useRef(false);

  // ?뚯꽦 ?덈꺼 遺꾩꽍 (媛쒖꽑??踰꾩쟾)
  const analyzeAudioLevel = useCallback((): number => {
    if (!analyserRef.current) return 0;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray); // 二쇳뙆??????쒓컙 ?꾨찓???ъ슜

    // ?됯퇏 蹂쇰ⅷ 怨꾩궛
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const amplitude = Math.abs(dataArray[i] - 128) / 128; // -1 ~ 1濡??뺢퇋??      sum += amplitude;
    }
    const average = sum / bufferLength;
    setVoiceLevel(average);


    return average;
  }, []);

  // 移⑤У 媛먯? 諛??먮룞 ?뱀쓬 以묒? (媛쒖꽑??踰꾩쟾)
  const handleVoiceActivity = useCallback(() => {
    // ?꾨컮?媛 留먰븯??以묒씠硫??뚯꽦 ?낅젰 臾댁떆
    if (isAvatarSpeaking) {
      // ?대? ?뱀쓬 以묒씠硫?以묒?
      if (isRecordingRef.current) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        isRecordingRef.current = false;
      }
      
      // 移⑤У ??대㉧??由ъ뀑
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      return; // ?꾨컮?媛 留먰븯???숈븞? ?뚯꽦 媛먯? 嫄대꼫?
    }
    
    const currentLevel = analyzeAudioLevel();
    
          if (currentLevel > silenceThreshold) {
      // ?뚯꽦 媛먯???- 移⑤У ??대㉧ 由ъ뀑
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      // ?꾩쭅 ?뱀쓬 以묒씠 ?꾨땲硫??뱀쓬 ?쒖옉
      if (isListeningRef.current && !isRecordingRef.current) {
        setIsRecording(true);
        isRecordingRef.current = true;
        recordingStartTimeRef.current = Date.now();
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
          audioChunksRef.current = [];
          try {
            mediaRecorderRef.current.start();
          } catch (error) {
            console.error('?뱀쓬 ?쒖옉 ?ㅽ뙣:', error);
          }
        }
      }
    } else if (isRecordingRef.current && currentLevel <= silenceThreshold) {
      // 移⑤У 媛먯???- 移⑤У ??대㉧ ?쒖옉
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          const recordingDuration = Date.now() - recordingStartTimeRef.current;
          
          // 理쒖냼 ?뱀쓬 ?쒓컙 泥댄겕
          if (recordingDuration >= minRecordingTime) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
          }
        }, silenceDuration);
      }
    }
  }, [silenceThreshold, silenceDuration, minRecordingTime, analyzeAudioLevel, isAvatarSpeaking]);

  // 由ъ뒪???쒖옉
  const startListening = useCallback(async () => {
    try {
      setError(null);
      setIsProcessing(false);
      
      // 留덉씠??沅뚰븳 ?붿껌 諛??ㅻ뵒???ㅽ듃由??띾뱷
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // AudioContext 諛?AnalyserNode ?ㅼ젙 (?뚯꽦 ?덈꺼 遺꾩꽍??
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      // MediaRecorder ?ㅼ젙
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        isRecordingRef.current = false;
        setIsProcessing(true);

        try {
          // ?ㅻ뵒??釉붾∼ ?앹꽦
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm;codecs=opus' 
          });

          // FormData濡??쒕쾭???꾩넚 (Gemini API ???ы븿)
          const geminiApiKey = localStorage.getItem('gemini_api_key_global') || '';
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice-recording.webm');
          formData.append('geminiApiKey', geminiApiKey);

          // ?뚯꽦 ?몄떇 API ?몄텧
          const response = await fetch('/api/speech/transcribe', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `?뚯꽦 ?몄떇 ?ㅽ뙣: ${response.status}`);
          }

          const result = await response.json();
          setTranscription(result.text || '?뚯꽦???몄떇?????놁뒿?덈떎.');
          
        } catch (err) {
          console.error('?렎 ?뚯꽦 ?몄떇 ?ㅻ쪟:', err);
          const msg = err instanceof Error ? err.message : '?뚯꽦 ?몄떇 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.';
          setError(msg);
          // ?먮윭 ?댁슜??transcription???ｌ뼱 UI???쒖떆
          setTranscription(`[?몄떇 ?ㅽ뙣: ${msg}]`);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      setIsListening(true);
      isListeningRef.current = true;

      // ?뚯꽦 ?쒕룞 媛먯? ?쒖옉 (100ms留덈떎 泥댄겕)
      vadIntervalRef.current = setInterval(handleVoiceActivity, 100);
      
    } catch (err) {
      console.error('由ъ뒪???쒖옉 ?ㅻ쪟:', err);
      setError(err instanceof Error ? err.message : '留덉씠???묎렐 沅뚰븳???꾩슂?⑸땲??');
      setIsProcessing(false);
    }
  }, [handleVoiceActivity]);

  // 由ъ뒪??以묒?
  const stopListening = useCallback(async () => {
    setIsListening(false);
    setIsRecording(false);
    isListeningRef.current = false;
    isRecordingRef.current = false;
    
    // ??대㉧???뺣━
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    // ?뱀쓬 以묒씠硫?以묒?
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // ?ㅽ듃由??뺣━
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // AudioContext ?뺣━
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setVoiceLevel(0);
  }, []);

  // 而댄룷?뚰듃 ?몃쭏?댄듃 ???뺣━
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const clearTranscription = useCallback(() => {
    setTranscription(null);
    setError(null);
  }, []);

  return {
    isListening,
    isRecording,
    isProcessing,
    error,
    transcription,
    voiceLevel,
    startListening,
    stopListening,
    clearTranscription
  };
}; 
