import { describe, it, expect } from 'vitest';
import { parseTasks } from './tasks-page';

/** T-088 — WBS markdown → TaskRow[] 파서. */
describe('parseTasks', () => {
  it('TC-PT-001 — phase header + task row 파싱', () => {
    const md = [
      '### Phase 0 — Setup',
      '',
      '| ID | Task | Area | Priority | Effort | Depends |',
      '|----|------|------|----------|--------|---------|',
      '| T-001 | Monorepo scaffolding | infra | P0 | 1d | - |',
      '| T-002 | Shared package | shared | P0 | 2d | T-001 |',
    ].join('\n');

    const tasks = parseTasks(md);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      id: 'T-001',
      title: 'Monorepo scaffolding',
      scope: 'infra',
      priority: 'P0',
      estimate: '1d',
      deps: '-',
      phase: 'Phase 0 — Setup',
    });
    expect(tasks[1].id).toBe('T-002');
  });

  it('TC-PT-002 — progress row (🟢/🟡 emoji + %) 가 같은 task 에 merge', () => {
    const md = [
      '### Phase D — Stabilization',
      '',
      '| ID | Task | Area | Priority | Effort | Depends |',
      '|----|------|------|----------|--------|---------|',
      '| T-080 | Observability | devops | P0 | 3d | T-008 |',
      '',
      '| ID | 진행 | 비고 |',
      '|---|---|---|',
      '| T-080 | 🟢 95% | Sentry SDK 통합. DSN 발급 대기 |',
    ].join('\n');

    const tasks = parseTasks(md);
    const t80 = tasks.find((t) => t.id === 'T-080');
    expect(t80).toBeDefined();
    expect(t80!.title).toBe('Observability');
    expect(t80!.progress).toContain('🟢');
    expect(t80!.progress).toContain('95%');
    expect(t80!.note).toContain('Sentry SDK');
  });

  it('TC-PT-003 — header row (ID | Task | ...) 는 task 로 파싱하지 않음', () => {
    const md = [
      '### Phase X',
      '',
      '| ID | Task | Area | Priority | Effort | Depends |',
      '|----|------|------|----------|--------|---------|',
      '| T-100 | sample | x | P0 | 1d | - |',
    ].join('\n');

    const tasks = parseTasks(md);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('T-100');
  });

  it('TC-PT-004 — 정렬: ID 오름차순', () => {
    const md = [
      '### Phase Z',
      '',
      '| ID | Task | Area | Priority | Effort | Depends |',
      '|----|------|------|----------|--------|---------|',
      '| T-099 | last | x | P0 | 1d | - |',
      '| T-001 | first | x | P0 | 1d | - |',
      '| T-050 | mid | x | P0 | 1d | - |',
    ].join('\n');

    const tasks = parseTasks(md);
    expect(tasks.map((t) => t.id)).toEqual(['T-001', 'T-050', 'T-099']);
  });

  it('TC-PT-005 — 빈 markdown → 빈 배열', () => {
    expect(parseTasks('')).toEqual([]);
  });

  it('TC-PT-006 — task row 만 있고 progress 없는 경우 progress=undefined', () => {
    const md = [
      '### Phase A',
      '',
      '| T-200 | something | x | P1 | 2d | - |',
    ].join('\n');
    const tasks = parseTasks(md);
    expect(tasks[0].progress).toBeUndefined();
    expect(tasks[0].note).toBeUndefined();
  });

  it('TC-PT-007 — phase header 다른 형식 (### Phase D — Stabilization)', () => {
    const md = [
      '### Phase D — Stabilization (W16-W19)',
      '| T-080 | Observability | devops | P0 | 3d | T-008 |',
    ].join('\n');
    const tasks = parseTasks(md);
    expect(tasks[0].phase).toContain('Phase D');
  });
});
