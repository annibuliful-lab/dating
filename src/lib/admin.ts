import { auth } from "@/auth";
import { supabase } from "@/client/supabase";
import { NextResponse } from "next/server";

/**
 * Check if the current user is an admin
 */
export async function isAdmin(userId?: string): Promise<boolean> {
  try {
    const session = userId ? null : await auth();
    const id = userId || session?.user?.id;

    if (!id) {
      return false;
    }

    const { data, error } = await supabase
      .from("User")
      .select("role, isAdmin")
      .eq("id", id)
      .single();

    if (error || !data) {
      return false;
    }

    // Check role first (new way), fallback to isAdmin (backward compatibility)
    const userData = data as { role?: string; isAdmin?: boolean };
    return userData.role === "ADMIN" || userData.isAdmin === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Middleware to check if user is admin, returns 403 if not
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminStatus = await isAdmin(session.user.id);
  if (!adminStatus) {
    return NextResponse.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Get admin user ID (first admin user found)
 */
export async function getAdminUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("User")
      .select("id")
      .or("role.eq.ADMIN,isAdmin.eq.true")
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  } catch (error) {
    console.error("Error getting admin user ID:", error);
    return null;
  }
}
