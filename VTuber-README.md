# 🤖 AI 아바타 VTuber 기능 사용 가이드

AI 아바타세상에서 Live2D 캐릭터와 실시간 AI 대화를 즐길 수 있는 VTuber 기능을 제공합니다!

## ✨ 주요 기능

- 🎭 **Live2D 아바타**: 실시간 감정 표현과 애니메이션
- 🤖 **AI 대화**: OpenAI GPT를 활용한 자연스러운 대화
- 💬 **실시간 채팅**: WebSocket 기반 실시간 통신
- 🎨 **감정 인식**: 대화 내용에 따른 자동 감정 변화
- 📱 **Discord 스타일 UI**: 친숙한 채팅 인터페이스

## 🚀 빠른 시작

### 1. 서버 실행
```bash
# 프로젝트 루트에서
npm run dev
```

서버가 시작되면 다음과 같은 메시지가 표시됩니다:
```
🤖 VTuber WebSocket 서버가 /client-ws 경로에서 준비되었습니다.
서버 실행 중: http://0.0.0.0:5001
📡 WebSocket 엔드포인트: ws://localhost:5001/client-ws
```

### 2. 브라우저에서 접속
- http://localhost:3001 에서 클라이언트 접속
- "아바타와 채팅" 채널 클릭
- Live2D 아바타와 대화 시작!

## 🔑 OpenAI API 키 설정 (AI 대화 기능)

AI 대화 기능을 사용하려면 OpenAI API 키가 필요합니다.

### 환경변수 설정 방법:

1. **프로젝트 루트에 `.env` 파일 생성**:
```bash
# .env 파일
OPENAI_API_KEY=sk-your-openai-api-key-here
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

2. **OpenAI API 키 발급**:
   - [OpenAI 플랫폼](https://platform.openai.com/api-keys)에서 계정 생성
   - API 키 발급 후 위 환경변수에 설정

3. **서버 재시작**:
```bash
npm run dev
```

### API 키 없이 사용하기
OpenAI API 키 없이도 다음 기능들은 정상 작동합니다:
- ✅ Live2D 모델 표시 및 애니메이션
- ✅ 아바타 클릭으로 감정 변경
- ✅ WebSocket 연결 및 기본 인터페이스
- ❌ AI 대화 응답 (기본 메시지로 대체됨)

## 🎮 사용법

### 기본 대화
1. "아바타와 채팅" 채널 입장
2. 하단 입력창에 메시지 입력
3. AI 아바타의 응답 확인
4. 감정 표현 변화 관찰

### 아바타 상호작용
- **아바타 클릭**: 감정 랜덤 변경
- **모델 변경**: 우상단 새로고침 버튼 (추후 확장)
- **연결 상태**: 하단 상태 표시등 확인

### 감정 표현 시스템
AI는 대화 내용을 분석해서 다음 감정들을 표현합니다:
- 😊 **joy** - 기쁨, 행복
- 😠 **anger** - 화남, 짜증  
- 😢 **sadness** - 슬픔, 우울
- 😯 **surprise** - 놀람, 깜짝
- 😰 **fear** - 두려움, 걱정
- 😐 **neutral** - 평범, 기본

## 🛠️ 개발자 정보

### WebSocket 메시지 타입
```typescript
// 클라이언트 → 서버
{
  type: 'text-input',
  text: '안녕하세요!'
}

// 서버 → 클라이언트  
{
  type: 'llm-response',
  text: '[joy] 안녕하세요! 오늘 기분이 좋네요!',
  emotion: 'joy',
  timestamp: 1640995200000
}
```

### 사용된 기술
- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, WebSocket
- **AI**: OpenAI GPT-3.5/4
- **Live2D**: Cubism SDK, PIXI.js
- **Real-time**: WebSocket, Socket.io

### 파일 구조
```
server/
├── vtuber-server.ts     # VTuber WebSocket 서버
├── types/vtuber.ts      # TypeScript 타입 정의
└── index.ts             # 메인 서버

client/src/
├── components/live2d/   # Live2D 컴포넌트
└── components/discord/  # Discord 스타일 UI
```

## 🔧 문제 해결

### 연결 안됨
```
❌ WebSocket 연결 실패
```
**해결책**: 
1. 서버가 실행 중인지 확인 (포트 5001)
2. 방화벽 설정 확인
3. 브라우저 새로고침

### AI 응답 없음
```
⚠️ OpenAI API 키가 설정되지 않았습니다
```
**해결책**:
1. `.env` 파일에 `OPENAI_API_KEY` 추가
2. 서버 재시작
3. API 키 유효성 확인

### Live2D 모델 로드 실패
```
❌ Live2D 로드 실패
```
**해결책**:
1. `public/live2d-models/` 폴더 확인
2. `public/model_dict.json` 파일 확인
3. 브라우저 콘솔에서 상세 오류 확인

## 🎯 향후 계획

- [ ] 음성 인식 및 TTS (Text-to-Speech)
- [ ] 더 많은 Live2D 모델 지원
- [ ] 감정 표현 더 세밀한 제어
- [ ] 그룹 채팅 지원
- [ ] 커스텀 캐릭터 업로드
- [ ] Replit 배포 지원

## 📞 지원

문제가 발생하거나 궁금한 점이 있으면:
1. GitHub Issues에 문의
2. 개발자 채널에서 질문
3. 로그 확인 후 오류 메시지 공유

---

**🎉 AI 아바타세상에서 새로운 디지털 친구들과 즐거운 대화를 나누세요!** 🤖✨
