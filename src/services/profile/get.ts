import type { UserProfile } from '@/@types/user';
import { userApi } from '@/services/user-api';

export function getUserProfile(userId: string): Promise<UserProfile> {
  return userApi('profile', 'getUserProfile', [userId]);
}
