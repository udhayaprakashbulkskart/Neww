import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'ht_session';

/** Mobile screens anyone can open. Everything else under /app needs a session cookie. */
const PUBLIC_APP_EXACT = ['/app', '/app/onboarding', '/app/login', '/app/register', '/app/otp', '/app/explore'];
const PUBLIC_APP_PREFIXES = ['/app/category/', '/app/campaign/'];

function isPublicApp(pathname: string) {
  return PUBLIC_APP_EXACT.includes(pathname) || PUBLIC_APP_PREFIXES.some((p) => pathname.startsWith(p));
}

function allowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients; the session cookie is still required
  const host = req.headers.get('host');
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app) {
    try {
      return new URL(origin).origin === new URL(app).origin;
    } catch {
      return false;
    }
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF: browsers must send a matching Origin for state-changing API calls.
  // Provider webhooks are authenticated by signature instead.
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !pathname.startsWith('/api/webhooks/')) {
    if (!allowedOrigin(req)) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Cross-site request blocked.' } }, { status: 403 });
    }
  }

  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith('/app') && !isPublicApp(pathname) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/app/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/app/:path*', '/admin/:path*'],
};
