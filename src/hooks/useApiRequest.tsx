import { FetchOptions, ApiState } from '@/@types/fetch';
import {
  buildQueryString,
  fetchWithRetry,
} from '@/shared/query-string';
import { useEffect, useRef, useState } from 'react';

export function useApiRequest<TResponse, TBody = unknown>(
  url: string,
  options?: FetchOptions<TBody>,
) {
  const [state, setState] = useState<ApiState<TResponse>>({
    data: null,
    loading: true,
    error: null,
  });
  const prevCallRef = useRef<{ url: string; optionsString: string }>({
    url,
    optionsString: JSON.stringify(options),
  });

  useEffect(() => {
    const controller = new AbortController();
    const optionsString = JSON.stringify(options);
    const callKey = JSON.stringify({ url, optionsString });

    // Skip if this is the same call as the previous render
    if (JSON.stringify(prevCallRef.current) === callKey) {
      return;
    }
    prevCallRef.current = { url, optionsString };

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
          { retries, timeoutMs },
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
  }, [url, options]);

  return state;
}
