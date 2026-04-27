import { useCallback, useEffect, useState } from 'react';
import type { IdolDetailDto } from '@a-idol/shared';
import { api } from '../api/client';

export function useIdolDetail(id: string | undefined, token: string | null) {
  const [idol, setIdol] = useState<IdolDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getIdol(id, token);
      setIdol(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback((next: Partial<IdolDetailDto>) => {
    setIdol((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  return { idol, loading, error, reload: load, patch };
}
