import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import { useSpeechAndAnimation } from '@/hooks/useSpeechAndAnimation';
import { useMotionCapture, type TrackingMode } from '@/hooks/useMotionCapture';

// PIXI를 글로벌로 설정 (pixi-live2d-display 필요)
if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI;
  console.log('🔧 PIXI global 설정됨 (pixi-live2d-display):', !!(window as any).PIXI);
}

// Live2D 모델 정보 타입 정의
interface ModelInfo {
  name: string;
  description: string;
  url: string;
  kScale?: number;
  initialXshift?: number;
  initialYshift?: number;
  kXOffset?: number;
  idleMotionGroupName?: string;
  emotionMap?: { [emotion: string]: number };
  tapMotions?: { [area: string]: any };
}

interface Live2DAvatarPixiProps {
  modelName?: string;
  width?: number;
  height?: number;
  className?: string;
  onLoaded?: (model: Live2DModel) => void;
  onError?: (error: Error) => void;
  emotion?: string;
  autoplay?: boolean;
  onSpeakReady?: (speakFn: (text: string) => void) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

// 모델 정의 로드 함수
const fetchModelDefinitions = async (): Promise<{ [key: string]: ModelInfo }> => {
  try {
    // 1. 서버 API로 모든 모델 자동 감지 (우선순위)
    try {
      console.log('🔍 서버에서 모델 목록 자동 스캔 중...');
      const apiResponse = await fetch('/api/model-editor/scan-models');

      if (apiResponse.ok) {
        const modelArray = await apiResponse.json();
        const modelDefinitions: { [key: string]: ModelInfo } = {};

        modelArray.forEach((model: any) => {
          modelDefinitions[model.name] = {
            name: model.name,
            description: model.description || `${model.name} Character`,
            url: model.url,
            kScale: model.kScale || 0.5,
            initialXshift: model.initialXshift || 0.15,
            initialYshift: model.initialYshift || 0,
            kXOffset: model.kXOffset || 0,
            idleMotionGroupName: model.idleMotionGroupName || 'Idle',
            emotionMap: model.emotionMap || {},
            tapMotions: model.tapMotions || {}
          };
        });

        console.log('✅ pixi-live2d-display 모델 정의 로드 완료 (API):', Object.keys(modelDefinitions));
        return modelDefinitions;
      }
    } catch (apiError) {
      console.warn('⚠️ API 모델 로드 실패, model_dict.json 시도 중...', apiError);
    }

    // 2. 폴백: model_dict.json 파일
    const response = await fetch('/model_dict.json');
    if (!response.ok) {
      throw new Error('Model definitions not found');
    }

    const modelArray = await response.json();
    const modelDefinitions: { [key: string]: ModelInfo } = {};

    modelArray.forEach((model: any) => {
      modelDefinitions[model.name] = {
        name: model.name,
        description: model.description || `${model.name} Character`,
        url: model.url,
        kScale: model.kScale || 0.8,
        initialXshift: model.initialXshift || 0,
        initialYshift: model.initialYshift || -0.2,
        kXOffset: model.kXOffset || 0,
        idleMotionGroupName: model.idleMotionGroupName || 'Idle',
        emotionMap: model.emotionMap || {},
        tapMotions: model.tapMotions || {}
      };
    });

    console.log('✅ pixi-live2d-display 모델 정의 로드 완료 (JSON):', Object.keys(modelDefinitions));
    return modelDefinitions;

  } catch (error) {
    console.error('❌ 모델 정의 로드 실패:', error);
    // 최후 폴백: 기본 모델 정의
    return {
      'mao': {
        name: 'mao',
        description: 'Mao Character',
        url: '/live2d-models/mao/runtime/mao_pro.model3.json',
        kScale: 0.8,
        initialXshift: 0,
        initialYshift: -0.2,
        kXOffset: 0,
        idleMotionGroupName: 'Idle',
        emotionMap: {},
        tapMotions: {}
      }
    };
  }
};

const Live2DAvatarPixi: React.FC<Live2DAvatarPixiProps> = ({
  modelName = '',
  width = 600,
  height = 750,
  className = '',
  onLoaded,
  onError,
  emotion = 'neutral',
  autoplay = true,
  onSpeakReady,
  onSpeakingChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const live2dModelRef = useRef<Live2DModel | null>(null);
  const webglContextListenersRef = useRef<{
    canvas: HTMLCanvasElement | null;
    contextLost: EventListener | null;
    contextRestored: EventListener | null;
  }>({ canvas: null, contextLost: null, contextRestored: null });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [selectedModel, setSelectedModel] = useState(modelName || ''); // 빈 문자열을 기본값으로
  const [modelDefinitions, setModelDefinitions] = useState<{ [key: string]: ModelInfo }>({});
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastInitializedModel, setLastInitializedModel] = useState<string | null>(null);
  const [isUserAvatarActive, setIsUserAvatarActive] = useState(false); // 개인 아바타 활성 상태

  // 인터랙션 상태
  const [isDragging, setIsDragging] = useState(false);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [modelPosition, setModelPosition] = useState({ x: 0, y: 0 });
  const [modelScale, setModelScale] = useState(1);
  const [windowPosition, setWindowPosition] = useState({ x: 20, y: 80 });
  const [isTTSReady, setIsTTSReady] = useState(false); // TTS 준비 상태 추가
  const [isMotionCaptureEnabled, setIsMotionCaptureEnabled] = useState(false); // 모션 캡처 활성화
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('face'); // 추적 모드
  const [showModeSelector, setShowModeSelector] = useState(false); // 모드 선택 메뉴

  // TTS와 입 움직임 애니메이션
  const { speak, stopSpeaking, isSpeaking, cleanup } = useSpeechAndAnimation(live2dModelRef.current);

  // 전신 모션 캡처 (얼굴 + 신체 + 손)
  const {
    facePose,
    bodyPose,
    handPose,
    isReady: isTrackingReady,
    error: trackingError,
    initStatus,
    videoRef,
  } = useMotionCapture(isMotionCaptureEnabled, trackingMode);

  // 부드러운 보간을 위한 이전 값 ref
  const prevBodyRef = useRef<{
    bodyAngleX: number; bodyAngleY: number; bodyAngleZ: number;
    armL: number; armR: number;
  }>({ bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0, armL: 0, armR: 0 });

  // 보간 유틸 (부드러운 전환)
  const lerp = (current: number, target: number, factor: number) =>
    current + (target - current) * factor;

  // ===== 얼굴 모션 캡처 데이터를 Live2D 모델에 적용 =====
  useEffect(() => {
    if (!isMotionCaptureEnabled || !facePose || !live2dModelRef.current) return;

    const model = live2dModelRef.current as any;
    if (!model.internalModel) return;

    try {
      const core = model.internalModel.coreModel;

      // 머리 회전
      core.setParameterValueById('ParamAngleX', facePose.head.x * 30);
      core.setParameterValueById('ParamAngleY', facePose.head.y * 30);
      core.setParameterValueById('ParamAngleZ', facePose.head.z * 30);

      // 눈 깜빡임
      core.setParameterValueById('ParamEyeLOpen', facePose.eye.l);
      core.setParameterValueById('ParamEyeROpen', facePose.eye.r);

      // 눈동자
      core.setParameterValueById('ParamEyeBallX', facePose.pupil.x);
      core.setParameterValueById('ParamEyeBallY', facePose.pupil.y);

      // 눈썹
      core.setParameterValueById('ParamBrowLY', facePose.brow);
      core.setParameterValueById('ParamBrowRY', facePose.brow);

      // 입 모양 (TTS 말하는 중이 아닐 때만)
      if (!isSpeaking) {
        core.setParameterValueById('ParamMouthOpenY', facePose.mouth.y);
        core.setParameterValueById('ParamMouthForm', facePose.mouth.x);
        // 모음 형태
        core.setParameterValueById('ParamMouthA', facePose.mouth.shape.A);
        core.setParameterValueById('ParamMouthI', facePose.mouth.shape.I);
        core.setParameterValueById('ParamMouthU', facePose.mouth.shape.U);
        core.setParameterValueById('ParamMouthE', facePose.mouth.shape.E);
        core.setParameterValueById('ParamMouthO', facePose.mouth.shape.O);
      }
    } catch (err) {
      // 파라미터가 없는 모델에서는 무시
    }
  }, [facePose, isMotionCaptureEnabled, isSpeaking]);

  // ===== 신체 모션 캡처 데이터를 Live2D 모델에 적용 =====
  useEffect(() => {
    if (!isMotionCaptureEnabled || !bodyPose || !live2dModelRef.current) return;
    if (trackingMode === 'face') return;

    const model = live2dModelRef.current as any;
    if (!model.internalModel) return;

    try {
      const core = model.internalModel.coreModel;
      const prev = prevBodyRef.current;
      const smoothing = 0.4; // 보간 팩터 (낮을수록 부드러움)

      // --- 몸통 회전 ---
      // Kalidokit Spine은 라디안이므로 도(degree)로 변환 후 적절한 범위로 매핑
      const bodyAngleX = lerp(prev.bodyAngleX, bodyPose.spine.x * 15, smoothing);
      const bodyAngleY = lerp(prev.bodyAngleY, bodyPose.spine.y * 15, smoothing);
      const bodyAngleZ = lerp(prev.bodyAngleZ, bodyPose.spine.z * 15, smoothing);

      core.setParameterValueById('ParamBodyAngleX', bodyAngleX);
      core.setParameterValueById('ParamBodyAngleY', bodyAngleY);
      core.setParameterValueById('ParamBodyAngleZ', bodyAngleZ);

      // --- 팔 ---
      // 상완 Y축 회전으로 팔 올림/내림 매핑 (라디안 → 0~1 범위)
      // 팔을 내리면 ~0, 올리면 ~1
      const leftArmRaw = Math.max(0, Math.min(1, (bodyPose.leftUpperArm.y + 1) / 2));
      const rightArmRaw = Math.max(0, Math.min(1, (bodyPose.rightUpperArm.y + 1) / 2));

      const armL = lerp(prev.armL, leftArmRaw, smoothing);
      const armR = lerp(prev.armR, rightArmRaw, smoothing);

      core.setParameterValueById('ParamArmLA', armL);
      core.setParameterValueById('ParamArmRA', armR);

      // 보조 팔 파라미터 (모델에 있는 경우)
      const leftLowerArmAngle = Math.max(0, Math.min(1, (bodyPose.leftLowerArm.y + 1) / 2));
      const rightLowerArmAngle = Math.max(0, Math.min(1, (bodyPose.rightLowerArm.y + 1) / 2));
      core.setParameterValueById('ParamArmLB', leftLowerArmAngle);
      core.setParameterValueById('ParamArmRB', rightLowerArmAngle);

      // --- 손 위치 (포즈 기반) ---
      core.setParameterValueById('ParamHandL', bodyPose.leftHand.y);
      core.setParameterValueById('ParamHandR', bodyPose.rightHand.y);

      // 이전 값 업데이트
      prevBodyRef.current = { bodyAngleX, bodyAngleY, bodyAngleZ, armL, armR };
    } catch (err) {
      // 파라미터가 없는 모델에서는 무시
    }
  }, [bodyPose, isMotionCaptureEnabled, trackingMode]);

  // ===== 손 상세 모션 캡처 데이터를 Live2D 모델에 적용 =====
  useEffect(() => {
    if (!isMotionCaptureEnabled || !handPose || !live2dModelRef.current) return;
    if (trackingMode !== 'full-body') return;

    const model = live2dModelRef.current as any;
    if (!model.internalModel) return;

    try {
      const core = model.internalModel.coreModel;

      // 왼손 손가락 curl (모델에 파라미터가 있는 경우)
      if (handPose.left) {
        core.setParameterValueById('ParamHandLThumb', handPose.left.thumb);
        core.setParameterValueById('ParamHandLIndex', handPose.left.index);
        core.setParameterValueById('ParamHandLMiddle', handPose.left.middle);
        core.setParameterValueById('ParamHandLRing', handPose.left.ring);
        core.setParameterValueById('ParamHandLLittle', handPose.left.little);
        // 손목 회전
        core.setParameterValueById('ParamWristL', handPose.left.wrist.z);
      }

      // 오른손 손가락 curl
      if (handPose.right) {
        core.setParameterValueById('ParamHandRThumb', handPose.right.thumb);
        core.setParameterValueById('ParamHandRIndex', handPose.right.index);
        core.setParameterValueById('ParamHandRMiddle', handPose.right.middle);
        core.setParameterValueById('ParamHandRRing', handPose.right.ring);
        core.setParameterValueById('ParamHandRLittle', handPose.right.little);
        // 손목 회전
        core.setParameterValueById('ParamWristR', handPose.right.wrist.z);
      }
    } catch (err) {
      // 파라미터가 없는 모델에서는 무시
    }
  }, [handPose, isMotionCaptureEnabled, trackingMode]);
  //   console.log('🎭 Live2DAvatarPixi 렌더링:', { selectedModel, isLoading, error, isInitializing, lastInitializedModel, isSpeaking });

  // 감정을 Live2D 모델에 적용하는 함수 (Expression + Motion 시스템)
  const applyEmotionToModel = useCallback((live2dModel: any, emotionState: string) => {
    if (!live2dModel) return;

    try {
      // 감정 키워드 매칭 (소문자로 통일)
      const emotion = emotionState.toLowerCase();

      // 유사 감정 매핑 (Expression 이름에 맞춤)
      const emotionMappings: Record<string, string> = {
        'happy': 'joy',
        'smile': 'joy',
        'smirk': 'smirk',
        'sad': 'sadness',
        'cry': 'sadness',
        'angry': 'anger',
        'mad': 'anger',
        'surprised': 'surprise',
        'fear': 'surprise',
        'disgust': 'anger'
      };

      // 최종 감정 결정
      let finalEmotion = emotion;
      if (emotionMappings[emotion]) {
        finalEmotion = emotionMappings[emotion];
      }

      console.log('🎭 감정 처리:', {
        originalEmotion: emotionState,
        processedEmotion: finalEmotion,
        modelName: selectedModel
      });

      // 1. Expression 적용 (이름으로 직접)
      if (live2dModel.internalModel?.motionManager?.expressionManager) {
        const expressionManager = live2dModel.internalModel.motionManager.expressionManager;

        try {
          // Expression을 이름으로 설정 (더 정확함)
          if (expressionManager.setExpressionByName) {
            expressionManager.setExpressionByName(finalEmotion);
            console.log('✅ Expression 이름으로 설정:', finalEmotion);
          } else if (expressionManager.startMotion && live2dModel.internalModel?.settings?.expressions) {
            // 백업: Expression 파일을 직접 찾아서 설정
            const expressions = live2dModel.internalModel.settings.expressions;
            const expressionIndex = expressions.findIndex((exp: any) =>
              exp.Name?.toLowerCase() === finalEmotion ||
              exp.name?.toLowerCase() === finalEmotion
            );

            if (expressionIndex >= 0) {
              expressionManager.setExpression(expressionIndex);
              console.log('✅ Expression 인덱스로 설정:', expressionIndex, finalEmotion);
            } else {
              console.warn('⚠️ Expression을 찾을 수 없음:', finalEmotion);
            }
          }
        } catch (expError) {
          console.warn('Expression 설정 오류:', expError);
        }
      }

      // 2. Motion 재생 (감정에 따른 애니메이션)
      if (live2dModel.internalModel?.motionManager) {
        const motionManager = live2dModel.internalModel.motionManager;

        try {
          // 감정별 Motion 그룹 및 인덱스 선택
          let motionGroup = '';
          let motionIndex = 0;

          switch (finalEmotion) {
            case 'joy':
            case 'surprise':
              // 활발한 감정 - 특별한 모션들
              motionGroup = '';
              motionIndex = Math.floor(Math.random() * 3) + 1; // mtn_02, mtn_03, mtn_04
              break;
            case 'sadness':
            case 'anger':
              // 강한 감정 - 특수 모션들
              motionGroup = '';
              motionIndex = Math.floor(Math.random() * 3) + 4; // special_01, special_02, special_03
              break;
            default:
              // 기본 모션
              motionGroup = 'Idle';
              motionIndex = 0;
          }

          // Motion 재생
          if (motionManager.startMotion) {
            const motionPromise = motionManager.startMotion(motionGroup, motionIndex, 3); // priority 3
            console.log('🎬 Motion 시작:', {
              group: motionGroup,
              index: motionIndex,
              emotion: finalEmotion
            });

            // Motion 완료 후 처리 (optional)
            if (motionPromise && typeof motionPromise.then === 'function') {
              motionPromise.then(() => {
                console.log('🎬 Motion 완료:', finalEmotion);
              }).catch((motionError: any) => {
                console.warn('Motion 재생 오류:', motionError);
              });
            }
          }
        } catch (motionError) {
          console.warn('Motion 재생 오류:', motionError);
        }
      }

    } catch (error) {
      console.warn('감정 적용 중 전체 오류:', error);
    }
  }, [selectedModel]);

  // 인터랙션 핸들러들 (마우스 + 터치)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // 왼쪽 클릭
      // Shift 클릭으로 감정 + TTS 테스트
      if (e.shiftKey) {
        e.preventDefault();
        const testEmotions = [
          { emotion: 'joy', text: '[joy] 안녕하세요! 저는 기쁜 AI 아바타입니다!' },
          { emotion: 'sadness', text: '[sadness] 오늘은 조금 슬픈 기분이에요...' },
          { emotion: 'anger', text: '[anger] 화가 나는 일이 있었어요!' },
          { emotion: 'surprise', text: '[surprise] 와! 정말 놀라워요!' },
          { emotion: 'neutral', text: '[neutral] 평상시 모습으로 인사드려요.' }
        ];
        const randomTest = testEmotions[Math.floor(Math.random() * testEmotions.length)];

        console.log('감정 + TTS 테스트 실행:', randomTest);

        // 감정 적용 (MainContent로 전달)
        if (live2dModelRef.current) {
          applyEmotionToModel(live2dModelRef.current, randomTest.emotion);
        }

        // TTS 실행 (감정 명령 포함된 텍스트)
        speak(randomTest.text);
        return;
      }

      setIsDragging(true);
      setDragStart({ x: e.clientX - modelPosition.x, y: e.clientY - modelPosition.y });
    }
  }, [modelPosition, speak]);

  // 터치 이벤트 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // 단일 터치 - 드래그
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - modelPosition.x, y: touch.clientY - modelPosition.y });
    } else if (e.touches.length === 2) {
      // 두 손가락 터치 - 확대/축소 준비
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      setDragStart({ x: distance, y: modelScale });
    }
  }, [modelPosition, modelScale]);

  const handleWindowMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // 왼쪽 클릭
      setIsWindowDragging(true);
      setDragStart({ x: e.clientX - windowPosition.x, y: e.clientY - windowPosition.y });
    }
  }, [windowPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setModelPosition({ x: newX, y: newY });

      // Live2D 모델 위치 업데이트
      if (live2dModelRef.current) {
        live2dModelRef.current.x = width / 2 + newX;
        live2dModelRef.current.y = height * 0.9 + newY;
      }
    }

    if (isWindowDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setWindowPosition({ x: newX, y: newY });
    }
  }, [isDragging, isWindowDragging, dragStart, width, height]);

  // 터치 이동 핸들러
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      // 단일 터치 드래그
      const touch = e.touches[0];
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;
      setModelPosition({ x: newX, y: newY });

      // Live2D 모델 위치 업데이트
      if (live2dModelRef.current) {
        live2dModelRef.current.x = width / 2 + newX;
        live2dModelRef.current.y = height * 0.9 + newY;
      }
    } else if (e.touches.length === 2) {
      // 두 손가락 핀치 줌
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      const initialDistance = dragStart.x;
      const initialScale = dragStart.y;
      const scaleRatio = currentDistance / initialDistance;
      const newScale = Math.max(0.1, Math.min(3, initialScale * scaleRatio));

      setModelScale(newScale);

      // Live2D 모델 스케일 업데이트
      if (live2dModelRef.current) {
        let baseScale;
        switch (selectedModel) {
          case 'mao':
            baseScale = 0.08;
            break;
          case 'ichika':
            baseScale = 0.18;
            break;
          default:
            baseScale = 0.14;
        }
        live2dModelRef.current.scale.set(newScale * baseScale);
      }
    }
  }, [isDragging, dragStart, width, height, selectedModel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsWindowDragging(false);
  }, []);

  // 터치 종료 핸들러
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsWindowDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1; // 휠 방향에 따라 축소/확대
    const newScale = Math.max(0.1, Math.min(3, modelScale * delta)); // 0.1 ~ 3 배 제한
    setModelScale(newScale);

    // Live2D 모델 스케일 업데이트 (모델별 기본 스케일 고려)
    if (live2dModelRef.current) {
      let baseScale;
      switch (selectedModel) {
        case 'mao':
          baseScale = 0.08;
          break;
        case 'ichika':
          baseScale = 0.18;
          break;
        default:
          baseScale = 0.14;
      }
      live2dModelRef.current.scale.set(newScale * baseScale);
    }
  }, [modelScale, selectedModel]);

  // 전역 마우스 및 터치 이벤트 리스너 설정
  useEffect(() => {
    if (isDragging || isWindowDragging) {
      // 마우스 이벤트
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // 터치 이벤트
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        // 마우스 이벤트 제거
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // 터치 이벤트 제거
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [isDragging, isWindowDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // PIXI.js + pixi-live2d-display 초기화
  const initializeLive2D = useCallback(async () => {
    // 이미 초기화 중이면 중복 실행 방지 (isLoading은 UI 상태용이므로 제외)
    if (isInitializing) {
      console.log('⏸️ 이미 초기화 중입니다. 중복 실행을 방지합니다.');
      return;
    }

    // console.log('🎬 pixi-live2d-display 초기화 시작...', {
    //   isInitializing,
    //   isLoading,
    //   selectedModel,
    //   containerExists: !!containerRef.current,
    //   modelExists: !!modelDefinitions[selectedModel]
    // });

    try {
      setIsInitializing(true);
      setIsLoading(true);
      setError(null);

      console.log('🎨 모델 초기화 시작:', {
        selectedModel,
        availableModels: Object.keys(modelDefinitions),
        hasModel: !!modelDefinitions[selectedModel]
      });

      const model = modelDefinitions[selectedModel];
      if (!model) {
        console.error('❌ 모델을 찾을 수 없음:', {
          selectedModel,
          availableModels: Object.keys(modelDefinitions)
        });
        throw new Error(`Model "${selectedModel}" not found`);
      }

      console.log('✅ 모델 정의 찾음:', {
        name: model.name,
        url: model.url,
        description: model.description
      });

      setModelInfo(model);

      const container = containerRef.current;
      if (!container) {
        throw new Error('Container element not found');
      }

      // 1. 기존 Live2D 모델 먼저 정리 (PIXI 앱보다 먼저)
      if (live2dModelRef.current) {
        try {
          const model = live2dModelRef.current;

          // 부모에서 제거
          if (model.parent) {
            model.parent.removeChild(model);
          }

          // 모델 완전 파괴
          model.destroy({ children: true, texture: true, baseTexture: true });

          console.log('✅ Live2D 모델 정리 완료');
        } catch (e) {
          console.warn('⚠️ Live2D 모델 정리 중 오류 (무시됨):', e);
        }
        live2dModelRef.current = null;
      }

      // 2. 기존 PIXI 앱 완전 정리 (WebGL 컨텍스트 포함)
      if (pixiAppRef.current) {
        try {
          const app = pixiAppRef.current;

          // WebGL 컨텍스트 이벤트 리스너 먼저 제거 (중요!)
          if (webglContextListenersRef.current.canvas &&
            webglContextListenersRef.current.contextLost &&
            webglContextListenersRef.current.contextRestored) {
            webglContextListenersRef.current.canvas.removeEventListener(
              'webglcontextlost',
              webglContextListenersRef.current.contextLost
            );
            webglContextListenersRef.current.canvas.removeEventListener(
              'webglcontextrestored',
              webglContextListenersRef.current.contextRestored
            );
            console.log('🔇 WebGL 컨텍스트 이벤트 리스너 제거 완료');
            webglContextListenersRef.current = { canvas: null, contextLost: null, contextRestored: null };
          }

          // Ticker 중지
          if (app.ticker) {
            app.ticker.stop();
          }

          // Stage의 모든 자식 제거
          if (app.stage) {
            app.stage.removeChildren();
          }

          // 전체 앱 파괴 (renderer, stage, ticker 모두 포함)
          // removeView: true로 DOM에서 캔버스도 제거
          app.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true
          });

          console.log('✅ PIXI 앱 완전 정리 완료');
        } catch (e) {
          console.warn('⚠️ PIXI 앱 정리 중 오류 (무시됨):', e);
        }
        pixiAppRef.current = null;
      }

      // 3. PIXI 텍스처 캐시 완전 정리
      try {
        if (PIXI.utils && PIXI.utils.clearTextureCache) {
          PIXI.utils.clearTextureCache();
          console.log('✅ PIXI 텍스처 캐시 정리 완료');
        }
      } catch (cacheError) {
        console.warn('⚠️ 텍스처 캐시 정리 실패 (무시됨):', cacheError);
      }

      // 4. DOM에서 남은 캔버스 완전 제거
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // 5. WebGL 컨텍스트가 완전히 해제될 때까지 대기 (개인 아바타는 더 긴 대기)
      const isUserAvatar = selectedModel && !modelDefinitions[selectedModel]?.url?.startsWith('/live2d-models/');
      const waitTime = isUserAvatar ? 1200 : 250; // 개인 아바타는 1200ms로 증가
      console.log(`⏳ WebGL 정리 대기 중... (${waitTime}ms) ${isUserAvatar ? '[개인 아바타]' : '[기본 모델]'}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // console.log('🎨 PIXI.js v7 앱 초기화...');

      // PIXI.js v7 Application 생성
      const app = new PIXI.Application({
        width,
        height,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        powerPreference: 'high-performance',
        // WebGL 컨텍스트 옵션 추가
        hello: false, // PIXI 배너 숨기기
        // WebGL 컨텍스트 안정성 옵션
        preserveDrawingBuffer: false, // 성능 향상
        clearBeforeRender: true,
        // 컨텍스트 손실 방지 옵션
        forceCanvas: false, // WebGL 사용 강제
      });

      console.log('✅ PIXI.js v7 앱 생성 완료');

      // WebGL 컨텍스트 손실/복원 이벤트 핸들러
      const canvas = app.view as HTMLCanvasElement;
      if (canvas) {
        const handleContextLost = (e: Event) => {
          console.error('🚨 WebGL 컨텍스트 손실 감지!');
          // e.preventDefault()를 호출하지 않으면 브라우저가 자동으로 복원 시도
          // 하지만 우리는 수동으로 복원하므로 preventDefault 호출
          e.preventDefault();

          console.log('⚠️ 모델 초기화 상태 리셋 중...');
          setIsInitializing(false);
          setIsLoading(false);
          setError('WebGL 컨텍스트가 손실되었습니다. 복원 중...');
        };

        const handleContextRestored = () => {
          console.log('✅ WebGL 컨텍스트 복원됨');

          // 컨텍스트 복원 후 안정화 대기
          setTimeout(() => {
            console.log('🔄 WebGL 안정화 완료 - 모델 재로드 시도:', selectedModel);

            // 상태 완전 리셋 후 재시도
            setError(null);
            setLastInitializedModel(null);
            setIsInitializing(false);
            setIsLoading(false);

            // 모델 재로드 트리거 (selectedModel은 유지하되 lastInitializedModel을 null로)
            // useEffect에서 자동으로 재초기화됨
          }, 1500); // 1.5초 대기
        };

        // 이벤트 리스너 등록
        canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
        canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener);

        // ref에 저장 (나중에 제거할 수 있도록)
        webglContextListenersRef.current = {
          canvas: canvas,
          contextLost: handleContextLost as EventListener,
          contextRestored: handleContextRestored as EventListener
        };

        console.log('🎧 WebGL 컨텍스트 이벤트 리스너 등록 완료');
      }

      // 이벤트 시스템 안전 설정 (PIXI v7 호환)
      try {
        // PIXI v7의 새로운 events API 사용
        if (app.renderer && (app.renderer as any).events) {
          (app.renderer as any).events.autoPreventDefault = false;
        }
        // Stage 이벤트 비활성화 (v7.2+ 방식)
        app.stage.eventMode = 'none';
        (app.stage as any).interactiveChildren = false;
      } catch (eventError) {
        console.warn('⚠️ 이벤트 시스템 설정 실패 (무시됨):', eventError);
      }

      // DOM에 PIXI 캔버스 추가 (v7 방식)
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.touchAction = 'none'; // 터치 이벤트 최적화
        container.appendChild(canvas);
        pixiAppRef.current = app;
        console.log('✅ PIXI 캔버스 DOM에 추가 완료');
      } else {
        throw new Error('PIXI canvas를 찾을 수 없습니다');
      }

      console.log('🎨 pixi-live2d-display로 Live2D 모델 로드 시작:', model.url);

      // pixi-live2d-display로 Live2D 모델 로드 (안전 옵션)
      const live2dModel = await Live2DModel.from(model.url, {
        // 모션 로딩 실패 시 무시하고 계속 진행
        onError: (error: any) => {
          console.warn('⚠️ Live2D 모션/리소스 로딩 실패 (무시됨):', error.message || error);
        }
      });

      console.log('✅ Live2D 모델 로드 완료:', {
        modelName: selectedModel,
        modelUrl: model.url,
        hasInternalModel: !!(live2dModel as any).internalModel,
        width: live2dModel.width,
        height: live2dModel.height
      });

      // 인터랙션 비활성화 (PIXI v7 방식, 이벤트 오류 방지)
      try {
        // PIXI v7.2+ eventMode 사용
        (live2dModel as any).eventMode = 'none';
        (live2dModel as any).interactiveChildren = false;

        // 내부 모델에도 적용
        if ((live2dModel as any).internalModel) {
          (live2dModel as any).internalModel.eventMode = 'none';
        }

        // registerInteraction 메서드 무력화 (오류 방지)
        if (typeof (live2dModel as any).registerInteraction === 'function') {
          (live2dModel as any).registerInteraction = () => { };
        }
        if (typeof (live2dModel as any).unregisterInteraction === 'function') {
          (live2dModel as any).unregisterInteraction = () => { };
        }
      } catch (interactionError) {
        console.warn('⚠️ 인터랙션 비활성화 실패 (무시됨):', interactionError);
      }

      // 모델별 기본 크기 설정
      let baseScale;

      // 모델 타입에 따라 기본 스케일 자동 결정
      const isProjectSekaiModel = selectedModel.match(/^\d{2}[a-z]+_/); // 01ichika, 02saki 등
      const isCubismSDKModel = ['mao', 'mao_pro', 'shizuku', 'chitose', 'haru', 'Epsilon',
        'hijiki', 'tororo', 'hiyori_pro_ko', 'natori_pro_ko',
        'rice_pro_ko', 'miara_pro_en', 'haru_greeter_pro_jp'].includes(selectedModel);

      if (selectedModel === 'mao' || selectedModel === 'mao_pro') {
        baseScale = 0.08; // mao는 특별히 큰 모델
      } else if (selectedModel === 'ichika') {
        baseScale = 0.18; // ichika는 작은 모델
      } else if (isProjectSekaiModel) {
        // Project Sekai 모델들 (숫자로 시작)
        baseScale = 0.24; // Project Sekai 모델들은 더 큰 스케일 필요
      } else if (isCubismSDKModel) {
        // Cubism SDK 모델들
        baseScale = 0.10; // Cubism SDK 모델들은 작은 스케일
      } else {
        // 기타 모델들
        baseScale = 0.18; // 기본값
      }

      // 사용자 조정 스케일과 기본 스케일 결합
      const finalScale = baseScale * modelScale;

      console.log(`📏 ${selectedModel} 모델 스케일 설정:`, { baseScale, userScale: modelScale, finalScale });

      live2dModel.scale.set(finalScale);

      // 모델 타입에 따라 앵커와 Y 위치 조정
      if (isProjectSekaiModel) {
        // Project Sekai 모델은 더 아래쪽에 배치
        live2dModel.anchor.set(0.5, 0.5); // 중앙 앵커
        live2dModel.y = height * 0.65 + (model.initialYshift || 0) * 100 + modelPosition.y;
      } else {
        // 기타 모델들
        live2dModel.anchor.set(0.5, 0.5); // 중앙 앵커로 변경
        live2dModel.y = height * 0.6 + (model.initialYshift || 0) * 100 + modelPosition.y;
      }

      live2dModel.x = width / 2 + (model.initialXshift || 0) + modelPosition.x;

      // PIXI Stage에 Live2D 모델 추가 (v7 타입 캐스팅)
      app.stage.addChild(live2dModel as any);
      live2dModelRef.current = live2dModel;

      console.log('✅ Live2D 모델 Stage에 추가 완료:', {
        scale: finalScale,
        position: `${live2dModel.x}, ${live2dModel.y}`,
        width: live2dModel.width,
        height: live2dModel.height
      });

      // 전역 오류 처리 (Live2D 관련 오류 무시)
      const handleGlobalError = (event: ErrorEvent) => {
        const errorMsg = event.message || event.error?.message || '';
        if (errorMsg.includes('manager.on is not a function') ||
          errorMsg.includes('isInteractive is not a function') ||
          errorMsg.includes('_a.off is not a function') ||
          errorMsg.includes('registerInteraction') ||
          errorMsg.includes('unregisterInteraction')) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      };

      // 전역 오류 리스너 등록
      window.addEventListener('error', handleGlobalError);

      // 5초 후 리스너 제거
      setTimeout(() => {
        window.removeEventListener('error', handleGlobalError);
      }, 10000);

      console.log('✅ pixi-live2d-display 초기화 완료');

      // 초기 감정 적용 (기본 상태)
      if (emotion && emotion !== 'neutral') {
        setTimeout(() => {
          if (live2dModelRef.current) {
            try {
              applyEmotionToModel(live2dModelRef.current, emotion);
            } catch (error) {
              console.warn('초기 감정 적용 오류:', error);
            }
          }
        }, 1000);
      }

      setIsLoading(false);
      setIsInitializing(false);
      setLastInitializedModel(selectedModel); // 성공한 모델 기록

      if (onLoaded) {
        onLoaded(live2dModel);
      }



    } catch (error) {
      console.error('❌ pixi-live2d-display 초기화 실패:', error);
      setError(error instanceof Error ? error.message : 'Live2D 초기화 실패');
      setIsLoading(false);
      setIsInitializing(false);
      setLastInitializedModel(null); // 실패 시 리셋

      if (onError) {
        onError(error instanceof Error ? error : new Error('Live2D 초기화 실패'));
      }
    }
  }, [selectedModel, modelDefinitions]);

  // props로 받은 modelName 변경 시 내부 상태 업데이트
  useEffect(() => {
    // URL에서 개인 아바타 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const isUserAvatarInUrl = urlParams.get('isUserAvatar') === 'true';

    if (modelName && modelName !== selectedModel) {
      // 개인 아바타가 활성화되어 있고 URL에도 개인 아바타 파라미터가 있으면 props 변경 무시
      if (isUserAvatarActive && isUserAvatarInUrl) {
        console.log(`⏸️ Props 변경 무시 (개인 아바타 활성): ${modelName}`);
        return;
      }

      console.log(`🔄 Props에서 모델 변경 감지: ${selectedModel} → ${modelName}`);
      setSelectedModel(modelName);
      setLastInitializedModel(null);
      setError(null);
      setIsUserAvatarActive(false); // 일반 모델로 전환
    }

    // URL에서 개인 아바타 파라미터가 제거되면 개인 아바타 상태 해제
    if (isUserAvatarActive && !isUserAvatarInUrl) {
      console.log(`🔄 개인 아바타 상태 해제 (URL 변경)`);
      setIsUserAvatarActive(false);
    }
  }, [modelName, selectedModel, isUserAvatarActive]);

  // userAvatarChange 이벤트 리스닝 (개인 아바타 선택 시)
  useEffect(() => {
    const handleUserAvatarChange = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('💎 userAvatarChange 이벤트 수신:', detail);
      console.log('💎 이벤트 detail 구조:', {
        hasDetail: !!detail,
        hasAvatar: !!(detail && detail.avatar),
        avatarKeys: detail && detail.avatar ? Object.keys(detail.avatar) : [],
        avatar: detail && detail.avatar
      });

      if (detail && detail.avatar) {
        const avatar = detail.avatar;
        const avatarUrl = avatar.modelUrl || avatar.url;
        const avatarName = avatar.id || avatar.displayName;

        console.log('💎 개인 아바타 필드 확인:', {
          id: avatar.id,
          displayName: avatar.displayName,
          modelUrl: avatar.modelUrl,
          url: avatar.url,
          finalUrl: avatarUrl,
          finalName: avatarName
        });

        if (avatarUrl && avatarName) {
          console.log('💎 개인 아바타로 전환 시작:', {
            name: avatarName,
            url: avatarUrl,
            currentModel: selectedModel
          });

          // 개인 아바타를 모델 정의에 추가
          const userAvatarModel: ModelInfo = {
            name: avatarName,
            description: `개인 아바타: ${avatar.displayName || avatarName}`,
            url: avatarUrl,
            kScale: 0.5,
            initialXshift: 0.15,
            initialYshift: 0,
            kXOffset: 0,
            idleMotionGroupName: 'Idle',
            emotionMap: {},
            tapMotions: {}
          };

          console.log('💎 생성된 모델 정의:', userAvatarModel);

          // 1. 먼저 모델 정의 업데이트
          setModelDefinitions(prev => {
            const updated = {
              ...prev,
              [avatarName]: userAvatarModel
            };
            console.log('💎 모델 정의 업데이트 완료:', {
              totalModels: Object.keys(updated).length,
              hasNewModel: avatarName in updated
            });
            return updated;
          });

          // 2. 상태 업데이트를 위해 충분히 대기 (React 배치 업데이트)
          await new Promise(resolve => setTimeout(resolve, 200));

          console.log('💎 모델 정의가 상태에 반영되었는지 확인');

          // 3. 모델 변경 (이제 modelDefinitions에 새 모델이 있음)
          if (selectedModel !== avatarName) {
            console.log(`💎 모델 전환 준비: ${selectedModel} → ${avatarName}`);

            // 추가 안정화: 현재 모델을 명시적으로 초기화 상태로 리셋
            setLastInitializedModel(null);
            setError(null);
            setIsInitializing(false);
            setIsLoading(false);

            console.log('💎 WebGL 안정화를 위해 500ms 대기 중...');
            // WebGL 안정화를 위한 추가 대기
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log(`💎 모델 전환 실행: ${avatarName}`);
            setIsUserAvatarActive(true); // 개인 아바타 활성화 표시
            setSelectedModel(avatarName);
          } else {
            console.log('⚠️ 이미 해당 모델이 선택되어 있음:', avatarName);
          }
        } else {
          console.error('❌ 개인 아바타 정보 부족:', {
            avatarUrl,
            avatarName,
            avatar
          });
        }
      } else {
        console.error('❌ 이벤트 detail 또는 avatar가 없음:', detail);
      }
    };

    window.addEventListener('userAvatarChange', handleUserAvatarChange);

    return () => {
      window.removeEventListener('userAvatarChange', handleUserAvatarChange);
    };
  }, [selectedModel]);

  // 감정 변경 처리 (Expression + Motion 시스템)
  useEffect(() => {
    if (live2dModelRef.current && emotion && !isLoading) {
      try {
        console.log('🎭 감정 변경 시도:', {
          emotion,
          modelExists: !!live2dModelRef.current,
          isLoading,
          selectedModel
        });

        console.log('🎭 Live2D 감정 + 모션 적용:', emotion);
        applyEmotionToModel(live2dModelRef.current, emotion);

      } catch (error) {
        console.warn('감정 적용 중 오류:', error);
      }
    } else {
      console.log('🎭 감정 변경 조건 불충족:', {
        hasModel: !!live2dModelRef.current,
        hasEmotion: !!emotion,
        isLoading,
        selectedModel
      });
    }
  }, [emotion, isLoading, applyEmotionToModel, selectedModel]);

  // TTS 함수를 부모 컴포넌트에 전달 (모델 로드 완료 후, 한 번만)
  useEffect(() => {
    if (live2dModelRef.current && onSpeakReady && typeof speak === 'function' && !isLoading && !error && !isTTSReady) {
      console.log('🎤 TTS 함수 전달 시도:', {
        modelExists: !!live2dModelRef.current,
        speakFunctionType: typeof speak,
        speakFunctionName: speak.name,
        isLoading,
        error,
        isTTSReady,
        selectedModel
      });

      // 약간의 지연 후 TTS 함수 전달 (한 번만)
      const timer = setTimeout(() => {
        if (onSpeakReady && typeof speak === 'function' && !isTTSReady) {
          console.log('TTS 함수 전달 완료');
          onSpeakReady(speak);
          setIsTTSReady(true); // TTS 준비 완료 표시

          // 전달 후 즉시 테스트 (한 번만)
          setTimeout(() => {
            if (!isSpeaking) { // 현재 말하고 있지 않을 때만
              speak("TTS 연결 완료");
            }
          }, 500);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [live2dModelRef.current, onSpeakReady, speak, isLoading, error, selectedModel, isTTSReady, isSpeaking]);

  // isSpeaking 상태를 부모에게 전달
  useEffect(() => {
    if (onSpeakingChange) {
      onSpeakingChange(isSpeaking);
    }
  }, [isSpeaking, onSpeakingChange]);

  // 모델 변경 시 이전 상태 리셋
  useEffect(() => {
    setLastInitializedModel(null);
    setError(null);
    setIsTTSReady(false); // TTS 상태도 리셋
    // isUserAvatarActive는 리셋하지 않음 (개인 아바타 상태 유지)
  }, [selectedModel]);

  // 모델 정의 로드
  useEffect(() => {
    const loadDefinitions = async () => {
      try {
        const definitions = await fetchModelDefinitions();
        setModelDefinitions(definitions);

        console.log('✅ 모델 정의 로드 완료');
      } catch (error) {
        console.error('모델 정의 로드 실패:', error);
        setError('모델 정의를 로드할 수 없습니다.');
      }
    };
    loadDefinitions();
  }, []);

  // 모델 변경 시 재초기화 (디바운싱 및 중복 실행 방지)
  useEffect(() => {
    console.log('🔄 Live2D useEffect 실행됨:', {
      modelDefinitionsCount: Object.keys(modelDefinitions).length,
      selectedModel,
      isInitializing,
      isLoading,
      hasModel: !!modelDefinitions[selectedModel],
      lastInitializedModel,
      alreadyInitialized: lastInitializedModel === selectedModel
    });

    // 필요한 조건들 체크
    if (Object.keys(modelDefinitions).length === 0) {
      console.log('⏸️ 모델 정의가 없어서 초기화 건너뜀');
      return;
    }

    if (!modelDefinitions[selectedModel]) {
      console.log('⏸️ 선택된 모델이 존재하지 않아서 초기화 건너뜀:', selectedModel);
      return;
    }

    // 이미 같은 모델이 성공적으로 초기화된 경우 건너뜀
    if (lastInitializedModel === selectedModel && !error) {
      console.log('⏸️ 이미 초기화된 모델이므로 건너뜀:', selectedModel);
      return;
    }

    let isMounted = true;

    // 상태 강제 리셋 (이전 초기화 실패 시 복구)
    if (isLoading && !isInitializing) {
      console.log('🔄 이전 로딩 상태 강제 리셋');
      setIsLoading(false);
      setError(null);
    }

    const initialize = async () => {
      if (isMounted) {
        console.log('🚀 Live2D 초기화 함수 실행');
        await initializeLive2D();
      }
    };

    // 디바운싱으로 WebGL 컨텍스트 안정화 시간 확보
    // 개인 아바타는 더 긴 대기 시간 필요
    const isUserAvatar = selectedModel && !modelDefinitions[selectedModel]?.url?.startsWith('/live2d-models/');
    const debounceTime = isUserAvatar ? 1500 : 800; // 개인 아바타는 1.5초, 기본은 800ms
    console.log(`⏱️ 모델 초기화 디바운싱: ${debounceTime}ms ${isUserAvatar ? '[개인 아바타]' : '[기본 모델]'}`);
    const initTimeout = setTimeout(initialize, debounceTime);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);

      // 컴포넌트 언마운트 시 완전한 정리
      try {
        console.log('🧹 Live2D 컴포넌트 언마운트 - 정리 시작');

        // 1. TTS 정리
        cleanup();

        // 2. Live2D 모델 정리
        if (live2dModelRef.current) {
          try {
            const model = live2dModelRef.current;

            // 부모에서 제거
            if (model.parent) {
              model.parent.removeChild(model);
            }

            // 모델 완전 파괴
            model.destroy({ children: true, texture: true, baseTexture: true });

            live2dModelRef.current = null;
            console.log('✅ Live2D 모델 정리 완료');
          } catch (modelError) {
            console.warn('⚠️ Live2D 모델 정리 실패:', modelError);
          }
        }

        // 3. PIXI 앱 정리
        if (pixiAppRef.current) {
          try {
            const app = pixiAppRef.current;

            // WebGL 컨텍스트 이벤트 리스너 먼저 제거 (중요!)
            if (webglContextListenersRef.current.canvas &&
              webglContextListenersRef.current.contextLost &&
              webglContextListenersRef.current.contextRestored) {
              webglContextListenersRef.current.canvas.removeEventListener(
                'webglcontextlost',
                webglContextListenersRef.current.contextLost
              );
              webglContextListenersRef.current.canvas.removeEventListener(
                'webglcontextrestored',
                webglContextListenersRef.current.contextRestored
              );
              console.log('🔇 WebGL 컨텍스트 이벤트 리스너 제거 완료 (cleanup)');
              webglContextListenersRef.current = { canvas: null, contextLost: null, contextRestored: null };
            }

            // Ticker 중지
            if (app.ticker) {
              app.ticker.stop();
            }

            // Stage 정리
            if (app.stage) {
              app.stage.removeChildren();
            }

            // 전체 앱 파괴
            app.destroy(true, {
              children: true,
              texture: true,
              baseTexture: true
            });

            pixiAppRef.current = null;
            console.log('✅ PIXI 앱 정리 완료');
          } catch (appError) {
            console.warn('⚠️ PIXI 앱 정리 실패:', appError);
          }
        }

        // 4. PIXI 텍스처 캐시 정리
        try {
          if (PIXI.utils && PIXI.utils.clearTextureCache) {
            PIXI.utils.clearTextureCache();
          }
        } catch (cacheError) {
          console.warn('⚠️ 텍스처 캐시 정리 실패:', cacheError);
        }

        // 5. DOM 정리
        if (containerRef.current) {
          while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
          }
        }

        console.log('✅ Live2D 컴포넌트 정리 완료');
      } catch (error) {
        console.warn('⚠️ Live2D useEffect 정리 중 에러:', error);
      }
    };
  }, [selectedModel, initializeLive2D, modelDefinitions]);

  // 모델 선택 핸들러 (MainContent에서 제어하므로 제거)
  // const handleModelSelect = useCallback((modelName: string) => {
  //   setSelectedModel(modelName);
  // }, []);

  return (
    <div className={`live2d-avatar-pixi ${className}`} style={{
      position: 'fixed',
      bottom: `${150 - windowPosition.y}px`, // 채팅 입력창 위로 이동 (150px)
      right: `${20 - windowPosition.x}px`,
      zIndex: 1000, // 채팅창보다 높지만 모달보다는 낮게
      width: `${width}px`,
      height: `${height}px`,
      background: 'transparent',
      overflow: 'visible',
      pointerEvents: 'none' // 배경은 클릭 방지
    }}>

      {/* PIXI.js 컨테이너 */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onWheel={handleWheel}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          position: 'relative',
          background: 'transparent',
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'visible',
          pointerEvents: 'all', // 캐릭터는 클릭/터치 가능
          touchAction: 'none' // 기본 터치 동작 방지
        }}
      />

      {/* 상태 표시 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 rounded-lg">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2"></div>
            <p className="text-sm">pixi-live2d-display 로딩 중...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-80 rounded-lg">
          <div className="text-center text-white p-4">
            <div className="text-red-300 mb-2">
              <i className="fas fa-exclamation-triangle text-xl"></i>
            </div>
            <p className="text-sm font-semibold">Live2D 로드 실패</p>
            <p className="text-xs mt-1 opacity-75">{error}</p>
          </div>
        </div>
      )}

      {/* 말하는 중 표시 */}
      {isSpeaking && (
        <div className="absolute top-2 right-2 bg-green-600 bg-opacity-80 text-white text-xs px-3 py-1 rounded-full animate-pulse">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <span>🎤 말하는 중</span>
          </div>
        </div>
      )}

      {/* ===== 모션 캡처 컨트롤 영역 ===== */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2" style={{ pointerEvents: 'all', zIndex: 1001 }}>

        {/* 모드 선택 드롭다운 (활성 시에만 표시) */}
        {isMotionCaptureEnabled && showModeSelector && (
          <div className="bg-gray-800 bg-opacity-95 rounded-lg shadow-xl border border-gray-600 overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700 font-medium">
              추적 모드 선택
            </div>
            {([
              { mode: 'face' as TrackingMode, icon: '😀', label: '얼굴만', desc: '머리·눈·입 (가벼움)' },
              { mode: 'upper-body' as TrackingMode, icon: '🦴', label: '상반신', desc: '얼굴 + 몸통·팔 (보통)' },
              { mode: 'full-body' as TrackingMode, icon: '🏃', label: '전신', desc: '얼굴 + 몸·팔·다리·손 (무거움)' },
            ]).map(({ mode: m, icon, label, desc }) => (
              <button
                key={m}
                onClick={() => {
                  setTrackingMode(m);
                  setShowModeSelector(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                  trackingMode === m
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="text-base">{icon}</span>
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs opacity-70">{desc}</div>
                </div>
                {trackingMode === m && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* 모드 선택 버튼 (활성 시에만) */}
        {isMotionCaptureEnabled && (
          <button
            onClick={() => setShowModeSelector(!showModeSelector)}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-all shadow-lg"
          >
            {trackingMode === 'face' ? '😀 얼굴' : trackingMode === 'upper-body' ? '🦴 상반신' : '🏃 전신'}
            <span className="ml-1">▾</span>
          </button>
        )}

        {/* 메인 모션 캡처 토글 버튼 */}
        <button
          onClick={() => {
            setIsMotionCaptureEnabled(!isMotionCaptureEnabled);
            setShowModeSelector(false);
          }}
          className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-all shadow-lg ${
            isMotionCaptureEnabled
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-600 hover:bg-gray-700'
          }`}
        >
          {isMotionCaptureEnabled ? '📹 모션 캡처 ON' : '📹 모션 캡처'}
        </button>
      </div>

      {/* 웹캠 비디오 (숨김) */}
      {isMotionCaptureEnabled && videoRef && (
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          autoPlay
          playsInline
          muted
        />
      )}

      {/* 추적 상태 표시 */}
      {isMotionCaptureEnabled && initStatus && (
        <div className="absolute top-2 left-2 bg-yellow-600 bg-opacity-90 text-white text-xs px-3 py-1 rounded-full animate-pulse">
          ⏳ {initStatus}
        </div>
      )}

      {isMotionCaptureEnabled && isTrackingReady && !initStatus && (
        <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-90 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2">
          <span>✅ {trackingMode === 'face' ? '얼굴' : trackingMode === 'upper-body' ? '상반신' : '전신'} 추적 중</span>
          {bodyPose && (
            <span className="opacity-70">| 신체 ✓</span>
          )}
          {handPose && (handPose.left || handPose.right) && (
            <span className="opacity-70">| 손 ✓</span>
          )}
        </div>
      )}

      {trackingError && isMotionCaptureEnabled && (
        <div className="absolute top-2 left-2 bg-red-600 bg-opacity-90 text-white text-xs px-3 py-1 rounded-full">
          ❌ {trackingError}
        </div>
      )}

    </div>
  );
};

export default Live2DAvatarPixi;