import { supabase } from '@/server/supabase';
import { apiError, AccessError, requireSameOrigin } from '@/server/access';
import { object, text } from '@/server/validation';
import { normalizeEmail, normalizeUsername } from '@/lib/normalize-user-fields';
import { isValidEmail } from '@/shared/validation';
import { NextResponse } from 'next/server';
import { v7 } from 'uuid';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = object(await request.json());
    const username = normalizeUsername(text(input.username, 254));
    const email = normalizeEmail(username);
    const password = text(input.password, 1024);
    if (!email || !isValidEmail(email)) throw new AccessError(400, 'INVALID_EMAIL_OR_USERNAME');
    if (password.length < 8) throw new AccessError(400, 'Invalid password');
    const userId = v7();
    const { error } = await supabase.rpc('register_community_user', {
      app_user_id: userId, app_email: email, app_username: username, app_password: password,
    });
    if (error?.code === '23505') return NextResponse.json({ message: 'EMAIL_OR_USERNAME_EXISTS' }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ message: 'success', data: { user: [{ id: userId }] } });
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ message: error.message }, { status: error.status });
    return apiError(error);
  }
}
