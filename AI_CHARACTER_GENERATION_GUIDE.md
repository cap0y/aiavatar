# AI 캐릭터 생성 기능 사용 가이드

## 개요

아바타 스튜디오에서 **OpenAI DALL-E 3**를 사용하여 AI로 새로운 캐릭터 이미지를 생성할 수 있습니다.

## 설정 방법

### 1. OpenAI API 키 발급

1. [OpenAI Platform](https://platform.openai.com/) 접속
2. 로그인 후 [API Keys](https://platform.openai.com/api-keys) 페이지로 이동
3. "Create new secret key" 버튼 클릭
4. 생성된 API 키 복사 (한 번만 표시되므로 안전하게 보관)

### 2. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음과 같이 설정합니다:

```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**예제 파일:** `.env.example` 파일을 참고하세요.

### 3. 서버 재시작

환경변수 설정 후 서버를 재시작합니다:

```bash
npm run dev
```

## 사용 방법

### 1. 아바타 스튜디오 접속

1. 홈 화면에서 "아바타 스튜디오" 클릭
2. 모델 선택
3. "텍스처" 탭 클릭

### 2. AI 캐릭터 생성

1. **아트 스타일 선택**
   - 애니메이션 스타일
   - 사실적인 스타일
   - 만화 스타일
   - 판타지 스타일
   - 사이버펑크 스타일
   - 수채화 스타일

2. **캐릭터 설명 작성 (프롬프트)**
   - 상세하고 구체적으로 작성할수록 좋은 결과를 얻을 수 있습니다.
   - 예시:
     ```
     파란색 긴 머리의 마법소녀, 빛나는 파란 눈, 
     마법 지팡이를 들고 있는, 별이 빛나는 배경
     ```

3. **"AI로 캐릭터 생성" 버튼 클릭**
   - 생성 시간: 약 10~30초
   - 생성된 이미지가 자동으로 캔버스에 로드됩니다

### 3. 이미지 편집 및 저장

1. 생성된 이미지를 캔버스 편집 도구로 수정
   - 브러시, 지우개, 도형 그리기
   - 확대/축소 (25% ~ 300%)
   - Ctrl+Z (실행 취소), Ctrl+Y (다시 실행)

2. "서버에 저장하고 모델에 적용" 버튼 클릭
   - Live2D 모델의 텍스처 파일이 업데이트됩니다

3. 왼쪽 Live2D 미리보기에서 실시간으로 확인

## 프롬프트 작성 팁

### 좋은 프롬프트 예시

✅ **상세한 설명:**
```
긴 은발을 가진 엘프 여전사, 날카로운 녹색 눈, 
황금색 갑옷을 입고, 마법검을 들고 있는, 
신비로운 숲 배경
```

✅ **구체적인 특징:**
```
분홍색 트윈테일 헤어스타일의 소녀, 큰 갈색 눈, 
귀여운 미소, 학교 교복, 벚꽃이 날리는 배경
```

### 피해야 할 프롬프트

❌ **너무 간단함:**
```
예쁜 소녀
```

❌ **모호한 설명:**
```
멋진 캐릭터
```

## 비용 안내

- **DALL-E 3**: 이미지 1개당 약 $0.04 (1024x1024 standard quality)
- OpenAI 계정의 크레딧이 소진되면 API 호출이 실패합니다
- [OpenAI Pricing](https://openai.com/pricing) 참고

## 주의사항

1. **API 키 보안**
   - `.env` 파일을 절대 Git에 커밋하지 마세요
   - `.gitignore`에 `.env`가 포함되어 있는지 확인하세요

2. **사용량 관리**
   - AI 이미지 생성은 비용이 발생합니다
   - 테스트 시에는 적은 횟수로 테스트하세요

3. **콘텐츠 정책**
   - OpenAI의 [Usage Policies](https://openai.com/policies/usage-policies)를 준수해야 합니다
   - 부적절한 콘텐츠 생성 요청은 거부됩니다

## 문제 해결

### "OpenAI API 키가 설정되지 않았습니다" 오류

**원인:** `.env` 파일에 `OPENAI_API_KEY`가 설정되지 않았거나, 서버가 환경변수를 읽지 못함

**해결:**
1. `.env` 파일이 프로젝트 루트에 있는지 확인
2. API 키가 올바르게 입력되었는지 확인
3. 서버 재시작

### "AI 이미지 생성 실패" 오류

**가능한 원인:**
1. API 키가 유효하지 않음
2. OpenAI 계정 크레딧 부족
3. 네트워크 연결 문제
4. 콘텐츠 정책 위반

**해결:**
1. OpenAI 대시보드에서 API 키 상태 확인
2. 계정 잔액 확인
3. 프롬프트 내용 검토 및 수정

### 이미지가 로드되지 않음

**해결:**
1. 브라우저 콘솔에서 오류 메시지 확인
2. 네트워크 탭에서 이미지 URL 확인
3. CORS 설정 확인

## API 사양

### 엔드포인트

```
POST /api/model-editor/ai-transform
```

### 요청 본문

```json
{
  "prompt": "캐릭터 설명",
  "style": "anime" // anime, realistic, cartoon, fantasy, cyberpunk, watercolor
}
```

### 응답

```json
{
  "success": true,
  "imageUrl": "https://...",
  "revisedPrompt": "OpenAI가 수정한 프롬프트",
  "message": "AI 이미지 생성이 완료되었습니다."
}
```

## 추가 참고 자료

- [OpenAI DALL-E 3 문서](https://platform.openai.com/docs/guides/images)
- [프롬프트 작성 가이드](https://platform.openai.com/docs/guides/prompt-engineering)
- [OpenAI API 참조](https://platform.openai.com/docs/api-reference/images)

