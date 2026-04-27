import { Idol } from '@a-idol/shared';
import { ToggleHeartUseCase } from './toggle-heart.usecase';
import type { HeartRepository } from './interfaces';

describe('ToggleHeartUseCase', () => {
  const makeRepo = (): { repo: HeartRepository; state: { hearted: Set<string>; count: number } } => {
    const state = { hearted: new Set<string>(), count: 0 };
    const key = (u: string, i: string) => `${u}:${i}`;
    const repo: HeartRepository = {
      toggle: jest.fn(async (userId: string, idolId: string) => {
        const k = key(userId, idolId);
        if (state.hearted.has(k)) {
          state.hearted.delete(k);
          state.count -= 1;
          return { hearted: false, heartCount: state.count };
        }
        state.hearted.add(k);
        state.count += 1;
        return { hearted: true, heartCount: state.count };
      }),
      listHeartedIdols: jest.fn(async () => ({ items: [] as Idol[], total: 0 })),
      getMyListIdentity: jest.fn(async () => ({ total: 0, maxCreatedAt: null })),
    };
    return { repo, state };
  };

  it('TC-F001 — first toggle hearts the idol and increments count', async () => {
    const { repo } = makeRepo();
    const uc = new ToggleHeartUseCase(repo);
    const res = await uc.execute({ userId: 'u1', idolId: 'i1' });
    expect(res).toEqual({ hearted: true, heartCount: 1 });
  });

  it('TC-F002 — second toggle un-hearts and decrements count', async () => {
    const { repo } = makeRepo();
    const uc = new ToggleHeartUseCase(repo);
    await uc.execute({ userId: 'u1', idolId: 'i1' });
    const res = await uc.execute({ userId: 'u1', idolId: 'i1' });
    expect(res).toEqual({ hearted: false, heartCount: 0 });
  });

  it('TC-F003 — per-user independence', async () => {
    const { repo } = makeRepo();
    const uc = new ToggleHeartUseCase(repo);
    const a = await uc.execute({ userId: 'u1', idolId: 'i1' });
    const b = await uc.execute({ userId: 'u2', idolId: 'i1' });
    expect(a.heartCount).toBe(1);
    expect(b.heartCount).toBe(2);
  });
});
