import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { walletBalances, walletSummary } from '@/lib/server/wallet';
import { getRequestRegion } from '@/lib/server/locale';
import { CURRENCIES, formatMoney, type Currency } from '@/lib/domain/money';
import { MIN_WITHDRAWAL } from '@/lib/domain/plans';
import { numberLocale } from '@/lib/i18n/locales';
import { ConvertForm, WithdrawForm } from '@/components/client';
import { Money, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Wallet() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const region = await getRequestRegion();
  const t = region.t;
  const locale = region.locale;
  const nameOf = new Intl.DisplayNames([locale === 'ar' ? 'ar' : locale], { type: 'currency' });
  const numLocale = (c: Currency) => numberLocale(locale, c);
  const [balances, summary, history, withdrawals] = await Promise.all([
    walletBalances(user.id),
    walletSummary(user.id),
    db.ledgerEntry.findMany({
      where: { account: { userId: user.id } },
      orderBy: { tx: { createdAt: 'desc' } },
      take: 40,
      include: { tx: { select: { type: true, description: true, createdAt: true } }, account: { select: { currency: true } } },
    }),
    db.withdrawal.findMany({ where: { userId: user.id }, orderBy: { requestedAt: 'desc' }, take: 20 }),
  ]);
  const balanceStrings = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, formatMoney(v, k as Currency, numLocale('INR'))]));
  const kycOk = user.kyc === 'VERIFIED';
  const total = balances.INR;
  const inr = (minor: bigint) => formatMoney(minor, 'INR', numLocale('INR'));

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-5">
        <div className="panel p-4"><div className="label">{t('wallet.available')}</div><div className="mt-2 text-lg font-bold">{inr(summary.available)}</div></div>
        <div className="panel p-4"><div className="label">{t('wallet.pending')}</div><div className="mt-2 text-lg font-bold">{inr(summary.pending)}</div><div className="text-xs text-[#8f8672]">{t('wallet.pendingHint')}</div></div>
        <div className="panel p-4"><div className="label">{t('wallet.withdrawable')}</div><div className="mt-2 text-lg font-bold">{inr(summary.withdrawable)}</div></div>
        <div className="panel p-4"><div className="label">{t('wallet.withdrawn')}</div><div className="mt-2 text-lg font-bold">{inr(summary.withdrawn)}</div></div>
        <div className="panel p-4"><div className="label">{t('wallet.reversed')}</div><div className="mt-2 text-lg font-bold">{inr(summary.reversed)}</div><div className="text-xs text-[#8f8672]">{t('wallet.reversedHint')}</div></div>
      </section>
      <header>
        <h1 className="text-3xl font-black tracking-tight">{t('wallet.title')}</h1>
        <p className="mt-1 text-sm text-[#8f8672]">{t('wallet.subtitle')}</p>
      </header>

      <section className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {CURRENCIES.map((c) => {
          const hasFunds = balances[c] > 0n;
          return (
            <div key={c} className={`min-w-[210px] snap-start rounded-3xl p-5 ${hasFunds ? 'bg-[linear-gradient(150deg,#ff6a00,#d4af37_70%,#4a3508)] text-black' : 'border border-white/5 bg-white/[0.03]'}`}>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest opacity-80">
                <span>{c}</span>
              </div>
              <div className="mt-8 whitespace-nowrap text-xl font-black sm:text-2xl"><Money minor={balances[c]} currency={c} /></div>
              <div className="mt-1 text-xs opacity-70">{nameOf.of(c) ?? c}</div>
            </div>
          );
        })}
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-3xl border border-white/5 bg-white/[0.03] p-6">
          <h2 className="mb-1 text-lg font-bold">{t('wallet.convertTitle')}</h2>
          <p className="mb-4 text-sm text-[#8f8672]">{t('wallet.convertNote')}</p>
          <ConvertForm currencies={[...CURRENCIES]} balances={balanceStrings} />
        </section>
        <section className="min-w-0 rounded-3xl border border-white/5 bg-white/[0.03] p-6">
          <h2 className="mb-1 text-lg font-bold">{t('wallet.withdrawTitle')}</h2>
          <p className="mb-4 text-sm text-[#8f8672]">{kycOk ? t('wallet.withdrawOk') : user.kyc === 'PENDING' ? t('wallet.withdrawKycPending') : t('wallet.withdrawKycNeeded')}</p>
          {kycOk ? (
            <WithdrawForm currencies={[...CURRENCIES]} />
          ) : (
            <Notice tone="warn">{user.kyc === 'PENDING' ? t('wallet.kycPendingNotice') : user.kyc === 'REJECTED' ? t('wallet.kycRejectedNotice') : t('wallet.kycNeededNotice')} {t('wallet.minimum')} {inr(MIN_WITHDRAWAL.INR)}. {t('wallet.availableInr')}: {inr(total)}.</Notice>
          )}
          {withdrawals.length > 0 && (
            <table className="table mt-5 w-full text-sm">
              <thead><tr><th>{t('wallet.dateHeader')}</th><th>{t('wallet.amountHeader')}</th><th>{t('wallet.statusHeader')}</th></tr></thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}><td>{w.requestedAt.toLocaleDateString(numLocale(w.currency as Currency))}</td><td><Money minor={w.amountMinor} currency={w.currency} /></td><td>{w.status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6">
        <h2 className="mb-1 text-lg font-bold">{t('wallet.activityTitle')}</h2>
        <p className="mb-4 text-sm text-[#8f8672]">{t('wallet.activitySubtitle')}</p>
        {history.length === 0 ? (
          <p className="text-sm text-[#8f8672]">{t('wallet.noTransactions')}</p>
        ) : (
          <table className="table w-full text-sm">
            <thead><tr><th>{t('wallet.whenHeader')}</th><th>{t('wallet.descriptionHeader')}</th><th>{t('wallet.directionHeader')}</th><th>{t('wallet.amountHeader')}</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">{h.tx.createdAt.toLocaleString(numLocale('INR'))}</td>
                  <td>{h.tx.description}<div className="text-xs text-[#8f8672]">{h.tx.type}</div></td>
                  <td className={h.direction === 'CREDIT' ? 'text-emerald-300' : 'text-orange-300'}>{h.direction === 'CREDIT' ? t('wallet.credit') : t('wallet.debit')}</td>
                  <td><Money minor={h.amountMinor} currency={h.account.currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
