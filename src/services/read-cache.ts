const cached = new Map<string, { data: unknown; timestamp: number }>();
const pending = new Map<string, Promise<unknown>>();

export function clearReadCache() {
  cached.clear();
  pending.clear();
}

export function cachedRead<T>(key: () => string, load: () => Promise<T>, ttl = 0, force = false): Promise<T> {
  const requestKey = key();
  const active = pending.get(requestKey);
  if (active) return active as Promise<T>;
  const existing = cached.get(requestKey);
  if (!force && existing && Date.now() - existing.timestamp < ttl) return Promise.resolve(existing.data as T);

  const request = load().then(data => {
    // A write may have completed while this read was in flight.
    if (key() !== requestKey) return cachedRead(key, load, ttl, true);
    if (ttl > 0) {
      cached.set(requestKey, { data, timestamp: Date.now() });
      if (cached.size > 100) cached.delete(cached.keys().next().value!);
    }
    return data;
  }).finally(() => {
    if (pending.get(requestKey) === request) pending.delete(requestKey);
  });
  pending.set(requestKey, request);
  return request;
}
