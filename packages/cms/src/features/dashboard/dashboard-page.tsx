import { useQuery } from '@tanstack/react-query';
import type { AdminAnalyticsOverviewDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorLine } from '@/components/ui/error-line';

export function DashboardPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => adminApi.getAnalyticsOverview(),
    staleTime: 30_000,
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">대시보드</h1>
          <p className="mt-1 text-sm text-ink-600">
            {data
              ? `마지막 갱신 ${new Date(data.generatedAt).toLocaleString()}`
              : 'KPI · 활성 오디션 랭킹'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? '갱신 중…' : '새로 고침'}
        </Button>
      </div>

      {error ? (
        <Card className="mb-4 border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <ErrorLine error={error} />
          </CardContent>
        </Card>
      ) : null}

      {isLoading || !data ? (
        <p className="py-12 text-center text-sm text-ink-600">로딩 중…</p>
      ) : (
        <>
          <Section title="사용자">
            <Kpi label="총 사용자" value={data.users.total} />
            <Kpi label="활성" value={data.users.active} />
            <Kpi label="신규 (7일)" value={data.users.new7d} tone="brand" />
          </Section>

          <Section title="카탈로그">
            <Kpi label="총 아이돌" value={data.catalog.totalIdols} />
            <Kpi label="공개" value={data.catalog.published} tone="brand" />
            <Kpi label="DRAFT" value={data.catalog.draft} />
            <Kpi label="소속사" value={data.catalog.agencies} />
          </Section>

          <Section title="팬덤">
            <Kpi label="총 하트" value={data.fandom.totalHearts} />
            <Kpi label="총 팔로우" value={data.fandom.totalFollows} />
            <Kpi label="활성 팬클럽 멤버" value={data.fandom.activeMemberships} tone="brand" />
          </Section>

          <Section title="채팅">
            <Kpi label="개설된 방" value={data.chat.roomsCreated} />
            <Kpi label="오늘 메시지" value={data.chat.messagesToday} tone="brand" />
            <Kpi label="쿠폰 총잔액" value={data.chat.couponBalanceSum} />
          </Section>

          <Section title="오디션">
            <Kpi label="진행 중" value={data.auditions.active} tone="brand" />
            <Kpi label="ACTIVE 라운드" value={data.auditions.activeRounds} />
            <Kpi label="오늘 투표" value={data.auditions.totalVotesToday} />
          </Section>

          <ActiveRoundsSection leaders={data.activeRoundLeaders} />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'brand';
}) {
  return (
    <Card
      className={
        tone === 'brand'
          ? 'border-brand-200 bg-gradient-to-br from-brand-50 to-white'
          : ''
      }
    >
      <CardContent className="p-4">
        <div className="text-xs text-ink-600">{label}</div>
        <div
          className={`mt-1 text-2xl font-bold tabular-nums ${
            tone === 'brand' ? 'text-brand-700' : 'text-ink-900'
          }`}
        >
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveRoundsSection({
  leaders,
}: {
  leaders: AdminAnalyticsOverviewDto['activeRoundLeaders'];
}) {
  if (leaders.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
        활성 라운드 랭킹 (Top 3)
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {leaders.map((r) => (
          <Card key={r.roundId}>
            <CardHeader>
              <CardTitle className="text-sm">
                {r.auditionName} — {r.roundName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {r.top.length === 0 ? (
                <p className="text-xs text-ink-600">아직 투표가 없습니다.</p>
              ) : (
                <ol className="flex flex-col gap-1.5">
                  {r.top.map((t) => (
                    <li
                      key={t.rank}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                          {t.rank}
                        </span>
                        <span className="font-medium text-ink-900">{t.idolName}</span>
                      </div>
                      <span className="font-mono text-xs text-ink-700">
                        {t.score.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
