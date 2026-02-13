# 🚨 AI 캐릭터 생성 오류 즉시 해결 방법

## ⚡ 빠른 해결 (5분)

### 1단계: 서비스 워커 제거 (가장 중요!)

**브라우저에서:**

1. `F12` 눌러서 개발자 도구 열기
2. `Application` 탭 클릭
3. 왼쪽에서 `Service Workers` 클릭
4. **"Unregister"** 버튼 클릭 ← 이것이 핵심!
5. 페이지 완전 새로고침: `Ctrl+Shift+R` (Windows) 또는 `Cmd+Shift+R` (Mac)

**또는 시크릿 모드 사용:**
- Chrome: `Ctrl+Shift+N`
- Firefox: `Ctrl+Shift+P`
- Edge: `Ctrl+Shift+N`

### 2단계: 서버 실행 확인

터미널에서:

```bash
# 서버가 실행 중인지 확인
# 다음 중 하나가 실행되고 있어야 함:
npm run dev
# 또는
npm run dev:server
```

### 3단계: OpenAI API 키 확인

프로젝트 루트에 `.env` 파일이 있는지 확인:

```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

**없다면 생성:**

1. `.env` 파일 생성
2. 위 내용 붙여넣기 (실제 API 키로 교체)
3. 서버 재시작 필수!

### 4단계: 테스트

1. 아바타 스튜디오 접속
2. 텍스처 탭 클릭
3. AI 캐릭터 생성 섹션에서:
   - 프롬프트 입력: "cute anime girl with blue hair"
   - 스타일: 애니메이션 스타일
4. "AI로 캐릭터 생성" 버튼 클릭

## 📋 체크리스트

- [ ] 서비스 워커 제거됨
- [ ] 페이지 완전 새로고침 (Ctrl+Shift+R)
- [ ] 서버 실행 중 (npm run dev)
- [ ] .env 파일에 OPENAI_API_KEY 있음
- [ ] 서버 재시작됨 (API 키 추가 후)

## 🔍 여전히 안 되면?

### 서버 로그 확인

서버 터미널에서 다음 로그가 보여야 합니다:

```
✅ Server started on port 3001
```

### 브라우저 콘솔 확인

F12 > Console 탭에서:

```
🤖 AI 이미지 생성 시작...
```

이 메시지가 보이면 최소한 클라이언트는 정상입니다.

### API 직접 테스트

새 터미널에서:

```bash
curl -X POST http://localhost:3001/api/model-editor/ai-transform \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","style":"anime"}'
```

**예상 응답:**

```json
{
  "error": "OpenAI API 키가 설정되지 않았습니다..."
}
```

또는

```json
{
  "success": true,
  "imageUrl": "https://..."
}
```

## 🆘 긴급 도움말

자세한 문제 해결 방법은 `TROUBLESHOOTING_AI.md` 파일을 참조하세요.

