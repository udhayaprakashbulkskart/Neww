import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { LoginForm } from '@/components/client';
import { Logo } from '@/components/ui';
import { NetworkArt } from '@/components/brand-art';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { ref?: string; mode?: string } }) {
  if (await currentUser()) redirect('/dashboard');
  const ref = typeof searchParams.ref === 'string' && /^[a-z0-9]{10,64}$/i.test(searchParams.ref) ? searchParams.ref : undefined;
  const register = !!ref || searchParams.mode === 'register';
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative isolate hidden overflow-hidden border-r border-white/5 bg-[radial-gradient(circle_at_20%_10%,rgba(255,106,0,.28),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(212,175,55,.22),transparent_50%),#000] p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="relative z-10 mb-8 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">Global MLM commerce network</p>
          <h1 className="mt-4 text-5xl font-black leading-[1.05] tracking-tight">Build your <span className="gold-text">global team.</span></h1>
          <p className="mt-5 text-[#a39a86]">Binary income from verified sales, cashback from partner merchants and rewards from advertiser-funded videos, all in one wallet.</p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {[['Verified', 'retail only'], ['Funded', 'every reward'], ['Audited', 'double-entry ledger']].map(([a, b]) => (
              <div key={a} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="font-bold text-[#f7e09a]">{a}</div>
                <div className="text-xs text-[#8f8672]">{b}</div>
              </div>
            ))}
          </div>
        </div>
        <NetworkArt className="pointer-events-none absolute inset-x-0 bottom-0 z-0 w-full opacity-30" />
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01))] p-7 shadow-[0_30px_80px_rgba(0,0,0,.6)] backdrop-blur md:p-9">
            <h2 className="text-2xl font-extrabold tracking-tight">{register ? (ref ? 'Join your team' : 'Create your account') : 'Welcome back'}</h2>
            <p className="mt-1 text-sm text-[#8f8672]">{register ? 'Your inviter will see you in their team.' : 'Sign in with your email and password.'}</p>
            <div className="mt-7"><LoginForm ref={ref} initialMode={register ? 'register' : 'signin'} /></div>
          </div>
          <p className="mt-6 text-center text-xs text-[#6f6758]">By continuing you agree to the <a href="/compliance#terms">terms</a> and <a href="/compliance#privacy">privacy policy</a>.</p>
        </div>
      </main>
    </div>
  );
}
