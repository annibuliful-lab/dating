import { supabase } from '@/client/supabase';
import { BUCKET_NAME } from '@/client/supabase';

export interface ProfileImageData {
  id: string;
  imageKey: string;
  imageUrl: string;
  order: number;
}

/**
 * Get all profile images for a user
 */
export async function getProfileImages(
  userId: string
): Promise<ProfileImageData[]> {
  const { data, error } = await supabase
    .from('ProfileImage')
    .select('id, imageKey, order')
    .eq('userId', userId)
    .order('order', { ascending: true });

  if (error) throw error;

  return (
    data?.map((img) => {
      const { data: imageUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(img.imageKey);
      return {
        id: img.id,
        imageKey: img.imageKey,
        imageUrl: imageUrlData.publicUrl,
        order: img.order,
      };
    }) || []
  );
}

/**
 * Upload a new profile image
 */
export async function uploadProfileImage(
  userId: string,
  file: File,
  order: number
): Promise<ProfileImageData> {
  // Upload file to Supabase Storage
  const ext = file.name.split('.').pop() || 'jpg';
  const imageKey = `users/${userId}/profile-images/${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(imageKey, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: '3600',
    });

  if (uploadError) throw uploadError;

  // Create database record
  const { data, error } = await supabase
    .from('ProfileImage')
    .insert({
      userId,
      imageKey,
      order,
    })
    .select('id, imageKey, order')
    .single();

  if (error) {
    // If database insert fails, try to delete the uploaded file
    await supabase.storage.from(BUCKET_NAME).remove([imageKey]);
    throw error;
  }

  const { data: imageUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(imageKey);

  return {
    id: data.id,
    imageKey: data.imageKey,
    imageUrl: imageUrlData.publicUrl,
    order: data.order,
  };
}

/**
 * Delete a profile image
 */
export async function deleteProfileImage(imageId: string): Promise<void> {
  // Get the image record to get the imageKey
  const { data: imageData, error: fetchError } = await supabase
    .from('ProfileImage')
    .select('imageKey')
    .eq('id', imageId)
    .single();

  if (fetchError) throw fetchError;

  // Delete from storage
  if (imageData.imageKey) {
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([imageData.imageKey]);
    if (deleteError) {
      console.error('Error deleting file from storage:', deleteError);
      // Continue to delete DB record even if storage delete fails
    }
  }

  // Delete database record
  const { error } = await supabase
    .from('ProfileImage')
    .delete()
    .eq('id', imageId);

  if (error) throw error;
}

/**
 * Reorder profile images
 */
export async function reorderProfileImages(
  userId: string,
  imageIds: string[]
): Promise<void> {
  // Update order for each image
  const updates = imageIds.map((id, index) =>
    supabase
      .from('ProfileImage')
      .update({ order: index })
      .eq('id', id)
      .eq('userId', userId)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error).map((r) => r.error);

  if (errors.length > 0) {
    throw new Error(`Failed to reorder images: ${errors[0]?.message}`);
  }
}

/**
 * Save profile images (used when saving profile)
 * This handles creating new images and updating orders
 */
export async function saveProfileImages(
  userId: string,
  images: Array<{ id?: string; imageKey: string; order: number }>
): Promise<void> {
  // Get existing images
  const { data: existingImages } = await supabase
    .from('ProfileImage')
    .select('id, imageKey')
    .eq('userId', userId);

  const existingImageKeys = new Set(
    existingImages?.map((img) => img.imageKey) || []
  );
  const newImageKeys = new Set(
    images.map((img) => img.imageKey).filter((key) => !existingImageKeys.has(key))
  );

  // Delete images that are no longer in the list
  if (existingImages) {
    const imagesToKeep = new Set(images.map((img) => img.imageKey));
    const imagesToDelete = existingImages.filter(
      (img) => !imagesToKeep.has(img.imageKey)
    );

    for (const img of imagesToDelete) {
      await deleteProfileImage(img.id);
    }
  }

  // Update orders for existing images and create new ones
  for (const img of images) {
    if (img.id && !img.id.startsWith('temp-')) {
      // Update existing image order (skip temp IDs)
      const { error } = await supabase
        .from('ProfileImage')
        .update({ order: img.order })
        .eq('id', img.id);
      if (error) throw error;
    } else if (newImageKeys.has(img.imageKey)) {
      // This is a new image that was just uploaded, create DB record
      const { error } = await supabase.from('ProfileImage').insert({
        userId,
        imageKey: img.imageKey,
        order: img.order,
      });
      if (error) throw error;
    }
  }
}

