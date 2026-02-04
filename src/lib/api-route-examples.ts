/**
 * EXAMPLE: API Route with RLS
 *
 * This shows how to refactor API routes to use RLS.
 * Before: Using Prisma directly (no RLS enforcement)
 * After: Using Supabase with RLS
 */

import { auth } from '@/auth';
import { generateShortLivedToken } from '@/lib/rls-jwt';
import { getSupabaseClientWithToken } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

// ============================================================================
// GET /api/posts - Get all posts (with RLS)
// ============================================================================

/**
 * OLD WAY (Prisma - no RLS):
 *
 * export async function GET() {
 *   const posts = await prisma.post.findMany();
 *   return NextResponse.json(posts);
 * }
 *
 * Problems:
 * - No authorization check - returns all posts regardless of user
 * - Vulnerable to data leakage
 * - Need to add manual authorization checks in every route
 */

/**
 * NEW WAY (Supabase with RLS):
 *
 * RLS automatically enforces:
 * - Public posts are visible to everyone
 * - Members-only posts visible to logged-in users only
 * - Private posts visible to author only
 */
export async function GET() {
  try {
    const session = await auth();

    // Not logged in? Still works - RLS will show only public posts
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Create authenticated Supabase client with JWT
    const token = generateShortLivedToken(
      session.user.id,
      session.user.email || undefined,
    );
    const supabase = getSupabaseClientWithToken(token);

    // This query respects RLS policies automatically
    const { data: posts, error } = await supabase
      .from('Post')
      .select(
        `
        id,
        content,
        imageUrl,
        visibility,
        createdAt,
        author:User!authorId(id, fullName, profileImageKey),
        likes:PostLike(count),
        _count:PostLike(count)
      `,
      )
      .order('createdAt', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(posts);
  } catch (error) {
    console.error('GET /api/posts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST /api/posts - Create a post
// ============================================================================

/**
 * OLD WAY (Prisma):
 *
 * export async function POST(req: Request) {
 *   const session = await auth();
 *   if (!session?.user?.id) return Response.json({ error: "Unauthorized" });
 *
 *   const body = await req.json();
 *   const post = await prisma.post.create({
 *     data: {
 *       ...body,
 *       authorId: session.user.id
 *     }
 *   });
 *
 *   return Response.json(post);
 * }
 *
 * Problems:
 * - Creates post but doesn't prevent tampering
 * - Relies on client to not send authorId
 */

/**
 * NEW WAY (Supabase with RLS):
 *
 * RLS ensures:
 * - Only authenticated users can create posts
 * - authorId is always set to the current user
 * - Users cannot create posts as someone else
 */
export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await req.json();

    // Create authenticated client
    const token = generateShortLivedToken(session.user.id);
    const supabase = getSupabaseClientWithToken(token);

    // RLS policy "Users can create posts" will enforce:
    // - auth.uid() must equal authorId
    const { data: post, error } = await supabase
      .from('Post')
      .insert({
        content: body.content,
        imageUrl: body.imageUrl,
        visibility: body.visibility || 'PUBLIC',
        authorId: session.user.id, // Always set by server
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('POST /api/posts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ============================================================================
// PUT /api/posts/[id] - Update a post
// ============================================================================

/**
 * OLD WAY (Prisma):
 *
 * export async function PUT(req: Request, { params }) {
 *   const session = await auth();
 *   if (!session?.user?.id) return Response.json({ error: "Unauthorized" });
 *
 *   const post = await prisma.post.findUnique({ where: { id: params.id } });
 *   if (post.authorId !== session.user.id) {
 *     return Response.json({ error: "Forbidden" }, { status: 403 });
 *   }
 *
 *   const updated = await prisma.post.update({
 *     where: { id: params.id },
 *     data: body
 *   });
 *
 *   return Response.json(updated);
 * }
 *
 * Problems:
 * - Authorization check happens in code (easy to miss)
 * - Two queries needed (fetch then update)
 * - Vulnerable if logic is copied elsewhere
 */

/**
 * NEW WAY (Supabase with RLS):
 *
 * RLS ensures:
 * - Only post author can update their post
 * - Admin can update any post
 * - Unauthorized attempts fail at database level
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await req.json();

    // Create authenticated client
    const token = generateShortLivedToken(session.user.id);
    const supabase = getSupabaseClientWithToken(token);

    // RLS policy "Users can update own posts" ensures:
    // - Only works if auth.uid() == post.authorId
    // - Returns 0 rows if user doesn't own the post
    const { data: post, error } = await supabase
      .from('Post')
      .update({
        content: body.content,
        imageUrl: body.imageUrl,
        visibility: body.visibility,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found or not authorized' },
        { status: 403 },
      );
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('PUT /api/posts/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE /api/posts/[id] - Delete a post
// ============================================================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { id } = await params;

    // Create authenticated client
    const token = generateShortLivedToken(session.user.id);
    const supabase = getSupabaseClientWithToken(token);

    // RLS prevents deletion if user is not the author
    const { error } = await supabase
      .from('Post')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/posts/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
