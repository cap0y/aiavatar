import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: './client',
  publicDir: '../public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  server: {
    port: 3001, // 포트 충돌 방지를 위해 3001로 변경
    host: true,
    open: true, // 자동으로 브라우저 열기
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001', // 백엔드 API 서버로 프록시 (포트 5001로 수정)
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 120000, // AI 이미지 생성을 위해 120초로 증가
        proxyTimeout: 120000, // 프록시 타임아웃도 120초로 증가
        // 연결 풀 관리
        agent: false,
        headers: {
          'Connection': 'keep-alive',
        },
      },
    },
    // HMR 연결 관리 강화
    hmr: {
      port: 3002, // HMR 포트도 변경
      host: 'localhost',
      overlay: true, // 에러 오버레이 표시
    },
    // 파일 감시 설정
    watch: {
      usePolling: true, // 파일 시스템 폴링 사용 (일부 환경에서 필요)
      interval: 100, // 폴링 간격 (ms)
      ignored: ['**/node_modules/**', '**/dist/**'], // 감시에서 제외할 폴더
    },
  },
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
    // 프로덕션에서는 소스맵 비활성화 (빌드 크기 절감)
    sourcemap: false,
    rollupOptions: {
      external: (id) => {
        // pixi-live2d가 PIXI를 찾을 수 있도록 외부 의존성으로 처리하지 않음
        return false;
      }
    }
  },
  // 최적화 설정 - 문제가 되는 패키지들 제외
  optimizeDeps: {
    force: true, // 의존성 사전 번들링 강제 재실행
    include: ['react', 'react-dom', 'pixi.js'], // 사전 번들링에 포함할 패키지
    exclude: [
      '@radix-ui/react-scroll-area', // 문제가 되는 패키지 제외
      'react-day-picker', // 문제가 되는 패키지 제외
      'pixi-live2d', // 문제가 되는 패키지 제외
    ],
  },
  // 개발 모드에서 캐시 비활성화
  define: {
    __DEV__: JSON.stringify(true),
    global: 'globalThis',
  },
  // CSS 설정
  css: {
    devSourcemap: true, // CSS 소스맵 활성화
  },
})

