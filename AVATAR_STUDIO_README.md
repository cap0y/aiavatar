# 🎨 Live2D 아바타 스튜디오

**Cubism WebFramework SDK**를 직접 활용한 고급 2D Live 모델 파라미터 제어 시스템

---

## 📋 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [사용 방법](#사용-방법)
- [Cubism SDK 통합](#cubism-sdk-통합)
- [API 레퍼런스](#api-레퍼런스)
- [개발 가이드](#개발-가이드)

---

## 🎯 개요

**Live2D 아바타 스튜디오**는 Cubism WebFramework SDK를 사용하여 Live2D 모델의 **모든 파라미터를 세밀하게 제어**할 수 있는 고급 개발 도구입니다.

### 주요 차별점

| 기능 | 아바타 메이커 | 아바타 스튜디오 |
|------|--------------|----------------|
| **기술 스택** | pixi-live2d-display | Cubism WebFramework SDK |
| **제어 수준** | 기본 (감정, 변형) | 고급 (개별 파라미터) |
| **파라미터 접근** | 제한적 | 완전한 접근 |
| **표정 편집** | 프리셋만 | 커스텀 생성 가능 |
| **효과 제어** | 없음 | 호흡, 눈 깜빡임 등 |
| **파트 제어** | 없음 | 불투명도 개별 제어 |
| **용도** | 일반 사용자 | 개발자/고급 사용자 |

---

## ✨ 주요 기능

### 1️⃣ **파라미터 세밀 제어** (Parameters)

Live2D 모델의 **모든 파라미터**를 개별적으로 조정 가능:

#### 📐 **각도 제어**
- `ParamAngleX`: 머리 좌우 회전 (-30° ~ 30°)
- `ParamAngleY`: 머리 위아래 회전 (-30° ~ 30°)
- `ParamAngleZ`: 머리 기울기 (-30° ~ 30°)
- `ParamBodyAngleX`, `ParamBodyAngleY`, `ParamBodyAngleZ`: 몸 각도

#### 👁️ **눈 제어**
- `ParamEyeLOpen` / `ParamEyeROpen`: 왼쪽/오른쪽 눈 열림 (0 ~ 1)
- `ParamEyeLSmile` / `ParamEyeRSmile`: 눈 웃음 (0 ~ 1)
- `ParamEyeBallX` / `ParamEyeBallY`: 눈동자 위치 (-1 ~ 1)
- `ParamEyeBallForm`: 눈동자 형태 (0 ~ 1)

#### 👁️‍🗨️ **눈썹 제어**
- `ParamBrowLY` / `ParamBrowRY`: 눈썹 위아래 (-1 ~ 1)
- `ParamBrowLX` / `ParamBrowRX`: 눈썹 좌우 (-1 ~ 1)
- `ParamBrowLAngle` / `ParamBrowRAngle`: 눈썹 각도 (-1 ~ 1)
- `ParamBrowLForm` / `ParamBrowRForm`: 눈썹 형태 (-1 ~ 1)

#### 👄 **입 제어**
- `ParamMouthForm`: 입 모양 (-1 ~ 1)
- `ParamMouthOpenY`: 입 열림 (0 ~ 1)

#### 💪 **팔 제어**
- `ParamArmLA` / `ParamArmRA`: 왼팔/오른팔 A (-10 ~ 10)
- `ParamArmLB` / `ParamArmRB`: 왼팔/오른팔 B (-10 ~ 10)
- `ParamHandL` / `ParamHandR`: 왼손/오른손 (0 ~ 1)

#### 💇 **머리카락 제어**
- `ParamHairFront`: 앞머리 (-1 ~ 1)
- `ParamHairSide`: 옆머리 (-1 ~ 1)
- `ParamHairBack`: 뒷머리 (-1 ~ 1)
- `ParamHairFluffy`: 머리카락 흔들림 (-1 ~ 1)

#### 🧍 **몸 제어**
- `ParamShoulderY`: 어깨 위아래 (-10 ~ 10)
- `ParamBustX` / `ParamBustY`: 가슴 좌우/위아래 (-1 ~ 1)
- `ParamBaseX` / `ParamBaseY`: 기본 X/Y 좌표 (-10 ~ 10)

#### 🎭 **기타**
- `ParamCheek`: 볼 터짐 (0 ~ 1)
- `ParamBreath`: 호흡 (-1 ~ 1)

### 2️⃣ **파트 제어** (Parts)

모델의 각 파트(Parts)별로 **불투명도를 개별 조정**:

- 각 파트의 ID를 인식하고 표시
- 0 (완전 투명) ~ 1 (완전 불투명) 슬라이더 제어
- 실시간 반영

```typescript
// 예시: 특정 파트 숨기기
handlePartOpacityChange('Parts01ArmL_01', 0.0);  // 왼팔 숨김
handlePartOpacityChange('Parts01Hair_01', 0.5);  // 머리카락 반투명
```

### 3️⃣ **자동 효과** (Effects)

#### 🌬️ **호흡 효과 (Breath Effect)**

Cubism SDK의 `CubismBreath` 클래스를 참조하여 구현:

```typescript
interface BreathSettings {
  enabled: boolean;      // 호흡 효과 활성화
  cycle: number;         // 주기 (1~10초)
  peak: number;          // 강도 (0~2)
  offset: number;        // 오프셋 (-1~1)
}
```

**수학적 모델:**
```typescript
const breathValue = offset + peak * Math.sin((time * 2π) / cycle);
```

#### 👁️ **눈 깜빡임 효과 (Eye Blink)**

Cubism SDK의 `CubismEyeBlink` 클래스를 참조하여 구현:

```typescript
interface EyeBlinkSettings {
  enabled: boolean;           // 눈 깜빡임 활성화
  interval: number;           // 깜빡임 간격 (1~10초)
  closingDuration: number;    // 감는 시간 (0.05~0.5초)
  closedDuration: number;     // 감은 상태 유지 (0.05~0.3초)
  openingDuration: number;    // 뜨는 시간 (0.05~0.5초)
}
```

**상태 머신:**
```
open → closing → closed → opening → open
 ↑                                    ↓
 └────────── (interval) ──────────────┘
```

### 4️⃣ **커스텀 표정 시스템** (Expressions)

**표정 저장 및 관리:**

1. **표정 생성**: 현재 파라미터 상태를 저장
2. **표정 적용**: 저장된 표정을 한 번에 적용
3. **표정 관리**: 여러 개의 커스텀 표정 저장

```typescript
interface CustomExpression {
  name: string;                      // 표정 이름
  parameters: {                       // 파라미터 상태
    [paramId: string]: number;
  };
}
```

**사용 예시:**
```typescript
// 1. 파라미터 조정
handleParameterChange('ParamEyeLOpen', 0.3);
handleParameterChange('ParamEyeROpen', 0.3);
handleParameterChange('ParamMouthForm', 0.8);

// 2. 표정으로 저장
handleSaveExpression(); // 이름: "미소"

// 3. 나중에 표정 적용
handleApplyExpression("미소");
```

### 5️⃣ **설정 내보내기/가져오기**

**내보내기 형식 (JSON):**

```json
{
  "modelName": "mao",
  "parameters": {
    "ParamAngleX": 0.5,
    "ParamAngleY": -0.3,
    "ParamEyeLOpen": 1.0,
    ...
  },
  "parts": {
    "Parts01Core": 1.0,
    "Parts01ArmL_01": 0.8,
    ...
  },
  "breath": {
    "enabled": true,
    "cycle": 3.0,
    "peak": 0.5,
    "offset": 0.0
  },
  "eyeBlink": {
    "enabled": true,
    "interval": 3.0,
    "closingDuration": 0.1,
    "closedDuration": 0.1,
    "openingDuration": 0.15
  },
  "customExpressions": [
    {
      "name": "미소",
      "parameters": { ... }
    }
  ],
  "timestamp": "2025-10-06T16:30:00.000Z"
}
```

---

## 🔧 기술 스택

### 프론트엔드

- **React 18**: UI 컴포넌트 프레임워크
- **TypeScript**: 타입 안정성
- **PIXI.js v7**: 2D WebGL 렌더링 엔진
- **pixi-live2d-display**: Live2D 렌더링 라이브러리
- **Shadcn UI**: 고급 UI 컴포넌트 라이브러리
- **Tailwind CSS**: 유틸리티 CSS 프레임워크

### Live2D SDK

- **CubismWebFramework**: Live2D Cubism SDK for Web
- **Live2D Cubism Core**: 핵심 렌더링 엔진
- **Cubism Model Settings JSON**: 모델 설정 파서

---

## 🏗️ 아키텍처

### 컴포넌트 구조

```
AvatarStudio (Root)
├── Header (상단 바)
│   ├── 돌아가기 버튼
│   ├── 제목 & 설명
│   └── 액션 버튼 (초기화, 내보내기)
│
├── PreviewArea (좌측 2칸)
│   ├── Live2D Canvas (PIXI.js)
│   ├── Loading State
│   ├── Error State
│   └── Model Info Card
│
└── ControlPanel (우측 2칸)
    └── Tabs
        ├── 모델 선택
        ├── 파라미터 제어
        │   ├── 각도
        │   ├── 눈
        │   ├── 눈썹
        │   ├── 입
        │   ├── 팔
        │   ├── 머리카락
        │   └── 몸
        ├── 파트 제어
        ├── 효과
        │   ├── 호흡 설정
        │   └── 눈 깜빡임 설정
        └── 표정
            ├── 표정 저장
            └── 저장된 표정 목록
```

### 데이터 플로우

```
User Input (Slider)
    ↓
handleParameterChange(paramId, value)
    ↓
live2dModelRef.current.internalModel.coreModel.setParameterValueById(paramId, value)
    ↓
PIXI.js Rendering Loop
    ↓
Visual Update
```

### 애니메이션 루프

```typescript
const animate = () => {
  const deltaTime = (currentTime - lastTime) / 1000;
  
  // 1. 호흡 효과 업데이트
  updateBreath(deltaTime);
  
  // 2. 눈 깜빡임 효과 업데이트
  updateEyeBlink(deltaTime);
  
  // 3. 다음 프레임 요청
  animationFrameRef.current = requestAnimationFrame(animate);
};
```

---

## 📖 사용 방법

### 1. 접속 방법

#### 홈페이지에서:
1. 홈 화면의 **"아바타 스튜디오"** 카드 클릭
2. 아이콘: 🧪 Flask (실험적 기능)

#### 직접 URL:
```
http://localhost:3001/avatar-studio
```

### 2. 모델 선택

1. **"모델" 탭** 클릭
2. 드롭다운에서 원하는 Live2D 모델 선택 (`mao`, `ichika` 등)
3. 모델 로딩 대기 (1-2초)
4. 파라미터 정보 자동 추출 완료

### 3. 파라미터 조정

#### 3.1 카테고리별 탐색
**"파라미터" 탭**에서 카테고리별로 구분된 파라미터 확인:

- 🔄 **각도**: 머리와 몸의 회전
- 👁️ **눈**: 눈 열림, 웃음, 눈동자 위치
- 😊 **눈썹**: 눈썹 위치와 형태
- 💬 **입**: 입 모양과 열림
- 🤚 **팔**: 팔과 손의 위치
- 💇 **머리카락**: 머리카락 움직임
- 🧍 **몸**: 어깨, 가슴 등 몸의 부위

#### 3.2 슬라이더 사용
```
[파라미터 이름]                [현재 값]
━━━━━●━━━━━━━━━━━━━━━━━━━━
min          default          max
```

- 슬라이더를 드래그하여 실시간 조정
- 현재 값은 소수점 2자리까지 표시
- 기본값은 슬라이더 하단에 표시

### 4. 파트 제어

**"파트" 탭**에서:

1. 모델의 모든 파트 목록 확인
2. 각 파트의 불투명도 조정 (0% ~ 100%)
3. 특정 파트 숨기기/보이기

**활용 예시:**
- 옷 레이어 교체 시뮬레이션
- 액세서리 표시/숨김
- 특정 부위 강조

### 5. 효과 적용

#### 5.1 호흡 효과
**"효과" 탭** → **"호흡 효과"** 섹션:

1. **스위치 ON**: 호흡 효과 활성화
2. **주기 (Cycle)**: 1초 ~ 10초 (기본: 3초)
   - 한 번의 호흡 사이클 시간
3. **강도 (Peak)**: 0 ~ 2 (기본: 0.5)
   - 호흡의 세기
4. **오프셋 (Offset)**: -1 ~ 1 (기본: 0)
   - 호흡의 기본 위치

#### 5.2 눈 깜빡임 효과
**"효과" 탭** → **"눈 깜빡임"** 섹션:

1. **스위치 ON**: 눈 깜빡임 활성화
2. **깜빡임 간격**: 1초 ~ 10초 (기본: 3초)
3. **감는 시간**: 0.05초 ~ 0.5초 (기본: 0.1초)
4. **감은 상태 유지**: 0.05초 ~ 0.3초 (기본: 0.1초)
5. **뜨는 시간**: 0.05초 ~ 0.5초 (기본: 0.15초)

### 6. 표정 저장 및 관리

#### 6.1 표정 저장
**"표정" 탭**에서:

1. 원하는 표정으로 파라미터 조정
2. **"표정 이름"** 입력 (예: "화남", "기쁨", "놀람")
3. **"현재 상태를 표정으로 저장"** 버튼 클릭
4. 저장 완료 알림 확인

#### 6.2 표정 적용
**"표정" 탭**의 **"저장된 표정"** 목록에서:

1. 원하는 표정 카드 클릭
2. 모든 파라미터가 저장된 상태로 자동 변경
3. 현재 적용 중인 표정은 "적용 중" 배지 표시

### 7. 설정 내보내기

1. 우측 상단 **"설정 내보내기"** 버튼 클릭
2. JSON 파일 자동 다운로드
3. 파일명 형식: `live2d-studio-{모델명}-{타임스탬프}.json`

**활용:**
- 설정 백업
- 다른 프로젝트에서 재사용
- 팀원과 설정 공유

---

## 🔗 Cubism SDK 통합

### SDK 참조 구조

```
CubismWebFramework
├── cubismframework.ts          (SDK 초기화)
├── cubismmodel.ts              (모델 클래스)
├── cubismdefaultparameterid.ts (표준 파라미터 ID)
├── effect/
│   ├── cubismbreath.ts         (호흡 효과)
│   └── cubismeyeblink.ts       (눈 깜빡임)
├── motion/
│   ├── cubismmotion.ts         (모션 재생)
│   └── cubismexpressionmotion.ts (표정 모션)
└── rendering/
    └── cubismrenderer_webgl.ts (WebGL 렌더러)
```

### 핵심 API 사용

#### 1. 모델 초기화
```typescript
// pixi-live2d-display를 통한 모델 로드
const live2dModel = await Live2DModel.from(modelUrl);

// 내부 Cubism 모델 접근
const coreModel = live2dModel.internalModel.coreModel;
```

#### 2. 파라미터 제어
```typescript
// 파라미터 개수 가져오기
const paramCount = coreModel.getParameterCount();

// 파라미터 정보 가져오기
for (let i = 0; i < paramCount; i++) {
  const paramId = coreModel.getParameterId(i);
  const paramValue = coreModel.getParameterValueById(paramId);
  const paramMin = coreModel.getParameterMinimumValue(i);
  const paramMax = coreModel.getParameterMaximumValue(i);
  const paramDefault = coreModel.getParameterDefaultValue(i);
}

// 파라미터 값 설정
coreModel.setParameterValueById(paramId, value);
```

#### 3. 파트 제어
```typescript
// 파트 개수 가져오기
const partCount = coreModel.getPartCount();

// 파트 불투명도 가져오기/설정하기
for (let i = 0; i < partCount; i++) {
  const partId = coreModel.getPartId(i);
  const opacity = coreModel.getPartOpacityById(partId);
  
  // 불투명도 설정 (0.0 ~ 1.0)
  coreModel.setPartOpacityById(partId, newOpacity);
}
```

#### 4. 호흡 효과 (Cubism SDK 스타일)
```typescript
// CubismBreath 클래스 참조 구현
class BreathEffect {
  updateParameters(model: CubismModel, deltaTime: number): void {
    this.currentTime += deltaTime;
    const t = this.currentTime * 2.0 * Math.PI;
    const breathValue = this.offset + 
                       this.peak * Math.sin(t / this.cycle);
    
    model.addParameterValueById(
      'ParamBreath',
      breathValue,
      1.0  // weight
    );
  }
}
```

#### 5. 눈 깜빡임 효과 (Cubism SDK 스타일)
```typescript
// CubismEyeBlink 클래스 참조 구현
enum EyeState {
  Open,
  Closing,
  Closed,
  Opening
}

class EyeBlinkEffect {
  updateParameters(model: CubismModel, deltaTime: number): void {
    this.currentTime += deltaTime;
    
    let eyeValue = 1.0;
    
    switch (this.state) {
      case EyeState.Closing:
        const t = this.currentTime / this.closingDuration;
        eyeValue = 1.0 - t;
        if (t >= 1.0) {
          this.state = EyeState.Closed;
        }
        break;
      // ... 다른 상태들
    }
    
    model.setParameterValueById('ParamEyeLOpen', eyeValue);
    model.setParameterValueById('ParamEyeROpen', eyeValue);
  }
}
```

---

## 🎓 API 레퍼런스

### 주요 함수

#### `handleParameterChange`
```typescript
const handleParameterChange = (paramId: string, value: number): void => {
  if (!live2dModelRef.current) return;
  
  const coreModel = live2dModelRef.current.internalModel?.coreModel;
  if (coreModel) {
    coreModel.setParameterValueById(paramId, value);
    
    // 상태 업데이트
    setParameters(prev => 
      prev.map(p => p.id === paramId ? { ...p, value } : p)
    );
  }
};
```

**파라미터:**
- `paramId` (string): Live2D 파라미터 ID (예: 'ParamAngleX')
- `value` (number): 설정할 값 (파라미터의 min~max 범위 내)

**사용 예:**
```typescript
handleParameterChange('ParamAngleX', 15);    // 머리를 오른쪽으로 15도
handleParameterChange('ParamEyeLOpen', 0.5); // 왼쪽 눈 반만 뜨기
```

#### `handlePartOpacityChange`
```typescript
const handlePartOpacityChange = (partId: string, opacity: number): void => {
  if (!live2dModelRef.current) return;
  
  const coreModel = live2dModelRef.current.internalModel?.coreModel;
  if (coreModel) {
    coreModel.setPartOpacityById(partId, opacity);
    
    setParts(prev => 
      prev.map(p => p.id === partId ? { ...p, opacity } : p)
    );
  }
};
```

**파라미터:**
- `partId` (string): Live2D 파트 ID (예: 'Parts01ArmL_01')
- `opacity` (number): 불투명도 (0.0 ~ 1.0)

**사용 예:**
```typescript
handlePartOpacityChange('Parts01ArmL_01', 0.0);  // 왼팔 완전 투명
handlePartOpacityChange('Parts01Hair_01', 0.5);  // 머리카락 반투명
handlePartOpacityChange('Parts01Core', 1.0);     // 코어 불투명
```

#### `extractModelParameters`
```typescript
const extractModelParameters = (model: Live2DModel): void => {
  const coreModel = model.internalModel.coreModel;
  const paramCount = coreModel.getParameterCount();
  const extractedParams: ParameterInfo[] = [];
  
  for (let i = 0; i < paramCount; i++) {
    const paramId = coreModel.getParameterId(i);
    const paramValue = coreModel.getParameterValueById(paramId);
    const paramMin = coreModel.getParameterMinimumValue(i);
    const paramMax = coreModel.getParameterMaximumValue(i);
    const paramDefault = coreModel.getParameterDefaultValue(i);
    
    extractedParams.push({
      id: paramId,
      name: getParameterName(paramId),
      value: paramValue,
      minValue: paramMin,
      maxValue: paramMax,
      defaultValue: paramDefault,
    });
  }
  
  setParameters(extractedParams);
};
```

**반환값:** void (상태 업데이트)

**부작용:**
- `parameters` 상태 업데이트
- `parts` 상태 업데이트

#### `handleSaveExpression`
```typescript
const handleSaveExpression = (): void => {
  if (!newExpressionName.trim()) {
    toast({ title: '표정 이름 필요', variant: 'destructive' });
    return;
  }
  
  const currentParams: { [paramId: string]: number } = {};
  parameters.forEach(param => {
    currentParams[param.id] = param.value;
  });
  
  const newExpression: CustomExpression = {
    name: newExpressionName,
    parameters: currentParams,
  };
  
  setCustomExpressions(prev => [...prev, newExpression]);
  toast({ title: '표정 저장 완료' });
};
```

**사용 예:**
```typescript
// 1. 파라미터 조정
handleParameterChange('ParamMouthForm', 0.8);
handleParameterChange('ParamCheek', 0.6);

// 2. 표정 이름 설정
setNewExpressionName('미소');

// 3. 저장
handleSaveExpression();
```

#### `handleExportSettings`
```typescript
const handleExportSettings = (): void => {
  const settings = {
    modelName: selectedModel,
    parameters: parameters.reduce((acc, p) => {
      acc[p.id] = p.value;
      return acc;
    }, {} as { [key: string]: number }),
    parts: parts.reduce((acc, p) => {
      acc[p.id] = p.opacity;
      return acc;
    }, {} as { [key: string]: number }),
    breath: breathSettings,
    eyeBlink: eyeBlinkSettings,
    customExpressions: customExpressions,
    timestamp: new Date().toISOString(),
  };
  
  const blob = new Blob([JSON.stringify(settings, null, 2)], 
                        { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `live2d-studio-${selectedModel}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};
```

---

## 💻 개발 가이드

### 새로운 파라미터 카테고리 추가

```typescript
// 1. commonParameters 배열에 추가
const commonParameters = [
  // ... 기존 파라미터들
  { id: 'ParamNewFeature', name: '새 기능', category: 'newCategory' },
];

// 2. 카테고리 이름 및 아이콘 정의
const categoryNames = {
  // ... 기존 카테고리들
  newCategory: '새 카테고리',
};

const categoryIcons = {
  // ... 기존 아이콘들
  newCategory: 'fa-star',
};

// 3. 렌더링 배열에 카테고리 추가
{['angle', 'eye', 'brow', 'mouth', 'other', 'arm', 'hair', 'body', 'newCategory'].map(category => {
  // ... 렌더링 로직
})}
```

### 새로운 효과 추가

```typescript
// 1. 설정 인터페이스 정의
interface NewEffectSettings {
  enabled: boolean;
  parameter1: number;
  parameter2: number;
}

// 2. 상태 추가
const [newEffectSettings, setNewEffectSettings] = useState<NewEffectSettings>({
  enabled: false,
  parameter1: 0,
  parameter2: 0,
});

// 3. 업데이트 함수 작성
const updateNewEffect = useCallback((deltaTime: number) => {
  if (!newEffectSettings.enabled || !live2dModelRef.current) return;
  
  // 효과 로직 구현
  const effectValue = calculateEffectValue(deltaTime, newEffectSettings);
  handleParameterChange('TargetParamId', effectValue);
}, [newEffectSettings, handleParameterChange]);

// 4. 애니메이션 루프에 추가
const animate = () => {
  // ... 기존 효과들
  updateNewEffect(deltaTime);
  // ...
};
```

### 커스텀 UI 추가

```typescript
// ControlPanel 내 새 탭 추가
<TabsList className="grid w-full grid-cols-6 mb-4">
  {/* ... 기존 탭들 */}
  <TabsTrigger value="custom">커스텀</TabsTrigger>
</TabsList>

<TabsContent value="custom" className="space-y-4">
  {/* 커스텀 UI 컴포넌트 */}
  <div className="p-4 bg-purple-900/20 rounded-lg">
    <Label>커스텀 기능</Label>
    {/* ... */}
  </div>
</TabsContent>
```

---

## 🎯 활용 사례

### 1. **캐릭터 디자이너**
- 다양한 표정 프리셋 제작
- 파라미터 조합 실험
- 최적의 파라미터 범위 발견

### 2. **게임 개발자**
- 게임 내 캐릭터 표정 설정
- 대화 시스템용 표정 프리셋
- 애니메이션 타이밍 조정

### 3. **VTuber / 라이브 방송**
- 실시간 표정 제어
- 커스텀 표정 단축키 설정
- 방송용 표정 라이브러리 구축

### 4. **교육 / 연구**
- Live2D SDK 학습 도구
- 파라미터 동작 이해
- 표정 생성 원리 연구

---

## 🔬 성능 최적화

### 렌더링 최적화

```typescript
// React.memo로 불필요한 리렌더링 방지
const ParameterSlider = React.memo(({ param, onChange }: Props) => {
  return (
    <Slider
      value={[param.value]}
      onValueChange={(value) => onChange(param.id, value[0])}
    />
  );
});

// useCallback으로 함수 메모이제이션
const handleParameterChange = useCallback((paramId: string, value: number) => {
  // ...
}, [/* dependencies */]);
```

### 애니메이션 루프 최적화

```typescript
// requestAnimationFrame 사용으로 60 FPS 유지
const animate = () => {
  const currentTime = Date.now();
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  
  // 조건부 업데이트 (효과가 비활성화되면 스킵)
  if (breathSettings.enabled) updateBreath(deltaTime);
  if (eyeBlinkSettings.enabled) updateEyeBlink(deltaTime);
  
  animationFrameRef.current = requestAnimationFrame(animate);
};
```

---

## 🐛 트러블슈팅

### 문제: 파라미터가 표시되지 않음

**원인:** 모델이 완전히 로드되지 않음

**해결:**
```typescript
// 모델 로드 후 충분한 시간 대기
setTimeout(() => {
  if (live2dModelRef.current) {
    extractModelParameters(live2dModelRef.current);
  }
}, 500);
```

### 문제: 효과가 적용되지 않음

**원인:** 애니메이션 루프가 시작되지 않음

**해결:**
```typescript
// useEffect에서 애니메이션 루프 시작 확인
useEffect(() => {
  // ...
  animate(); // 명시적으로 호출
  
  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, [/* dependencies */]);
```

### 문제: 설정 내보내기 실패

**원인:** 브라우저 보안 정책

**해결:**
```typescript
// Blob URL 사용 및 적절한 정리
const url = URL.createObjectURL(blob);
link.click();
URL.revokeObjectURL(url); // 메모리 누수 방지
```

---

## 📚 참고 자료

### 공식 문서
- [Live2D Cubism SDK Manual](https://docs.live2d.com/cubism-sdk-manual/top/)
- [Cubism WebFramework GitHub](https://github.com/Live2D/CubismWebFramework)
- [Live2D Parameter List](https://docs.live2d.com/cubism-editor-manual/standard-parametor-list/)

### 커뮤니티
- [Live2D Creator's Forum](https://community.live2d.com/)
- [Live2D Discord](https://discord.com/invite/live2d)

---

## 🎉 결론

**Live2D 아바타 스튜디오**는 Cubism WebFramework SDK의 강력한 기능을 활용하여 
Live2D 모델의 모든 파라미터를 세밀하게 제어할 수 있는 고급 도구입니다.

### 핵심 강점
✅ **완전한 파라미터 접근**: 모든 파라미터를 개별 제어  
✅ **실시간 미리보기**: 변경사항 즉시 반영  
✅ **커스텀 표정 시스템**: 무한한 표정 생성 가능  
✅ **자동 효과**: 호흡, 눈 깜빡임 등 자연스러운 애니메이션  
✅ **설정 관리**: 내보내기/가져오기 지원  

**개발자, 디자이너, 크리에이터 모두를 위한 강력한 Live2D 제어 도구입니다!** 🚀

---

## 📝 라이선스

이 프로젝트는 Live2D Cubism SDK의 라이선스를 따릅니다.

- [Live2D Open Software License](https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html)

---

**Made with ❤️ using Cubism WebFramework SDK**

