import { auth } from "@/auth";
import { supabase } from "@/client/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    // Get current user to check if they are admin
    const { data: currentUser, error: currentUserError } = await supabase
      .from("User")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { error: "Failed to fetch current user" },
        { status: 500 }
      );
    }

    // Only admins can verify other users
    // Users can verify themselves
    const isSelfVerification = userId === session.user.id;
    const isUserAdmin = currentUser.role === "ADMIN";

    if (!isSelfVerification && !isUserAdmin) {
      return NextResponse.json(
        { error: "Only admins can verify other users" },
        { status: 403 }
      );
    }

    // Update user verification
    // For self-verification: verifiedBy is null (user verified themselves)
    // For admin verification: verifiedBy is the admin's userId
    const { data: updatedUser, error: updateError } = await supabase
      .from("User")
      .update({
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: isSelfVerification ? null : session.user.id,
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error verifying user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to verify user",
      },
      { status: 500 }
    );
  }
}
