import {
  buildQueryString,
  fetchWithRetry,
} from '@/shared/query-string';
import { useCallback, useEffect, useRef, useState } from 'react';

type QueryOptions<TBody, TResponse> = {
  method?: 'GET' | 'POST';
  body?: TBody;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  retries?: number;
  timeoutMs?: number;
  lazy?: boolean;
  onCompleted?: (data: TResponse) => void;
  onError?: (error: Error) => void;
};

export function useApiQuery<TResponse, TBody = unknown>(
  url: string,
  options?: QueryOptions<TBody, TResponse>
) {
  const {
    method = 'GET',
    body,
    headers = {},
    queryParams,
    retries,
    timeoutMs,
    lazy = false,
    onCompleted,
    onError,
  } = options || {};

  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(!lazy);
  const [error, setError] = useState<Error | null>(null);
  const lastCallRef = useRef({ url, options });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fullUrl = url + buildQueryString(queryParams);
    lastCallRef.current = { url, options };

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
        { retries, timeoutMs }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(options)]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  useEffect(() => {
    if (!lazy) fetchData();
  }, [fetchData, lazy]);

  return { data, loading, error, refetch, fetch: fetchData };
}
