import 'server-only';

const MAX_ENTRIES = 100;
const MAX_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;

// shortcut: caches are per process; use a shared cache when cross-instance invalidation is required.
export class ServerReadCache<T> {
  private cached = new Map<string, { data: T; bytes: number; expires: number }>();
  private pending = new Map<string, { request: Promise<T>; force: boolean }>();
  private active = new Set<Promise<T>>();
  private bytes = 0;
  private cleanup?: ReturnType<typeof setTimeout>;

  constructor(private ttl: number) {}

  clear() {
    this.cached.clear();
    this.pending.clear();
    this.bytes = 0;
    clearTimeout(this.cleanup);
    this.cleanup = undefined;
  }

  private remove(key: string) {
    const entry = this.cached.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.cached.delete(key);
  }

  private prune() {
    for (const [key, entry] of this.cached) {
      if (entry.expires <= Date.now()) this.remove(key);
    }
  }

  private scheduleCleanup() {
    clearTimeout(this.cleanup);
    this.cleanup = undefined;
    if (!this.cached.size) return;
    const expires = Math.min(...Array.from(this.cached.values(), entry => entry.expires));
    this.cleanup = setTimeout(() => { this.prune(); this.scheduleCleanup(); }, Math.max(1, expires - Date.now()));
    this.cleanup.unref?.();
  }

  read(key: string, load: (signal: AbortSignal) => PromiseLike<T>, force = false): Promise<T> {
    this.prune();
    const active = this.pending.get(key);
    if (active && (!force || active.force)) return active.request;
    const existing = this.cached.get(key);
    if (!force && existing) return Promise.resolve(existing.data);
    if (this.active.size >= MAX_ENTRIES) return Promise.reject(new Error('Read cache request capacity exceeded'));
    if (force) this.remove(key);

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    const expired = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('Data request timed out'));
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    });
    const request = Promise.race([Promise.resolve().then(() => load(controller.signal)), expired]).then(data => {
      // Cleared or superseded reads must never repopulate the cache.
      if (this.pending.get(key)?.request === request) {
        const bytes = Buffer.byteLength(JSON.stringify(data) ?? 'null');
        if (bytes <= MAX_BYTES) {
          this.prune();
          this.remove(key);
          while (this.cached.size >= MAX_ENTRIES || this.bytes + bytes > MAX_BYTES) {
            this.remove(this.cached.keys().next().value!);
          }
          this.cached.set(key, { data, bytes, expires: Date.now() + this.ttl });
          this.bytes += bytes;
          this.scheduleCleanup();
        }
      }
      return data;
    }).finally(() => {
      controller.abort();
      clearTimeout(timeout);
      this.active.delete(request);
      if (this.pending.get(key)?.request === request) this.pending.delete(key);
    });
    this.active.add(request);
    this.pending.set(key, { request, force });
    return request;
  }
}
