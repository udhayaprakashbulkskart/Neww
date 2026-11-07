import { PublicHeader } from '@/components/public-header';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { LoginForm } from '@/components/client';
import { Logo } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { ref?: string } }) {
  if (await currentUser()) redirect('/dashboard');
  const ref = typeof searchParams.ref === 'string' && /^[a-z0-9]{10,64}$/i.test(searchParams.ref) ? searchParams.ref : undefined;
  return (
    <>
    <PublicHeader />
    <div className="mx-auto max-w-md space-y-6 px-6 py-12">
      <div className="flex justify-center"><Logo /></div>
      <div className="panel p-6">
        <h1 className="text-xl font-extrabold">Sign in with your mobile number</h1>
        <p className="mt-1 text-sm text-[#a39a86]">We send a one-time code. Never share it with anyone.</p>
        <div className="mt-5"><LoginForm ref={ref} /></div>
        {ref && <p className="mt-4 text-xs text-[#a39a86]">You were invited by a BinaryPro member.</p>}
      </div>
    </div>
    </>
  );
}
