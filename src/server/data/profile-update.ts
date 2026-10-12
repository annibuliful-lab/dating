import { invalidateUserSearch } from '@/server/data/users';
import { invalidatePublicPosts } from '@/server/data/posts';
import 'server-only';
import { supabase } from '@/server/supabase';
import { AccessError } from '@/server/access';
import { object, scopedKey, text } from '@/server/validation';
import { normalizeEmail, normalizeUsername } from '@/lib/normalize-user-fields';
import { isValidEmail } from '@/shared/validation';

export type ProfileInput = {
  username?: string; gender?: string; birthday?: Date | string | null;
  bio?: string | null; phone?: string | null; lineId?: string | null;
  height?: number | string | null; weight?: number | string | null;
  profileImageKey?: string; relationShipStatus?: string;
  email?: string | null; password?: string | null;
};

export async function updateUserProfile(userId: string, input: ProfileInput) {
  const values = object(input);
  const allowed = ['username', 'gender', 'birthday', 'bio', 'phone', 'lineId', 'height', 'weight', 'profileImageKey', 'relationShipStatus', 'email', 'password'];
  if (Object.keys(values).some(key => !allowed.includes(key))) throw new AccessError(400, 'Invalid profile field');
  const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const field of ['bio', 'phone', 'lineId', 'gender', 'relationShipStatus'] as const) {
    if (values[field] !== undefined) payload[field] = values[field] === null ? null : text(values[field], field === 'bio' ? 2000 : 100, true);
  }
  if (values.username !== undefined) payload.username = normalizeUsername(text(values.username, 100));
  if (values.email !== undefined) {
    const email = normalizeEmail(text(values.email, 254));
    if (!email || !isValidEmail(email)) throw new AccessError(400, 'INVALID_EMAIL_OR_USERNAME');
    payload.email = email;
  }
  for (const field of ['height', 'weight']) {
    if (values[field] === undefined) continue;
    if (values[field] !== null && typeof values[field] !== 'number' && typeof values[field] !== 'string') throw new AccessError(400, 'Invalid measurement');
    const value = values[field] === '' || values[field] === null ? null : Number(values[field]);
    if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 500)) throw new AccessError(400, 'Invalid measurement');
    payload[field] = value;
  }
  if (values.birthday !== undefined) {
    const birthday = values.birthday === null ? null : new Date(text(values.birthday, 40));
    if (birthday && (!Number.isFinite(birthday.getTime()) || birthday > new Date() || birthday.getUTCFullYear() < 1900)) throw new AccessError(400, 'Invalid birthday');
    payload.birthday = birthday?.toISOString().slice(0, 10) ?? null;
    let age = birthday ? new Date().getUTCFullYear() - birthday.getUTCFullYear() : null;
    if (birthday && age !== null) {
      const today = new Date();
      if (today.getUTCMonth() < birthday.getUTCMonth() || (today.getUTCMonth() === birthday.getUTCMonth() && today.getUTCDate() < birthday.getUTCDate())) age--;
    }
    payload.age = age;
  }
  if (values.profileImageKey) payload.profileImageKey = scopedKey(values.profileImageKey, `users/${userId}/`);
  if (values.password !== undefined && values.password !== null) {
    const password = text(values.password, 1024, true);
    // Preserve the existing password format at the user's request.
    if (password.trim()) payload.passwordHash = password;
  }
  const { data, error } = await supabase.from('User').update(payload as never)
    .eq('id', userId).select('id, username, updatedAt').single();
  if (error) throw error;
  invalidatePublicPosts();
  invalidateUserSearch();
  return data;
}
