import { supabase } from '@/client/supabase';
import { NextResponse } from 'next/server';
import type { UsernameCheckRequest, UsernameCheckResponse } from '@/@types/api';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<UsernameCheckRequest>;
    const { username, excludeUserId } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { available: false, message: 'Username is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('User')
      .select('id, username')
      .eq('username', username);

    // Exclude current user if provided
    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { available: false, message: 'Error checking username' },
        { status: 500 }
      );
    }

    const isAvailable = !data || data.length === 0;

    const response: UsernameCheckResponse = {
      available: isAvailable,
      message: isAvailable
        ? 'Username is available'
        : 'Username is already taken',
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: UsernameCheckResponse = {
      available: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

