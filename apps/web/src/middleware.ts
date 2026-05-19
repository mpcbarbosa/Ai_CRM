import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and all /api/* routes (auth login, logout, and the
  // server-side proxy) to bypass session check. The proxy itself does its
  // own cookie verification before forwarding.
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // A3 (2026-05-19): cookie is now a JWT signed with SESSION_SECRET, carrying
  // the userName. Previously the cookie was the literal SESSION_SECRET string.
  // jwtVerify works in Edge runtime via the jose library.
  const session = request.cookies.get('crm_session');
  if (!session?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  const payload = await verifySession(session.value);
  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
