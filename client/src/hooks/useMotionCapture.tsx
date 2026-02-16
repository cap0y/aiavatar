import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FaceLandmarker,
  PoseLandmarker,
  HandLandmarker,
  FilesetResolver,
  type FilesetResolver as VisionType,
} from '@mediapipe/tasks-vision';
import { Face, Pose, Hand } from 'kalidokit';

// ===== 타입 정의 =====

/** 추적 모드: face(얼굴만), upper-body(상반신), full-body(전신+손) */
export type TrackingMode = 'face' | 'upper-body' | 'full-body';

/** 얼굴 포즈 데이터 */
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

/** 신체 포즈 데이터 */
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

/** 손가락 데이터 */
export interface HandFingerData {
  wrist: { x: number; y: number; z: number };
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  little: number;
}

/** 양손 데이터 */
export interface HandPoseData {
  left: HandFingerData | null;
  right: HandFingerData | null;
}

// CDN 경로 상수
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// full 모델 사용 (heavy는 너무 무거움, lite는 정확도 낮음)
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * GPU → CPU 자동 폴백으로 Landmarker를 생성하는 헬퍼
 */
async function createWithFallback<T>(
  factory: (delegate: 'GPU' | 'CPU') => Promise<T>,
  name: string,
): Promise<T> {
  try {
    const result = await factory('GPU');
    console.log(`✅ ${name} 초기화 완료 (GPU)`);
    return result;
  } catch (gpuErr) {
    console.warn(`⚠️ ${name} GPU 실패, CPU로 전환:`, gpuErr);
    const result = await factory('CPU');
    console.log(`✅ ${name} 초기화 완료 (CPU)`);
    return result;
  }
}

/**
 * 전신 모션 캡처 훅
 *
 * 구조:
 *  Effect 1: Vision 런타임 로드 (enabled 의존)
 *  Effect 2: FaceLandmarker 초기화 (enabled + vision 의존)
 *  Effect 3: 웹캠 + 감지 루프 (enabled + face ready 의존) ← 모드 변경에 무관
 *  Effect 4: PoseLandmarker 초기화/해제 (enabled + vision + mode 의존) ← 별도 관리
 *  Effect 5: HandLandmarker 초기화/해제 (enabled + vision + mode 의존) ← 별도 관리
 *
 * 모드를 바꿔도 웹캠과 얼굴 추적은 끊기지 않습니다.
 */
