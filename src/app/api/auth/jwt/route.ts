/**
 * API endpoint to get JWT token for client-side Supabase operations
 * Used by the useSupabaseClient hook
 */

import { auth } from "@/auth";
import { generateSupabaseJWT, generateShortLivedToken } from "@/lib/rls-jwt";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = generateShortLivedToken(
      session.user.id,
      session.user.email || undefined
    );

    return NextResponse.json({
      token,
      userId: session.user.id,
      email: session.user.email,
    });
  } catch (error) {
    console.error("JWT endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
