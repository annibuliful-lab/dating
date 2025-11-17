import { ProfileImage, UserProfile } from "@/@types/user";
import { BUCKET_NAME, supabase } from "@/client/supabase";

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const { data: _userProfile, error } = await supabase
    .from("User")
    .select(
      [
        "id",
        "username",
        "fullName",
        "gender",
        "birthday",
        "bio",
        "phone",
        "lineId",
        "height",
        "weight",
        "profileImageKey",
        "lastname",
        "relationShipStatus",
        "isVerified",
        "verificationType",
        "verifiedAt",
        "verifiedBy",
        "isAdmin",
      ].join(",")
    )
    .eq("id", userId)
    .single();

  if (error) throw error;

  const userProfile = _userProfile as unknown as UserProfile;

  // Get verifiedBy username if exists
  let verifiedByUsername: string | null = null;
  if (userProfile.verifiedBy) {
    const { data: verifiedByUser } = await supabase
      .from("User")
      .select("username")
      .eq("id", userProfile.verifiedBy)
      .single();

    if (verifiedByUser) {
      verifiedByUsername = verifiedByUser.username;
    }
  }

  // Get profile images using the type-safe helper
  // Import the helper function (we'll need to export it or create a shared utility)
  const { data: profileImagesData, error: imagesError } = await supabase
    .from("ProfileImage" as never)
    .select("id, imageKey, order")
    .eq("userId", userId)
    .order("order", { ascending: true });

  let profileImages: ProfileImage[] | undefined;
  if (!imagesError && profileImagesData) {
    type ProfileImageRow = {
      id: string;
      userId: string;
      imageKey: string;
      order: number;
    };
    profileImages = (
      profileImagesData as Array<
        Pick<ProfileImageRow, "id" | "imageKey" | "order">
      >
    ).map((img) => {
      const { data: imageUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(img.imageKey);
      return {
        id: img.id,
        imageKey: img.imageKey,
        imageUrl: imageUrlData.publicUrl,
        order: img.order,
      };
    });
  }

  if (userProfile.profileImageKey) {
    const { data: profileUrl } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(userProfile.profileImageKey);

    return {
      ...userProfile,
      avatarUrl: profileUrl.publicUrl as string,
      profileImages,
      verifiedByUsername,
    };
  }

  return {
    ...userProfile,
    profileImages,
    verifiedByUsername,
  };
}
