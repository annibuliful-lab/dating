import { fetchWithRetry } from '@/shared/query-string';
import { useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type MutationOptions<_TBody, TResponse> = {
  method?: 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
  onCompleted?: (data: TResponse) => void;
  onError?: (error: Error) => void;
};

export function useApiMutation<TResponse, TBody = unknown>(
  url: string,
  defaultOptions?: MutationOptions<TBody, TResponse>
) {
  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (
    variables: TBody,
    overrideOptions?: MutationOptions<TBody, TResponse>
  ): Promise<TResponse> => {
    const {
      method = defaultOptions?.method || 'POST',
      headers = defaultOptions?.headers || {},
      retries = defaultOptions?.retries || 0,
      timeoutMs = defaultOptions?.timeoutMs || 0,
      onCompleted = defaultOptions?.onCompleted,
      onError = defaultOptions?.onError,
    } = overrideOptions || defaultOptions || {};

    setLoading(true);
    setError(null);

    try {
      const result = await fetchWithRetry<TResponse>(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(variables),
        },
        { retries, timeoutMs }
      );

      setData(result);
      onCompleted?.(result as never);
      return result;
    } catch (err) {
      const e =
        err instanceof Error ? err : new Error('Unknown error');
      setError(e);
      onError?.(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, mutate };
}