export function useMotionCapture(enabled: boolean = false, mode: TrackingMode = 'face') {
  const [facePose, setFacePose] = useState<FacePoseData | null>(null);
  const [bodyPose, setBodyPose] = useState<BodyPoseData | null>(null);
  const [handPose, setHandPose] = useState<HandPoseData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState('');

  const [visionLoaded, setVisionLoaded] = useState(false); // vision 로드 완료 → 리렌더 트리거

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visionRef = useRef<any>(null); // FilesetResolver 결과 (실제 객체)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef(0);
  const lastPoseTimestampRef = useRef(0);
  const lastHandTimestampRef = useRef(0);

  // ====== Effect 1: Vision 런타임 로드 ======
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const loadVision = async () => {
      try {
        setInitStatus('MediaPipe 런타임 로딩...');
        console.log('🎥 MediaPipe Vision 런타임 로딩 중...');
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);
        if (mounted) {
          visionRef.current = vision;
          setVisionLoaded(true); // ← 리렌더 트리거 → Effect 2,4,5 실행
          console.log('✅ Vision 런타임 로드 완료');
        }
      } catch (err) {
        console.error('❌ Vision 런타임 로드 실패:', err);
        if (mounted) {
          setError('MediaPipe 런타임 로드 실패');
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

  // ====== Effect 2: FaceLandmarker 초기화 (모드 전환과 무관) ======
  useEffect(() => {
    if (!enabled || !visionLoaded || !visionRef.current) return;
    let mounted = true;

    const initFace = async () => {
      try {
        setInitStatus('얼굴 인식 모델 로딩...');

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
        console.error('❌ FaceLandmarker 초기화 실패:', err);
        if (mounted) {
          setError('얼굴 인식 모델 로드 실패');
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

  // ====== Effect 3: 웹캠 + 감지 루프 (모드 전환에 무관) ======
  useEffect(() => {
    if (!enabled || !isReady) return;
    let mounted = true;

    const startWebcam = async () => {
      try {
        // 이미 스트림이 있으면 재사용
        if (streamRef.current) {
          startDetectionLoop();
          return;
        }

        console.log('🎥 웹캠 스트림 시작 중...');
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
          console.log('✅ 웹캠 스트림 시작 완료');

          // 비디오 준비 완료 후 감지 시작
          if (videoRef.current.readyState >= 2) {
            startDetectionLoop();
          } else {
            videoRef.current.onloadeddata = () => {
              if (mounted) startDetectionLoop();
            };
          }
        }
      } catch (err) {
        console.error('❌ 웹캠 접근 실패:', err);
        if (mounted) setError('웹캠 접근 권한이 필요합니다');
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

  // ====== Effect 4: PoseLandmarker (모드 변경 시에만 추가/제거) ======
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
        setInitStatus('신체 인식 모델 로딩...');

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
        console.error('❌ PoseLandmarker 초기화 실패:', err);
        if (mounted) setInitStatus('');
      }
    };

    initPose();

    return () => {
      mounted = false;
    };
  }, [enabled, visionLoaded, mode]);

  // ====== Effect 5: HandLandmarker (full-body 모드에서만) ======
  useEffect(() => {
    if (!enabled || !visionLoaded || !visionRef.current) return;
    const needsHand = mode === 'full-body';
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
        setInitStatus('손 인식 모델 로딩...');

        const handLandmarker = await createWithFallback(
          (delegate) =>
            HandLandmarker.createFromOptions(visionRef.current, {
              baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.5,
              minHandPresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            }),
          'HandLandmarker',
        );

        if (!mounted) { handLandmarker.close(); return; }
        handLandmarkerRef.current = handLandmarker;
        lastHandTimestampRef.current = 0;
        setInitStatus('');
      } catch (err) {
        console.error('❌ HandLandmarker 초기화 실패:', err);
        if (mounted) setInitStatus('');
      }
    };

    initHand();

    return () => {
      mounted = false;
    };
  }, [enabled, visionLoaded, mode]);

  // ====== 감지 루프 (ref 기반이므로 모드 전환에도 끊기지 않음) ======
  const startDetectionLoop = useCallback(() => {
    if (!videoRef.current) return;

    // 기존 루프가 있으면 취소
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

      // MediaPipe는 타임스탬프가 단조 증가해야 함
      // 각 landmarker별로 별도 타임스탬프 관리

      // ---- (A) 얼굴 감지 (매 프레임) ----
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
          // 프레임 스킵 시 무시
        }
      }

      // ---- (B) 신체 감지 (2프레임마다) ----
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
          // 프레임 스킵 시 무시
        }
      }

      // ---- (C) 손 감지 (3프레임마다) ----
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
                const fingerData: HandFingerData = {
                  wrist: {
                    x: riggedHand[side + 'Wrist']?.x || 0,
                    y: riggedHand[side + 'Wrist']?.y || 0,
                    z: riggedHand[side + 'Wrist']?.z || 0,
                  },
                  thumb: Math.abs(riggedHand[side + 'ThumbProximal']?.x || 0),
                  index: Math.abs(riggedHand[side + 'IndexProximal']?.x || 0),
                  middle: Math.abs(riggedHand[side + 'MiddleProximal']?.x || 0),
                  ring: Math.abs(riggedHand[side + 'RingProximal']?.x || 0),
                  little: Math.abs(riggedHand[side + 'LittleProximal']?.x || 0),
                };

                if (side === 'Left') leftHandData = fingerData;
                else rightHandData = fingerData;
              }
            }

            setHandPose({ left: leftHandData, right: rightHandData });
          }
        } catch {
          // 프레임 스킵 시 무시
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, []);

  // ====== 전체 비활성화 시 정리 ======
  useEffect(() => {
    if (enabled) return;

    // 모든 것 정리
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
