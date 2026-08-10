export function buildQueryString(
  params?: Record<string, string | number | boolean>
) {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) =>
    query.append(key, String(val))
  );
  return `?${query.toString()}`;
}

export async function fetchWithRetry<T>(
  input: RequestInfo,
  init: RequestInit,
  {
    retries = 0,
    timeoutMs = 0,
  }: { retries?: number; timeoutMs?: number }
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    try {
      const res = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const message =
          errorBody &&
          typeof errorBody === 'object' &&
          'message' in errorBody &&
          typeof errorBody.message === 'string'
            ? errorBody.message
            : `HTTP ${res.status} ${res.statusText}`;
        throw new Error(message);
      }
      const data = await res.json();
      if (timeoutId) clearTimeout(timeoutId);
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 300)); // retry delay
    }
  }

  throw new Error('Unreachable');
}
