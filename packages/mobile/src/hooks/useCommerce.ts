import { useCallback, useEffect, useState } from 'react';
import type {
  MyVoteTicketsDto,
  PurchaseProductDto,
  PurchaseTransactionDto,
  UserPhotocardDto,
} from '@a-idol/shared';
import { api, ApiError, takeErrorRequestId } from '../api/client';

export function useProducts() {
  const [data, setData] = useState<PurchaseProductDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.listProducts());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}

export function useMyVoteTickets(token: string | null) {
  const [data, setData] = useState<MyVoteTicketsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setData(await api.getMyVoteTickets(token));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, refresh: load };
}

export function useMyPhotocards(token: string | null) {
  const [data, setData] = useState<UserPhotocardDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.listMyPhotocards(token));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}

export function usePurchase(token: string | null) {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<PurchaseTransactionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per ADR-017, only show the id for unexpected errors (5xx / network) —
  // expected business-rule 4xx errors (NOT_ENOUGH_TICKETS etc.) don't need it.
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  const buy = useCallback(
    async (productId: string): Promise<PurchaseTransactionDto | null> => {
      if (!token || busy) return null;
      setBusy(true);
      setError(null);
      setErrorRequestId(null);
      try {
        const res = await api.createPurchase({ productId }, token);
        setLastResult(res);
        return res;
      } catch (e) {
        const err = e as ApiError;
        const code = err.code;
        const msg = err.message;
        setError(code ? `${code}: ${msg}` : msg);
        setErrorRequestId(takeErrorRequestId(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [token, busy],
  );

  return { buy, busy, lastResult, error, errorRequestId };
}
