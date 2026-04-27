import { useCallback, useEffect, useState } from 'react';
import type { ChatBalanceDto } from '@a-idol/shared';
import { api } from '../api/client';

export function useChatBalance(token: string | null) {
  const [balance, setBalance] = useState<ChatBalanceDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const b = await api.getChatBalance(token);
      setBalance(b);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, refresh, error };
}
