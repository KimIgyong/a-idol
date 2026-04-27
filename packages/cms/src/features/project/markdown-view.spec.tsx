import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownView } from './markdown-view';

/** T-088 — MarkdownView: GFM 표 + heading + link 렌더 검증.
 * react-markdown v10 은 async 렌더 → `findBy*` 사용. */
describe('MarkdownView', () => {
  it('TC-MD-001 — h1 / paragraph 정상 렌더', async () => {
    render(<MarkdownView source={`# Title\n\n본문 내용입니다.`} />);
    expect(await screen.findByRole('heading', { level: 1, name: /title/i })).toBeInTheDocument();
    expect(await screen.findByText(/본문 내용입니다/)).toBeInTheDocument();
  });

  it('TC-MD-002 — GFM 표 렌더', async () => {
    const md = `| col1 | col2 |\n|---|---|\n| a | b |\n| c | d |`;
    render(<MarkdownView source={md} />);
    const table = await screen.findByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('col1')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('d')).toBeInTheDocument();
  });

  it('TC-MD-003 — link 외부 target=_blank 보안 속성', async () => {
    render(<MarkdownView source={`[A-idol](https://example.com)`} />);
    const link = await screen.findByRole('link', { name: /a-idol/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('TC-MD-004 — 빈 source 도 throw 없이 렌더', () => {
    const { container } = render(<MarkdownView source="" />);
    expect(container).toBeTruthy();
  });

  it('TC-MD-005 — list (unordered + ordered)', async () => {
    render(<MarkdownView source={`- a\n- b\n\n1. one\n2. two`} />);
    expect(await screen.findByText('a')).toBeInTheDocument();
    expect(screen.getByText('one')).toBeInTheDocument();
  });
});
