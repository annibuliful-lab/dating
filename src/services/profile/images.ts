import { BUCKET_NAME, supabase } from "@/client/supabase";

export interface ProfileImageData {
  id: string;
  imageKey: string;
  imageUrl: string;
  order: number;
}

// Type definitions for ProfileImage table (not in Supabase types yet)
type ProfileImageRow = {
  id: string;
  userId: string;
  imageKey: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type ProfileImageInsert = {
  userId: string;
  imageKey: string;
  order: number;
};

type ProfileImageUpdate = {
  order?: number;
};

// Type-safe helper to query ProfileImage table
// Using a simpler approach that matches Supabase's actual API structure
type ProfileImageSelectResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type ProfileImageQueryBuilder = {
  select: (columns: string) => {
    eq: (
      column: keyof ProfileImageRow,
      value: unknown
    ) => {
      single: () => Promise<ProfileImageSelectResult<Partial<ProfileImageRow>>>;
      order: (
        column: keyof ProfileImageRow,
        options: { ascending: boolean }
      ) => Promise<ProfileImageSelectResult<Partial<ProfileImageRow>[]>>;
    };
  };
  insert: (values: ProfileImageInsert) => {
    select: (columns: string) => {
      single: () => Promise<ProfileImageSelectResult<Partial<ProfileImageRow>>>;
    };
  };
  update: (values: ProfileImageUpdate) => {
    eq: (
      column: keyof ProfileImageRow,
      value: unknown
    ) => Promise<ProfileImageSelectResult<never>>;
  };
  delete: () => {
    eq: (
      column: keyof ProfileImageRow,
      value: unknown
    ) => Promise<ProfileImageSelectResult<never>>;
  };
};

// Helper function to get type-safe ProfileImage query builder
function profileImageTable(): ProfileImageQueryBuilder {
  return supabase.from(
    "ProfileImage" as never
  ) as unknown as ProfileImageQueryBuilder;
}

/**
 * Get all profile images for a user
 */
export async function getProfileImages(
  userId: string
): Promise<ProfileImageData[]> {
  const { data, error } = await profileImageTable()
    .select("id, imageKey, order")
    .eq("userId", userId)
    .order("order", { ascending: true });

  if (error) throw error;

  return (
    (
      data as Array<Pick<ProfileImageRow, "id" | "imageKey" | "order">> | null
    )?.map((img) => {
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
  const ext = file.name.split(".").pop() || "jpg";
  const imageKey = `users/${userId}/profile-images/${userId}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(imageKey, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) throw uploadError;

  // Create database record
  const insertData: ProfileImageInsert = {
    userId,
    imageKey,
    order,
  };

  const { data, error } = await profileImageTable()
    .insert(insertData)
    .select("id, imageKey, order")
    .single();

  if (error) {
    // If database insert fails, try to delete the uploaded file
    await supabase.storage.from(BUCKET_NAME).remove([imageKey]);
    throw error;
  }

  const { data: imageUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(imageKey);

  const typedData = data as Pick<ProfileImageRow, "id" | "imageKey" | "order">;
  if (!typedData) {
    throw new Error("Failed to create profile image record");
  }

  return {
    id: typedData.id,
    imageKey: typedData.imageKey,
    imageUrl: imageUrlData.publicUrl,
    order: typedData.order,
  };
}

/**
 * Delete a profile image
 */
export async function deleteProfileImage(imageId: string): Promise<void> {
  // Get the image record to get the imageKey
  const { data: imageData, error: fetchError } = await profileImageTable()
    .select("imageKey")
    .eq("id", imageId)
    .single();

  if (fetchError) throw fetchError;

  // Delete from storage
  const typedImageData = imageData as Pick<ProfileImageRow, "imageKey"> | null;
  if (typedImageData?.imageKey) {
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([typedImageData.imageKey]);
    if (deleteError) {
      console.error("Error deleting file from storage:", deleteError);
      // Continue to delete DB record even if storage delete fails
    }
  }

  // Delete database record
  const { error } = await profileImageTable().delete().eq("id", imageId);

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
  const updates = imageIds.map(async (id, index) => {
    // First verify the image belongs to the user
    const { data: imageData } = await profileImageTable()
      .select("userId")
      .eq("id", id)
      .single();

    if (
      !imageData ||
      (imageData as Pick<ProfileImageRow, "userId">).userId !== userId
    ) {
      throw new Error("Unauthorized: Image does not belong to user");
    }

    // Update the order
    const updateData: ProfileImageUpdate = { order: index };
    const { error } = await profileImageTable().update(updateData).eq("id", id);

    if (error) {
      throw error;
    }
  });

  await Promise.all(updates);
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
  const { data: existingImages } = await profileImageTable()
    .select("id, imageKey")
    .eq("userId", userId)
    .order("order", { ascending: true });

  const typedExistingImages = existingImages as Array<
    Pick<ProfileImageRow, "id" | "imageKey">
  > | null;
  const existingImageKeys = new Set(
    typedExistingImages?.map((img) => img.imageKey) || []
  );
  const newImageKeys = new Set(
    images
      .map((img) => img.imageKey)
      .filter((key) => !existingImageKeys.has(key))
  );

  // Delete images that are no longer in the list
  if (typedExistingImages) {
    const imagesToKeep = new Set(images.map((img) => img.imageKey));
    const imagesToDelete = typedExistingImages.filter(
      (img) => !imagesToKeep.has(img.imageKey)
    );

    for (const img of imagesToDelete) {
      await deleteProfileImage(img.id);
    }
  }

  // Update orders for existing images and create new ones
  for (const img of images) {
    if (img.id && !img.id.startsWith("temp-")) {
      // Update existing image order (skip temp IDs)
      const updateData: ProfileImageUpdate = { order: img.order };
      const { error } = await profileImageTable()
        .update(updateData)
        .eq("id", img.id);
      if (error) throw error;
    } else if (newImageKeys.has(img.imageKey)) {
      // This is a new image that was just uploaded, create DB record
      const insertData: ProfileImageInsert = {
        userId,
        imageKey: img.imageKey,
        order: img.order,
      };
      const { error } = await profileImageTable()
        .insert(insertData)
        .select("id")
        .single();
      if (error) throw error;
    }
  }
}
