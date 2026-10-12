import type { UserProfile } from '@/@types/user';
import { userApiRead } from '@/services/user-api';

export function getUserProfile(userId: string, force = false): Promise<UserProfile> {
  return userApiRead('profile', 'getUserProfile', [userId], 60000, force);
}
