import { supabase } from '@/client/supabase';
import { formatISO } from 'date-fns';

type ProfileInput = {
  username?: string;
  name?: string;
  lastname?: string;
  gender?: string;
  birthday?: Date | null;
  bio?: string | null;
  phone?: string | null;
  lineId?: string | null;
  height?: number | string | null;
  weight?: number | string | null;
  profileImageKey?: string;
  relationShipStatus?: string;
};

function toNullableNumber(v: number | string | null | undefined) {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : null;
}

function toDateString(d?: Date | null) {
  return d ? formatISO(d, { representation: 'date' }) : null; // 'YYYY-MM-DD'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clean<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k in obj) {
    const v = obj[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function updateUserProfile(
  userId: string,
  input: ProfileInput
) {
  if (!userId) throw new Error('Missing userId');

  const payload = clean({
    username: input.username,
    fullName: input.name,
    lastname: input.lastname,
    gender: input.gender,
    birthday: toDateString(input.birthday),
    bio: input.bio ?? null,
    phone: input.phone ?? null,
    lineId: input.lineId ?? null,
    height: toNullableNumber(input.height),
    weight: toNullableNumber(input.weight),
    relationShipStatus: input.relationShipStatus,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  if (input.profileImageKey) {
    payload['profileImageKey'] = input.profileImageKey;
  }

  const { data, error } = await supabase
    .from('User')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
