'use client';

import type { AgentObservation } from '@/lib/agent/types';
import { formatUsdfc, isPositive } from '@/lib/ui/format';
import { Skeleton } from '@/components/ui';

interface Tile {
  label: string;
  raw: string;
  unit: string;
  hint: string;
  tone?: string;
}

export default function StatTiles({
  obs,
  loading,
}: {
  obs: AgentObservation | null;
  loading: boolean;
}) {
  if (!obs) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3.5"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-20" />
            <Skeleton className="mt-2.5 h-2.5 w-16" />
          </div>
        ))}
        <span className="sr-only">{loading ? 'Loading account balances' : 'No data'}</span>
      </div>
    );
  }

  const inDebt = isPositive(obs.pay.debt);

  const tiles: Tile[] = [
    {
      label: 'Funds in Filecoin Pay',
      raw: obs.pay.funds,
      unit: 'USDFC',
      hint: 'Deposited on the payments contract',
    },
    {
      label: 'Available funds',
      raw: obs.pay.availableFunds,
      unit: 'USDFC',
      hint: 'Spendable after lockup',
    },
    {
      label: 'Debt',
      raw: obs.pay.debt,
      unit: 'USDFC',
      hint: inDebt ? 'Settlement to providers has halted' : 'Nothing owed',
      tone: inDebt ? 'text-rose-300' : 'text-zinc-500',
    },
    {
      label: 'Burn rate',
      raw: obs.pay.lockupRatePerMonth,
      unit: 'USDFC / month',
      hint: 'Committed storage spend',
    },
    {
      label: 'Wallet USDFC',
      raw: obs.wallet.usdfc,
      unit: 'USDFC',
      hint: 'Available to deposit',
    },
    {
      label: 'Wallet tFIL',
      raw: obs.wallet.fil,
      unit: 'tFIL',
      hint: isPositive(obs.wallet.fil) ? 'Gas for transactions' : 'No gas — cannot transact',
      tone: isPositive(obs.wallet.fil) ? undefined : 'text-amber-300',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3.5 transition-colors hover:border-zinc-700"
        >
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            {t.label}
          </p>
          <p
            className={`mt-2 font-mono text-xl font-semibold tabular-nums ${t.tone ?? 'text-zinc-100'}`}
            title={`${t.raw} (raw, 18 decimals)`}
          >
            {formatUsdfc(t.raw)}
          </p>
          <p className="mt-1 truncate text-[10px] text-zinc-500" title={t.hint}>
            <span className="text-zinc-600">{t.unit}</span>
            <span className="mx-1 text-zinc-700">·</span>
            {t.hint}
          </p>
        </div>
      ))}
    </div>
  );
}
