// Vitest 글로벌 setup — testing-library/jest-dom 의 toBeInTheDocument 등
// custom matcher 를 expect 에 확장. matchMedia 같은 jsdom 미지원 API 도 stub.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom 미구현 — Tailwind/Radix 일부 컴포넌트가 사용.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
