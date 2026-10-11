import { apiError, requireSameOrigin, requireUser, requireWritable } from '@/server/access';
import { supabase } from '@/server/supabase';
import { normalizeUsername } from '@/lib/normalize-user-fields';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser(); requireWritable(actor);
    const { username } = await request.json();
    const excludeUserId = actor.id;

    if (!username || typeof username !== 'string' || username.length > 100) {
      return NextResponse.json(
        { available: false, message: 'Username is required' },
        { status: 400 }
      );
    }

    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername) {
      return NextResponse.json(
        { available: false, message: 'Username is required' },
        { status: 400 },
      );
    }

    let query = supabase
      .from('User')
      .select('id, username')
      .eq('username', normalizedUsername);

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
  } catch (error) { return apiError(error); }
}
