import { UsersScreen, type UsersSearchParams } from '@/components/admin/users-screen';

export const metadata = { title: 'Users' };

export default async function UsersPage({ searchParams }: { searchParams: UsersSearchParams }) {
  return UsersScreen({ title: 'Users', active: '/admin/users', searchParams, basePath: '/admin/users' });
}
