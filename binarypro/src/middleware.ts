// Records the visitor's country from the platform's IP geolocation header, so prices can show the
// local currency. Display only: nothing here changes payments or the ledger.
import { NextResponse, type NextRequest } from 'next/server';

const GEO_COOKIE = 'bp_geo';
const COUNTRY_HEADER = 'x-vercel-ip-country';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const country = req.headers.get(COUNTRY_HEADER);
  if (country && /^[A-Z]{2}$/.test(country) && req.cookies.get(GEO_COOKIE)?.value !== country) {
    res.cookies.set(GEO_COOKIE, country, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    });
  }
  return res;
}

export const config = {
  // Skip Next.js build assets; everything else gets the region cookie.
  matcher: ['/((?!_next/).*)'],
};
