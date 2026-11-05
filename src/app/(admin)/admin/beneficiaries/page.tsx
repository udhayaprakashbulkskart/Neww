import { UsersScreen, type UsersSearchParams } from '@/components/admin/users-screen';

export const metadata = { title: 'Beneficiaries' };

export default async function BeneficiariesPage({ searchParams }: { searchParams: UsersSearchParams }) {
  return UsersScreen({ title: 'Beneficiaries', active: '/admin/beneficiaries', types: ['BENEFICIARY', 'BOTH'], searchParams, basePath: '/admin/beneficiaries' });
}
