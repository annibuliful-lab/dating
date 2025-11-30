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
    const body = await req.json();
    const { verificationType } = body;

    if (!verificationType || (verificationType !== "ADMIN" && verificationType !== "USER")) {
      return NextResponse.json(
        { error: "Invalid verification type. Must be 'ADMIN' or 'USER'" },
        { status: 400 }
      );
    }

    // Get current user to check if they are admin
    const { data: currentUser, error: currentUserError } = await supabase
      .from("User")
      .select("role, isAdmin")
      .eq("id", session.user.id)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { error: "Failed to fetch current user" },
        { status: 500 }
      );
    }

    // Only admins can verify with ADMIN type
    // Users can verify themselves with USER type
    const isSelfVerification = userId === session.user.id;
    const isAdminVerification = verificationType === "ADMIN";
    const isUserAdmin = currentUser.role === "ADMIN" || currentUser.isAdmin === true;

    if (isAdminVerification && !isUserAdmin) {
      return NextResponse.json(
        { error: "Only admins can verify users with ADMIN type" },
        { status: 403 }
      );
    }

    if (!isSelfVerification && verificationType === "USER") {
      return NextResponse.json(
        { error: "Users can only verify themselves with USER type" },
        { status: 403 }
      );
    }

    // Update user verification
    const { data: updatedUser, error: updateError } = await supabase
      .from("User")
      .update({
        isVerified: true,
        verificationType: verificationType,
        verifiedAt: new Date().toISOString(),
        verifiedBy: isAdminVerification ? session.user.id : userId,
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error verifying user:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to verify user",
      },
      { status: 500 }
    );
  }
}

