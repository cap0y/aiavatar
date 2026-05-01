import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FaceLandmarker,
  PoseLandmarker,
  HandLandmarker,
  FilesetResolver,
  type FilesetResolver as VisionType,
} from '@mediapipe/tasks-vision';
import { Face, Pose, Hand } from 'kalidokit';

// ===== ????뺤쓽 =====

/** 異붿쟻 紐⑤뱶: face(?쇨뎬留?, upper-body(?곷컲????, full-body(?꾩떊+?? */
export type TrackingMode = 'face' | 'upper-body' | 'full-body';

/** ?쇨뎬 ?ъ쫰 ?곗씠??*/
export interface FacePoseData {
  head: { x: number; y: number; z: number };
  eye: { l: number; r: number };
  mouth: {
    x: number;
    y: number;
    shape: { A: number; E: number; I: number; O: number; U: number };
  };
  brow: number;
  pupil: { x: number; y: number };
}

/** ?좎껜 ?ъ쫰 ?곗씠??*/
export interface BodyPoseData {
  spine: { x: number; y: number; z: number };
  hips: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
  rightUpperArm: { x: number; y: number; z: number };
  rightLowerArm: { x: number; y: number; z: number };
  leftUpperArm: { x: number; y: number; z: number };
  leftLowerArm: { x: number; y: number; z: number };
  rightHand: { x: number; y: number; z: number };
  leftHand: { x: number; y: number; z: number };
  rightUpperLeg: { x: number; y: number; z: number };
  rightLowerLeg: { x: number; y: number; z: number };
  leftUpperLeg: { x: number; y: number; z: number };
  leftLowerLeg: { x: number; y: number; z: number };
}

/** ?먭????곗씠??*/
export interface HandFingerData {
  wrist: { x: number; y: number; z: number };
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  little: number;
}

/** ?묒넀 ?곗씠??*/
export interface HandPoseData {
  left: HandFingerData | null;
  right: HandFingerData | null;
}

// CDN 寃쎈줈 ?곸닔
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// full 紐⑤뜽 ?ъ슜 (heavy???덈Т 臾닿굅?, lite???뺥솗????쓬)
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * GPU ??CPU ?먮룞 ?대갚?쇰줈 Landmarker瑜??앹꽦?섎뒗 ?ы띁
 */
async function createWithFallback<T>(
  factory: (delegate: 'GPU' | 'CPU') => Promise<T>,
  name: string,
): Promise<T> {
  try {
    const result = await factory('GPU');
    console.log(`??${name} 珥덇린???꾨즺 (GPU)`);
    return result;
  } catch (gpuErr) {
    console.warn(`?좑툘 ${name} GPU ?ㅽ뙣, CPU濡??꾪솚:`, gpuErr);
    const result = await factory('CPU');
    console.log(`??${name} 珥덇린???꾨즺 (CPU)`);
    return result;
  }
}

/**
 * ?꾩떊 紐⑥뀡 罹≪쿂 ?? *
 * 援ъ“:
 *  Effect 1: Vision ?고???濡쒕뱶 (enabled ?섏〈)
 *  Effect 2: FaceLandmarker 珥덇린??(enabled + vision ?섏〈)
 *  Effect 3: ?뱀틺 + 媛먯? 猷⑦봽 (enabled + face ready ?섏〈) ??紐⑤뱶 蹂寃쎌뿉 臾닿?
 *  Effect 4: PoseLandmarker 珥덇린???댁젣 (enabled + vision + mode ?섏〈) ??蹂꾨룄 愿由? *  Effect 5: HandLandmarker 珥덇린???댁젣 (enabled + vision + mode ?섏〈) ??蹂꾨룄 愿由? *
 * 紐⑤뱶瑜?諛붽퓭???뱀틺怨??쇨뎬 異붿쟻? ?딄린吏 ?딆뒿?덈떎.
 */
