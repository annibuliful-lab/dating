import { isAdmin } from "@/lib/admin";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/check
 * Check if current user is admin
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    const adminStatus = await isAdmin(session.user.id);
    return NextResponse.json({ isAdmin: adminStatus });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}

