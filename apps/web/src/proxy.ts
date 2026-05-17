import { NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/feed', '/onboarding', '/dashboard', '/chat'];

export function proxy(request: NextRequest) {
  const token = request.cookies.get('google_id_token')?.value;
  const { pathname } = request.nextUrl;

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/feed/:path*', '/onboarding/:path*', '/dashboard/:path*', '/chat/:path*'],
};