export function useMotionCapture(enabled: boolean = false, mode: TrackingMode = 'face') {
  const [facePose, setFacePose] = useState<FacePoseData | null>(null);
  const [bodyPose, setBodyPose] = useState<BodyPoseData | null>(null);
  const [handPose, setHandPose] = useState<HandPoseData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState('');

  const [visionLoaded, setVisionLoaded] = useState(false); // vision 濡쒕뱶 ?꾨즺 ??由щ젋???몃━嫄?
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visionRef = useRef<any>(null); // FilesetResolver 寃곌낵 (?ㅼ젣 媛앹껜)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef(0);
  const lastPoseTimestampRef = useRef(0);
  const lastHandTimestampRef = useRef(0);

  // ====== Effect 1: Vision ?고???濡쒕뱶 ======
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const loadVision = async () => {
      try {
        setInitStatus('MediaPipe ?고???濡쒕뵫...');
        console.log('?렏 MediaPipe Vision ?고???濡쒕뵫 以?..');
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);
        if (mounted) {
          visionRef.current = vision;
          setVisionLoaded(true); // ??由щ젋???몃━嫄???Effect 2,4,5 ?ㅽ뻾
          console.log('??Vision ?고???濡쒕뱶 ?꾨즺');
        }
      } catch (err) {
        console.error('??Vision ?고???濡쒕뱶 ?ㅽ뙣:', err);
        if (mounted) {
          setError('MediaPipe ?고???濡쒕뱶 ?ㅽ뙣');
          setInitStatus('');
        }
      }
    };

    loadVision();

    return () => {
      mounted = false;
      visionRef.current = null;
      setVisionLoaded(false);
    };
  }, [enabled]);

  // ====== Effect 2: FaceLandmarker 珥덇린??(紐⑤뱶 ?꾪솚怨?臾닿?) ======
  useEffect(() => {
    if (!enabled || !visionLoaded || !visionRef.current) return;
    let mounted = true;

    const initFace = async () => {
      try {
        setInitStatus('?쇨뎬 ?몄떇 紐⑤뜽 濡쒕뵫...');

        const faceLandmarker = await createWithFallback(
          (delegate) =>
            FaceLandmarker.createFromOptions(visionRef.current, {
              baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
              runningMode: 'VIDEO',
              numFaces: 1,
              minFaceDetectionConfidence: 0.5,
              minFacePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
              outputFaceBlendshapes: true,
              outputFacialTransformationMatrixes: true,
            }),
          'FaceLandmarker',
        );

        if (!mounted) { faceLandmarker.close(); return; }
        faceLandmarkerRef.current = faceLandmarker;
        setIsReady(true);
        setInitStatus('');
        setError(null);
      } catch (err) {
        console.error('??FaceLandmarker 珥덇린???ㅽ뙣:', err);
        if (mounted) {
          setError('?쇨뎬 ?몄떇 紐⑤뜽 濡쒕뱶 ?ㅽ뙣');
          setInitStatus('');
        }
      }
    };

    initFace();

    return () => {
      mounted = false;
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
      setIsReady(false);
    };
  }, [enabled, visionLoaded]);

  // ====== Effect 3: ?뱀틺 + 媛먯? 猷⑦봽 (紐⑤뱶 ?꾪솚??臾닿?) ======
  useEffect(() => {
    if (!enabled || !isReady) return;
    let mounted = true;

    const startWebcam = async () => {
      try {
        // ?대? ?ㅽ듃由쇱씠 ?덉쑝硫??ъ궗??        if (streamRef.current) {
          startDetectionLoop();
          return;
        }

        console.log('?렏 ?뱀틺 ?ㅽ듃由??쒖옉 以?..');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log('???뱀틺 ?ㅽ듃由??쒖옉 ?꾨즺');

          // 鍮꾨뵒??以鍮??꾨즺 ??媛먯? ?쒖옉
          if (videoRef.current.readyState >= 2) {
            startDetectionLoop();
          } else {
            videoRef.current.onloadeddata = () => {
              if (mounted) startDetectionLoop();
            };
          }
        }
      } catch (err) {
        console.error('???뱀틺 ?묎렐 ?ㅽ뙣:', err);
        if (mounted) setError('?뱀틺 ?묎렐 沅뚰븳???꾩슂?⑸땲??);
      }
    };

    startWebcam();

    return () => {
      mounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [enabled, isReady]);

  // ====== Effect 4: PoseLandmarker (紐⑤뱶 蹂寃??쒖뿉留?異붽?/?쒓굅) ======
  useEffect(() => {
    if (!enabled || !visionLoaded || !visionRef.current) return;
    const needsPose = mode === 'upper-body' || mode === 'full-body';
    if (!needsPose) {
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
      setBodyPose(null);
      return;
    }

    let mounted = true;

    const initPose = async () => {
      if (poseLandmarkerRef.current) return;

      try {
        setInitStatus('?좎껜 ?몄떇 紐⑤뜽 濡쒕뵫...');

        const poseLandmarker = await createWithFallback(
          (delegate) =>
            PoseLandmarker.createFromOptions(visionRef.current, {
              baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
              runningMode: 'VIDEO',
              numPoses: 1,
              minPoseDetectionConfidence: 0.5,
              minPosePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            }),
          'PoseLandmarker',
        );

        if (!mounted) { poseLandmarker.close(); return; }
        poseLandmarkerRef.current = poseLandmarker;
        lastPoseTimestampRef.current = 0;
        setInitStatus('');
      } catch (err) {
        console.error('??PoseLandmarker 珥덇린???ㅽ뙣:', err);
        if (mounted) setInitStatus('');
      }
    };

    initPose();

    return () => {
      mounted = false;
    };
  }, [enabled, visionLoaded, mode]);

  // ====== Effect 5: HandLandmarker (upper-body / full-body 紐⑤뱶?먯꽌 ?쒖꽦) ======
  useEffect(() => {
    if (!enabled || !visionLoaded || !visionRef.current) return;
    const needsHand = mode === 'upper-body' || mode === 'full-body';
    if (!needsHand) {
      handLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
      setHandPose(null);
      return;
    }

    let mounted = true;

    const initHand = async () => {
      if (handLandmarkerRef.current) return;

      try {
        setInitStatus('???몄떇 紐⑤뜽 濡쒕뵫...');

        const handLandmarker = await createWithFallback(
          (delegate) =>
            HandLandmarker.createFromOptions(visionRef.current, {
              baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.4,
              minHandPresenceConfidence: 0.4,
              minTrackingConfidence: 0.4,
            }),
          'HandLandmarker',
        );

        if (!mounted) { handLandmarker.close(); return; }
        handLandmarkerRef.current = handLandmarker;
        lastHandTimestampRef.current = 0;
        setInitStatus('');
      } catch (err) {
        console.error('??HandLandmarker 珥덇린???ㅽ뙣:', err);
        if (mounted) setInitStatus('');
      }
    };

    initHand();

    return () => {
      mounted = false;
    };
  }, [enabled, visionLoaded, mode]);

  // ====== 媛먯? 猷⑦봽 (ref 湲곕컲?대?濡?紐⑤뱶 ?꾪솚?먮룄 ?딄린吏 ?딆쓬) ======
  const startDetectionLoop = useCallback(() => {
    if (!videoRef.current) return;

    // 湲곗〈 猷⑦봽媛 ?덉쑝硫?痍⑥냼
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const video = videoRef.current;
    let lastFaceTimestamp = 0;

    const detect = () => {
      if (!video || video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const now = performance.now();
      frameCountRef.current++;

      // MediaPipe????꾩뒪?ы봽媛 ?⑥“ 利앷??댁빞 ??      // 媛?landmarker蹂꾨줈 蹂꾨룄 ??꾩뒪?ы봽 愿由?
      // ---- (A) ?쇨뎬 媛먯? (留??꾨젅?? ----
      const faceRef = faceLandmarkerRef.current;
      if (faceRef && now > lastFaceTimestamp) {
        try {
          lastFaceTimestamp = now;
          const faceResults = faceRef.detectForVideo(video, now);

          if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
            const landmarks = faceResults.faceLandmarks[0];
            const riggedFace = Face.solve(landmarks as any, {
              runtime: 'mediapipe',
              video,
            });

            if (riggedFace) {
              setFacePose({
                head: { x: riggedFace.head.x, y: riggedFace.head.y, z: riggedFace.head.z },
                eye: { l: riggedFace.eye.l, r: riggedFace.eye.r },
                mouth: {
                  x: riggedFace.mouth.x,
                  y: riggedFace.mouth.y,
                  shape: {
                    A: riggedFace.mouth.shape.A || 0,
                    E: riggedFace.mouth.shape.E || 0,
                    I: riggedFace.mouth.shape.I || 0,
                    O: riggedFace.mouth.shape.O || 0,
                    U: riggedFace.mouth.shape.U || 0,
                  },
                },
                brow: riggedFace.brow,
                pupil: { x: riggedFace.pupil.x, y: riggedFace.pupil.y },
              });
            }
          }
        } catch {
          // ?꾨젅???ㅽ궢 ??臾댁떆
        }
      }

      // ---- (B) ?좎껜 媛먯? (2?꾨젅?꾨쭏?? ----
      const poseRef = poseLandmarkerRef.current;
      if (poseRef && frameCountRef.current % 2 === 0 && now > lastPoseTimestampRef.current) {
        try {
          lastPoseTimestampRef.current = now;
          const poseResults = poseRef.detectForVideo(video, now);

          if (
            poseResults.landmarks?.length > 0 &&
            poseResults.worldLandmarks?.length > 0
          ) {
            const landmarks2D = poseResults.landmarks[0];
            const landmarks3D = poseResults.worldLandmarks[0];

            const riggedPose = Pose.solve(landmarks3D as any, landmarks2D as any, {
              runtime: 'mediapipe',
              video,
            });

            if (riggedPose) {
              setBodyPose({
                spine: {
                  x: riggedPose.Spine?.x || 0,
                  y: riggedPose.Spine?.y || 0,
                  z: riggedPose.Spine?.z || 0,
                },
                hips: {
                  position: {
                    x: riggedPose.Hips?.position?.x || 0,
                    y: riggedPose.Hips?.position?.y || 0,
                    z: riggedPose.Hips?.position?.z || 0,
                  },
                  rotation: {
                    x: riggedPose.Hips?.rotation?.x || 0,
                    y: riggedPose.Hips?.rotation?.y || 0,
                    z: riggedPose.Hips?.rotation?.z || 0,
                  },
                },
                rightUpperArm: {
                  x: riggedPose.RightUpperArm?.x || 0,
                  y: riggedPose.RightUpperArm?.y || 0,
                  z: riggedPose.RightUpperArm?.z || 0,
                },
                rightLowerArm: {
                  x: riggedPose.RightLowerArm?.x || 0,
                  y: riggedPose.RightLowerArm?.y || 0,
                  z: riggedPose.RightLowerArm?.z || 0,
                },
                leftUpperArm: {
                  x: riggedPose.LeftUpperArm?.x || 0,
                  y: riggedPose.LeftUpperArm?.y || 0,
                  z: riggedPose.LeftUpperArm?.z || 0,
                },
                leftLowerArm: {
                  x: riggedPose.LeftLowerArm?.x || 0,
                  y: riggedPose.LeftLowerArm?.y || 0,
                  z: riggedPose.LeftLowerArm?.z || 0,
                },
                rightHand: {
                  x: riggedPose.RightHand?.x || 0,
                  y: riggedPose.RightHand?.y || 0,
                  z: riggedPose.RightHand?.z || 0,
                },
                leftHand: {
                  x: riggedPose.LeftHand?.x || 0,
                  y: riggedPose.LeftHand?.y || 0,
                  z: riggedPose.LeftHand?.z || 0,
                },
                rightUpperLeg: {
                  x: riggedPose.RightUpperLeg?.x || 0,
                  y: riggedPose.RightUpperLeg?.y || 0,
                  z: riggedPose.RightUpperLeg?.z || 0,
                },
                rightLowerLeg: {
                  x: riggedPose.RightLowerLeg?.x || 0,
                  y: riggedPose.RightLowerLeg?.y || 0,
                  z: riggedPose.RightLowerLeg?.z || 0,
                },
                leftUpperLeg: {
                  x: riggedPose.LeftUpperLeg?.x || 0,
                  y: riggedPose.LeftUpperLeg?.y || 0,
                  z: riggedPose.LeftUpperLeg?.z || 0,
                },
                leftLowerLeg: {
                  x: riggedPose.LeftLowerLeg?.x || 0,
                  y: riggedPose.LeftLowerLeg?.y || 0,
                  z: riggedPose.LeftLowerLeg?.z || 0,
                },
              });
            }
          }
        } catch {
          // ?꾨젅???ㅽ궢 ??臾댁떆
        }
      }

      // ---- (C) ??媛먯? (3?꾨젅?꾨쭏?? ----
      const handRef = handLandmarkerRef.current;
      if (handRef && frameCountRef.current % 3 === 0 && now > lastHandTimestampRef.current) {
        try {
          lastHandTimestampRef.current = now;
          const handResults = handRef.detectForVideo(video, now);

          if (handResults.landmarks && handResults.landmarks.length > 0) {
            let leftHandData: HandFingerData | null = null;
            let rightHandData: HandFingerData | null = null;

            for (let i = 0; i < handResults.landmarks.length; i++) {
              const handLandmarks = handResults.landmarks[i];
              const handedness = handResults.handednesses[i]?.[0]?.categoryName || 'Right';
              const side = handedness === 'Left' ? 'Left' : 'Right';

              const riggedHand = Hand.solve(handLandmarks as any, side) as any;

              if (riggedHand) {
                // ?먭???援쏀옒 ?뺣룄: z異?媛곷룄(?덈뙎媛?媛 ?댁닔濡??먭??쎌씠 ??援쎌뼱 ?덉쓬
                // 媛??먭??쎌쓽 Proximal쨌Intermediate쨌Distal 紐⑤뱺 愿???됯퇏
                const fingerCurl = (name: string) => {
                  const proximal  = Math.abs(riggedHand[`${side}${name}Proximal`]?.z  || 0);
                  const inter     = Math.abs(riggedHand[`${side}${name}Intermediate`]?.z || 0);
                  const distal    = Math.abs(riggedHand[`${side}${name}Distal`]?.z    || 0);
                  return Math.min(1, (proximal + inter + distal) / (Math.PI * 1.5));
                };

                const fingerData: HandFingerData = {
                  wrist: {
                    x: riggedHand[side + 'Wrist']?.x || 0,
                    y: riggedHand[side + 'Wrist']?.y || 0,
                    z: riggedHand[side + 'Wrist']?.z || 0,
                  },
                  thumb:  fingerCurl('Thumb'),
                  index:  fingerCurl('Index'),
                  middle: fingerCurl('Middle'),
                  ring:   fingerCurl('Ring'),
                  little: fingerCurl('Little'),
                };

                if (side === 'Left') leftHandData = fingerData;
                else rightHandData = fingerData;
              }
            }

            setHandPose({ left: leftHandData, right: rightHandData });
          }
        } catch {
          // ?꾨젅???ㅽ궢 ??臾댁떆
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, []);

  // ====== ?꾩껜 鍮꾪솢?깊솕 ???뺣━ ======
  useEffect(() => {
    if (enabled) return;

    // 紐⑤뱺 寃??뺣━
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    faceLandmarkerRef.current?.close();
    faceLandmarkerRef.current = null;
    poseLandmarkerRef.current?.close();
    poseLandmarkerRef.current = null;
    handLandmarkerRef.current?.close();
    handLandmarkerRef.current = null;
    visionRef.current = null;

    setFacePose(null);
    setBodyPose(null);
    setHandPose(null);
    setIsReady(false);
    setVisionLoaded(false);
    setError(null);
    setInitStatus('');
  }, [enabled]);

  return {
    facePose,
    bodyPose,
    handPose,
    isReady,
    error,
    initStatus,
    videoRef,
  };
}