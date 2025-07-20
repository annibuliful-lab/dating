type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type FetchOptions<TBody> = {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  retries?: number;
  timeoutMs?: number;
};

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};
