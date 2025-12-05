import { auth } from "@/auth";
import { supabase } from "@/client/supabase";
import { requireAdmin } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/admin/users/[userId]/status
 * Update user status (ACTIVE, INACTIVE, SUSPENDED) or verification status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const session = await auth();
    const { userId } = await params;
    const body = await req.json();
    const { status, isVerified } = body;

    // Validate status if provided
    if (status && !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: {
      status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
      isVerified?: boolean;
      verifiedAt?: string | null;
      verifiedBy?: string | null;
    } = {};

    if (
      status &&
      (status === "ACTIVE" || status === "INACTIVE" || status === "SUSPENDED")
    ) {
      updateData.status = status;
    }

    if (isVerified !== undefined) {
      updateData.isVerified = isVerified;
      if (isVerified) {
        updateData.verifiedAt = new Date().toISOString();
        updateData.verifiedBy = session?.user?.id || null;
      } else {
        updateData.verifiedAt = null;
        updateData.verifiedBy = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("User")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user status:", updateError);
      return NextResponse.json(
        { error: "Failed to update user status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error in PATCH /api/admin/users/[userId]/status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
