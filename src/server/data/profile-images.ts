import 'server-only';
import { supabase } from '@/server/supabase';
import { AccessError } from '@/server/access';
import { integer, list, object, scopedKey, uuid } from '@/server/validation';
import { getPublicStorageUrl } from '@/services/supabase/storage';

export interface ProfileImageData { id: string; imageKey: string; imageUrl: string; order: number }

export async function getProfileImages(userId: string): Promise<ProfileImageData[]> {
  const { data, error } = await supabase.from('ProfileImage').select('id, imageKey, order').eq('userId', userId).order('order');
  if (error) throw error;
  return (data || []).map(image => ({ ...image, imageUrl: getPublicStorageUrl(image.imageKey) || '' }));
}

export async function deleteProfileImage(userId: string, imageId: string) {
  const { data, error } = await supabase.from('ProfileImage').select('imageKey').eq('id', imageId).eq('userId', userId).single();
  if (error || !data) throw new AccessError(404, 'Image not found');
  const deletion = await supabase.from('ProfileImage').delete().eq('id', imageId).eq('userId', userId);
  if (deletion.error) throw deletion.error;
  const storage = await supabase.storage.from('dating').remove([data.imageKey]);
  if (storage.error) throw storage.error;
}

export async function saveProfileImages(userId: string, input: unknown) {
  const images = list(input, value => {
    const image = object(value);
    return {
      id: image.id && !String(image.id).startsWith('temp-') ? uuid(image.id) : undefined,
      imageKey: scopedKey(image.imageKey, `users/${userId}/profile-images/`),
      order: integer(image.order, 0, 4),
    };
  }, 5);
  const existing = await getProfileImages(userId);
  if (new Set(images.map(image => image.imageKey)).size !== images.length ||
      new Set(images.map(image => image.order)).size !== images.length ||
      images.some(image => image.id && !existing.some(row => row.id === image.id && row.imageKey === image.imageKey))) {
    throw new AccessError(400, 'Invalid images');
  }
  // Validate the entire submitted set before any mutation or deletion.
  for (const image of images) {
    const current = existing.find(row => row.imageKey === image.imageKey);
    const result = current
      ? await supabase.from('ProfileImage').update({ order: image.order }).eq('id', current.id).eq('userId', userId)
      : await supabase.from('ProfileImage').insert({ id: crypto.randomUUID(), userId, imageKey: image.imageKey, order: image.order, updatedAt: new Date().toISOString() });
    if (result.error) throw result.error;
  }
  for (const image of existing.filter(row => !images.some(image => image.imageKey === row.imageKey))) await deleteProfileImage(userId, image.id);
}

export async function reorderProfileImages(userId: string, input: unknown) {
  const ids = list(input, uuid, 5);
  const existing = await getProfileImages(userId);
  if (ids.length !== existing.length || new Set(ids).size !== ids.length || ids.some(id => !existing.some(image => image.id === id))) throw new AccessError(400, 'Invalid images');
  await saveProfileImages(userId, ids.map((id, order) => ({ ...existing.find(image => image.id === id)!, order })));
}
