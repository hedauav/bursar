'use client';

import { useState } from 'react';

import type { SimulationResponse } from '@/lib/ui/api';
import { errorMessage, fetchSimulation, runSqueeze } from '@/lib/ui/api';
import { formatDays, formatUsdfc } from '@/lib/ui/format';
import { tierStyle } from '@/lib/ui/theme';
import { Chip, ErrorNote, Panel, Skeleton } from '@/components/ui';
import { DecisionCard } from '@/components/decision-feed';

/** Keys served by /api/agent/simulate, in demo order. */
const SCENARIOS: { key: string; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'provider-delinquent', label: 'Provider stops proving' },
  { key: 'runway-critical', label: 'Runway at 1 day' },
  { key: 'critical-and-delinquent', label: 'Both at once' },
  { key: 'wallet-empty', label: 'Broke and critical' },
];

/** Runway the squeeze control leaves behind, in days. */
const SQUEEZE_TARGET_DAYS = 2;

export default function ScenarioPanel({ onSqueezed }: { onSqueezed: () => void }) {
  const [scenario, setScenario] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [armed, setArmed] = useState(false);
  const [squeezing, setSqueezing] = useState(false);
  const [squeezeNote, setSqueezeNote] = useState<string | null>(null);
  const [squeezeLink, setSqueezeLink] = useState<string | null>(null);
  const [squeezeError, setSqueezeError] = useState<string | null>(null);

  async function select(key: string) {
    setScenario(key);
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchSimulation(key));
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function squeeze() {
    setArmed(false);
    setSqueezing(true);
    setSqueezeError(null);
    setSqueezeNote(null);
    setSqueezeLink(null);
    try {
      const res = await runSqueeze(SQUEEZE_TARGET_DAYS);
      setSqueezeNote(
        res.message ??
          (res.withdrawn ? `Withdrew ${formatUsdfc(res.withdrawn)} USDFC.` : 'Done.'),
      );
      setSqueezeLink(res.explorerUrl ?? null);
      onSqueezed();
    } catch (err) {
      setSqueezeError(errorMessage(err));
    } finally {
      setSqueezing(false);
    }
  }

  const tone = result ? tierStyle(result.policy.tier) : null;

  return (
    <Panel
      title="What-if"
      subtitle="The same deterministic policy function, run against a modified copy of live on-chain state. Nothing is executed."
      bodyClassName="p-4 space-y-4"
    >
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => void select(s.key)}
            disabled={loading}
            aria-pressed={scenario === s.key}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-60 ${
              scenario === s.key
                ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <ErrorNote title="Simulation failed" message={error} />}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && result && tone && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-zinc-400">{result.description}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Chip className="border-zinc-600 bg-zinc-800/70 text-zinc-300">Projection</Chip>
            <Chip className={tone.chip}>{result.policy.tier}</Chip>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500">
              runway {formatDays(result.observation.pay.runwayDays)}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{result.policy.tierReason}</p>
          {result.policy.decisions.map((d, i) => (
            <DecisionCard key={`${result.scenario}-${i}`} decision={d} muted />
          ))}
          <p className="text-[11px] text-zinc-600">{result.note}</p>
        </div>
      )}

      {!loading && !result && !error && (
        <p className="text-xs text-zinc-500">
          Pick a scenario to see what the agent would decide under conditions that cannot be
          conjured on a testnet on demand.
        </p>
      )}

      {/* The one adversarial human action: take money away, on chain, for real. */}
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/15 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
          Demo control — sends a real transaction
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
          Withdraw the spare funds so only ~{SQUEEZE_TARGET_DAYS} days of runway remain, then run a
          tick and watch the agent respond to a crisis it did not create.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!armed ? (
            <button
              type="button"
              onClick={() => setArmed(true)}
              disabled={squeezing}
              className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:border-amber-500 disabled:opacity-60"
            >
              {squeezing ? 'Withdrawing…' : 'Squeeze the runway'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void squeeze()}
                className="rounded-md border border-red-600 bg-red-900/40 px-3 py-1.5 text-[11px] font-semibold text-red-100 transition-colors hover:bg-red-900/70"
              >
                Confirm withdrawal
              </button>
              <button
                type="button"
                onClick={() => setArmed(false)}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </>
          )}
          {squeezeLink && (
            <a
              href={squeezeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-sky-300 hover:text-sky-200"
            >
              View transaction ↗
            </a>
          )}
        </div>
        {squeezeNote && <p className="mt-2 text-xs text-amber-200/90">{squeezeNote}</p>}
        {squeezeError && (
          <p className="mt-2 break-words font-mono text-[11px] text-red-300">{squeezeError}</p>
        )}
      </div>
    </Panel>
  );
}
