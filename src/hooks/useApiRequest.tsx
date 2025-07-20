import { FetchOptions, ApiState } from '@/@types/fetch';
import {
  buildQueryString,
  fetchWithRetry,
} from '@/shared/query-string';
import { useEffect, useState } from 'react';

export function useApiRequest<TResponse, TBody = unknown>(
  url: string,
  options?: FetchOptions<TBody>
) {
  const [state, setState] = useState<ApiState<TResponse>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
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
      } catch (err) {
        setState({
          data: null,
          loading: false,
          error:
            err instanceof Error ? err : new Error('Unknown error'),
        });
      }
    };

    run();

    return () => controller.abort(); // cancel on unmount
  }, [options, url]);

  return state;
}
