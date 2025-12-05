import { supabase } from "@/client/supabase";
import { requireAdmin } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/admin/posts/[postId]
 * Admin can delete posts
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const { postId } = await params;

    // Delete the post (cascade will handle related records)
    const { error } = await supabase.from("Post").delete().eq("id", postId);

    if (error) {
      console.error("Error deleting post:", error);
      return NextResponse.json(
        { error: "Failed to delete post" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/admin/posts/[postId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
