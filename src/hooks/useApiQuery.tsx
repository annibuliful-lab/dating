import { useSession } from 'next-auth/react';
import { cachedRead } from '@/services/read-cache';
import { userApiReadKey } from '@/services/user-api';
import {
  buildQueryString,
  fetchWithRetry,
} from '@/shared/query-string';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type QueryOptions<TBody, TResponse> = {
  method?: 'GET' | 'POST';
  body?: TBody;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  retries?: number;
  timeoutMs?: number;
  lazy?: boolean;
  enabled?: boolean;
  cacheTimeMs?: number;
  cacheKey?: string;
  onCompleted?: (data: TResponse) => void;
  onError?: (error: Error) => void;
};

export function useApiQuery<TResponse, TBody = unknown>(
  url: string,
  options?: QueryOptions<TBody, TResponse>,
) {
  const {
    method = 'GET',
    body,
    headers = {},
    queryParams,
    retries,
    timeoutMs,
    lazy = false,
    enabled = true,
    cacheTimeMs = 0,
    cacheKey,
    onCompleted,
    onError,
  } = options || {};

  const { data: session, status } = useSession();
  const sessionKey = JSON.stringify([status, session?.user?.id, session?.user?.role, session?.user?.status, session?.user?.isVerified]);
  const requestRef = useRef(0);
  const scopeRef = useRef(sessionKey);
  useLayoutEffect(() => { scopeRef.current = sessionKey; }, [sessionKey]);
  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(!lazy && enabled);
  const [error, setError] = useState<Error | null>(null);
  const prevCallKeyRef = useRef<string>('');

  const fetchData = useCallback(async (force = false) => {
    const requestId = ++requestRef.current;
    const isCurrent = () => requestRef.current === requestId && scopeRef.current === sessionKey;
    setLoading(true);
    setError(null);
    const fullUrl = url + buildQueryString(queryParams);
    const load = () => fetchWithRetry<TResponse>(fullUrl, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    }, { retries, timeoutMs });
    try {
      const res = method === 'GET'
        ? await cachedRead(userApiReadKey('http', fullUrl, [cacheKey, headers, sessionKey]), load, cacheTimeMs, force)
        : await load();
      if (isCurrent()) {
        setData(res);
        onCompleted?.(res);
      }
      return res;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (isCurrent()) {
        setError(error);
        onError?.(error);
      }
      throw error;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [url, method, body, headers, queryParams, retries, timeoutMs, cacheTimeMs, cacheKey, onCompleted, onError, sessionKey]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  // Generate a stable call key to detect actual changes
  const callKey = useMemo(() => {
    return JSON.stringify({ url, lazy, enabled, options, sessionKey });
  }, [url, lazy, enabled, options, sessionKey]);

  useEffect(() => {
    // Only call fetchData if the call key has changed AND lazy is false and enabled is true
    if (!lazy && enabled && callKey !== prevCallKeyRef.current) {
      prevCallKeyRef.current = callKey;
      void fetchData().catch(() => {});
    }
  }, [callKey, lazy, enabled, fetchData]);

  return { data, loading, error, refetch, fetch: fetchData };
}
