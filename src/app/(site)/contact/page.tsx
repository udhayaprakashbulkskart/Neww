import Link from 'next/link';
import { Icon } from '@/components/ui/icons';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 lg:px-8">
      <p className="eyebrow">Contact</p>
      <h1 className="mt-4 text-[40px] font-extrabold leading-tight tracking-tight">We are here to help</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-ui-muted">For account, campaign or payment questions, the fastest route is the Help section in the app, where your messages are tracked and answered.</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <a href="mailto:support@helptrust.in" className="surface flex items-start gap-4 p-6 transition hover:border-mint/25">
          <Icon name="mail" className="h-6 w-6 text-mint" />
          <span>
            <span className="block font-semibold">Email support</span>
            <span className="mt-1 block text-sm text-ui-muted">support@helptrust.in</span>
          </span>
        </a>
        <div className="surface flex items-start gap-4 p-6">
          <Icon name="clock" className="h-6 w-6 text-mint" />
          <span>
            <span className="block font-semibold">Hours</span>
            <span className="mt-1 block text-sm text-ui-muted">Monday to Saturday, 10:00 to 18:00 IST</span>
          </span>
        </div>
      </div>

      <div className="mt-10 surface-flat p-6 text-sm leading-relaxed text-ui-muted">
        <p className="font-semibold text-ui-text">Grievance officer</p>
        <p className="mt-2">
          Under the Information Technology Act and the Consumer Protection (E-Commerce) Rules, grievances about the platform are handled by our grievance officer. Details are published in the final Terms once legal review is complete.
        </p>
        <p className="mt-4">
          Do not share your OTP, password or bank details with anyone, including people who contact you claiming to be from HelpTrust. We will never ask for them.
        </p>
      </div>

      <div className="mt-10">
        <Link href="/app/help" className="btn-primary">
          Open help in the app
        </Link>
      </div>
    </main>
  );
}
