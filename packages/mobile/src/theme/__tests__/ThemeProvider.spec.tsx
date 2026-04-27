import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { themes } from '../tokens';

function makeStorage(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set('@a-idol/theme/v1', initial);
  return {
    store,
    getItem: jest.fn(async (k: string) => store.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
  };
}

function wrapper(storage: ReturnType<typeof makeStorage>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider storage={storage}>{children}</ThemeProvider>;
  };
}

describe('ThemeProvider — 5 테마 hydration + 영속화', () => {
  it('cold start 시 default `blue` 테마로 시작', async () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper(storage) });

    await waitFor(() => expect(result.current.hydrating).toBe(false));
    expect(result.current.name).toBe('blue');
    expect(result.current.colors).toEqual(themes.blue);
  });

  it('AsyncStorage에 저장된 dark 테마 hydration 시 적용', async () => {
    const storage = makeStorage('dark');
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper(storage) });

    await waitFor(() => expect(result.current.name).toBe('dark'));
    expect(result.current.colors).toEqual(themes.dark);
    expect(storage.getItem).toHaveBeenCalledWith('@a-idol/theme/v1');
  });

  it('setTheme 호출 시 즉시 반영 + AsyncStorage 영속', async () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    act(() => result.current.setTheme('pink'));

    expect(result.current.name).toBe('pink');
    expect(result.current.colors.accent).toBe(themes.pink.accent);
    expect(storage.setItem).toHaveBeenCalledWith('@a-idol/theme/v1', 'pink');
  });

  it('잘못 저장된 값(예: 구버전)은 무시하고 default 유지', async () => {
    const storage = makeStorage('legacy-value');
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper(storage) });

    await waitFor(() => expect(result.current.hydrating).toBe(false));
    expect(result.current.name).toBe('blue');
  });

  it('연속 setTheme 호출 → 마지막 호출만 반영', async () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    act(() => result.current.setTheme('white'));
    act(() => result.current.setTheme('purple'));

    expect(result.current.name).toBe('purple');
    expect(storage.setItem).toHaveBeenLastCalledWith('@a-idol/theme/v1', 'purple');
  });
});
