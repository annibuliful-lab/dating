import { UserProfile } from '@/@types/user';
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
      ].join(',')
    )
    .eq('id', userId)
    .single();

  if (error) throw error;

  const userProfile = _userProfile as unknown as UserProfile;

  if (userProfile.profileImageKey) {
    const { data: profileUrl } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(userProfile.profileImageKey);

    return {
      ...userProfile,
      avatarUrl: profileUrl.publicUrl as string,
    };
  }

  return userProfile;
}
