import type { ReactNode } from 'react';
import type { AdminRole } from '@a-idol/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { hasRole, useAuthStore } from './auth-store';

interface RequireRoleProps {
  allow: AdminRole[];
  children: ReactNode;
}

export function RequireRole({ allow, children }: RequireRoleProps) {
  const session = useAuthStore((s) => s.session);

  if (!hasRole(session, ...allow)) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-800">접근 권한이 없습니다</CardTitle>
            <CardDescription className="text-red-700">
              이 페이지는 {allow.join(' · ')} 권한이 필요합니다.
              {session ? ` 현재 권한: ${session.user.role}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
