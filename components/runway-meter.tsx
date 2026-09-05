'use client';

import type { ReactNode } from 'react';

import type { AgentObservation, Tier } from '@/lib/agent/types';
import { epochsToDays, formatDays, formatDaysNumber, formatEpoch } from '@/lib/ui/format';
import { tierStyle } from '@/lib/ui/theme';
import { Chip, Panel, Skeleton } from '@/components/ui';

/** Days of runway the bar spans end to end — the agent's own top-up target. */
const SCALE_DAYS = 30;
const RED_MARK = 3;
const GREEN_MARK = 10;

function pct(days: number): number {
  return Math.max(0, Math.min(100, (days / SCALE_DAYS) * 100));
}

export default function RunwayMeter({
  pay,
  tier,
  tierReason,
  loading,
}: {
  pay: AgentObservation['pay'] | null;
  tier: Tier | null;
  tierReason: string | null;
  loading: boolean;
}) {
  const style = tierStyle(tier);

  if (loading && !pay) {
    return (
      <Panel title="Runway" subtitle="Days of storage the account can still pay for">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_1fr]">
          <div className="space-y-3">
            <Skeleton className="h-20 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </Panel>
    );
  }

  const infinite = pay?.runwayIsInfinite ?? false;
  const days = infinite ? null : (pay?.runwayDays ?? null);
  const grossDays = infinite ? null : epochsToDays(pay?.grossCoverageInEpochs);

  const fillPct = infinite ? 100 : days === null ? 0 : pct(days);
  const grossPct = infinite ? 100 : grossDays === null ? 0 : pct(grossDays);

  return (
    <Panel
      title="Runway"
      subtitle="How many days of storage this account can still pay for"
      className={style.glow}
      right={
        <Chip className={style.chip}>
          <span aria-hidden="true" className={`size-1.5 rounded-full ${style.bar}`} />
          {style.label}
        </Chip>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_1fr] lg:items-center">
        {/* Hero readout */}
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono text-6xl font-semibold leading-none tabular-nums sm:text-7xl ${style.text}`}
              title={pay ? `${pay.runwayInEpochs} epochs` : undefined}
            >
              {pay ? formatDaysNumber(days) : '—'}
            </span>
            <span className="text-lg font-medium text-zinc-500">
              {infinite ? '' : 'days'}
            </span>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            {infinite ? (
              <>No active spend — nothing is draining the account.</>
            ) : (
              <>
                <span className="font-mono tabular-nums text-zinc-300">
                  {formatEpoch(pay?.runwayInEpochs)}
                </span>{' '}
                epochs before the account can no longer cover its committed rate.
              </>
            )}
          </p>
        </div>

        {/* Threshold bar */}
        <div>
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            <span className="normal-case">0 days</span>
            <span>policy thresholds</span>
            <span className="normal-case">{SCALE_DAYS} days</span>
          </div>

          <div className="relative h-5 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/80">
            {/* Total prepaid coverage, sitting behind the usable runway. */}
            <div
              className="absolute inset-y-0 left-0 bg-zinc-700/50"
              style={{ width: `${grossPct}%` }}
              aria-hidden="true"
            />
            {/* Usable runway. */}
            <div
              className={`absolute inset-y-0 left-0 transition-[width] duration-700 ease-out ${style.bar}`}
              style={{ width: `${fillPct}%` }}
              role="meter"
              aria-valuemin={0}
              aria-valuemax={SCALE_DAYS}
              aria-valuenow={days ?? SCALE_DAYS}
              aria-label="Runway in days"
            />
            {/* Threshold markers, drawn on top so the rules are visible. */}
            <Marker atPct={pct(RED_MARK)} className="bg-red-300" />
            <Marker atPct={pct(GREEN_MARK)} className="bg-emerald-200" />
          </div>

          {/* Marker legend */}
          <div className="relative mt-1.5 h-8 text-[10px] text-zinc-500">
            <MarkerLabel atPct={pct(RED_MARK)} tone="text-red-400/90">
              {RED_MARK}d
              <span className="block text-[9px] uppercase tracking-wider text-zinc-600">red</span>
            </MarkerLabel>
            <MarkerLabel atPct={pct(GREEN_MARK)} tone="text-emerald-400/90">
              {GREEN_MARK}d
              <span className="block text-[9px] uppercase tracking-wider text-zinc-600">green</span>
            </MarkerLabel>
          </div>

          <dl className="mt-2 grid gap-x-6 gap-y-1 border-t border-zinc-800/80 pt-3 text-xs sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Runway (before deficit)</dt>
              <dd className={`font-mono tabular-nums ${style.text}`}>
                {infinite ? '∞' : formatDays(days)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Total prepaid coverage</dt>
              <dd
                className="font-mono tabular-nums text-zinc-300"
                title={pay ? `${pay.grossCoverageInEpochs} epochs` : undefined}
              >
                {infinite ? '∞' : formatDays(grossDays)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Runway is what is spendable before the account goes into deficit; gross coverage is
            everything prepaid, including the locked reserve it is not allowed to spend.
          </p>
        </div>
      </div>

      {/* Why this tier — verbatim from the policy engine. */}
      <div className="mt-5 flex flex-col gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
        <Chip className={`${style.chip} shrink-0`}>{style.label}</Chip>
        <p className="text-sm leading-relaxed text-zinc-300">
          {tierReason ?? 'Waiting for the first on-chain observation.'}
        </p>
      </div>
    </Panel>
  );
}

function Marker({ atPct, className }: { atPct: number; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-y-0 w-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.65)] ${className}`}
      style={{ left: `${atPct}%` }}
    />
  );
}

function MarkerLabel({
  atPct,
  tone,
  children,
}: {
  atPct: number;
  tone: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`absolute -translate-x-1/2 text-center font-mono tabular-nums ${tone}`}
      style={{ left: `${atPct}%` }}
    >
      {children}
    </span>
  );
}
