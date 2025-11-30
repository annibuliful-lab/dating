import { requireAdmin } from "@/lib/admin";
import { supabase } from "@/client/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/posts
 * Get all posts for admin management
 */
export async function GET(req: NextRequest) {
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
          status
        ),
        PostLike!PostLike_postId_fkey (count),
        PostSave!PostSave_postId_fkey (count)
      `
      )
      .order("createdAt", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching posts:", error);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    return NextResponse.json(posts || []);
  } catch (error) {
    console.error("Error in GET /api/admin/posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

