import { requireAdmin } from '@/lib/admin';
import { supabase } from '@/client/supabase';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/users/count
 * Returns total count of users matching optional filters and the total
 * number of accounts verified by an admin.
 * Query params: search, status, isVerified
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const isVerified = searchParams.get('isVerified');

    let query = supabase
      .from('User')
      .select('id', { count: 'exact', head: true });

    // Apply search filter
    if (search) {
      const searchPattern = `%${search}%`;
      const searchFields = [
        `username.ilike.${searchPattern}`,
        `name.ilike.${searchPattern}`,
        `lastname.ilike.${searchPattern}`,
        `phone.ilike.${searchPattern}`,
        `email.ilike.${searchPattern}`,
      ];
      query = query.or(searchFields.join(','));
    }

    // Apply status filter
    if (
      status &&
      (status === 'ACTIVE' ||
        status === 'INACTIVE' ||
        status === 'SUSPENDED')
    ) {
      query = query.eq('status', status);
    }

    // Apply verification filter
    if (isVerified !== null && isVerified !== undefined) {
      query = query.eq('isVerified', isVerified === 'true');
    }

    const [
      { count, error },
      { count: verifiedTotal, error: verifiedTotalError },
    ] = await Promise.all([
      query,
      supabase
        .from('User')
        .select('id', { count: 'exact', head: true })
        .not('verifiedAt', 'is', null)
        .not('verifiedBy', 'is', null),
    ]);

    if (error || verifiedTotalError) {
      console.error('Error counting users:', error);
      return NextResponse.json(
        { error: 'Failed to count users' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      total: count || 0,
      verifiedTotal: verifiedTotal || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users/count:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
