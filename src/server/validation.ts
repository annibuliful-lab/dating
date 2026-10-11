import { AccessError } from './access';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError(400, 'Invalid request');
  return value as Record<string, unknown>;
}

export function text(value: unknown, max = 10000, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new AccessError(400, 'Invalid text');
  return value;
}

export function uuid(value: unknown): string {
  const id = text(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AccessError(400, 'Invalid ID');
  return id;
}

export function integer(value: unknown, fallback: number, max: number): number {
  if (value == null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) throw new AccessError(400, 'Invalid number');
  return value;
}

export function list<T>(value: unknown, parse: (item: unknown) => T, max = 100): T[] {
  if (!Array.isArray(value) || value.length > max) throw new AccessError(400, 'Invalid list');
  return value.map(parse);
}

export function own(actorId: string, value: unknown) {
  if (uuid(value) !== actorId) throw new AccessError(403, 'Forbidden');
  return actorId;
}

export function scopedKey(key: unknown, prefix: string): string {
  const parsed = text(key, 1024);
  if (!parsed.startsWith(prefix) || /[\\\x00-\x1f?#]/.test(parsed) || parsed.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new AccessError(403, 'Invalid storage path');
  }
  return parsed;
}
