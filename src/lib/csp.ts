/**
 * Content-Security-Policy for every response. Scripts are limited to this origin, Razorpay Checkout, and
 * scripts carrying the per-request nonce. Inline scripts without the nonce are blocked.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://checkout.razorpay.com`,
    // Inline style attributes are used by the UI; styles cannot run script.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
    'frame-src https://api.razorpay.com https://checkout.razorpay.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function newNonce(): string {
  // Web Crypto works in the edge runtime used by middleware.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
