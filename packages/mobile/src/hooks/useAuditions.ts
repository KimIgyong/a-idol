import { useCallback, useEffect, useState } from 'react';
import type { AuditionDto, AuditionListItemDto } from '@a-idol/shared';
import { api } from '../api/client';

export function useAuditionsList(status: 'ACTIVE' | 'FINISHED' = 'ACTIVE') {
  const [items, setItems] = useState<AuditionListItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listAuditions({ status }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, refresh: load };
}

export function useAudition(id: string | undefined) {
  const [audition, setAudition] = useState<AuditionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setAudition(await api.getAudition(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { audition, loading, error, refresh: load };
}
