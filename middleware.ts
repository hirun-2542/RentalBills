import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const dashboardPaths = ["/", "/rooms", "/bills", "/history", "/settings"];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth);
  const isDashboardPath = dashboardPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!isAuthenticated && isDashboardPath) {
    const loginUrl = new URL("/login", request.nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === "/login") {
    const dashboardUrl = new URL("/", request.nextUrl);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/rooms/:path*",
    "/bills/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/login",
  ],
};
