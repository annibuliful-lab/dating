import { getUserStatus } from "@/lib/admin";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/user/status-check
 * Check current user's status
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ status: null, isSuspended: false }, { status: 200 });
    }

    const status = await getUserStatus(session.user.id);
    const isSuspended = status === "SUSPENDED";

    return NextResponse.json({ 
      status, 
      isSuspended,
      message: isSuspended ? "บัญชีของคุณถูกพักการใช้งานชั่วคราว" : null
    });
  } catch (error) {
    console.error("Error checking user status:", error);
    return NextResponse.json({ status: null, isSuspended: false }, { status: 200 });
  }
}

