import { UsersScreen, type UsersSearchParams } from '@/components/admin/users-screen';

export const metadata = { title: 'Donors' };

export default async function DonorsPage({ searchParams }: { searchParams: UsersSearchParams }) {
  return UsersScreen({ title: 'Donors', active: '/admin/donors', types: ['DONOR', 'BOTH'], searchParams, basePath: '/admin/donors' });
}
