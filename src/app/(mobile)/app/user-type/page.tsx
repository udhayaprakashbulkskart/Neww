import { requirePageUser } from '@/lib/auth/session';
import { TopBar } from '@/components/mobile/shell';
import { UserTypePicker } from '@/components/mobile/forms/user-type-picker';

export const metadata = { title: 'How will you use HelpTrust?' };

export default async function UserTypePage() {
  const user = await requirePageUser('/app/user-type');
  return (
    <main className="min-h-dvh pb-10">
      <TopBar title="Get set up" />
      <div className="px-6">
        <p className="eyebrow">Step 2 of 2</p>
        <h1 className="mt-3 text-[30px] font-extrabold leading-tight tracking-tight">
          Hi {user.fullName.split(' ')[0]}, how do you want to use <span className="text-mint">HelpTrust</span>?
        </h1>
        <UserTypePicker />
      </div>
    </main>
  );
}
