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
    onCompleted,
    onError,
  } = options || {};

  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(!lazy && enabled);
  const [error, setError] = useState<Error | null>(null);
  const prevCallKeyRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fullUrl = url + buildQueryString(queryParams);

    try {
      const res = await fetchWithRetry<TResponse>(
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
      );

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
    onCompleted,
    onError,
  ]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

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
