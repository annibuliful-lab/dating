import { requireAdmin } from "@/lib/admin";
import { supabase } from "@/client/supabase";
import { NextResponse } from "next/server";
import type { PostWithUser } from "@/@types/database";
import type { ApiErrorResponse } from "@/@types/api";

/**
 * GET /api/admin/posts
 * Get all posts for admin management
 */
export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const { data: posts, error } = await supabase
      .from("Post")
      .select(
        `
        *,
        User!Post_authorId_fkey (
          id,
          fullName,
          username,
          profileImageKey,
          isVerified,
          status,
          role
        ),
        PostLike!PostLike_postId_fkey (count),
        PostSave!PostSave_postId_fkey (count)
      `
      )
      .order("createdAt", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching posts:", error);
      const errorResponse: ApiErrorResponse = {
        error: "Failed to fetch posts",
        message: error.message,
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const typedPosts = (posts || []) as unknown as PostWithUser[];
    return NextResponse.json(typedPosts);
  } catch (error) {
    console.error("Error in GET /api/admin/posts:", error);
    const errorResponse: ApiErrorResponse = {
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

