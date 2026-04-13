import { NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/people", "/transactions", "/bin", "/reports", "/settings"];
const authRoutes = ["/login", "/signup"];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("session_token")?.value;

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
  matcher: ["/dashboard/:path*", "/people/:path*", "/transactions/:path*", "/bin/:path*", "/reports/:path*", "/settings/:path*", "/login", "/signup"],
};
