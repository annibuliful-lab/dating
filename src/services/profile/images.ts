import { userApi } from '@/services/user-api';
import { uploadPublicStorageFile, deletePublicStorageFiles } from '@/services/supabase/storage';
import type { ProfileImageData } from '@/server/data/profile-images';
export type { ProfileImageData };

export function getProfileImages(userId: string): Promise<ProfileImageData[]> {
  return userApi('profile', 'getProfileImages', [userId]);
}
export async function uploadProfileImage(userId: string, file: File, order: number): Promise<ProfileImageData> {
  const key = `users/${userId}/profile-images/${crypto.randomUUID()}.${file.name.split('.').pop() || 'jpg'}`;
  await uploadPublicStorageFile(key, file);
  try {
    return await userApi('profile', 'addProfileImage', [userId, key, order]);
  } catch (error) {
    await deletePublicStorageFiles([key]).catch(() => {});
    throw error;
  }
}
export function deleteProfileImage(imageId: string): Promise<void> {
  return userApi('profile', 'deleteProfileImage', [imageId]);
}
export function reorderProfileImages(userId: string, imageIds: string[]): Promise<void> {
  return userApi('profile', 'reorderProfileImages', [userId, imageIds]);
}
export function saveProfileImages(userId: string, images: Array<{ id?: string; imageKey: string; order: number }>): Promise<void> {
  return userApi('profile', 'saveProfileImages', [userId, images]);
}
