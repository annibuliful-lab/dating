import { requestError } from '@/services/user-api';
export const BUCKET_NAME = 'dating';

export function getPublicStorageUrl(key: string | null | undefined, bucket = BUCKET_NAME): string | null {
  if (!key) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
export function getProfileImageUrl(key: string | null | undefined): string | null { return getPublicStorageUrl(key); }

export async function uploadPublicStorageFile(key: string, file: File, options?: { bucket?: string; upsert?: boolean; cacheControl?: string }): Promise<string> {
  if (options?.bucket && options.bucket !== BUCKET_NAME) throw new Error('Invalid bucket');
  const form = new FormData();
  form.set('file', file); form.set('key', key); form.set('kind', 'profile');
  const response = await fetch('/api/storage', { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw requestError(response.status);
  return result.publicUrl;
}
export async function deletePublicStorageFiles(keys: string[], bucket = BUCKET_NAME): Promise<void> {
  if (!keys.length) return;
  const response = await fetch('/api/storage', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys, bucket }),
  });
  if (!response.ok) throw requestError(response.status);
}
