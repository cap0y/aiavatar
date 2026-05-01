import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import { useSpeechAndAnimation } from '@/hooks/useSpeechAndAnimation';
import { useMotionCapture, type TrackingMode } from '@/hooks/useMotionCapture';

// PIXI瑜?湲濡쒕쾶濡??ㅼ젙 (pixi-live2d-display ?꾩슂)
if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI;
  console.log('?뵩 PIXI global ?ㅼ젙??(pixi-live2d-display):', !!(window as any).PIXI);
}

// Live2D 紐⑤뜽 ?뺣낫 ????뺤쓽
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

// 紐⑤뜽 ?뺤쓽 濡쒕뱶 ?⑥닔
const fetchModelDefinitions = async (): Promise<{ [key: string]: ModelInfo }> => {
  try {
    // 1. ?쒕쾭 API濡?紐⑤뱺 紐⑤뜽 ?먮룞 媛먯? (?곗꽑?쒖쐞)
    try {
      console.log('?뵇 ?쒕쾭?먯꽌 紐⑤뜽 紐⑸줉 ?먮룞 ?ㅼ틪 以?..');
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

        console.log('??pixi-live2d-display 紐⑤뜽 ?뺤쓽 濡쒕뱶 ?꾨즺 (API):', Object.keys(modelDefinitions));
        return modelDefinitions;
      }
    } catch (apiError) {
      console.warn('?좑툘 API 紐⑤뜽 濡쒕뱶 ?ㅽ뙣, model_dict.json ?쒕룄 以?..', apiError);
    }

    // 2. ?대갚: model_dict.json ?뚯씪
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

    console.log('??pixi-live2d-display 紐⑤뜽 ?뺤쓽 濡쒕뱶 ?꾨즺 (JSON):', Object.keys(modelDefinitions));
    return modelDefinitions;

  } catch (error) {
    console.error('??紐⑤뜽 ?뺤쓽 濡쒕뱶 ?ㅽ뙣:', error);
    // 理쒗썑 ?대갚: 湲곕낯 紐⑤뜽 ?뺤쓽
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
  const [selectedModel, setSelectedModel] = useState(modelName || ''); // 鍮?臾몄옄?댁쓣 湲곕낯媛믪쑝濡?  const [modelDefinitions, setModelDefinitions] = useState<{ [key: string]: ModelInfo }>({});
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastInitializedModel, setLastInitializedModel] = useState<string | null>(null);
  const [isUserAvatarActive, setIsUserAvatarActive] = useState(false); // 媛쒖씤 ?꾨컮? ?쒖꽦 ?곹깭

  // ?명꽣?숈뀡 ?곹깭
  const [isDragging, setIsDragging] = useState(false);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [modelPosition, setModelPosition] = useState({ x: 0, y: 0 });
  const [modelScale, setModelScale] = useState(1);
  const [windowPosition, setWindowPosition] = useState({ x: 20, y: 80 });
  const [isTTSReady, setIsTTSReady] = useState(false); // TTS 以鍮??곹깭 異붽?
  const [isMotionCaptureEnabled, setIsMotionCaptureEnabled] = useState(false); // 紐⑥뀡 罹≪쿂 ?쒖꽦??  const [trackingMode, setTrackingMode] = useState<TrackingMode>('face'); // 異붿쟻 紐⑤뱶
  const [showModeSelector, setShowModeSelector] = useState(false); // 紐⑤뱶 ?좏깮 硫붾돱

  // TTS? ???吏곸엫 ?좊땲硫붿씠??  const { speak, stopSpeaking, isSpeaking, cleanup } = useSpeechAndAnimation(live2dModelRef.current);

  // ?꾩떊 紐⑥뀡 罹≪쿂 (?쇨뎬 + ?좎껜 + ??
  const {
    facePose,
    bodyPose,
    handPose,
    isReady: isTrackingReady,
    error: trackingError,
    initStatus,
    videoRef,
  } = useMotionCapture(isMotionCaptureEnabled, trackingMode);

  // 遺?쒕윭??蹂닿컙???꾪븳 ?댁쟾 媛?ref
  const prevBodyRef = useRef<{
    bodyAngleX: number; bodyAngleY: number; bodyAngleZ: number;
    armL: number; armR: number; armLB: number; armRB: number;
    handL: number; handR: number; handLB: number; handRB: number;
    shoulder: number; leg: number;
  }>({
    bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0,
    armL: 0, armR: 0, armLB: 0, armRB: 0,
    handL: 0, handR: 0, handLB: 0, handRB: 0,
    shoulder: 0, leg: 0,
  });

  // 蹂닿컙 ?좏떥 (遺?쒕윭???꾪솚)
  const lerp = (current: number, target: number, factor: number) =>
    current + (target - current) * factor;

  // 媛믪쓣 吏?뺣맂 踰붿쐞濡??대옩??  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  // ===== ?쇨뎬 紐⑥뀡 罹≪쿂 ?곗씠?곕? Live2D 紐⑤뜽???곸슜 =====
  useEffect(() => {
    if (!isMotionCaptureEnabled || !facePose || !live2dModelRef.current) return;

    const model = live2dModelRef.current as any;
    if (!model.internalModel) return;

    try {
      const core = model.internalModel.coreModel;

      // 癒몃━ ?뚯쟾
      core.setParameterValueById('ParamAngleX', facePose.head.x * 30);
      core.setParameterValueById('ParamAngleY', facePose.head.y * 30);
      core.setParameterValueById('ParamAngleZ', facePose.head.z * 30);

      // ??源쒕묀??      core.setParameterValueById('ParamEyeLOpen', facePose.eye.l);
      core.setParameterValueById('ParamEyeROpen', facePose.eye.r);

      // ?덈룞??      core.setParameterValueById('ParamEyeBallX', facePose.pupil.x);
      core.setParameterValueById('ParamEyeBallY', facePose.pupil.y);

      // ?덉뜾
      core.setParameterValueById('ParamBrowLY', facePose.brow);
      core.setParameterValueById('ParamBrowRY', facePose.brow);

      // ??紐⑥뼇 (TTS 留먰븯??以묒씠 ?꾨땺 ?뚮쭔)
      if (!isSpeaking) {
        core.setParameterValueById('ParamMouthOpenY', facePose.mouth.y);
        core.setParameterValueById('ParamMouthForm', facePose.mouth.x);
        // 紐⑥쓬 ?뺥깭
        core.setParameterValueById('ParamMouthA', facePose.mouth.shape.A);
        core.setParameterValueById('ParamMouthI', facePose.mouth.shape.I);
        core.setParameterValueById('ParamMouthU', facePose.mouth.shape.U);
        core.setParameterValueById('ParamMouthE', facePose.mouth.shape.E);
        core.setParameterValueById('ParamMouthO', facePose.mouth.shape.O);
      }
    } catch (err) {
      // ?뚮씪誘명꽣媛 ?녿뒗 紐⑤뜽?먯꽌??臾댁떆
    }
  }, [facePose, isMotionCaptureEnabled, isSpeaking]);

  // ===== ?좎껜 紐⑥뀡 罹≪쿂 ?곗씠?곕? Live2D 紐⑤뜽???곸슜 =====
  useEffect(() => {
    if (!isMotionCaptureEnabled || !bodyPose || !live2dModelRef.current) return;
    if (trackingMode === 'face') return;

    const model = live2dModelRef.current as any;
    if (!model.internalModel) return;

    try {
      const core = model.internalModel.coreModel;
      const prev = prevBodyRef.current;
      const smoothing = 0.35; // 蹂닿컙 ?⑺꽣 (??쓣?섎줉 遺?쒕윭?)

      // ============================
      // --- 1) 紐명넻 ?뚯쟾 ---
      // Kalidokit Spine 媛믪? ?쇰뵒??(-1 ~ 1 踰붿쐞)
      // ParamBodyAngleX/Y/Z 踰붿쐞: ??-10 ~ 10
      // ============================
      const bodyAngleX = lerp(prev.bodyAngleX, clamp(bodyPose.spine.x * 20, -10, 10), smoothing);
      const bodyAngleY = lerp(prev.bodyAngleY, clamp(bodyPose.spine.y * 20, -10, 10), smoothing);
      const bodyAngleZ = lerp(prev.bodyAngleZ, clamp(bodyPose.spine.z * 20, -10, 10), smoothing);

      core.setParameterValueById('ParamBodyAngleX', bodyAngleX);
      core.setParameterValueById('ParamBodyAngleY', bodyAngleY);
      core.setParameterValueById('ParamBodyAngleZ', bodyAngleZ);

      // ============================
      // --- 2) ?닿묠 ---
      // ParamShoulder: ?닿묠 ?痢좊┝ (0 ~ 1)
      // ???닿묠??Y異??됯퇏?쇰줈 怨꾩궛
      // ============================
      const shoulderRaw = clamp(
        (Math.abs(bodyPose.leftUpperArm.z) + Math.abs(bodyPose.rightUpperArm.z)) / 2,
        0, 1
      );
      const shoulder = lerp(prev.shoulder, shoulderRaw, smoothing);
      core.setParameterValueById('ParamShoulder', shoulder);

      // ============================
      // --- 3) ??(?곸셿 A / ?섏셿 B) ---
      // ParamArmLA/RA: ???щ┝/?대┝ (0 ~ 1, 0=?대┝, 1=?щ┝)
      // Kalidokit UpperArm.z: ?붿쓣 ?щ━硫?媛믪씠 而ㅼ쭚
      // ============================
      const leftArmRaw = clamp(1.0 - (bodyPose.leftUpperArm.z + Math.PI / 2) / Math.PI, 0, 1);
      const rightArmRaw = clamp(1.0 - (bodyPose.rightUpperArm.z + Math.PI / 2) / Math.PI, 0, 1);

      const armL = lerp(prev.armL, leftArmRaw, smoothing);
      const armR = lerp(prev.armR, rightArmRaw, smoothing);

      core.setParameterValueById('ParamArmLA', armL);
      core.setParameterValueById('ParamArmRA', armR);

      // ParamArmLB/RB: ?섏셿(?붽퓞移??꾨옒) (0 ~ 1)
      const leftLowerArmRaw = clamp(Math.abs(bodyPose.leftLowerArm.y) / Math.PI, 0, 1);
      const rightLowerArmRaw = clamp(Math.abs(bodyPose.rightLowerArm.y) / Math.PI, 0, 1);

      const armLB = lerp(prev.armLB, leftLowerArmRaw, smoothing);
      const armRB = lerp(prev.armRB, rightLowerArmRaw, smoothing);

      core.setParameterValueById('ParamArmLB', armLB);
      core.setParameterValueById('ParamArmRB', armRB);

      // ============================
      // --- 4) ???꾩튂 + ???뚯쟾 ---
      // ParamHandL/R: ???꾩튂 (0 ~ 1)
      // ParamHandLB/RB: ???뚯쟾 (-1 ~ 1)
      // ============================
      const handLRaw = clamp((bodyPose.leftHand.y + 1) / 2, 0, 1);
      const handRRaw = clamp((bodyPose.rightHand.y + 1) / 2, 0, 1);

      const handL = lerp(prev.handL, handLRaw, smoothing);
      const handR = lerp(prev.handR, handRRaw, smoothing);

      core.setParameterValueById('ParamHandL', handL);
      core.setParameterValueById('ParamHandR', handR);

      // ???뚯쟾 (z異?= ?먮ぉ 鍮꾪?湲?
      const handLBRaw = clamp(bodyPose.leftHand.z, -1, 1);
      const handRBRaw = clamp(bodyPose.rightHand.z, -1, 1);

      const handLB = lerp(prev.handLB, handLBRaw, smoothing);
      const handRB = lerp(prev.handRB, handRBRaw, smoothing);

      core.setParameterValueById('ParamHandLB', handLB);
      core.setParameterValueById('ParamHandRB', handRB);

      // ============================
      // --- 5) ?ㅻ━ ---
      // ParamLeg: ?ㅻ━ ?吏곸엫 (0 ~ 1)
      // ?묐떎由??곸셿(?덈쾮吏) 媛곷룄???됯퇏
      // ============================
      const legRaw = clamp(
        (Math.abs(bodyPose.leftUpperLeg.x) + Math.abs(bodyPose.rightUpperLeg.x)) / Math.PI,
        0, 1
      );
      const leg = lerp(prev.leg, legRaw, smoothing);
      core.setParameterValueById('ParamLeg', leg);

      // ?댁쟾 媛??낅뜲?댄듃
      prevBodyRef.current = {
        bodyAngleX, bodyAngleY, bodyAngleZ,
        armL, armR, armLB, armRB,
        handL, handR, handLB, handRB,
        shoulder, leg,
      };
    } catch (err) {
      // ?뚮씪誘명꽣媛 ?녿뒗 紐⑤뜽?먯꽌??臾댁떆
    }
  }, [bodyPose, isMotionCaptureEnabled, trackingMode]);

  // ===== ???곸꽭 紐⑥뀡 罹≪쿂 (upper-body / full-body 紐⑤뱶: HandLandmarker 寃곌낵) =====
  useEffect(() => {
    if (!isMotionCaptureEnabled || !handPose || !live2dModelRef.current) return;
    if (trackingMode === 'face') return;

    const model = live2dModelRef.current as any;
    if (!model.internalModel) return;

    try {
      const core = model.internalModel.coreModel;

      if (handPose.left) {
        // ?먭????꾩껜 curl ?됯퇏 ??二쇰㉨ 伊??뺣룄 (0=?쇱묠, 1=二쇰㉨)
        const leftGrip = (
          handPose.left.thumb  +
          handPose.left.index  +
          handPose.left.middle +
          handPose.left.ring   +
          handPose.left.little
        ) / 5;
        core.setParameterValueById('ParamHandL',  clamp(leftGrip, 0, 1));
        core.setParameterValueById('ParamHandLB', clamp(handPose.left.wrist.z / Math.PI, -1, 1));
      }

      if (handPose.right) {
        const rightGrip = (
          handPose.right.thumb  +
          handPose.right.index  +
          handPose.right.middle +
          handPose.right.ring   +
          handPose.right.little
        ) / 5;
        core.setParameterValueById('ParamHandR',  clamp(rightGrip, 0, 1));
        core.setParameterValueById('ParamHandRB', clamp(handPose.right.wrist.z / Math.PI, -1, 1));
      }
    } catch {
      // ?뚮씪誘명꽣媛 ?녿뒗 紐⑤뜽?먯꽌??臾댁떆
    }
  }, [handPose, isMotionCaptureEnabled, trackingMode]);
  //   console.log('?렚 Live2DAvatarPixi ?뚮뜑留?', { selectedModel, isLoading, error, isInitializing, lastInitializedModel, isSpeaking });

  // 媛먯젙??Live2D 紐⑤뜽???곸슜?섎뒗 ?⑥닔 (Expression + Motion ?쒖뒪??
  const applyEmotionToModel = useCallback((live2dModel: any, emotionState: string) => {
    if (!live2dModel) return;

    try {
      // 媛먯젙 ?ㅼ썙??留ㅼ묶 (?뚮Ц?먮줈 ?듭씪)
      const emotion = emotionState.toLowerCase();

      // ?좎궗 媛먯젙 留ㅽ븨 (Expression ?대쫫??留욎땄)
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

      // 理쒖쥌 媛먯젙 寃곗젙
      let finalEmotion = emotion;
      if (emotionMappings[emotion]) {
        finalEmotion = emotionMappings[emotion];
      }

      console.log('?렚 媛먯젙 泥섎━:', {
        originalEmotion: emotionState,
        processedEmotion: finalEmotion,
        modelName: selectedModel
      });

      // 1. Expression ?곸슜 (?대쫫?쇰줈 吏곸젒)
      if (live2dModel.internalModel?.motionManager?.expressionManager) {
        const expressionManager = live2dModel.internalModel.motionManager.expressionManager;

        try {
          // Expression???대쫫?쇰줈 ?ㅼ젙 (???뺥솗??
          if (expressionManager.setExpressionByName) {
            expressionManager.setExpressionByName(finalEmotion);
            console.log('??Expression ?대쫫?쇰줈 ?ㅼ젙:', finalEmotion);
          } else if (expressionManager.startMotion && live2dModel.internalModel?.settings?.expressions) {
            // 諛깆뾽: Expression ?뚯씪??吏곸젒 李얠븘???ㅼ젙
            const expressions = live2dModel.internalModel.settings.expressions;
            const expressionIndex = expressions.findIndex((exp: any) =>
              exp.Name?.toLowerCase() === finalEmotion ||
              exp.name?.toLowerCase() === finalEmotion
            );

            if (expressionIndex >= 0) {
              expressionManager.setExpression(expressionIndex);
              console.log('??Expression ?몃뜳?ㅻ줈 ?ㅼ젙:', expressionIndex, finalEmotion);
            } else {
              console.warn('?좑툘 Expression??李얠쓣 ???놁쓬:', finalEmotion);
            }
          }
        } catch (expError) {
          console.warn('Expression ?ㅼ젙 ?ㅻ쪟:', expError);
        }
      }

      // 2. Motion ?ъ깮 (媛먯젙???곕Ⅸ ?좊땲硫붿씠??
      if (live2dModel.internalModel?.motionManager) {
        const motionManager = live2dModel.internalModel.motionManager;

        try {
          // 媛먯젙蹂?Motion 洹몃９ 諛??몃뜳???좏깮
          let motionGroup = '';
          let motionIndex = 0;

          switch (finalEmotion) {
            case 'joy':
            case 'surprise':
              // ?쒕컻??媛먯젙 - ?밸퀎??紐⑥뀡??              motionGroup = '';
              motionIndex = Math.floor(Math.random() * 3) + 1; // mtn_02, mtn_03, mtn_04
              break;
            case 'sadness':
            case 'anger':
              // 媛뺥븳 媛먯젙 - ?뱀닔 紐⑥뀡??              motionGroup = '';
              motionIndex = Math.floor(Math.random() * 3) + 4; // special_01, special_02, special_03
              break;
            default:
              // 湲곕낯 紐⑥뀡
              motionGroup = 'Idle';
              motionIndex = 0;
          }

          // Motion ?ъ깮
          if (motionManager.startMotion) {
            const motionPromise = motionManager.startMotion(motionGroup, motionIndex, 3); // priority 3
            console.log('?렗 Motion ?쒖옉:', {
              group: motionGroup,
              index: motionIndex,
              emotion: finalEmotion
            });

            // Motion ?꾨즺 ??泥섎━ (optional)
            if (motionPromise && typeof motionPromise.then === 'function') {
              motionPromise.then(() => {
                console.log('?렗 Motion ?꾨즺:', finalEmotion);
              }).catch((motionError: any) => {
                console.warn('Motion ?ъ깮 ?ㅻ쪟:', motionError);
              });
            }
          }
        } catch (motionError) {
          console.warn('Motion ?ъ깮 ?ㅻ쪟:', motionError);
        }
      }

    } catch (error) {
      console.warn('媛먯젙 ?곸슜 以??꾩껜 ?ㅻ쪟:', error);
    }
  }, [selectedModel]);

  // ?명꽣?숈뀡 ?몃뱾?щ뱾 (留덉슦??+ ?곗튂)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // ?쇱そ ?대┃
      // Shift ?대┃?쇰줈 媛먯젙 + TTS ?뚯뒪??      if (e.shiftKey) {
        e.preventDefault();
        const testEmotions = [
          { emotion: 'joy', text: '[joy] ?덈뀞?섏꽭?? ???湲곗걶 AI ?꾨컮??낅땲??' },
          { emotion: 'sadness', text: '[sadness] ?ㅻ뒛? 議곌툑 ?ы뵂 湲곕텇?댁뿉??..' },
          { emotion: 'anger', text: '[anger] ?붽? ?섎뒗 ?쇱씠 ?덉뿀?댁슂!' },
          { emotion: 'surprise', text: '[surprise] ?! ?뺣쭚 ??쇱썙??' },
          { emotion: 'neutral', text: '[neutral] ?됱긽??紐⑥뒿?쇰줈 ?몄궗?쒕젮??' }
        ];
        const randomTest = testEmotions[Math.floor(Math.random() * testEmotions.length)];

        console.log('媛먯젙 + TTS ?뚯뒪???ㅽ뻾:', randomTest);

        // 媛먯젙 ?곸슜 (MainContent濡??꾨떖)
        if (live2dModelRef.current) {
          applyEmotionToModel(live2dModelRef.current, randomTest.emotion);
        }

        // TTS ?ㅽ뻾 (媛먯젙 紐낅졊 ?ы븿???띿뒪??
        speak(randomTest.text);
        return;
      }

      setIsDragging(true);
      setDragStart({ x: e.clientX - modelPosition.x, y: e.clientY - modelPosition.y });
    }
  }, [modelPosition, speak]);

  // ?곗튂 ?대깽???몃뱾??  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // ?⑥씪 ?곗튂 - ?쒕옒洹?      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - modelPosition.x, y: touch.clientY - modelPosition.y });
    } else if (e.touches.length === 2) {
      // ???먭????곗튂 - ?뺣?/異뺤냼 以鍮?      e.preventDefault();
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
    if (e.button === 0) { // ?쇱そ ?대┃
      setIsWindowDragging(true);
      setDragStart({ x: e.clientX - windowPosition.x, y: e.clientY - windowPosition.y });
    }
  }, [windowPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setModelPosition({ x: newX, y: newY });

      // Live2D 紐⑤뜽 ?꾩튂 ?낅뜲?댄듃
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

  // ?곗튂 ?대룞 ?몃뱾??  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      // ?⑥씪 ?곗튂 ?쒕옒洹?      const touch = e.touches[0];
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;
      setModelPosition({ x: newX, y: newY });

      // Live2D 紐⑤뜽 ?꾩튂 ?낅뜲?댄듃
      if (live2dModelRef.current) {
        live2dModelRef.current.x = width / 2 + newX;
        live2dModelRef.current.y = height * 0.9 + newY;
      }
    } else if (e.touches.length === 2) {
      // ???먭????移?以?      e.preventDefault();
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

      // Live2D 紐⑤뜽 ?ㅼ????낅뜲?댄듃
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

  // ?곗튂 醫낅즺 ?몃뱾??  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsWindowDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1; // ??諛⑺뼢???곕씪 異뺤냼/?뺣?
    const newScale = Math.max(0.1, Math.min(3, modelScale * delta)); // 0.1 ~ 3 諛??쒗븳
    setModelScale(newScale);

    // Live2D 紐⑤뜽 ?ㅼ????낅뜲?댄듃 (紐⑤뜽蹂?湲곕낯 ?ㅼ???怨좊젮)
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

  // ?꾩뿭 留덉슦??諛??곗튂 ?대깽??由ъ뒪???ㅼ젙
  useEffect(() => {
    if (isDragging || isWindowDragging) {
      // 留덉슦???대깽??      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // ?곗튂 ?대깽??      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        // 留덉슦???대깽???쒓굅
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // ?곗튂 ?대깽???쒓굅
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [isDragging, isWindowDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // PIXI.js + pixi-live2d-display 珥덇린??  const initializeLive2D = useCallback(async () => {
    // ?대? 珥덇린??以묒씠硫?以묐났 ?ㅽ뻾 諛⑹? (isLoading? UI ?곹깭?⑹씠誘濡??쒖쇅)
    if (isInitializing) {
      console.log('?몌툘 ?대? 珥덇린??以묒엯?덈떎. 以묐났 ?ㅽ뻾??諛⑹??⑸땲??');
      return;
    }

    // console.log('?렗 pixi-live2d-display 珥덇린???쒖옉...', {
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

      console.log('?렓 紐⑤뜽 珥덇린???쒖옉:', {
        selectedModel,
        availableModels: Object.keys(modelDefinitions),
        hasModel: !!modelDefinitions[selectedModel]
      });

      const model = modelDefinitions[selectedModel];
      if (!model) {
        console.error('??紐⑤뜽??李얠쓣 ???놁쓬:', {
          selectedModel,
          availableModels: Object.keys(modelDefinitions)
        });
        throw new Error(`Model "${selectedModel}" not found`);
      }

      console.log('??紐⑤뜽 ?뺤쓽 李얠쓬:', {
        name: model.name,
        url: model.url,
        description: model.description
      });

      setModelInfo(model);

      const container = containerRef.current;
      if (!container) {
        throw new Error('Container element not found');
      }

      // 1. 湲곗〈 Live2D 紐⑤뜽 癒쇱? ?뺣━ (PIXI ?깅낫??癒쇱?)
      if (live2dModelRef.current) {
        try {
          const model = live2dModelRef.current;

          // 遺紐⑥뿉???쒓굅
          if (model.parent) {
            model.parent.removeChild(model);
          }

          // 紐⑤뜽 ?꾩쟾 ?뚭눼
          model.destroy({ children: true, texture: true, baseTexture: true });

          console.log('??Live2D 紐⑤뜽 ?뺣━ ?꾨즺');
        } catch (e) {
          console.warn('?좑툘 Live2D 紐⑤뜽 ?뺣━ 以??ㅻ쪟 (臾댁떆??:', e);
        }
        live2dModelRef.current = null;
      }

      // 2. 湲곗〈 PIXI ???꾩쟾 ?뺣━ (WebGL 而⑦뀓?ㅽ듃 ?ы븿)
      if (pixiAppRef.current) {
        try {
          const app = pixiAppRef.current;

          // WebGL 而⑦뀓?ㅽ듃 ?대깽??由ъ뒪??癒쇱? ?쒓굅 (以묒슂!)
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
            console.log('?뵁 WebGL 而⑦뀓?ㅽ듃 ?대깽??由ъ뒪???쒓굅 ?꾨즺');
            webglContextListenersRef.current = { canvas: null, contextLost: null, contextRestored: null };
          }

          // Ticker 以묒?
          if (app.ticker) {
            app.ticker.stop();
          }

          // Stage??紐⑤뱺 ?먯떇 ?쒓굅
          if (app.stage) {
            app.stage.removeChildren();
          }

          // ?꾩껜 ???뚭눼 (renderer, stage, ticker 紐⑤몢 ?ы븿)
          // removeView: true濡?DOM?먯꽌 罹붾쾭?ㅻ룄 ?쒓굅
          app.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true
          });

          console.log('??PIXI ???꾩쟾 ?뺣━ ?꾨즺');
        } catch (e) {
          console.warn('?좑툘 PIXI ???뺣━ 以??ㅻ쪟 (臾댁떆??:', e);
        }
        pixiAppRef.current = null;
      }

      // 3. PIXI ?띿뒪泥?罹먯떆 ?꾩쟾 ?뺣━
      try {
        if (PIXI.utils && PIXI.utils.clearTextureCache) {
          PIXI.utils.clearTextureCache();
          console.log('??PIXI ?띿뒪泥?罹먯떆 ?뺣━ ?꾨즺');
        }
      } catch (cacheError) {
        console.warn('?좑툘 ?띿뒪泥?罹먯떆 ?뺣━ ?ㅽ뙣 (臾댁떆??:', cacheError);
      }

      // 4. DOM?먯꽌 ?⑥? 罹붾쾭???꾩쟾 ?쒓굅
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // 5. WebGL 而⑦뀓?ㅽ듃媛 ?꾩쟾???댁젣???뚭퉴吏 ?湲?(媛쒖씤 ?꾨컮?????湲??湲?
      const isUserAvatar = selectedModel && !modelDefinitions[selectedModel]?.url?.startsWith('/live2d-models/');
      const waitTime = isUserAvatar ? 1200 : 250; // 媛쒖씤 ?꾨컮???1200ms濡?利앷?
      console.log(`??WebGL ?뺣━ ?湲?以?.. (${waitTime}ms) ${isUserAvatar ? '[媛쒖씤 ?꾨컮?]' : '[湲곕낯 紐⑤뜽]'}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // console.log('?렓 PIXI.js v7 ??珥덇린??..');

      // PIXI.js v7 Application ?앹꽦
      const app = new PIXI.Application({
        width,
        height,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        powerPreference: 'high-performance',
        // WebGL 而⑦뀓?ㅽ듃 ?듭뀡 異붽?
        hello: false, // PIXI 諛곕꼫 ?④린湲?        // WebGL 而⑦뀓?ㅽ듃 ?덉젙???듭뀡
        preserveDrawingBuffer: false, // ?깅뒫 ?μ긽
        clearBeforeRender: true,
        // 而⑦뀓?ㅽ듃 ?먯떎 諛⑹? ?듭뀡
        forceCanvas: false, // WebGL ?ъ슜 媛뺤젣
      });

      console.log('??PIXI.js v7 ???앹꽦 ?꾨즺');

      // WebGL 而⑦뀓?ㅽ듃 ?먯떎/蹂듭썝 ?대깽???몃뱾??      const canvas = app.view as HTMLCanvasElement;
      if (canvas) {
        const handleContextLost = (e: Event) => {
          console.error('?슚 WebGL 而⑦뀓?ㅽ듃 ?먯떎 媛먯?!');
          // e.preventDefault()瑜??몄텧?섏? ?딆쑝硫?釉뚮씪?곗?媛 ?먮룞?쇰줈 蹂듭썝 ?쒕룄
          // ?섏?留??곕━???섎룞?쇰줈 蹂듭썝?섎?濡?preventDefault ?몄텧
          e.preventDefault();

          console.log('?좑툘 紐⑤뜽 珥덇린???곹깭 由ъ뀑 以?..');
          setIsInitializing(false);
          setIsLoading(false);
          setError('WebGL 而⑦뀓?ㅽ듃媛 ?먯떎?섏뿀?듬땲?? 蹂듭썝 以?..');
        };

        const handleContextRestored = () => {
          console.log('??WebGL 而⑦뀓?ㅽ듃 蹂듭썝??);

          // 而⑦뀓?ㅽ듃 蹂듭썝 ???덉젙???湲?          setTimeout(() => {
            console.log('?봽 WebGL ?덉젙???꾨즺 - 紐⑤뜽 ?щ줈???쒕룄:', selectedModel);

            // ?곹깭 ?꾩쟾 由ъ뀑 ???ъ떆??            setError(null);
            setLastInitializedModel(null);
            setIsInitializing(false);
            setIsLoading(false);

            // 紐⑤뜽 ?щ줈???몃━嫄?(selectedModel? ?좎??섎릺 lastInitializedModel??null濡?
            // useEffect?먯꽌 ?먮룞?쇰줈 ?ъ큹湲고솕??          }, 1500); // 1.5珥??湲?        };

        // ?대깽??由ъ뒪???깅줉
        canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
        canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener);

        // ref?????(?섏쨷???쒓굅?????덈룄濡?
        webglContextListenersRef.current = {
          canvas: canvas,
          contextLost: handleContextLost as EventListener,
          contextRestored: handleContextRestored as EventListener
        };

        console.log('?렒 WebGL 而⑦뀓?ㅽ듃 ?대깽??由ъ뒪???깅줉 ?꾨즺');
      }

      // ?대깽???쒖뒪???덉쟾 ?ㅼ젙 (PIXI v7 ?명솚)
      try {
        // PIXI v7???덈줈??events API ?ъ슜
        if (app.renderer && (app.renderer as any).events) {
          (app.renderer as any).events.autoPreventDefault = false;
        }
        // Stage ?대깽??鍮꾪솢?깊솕 (v7.2+ 諛⑹떇)
        app.stage.eventMode = 'none';
        (app.stage as any).interactiveChildren = false;
      } catch (eventError) {
        console.warn('?좑툘 ?대깽???쒖뒪???ㅼ젙 ?ㅽ뙣 (臾댁떆??:', eventError);
      }

      // DOM??PIXI 罹붾쾭??異붽? (v7 諛⑹떇)
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.touchAction = 'none'; // ?곗튂 ?대깽??理쒖쟻??        container.appendChild(canvas);
        pixiAppRef.current = app;
        console.log('??PIXI 罹붾쾭??DOM??異붽? ?꾨즺');
      } else {
        throw new Error('PIXI canvas瑜?李얠쓣 ???놁뒿?덈떎');
      }

      console.log('?렓 pixi-live2d-display濡?Live2D 紐⑤뜽 濡쒕뱶 ?쒖옉:', model.url);

      // pixi-live2d-display濡?Live2D 紐⑤뜽 濡쒕뱶 (?덉쟾 ?듭뀡)
      const live2dModel = await Live2DModel.from(model.url, {
        // 紐⑥뀡 濡쒕뵫 ?ㅽ뙣 ??臾댁떆?섍퀬 怨꾩냽 吏꾪뻾
        onError: (error: any) => {
          console.warn('?좑툘 Live2D 紐⑥뀡/由ъ냼??濡쒕뵫 ?ㅽ뙣 (臾댁떆??:', error.message || error);
        }
      });

      console.log('??Live2D 紐⑤뜽 濡쒕뱶 ?꾨즺:', {
        modelName: selectedModel,
        modelUrl: model.url,
        hasInternalModel: !!(live2dModel as any).internalModel,
        width: live2dModel.width,
        height: live2dModel.height
      });

      // ?명꽣?숈뀡 鍮꾪솢?깊솕 (PIXI v7 諛⑹떇, ?대깽???ㅻ쪟 諛⑹?)
      try {
        // PIXI v7.2+ eventMode ?ъ슜
        (live2dModel as any).eventMode = 'none';
        (live2dModel as any).interactiveChildren = false;

        // ?대? 紐⑤뜽?먮룄 ?곸슜
        if ((live2dModel as any).internalModel) {
          (live2dModel as any).internalModel.eventMode = 'none';
        }

        // registerInteraction 硫붿꽌??臾대젰??(?ㅻ쪟 諛⑹?)
        if (typeof (live2dModel as any).registerInteraction === 'function') {
          (live2dModel as any).registerInteraction = () => { };
        }
        if (typeof (live2dModel as any).unregisterInteraction === 'function') {
          (live2dModel as any).unregisterInteraction = () => { };
        }
      } catch (interactionError) {
        console.warn('?좑툘 ?명꽣?숈뀡 鍮꾪솢?깊솕 ?ㅽ뙣 (臾댁떆??:', interactionError);
      }

      // 紐⑤뜽蹂?湲곕낯 ?ш린 ?ㅼ젙
      let baseScale;

      // 紐⑤뜽 ??낆뿉 ?곕씪 湲곕낯 ?ㅼ????먮룞 寃곗젙
      const isProjectSekaiModel = selectedModel.match(/^\d{2}[a-z]+_/); // 01ichika, 02saki ??      const isCubismSDKModel = ['mao', 'mao_pro', 'shizuku', 'chitose', 'haru', 'Epsilon',
        'hijiki', 'tororo', 'hiyori_pro_ko', 'natori_pro_ko',
        'rice_pro_ko', 'miara_pro_en', 'haru_greeter_pro_jp'].includes(selectedModel);

      if (selectedModel === 'mao' || selectedModel === 'mao_pro') {
        baseScale = 0.08; // mao???밸퀎????紐⑤뜽
      } else if (selectedModel === 'ichika') {
        baseScale = 0.18; // ichika???묒? 紐⑤뜽
      } else if (isProjectSekaiModel) {
        // Project Sekai 紐⑤뜽??(?レ옄濡??쒖옉)
        baseScale = 0.24; // Project Sekai 紐⑤뜽?ㅼ? ?????ㅼ????꾩슂
      } else if (isCubismSDKModel) {
        // Cubism SDK 紐⑤뜽??        baseScale = 0.10; // Cubism SDK 紐⑤뜽?ㅼ? ?묒? ?ㅼ???      } else {
        // 湲고? 紐⑤뜽??        baseScale = 0.18; // 湲곕낯媛?      }

      // ?ъ슜??議곗젙 ?ㅼ??쇨낵 湲곕낯 ?ㅼ???寃고빀
      const finalScale = baseScale * modelScale;

      console.log(`?뱩 ${selectedModel} 紐⑤뜽 ?ㅼ????ㅼ젙:`, { baseScale, userScale: modelScale, finalScale });

      live2dModel.scale.set(finalScale);

      // 紐⑤뜽 ??낆뿉 ?곕씪 ?듭빱? Y ?꾩튂 議곗젙
      if (isProjectSekaiModel) {
        // Project Sekai 紐⑤뜽? ???꾨옒履쎌뿉 諛곗튂
        live2dModel.anchor.set(0.5, 0.5); // 以묒븰 ?듭빱
        live2dModel.y = height * 0.65 + (model.initialYshift || 0) * 100 + modelPosition.y;
      } else {
        // 湲고? 紐⑤뜽??        live2dModel.anchor.set(0.5, 0.5); // 以묒븰 ?듭빱濡?蹂寃?        live2dModel.y = height * 0.6 + (model.initialYshift || 0) * 100 + modelPosition.y;
      }

      live2dModel.x = width / 2 + (model.initialXshift || 0) + modelPosition.x;

      // PIXI Stage??Live2D 紐⑤뜽 異붽? (v7 ???罹먯뒪??
      app.stage.addChild(live2dModel as any);
      live2dModelRef.current = live2dModel;

      console.log('??Live2D 紐⑤뜽 Stage??異붽? ?꾨즺:', {
        scale: finalScale,
        position: `${live2dModel.x}, ${live2dModel.y}`,
        width: live2dModel.width,
        height: live2dModel.height
      });

      // ?꾩뿭 ?ㅻ쪟 泥섎━ (Live2D 愿???ㅻ쪟 臾댁떆)
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

      // ?꾩뿭 ?ㅻ쪟 由ъ뒪???깅줉
      window.addEventListener('error', handleGlobalError);

      // 5珥???由ъ뒪???쒓굅
      setTimeout(() => {
        window.removeEventListener('error', handleGlobalError);
      }, 10000);

      console.log('??pixi-live2d-display 珥덇린???꾨즺');

      // 珥덇린 媛먯젙 ?곸슜 (湲곕낯 ?곹깭)
      if (emotion && emotion !== 'neutral') {
        setTimeout(() => {
          if (live2dModelRef.current) {
            try {
              applyEmotionToModel(live2dModelRef.current, emotion);
            } catch (error) {
              console.warn('珥덇린 媛먯젙 ?곸슜 ?ㅻ쪟:', error);
            }
          }
        }, 1000);
      }

      setIsLoading(false);
      setIsInitializing(false);
      setLastInitializedModel(selectedModel); // ?깃났??紐⑤뜽 湲곕줉

      if (onLoaded) {
        onLoaded(live2dModel);
      }



    } catch (error) {
      console.error('??pixi-live2d-display 珥덇린???ㅽ뙣:', error);
      setError(error instanceof Error ? error.message : 'Live2D 珥덇린???ㅽ뙣');
      setIsLoading(false);
      setIsInitializing(false);
      setLastInitializedModel(null); // ?ㅽ뙣 ??由ъ뀑

      if (onError) {
        onError(error instanceof Error ? error : new Error('Live2D 珥덇린???ㅽ뙣'));
      }
    }
  }, [selectedModel, modelDefinitions]);

  // props濡?諛쏆? modelName 蹂寃????대? ?곹깭 ?낅뜲?댄듃
  useEffect(() => {
    // URL?먯꽌 媛쒖씤 ?꾨컮? ?뚮씪誘명꽣 ?뺤씤
    const urlParams = new URLSearchParams(window.location.search);
    const isUserAvatarInUrl = urlParams.get('isUserAvatar') === 'true';

    if (modelName && modelName !== selectedModel) {
      // 媛쒖씤 ?꾨컮?媛 ?쒖꽦?붾릺???덇퀬 URL?먮룄 媛쒖씤 ?꾨컮? ?뚮씪誘명꽣媛 ?덉쑝硫?props 蹂寃?臾댁떆
      if (isUserAvatarActive && isUserAvatarInUrl) {
        console.log(`?몌툘 Props 蹂寃?臾댁떆 (媛쒖씤 ?꾨컮? ?쒖꽦): ${modelName}`);
        return;
      }

      console.log(`?봽 Props?먯꽌 紐⑤뜽 蹂寃?媛먯?: ${selectedModel} ??${modelName}`);
      setSelectedModel(modelName);
      setLastInitializedModel(null);
      setError(null);
      setIsUserAvatarActive(false); // ?쇰컲 紐⑤뜽濡??꾪솚
    }

    // URL?먯꽌 媛쒖씤 ?꾨컮? ?뚮씪誘명꽣媛 ?쒓굅?섎㈃ 媛쒖씤 ?꾨컮? ?곹깭 ?댁젣
    if (isUserAvatarActive && !isUserAvatarInUrl) {
      console.log(`?봽 媛쒖씤 ?꾨컮? ?곹깭 ?댁젣 (URL 蹂寃?`);
      setIsUserAvatarActive(false);
    }
  }, [modelName, selectedModel, isUserAvatarActive]);

  // userAvatarChange ?대깽??由ъ뒪??(媛쒖씤 ?꾨컮? ?좏깮 ??
  useEffect(() => {
    const handleUserAvatarChange = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('?뭿 userAvatarChange ?대깽???섏떊:', detail);
      console.log('?뭿 ?대깽??detail 援ъ“:', {
        hasDetail: !!detail,
        hasAvatar: !!(detail && detail.avatar),
        avatarKeys: detail && detail.avatar ? Object.keys(detail.avatar) : [],
        avatar: detail && detail.avatar
      });

      if (detail && detail.avatar) {
        const avatar = detail.avatar;
        const avatarUrl = avatar.modelUrl || avatar.url;
        const avatarName = avatar.id || avatar.displayName;

        console.log('?뭿 媛쒖씤 ?꾨컮? ?꾨뱶 ?뺤씤:', {
          id: avatar.id,
          displayName: avatar.displayName,
          modelUrl: avatar.modelUrl,
          url: avatar.url,
          finalUrl: avatarUrl,
          finalName: avatarName
        });

        if (avatarUrl && avatarName) {
          console.log('?뭿 媛쒖씤 ?꾨컮?濡??꾪솚 ?쒖옉:', {
            name: avatarName,
            url: avatarUrl,
            currentModel: selectedModel
          });

          // 媛쒖씤 ?꾨컮?瑜?紐⑤뜽 ?뺤쓽??異붽?
          const userAvatarModel: ModelInfo = {
            name: avatarName,
            description: `媛쒖씤 ?꾨컮?: ${avatar.displayName || avatarName}`,
            url: avatarUrl,
            kScale: 0.5,
            initialXshift: 0.15,
            initialYshift: 0,
            kXOffset: 0,
            idleMotionGroupName: 'Idle',
            emotionMap: {},
            tapMotions: {}
          };

          console.log('?뭿 ?앹꽦??紐⑤뜽 ?뺤쓽:', userAvatarModel);

          // 1. 癒쇱? 紐⑤뜽 ?뺤쓽 ?낅뜲?댄듃
          setModelDefinitions(prev => {
            const updated = {
              ...prev,
              [avatarName]: userAvatarModel
            };
            console.log('?뭿 紐⑤뜽 ?뺤쓽 ?낅뜲?댄듃 ?꾨즺:', {
              totalModels: Object.keys(updated).length,
              hasNewModel: avatarName in updated
            });
            return updated;
          });

          // 2. ?곹깭 ?낅뜲?댄듃瑜??꾪빐 異⑸텇???湲?(React 諛곗튂 ?낅뜲?댄듃)
          await new Promise(resolve => setTimeout(resolve, 200));

          console.log('?뭿 紐⑤뜽 ?뺤쓽媛 ?곹깭??諛섏쁺?섏뿀?붿? ?뺤씤');

          // 3. 紐⑤뜽 蹂寃?(?댁젣 modelDefinitions????紐⑤뜽???덉쓬)
          if (selectedModel !== avatarName) {
            console.log(`?뭿 紐⑤뜽 ?꾪솚 以鍮? ${selectedModel} ??${avatarName}`);

            // 異붽? ?덉젙?? ?꾩옱 紐⑤뜽??紐낆떆?곸쑝濡?珥덇린???곹깭濡?由ъ뀑
            setLastInitializedModel(null);
            setError(null);
            setIsInitializing(false);
            setIsLoading(false);

            console.log('?뭿 WebGL ?덉젙?붾? ?꾪빐 500ms ?湲?以?..');
            // WebGL ?덉젙?붾? ?꾪븳 異붽? ?湲?            await new Promise(resolve => setTimeout(resolve, 500));

            console.log(`?뭿 紐⑤뜽 ?꾪솚 ?ㅽ뻾: ${avatarName}`);
            setIsUserAvatarActive(true); // 媛쒖씤 ?꾨컮? ?쒖꽦???쒖떆
            setSelectedModel(avatarName);
          } else {
            console.log('?좑툘 ?대? ?대떦 紐⑤뜽???좏깮?섏뼱 ?덉쓬:', avatarName);
          }
        } else {
          console.error('??媛쒖씤 ?꾨컮? ?뺣낫 遺議?', {
            avatarUrl,
            avatarName,
            avatar
          });
        }
      } else {
        console.error('???대깽??detail ?먮뒗 avatar媛 ?놁쓬:', detail);
      }
    };

    window.addEventListener('userAvatarChange', handleUserAvatarChange);

    return () => {
      window.removeEventListener('userAvatarChange', handleUserAvatarChange);
    };
  }, [selectedModel]);

  // 媛먯젙 蹂寃?泥섎━ (Expression + Motion ?쒖뒪??
  useEffect(() => {
    if (live2dModelRef.current && emotion && !isLoading) {
      try {
        console.log('?렚 媛먯젙 蹂寃??쒕룄:', {
          emotion,
          modelExists: !!live2dModelRef.current,
          isLoading,
          selectedModel
        });

        console.log('?렚 Live2D 媛먯젙 + 紐⑥뀡 ?곸슜:', emotion);
        applyEmotionToModel(live2dModelRef.current, emotion);

      } catch (error) {
        console.warn('媛먯젙 ?곸슜 以??ㅻ쪟:', error);
      }
    } else {
      console.log('?렚 媛먯젙 蹂寃?議곌굔 遺덉땐議?', {
        hasModel: !!live2dModelRef.current,
        hasEmotion: !!emotion,
        isLoading,
        selectedModel
      });
    }
  }, [emotion, isLoading, applyEmotionToModel, selectedModel]);

  // TTS ?⑥닔瑜?遺紐?而댄룷?뚰듃???꾨떖 (紐⑤뜽??以鍮꾨맆 ?뚮쭏??理쒖떊 ?⑥닔 ?꾨떖)
  useEffect(() => {
    if (!live2dModelRef.current || !onSpeakReady || typeof speak !== 'function' || isLoading || error) return;

    // speak ?⑥닔媛 諛붾??뚮쭏??紐⑤뜽 濡쒕뱶 ???ы븿) 遺紐⑥뿉 理쒖떊 ?⑥닔 ?꾨떖
    const timer = setTimeout(() => {
      if (onSpeakReady && typeof speak === 'function') {
        onSpeakReady(speak);
        setIsTTSReady(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  // speak媛 ??紐⑤뜽濡??ъ깮?깅맆 ?뚮쭏???ъ쟾??  }, [speak, onSpeakReady, isLoading, error, selectedModel]);

  // isSpeaking ?곹깭瑜?遺紐⑥뿉寃??꾨떖
  useEffect(() => {
    if (onSpeakingChange) {
      onSpeakingChange(isSpeaking);
    }
  }, [isSpeaking, onSpeakingChange]);

  // 紐⑤뜽 蹂寃????댁쟾 ?곹깭 由ъ뀑
  useEffect(() => {
    setLastInitializedModel(null);
    setError(null);
    setIsTTSReady(false); // TTS ?곹깭??由ъ뀑
    // isUserAvatarActive??由ъ뀑?섏? ?딆쓬 (媛쒖씤 ?꾨컮? ?곹깭 ?좎?)
  }, [selectedModel]);

  // 紐⑤뜽 ?뺤쓽 濡쒕뱶
  useEffect(() => {
    const loadDefinitions = async () => {
      try {
        const definitions = await fetchModelDefinitions();
        setModelDefinitions(definitions);

        console.log('??紐⑤뜽 ?뺤쓽 濡쒕뱶 ?꾨즺');
      } catch (error) {
        console.error('紐⑤뜽 ?뺤쓽 濡쒕뱶 ?ㅽ뙣:', error);
        setError('紐⑤뜽 ?뺤쓽瑜?濡쒕뱶?????놁뒿?덈떎.');
      }
    };
    loadDefinitions();
  }, []);

  // 紐⑤뜽 蹂寃????ъ큹湲고솕 (?붾컮?댁떛 諛?以묐났 ?ㅽ뻾 諛⑹?)
  useEffect(() => {
    console.log('?봽 Live2D useEffect ?ㅽ뻾??', {
      modelDefinitionsCount: Object.keys(modelDefinitions).length,
      selectedModel,
      isInitializing,
      isLoading,
      hasModel: !!modelDefinitions[selectedModel],
      lastInitializedModel,
      alreadyInitialized: lastInitializedModel === selectedModel
    });

    // ?꾩슂??議곌굔??泥댄겕
    if (Object.keys(modelDefinitions).length === 0) {
      console.log('?몌툘 紐⑤뜽 ?뺤쓽媛 ?놁뼱??珥덇린??嫄대꼫?');
      return;
    }

    if (!modelDefinitions[selectedModel]) {
      console.log('?몌툘 ?좏깮??紐⑤뜽??議댁옱?섏? ?딆븘??珥덇린??嫄대꼫?:', selectedModel);
      return;
    }

    // ?대? 媛숈? 紐⑤뜽???깃났?곸쑝濡?珥덇린?붾맂 寃쎌슦 嫄대꼫?
    if (lastInitializedModel === selectedModel && !error) {
      console.log('?몌툘 ?대? 珥덇린?붾맂 紐⑤뜽?대?濡?嫄대꼫?:', selectedModel);
      return;
    }

    let isMounted = true;

    // ?곹깭 媛뺤젣 由ъ뀑 (?댁쟾 珥덇린???ㅽ뙣 ??蹂듦뎄)
    if (isLoading && !isInitializing) {
      console.log('?봽 ?댁쟾 濡쒕뵫 ?곹깭 媛뺤젣 由ъ뀑');
      setIsLoading(false);
      setError(null);
    }

    const initialize = async () => {
      if (isMounted) {
        console.log('?? Live2D 珥덇린???⑥닔 ?ㅽ뻾');
        await initializeLive2D();
      }
    };

    // ?붾컮?댁떛?쇰줈 WebGL 而⑦뀓?ㅽ듃 ?덉젙???쒓컙 ?뺣낫
    // 媛쒖씤 ?꾨컮?????湲??湲??쒓컙 ?꾩슂
    const isUserAvatar = selectedModel && !modelDefinitions[selectedModel]?.url?.startsWith('/live2d-models/');
    const debounceTime = isUserAvatar ? 1500 : 800; // 媛쒖씤 ?꾨컮???1.5珥? 湲곕낯? 800ms
    console.log(`?깍툘 紐⑤뜽 珥덇린???붾컮?댁떛: ${debounceTime}ms ${isUserAvatar ? '[媛쒖씤 ?꾨컮?]' : '[湲곕낯 紐⑤뜽]'}`);
    const initTimeout = setTimeout(initialize, debounceTime);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);

      // 而댄룷?뚰듃 ?몃쭏?댄듃 ???꾩쟾???뺣━
      try {
        console.log('?㏏ Live2D 而댄룷?뚰듃 ?몃쭏?댄듃 - ?뺣━ ?쒖옉');

        // 1. TTS ?뺣━
        cleanup();

        // 2. Live2D 紐⑤뜽 ?뺣━
        if (live2dModelRef.current) {
          try {
            const model = live2dModelRef.current;

            // 遺紐⑥뿉???쒓굅
            if (model.parent) {
              model.parent.removeChild(model);
            }

            // 紐⑤뜽 ?꾩쟾 ?뚭눼
            model.destroy({ children: true, texture: true, baseTexture: true });

            live2dModelRef.current = null;
            console.log('??Live2D 紐⑤뜽 ?뺣━ ?꾨즺');
          } catch (modelError) {
            console.warn('?좑툘 Live2D 紐⑤뜽 ?뺣━ ?ㅽ뙣:', modelError);
          }
        }

        // 3. PIXI ???뺣━
        if (pixiAppRef.current) {
          try {
            const app = pixiAppRef.current;

            // WebGL 而⑦뀓?ㅽ듃 ?대깽??由ъ뒪??癒쇱? ?쒓굅 (以묒슂!)
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
              console.log('?뵁 WebGL 而⑦뀓?ㅽ듃 ?대깽??由ъ뒪???쒓굅 ?꾨즺 (cleanup)');
              webglContextListenersRef.current = { canvas: null, contextLost: null, contextRestored: null };
            }

            // Ticker 以묒?
            if (app.ticker) {
              app.ticker.stop();
            }

            // Stage ?뺣━
            if (app.stage) {
              app.stage.removeChildren();
            }

            // ?꾩껜 ???뚭눼
            app.destroy(true, {
              children: true,
              texture: true,
              baseTexture: true
            });

            pixiAppRef.current = null;
            console.log('??PIXI ???뺣━ ?꾨즺');
          } catch (appError) {
            console.warn('?좑툘 PIXI ???뺣━ ?ㅽ뙣:', appError);
          }
        }

        // 4. PIXI ?띿뒪泥?罹먯떆 ?뺣━
        try {
          if (PIXI.utils && PIXI.utils.clearTextureCache) {
            PIXI.utils.clearTextureCache();
          }
        } catch (cacheError) {
          console.warn('?좑툘 ?띿뒪泥?罹먯떆 ?뺣━ ?ㅽ뙣:', cacheError);
        }

        // 5. DOM ?뺣━
        if (containerRef.current) {
          while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
          }
        }

        console.log('??Live2D 而댄룷?뚰듃 ?뺣━ ?꾨즺');
      } catch (error) {
        console.warn('?좑툘 Live2D useEffect ?뺣━ 以??먮윭:', error);
      }
    };
  }, [selectedModel, initializeLive2D, modelDefinitions]);

  // 紐⑤뜽 ?좏깮 ?몃뱾??(MainContent?먯꽌 ?쒖뼱?섎?濡??쒓굅)
  // const handleModelSelect = useCallback((modelName: string) => {
  //   setSelectedModel(modelName);
  // }, []);

  return (
    <div className={`live2d-avatar-pixi ${className}`} style={{
      position: 'fixed',
      bottom: `${150 - windowPosition.y}px`, // 梨꾪똿 ?낅젰李??꾨줈 ?대룞 (150px)
      right: `${20 - windowPosition.x}px`,
      zIndex: 1000, // 梨꾪똿李쎈낫???믪?留?紐⑤떖蹂대떎????쾶
      width: `${width}px`,
      height: `${height}px`,
      background: 'transparent',
      overflow: 'visible',
      pointerEvents: 'none' // 諛곌꼍? ?대┃ 諛⑹?
    }}>

      {/* PIXI.js 而⑦뀒?대꼫 */}
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
          pointerEvents: 'all', // 罹먮┃?곕뒗 ?대┃/?곗튂 媛??          touchAction: 'none' // 湲곕낯 ?곗튂 ?숈옉 諛⑹?
        }}
      />

      {/* ?곹깭 ?쒖떆 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 rounded-lg">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2"></div>
            <p className="text-sm">pixi-live2d-display 濡쒕뵫 以?..</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-80 rounded-lg">
          <div className="text-center text-white p-4">
            <div className="text-red-300 mb-2">
              <i className="fas fa-exclamation-triangle text-xl"></i>
            </div>
            <p className="text-sm font-semibold">Live2D 濡쒕뱶 ?ㅽ뙣</p>
            <p className="text-xs mt-1 opacity-75">{error}</p>
          </div>
        </div>
      )}

      {/* 留먰븯??以??쒖떆 */}
      {isSpeaking && (
        <div className="absolute top-2 right-2 bg-green-600 bg-opacity-80 text-white text-xs px-3 py-1 rounded-full animate-pulse">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <span>?렎 留먰븯??以?/span>
          </div>
        </div>
      )}

      {/* ===== 紐⑥뀡 罹≪쿂 而⑦듃濡??곸뿭 ===== */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2" style={{ pointerEvents: 'all', zIndex: 1001 }}>

        {/* 紐⑤뱶 ?좏깮 ?쒕∼?ㅼ슫 (?쒖꽦 ?쒖뿉留??쒖떆) */}
        {isMotionCaptureEnabled && showModeSelector && (
          <div className="bg-gray-800 bg-opacity-95 rounded-lg shadow-xl border border-gray-600 overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700 font-medium">
              異붿쟻 紐⑤뱶 ?좏깮
            </div>
            {([
              { mode: 'face' as TrackingMode, icon: '??', label: '?쇨뎬留?, desc: '癒몃━쨌?댟룹엯 (媛踰쇱?)' },
              { mode: 'upper-body' as TrackingMode, icon: '?솈', label: '?곷컲????, desc: '?쇨뎬쨌紐명넻쨌?붋룹넀 (蹂댄넻)' },
              { mode: 'full-body' as TrackingMode, icon: '?룂', label: '?꾩떊+??, desc: '?꾩떊쨌?먃룸떎由?(臾닿굅?)' },
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
                {trackingMode === m && <span className="ml-auto text-xs">??/span>}
              </button>
            ))}
          </div>
        )}

        {/* 紐⑤뱶 ?좏깮 踰꾪듉 (?쒖꽦 ?쒖뿉留? */}
        {isMotionCaptureEnabled && (
          <button
            onClick={() => setShowModeSelector(!showModeSelector)}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-all shadow-lg"
          >
            {trackingMode === 'face' ? '?? ?쇨뎬' : trackingMode === 'upper-body' ? '?솈 ?곷컲???? : '?룂 ?꾩떊+??}
            <span className="ml-1">??/span>
          </button>
        )}

        {/* 硫붿씤 紐⑥뀡 罹≪쿂 ?좉? 踰꾪듉 */}
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
          {isMotionCaptureEnabled ? '?벞 紐⑥뀡 罹≪쿂 ON' : '?벞 紐⑥뀡 罹≪쿂'}
        </button>
      </div>

      {/* ?뱀틺 鍮꾨뵒??(?④?) */}
      {isMotionCaptureEnabled && videoRef && (
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          autoPlay
          playsInline
          muted
        />
      )}

      {/* 異붿쟻 ?곹깭 ?쒖떆 */}
      {isMotionCaptureEnabled && initStatus && (
        <div className="absolute top-2 left-2 bg-yellow-600 bg-opacity-90 text-white text-xs px-3 py-1 rounded-full animate-pulse">
          ??{initStatus}
        </div>
      )}

      {isMotionCaptureEnabled && isTrackingReady && !initStatus && (
        <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-90 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2">
          <span>??{trackingMode === 'face' ? '?쇨뎬' : trackingMode === 'upper-body' ? '?곷컲???? : '?꾩떊+??} 異붿쟻 以?/span>
          {bodyPose && (
            <span className="opacity-70">| ?좎껜 ??/span>
          )}
          {handPose && (handPose.left || handPose.right) && (
            <span className="opacity-70">| ????/span>
          )}
        </div>
      )}

      {trackingError && isMotionCaptureEnabled && (
        <div className="absolute top-2 left-2 bg-red-600 bg-opacity-90 text-white text-xs px-3 py-1 rounded-full">
          ??{trackingError}
        </div>
      )}

    </div>
  );
};

export default Live2DAvatarPixi;