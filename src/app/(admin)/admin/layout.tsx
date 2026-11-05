/**
 * Admin area layout. Pages enforce their own permission via requireStaffPage, so access never depends
 * on navigation being hidden.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ink-950 text-ui-text">{children}</div>;
}
