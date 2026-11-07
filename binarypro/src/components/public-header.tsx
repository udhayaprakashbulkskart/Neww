import Link from 'next/link';
import { Logo } from './ui';

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" aria-label="CrownTree home"><Logo /></Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/install" className="hidden rounded-lg px-3 py-2 text-[#b9b09a] hover:text-white sm:inline">Download app</Link>
          <Link href="/compliance" className="hidden rounded-lg px-3 py-2 text-[#b9b09a] hover:text-white sm:inline">Compliance</Link>
          <Link href="/login" className="btn btn-brand whitespace-nowrap px-5 py-2.5 text-sm">Sign in</Link>
        </nav>
      </div>
    </header>
  );
}
