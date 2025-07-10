import { supabase } from '@/client/supabase';
import { NextResponse } from 'next/server';
import { v7 } from 'uuid';

export async function POST(request: Request) {
  const { username, password } = await request.json();
  console.log({ username, password });

  const { data, error } = await supabase.from('User').insert({
    id: v7(),
    email: username,
    username,
    passwordHash: password,
    fullName: v7(),
    updatedAt: new Date().toUTCString(),
  });

  if (error) {
    return NextResponse.json(
      {
        message: 'error',
        error,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({ message: 'success', data });
}
