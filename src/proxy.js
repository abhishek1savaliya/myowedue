import { NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/people", "/transactions", "/bin", "/reports", "/settings"];
const authRoutes = ["/login", "/signup"];
const adminProtectedRoutes = ["/admin/dashboard", "/admin/team", "/admin/tickets"];

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("session_token")?.value;
  const adminToken = request.cookies.get("admin_session_token")?.value;

  const isAdminProtected = adminProtectedRoutes.some((route) => pathname.startsWith(route));
  if (isAdminProtected && !adminToken) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (pathname === "/admin/login" && adminToken) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuth = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuth && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/people/:path*",
    "/transactions/:path*",
    "/bin/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
    "/admin/dashboard/:path*",
    "/admin/team/:path*",
    "/admin/tickets/:path*",
    "/admin/login",
  ],
};