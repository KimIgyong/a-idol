/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // RPT-260506 — @a-idol/shared 는 `tsc` 가 CJS 로 emit. Vite dev (esbuild)
      // 는 CJS→ESM interop 가능하지만 production Rollup 은 named export 추출
      // 실패 (예: ISSUE_KANBAN_COLUMNS). TS 소스로 직접 alias 해서 dev/prod
      // 모두 동일하게 ESM 으로 소비.
      '@a-idol/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
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
