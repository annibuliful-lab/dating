import { ProfileImage, UserProfile } from '@/@types/user';
import { BUCKET_NAME, supabase } from '@/client/supabase';

export async function getUserProfile(
  userId: string
): Promise<UserProfile> {
  const { data: _userProfile, error } = await supabase
    .from('User')
    .select(
      [
        'id',
        'username',
        'fullName',
        'gender',
        'birthday',
        'bio',
        'phone',
        'lineId',
        'height',
        'weight',
        'profileImageKey',
        'lastname',
        'relationShipStatus',
        'isVerified',
        'verificationType',
        'verifiedAt',
        'isAdmin',
      ].join(',')
    )
    .eq('id', userId)
    .single();

  if (error) throw error;

  const userProfile = _userProfile as unknown as UserProfile;

  // Get profile images
  const { data: profileImagesData, error: imagesError } = await supabase
    .from('ProfileImage')
    .select('id, imageKey, order')
    .eq('userId', userId)
    .order('order', { ascending: true });

  let profileImages: ProfileImage[] | undefined;
  if (!imagesError && profileImagesData) {
    profileImages = profileImagesData.map((img) => {
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
    };
  }

  return {
    ...userProfile,
    profileImages,
  };
}
