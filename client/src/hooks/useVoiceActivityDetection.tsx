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
  silenceThreshold: number = 0.01, // 침묵 임계값
  silenceDuration: number = 2000,  // 침묵 지속 시간 (ms)
  minRecordingTime: number = 1000,  // 최소 녹음 시간 (ms)
  isAvatarSpeaking: boolean = false // 아바타가 말하고 있는지 여부
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
  
  // 실시간 상태 추적용 Refs
  const isListeningRef = useRef(false);
  const isRecordingRef = useRef(false);

  // 음성 레벨 분석 (개선된 버전)
  const analyzeAudioLevel = useCallback((): number => {
    if (!analyserRef.current) return 0;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray); // 주파수 대신 시간 도메인 사용

    // 평균 볼륨 계산
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const amplitude = Math.abs(dataArray[i] - 128) / 128; // -1 ~ 1로 정규화
      sum += amplitude;
    }
    const average = sum / bufferLength;
    setVoiceLevel(average);


    return average;
  }, []);

  // 침묵 감지 및 자동 녹음 중지 (개선된 버전)
  const handleVoiceActivity = useCallback(() => {
    // 아바타가 말하는 중이면 음성 입력 무시
    if (isAvatarSpeaking) {
      // 이미 녹음 중이면 중지
      if (isRecordingRef.current) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        isRecordingRef.current = false;
      }
      
      // 침묵 타이머도 리셋
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      return; // 아바타가 말하는 동안은 음성 감지 건너뜀
    }
    
    const currentLevel = analyzeAudioLevel();
    
          if (currentLevel > silenceThreshold) {
      // 음성 감지됨 - 침묵 타이머 리셋
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      // 아직 녹음 중이 아니면 녹음 시작
      if (isListeningRef.current && !isRecordingRef.current) {
        setIsRecording(true);
        isRecordingRef.current = true;
        recordingStartTimeRef.current = Date.now();
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
          audioChunksRef.current = [];
          try {
            mediaRecorderRef.current.start();
          } catch (error) {
            console.error('녹음 시작 실패:', error);
          }
        }
      }
    } else if (isRecordingRef.current && currentLevel <= silenceThreshold) {
      // 침묵 감지됨 - 침묵 타이머 시작
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          const recordingDuration = Date.now() - recordingStartTimeRef.current;
          
          // 최소 녹음 시간 체크
          if (recordingDuration >= minRecordingTime) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
          }
        }, silenceDuration);
      }
    }
  }, [silenceThreshold, silenceDuration, minRecordingTime, analyzeAudioLevel, isAvatarSpeaking]);

  // 리스닝 시작
  const startListening = useCallback(async () => {
    try {
      setError(null);
      setIsProcessing(false);
      
      // 마이크 권한 요청 및 오디오 스트림 획득
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

      // AudioContext 및 AnalyserNode 설정 (음성 레벨 분석용)
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      // MediaRecorder 설정
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
          // 오디오 블롭 생성
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm;codecs=opus' 
          });

          // FormData로 서버에 전송
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice-recording.webm');

          // 음성 인식 API 호출
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
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      setIsListening(true);
      isListeningRef.current = true;

      // 음성 활동 감지 시작 (100ms마다 체크)
      vadIntervalRef.current = setInterval(handleVoiceActivity, 100);
      
    } catch (err) {
      console.error('리스닝 시작 오류:', err);
      setError(err instanceof Error ? err.message : '마이크 접근 권한이 필요합니다.');
      setIsProcessing(false);
    }
  }, [handleVoiceActivity]);

  // 리스닝 중지
  const stopListening = useCallback(async () => {
    setIsListening(false);
    setIsRecording(false);
    isListeningRef.current = false;
    isRecordingRef.current = false;
    
    // 타이머들 정리
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    // 녹음 중이면 중지
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // 스트림 정리
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // AudioContext 정리
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setVoiceLevel(0);
  }, []);

  // 컴포넌트 언마운트 시 정리
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