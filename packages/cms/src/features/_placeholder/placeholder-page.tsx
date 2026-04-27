import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        <p className="mt-1 text-sm text-ink-600">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>스캐폴딩 완료</CardTitle>
          <CardDescription>
            이 화면은 후속 WBS 작업에서 구현됩니다. 현재는 레이아웃과 라우팅 검증용 placeholder 입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
            <li>인증 보호 라우트 진입 확인</li>
            <li>Tailwind + shadcn/ui primitive 렌더 확인</li>
            <li>React Query / Zustand 스토어 마운트 확인</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
