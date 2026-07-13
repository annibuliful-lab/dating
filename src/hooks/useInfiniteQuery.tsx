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
  enabled?: boolean;
  onCompleted?: (data: TResponse) => void;
  onError?: (error: Error) => void;
  pageSize?: number;
};

export function useInfiniteQuery<
  TResponse extends unknown[],
  TBody = unknown,
>(url: string, options?: QueryOptions<TBody, TResponse>) {
  const {
    method = 'GET',
    body,
    headers = {},
    queryParams = {},
    retries,
    timeoutMs,
    enabled = true,
    onCompleted,
    onError,
    pageSize = 20,
  } = options || {};

  const [data, setData] = useState<TResponse>(
    () => [] as unknown as TResponse,
  );
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const prevCallKeyRef = useRef<string>('');

  const fetchPage = useCallback(
    async (pageNumber: number, isInitial: boolean) => {
      if (!enabled) return;

      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const offset = pageNumber * pageSize;
      const params = {
        ...queryParams,
        limit: pageSize,
        offset,
      };

      const fullUrl = url + buildQueryString(params);

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

        setData((prevData) => {
          if (isInitial) {
            return res;
          }
          return [...prevData, ...res] as TResponse;
        });

        // Check if we got less items than page size, meaning no more pages
        setHasMore(res.length === pageSize);

        onCompleted?.(res);
        return res;
      } catch (err) {
        const e =
          err instanceof Error ? err : new Error('Unknown error');
        setError(e);
        onError?.(e);
        throw e;
      } finally {
        if (isInitial) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [
      url,
      method,
      body,
      headers,
      queryParams,
      retries,
      timeoutMs,
      pageSize,
      onCompleted,
      onError,
      enabled,
    ],
  );

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      pageRef.current += 1;
      fetchPage(pageRef.current, false);
    }
  }, [loadingMore, hasMore, fetchPage]);

  const refetch = useCallback(() => {
    pageRef.current = 0;
    fetchPage(0, true);
  }, [fetchPage]);

  // Generate a stable call key to detect actual changes
  const callKey = useMemo(() => {
    return JSON.stringify({ url, enabled, queryParams });
  }, [url, enabled, queryParams]);

  useEffect(() => {
    // Only call fetchData if the call key has changed AND enabled is true
    if (enabled && callKey !== prevCallKeyRef.current) {
      prevCallKeyRef.current = callKey;
      pageRef.current = 0;
      fetchPage(0, true);
    }
  }, [callKey, enabled, fetchPage]);

  return {
    data,
    loading,
    loadingMore,
    error,
    refetch,
    loadMore,
    hasMore,
    fetch: fetchPage,
  };
}
