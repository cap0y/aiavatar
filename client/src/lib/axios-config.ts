import axios from 'axios';

// 개발 환경에서는 프록시를 사용하므로 baseURL을 빈 문자열로 설정
// 프로덕션 환경에서는 VITE_API_BASE 환경변수 사용
const getBaseURL = () => {
  // 개발 환경 감지
  if (import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return ''; // 개발 환경에서는 프록시 사용
  }
  return import.meta.env.VITE_API_BASE || '';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  withCredentials: false, // true에서 false로 변경
});

api.interceptors.response.use(
  response => {
    if (response.status >= 200 && response.status < 300) {
      console.log('API 응답 성공:', response.status, response.config.url);
    }
    return response;
  },
  error => {
    const status = error.response?.status;
    const url = error.config?.url || '알 수 없는 URL';
    
    if (status === 500) {
      console.warn(`서버 연결 실패 (${status}): ${url} - API 서버가 실행되지 않았을 수 있습니다.`);
    } else if (status >= 400) {
      console.warn(`API 오류 (${status}): ${url}`, error.message);
    } else {
      console.error('네트워크 오류:', error.message, url);
    }
    
    return Promise.reject(error);
  }
); 