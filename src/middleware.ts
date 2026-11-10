import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, newNonce } from './lib/csp';

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
  // Every page and response carries a fresh CSP nonce. Next.js reads the nonce from the request's CSP header
  // and applies it to its own inline bootstrap scripts.
  const nonce = newNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV !== 'production');
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('content-security-policy', csp);
  const res = handle(req, requestHeaders);
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

function handle(req: NextRequest, requestHeaders: Headers): NextResponse {
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

  // Team portal: pages need the team session cookie. Pages and APIs still verify the session on the server.
  if (pathname.startsWith('/team') && !pathname.startsWith('/team/login') && !req.cookies.has('tp_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/team/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
