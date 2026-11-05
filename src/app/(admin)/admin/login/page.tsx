import { AdminLoginForm } from '@/components/admin/login-form';

export const metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

export default function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return <AdminLoginForm forbidden={searchParams.error === 'forbidden'} />;
}
