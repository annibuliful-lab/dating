import { supabase } from '@/client/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, excludeUserId } = await request.json();

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

    return NextResponse.json({
      available: isAvailable,
      message: isAvailable
        ? 'Username is available'
        : 'Username is already taken',
    });
  } catch {
    return NextResponse.json(
      { available: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

