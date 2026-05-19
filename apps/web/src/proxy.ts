import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED = ['/feed', '/onboarding', '/dashboard', '/chat'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session')?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(session, secret);
    return NextResponse.next();
  } catch {
    // Token missing, expired, or signature invalid
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('session');
    return response;
  }
}

export const config = {
  matcher: ['/feed/:path*', '/onboarding/:path*', '/dashboard/:path*', '/chat/:path*'],
};
