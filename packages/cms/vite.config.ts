/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // pnpm 모노레포에서 mobile (Expo) + cms 가 react 18.2.0 으로 align —
    // dedupe 로 root hoist 와 packages/* 사이 react 단일화 (RTL 의 createRoot 가
    // mismatch 시 silent render fail 되는 문제 회피).
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // 자동 mock: 통합 테스트 영역 분리. ITC 같은 무거운 spec 은 backend 만 사용.
    include: ['src/**/*.spec.{ts,tsx}'],
  },
  build: {
    // 단일 entry chunk 가 1MB 가까워지는 문제 — vendor 분리 + route 별 lazy.
    // gzipped 기준으로도 main 이 280KB 이상이라 staging 첫 로드 latency 가 큼.
    chunkSizeWarningLimit: 600,
    // T-080 Sentry 연계용 — 'hidden' 은 .map 을 생성하지만 응답에 sourceMappingURL
    // 주석을 넣지 않음. 클라이언트는 못 보지만 Sentry CLI 가 업로드 가능 (release
    // tagging + 스택 트레이스 deminify). DSN 미설정 시에도 비용 거의 없음 (.map
    // 파일은 dist 에만 존재, nginx 가 서빙 안 함 — 별도 보호 불필요).
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          // 마크다운 렌더 — 프로젝트 관리 메뉴만 사용. lazy 페이지에서만 비용 발생.
          'markdown-vendor': ['react-markdown', 'remark-gfm'],
          'sentry-vendor': ['@sentry/react'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'ui-vendor': [
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            'class-variance-authority',
            'clsx',
            'lucide-react',
            'tailwind-merge',
          ],
          'store-vendor': ['zustand'],
        },
      },
    },
  },
});
