# 모션 캡처 버튼 추가 - 간단 가이드

## 필요한 수정 (4단계만!)

### 1단계: Import 추가 (Line 4 다음에)

`Live2DAvatarPixi.tsx` 파일의 **4번째 줄** 다음에 이 한 줄을 추가하세요:

```typescript
import { useFaceTracking } from '@/hooks/useFaceTracking';
```

**결과:**
```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import { useSpeechAndAnimation } from '@/hooks/useSpeechAndAnimation';
import { useFaceTracking } from '@/hooks/useFaceTracking';  // ← 이 줄 추가
```

---

### 2단계: 상태 변수 추가 (Line 148 근처)

`const [isTTSReady, setIsTTSReady] = useState(false);` 줄 바로 다음에 추가:

```typescript
const [isMotionCaptureEnabled, setIsMotionCaptureEnabled] = useState(false);
```

---

### 3단계: 훅 사용 (Line 151 근처)

`const { speak, stopSpeaking, isSpeaking, cleanup } = useSpeechAndAnimation(live2dModelRef.current);` 줄 바로 다음에 추가:

```typescript
const { facePose, isReady: isFaceTrackingReady, error: faceTrackingError, videoRef } = useFaceTracking(isMotionCaptureEnabled);
```

---

### 4단계: UI 버튼 추가 (Line 1296 근처)

**찾아야 할 위치:** `{/* 말하는 중 표시 */}` 섹션 바로 다음

다음 코드를 복사해서 붙여넣기:

```tsx
{/* 모션 캡처 토글 버튼 */}
<button
  onClick={() => setIsMotionCaptureEnabled(!isMotionCaptureEnabled)}
  className={`absolute bottom-4 right-4 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all shadow-lg ${
    isMotionCaptureEnabled 
      ? 'bg-blue-600 hover:bg-blue-700' 
      : 'bg-gray-600 hover:bg-gray-700'
  }`}
  style={{ pointerEvents: 'all', zIndex: 1001 }}
>
  {isMotionCaptureEnabled ? '📹 모션 캡처 ON' : '📹 모션 캡처'}
</button>

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
{isMotionCaptureEnabled && isFaceTrackingReady && (
  <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-90 text-white text-xs px-3 py-1 rounded-full">
    ✅ 추적 중
  </div>
)}

{faceTrackingError && isMotionCaptureEnabled && (
  <div className="absolute top-2 left-2 bg-red-600 bg-opacity-90 text-white text-xs px-3 py-1 rounded-full">
    ❌ {faceTrackingError}
  </div>
)}
```

---

## 완료!

이제 Live2D 캐릭터 우측 하단에 "📹 모션 캡처" 버튼이 나타납니다.

클릭하면 웹캠 권한을 요청하고, 허용하면 얼굴 추적이 시작됩니다!
