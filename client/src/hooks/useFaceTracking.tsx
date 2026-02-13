import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Face } from 'kalidokit';

export interface FacePose {
    head: {
        x: number;
        y: number;
        z: number;
    };
    eye: {
        l: number;
        r: number;
    };
    mouth: {
        x: number;
        y: number;
        shape: {
            A: number;
            E: number;
            I: number;
            O: number;
            U: number;
        };
    };
    brow: number;
    pupil: {
        x: number;
        y: number;
    };
}

export function useFaceTracking(enabled: boolean = false) {
    const [facePose, setFacePose] = useState<FacePose | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // MediaPipe 초기화
    useEffect(() => {
        if (!enabled) return;

        let mounted = true;

        const initializeFaceLandmarker = async () => {
            try {
                console.log('🎥 MediaPipe FaceLandmarker 초기화 중...');

                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );

                const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                        delegate: 'GPU'
                    },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.5,
                    minFacePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                    outputFaceBlendshapes: true,
                    outputFacialTransformationMatrixes: true
                });

                if (mounted) {
                    faceLandmarkerRef.current = faceLandmarker;
                    setIsReady(true);
                    console.log('✅ FaceLandmarker 초기화 완료');
                }
            } catch (err) {
                console.error('❌ FaceLandmarker 초기화 실패:', err);
                if (mounted) {
                    setError('Face tracking 초기화 실패');
                }
            }
        };

        initializeFaceLandmarker();

        return () => {
            mounted = false;
            if (faceLandmarkerRef.current) {
                faceLandmarkerRef.current.close();
                faceLandmarkerRef.current = null;
            }
        };
    }, [enabled]);

    // 웹캠 스트림 시작
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
                        frameRate: { ideal: 30 }
                    }
                });

                if (!mounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                    console.log('✅ 웹캠 스트림 시작 완료');

                    // 비디오가 준비되면 추적 시작
                    videoRef.current.onloadedmetadata = () => {
                        if (mounted && videoRef.current) {
                            startTracking();
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
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [enabled, isReady]);

    // 얼굴 추적 루프
    const startTracking = () => {
        if (!videoRef.current || !faceLandmarkerRef.current) return;

        const video = videoRef.current;
        const faceLandmarker = faceLandmarkerRef.current;

        const detectFace = () => {
            if (!video || video.readyState !== 4 || !faceLandmarker) {
                animationFrameRef.current = requestAnimationFrame(detectFace);
                return;
            }

            const startTimeMs = performance.now();
            const results = faceLandmarker.detectForVideo(video, startTimeMs);

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];

                // Kalidokit으로 Live2D 파라미터 계산
                const riggedFace = Face.solve(landmarks, {
                    runtime: 'mediapipe',
                    video: video
                });

                if (riggedFace) {
                    setFacePose({
                        head: {
                            x: riggedFace.head.x,
                            y: riggedFace.head.y,
                            z: riggedFace.head.z
                        },
                        eye: {
                            l: riggedFace.eye.l,
                            r: riggedFace.eye.r
                        },
                        mouth: {
                            x: riggedFace.mouth.x,
                            y: riggedFace.mouth.y,
                            shape: {
                                A: riggedFace.mouth.shape.A || 0,
                                E: riggedFace.mouth.shape.E || 0,
                                I: riggedFace.mouth.shape.I || 0,
                                O: riggedFace.mouth.shape.O || 0,
                                U: riggedFace.mouth.shape.U || 0
                            }
                        },
                        brow: riggedFace.brow,
                        pupil: {
                            x: riggedFace.pupil.x,
                            y: riggedFace.pupil.y
                        }
                    });
                }
            }

            animationFrameRef.current = requestAnimationFrame(detectFace);
        };

        detectFace();
    };

    return {
        facePose,
        isReady,
        error,
        videoRef
    };
}
