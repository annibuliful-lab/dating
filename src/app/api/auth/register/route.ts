import { supabase } from '@/client/supabase';
import { NextResponse } from 'next/server';
import { v7 } from 'uuid';

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const userId = v7();
  const { data: user, error } = await supabase
    .from('User')
    .insert({
      id: userId,
      email: username,
      username,
      passwordHash: password,
      fullName: v7(),
      updatedAt: new Date().toUTCString(),
    })
    .select('*');

  if (error) {
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
