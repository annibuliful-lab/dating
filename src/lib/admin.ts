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
      .select("role")
      .eq("id", id)
      .single();

    if (error || !data) {
      return false;
    }

    const userData = data as { role?: string };
    return userData.role === "ADMIN";
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
      .eq("role", "ADMIN")
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

/**
 * Check if user is suspended or inactive
 * Returns true if user should be blocked (SUSPENDED)
 */
export async function isUserSuspended(userId?: string): Promise<boolean> {
  try {
    const session = userId ? null : await auth();
    const id = userId || session?.user?.id;

    if (!id) {
      return false;
    }

    const { data, error } = await supabase
      .from("User")
      .select("status")
      .eq("id", id)
      .single();

    if (error || !data) {
      return false;
    }

    const userData = data as { status?: string };
    return userData.status === "SUSPENDED";
  } catch (error) {
    console.error("Error checking user status:", error);
    return false;
  }
}

/**
 * Get user status
 * Returns the user's status (ACTIVE, INACTIVE, SUSPENDED) or null
 */
export async function getUserStatus(
  userId?: string
): Promise<"ACTIVE" | "INACTIVE" | "SUSPENDED" | null> {
  try {
    const session = userId ? null : await auth();
    const id = userId || session?.user?.id;

    if (!id) {
      return null;
    }

    const { data, error } = await supabase
      .from("User")
      .select("status")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    const userData = data as { status?: string };
    const status = userData.status as
      | "ACTIVE"
      | "INACTIVE"
      | "SUSPENDED"
      | undefined;

    if (status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      return status;
    }

    return null;
  } catch (error) {
    console.error("Error getting user status:", error);
    return null;
  }
}
