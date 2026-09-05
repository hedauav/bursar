'use client';

import type { Tier } from '@/lib/agent/types';
import { tierStyle } from '@/lib/ui/theme';
import { Chip, Panel } from '@/components/ui';

/**
 * The rules, stated up front. A judge should be able to read this panel, look at
 * the runway meter, and predict the agent's next move before it makes it.
 */
const RULES: { tier: Tier; when: string; does: string }[] = [
  {
    tier: 'GREEN',
    when: 'runway > 10 days',
    does: 'Hold. Topping up now would lock funds earlier than necessary.',
  },
  {
    tier: 'YELLOW',
    when: '3 – 10 days',
    does: 'Pre-emptive top-up back to 30 days, while every provider is still proving and nothing has to be cut.',
  },
  {
    tier: 'RED',
    when: 'runway ≤ 3 days',
    does: 'Triage on proof: only datasets whose provider is currently proving get funded; ones past their PDP deadline get terminated.',
  },
  {
    tier: 'DEFICIT',
    when: 'debt > 0',
    does: 'Settlement has already halted. Clear the debt and restart payment for the datasets still proving.',
  },
  {
    tier: 'IDLE',
    when: 'lockup rate = 0',
    does: 'Nothing is draining the account, so runway is unbounded and there is nothing to fund or cut.',
  },
  {
    tier: 'UNFUNDED',
    when: 'no funds, no USDFC, no datasets',
    does: 'Nothing to manage yet.',
  },
];

export default function PolicyPanel({ activeTier }: { activeTier: Tier | null }) {
  return (
    <Panel
      title="Policy"
      subtitle="Deterministic thresholds — the same observation always produces the same decision"
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-zinc-900">
        {RULES.map((r) => {
          const style = tierStyle(r.tier);
          const active = activeTier === r.tier;
          return (
            <li
              key={r.tier}
              className={`px-4 py-3 ${active ? 'bg-zinc-900/60 ring-1 ring-inset ' + style.ring : ''}`}
            >
              <div className="flex items-center gap-2">
                <Chip className={style.chip}>{r.tier}</Chip>
                <span className="font-mono text-[11px] tabular-nums text-zinc-400">{r.when}</span>
                {active && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    current
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{r.does}</p>
            </li>
          );
        })}
      </ul>
      <div className="space-y-1 border-t border-zinc-800/80 bg-zinc-900/30 px-4 py-3 text-[11px] leading-relaxed text-zinc-500">
        <p>
          <span className="text-zinc-400">Top-up target</span> 30 days ·{' '}
          <span className="text-zinc-400">minimum transfer</span> 0.1 USDFC (no dust txs) ·{' '}
          <span className="text-zinc-400">epoch</span> 30s
        </p>
        <p>
          Every corrective action needs tFIL for gas; without it the agent reports{' '}
          <code className="font-mono text-zinc-400">BLOCKED_NO_FUNDS</code> instead of failing
          silently. Unreadable proof state is never treated as delinquency.
        </p>
      </div>
    </Panel>
  );
}
