export function normalizeImageUrl(inputUrl?: string): string {
  if (!inputUrl) return '';

  // data URL 은 그대로 사용
  if (inputUrl.startsWith('data:')) return inputUrl;

  // 상대 경로 처리
  if (inputUrl.startsWith('/')) {
    const path = inputUrl.startsWith('/api/') ? inputUrl.substring(4) : inputUrl;
    return path;
  }

  // 절대 URL 처리
  try {
    const url = new URL(inputUrl);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const pathWithSearch = `${url.pathname}${url.search || ''}`;

      // 동일 호스트면 경로만 사용
      if (typeof window !== 'undefined' && url.host === window.location.host) {
        return pathWithSearch;
      }

      // 다른 호스트더라도 우리 정적 자원 경로면 경로만 사용
      if (
        pathWithSearch.startsWith('/images/') ||
        pathWithSearch.startsWith('/uploads/') ||
        pathWithSearch.startsWith('/public/') ||
        pathWithSearch.startsWith('/api/uploads/')
      ) {
        return pathWithSearch.startsWith('/api/')
          ? pathWithSearch.substring(4)
          : pathWithSearch;
      }

      // 외부 호스트의 URL (Google, Kakao 프로필 사진 등)은 원본 그대로 반환
      return inputUrl;
    }
  } catch {
    // URL 파싱 실패시 원본 반환
  }

  return inputUrl;
}

export function normalizeHtmlImageSrc(html: string): string {
  if (!html) return html;
  try {
    // <img src="...">의 src를 찾아 교체. 큰따옴표/작은따옴표 모두 대응
    return html.replace(/(<img\s+[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (_m, p1, src, p3) => {
      const normalized = normalizeImageUrl(src);
      return `${p1}${normalized}${p3}`;
    });
  } catch {
    return html;
  }
} 