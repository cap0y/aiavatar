import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FaceLandmarker,
  PoseLandmarker,
  HandLandmarker,
  FilesetResolver,
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

/** 신체 포즈 데이터 (Kalidokit Pose.solve 결과 매핑) */
export interface BodyPoseData {
  // 척추/몸통 회전
  spine: { x: number; y: number; z: number };
  // 골반
  hips: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
  // 팔
  rightUpperArm: { x: number; y: number; z: number };
  rightLowerArm: { x: number; y: number; z: number };
  leftUpperArm: { x: number; y: number; z: number };
  leftLowerArm: { x: number; y: number; z: number };
  // 손 위치 (포즈에서)
  rightHand: { x: number; y: number; z: number };
  leftHand: { x: number; y: number; z: number };
  // 다리
  rightUpperLeg: { x: number; y: number; z: number };
  rightLowerLeg: { x: number; y: number; z: number };
  leftUpperLeg: { x: number; y: number; z: number };
  leftLowerLeg: { x: number; y: number; z: number };
}

/** 손가락 데이터 (Kalidokit Hand.solve 결과) */
export interface HandFingerData {
  wrist: { x: number; y: number; z: number };
  // 각 손가락 proximal 관절 각도 (curl 정도) - x축 회전이 curl
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
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * 전신 모션 캡처 훅
 *
 * @param enabled  - 모션 캡처 활성화 여부
 * @param mode     - 추적 모드 ('face' | 'upper-body' | 'full-body')
 *
 * face       : 얼굴만 추적 (기존과 동일, 가벼움)
 * upper-body : 얼굴 + 상체/팔 추적
 * full-body  : 얼굴 + 전신 + 양손 상세 추적
 */
export function useMotionCapture(enabled: boolean = false, mode: TrackingMode = 'face') {
  const [facePose, setFacePose] = useState<FacePoseData | null>(null);
  const [bodyPose, setBodyPose] = useState<BodyPoseData | null>(null);
  const [handPose, setHandPose] = useState<HandPoseData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef(0);

  // ====== 1. MediaPipe 모델 초기화 ======
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const initialize = async () => {
      try {
        setInitStatus('MediaPipe 런타임 로딩...');
        console.log('🎥 MediaPipe 초기화 중... (모드:', mode, ')');

        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);

        // 1) FaceLandmarker (항상 초기화)
        setInitStatus('얼굴 인식 모델 로딩...');
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });

        if (!mounted) { faceLandmarker.close(); return; }
        faceLandmarkerRef.current = faceLandmarker;
        console.log('✅ FaceLandmarker 초기화 완료');

        // 2) PoseLandmarker (upper-body / full-body 모드)
        if (mode === 'upper-body' || mode === 'full-body') {
          setInitStatus('신체 인식 모델 로딩...');
          const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: POSE_MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          if (!mounted) { poseLandmarker.close(); return; }
          poseLandmarkerRef.current = poseLandmarker;
          console.log('✅ PoseLandmarker 초기화 완료');
        }

        // 3) HandLandmarker (full-body 모드만)
        if (mode === 'full-body') {
          setInitStatus('손 인식 모델 로딩...');
          const handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: HAND_MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          if (!mounted) { handLandmarker.close(); return; }
          handLandmarkerRef.current = handLandmarker;
          console.log('✅ HandLandmarker 초기화 완료');
        }

