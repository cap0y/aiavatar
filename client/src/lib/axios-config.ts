import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
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
    console.error('API 오류:', error.response?.status || error.message, error.config?.url || '알 수 없는 URL');
    return Promise.reject(error);
  }
); 