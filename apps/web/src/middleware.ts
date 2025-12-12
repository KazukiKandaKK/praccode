import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simplified middleware that doesn't use Prisma (Edge Runtime compatible)
// Authentication checks are handled in each page component
export function middleware(request: NextRequest) {
  // Allow public assets and API routes
  if (
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // For now, allow all routes - authentication is handled in page components
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

