# AI 캐릭터 생성 오류 해결 가이드

## 🔍 "Failed to fetch" 오류 해결

### 문제 증상
```
TypeError: Failed to fetch
FetchEvent for "http://localhost:3001/api/model-editor/ai-transform" resulted in a network error
```

### 해결 방법

#### 1. 서비스 워커 캐시 클리어 (가장 중요!)

**방법 A: 브라우저 개발자 도구 사용**

1. 브라우저에서 `F12` 키를 눌러 개발자 도구 열기
2. `Application` 탭 클릭
3. 왼쪽 사이드바에서 `Service Workers` 클릭
4. `Unregister` 버튼 클릭하여 서비스 워커 제거
5. 다시 왼쪽 사이드바에서 `Cache Storage` 클릭
6. 모든 캐시 항목을 우클릭하여 `Delete` 선택
7. 페이지 새로고침 (`Ctrl+F5` 또는 `Cmd+Shift+R`)

**방법 B: 시크릿/프라이빗 모드 사용**

1. 브라우저를 시크릿/프라이빗 모드로 실행
2. `http://localhost:5173` 접속
3. 서비스 워커 없이 테스트

**방법 C: 완전한 브라우저 캐시 클리어**

1. `Ctrl+Shift+Delete` (Windows) 또는 `Cmd+Shift+Delete` (Mac)
2. "캐시된 이미지 및 파일" 체크
3. "전체 기간" 선택
4. "데이터 삭제" 클릭

#### 2. 서버가 실행 중인지 확인

터미널에서 다음 명령 실행:

```bash
# 서버가 실행 중인지 확인
curl http://localhost:3001/api/health

# 또는
npm run dev
```

서버가 실행되고 있지 않다면:

```bash
# 전체 앱 실행 (클라이언트 + 서버)
npm run dev

# 또는 서버만 실행
npm run dev:server
```

#### 3. OpenAI API 키 확인

`.env` 파일이 프로젝트 루트에 있는지 확인:

```bash
# .env 파일 확인
cat .env

# 또는 (Windows)
type .env
```

`.env` 파일 내용:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**중요:** API 키가 설정된 후 서버를 재시작해야 합니다!

```bash
# 서버 재시작
npm run dev
```

#### 4. 서버 로그 확인

서버 터미널에서 다음 로그를 확인:

**정상 로그:**
```
🤖 AI 이미지 생성 시작
📝 프롬프트: [your prompt]
🎨 스타일: anime
✨ 강화된 프롬프트: [enhanced prompt]
✅ AI 이미지 생성 완료
```

**오류 로그 예시:**

**API 키 없음:**
```
OpenAI API 키가 설정되지 않았습니다
```
→ `.env` 파일에 `OPENAI_API_KEY` 추가

**API 키 무효:**
```
OpenAI API 오류: Invalid API key
```
→ OpenAI 대시보드에서 API 키 재확인

**크레딧 부족:**
```
OpenAI API 오류: Insufficient credits
```
→ OpenAI 계정에 크레딧 충전

#### 5. 네트워크 요청 확인

브라우저 개발자 도구에서:

1. `Network` 탭 열기
2. `Preserve log` 체크
3. AI 캐릭터 생성 버튼 클릭
4. `/api/model-editor/ai-transform` 요청 찾기

**요청 확인 사항:**

- **Status Code:** 200 (성공) 또는 4xx/5xx (에러)
- **Request Method:** POST
- **Request Headers:** `Content-Type: application/json`
- **Request Payload:** 
  ```json
  {
    "prompt": "your prompt",
    "style": "anime"
  }
  ```

#### 6. CORS 문제 확인

서버 콘솔에서 CORS 관련 에러가 있는지 확인:

```
Access-Control-Allow-Origin
```

CORS 에러가 있다면, `server/index.ts`에서 CORS 설정 확인:

```typescript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

#### 7. 포트 충돌 확인

다른 프로세스가 포트 3001을 사용하고 있는지 확인:

**Windows:**
```bash
netstat -ano | findstr :3001
```

**Mac/Linux:**
```bash
lsof -i :3001
```

포트가 이미 사용 중이라면:

1. 해당 프로세스 종료
2. 또는 `.env` 파일에서 다른 포트 설정:
   ```
   PORT=3002
   ```

#### 8. 서비스 워커 완전 비활성화 (디버깅용)

`public/sw.js` 파일 상단에 추가:

```javascript
// 디버깅 시 서비스 워커 완전 비활성화
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 모든 요청을 그냥 통과
  return;
});
```

## 🔄 완전한 재시작 절차

문제가 계속되면 다음 순서로 완전히 재시작:

```bash
# 1. 서버 중지 (Ctrl+C)

# 2. node_modules 재설치 (선택사항)
rm -rf node_modules
npm install

# 3. 빌드 재실행
npm run build:server

# 4. 전체 재시작
npm run dev
```

**브라우저:**

1. 모든 탭 닫기
2. 브라우저 완전 종료
3. 캐시 클리어 (위의 방법 참고)
4. 브라우저 재시작
5. 개발자 도구 열기 (F12)
6. `Network` 탭에서 `Disable cache` 체크
7. `Application` > `Service Workers`에서 기존 워커 제거
8. 페이지 접속: `http://localhost:5173`

## 🧪 테스트 방법

### 1. API 엔드포인트 직접 테스트

**curl로 테스트:**

```bash
curl -X POST http://localhost:3001/api/model-editor/ai-transform \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "cute anime girl with blue hair",
    "style": "anime"
  }'
```

**Postman이나 Insomnia 사용:**

- URL: `http://localhost:3001/api/model-editor/ai-transform`
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
  ```json
  {
    "prompt": "cute anime girl with blue hair",
    "style": "anime"
  }
  ```

### 2. 간단한 테스트 페이지

`test-ai.html` 파일 생성:

```html
<!DOCTYPE html>
<html>
<head>
  <title>AI API 테스트</title>
</head>
<body>
  <button onclick="testAI()">AI 테스트</button>
  <div id="result"></div>
  
  <script>
    async function testAI() {
      try {
        const response = await fetch('http://localhost:3001/api/model-editor/ai-transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'cute anime girl',
            style: 'anime'
          })
        });
        
        const data = await response.json();
        document.getElementById('result').textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        document.getElementById('result').textContent = 'Error: ' + error.message;
      }
    }
  </script>
</body>
</html>
```

이 파일을 브라우저에서 직접 열어서 테스트합니다.

## 📞 추가 도움말

### 문제가 계속되면 확인할 사항:

1. **Node.js 버전:** `node --version` (권장: v16 이상)
2. **npm 버전:** `npm --version` (권장: v8 이상)
3. **방화벽 설정:** 로컬 포트 3001, 5173이 차단되지 않았는지
4. **바이러스 백신:** 일시적으로 비활성화하고 테스트
5. **VPN/프록시:** 비활성화하고 테스트

### 로그 수집

문제 보고 시 다음 정보 포함:

1. **브라우저 콘솔 로그** (F12 > Console)
2. **네트워크 탭 스크린샷** (F12 > Network)
3. **서버 터미널 출력**
4. **브라우저 버전 및 OS**
5. **Node.js 및 npm 버전**

## ✅ 성공 확인

모든 것이 정상적으로 작동하면:

1. 서버 로그에 "🤖 AI 이미지 생성 시작" 표시
2. 브라우저 콘솔에 "✅ AI 이미지 생성 완료" 표시
3. 약 10~30초 후 캔버스에 이미지 로드
4. Toast 알림: "AI 이미지 생성 완료! ✨"

