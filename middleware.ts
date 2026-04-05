import { NextResponse, type NextRequest } from "next/server";

const APP_PREFIX = "/app";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    request.cookies.has("censussync_session") ||
    request.cookies.has("censussync_demo_session");

  if (pathname.startsWith(APP_PREFIX) && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login"]
};
