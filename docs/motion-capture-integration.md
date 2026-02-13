# 웹캠 모션 캡처 통합 가이드

## 개요
`useFaceTracking.tsx` 훅을 `Live2DAvatarPixi.tsx`에 통합하여 웹캠으로 얼굴을 추적하고 Live2D 캐릭터를 제어하는 방법입니다.

## 1. Import 추가

`Live2DAvatarPixi.tsx` 파일 상단에 다음을 추가하세요:

```typescript
import { useFaceTracking } from '@/hooks/useFaceTracking';
```

## 2. 상태 변수 추가

컴포넌트 내부의 state 선언 부분에 다음을 추가하세요 (line 148 근처):

```typescript
const [isMotionCaptureEnabled, setIsMotionCaptureEnabled] = useState(false);
```

## 3. useFaceTracking 훅 사용

`useSpeechAndAnimation` 훅 바로 아래에 다음을 추가하세요 (line 151 근처):

```typescript
// 얼굴 추적 (웹캠 모션 캡처)
const { facePose, isReady, error: trackingError, videoRef } = useFaceTracking(isMotionCaptureEnabled);
```

## 4. 얼굴 데이터를 모델에 적용

`useEffect`를 추가하여 추적 데이터를 모델에 적용하세요:

```typescript
// 모션 캡처 데이터를 Live2D 모델에 적용
useEffect(() => {
  if (!isMotionCaptureEnabled || !facePose || !live2dModelRef.current) return;
  
  const model = live2dModelRef.current as any;
  if (!model.internalModel) return;
  
  try {
    // 머리 회전
    model.internalModel.coreModel.setParameterValueById('ParamAngleX', facePose.head.x * 30);
    model.internalModel.coreModel.setParameterValueById('ParamAngleY', facePose.head.y * 30);
    model.internalModel.coreModel.setParameterValueById('ParamAngleZ', facePose.head.z * 30);
    
    // 눈 깜빡임
    model.internalModel.coreModel.setParameterValueById('ParamEyeLOpen', facePose.eye.l);
    model.internalModel.coreModel.setParameterValueById('ParamEyeROpen', facePose.eye.r);
    
    // 입 모양 (말하는 중이 아닐 때만)
    if (!isSpeaking) {
      model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', facePose.mouth.y);
    }
  } catch (err) {
    console.warn('모션 캡처 적용 실패:', err);
  }
}, [facePose, isMotionCaptureEnabled, isSpeaking]);
```

## 5. UI 토글 버튼 추가

return 문의 JSX에서 `{/* 말하는 중 표시 */}` 섹션 바로 아래에 다음을 추가하세요 (line 1296 근처):

```tsx
{/* 모션 캡처 토글 버튼 */}
<button
  onClick={() => setIsMotionCaptureEnabled(!isMotionCaptureEnabled)}
  className={`absolute bottom-4 right-4 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all ${
    isMotionCaptureEnabled 
      ? 'bg-blue-600 hover:bg-blue-700' 
      : 'bg-gray-600 hover:bg-gray-700'
  }`}
  style={{ pointerEvents: 'all', zIndex: 1001 }}
>
  {isMotionCaptureEnabled ? '📹 모션 캡처 (ON)' : '📹 모션 캡처 (OFF)'}
</button>

{/* 웹캠 비디오 (숨김) */}
{isMotionCaptureEnabled && (
  <video
    ref={videoRef}
    style={{ display: 'none' }}
    autoPlay
    playsInline
    muted
  />
)}

{/* 얼굴 추적 상태 표시 */}
{isMotionCaptureEnabled && isReady && (
  <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-80 text-white text-xs px-3 py-1 rounded-full">
    <span>✅ 추적 중</span>
  </div>
)}

{trackingError && isMotionCaptureEnabled && (
  <div className="absolute top-2 left-2 bg-red-600 bg-opacity-80 text-white text-xs px-3 py-1 rounded-full">
    <span>❌ {trackingError}</span>
  </div>
)}
```

## 6. 사용 방법

1. 애플리케이션을 실행합니다.
2. 화면 우측 하단의 "모션 캡처" 버튼을 클릭합니다.
3. 브라우저에서 웹캠 권한을 요청하면 허용합니다.
4. 얼굴이 인식되면 캐릭터가 움직임을 따라합니다.

## 주의사항

- 웹캠 권한이 필요합니다.
- 조명이 충분한 환경에서 사용하세요.
- 모션 캡처가 활성화되면 TTS 립싱크가 일시적으로 비활성화됩니다.
- 성능에 영향을 줄 수 있으므로 필요할 때만 사용하세요.

## 라이브러리 정보

- **@mediapipe/tasks-vision**: Google의 얼굴 인식 라이브러리
- **kalidokit**: MediaPipe 데이터를 Live2D 파라미터로 변환하는 라이브러리
