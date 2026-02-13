# Replit 프로덕션 배포 가이드

## 🚨 발생한 문제

### 1. Mixed Content 오류
```
Mixed Content: The page at 'https://aiavatar.decomsoft.com/chat?model=03honami' 
was loaded over HTTPS, but requested an insecure element 'http://localhost:5001/audio/...'.
```

**원인**: HTTPS 사이트에서 HTTP 리소스를 요청하려고 시도

**해결**: 코드에서 자동으로 환경을 감지하여 올바른 URL을 사용하도록 수정 완료 ✅

### 2. Live2D 이미지 404 오류
```
GET https://aiavatar.decomsoft.com/liv2d/Avatars/mao.png 404 (Not Found)
```

**원인**: Live2D 모델 리소스 경로가 잘못 설정됨

---

## ✅ 해결된 사항

### 1. 오디오 URL 자동 감지
`client/src/components/discord/MainContent.tsx`에서 환경에 따라 자동으로 올바른 서버 URL을 사용하도록 수정:

```typescript
// 로컬 개발: http://localhost:5001
// 프로덕션: https://aiavatar.decomsoft.com (현재 도메인)
```

### 2. 이미지 업로드 URL 자동 감지
모든 채팅 컴포넌트(`MainContent.tsx`, `VoiceChannel.tsx`, `VoiceVideoCall.tsx`)에서 환경에 따라 자동으로 올바른 업로드 URL을 사용하도록 수정:

```typescript
// 로컬 개발: http://decomsoft.com:3008/upload
// 프로덕션: https://aiavatar.decomsoft.com/api/upload
```

### 3. 서버 업로드 API 호환성
클라이언트가 서버의 `/api/upload` 엔드포인트 규격에 맞게 수정:
- 필드명: `file` → `image`
- 응답 처리: `url` 또는 `imageUrl` 모두 지원

---

## 🔧 Replit 환경 변수 설정

Replit Secrets에 다음 환경 변수를 추가하세요:

### 1. `.env` 파일 (또는 Replit Secrets)

```bash
# 백엔드 API URL (프로덕션)
VITE_API_URL=https://aiavatar.decomsoft.com

# 또는 백엔드가 별도 서버에 있다면
# VITE_API_URL=https://api.aiavatar.decomsoft.com

# 이미지 업로드 서버
VITE_IMAGE_UPLOAD_URL=http://decomsoft.com:3008
```

### 2. Replit에서 설정하는 방법

1. Replit 프로젝트 페이지에서 **🔒 Secrets** 탭 클릭
2. 위의 환경 변수들을 추가
3. Replit 재시작

---

## 🎯 Live2D 모델 리소스 문제 해결

### 방법 1: 공개 폴더 확인

Live2D 모델 파일들이 `public/live2d-models/` 또는 `public/liv2d/` 폴더에 있는지 확인:

```
public/
├── live2d-models/
│   └── mao/
│       ├── runtime/
│       │   └── mao_pro.model3.json
│       └── mao.png
```

### 방법 2: 서버 정적 파일 설정

`server/index.ts`에 정적 파일 서빙 추가:

```typescript
// Live2D 모델 정적 파일 서빙
app.use('/liv2d', express.static(path.join(__dirname, '../public/liv2d')));
app.use('/live2d-models', express.static(path.join(__dirname, '../public/live2d-models')));
```

### 방법 3: CDN 사용 (권장)

Live2D 모델 파일들을 CDN이나 Cloudinary에 업로드하고 URL을 절대 경로로 설정:

```json
{
  "name": "mao",
  "url": "https://your-cdn.com/live2d-models/mao/runtime/mao_pro.model3.json"
}
```

---

## 🌐 프로덕션 체크리스트

- [x] 오디오 URL 환경 감지 수정
- [x] 이미지 업로드 URL 환경 감지 수정
- [x] 서버 업로드 API 호환성 수정
- [ ] Replit Secrets 환경 변수 설정 (선택사항)
- [ ] Live2D 모델 리소스 경로 확인
- [ ] 서버 정적 파일 라우트 확인 (`/images/profile/`)
- [ ] 빌드 및 배포 테스트

---

## 🚀 배포 명령어

### 1. 개발 환경 테스트
```bash
npm run dev
```

### 2. 프로덕션 빌드
```bash
npm run build
```

### 3. 프로덕션 실행
```bash
npm run start
```

---

## 🐛 디버깅 팁

### 1. 콘솔에서 현재 URL 확인
브라우저 콘솔에서:
```javascript
console.log('현재 프로토콜:', window.location.protocol);
console.log('현재 호스트:', window.location.hostname);
console.log('환경 변수:', import.meta.env.VITE_API_URL);
```

### 2. 네트워크 탭 확인
- Chrome 개발자 도구 → Network 탭
- 실패한 요청의 URL 확인
- 404 오류는 경로 문제, CORS 오류는 서버 설정 문제

### 3. 서버 로그 확인
Replit Shell에서:
```bash
npm run start
```
오디오 파일 서빙 로그 확인

---

## 📞 추가 지원

문제가 계속되면:
1. Replit 콘솔 로그 확인
2. 브라우저 네트워크 탭에서 실패한 요청 URL 복사
3. 서버 정적 파일 라우트 확인

---

**마지막 업데이트**: 2025-01-17

