import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "./client/supabase";

// Define route types
const PUBLIC_ROUTES = ["/", "/auth/error"];
const AUTH_ROUTES = ["/signin", "/signup"];
const PROTECTED_ROUTES = ["/feed", "/profile", "/inbox", "/create"];
const ADMIN_ROUTES = ["/admin"];

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;

  console.log("[middleware]", {
    pathname,
    isLoggedIn,
    userId: req.auth?.user?.id,
  });

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route);

  // Check if route is an auth route (signin/signup)
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Check if route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Check if route is admin route
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Allow API routes and static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Redirect authenticated users away from auth routes
  if (isAuthRoute && isLoggedIn) {
    console.log(
      "[middleware] Authenticated user accessing auth route, redirecting to /feed"
    );
    return NextResponse.redirect(new URL("/feed", nextUrl));
  }

  // Redirect unauthenticated users to signin
  if (!isLoggedIn && (isProtectedRoute || isAdminRoute)) {
    console.log(
      "[middleware] Unauthenticated user accessing protected route, redirecting to /signin"
    );
    const signInUrl = new URL("/signin", nextUrl);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // For logged in users, check their status and role
  if (isLoggedIn && req.auth?.user?.id) {
    const userId = req.auth.user.id;

    // Fetch user details from database
    const { data: user, error } = await supabase
      .from("User")
      .select("status, role, fullName, username")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[middleware] Error fetching user:", error);
      return NextResponse.redirect(
        new URL("/auth/error?error=DatabaseError", nextUrl)
      );
    }

    // Check if user is suspended
    if (user.status === "SUSPENDED") {
      console.log(
        "[middleware] Suspended user detected, redirecting to error page"
      );

      // Allow access to auth error page
      if (pathname === "/auth/error") {
        return NextResponse.next();
      }

      return NextResponse.redirect(
        new URL("/auth/error?error=Suspended", nextUrl)
      );
    }

    // Check admin routes - require ADMIN role
    if (isAdminRoute) {
      if (user.role !== "ADMIN") {
        console.log(
          "[middleware] Non-admin user accessing admin route, redirecting to /feed"
        );
        return NextResponse.redirect(
          new URL("/auth/error?error=AccessDenied", nextUrl)
        );
      }
    }

    // Check if user has completed their profile (new users)
    // New users have empty fullName or generated username (uuid format)
    const isNewUser =
      !user.fullName || user.fullName === "" || user.username.length > 30; // UUID v7 is longer than typical usernames

    // Redirect new users to profile edit page (except if they're already there)
    if (
      isNewUser &&
      !pathname.startsWith("/profile/edit") &&
      !pathname.startsWith("/auth/error")
    ) {
      console.log(
        "[middleware] New user detected, redirecting to profile edit"
      );
      return NextResponse.redirect(new URL("/profile/edit", nextUrl));
    }

    // Prevent completed users from accessing profile edit incorrectly
    // (They can still access it directly, just not forced to)
  }

  return NextResponse.next();
});

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
};
