import { supabase } from '@/client/supabase';
import { normalizeEmail, normalizeUsername } from '@/lib/normalize-user-fields';
import { isValidEmail } from '@/shared/validation';
import { NextResponse } from 'next/server';
import { v7 } from 'uuid';

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { message: 'Username and password are required' },
      { status: 400 },
    );
  }

  if (!isValidEmail(username)) {
    return NextResponse.json(
      { message: 'INVALID_EMAIL_OR_USERNAME' },
      { status: 400 },
    );
  }

  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(normalizedUsername);

  if (!normalizedEmail) {
    return NextResponse.json(
      { message: 'INVALID_EMAIL_OR_USERNAME' },
      { status: 400 },
    );
  }

  const emailPattern = escapeLikePattern(normalizedEmail);
  const usernamePattern = escapeLikePattern(normalizedUsername);
  const { data: existingUsers, error: duplicateCheckError } = await supabase
    .from('User')
    .select('id')
    .or(
      `email.ilike.${emailPattern},username.ilike.${usernamePattern}`,
    )
    .limit(1);

  if (duplicateCheckError) {
    return NextResponse.json(
      { message: 'Unable to check email or username' },
      { status: 500 },
    );
  }

  if (existingUsers && existingUsers.length > 0) {
    return NextResponse.json(
      { message: 'EMAIL_OR_USERNAME_EXISTS' },
      { status: 409 },
    );
  }

  const userId = v7();
  const { data: user, error } = await supabase
    .from('User')
    .insert({
      id: userId,
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash: password,
      fullName: '',
      status: 'ACTIVE', // User status: Active (ปกติใช้งาน)
      isVerified: false, // Verify status: Under review (รอยืนยันตัวตน)
      updatedAt: new Date().toUTCString(),
    })
    .select('*');

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { message: 'EMAIL_OR_USERNAME_EXISTS' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        message: 'error',
        error: [error],
      },
      {
        status: 500,
      }
    );
  }

  const {
    data: insertedOAuthAccount,
    error: insertedOAuthAccountError,
  } = await supabase
    .from('OAuthAccount')
    .insert({
      id: v7() as string,
      type: 'oauth',
      provider: 'credentials',
      providerAccountId: userId,
      userId: userId,
    })
    .select('*');

  if (insertedOAuthAccountError) {
    return NextResponse.json(
      {
        message: 'error',
        error: [error, insertedOAuthAccountError],
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    message: 'success',
    data: { user, insertedOAuthAccount },
  });
}
