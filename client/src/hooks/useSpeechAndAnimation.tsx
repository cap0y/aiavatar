import { useCallback, useState, useRef, useEffect } from 'react';
import { Live2DModel } from 'pixi-live2d-display';
import { parseEmotionMessage } from '@/lib/utils';

interface SpeechAndAnimationOptions {
  model: Live2DModel | null;
  voice?: string;
  rate?: number;
  pitch?: number;
}

export const useSpeechAndAnimation = (model: Live2DModel | null) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const volumeDataRef = useRef<Float32Array | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 훅 생성 로그 제거 (성능 개선)

  // 오디오 컨텍스트와 분석기 초기화
  const initializeAudioAnalysis = useCallback(() => {
    if (audioContextRef.current) return;

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      volumeDataRef.current = new Float32Array(analyzerRef.current.frequencyBinCount);

      console.log('🎵 오디오 분석기 초기화 완료');
    } catch (error) {
      console.error('🎵 오디오 분석기 초기화 실패:', error);
    }
  }, []);

  // 주파수 대역별 에너지 계산 헬퍼 함수
  const calculateFrequencyEnergy = useCallback((frequencyData: Float32Array, startBin: number, endBin: number, totalBins: number): number => {
    const actualEnd = Math.min(endBin, totalBins);
    const actualStart = Math.min(startBin, actualEnd);

    if (actualStart >= actualEnd) return 0;

    let energy = 0;
    for (let i = actualStart; i < actualEnd; i++) {
      // dB를 리니어 값으로 변환: 10^(dB/20)
      const linearValue = Math.pow(10, frequencyData[i] / 20);
      energy += linearValue;
    }

    return energy / (actualEnd - actualStart); // 평균값 반환
  }, []);

  // 실시간 주파수 기반 비세임 선택 함수
  const selectVisemeFromFrequency = useCallback((frequencyData: Float32Array): { param: string; value: number; name: string } => {
    // 주파수 데이터가 유효한지 확인
    if (!frequencyData || frequencyData.length === 0) {
      return { param: 'ParamA', value: 0, name: '무음(주파수없음)' };
    }

    // 주파수 대역별로 에너지 계산 (dB를 리니어로 변환)
    const binCount = Math.min(frequencyData.length, 128); // 최대 128개 빈만 사용
    const lowFreq = calculateFrequencyEnergy(frequencyData, 0, 8, binCount);      // 저음 (50-200Hz)
    const midLowFreq = calculateFrequencyEnergy(frequencyData, 8, 24, binCount);  // 중저음 (200-600Hz) 
    const midFreq = calculateFrequencyEnergy(frequencyData, 24, 48, binCount);    // 중음 (600-1200Hz)
    const highFreq = calculateFrequencyEnergy(frequencyData, 48, 80, binCount);   // 고음 (1200-2000Hz)
    const veryHighFreq = calculateFrequencyEnergy(frequencyData, 80, binCount, binCount); // 초고음 (2000Hz+)

    // 전체 에너지 계산
    const totalEnergy = lowFreq + midLowFreq + midFreq + highFreq + veryHighFreq;
    const volume = Math.min(1, Math.max(0, totalEnergy * 10)); // 볼륨 민감도 더욱 증가 (5 → 10)

    // 디버깅 정보 (1% 확률로 출력 - 성능 개선)
    if (Math.random() < 0.01 && volume > 0.005) { // 무음 상태에서는 로그 안함 (임계값 맞춤)
      console.log('🔊 주파수 분석:', {
        총에너지: totalEnergy.toFixed(4),
        볼륨: volume.toFixed(3),
        저음: lowFreq.toFixed(3),
        중저음: midLowFreq.toFixed(3),
        중음: midFreq.toFixed(3),
        고음: highFreq.toFixed(3),
        초고음: veryHighFreq.toFixed(3)
      });
    }

    // 최소 볼륨 임계값 확인 (로그 없이) - 더 민감하게 조정
    if (volume < 0.005) { // 0.02에서 0.005로 대폭 낮춤
      return { param: 'ParamA', value: 0, name: '무음(임계값미만)' };
    }

    // 주파수 대역별 강도를 정규화
    if (totalEnergy < 0.001) {
      return { param: 'ParamA', value: volume, name: 'ㅏ(아)-기본' };
    }

    const lowRatio = lowFreq / totalEnergy;
    const midLowRatio = midLowFreq / totalEnergy;
    const midRatio = midFreq / totalEnergy;
    const highRatio = highFreq / totalEnergy;
    const veryHighRatio = veryHighFreq / totalEnergy;

    // 비세임 선택 로직 (한국어 음성학 기반)
    let selectedParam = 'ParamA';
    let selectedName = 'ㅏ(아)';
    let confidence = 0;

    // 각 비세임별 점수 계산 (더 민감하게 조정)
    const visemeScores = {
      ParamU: lowRatio * 3.0 + midLowRatio * 1.0, // ㅜ, ㅗ - 저음 강조 (더 민감)
      ParamO: lowRatio * 2.0 + midLowRatio * 2.5 + midRatio * 0.8, // ㅗ - 저음+중저음 (더 민감)
      ParamE: midRatio * 3.0 + highRatio * 2.0, // ㅔ, ㅐ - 중음+고음 (더 민감)
      ParamI: highRatio * 3.5 + veryHighRatio * 2.5, // ㅣ - 고음+초고음 (더 민감)
      ParamA: midLowRatio * 1.5 + midRatio * 1.5 + lowRatio * 0.5 // ㅏ - 범용성 증가
    };

    // 가장 높은 점수의 비세임 선택
    const maxScore = Math.max(...Object.values(visemeScores));
    if (maxScore > 0.1) { // 신뢰도 임계값 낮춤 (0.3 → 0.1)
      for (const [param, score] of Object.entries(visemeScores)) {
        if (score === maxScore) {
          selectedParam = param;
          confidence = score;

          switch (param) {
            case 'ParamU': selectedName = 'ㅜ(우)'; break;
            case 'ParamO': selectedName = 'ㅗ(오)'; break;
            case 'ParamE': selectedName = 'ㅔ(에)'; break;
            case 'ParamI': selectedName = 'ㅣ(이)'; break;
            default: selectedName = 'ㅏ(아)'; break;
          }
          break;
        }
      }
    }

    return {
      param: selectedParam,
      value: Math.min(1, volume * (1 + confidence)), // 신뢰도로 볼륨 보정
      name: selectedName
    };
  }, [calculateFrequencyEnergy]); // calculateFrequencyEnergy 함수를 의존성에 추가

  // mao 모델의 여러 비세임을 실시간으로 적용하는 함수
  const applyRealtimeViseme = useCallback((selectedViseme: { param: string; value: number; name: string }) => {
    if (!model) return;

    try {
      const internalModel = (model as any).internalModel;
      if (!internalModel?.coreModel) return;

      const coreModel = internalModel.coreModel;

      // 모든 비세임 파라미터를 0으로 초기화 (ParamMouthOpenY 포함)
      const allVisemes = ['ParamA', 'ParamO', 'ParamU', 'ParamE', 'ParamI', 'ParamMouthOpenY'];

      // ParamMouthOpenY 인덱스 찾기 (미리 찾아서 최적화)
      let mouthOpenYIndex = -1;
      try {
        if (coreModel.getParameterIndex) {
          mouthOpenYIndex = coreModel.getParameterIndex('ParamMouthOpenY');
        }
      } catch (e) { }

      for (const viseme of allVisemes) {
        try {
          let paramIndex = -1;
          if (coreModel.getParameterIndex) {
            paramIndex = coreModel.getParameterIndex(viseme);
          }

          if (paramIndex >= 0) {
            let value = 0;

            // 선택된 비세임이면 값 설정
            if (viseme === selectedViseme.param) {
              value = selectedViseme.value;
            }
            // ParamMouthOpenY는 선택된 비세임이 모음(ParamA 등)일 때도 같이 움직이도록 설정
            else if (viseme === 'ParamMouthOpenY' && selectedViseme.value > 0.01) {
              // 모음 파라미터가 활성화되면 ParamMouthOpenY도 같이 열어줌 (mao 모델 등 호환성)
              value = selectedViseme.value;
            }

            coreModel.setParameterValueByIndex(paramIndex, value);
          }
        } catch (error) {
          // 개별 파라미터 설정 실패 무시
        }
      }

      // 모델 업데이트
      if (coreModel.update) coreModel.update();
      if (model.update) model.update(0.016);

    } catch (error) {
      console.warn('실시간 비세임 적용 오류:', error);
    }
  }, [model]);

  // 실시간 오디오 볼륨 기반 입 애니메이션
  const animateMouthWithVolume = useCallback((isMoving: boolean) => {
    console.log('🎭 볼륨 기반 animateMouth 호출:', {
      isMoving,
      modelExists: !!model,
      modelType: model?.constructor?.name,
      hasAudioContext: !!audioContextRef.current,
      hasAnalyzer: !!analyzerRef.current
    });

    if (!model) {
      console.warn('🎭 모델이 없어서 입 애니메이션 실행 불가');
      return;
    }

    if (!(model as any)?.internalModel) {
      console.warn('🎭 internalModel이 없음 - 모델이 완전히 로드되지 않았을 수 있음');
      return;
    }

    try {
      const coreModel = (model as any).internalModel?.coreModel || (model as any).internalModel?._coreModel || (model as any)._coreModel;

      if (!coreModel) {
        console.warn('🎭 coreModel을 찾을 수 없음');
        return;
      }

      // 입 파라미터 찾기 (기존 코드와 동일)
      const allMouthParams = [
        // mao 모델의 실제 파라미터들을 최우선으로 배치
        'ParamA',              // mao 모델의 주요 립싱크 파라미터 (아)
        'ParamO',              // mao 모델의 립싱크 파라미터 (오)
        'ParamU',              // mao 모델의 립싱크 파라미터 (우)
        'ParamE',              // mao 모델의 립싱크 파라미터 (에) 
        'ParamI',              // mao 모델의 립싱크 파라미터 (이)
        'ParamMouthUp',        // mao 모델의 입꼬리 올림
        'ParamMouthDown',      // mao 모델의 입꼬리 처짐
        'ParamMouthAngry',     // mao 모델의 부은 입
        // 기존 범용 파라미터들 (백업용)
        'ParamMouthOpenY',     // 기본 Live2D 표준
        'ParamMouthOpen',      // 다른 변형
        'MouthOpenY',          // 짧은 버전
        'MouthOpen',           // 가장 간단한 버전
        'PARAM_MOUTH_OPEN_Y',  // 대문자 버전
        'PARAM_MOUTH_OPEN',    // 대문자 단순 버전
        'mouth_open_y',        // 소문자 스네이크 케이스
        'mouth_open',          // 소문자 단순
        'PARAM_A',             // 대문자 버전
        'ParamLipSync',        // 직접적인 립싱크
        'LipSync',             // 간단한 버전
        'param_mouth_open_y',  // 소문자 전체
        'ParamMouthY'          // Y축 입 열기
      ];

      let mouthOpenParam = -1;
      let usedParamName = '';
      let mouthParamMin = 0;  // mao 모델 파라미터 범위에 맞게 수정
      let mouthParamMax = 1;  // mao 모델 파라미터 범위에 맞게 수정

      for (const paramName of allMouthParams) {
        let paramIndex = -1;
        try {
          if (coreModel?.getParameterIndex) {
            paramIndex = coreModel.getParameterIndex(paramName);
          } else if (coreModel?.getParameterIndexById) {
            paramIndex = coreModel.getParameterIndexById(paramName);
          }
        } catch (error) {
          continue;
        }

        if (paramIndex !== undefined && paramIndex >= 0) {
          mouthOpenParam = paramIndex;
          usedParamName = paramName;

          // 파라미터 범위 조회
          try {
            if (coreModel.getParameterMinimumValueByIndex) {
              mouthParamMin = coreModel.getParameterMinimumValueByIndex(paramIndex);
              mouthParamMax = coreModel.getParameterMaximumValueByIndex(paramIndex);
            } else if (coreModel.getParameterMinValueByIndex) {
              mouthParamMin = coreModel.getParameterMinValueByIndex(paramIndex);
              mouthParamMax = coreModel.getParameterMaxValueByIndex(paramIndex);
            } else {
              mouthParamMin = 0; // mao 모델 파라미터 범위에 맞게 수정
              mouthParamMax = 1; // mao 모델 파라미터 범위에 맞게 수정
            }
          } catch (error) {
            mouthParamMin = 0; // mao 모델 파라미터 범위에 맞게 수정
            mouthParamMax = 1; // mao 모델 파라미터 범위에 맞게 수정
          }
          break;
        }
      }

      if (mouthOpenParam < 0) {
        console.warn('🎭 입 파라미터를 찾을 수 없음');
        return;
      }

      console.log('🎭 입 파라미터 확인:', {
        coreModelExists: !!coreModel,
        mouthOpenParam,
        usedParamName,
        paramFound: mouthOpenParam >= 0,
        paramRange: `${mouthParamMin} ~ ${mouthParamMax}`
      });

      if (isMoving) {
        let zeroVolumeFrameCount = 0;

        // 🎵 실시간 오디오 볼륨 기반 애니메이션
        const animate = () => {
          if (!isMoving || !animationFrameRef.current || !analyzerRef.current || !volumeDataRef.current) {
            return;
          }

          // 🔊 오디오 컨텍스트 및 분석기 설정 (중복 방지)
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            try {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              audioContextRef.current.resume(); // 사용자 제스처 후 활성화

              analyzerRef.current = audioContextRef.current.createAnalyser();
              // 주파수 분석 정확도 개선
              analyzerRef.current.fftSize = 512; // 더 세밀한 주파수 분석
              analyzerRef.current.smoothingTimeConstant = 0.3; // 빠른 반응
              analyzerRef.current.minDecibels = -90; // 넓은 동적 범위
              analyzerRef.current.maxDecibels = -10;

              volumeDataRef.current = new Float32Array(analyzerRef.current.frequencyBinCount);

              // 초기화 완료 로그는 한 번만 출력
              console.log('🔊 실시간 오디오 분석 초기화 완료 (최초)');
            } catch (error) {
              console.warn('🔊 오디오 컨텍스트 초기화 실패:', error);
              return;
            }
          }

          // 오디오 주파수 데이터 분석 (비세임 선택용)
          analyzerRef.current.getFloatFrequencyData(volumeDataRef.current as any);

          // 주파수 기반 비세임 선택
          let selectedViseme = selectVisemeFromFrequency(volumeDataRef.current as any);

          // 🚨 무음 감지 및 폴백 (CORS 문제 등으로 오디오 데이터가 0일 때)
          if (selectedViseme.value < 0.01) {
            zeroVolumeFrameCount++;
            // 약 0.2초(12프레임) 이상 무음이고 말하는 중이면 가짜 립싱크 생성
            if (zeroVolumeFrameCount > 12) {
              const time = Date.now() / 150; // 속도 조절
              // 사인파 기반으로 자연스러운 입 움직임 생성 (0.1 ~ 0.7 범위)
              const fakeValue = (Math.sin(time) * 0.5 + 0.5) * 0.6 + 0.1;

              // 랜덤하게 모음 변경 (조금 더 자연스럽게)
              const vowels = ['ParamA', 'ParamO', 'ParamE'];
              const randomVowel = vowels[Math.floor((Date.now() / 500) % vowels.length)];

              selectedViseme = {
                param: randomVowel,
                value: fakeValue,
                name: 'Simulated(Fallback)'
              };

              if (Math.random() < 0.05) {
                console.log('🎭 오디오 데이터 없음 - 시뮬레이션 립싱크 작동 중');
              }
            }
          } else {
            zeroVolumeFrameCount = 0; // 소리가 감지되면 카운터 리셋
          }

          // 선택된 비세임 적용
          applyRealtimeViseme(selectedViseme);

          // 1% 확률로 로그 (성능 개선, 무음 상태 제외)
          if (Math.random() < 0.01 && selectedViseme.value > 0.005) {
            console.log(`🎵 실시간 비세임: ${selectedViseme.name} (${selectedViseme.param}=${selectedViseme.value.toFixed(2)})`);
          }

          animationFrameRef.current = requestAnimationFrame(animate);
        };

        // 오디오 분석기가 준비되었으면 볼륨 기반 애니메이션 시작
        if (analyzerRef.current && volumeDataRef.current) {
          console.log('🎵 볼륨 기반 립싱크 시작');
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // 오디오 분석기가 없으면 백업 애니메이션 (다양한 비세임 순환)
          console.log('🎭 백업 애니메이션 시작 (다양한 비세임 순환)');
          let animationStep = 0;
          const visemeSequence = [
            { param: 'ParamA', name: 'ㅏ(아)' },
            { param: 'ParamO', name: 'ㅗ(오)' },
            { param: 'ParamE', name: 'ㅔ(에)' },
            { param: 'ParamI', name: 'ㅣ(이)' },
            { param: 'ParamU', name: 'ㅜ(우)' }
          ];

          const backupAnimate = () => {
            if (!isMoving || !animationFrameRef.current) return;

            animationStep += 0.1;
            const baseIntensity = Math.sin(animationStep) * 0.5 + 0.5; // 0~1 사이의 강도

            // 시간에 따라 비세임 순환 선택
            const visemeIndex = Math.floor((animationStep * 2) % visemeSequence.length);
            const currentViseme = visemeSequence[visemeIndex];

            // 선택된 비세임에 강도 적용
            const selectedViseme = {
              param: currentViseme.param,
              value: baseIntensity * 0.8, // 백업은 약간 약하게
              name: currentViseme.name + '-백업'
            };

            applyRealtimeViseme(selectedViseme);

            if (Math.floor(animationStep * 10) % 50 === 0) {
              console.log(`🎭 백업 비세임: ${selectedViseme.name} (강도: ${selectedViseme.value.toFixed(2)})`);
            }

            animationFrameRef.current = requestAnimationFrame(backupAnimate);
          };
          animationFrameRef.current = requestAnimationFrame(backupAnimate);
        }
      } else {
        // 입 닫기 - 모든 비세임 파라미터를 0으로 설정
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // 모든 비세임을 0으로 설정하여 입 닫기
        applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
        console.log('🎭 모든 비세임 닫기 완료');
      }
    } catch (error) {
      console.error('비세임 기반 animateMouth 오류:', error);
    }
  }, [model, selectVisemeFromFrequency, applyRealtimeViseme]);

  // 파라미터 캐시 (한 번 찾으면 저장하여 중복 탐색 방지)
  const mouthParamCache = useRef<{ index: number; name: string } | null>(null);

  // 모델 변경 시 캐시 초기화
  useEffect(() => {
    if (mouthParamCache.current) {
      console.log('🔄 모델 변경으로 파라미터 캐시 초기화');
      mouthParamCache.current = null;
    }
  }, [model]);

  // 특정 볼륨 값으로 입 움직임 설정 (볼륨 배열 기반 립싱크용)
  const animateMouthWithVolumeValue = useCallback((volume: number) => {
    if (!model) {
      console.warn('🎭 모델이 없어서 볼륨 기반 비세임 설정 불가');
      return;
    }

    // 간단한 볼륨 기반 비세임 적용 (기본적으로 ParamA 사용)
    const normalizedVolume = Math.max(0, Math.min(1, volume));

    if (normalizedVolume > 0) {
      // 볼륨이 있으면 기본 비세임(ParamA) 적용
      applyRealtimeViseme({
        param: 'ParamA',
        value: normalizedVolume,
        name: 'ㅏ(아)-볼륨'
      });
    } else {
      // 볼륨이 없으면 입 닫기
      applyRealtimeViseme({
        param: 'ParamA',
        value: 0,
        name: '무음'
      });
    }
  }, [model, applyRealtimeViseme]);

  // 볼륨 배열 기반 립싱크 재생
  const speakWithVolumeData = useCallback((audioUrl: string, volumes: number[]) => {
    console.log('🎵 볼륨 데이터 기반 TTS 재생:', {
      audioUrl: audioUrl.substring(0, 50) + '...',
      volumeCount: volumes.length,
      sampleVolumes: volumes.slice(0, 10)
    });

    try {
      const audio = new Audio(audioUrl);
      audio.crossOrigin = 'anonymous';
      setIsSpeaking(true);

      let volumeIndex = 0;
      // let intervalId: NodeJS.Timeout | null = null; // intervalRef 사용
      let audioContext: AudioContext | null = null;
      let analyzer: AnalyserNode | null = null;
      let source: MediaElementAudioSourceNode | null = null;

      // 실시간 오디오 분석 설정 (백업 및 보정용)
      const setupRealtimeAnalysis = async () => {
        try {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyzer = audioContext.createAnalyser();

          // 주파수 분석 정확도 개선
          analyzer.fftSize = 512; // 더 세밀한 주파수 분석 (256개 빈)
          analyzer.smoothingTimeConstant = 0.3; // 부드러운 변화 (0.8에서 낮춤)
          analyzer.minDecibels = -90; // 더 넓은 동적 범위
          analyzer.maxDecibels = -10;

          source = audioContext.createMediaElementSource(audio);
          source.connect(analyzer);
          analyzer.connect(audioContext.destination);

          console.log('🎵 하이브리드 오디오 분석 설정 완료');
        } catch (analysisError) {
          console.warn('실시간 오디오 분석 설정 실패:', analysisError);
          analyzer = null;
          audioContext = null;
        }
      };

      audio.oncanplay = () => {
        console.log('🎵 오디오 재생 준비 완료 - 립싱크 대기중');
        setupRealtimeAnalysis(); // 실시간 분석 준비
      };

      let indexScale = 1.0;

      audio.onloadedmetadata = () => {
        if (audio.duration && volumes.length > 0) {
          const audioDurationMs = audio.duration * 1000;
          const volumesDurationMs = volumes.length * 20;
          // 오디오 길이와 볼륨 데이터 길이가 다를 경우 스케일링 (싱크 보정)
          if (audioDurationMs > 0) {
            indexScale = volumesDurationMs / audioDurationMs;
            console.log(`🎵 싱크 보정 비율: ${indexScale.toFixed(3)} (Audio: ${audioDurationMs.toFixed(0)}ms, Volumes: ${volumesDurationMs}ms)`);
          }
        }
      };

      audio.onplay = () => {
        console.log('🎵 오디오 재생 시작 - 하이브리드 립싱크 동기화 시작');

        // 하이브리드 립싱크: 볼륨 데이터 + 실시간 분석
        let zeroVolumeFrameCount = 0; // 무음 프레임 카운터 (speakWithVolumeData용)
        let currentSmoothedValue = 0; // 부드러운 움직임을 위한 현재 값 저장

        // 기존 인터벌 정리
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
          let selectedViseme = { param: 'ParamA', value: 0, name: '무음' };

          // 오디오 현재 시간 기반으로 인덱스 계산 (20ms 단위 - 백엔드 설정과 일치)
          // indexScale을 적용하여 오디오 길이와 볼륨 데이터 길이를 맞춤
          const currentTimeMs = audio.currentTime * 1000;
          const calculatedIndex = Math.floor((currentTimeMs * indexScale) / 20);

          // 인덱스 업데이트 (시간 기반)
          volumeIndex = calculatedIndex;

          // 실시간 주파수 분석으로 비세임 종류 결정 (항상 실행)
          if (analyzer && audioContext) {
            const frequencyData = new Float32Array(analyzer.frequencyBinCount);
            analyzer.getFloatFrequencyData(frequencyData);

            // 주파수 기반 비세임 선택 (비세임 종류 결정)
            const frequencyBasedViseme = selectVisemeFromFrequency(frequencyData);

            // 볼륨 데이터로 강도 보정
            if (volumeIndex < volumes.length) {
              const volumeIntensity = volumes[volumeIndex];
              selectedViseme = {
                param: frequencyBasedViseme.param, // 주파수로 결정된 비세임 종류
                // 볼륨 데이터 대폭 증폭 (x3.0) 및 주파수 데이터 반영
                value: Math.max(volumeIntensity * 3.0, frequencyBasedViseme.value * 0.6),
                name: `${frequencyBasedViseme.name}-하이브리드`
              };
            } else {
              // 볼륨 데이터 없으면 순수 주파수 기반 (증폭)
              selectedViseme = {
                ...frequencyBasedViseme,
                value: frequencyBasedViseme.value * 2.0
              };
            }
          } else if (volumeIndex < volumes.length) {
            // 주파수 분석 없으면 볼륨 데이터만 (기존 방식, ParamA만 사용)
            const volumeData = volumes[volumeIndex];
            selectedViseme = { param: 'ParamA', value: volumeData * 3.0, name: 'ㅏ(아)-볼륨데이터' };
          }

          // 🚨 무음 감지 및 폴백 (speakWithVolumeData 내부용)
          // 임계값을 0.2로 유지
          if (selectedViseme.value < 0.2 && !audio.paused && !audio.ended) {
            zeroVolumeFrameCount++;
            // 약 0.05초(3프레임) 이상 무음이면 가짜 립싱크 생성 (반응성 높임)
            if (zeroVolumeFrameCount > 3) {
              const time = Date.now() / 300; // 속도 조절 (느리게 유지)
              // 사인파 기반으로 자연스러운 입 움직임 생성 (크게 움직이도록: 0.3 ~ 0.8)
              const fakeValue = (Math.sin(time) * 0.5 + 0.5) * 0.5 + 0.3;

              // 랜덤하게 모음 변경
              const vowels = ['ParamA', 'ParamO', 'ParamE'];
              const randomVowel = vowels[Math.floor((Date.now() / 1000) % vowels.length)];

              selectedViseme = {
                param: randomVowel,
                value: fakeValue,
                name: 'Simulated(Fallback-Volume)'
              };
            }
          } else {
            zeroVolumeFrameCount = 0;
          }

          // ✅ 최소 개방 보장 및 지속적인 움직임 강제 (정적 값 대신 동적 파동 사용)
          if (!audio.paused && !audio.ended) {
            // 시간이 지남에 따라 0.3 ~ 0.6 사이를 오가는 파동 생성
            const continuousMotionTime = Date.now() / 200;
            const dynamicMin = (Math.sin(continuousMotionTime) * 0.5 + 0.5) * 0.3 + 0.3;

            // 볼륨 데이터가 낮아도 이 동적 파동을 따라가게 하여 "계속 움직이는" 효과 연출
            selectedViseme.value = Math.max(selectedViseme.value, dynamicMin);
          }

          // 🌊 움직임 부드럽게 만들기 (Lerp: Linear Interpolation)
          // 목표 값으로 8%씩 이동하여 훨씬 더 부드럽고 천천히 (기존 15%에서 감소)
          const smoothingFactor = 0.08;
          currentSmoothedValue = currentSmoothedValue * (1 - smoothingFactor) + selectedViseme.value * smoothingFactor;

          // 부드러운 값 적용
          selectedViseme.value = currentSmoothedValue;

          // 선택된 비세임 적용
          applyRealtimeViseme(selectedViseme);

          // 1% 확률로 로그 (성능 개선, 무음 상태 제외)
          if (Math.random() < 0.01 && selectedViseme.value > 0.005) {
            console.log(`🔊 하이브리드 비세임: ${volumeIndex}/${volumes.length} (${selectedViseme.name}: ${selectedViseme.value.toFixed(3)})`);
          }

          // 오디오가 끝났는지 확인 (볼륨 데이터 인덱스 초과 및 오디오 종료 상태)
          if (audio.ended || (volumeIndex >= volumes.length + 50)) { // 여유 버퍼 늘림
            // 여기서 종료하지 않고 audio.onended에서 처리하도록 함 (안전장치)
          }
        }, 16); // 60fps 업데이트 주기는 유지하되, 데이터 샘플링은 시간 기반으로 함
      };

      audio.onended = () => {
        console.log('🎵 오디오 재생 완료');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // 하이브리드 립싱크 정리
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        if (source) {
          source.disconnect();
          source = null;
        }
        analyzer = null;

        // 약간의 지연 후 입 닫기 (자연스럽게)
        setTimeout(() => {
          // 모든 비세임을 0으로 설정하여 입 닫기
          applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
          setIsSpeaking(false);
        }, 200);
      };

      audio.onerror = (error) => {
        console.error('🎵 오디오 재생 오류:', error);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // 하이브리드 립싱크 정리
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        if (source) {
          source.disconnect();
          source = null;
        }
        analyzer = null;

        // 모든 비세임을 0으로 설정하여 입 닫기  
        applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
        setIsSpeaking(false);
      };

      // 오디오 재생 시작
      audio.play().catch(error => {
        console.error('🎵 오디오 재생 실패:', error);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        } animateMouthWithVolumeValue(0);
        setIsSpeaking(false);
      });

    } catch (error) {
      console.error('🎵 볼륨 기반 TTS 설정 오류:', error);
      // 모든 비세임을 0으로 설정하여 입 닫기
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
      setIsSpeaking(false);
    }
  }, [applyRealtimeViseme]);

  // TTS 말하기 기능 (볼륨 데이터 지원)
  const speak = useCallback((input: string, type: 'text' | 'audio' = 'text', volumes?: number[]) => {
    console.log('🎤 TTS 호출:', type, volumes ? `(${volumes.length}개 볼륨)` : '');

    // 기존 음성/애니메이션 중단 및 정리
    stopSpeaking();

    if (!input.trim()) {
      // 빈 입력 - 실행 안함 (로그 제거)
      return;
    }

    // 🎵 OpenAI TTS 오디오 재생
    if (type === 'audio') {
      // 1순위: 볼륨 데이터가 있으면 볼륨 기반 립싱크 사용
      if (volumes && volumes.length > 0) {
        console.log('🎵 볼륨 데이터 기반 재생 선택');
        speakWithVolumeData(input, volumes);
        return;
      }

      // 2순위: 볼륨 데이터가 없으면 실시간 분석 방식 (기존 방식)
      console.log('🎵 실시간 분석 재생 (볼륨 데이터 없음)');

      try {
        const audio = new Audio(input);
        audio.crossOrigin = 'anonymous';

        // 오디오 분석기 초기화
        initializeAudioAnalysis();

        // Web Audio API로 오디오 분석
        if (audioContextRef.current && analyzerRef.current) {
          const source = audioContextRef.current.createMediaElementSource(audio);
          source.connect(analyzerRef.current);
          analyzerRef.current.connect(audioContextRef.current.destination);

          console.log('🎵 실시간 오디오 분석 연결 완료');
        }

        setIsSpeaking(true);

        audio.onloadstart = () => {
          console.log('🎵 OpenAI TTS 오디오 로딩 시작');
        };

        audio.oncanplay = () => {
          console.log('🎵 OpenAI TTS 오디오 재생 가능');
          // 실시간 분석 모드로 다양한 비세임 적용
          animateMouthWithVolume(true);
        };

        audio.onplay = () => {
          console.log('🎵 OpenAI TTS 오디오 재생 시작');
        };

        audio.onended = () => {
          console.log('🎵 OpenAI TTS 오디오 재생 완료');
          // 모든 비세임을 0으로 설정하여 입 닫기
          applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
          setIsSpeaking(false);
        };

        audio.onerror = (error) => {
          console.error('🎵 OpenAI TTS 오디오 재생 오류:', error);
          // 모든 비세임을 0으로 설정하여 입 닫기
          applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
          setIsSpeaking(false);
        };

        // 오디오 재생 시작
        audio.play().catch(error => {
          console.error('🎵 오디오 재생 실패:', error);
          animateMouthWithVolume(false);
          setIsSpeaking(false);
        });

        return; // OpenAI TTS 재생시 여기서 종료

      } catch (error) {
        console.error('🎵 OpenAI TTS 설정 오류:', error);
        return;
      }
    }

    // 🎤 브라우저 TTS (백업 또는 텍스트 타입)
    console.log('🎤 브라우저 TTS 시작');

    const finalText = input.trim();

    // 감정 명령이 포함되어 있으면 제거 (안전장치)
    const { cleanText } = parseEmotionMessage(input);
    const finalTextForTTS = cleanText || finalText;

    // 오디오 분석기 초기화 (브라우저 TTS용)
    initializeAudioAnalysis();

    // TTS 권한 활성화
    if ('speechSynthesis' in window) {
      try {
        const testUtterance = new SpeechSynthesisUtterance('');
        testUtterance.volume = 0;
        window.speechSynthesis.speak(testUtterance);
        window.speechSynthesis.cancel();
        console.log('🎤 TTS 권한 활성화 완료');
      } catch (error) {
        console.warn('🎤 TTS 권한 활성화 실패:', error);
      }
    }

    const utterance = new SpeechSynthesisUtterance(finalTextForTTS);
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find(voice => voice.lang.includes('ko'));

    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;

    // 기존 이벤트 핸들러들 저장
    const originalOnEnd = utterance.onend;
    const originalOnError = utterance.onerror;

    setIsSpeaking(true);

    // 백업 애니메이션 타이머 (5초)
    const backupTimer = setTimeout(() => {
      if (!isSpeaking && utteranceRef.current === utterance) {
        console.log('⚠️ TTS가 5초 후에도 시작되지 않음 - 백업 애니메이션 실행');
        setIsSpeaking(true);
        animateMouthWithVolume(true);

        const duration = Math.min(finalText.length * 80, 8000);
        console.log(`🎭 백업 애니메이션 실행: ${duration}ms`);
        setTimeout(() => {
          console.log('🎭 백업 애니메이션 종료');
          setIsSpeaking(false);
          // 모든 비세임을 0으로 설정하여 입 닫기
          applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
        }, duration);
      } else {
        console.log('✅ TTS가 이미 시작되었으므로 백업 애니메이션 취소');
      }
    }, 5000);

    utterance.onstart = () => {
      console.log('🎤 TTS 음성 재생 시작:', finalText.substring(0, 30) + '...');
      clearTimeout(backupTimer);

      // 🎵 오디오 분석기와 TTS 연결 시도
      try {
        if (audioContextRef.current && analyzerRef.current) {
          // MediaElementSource를 통해 TTS 오디오와 연결 시도
          // 주의: TTS의 직접 연결은 브라우저 제약으로 어려울 수 있음
          console.log('🎵 TTS 오디오 분석 연결 시도');
        }
      } catch (error) {
        console.warn('🎵 TTS 오디오 분석 연결 실패:', error);
      }

      console.log('🎭 볼륨 기반 입 애니메이션 시작 호출 (true)');
      // 실시간 분석 모드로 다양한 비세임 적용
      animateMouthWithVolume(true);
    };

    utterance.onend = (event) => {
      console.log('🎤 TTS 음성 재생 완료');
      console.log('🎭 모든 비세임 닫기 호출');
      // 모든 비세임을 0으로 설정하여 입 닫기
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
      setIsSpeaking(false);
      clearTimeout(backupTimer);
      if (originalOnEnd) originalOnEnd.call(utterance, event);
    };

    utterance.onerror = (event) => {
      console.error('🎤 TTS 오류:', event.error, event);
      if (event.error === 'interrupted' || event.error === 'canceled') {
        console.log('🎤 TTS 중단됨 - 계속 진행');
        return;
      }
      setIsSpeaking(false);
      console.log('🎭 TTS 오류로 모든 비세임 닫기');
      // 모든 비세임을 0으로 설정하여 입 닫기
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
      clearTimeout(backupTimer);
      if (originalOnError) originalOnError.call(utterance, event);
    };

    utteranceRef.current = utterance;

    console.log('🎤 TTS 재생 명령 전송 시작:', {
      text: finalText.substring(0, 30) + '...',
      voice: utterance.voice?.name || 'default',
      rate: utterance.rate,
      pitch: utterance.pitch,
      volume: utterance.volume
    });

    try {
      window.speechSynthesis.speak(utterance);
      console.log('🎤 speechSynthesis.speak() 호출 완료');
    } catch (error) {
      console.error('🎤 speechSynthesis.speak() 호출 실패:', error);
      setIsSpeaking(false);
      // 모든 비세임을 0으로 설정하여 입 닫기
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
    }
  }, [model, isSpeaking, animateMouthWithVolume, initializeAudioAnalysis, applyRealtimeViseme, speakWithVolumeData]);

  // 음성 중지
  const stopSpeaking = useCallback(() => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }

    setIsSpeaking(false);
    // 모든 비세임을 0으로 설정하여 입 닫기
    applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [applyRealtimeViseme]);

  // 정리
  const cleanup = useCallback(() => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyzerRef.current = null;
      volumeDataRef.current = null;
    }

    // 모든 비세임을 0으로 설정하여 입 닫기
    if (model) {
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '무음' });
    }

    setIsSpeaking(false);
    console.log('🎤 TTS 및 오디오 분석 정리 완료');
  }, [model, applyRealtimeViseme]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 훅 반환 로그 제거 (성능 개선)

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    cleanup
  };
}; 