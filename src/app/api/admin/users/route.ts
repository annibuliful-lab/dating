import { requireAdmin } from "@/lib/admin";
import { supabase } from "@/client/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/users
 * Get all users with search and filter capabilities
 * Query params: search, status, isVerified
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const isVerified = searchParams.get("isVerified");

    let query = supabase
      .from("User")
      .select(
        `
        id,
        username,
        name,
        lastname,
        fullName,
        phone,
        email,
        status,
        role,
        isVerified,
        verifiedAt,
        verifiedBy,
        createdAt,
        updatedAt
      `
      )
      .order("createdAt", { ascending: false });

    // Apply search filter
    if (search) {
      query = query.or(
        `username.ilike.%${search}%,name.ilike.%${search}%,lastname.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    // Apply status filter
    if (status && (status === "ACTIVE" || status === "INACTIVE" || status === "SUSPENDED")) {
      query = query.eq("status", status);
    }

    // Apply verification filter
    if (isVerified !== null && isVerified !== undefined) {
      query = query.eq("isVerified", isVerified === "true");
    }

    const { data: users, error } = await query;

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    return NextResponse.json(users || []);
  } catch (error) {
    console.error("Error in GET /api/admin/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

