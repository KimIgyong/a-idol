import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw, Smartphone } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { env } from '@/env';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QK } from '@/lib/query-keys';

/**
 * 모바일 앱 미리보기 — Expo web 빌드를 iframe으로 임베드. admin이 idol /
 * audition publish 후 실제 앱 화면을 즉시 확인. RN 코드 / CMS 사이 drift
 * 0 (RPT-260426-B 옵션 A).
 *
 * 알려진 제약:
 *  - Expo web dev server가 localhost:8081에 떠 있어야 iframe이 로드됨.
 *    `pnpm --filter @a-idol/mobile web`으로 별도 기동 필요. 미기동 시
 *    iframe은 connection refused 표시.
 *  - 일부 RN-only 기능 (네이티브 카메라/푸시/IAP)은 Expo web에서 동작 안
 *    함. UI/UX 미리보기 용도지 기능 검증용 아님.
 *  - VITE_MOBILE_PREVIEW_URL='' 설정 시 안내만 노출 (preview 비활성).
 */

const PRESETS = [
  { path: '/', label: '홈 (피드)' },
  { path: '/(app)/auditions', label: '오디션 목록' },
  { path: '/(app)/shop', label: '상점' },
  { path: '/(app)/collection', label: '내 포토카드' },
  { path: '/(app)/profile', label: '프로필' },
  { path: '/(auth)/login', label: '로그인' },
  { path: '/(auth)/signup', label: '가입' },
] as const;

const DYNAMIC_KINDS = ['idol', 'audition'] as const;
type DynamicKind = (typeof DYNAMIC_KINDS)[number];

function buildPath(kind: DynamicKind, id: string): string {
  if (kind === 'idol') return `/(app)/idol/${id}`;
  return `/(app)/auditions/${id}`;
}

export function PreviewPage() {
  const previewBase = env.VITE_MOBILE_PREVIEW_URL;
  const [path, setPath] = useState<string>(PRESETS[0].path);
  const [kind, setKind] = useState<DynamicKind>('idol');
  const [selectedId, setSelectedId] = useState<string>('');
  const [reloadToken, setReloadToken] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Pickers — small lists so admin 별도 ID 외울 필요 없음.
  const idols = useQuery({
    queryKey: [...QK.idols, 'preview-picker'],
    queryFn: () => adminApi.listIdols({ page: 1, size: 50 }),
    enabled: !!previewBase,
  });
  const auditions = useQuery({
    queryKey: [...QK.auditions, 'preview-picker'],
    queryFn: () => adminApi.listAuditions(),
    enabled: !!previewBase,
  });

  const fullUrl = useMemo(() => {
    if (!previewBase) return '';
    // expo-router가 /(app)/idol/:id 같은 segment 그대로 받지만 외부에서 직접
    // 접근할 때는 (group) prefix 없이 hit하는 게 안전. (group)을 strip.
    const cleaned = path.replace(/\/\([^)]+\)/g, '');
    const finalPath = cleaned || '/';
    // Cache-buster query — reload 버튼이 iframe state 강제 reset.
    return `${previewBase}${finalPath}#r=${reloadToken}`;
  }, [previewBase, path, reloadToken]);

  function applyPreset(p: string) {
    setPath(p);
  }

  function applyDynamic() {
    if (!selectedId) return;
    setPath(buildPath(kind, selectedId));
  }

  function reload() {
    setReloadToken((n) => n + 1);
    iframeRef.current?.focus();
  }

  if (!previewBase) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-ink-900">앱 미리보기</h1>
        <Card className="mt-4 border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 text-sm text-ink-700">
            <p>
              <code className="rounded bg-white px-1.5 py-0.5">VITE_MOBILE_PREVIEW_URL</code>{' '}
              환경 변수가 설정되어 있지 않습니다. <code>.env</code>에{' '}
              <code className="rounded bg-white px-1.5 py-0.5">
                VITE_MOBILE_PREVIEW_URL=http://localhost:8081
              </code>{' '}
              추가 후 dev 서버 재시작.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-900">
            <Smartphone className="h-6 w-6" />
            앱 미리보기
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Expo web 빌드 임베드. 실제 RN 컴포넌트가 렌더되므로 모바일 앱과 동일.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            새로고침
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={fullUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              새 탭
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* 좌측: 라우트 picker */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">고정 화면</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.path}
                  variant={path === p.path ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start"
                  onClick={() => applyPreset(p.path)}
                >
                  {p.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">개별 리소스</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <Label className="text-xs">종류</Label>
                <div className="mt-1 flex gap-2">
                  {DYNAMIC_KINDS.map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant={kind === k ? 'default' : 'outline'}
                      onClick={() => {
                        setKind(k);
                        setSelectedId('');
                      }}
                    >
                      {k === 'idol' ? '아이돌' : '오디션'}
                    </Button>
                  ))}
                </div>
              </div>

              {kind === 'idol' ? (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">— 선택 —</option>
                  {idols.data?.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.stageName ?? i.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">— 선택 —</option>
                  {auditions.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}

              <Button size="sm" onClick={applyDynamic} disabled={!selectedId}>
                적용
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">직접 입력</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-xs">경로</Label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/(app)/idol/<uuid>"
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-2 break-all text-[10px] text-ink-600">
                현재 URL: {fullUrl}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 우측: iframe + device frame */}
        <div className="flex min-h-[700px] justify-center">
          <DeviceFrame>
            <iframe
              ref={iframeRef}
              key={reloadToken}
              src={fullUrl}
              title="A-idol 모바일 미리보기"
              className="h-full w-full border-0"
            />
          </DeviceFrame>
        </div>
      </div>
    </div>
  );
}

/**
 * iPhone 14 비율 (390 × 844). 실제 모바일에서 어떻게 보이는지 가시적으로
 * 전달하기 위한 간단한 프레임. 디테일은 Phase D 이후에.
 */
function DeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[32px] border-[10px] border-slate-900 bg-slate-900 shadow-xl">
      <div
        className="overflow-hidden rounded-[22px] bg-white"
        style={{ width: 390, height: 844 }}
      >
        {children}
      </div>
    </div>
  );
}
