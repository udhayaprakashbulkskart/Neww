import { LegalPage, LegalSection } from '@/components/site/legal';

export const metadata = { title: 'Refund Policy' };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy" updated="5 November 2026">
      <LegalSection title="Refund window">
        <p>You can request a full refund of a successful donation within 7 days of the payment date, once per donation. Request it from the donation details screen in the app.</p>
      </LegalSection>
      <LegalSection title="How requests are decided">
        <p>Our finance team reviews each request and tells you the decision in the app and by notification. Approved refunds are sent back to the original payment method through the payment provider. Timing depends on your bank.</p>
      </LegalSection>
      <LegalSection title="When we may refuse">
        <p>Requests may be refused where funds have already been paid out to the beneficiary, where the request is outside the window, or where we have reason to believe the payment was not made in good faith. You will always be told why.</p>
      </LegalSection>
      <LegalSection title="Failed payments">
        <p>If money was debited but the donation did not complete, the payment provider reverses it according to its terms. Contact support with your payment reference if this happens.</p>
      </LegalSection>
    </LegalPage>
  );
}
