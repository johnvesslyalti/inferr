import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('google_id_token')?.value;
  const pathname = request.nextUrl.pathname;

  if (pathname === '/dashboard' && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname === '/auth/callback' && !token) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/auth/callback'],
};
