import {
  buildQueryString,
  fetchWithRetry,
} from '@/shared/query-string';
import {
  useCallback,
  useEffect,
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

type CachedQuery = {
  data: unknown;
  timestamp: number;
};

const queryCache = new Map<string, CachedQuery>();
const pendingQueries = new Map<string, Promise<unknown>>();

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

  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(!lazy && enabled);
  const [error, setError] = useState<Error | null>(null);
  const prevCallKeyRef = useRef<string>('');

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    const fullUrl = url + buildQueryString(queryParams);
    const requestCacheKey =
      cacheKey ||
      JSON.stringify({
        url: fullUrl,
        method,
        body,
      });

    try {
      if (method === 'GET' && cacheTimeMs > 0 && !force) {
        const cached = queryCache.get(requestCacheKey);
        if (
          cached &&
          Date.now() - cached.timestamp < cacheTimeMs
        ) {
          const cachedData = cached.data as TResponse;
          setData(cachedData);
          onCompleted?.(cachedData);
          return cachedData;
        }

        const pending = pendingQueries.get(requestCacheKey);
        if (pending) {
          const pendingData = (await pending) as TResponse;
          setData(pendingData);
          onCompleted?.(pendingData);
          return pendingData;
        }
      }

      const request = fetchWithRetry<TResponse>(
          fullUrl,
          {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body:
              body && method !== 'GET'
                ? JSON.stringify(body)
                : undefined,
          },
          { retries, timeoutMs },
        ).finally(() => {
          pendingQueries.delete(requestCacheKey);
        });

      if (method === 'GET' && cacheTimeMs > 0) {
        pendingQueries.set(requestCacheKey, request);
      }

      const res = await request;

      if (method === 'GET' && cacheTimeMs > 0) {
        queryCache.set(requestCacheKey, {
          data: res,
          timestamp: Date.now(),
        });
      }

      setData(res);
      onCompleted?.(res);
      return res;
    } catch (err) {
      const e =
        err instanceof Error ? err : new Error('Unknown error');
      setError(e);
      onError?.(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [
    url,
    method,
    body,
    headers,
    queryParams,
    retries,
    timeoutMs,
    cacheTimeMs,
    cacheKey,
    onCompleted,
    onError,
  ]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  // Generate a stable call key to detect actual changes
  const callKey = useMemo(() => {
    return JSON.stringify({ url, lazy, enabled, options });
  }, [url, lazy, enabled, options]);

  useEffect(() => {
    // Only call fetchData if the call key has changed AND lazy is false and enabled is true
    if (!lazy && enabled && callKey !== prevCallKeyRef.current) {
      prevCallKeyRef.current = callKey;
      fetchData();
    }
  }, [callKey, lazy, enabled, fetchData]);

  return { data, loading, error, refetch, fetch: fetchData };
}
