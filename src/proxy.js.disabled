import { NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/posts",
  "/people",
  "/cards",
  "/files",
  "/transactions",
  "/bin",
  "/reports",
  "/settings",
  "/my-subscription",
  "/content-editor",
  "/support",
];
const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];
const adminProtectedRoutes = [
  "/admin/dashboard",
  "/admin/team",
  "/admin/tickets",
  "/admin/chat",
  "/admin/content",
  "/admin/vouchers",
  "/admin/password-resets",
];

export function proxy(request) {
  try {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("session_token")?.value;
    const adminToken = request.cookies.get("admin_session_token")?.value;

    const isAdminProtected = adminProtectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    if (isAdminProtected && !adminToken) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (pathname === "/admin/login" && adminToken) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    const isProtected = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    const isAuth = authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

    if (isProtected && !token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (isAuth && token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("[proxy] failed:", error?.message || error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/posts",
    "/posts/:path*",
    "/people",
    "/people/:path*",
    "/cards",
    "/cards/:path*",
    "/files",
    "/files/:path*",
    "/transactions",
    "/transactions/:path*",
    "/bin",
    "/bin/:path*",
    "/reports",
    "/reports/:path*",
    "/settings",
    "/settings/:path*",
    "/my-subscription",
    "/my-subscription/:path*",
    "/content-editor",
    "/content-editor/:path*",
    "/support",
    "/support/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password/:token",
    "/admin/dashboard",
    "/admin/dashboard/:path*",
    "/admin/team",
    "/admin/team/:path*",
    "/admin/tickets",
    "/admin/tickets/:path*",
    "/admin/chat",
    "/admin/chat/:path*",
    "/admin/vouchers",
    "/admin/vouchers/:path*",
    "/admin/password-resets",
    "/admin/password-resets/:path*",
    "/admin/login",
  ],
};
