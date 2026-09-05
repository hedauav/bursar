'use client';

import type { Decision, ExecutedDecision, TickRecord } from '@/lib/agent/types';
import type { PolicyPreview } from '@/lib/ui/api';
import {
  EXPLORER_TX,
  formatDateTime,
  formatDuration,
  formatEvidenceValue,
  formatUsdfc,
  relativeTime,
} from '@/lib/ui/format';
import { actionStyle, statusStyle, tierStyle } from '@/lib/ui/theme';
import { Chip, EmptyNote, ErrorNote, Panel, Skeleton } from '@/components/ui';
import { useNow } from '@/components/use-now';

const TRIGGER_STYLES: Record<string, string> = {
  cron: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  manual: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  boot: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
};

/** Newest ticks first; older history stays in the journal but off-screen. */
const MAX_TICKS = 15;

export default function DecisionFeed({
  ticks,
  projected,
  projectedAt,
  loading,
  error,
}: {
  ticks: TickRecord[];
  projected: PolicyPreview | null;
  projectedAt: string | null;
  loading: boolean;
  error: string | null;
}) {
  const now = useNow();
  const shown = ticks.slice(0, MAX_TICKS);

  return (
    <Panel
      title="Decision feed"
      subtitle="Every cycle the agent ran, the evidence it weighed, and what it did about it"
      right={
        <span className="font-mono text-[11px] tabular-nums text-zinc-500">
          {ticks.length} tick{ticks.length === 1 ? '' : 's'}
        </span>
      }
      bodyClassName="p-4 space-y-4"
    >
      {projected && (
        <article className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30">
          <header className="flex flex-wrap items-center gap-2 border-b border-dashed border-zinc-800 px-4 py-2.5">
            <Chip className="border-zinc-600 bg-zinc-800/70 text-zinc-300">Projected</Chip>
            <Chip className={tierStyle(projected.tier).chip}>{projected.tier}</Chip>
            <span className="text-xs text-zinc-500">
              What the agent would do right now, from a live read
              {projectedAt ? ` · ${relativeTime(projectedAt, now)}` : ''} — not executed.
            </span>
          </header>
          <div className="space-y-3 p-4">
            <p className="text-sm leading-relaxed text-zinc-400">{projected.tierReason}</p>
            {projected.decisions.length === 0 ? (
              <EmptyNote>The policy engine returned no decisions for this state.</EmptyNote>
            ) : (
              projected.decisions.map((d, i) => (
                <DecisionCard key={`${d.reasonCode}-${i}`} decision={d} muted />
              ))
            )}
          </div>
        </article>
      )}

      {error && <ErrorNote title="Journal unavailable" message={error} />}

      {loading && ticks.length === 0 && !error && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-zinc-800/80 p-4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="mt-3 h-4 w-28" />
              <Skeleton className="mt-3 h-12 w-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && ticks.length === 0 && !error && (
        <EmptyNote>
          No cycles recorded yet. Press <span className="text-zinc-300">Run agent tick</span> to make
          the agent observe the chain and decide.
        </EmptyNote>
      )}

      {shown.map((tick) => (
        <TickCard key={tick.id} tick={tick} now={now} />
      ))}

      {ticks.length > shown.length && (
        <p className="pt-1 text-center text-xs text-zinc-600">
          {ticks.length - shown.length} older tick(s) not shown.
        </p>
      )}
    </Panel>
  );
}

