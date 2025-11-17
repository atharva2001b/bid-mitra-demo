import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isPublicPath = path === "/" || path.startsWith("/_next") || path.startsWith("/api") || path.startsWith("/_next/")
  
  // Allow all paths - no redirects, dashboard shows on refresh
  // Login page kept in code but not forced
  if (isPublicPath) {
    return NextResponse.next()
  }

  // Allow all other paths (including dashboard) without redirect
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

