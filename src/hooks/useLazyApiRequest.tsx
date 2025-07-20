import { ApiState, FetchOptions } from '@/@types/fetch';
import {
  buildQueryString,
  fetchWithRetry,
} from '@/shared/query-string';
import { useCallback, useRef, useState } from 'react';

export function useLazyApiRequest<TResponse, TBody = unknown>() {
  const [state, setState] = useState<ApiState<TResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const lastCall = useRef<{
    url: string;
    options?: FetchOptions<TBody>;
  } | null>(null);

  const fetchData = useCallback(
    async (url: string, options?: FetchOptions<TBody>) => {
      const controller = new AbortController();
      lastCall.current = { url, options };
      setState({ data: null, loading: true, error: null });

      try {
        const {
          method = 'GET',
          body,
          headers = {},
          queryParams,
          retries,
          timeoutMs,
        } = options || {};
        const fullUrl = url + buildQueryString(queryParams);

        const data = await fetchWithRetry<TResponse>(
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
            signal: controller.signal,
          },
          { retries, timeoutMs }
        );

        setState({ data, loading: false, error: null });
        return data;
      } catch (err) {
        setState({
          data: null,
          loading: false,
          error:
            err instanceof Error ? err : new Error('Unknown error'),
        });
        throw err;
      }
    },
    []
  );

  const refetch = useCallback(async () => {
    if (lastCall.current) {
      return fetchData(
        lastCall.current.url,
        lastCall.current.options
      );
    }
    throw new Error('No previous fetch to refetch');
  }, [fetchData]);

  return { ...state, fetchData, refetch };
}