function TickCard({ tick, now }: { tick: TickRecord; now: number }) {
  const tone = tierStyle(tick.tier);
  return (
    <article className="rounded-lg border border-zinc-800/80 bg-zinc-900/20">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800/80 px-4 py-2.5">
        <time
          dateTime={tick.startedAt}
          className="font-mono text-xs tabular-nums text-zinc-300"
          title={tick.startedAt}
        >
          {formatDateTime(tick.startedAt)}
        </time>
        <span className="text-xs text-zinc-500">{relativeTime(tick.startedAt, now)}</span>
        <Chip className={TRIGGER_STYLES[tick.trigger] ?? TRIGGER_STYLES.boot}>{tick.trigger}</Chip>
        <Chip className={tone.chip}>{tick.tier}</Chip>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-zinc-600">
          {formatDuration(tick.durationMs)}
        </span>
      </header>

      <div className="space-y-3 p-4">
        <p className="text-sm leading-relaxed text-zinc-400">{tick.tierReason}</p>

        {tick.decisions.length === 0 ? (
          <EmptyNote>This cycle produced no decisions.</EmptyNote>
        ) : (
          tick.decisions.map((d, i) => (
            <DecisionCard key={`${tick.id}-${i}`} decision={d} />
          ))
        )}

        {tick.narration && (
          <aside className="rounded-lg border border-violet-900/50 bg-violet-950/20 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">
              Agent&rsquo;s summary
              <span className="ml-2 font-normal normal-case tracking-normal text-violet-400/70">
                LLM narration — explains the decision, never makes it
              </span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-violet-100/90">{tick.narration}</p>
          </aside>
        )}
      </div>
    </article>
  );
}

function isExecuted(d: Decision | ExecutedDecision): d is ExecutedDecision {
  return typeof (d as ExecutedDecision).status === 'string';
}

export function DecisionCard({
  decision,
  muted = false,
}: {
  decision: Decision | ExecutedDecision;
  muted?: boolean;
}) {
  const a = actionStyle(decision.action);
  const executed = isExecuted(decision) ? decision : null;
  const status = executed ? statusStyle(executed.status) : null;
  const evidence = Object.entries(decision.evidence ?? {});
  const txUrl =
    executed?.explorerUrl ?? (executed?.txHash ? EXPLORER_TX(executed.txHash) : null);

  return (
    <div
      className={`rounded-lg border border-zinc-800 border-l-2 bg-zinc-950/60 p-4 ${a.accent} ${
        muted ? 'opacity-95' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip className={a.chip}>{a.label}</Chip>
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
          {decision.reasonCode}
        </code>
        {decision.dataSetId && (
          <span className="font-mono text-[11px] text-zinc-500">
            dataset <span className="text-zinc-300">{decision.dataSetId}</span>
          </span>
        )}
        {decision.amount && (
          <span
            className="ml-auto font-mono text-sm font-semibold tabular-nums text-sky-300"
            title={`${decision.amount} (raw, 18 decimals)`}
          >
            {formatUsdfc(decision.amount)} USDFC
          </span>
        )}
        {status && (
          <Chip className={`${decision.amount ? '' : 'ml-auto'} ${status.chip}`}>
            {status.label}
          </Chip>
        )}
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-zinc-200">{decision.rationale}</p>

      {executed?.error && (
        <p className="mt-2 break-words rounded border border-red-900/50 bg-red-950/30 px-3 py-2 font-mono text-xs text-red-300">
          {executed.error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {evidence.length > 0 && (
          <details className="group w-full">
            <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-1.5 rounded border border-zinc-800 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400 hover:border-zinc-700 hover:text-zinc-200">
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">
                ▸
              </span>
              Evidence
              <span className="font-mono normal-case tracking-normal text-zinc-600">
                {evidence.length}
              </span>
            </summary>
            <dl className="mt-2 overflow-hidden rounded border border-zinc-800">
              {evidence.map(([k, v], i) => (
                <div
                  key={k}
                  className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-1.5 ${
                    i % 2 ? 'bg-zinc-900/30' : ''
                  }`}
                >
                  <dt className="font-mono text-[11px] text-zinc-500">{k}</dt>
                  <dd
                    className="break-all font-mono text-[11px] tabular-nums text-zinc-200"
                    title={v === null ? 'null' : String(v)}
                  >
                    {formatEvidenceValue(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-sky-800/60 bg-sky-950/40 px-2 py-1 text-[11px] font-medium text-sky-300 hover:border-sky-600 hover:text-sky-200"
          >
            View transaction ↗
          </a>
        )}
        {executed && (
          <span className="font-mono text-[10px] text-zinc-600" title={executed.executedAt}>
            {formatDateTime(executed.executedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
