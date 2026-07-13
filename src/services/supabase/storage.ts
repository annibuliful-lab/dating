import { BUCKET_NAME, supabase } from '@/client/supabase';

export function getPublicStorageUrl(
  key: string | null | undefined,
  bucket = BUCKET_NAME,
): string | null {
  if (!key) return null;

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

export function getProfileImageUrl(
  profileImageKey: string | null | undefined,
): string | null {
  return getPublicStorageUrl(profileImageKey);
}

export async function uploadPublicStorageFile(
  key: string,
  file: File,
  options?: {
    bucket?: string;
    upsert?: boolean;
    cacheControl?: string;
  },
): Promise<string> {
  const { error } = await supabase.storage
    .from(options?.bucket || BUCKET_NAME)
    .upload(key, file, {
      upsert: options?.upsert ?? false,
      contentType: file.type,
      cacheControl: options?.cacheControl || '3600',
    });

  if (error) throw error;

  const publicUrl = getPublicStorageUrl(key, options?.bucket);
  if (!publicUrl) throw new Error('Failed to create public storage URL');

  return publicUrl;
}

export async function deletePublicStorageFiles(
  keys: string[],
  bucket = BUCKET_NAME,
): Promise<void> {
  if (keys.length === 0) return;

  const { error } = await supabase.storage.from(bucket).remove(keys);
  if (error) throw error;
}
