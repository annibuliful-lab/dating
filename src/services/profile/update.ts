import { userApi } from '@/services/user-api';
import type { ProfileInput } from '@/server/data/profile-update';

export async function updateUserProfile(userId: string, input: ProfileInput) {
  return userApi('profile', 'updateUserProfile', [userId, input]);
}
