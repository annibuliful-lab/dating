import { auth } from '@/auth';
import { supabase } from '@/client/supabase';
import { isAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

const MAX_POST_IMAGES = 5;

function asImageUrlList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    try {
      return asImageUrlList(JSON.parse(value));
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * PATCH /api/posts/[postId]/images
 * Reorder the existing images on a post without allowing new URLs to be added.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await params;
    const body = (await request.json()) as { imageUrls?: unknown };
    const requestedImageUrls = asImageUrlList(body.imageUrls);

    if (requestedImageUrls.length > MAX_POST_IMAGES) {
      return NextResponse.json(
        { error: `A post can contain at most ${MAX_POST_IMAGES} images` },
        { status: 400 },
      );
    }

    const { data: post, error: postError } = await supabase
      .from('Post')
      .select('authorId, imageUrl')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const userIsAdmin = await isAdmin(userId);
    if (post.authorId !== userId && !userIsAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existingImageUrls = asImageUrlList(post.imageUrl);
    const existingSet = [...existingImageUrls].sort();
    const requestedSet = [...requestedImageUrls].sort();
    const sameImages =
      existingSet.length === requestedSet.length &&
      existingSet.every((url, index) => url === requestedSet[index]);

    if (!sameImages) {
      return NextResponse.json(
        { error: 'Image order updates cannot add or remove images' },
        { status: 400 },
      );
    }

    const { data: updatedPost, error: updateError } = await supabase
      .from('Post')
      .update({
        imageUrl: requestedImageUrls,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', postId)
      .select('id, imageUrl, updatedAt')
      .single();

    if (updateError) {
      console.error('Error reordering post images:', updateError);
      return NextResponse.json(
        { error: 'Failed to reorder post images' },
        { status: 500 },
      );
    }

    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error in PATCH /api/posts/[postId]/images:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