        if (mounted) {
          setIsReady(true);
          setInitStatus('');
          setError(null);
          console.log('✅ 모션 캡처 초기화 완료 (모드:', mode, ')');
        }
      } catch (err) {
        console.error('❌ 모션 캡처 초기화 실패:', err);
        if (mounted) {
          setError('모션 캡처 초기화 실패');
          setInitStatus('');
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
      handLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
      setIsReady(false);
    };
  }, [enabled, mode]);

  // ====== 2. 웹캠 시작 ======
  useEffect(() => {
    if (!enabled || !isReady) return;

    let mounted = true;

    const startWebcam = async () => {
      try {
        console.log('🎥 웹캠 스트림 시작 중...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          console.log('✅ 웹캠 스트림 시작 완료');

          videoRef.current.onloadedmetadata = () => {
            if (mounted && videoRef.current) {
              startDetectionLoop();
            }
          };
        }
      } catch (err) {
        console.error('❌ 웹캠 접근 실패:', err);
        if (mounted) {
          setError('웹캠 접근 권한이 필요합니다');
        }
      }
    };

    startWebcam();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, isReady]);

  // ====== 3. 감지 루프 ======
  const startDetectionLoop = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const detect = () => {
      if (!video || video.readyState !== 4) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const timestamp = performance.now();
      frameCountRef.current++;

      // --- (A) 얼굴 감지 (매 프레임) ---
      if (faceLandmarkerRef.current) {
        try {
          const faceResults = faceLandmarkerRef.current.detectForVideo(video, timestamp);

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
        } catch (e) {
          // 프레임 스킵 시 무시
        }
      }

      // --- (B) 신체 감지 (2프레임마다 - 성능 최적화) ---
      if (poseLandmarkerRef.current && frameCountRef.current % 2 === 0) {
        try {
          const poseResults = poseLandmarkerRef.current.detectForVideo(video, timestamp);

          if (
            poseResults.landmarks &&
            poseResults.landmarks.length > 0 &&
            poseResults.worldLandmarks &&
            poseResults.worldLandmarks.length > 0
          ) {
            const landmarks2D = poseResults.landmarks[0];
            const landmarks3D = poseResults.worldLandmarks[0];

            // Kalidokit Pose.solve: (3D world landmarks, 2D landmarks, options)
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
        } catch (e) {
          // 프레임 스킵 시 무시
        }
      }

      // --- (C) 손 감지 (3프레임마다 - 성능 최적화) ---
      if (handLandmarkerRef.current && frameCountRef.current % 3 === 0) {
        try {
          const handResults = handLandmarkerRef.current.detectForVideo(video, timestamp);

          if (handResults.landmarks && handResults.landmarks.length > 0) {
            let leftHandData: HandFingerData | null = null;
            let rightHandData: HandFingerData | null = null;

            for (let i = 0; i < handResults.landmarks.length; i++) {
              const handLandmarks = handResults.landmarks[i];
              const handedness = handResults.handednesses[i]?.[0]?.categoryName || 'Right';

              // Kalidokit Hand.solve()
              const riggedHand = Hand.solve(handLandmarks as any, handedness === 'Left' ? 'Left' : 'Right') as any;

              if (riggedHand) {
                const fingerData: HandFingerData = {
                  wrist: {
                    x: riggedHand[handedness + 'Wrist']?.x || 0,
                    y: riggedHand[handedness + 'Wrist']?.y || 0,
                    z: riggedHand[handedness + 'Wrist']?.z || 0,
                  },
                  // proximal 관절의 x 회전이 손가락 curl(구부림)을 나타냄
                  thumb: Math.abs(riggedHand[handedness + 'ThumbProximal']?.x || 0),
                  index: Math.abs(riggedHand[handedness + 'IndexProximal']?.x || 0),
                  middle: Math.abs(riggedHand[handedness + 'MiddleProximal']?.x || 0),
                  ring: Math.abs(riggedHand[handedness + 'RingProximal']?.x || 0),
                  little: Math.abs(riggedHand[handedness + 'LittleProximal']?.x || 0),
                };

                if (handedness === 'Left') {
                  leftHandData = fingerData;
                } else {
                  rightHandData = fingerData;
                }
              }
            }

            setHandPose({ left: leftHandData, right: rightHandData });
          }
        } catch (e) {
          // 프레임 스킵 시 무시
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, []);

  // ====== 4. 모드 변경 시 body/hand 데이터 리셋 ======
  useEffect(() => {
    if (mode === 'face') {
      setBodyPose(null);
      setHandPose(null);
    } else if (mode === 'upper-body') {
      setHandPose(null);
    }
  }, [mode]);

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

