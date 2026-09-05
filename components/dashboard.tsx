'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TickRecord } from '@/lib/agent/types';
import type { AgentState } from '@/lib/ui/api';
import { errorMessage, fetchAgentState, fetchJournal, runTick } from '@/lib/ui/api';
import {
  EXPLORER_ADDRESS,
  formatAllowance,
  formatEpoch,
  relativeTime,
  shortAddress,
} from '@/lib/ui/format';
import { Chip, ErrorNote, Panel } from '@/components/ui';
import { useNow } from '@/components/use-now';
import DatasetTable from '@/components/dataset-table';
import DecisionFeed from '@/components/decision-feed';
import PolicyPanel from '@/components/policy-panel';
import RunwayMeter from '@/components/runway-meter';
import ScenarioPanel from '@/components/scenario-panel';
import StatTiles from '@/components/stat-tiles';

/** Filecoin epochs are 30s; polling at 12s keeps the console ahead of the chain. */
const POLL_MS = 12_000;

export default function Dashboard() {
  const [state, setState] = useState<AgentState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [stateLoading, setStateLoading] = useState(true);

  const [ticks, setTicks] = useState<TickRecord[]>([]);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [journalLoading, setJournalLoading] = useState(true);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const mounted = useRef(true);
  const now = useNow(5_000);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Written as promise callbacks rather than async/await: the loaders are kicked
  // off from an effect, and state must only ever be set from the settled
  // callback (never synchronously inside the effect body).
  const loadState = useCallback(
    () =>
      fetchAgentState().then(
        (next) => {
          if (!mounted.current) return;
          setState(next);
          setStateError(null);
          setStateLoading(false);
        },
        (err: unknown) => {
          if (!mounted.current) return;
          setStateError(errorMessage(err));
          setStateLoading(false);
        },
      ),
    [],
  );

  /** Polling wrapper — same read, but it lights the "reading chain" indicator. */
  const refreshState = useCallback(async () => {
    setSyncing(true);
    try {
      await loadState();
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }, [loadState]);

  const loadJournal = useCallback(
    () =>
      fetchJournal().then(
        ({ ticks: next }) => {
          if (!mounted.current) return;
          setTicks(Array.isArray(next) ? next : []);
          setJournalError(null);
          setJournalLoading(false);
        },
        (err: unknown) => {
          if (!mounted.current) return;
          setJournalError(errorMessage(err));
          setJournalLoading(false);
        },
      ),
    [],
  );

  useEffect(() => {
    void loadState();
    void loadJournal();
  }, [loadState, loadJournal]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void refreshState();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, refreshState]);

  const onRunTick = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const tick = await runTick();
      if (!mounted.current) return;
      setTicks((prev) => [tick, ...prev.filter((t) => t.id !== tick.id)]);
      // The tick carries a fresh observation — adopt it immediately rather than
      // waiting for the next poll, so the meter moves the moment the agent acts.
      setState((prev) => ({
        observation: tick.observation,
        policy: {
          tier: tick.tier,
          tierReason: tick.tierReason,
          decisions: prev?.policy.decisions ?? [],
        },
      }));
      setStateError(null);
      void loadState();
    } catch (err) {
      if (mounted.current) setRunError(errorMessage(err));
    } finally {
      if (mounted.current) setRunning(false);
    }
  }, [loadState]);

  const obs = state?.observation ?? null;
  const tier = state?.policy.tier ?? null;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              className="size-8 rounded-md"
            />
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
                Bursar
              </h1>
              <p className="text-[11px] text-zinc-500">
                Pay only for what persists.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Chip className="border-sky-800/60 bg-sky-950/40 text-sky-300">
              Filecoin Calibration
            </Chip>
            {obs ? (
              <a
                href={EXPLORER_ADDRESS(obs.address)}
                target="_blank"
                rel="noopener noreferrer"
                title={obs.address}
                className="rounded-md border border-zinc-800 px-2 py-0.5 font-mono text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
              >
                {shortAddress(obs.address, 8, 6)} ↗
              </a>
            ) : (
              <span className="rounded-md border border-zinc-800 px-2 py-0.5 font-mono text-zinc-600">
                wallet …
              </span>
            )}
            <span className="font-mono tabular-nums text-zinc-500">
              epoch <span className="text-zinc-300">{formatEpoch(obs?.epoch)}</span>
            </span>
            <span className="text-zinc-600">
              observed{' '}
              <span className="text-zinc-400">{relativeTime(obs?.observedAt, now)}</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={autoRefresh}
              aria-label="Auto-refresh the live chain read every 12 seconds"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                autoRefresh
                  ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="relative flex size-2">
                {autoRefresh && (
                  <span className="animate-live-ring absolute inline-flex size-2 rounded-full bg-emerald-400" />
                )}
                <span
                  className={`relative inline-flex size-2 rounded-full ${
                    autoRefresh ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                />
              </span>
              {autoRefresh ? (syncing ? 'reading chain…' : 'live · 12s') : 'paused'}
            </button>

            <button
              type="button"
              onClick={() => void onRunTick()}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-[11px] font-semibold text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {running && (
                <span
                  aria-hidden="true"
                  className="size-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent"
                />
              )}
              {running ? 'Agent running…' : 'Run agent tick now'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[110rem] flex-1 space-y-4 px-4 py-5 sm:px-6">
        {stateError && (
          <ErrorNote
            title="Live chain read failed — showing the last good data where available"
            message={stateError}
          />
        )}
        {runError && <ErrorNote title="Agent tick failed" message={runError} />}

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <RunwayMeter
              pay={obs?.pay ?? null}
              tier={tier}
              tierReason={state?.policy.tierReason ?? null}
              loading={stateLoading}
            />
            <StatTiles obs={obs} loading={stateLoading} />
            <ContextStrip state={state} />
          </div>
          <PolicyPanel activeTier={tier} />
        </div>

        <ScenarioPanel onSqueezed={() => void refreshState()} />

        {obs && obs.warnings.length > 0 && (
          <Panel
            title="Read warnings"
            subtitle="Non-fatal read errors, surfaced rather than swallowed"
            bodyClassName="p-4"
          >
            <ul className="space-y-1.5">
              {obs.warnings.map((w, i) => (
                <li key={i} className="flex gap-2 font-mono text-xs text-amber-300/90">
                  <span aria-hidden="true" className="text-amber-500">
                    !
                  </span>
                  <span className="break-words">{w}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <DecisionFeed
          ticks={ticks}
          projected={state?.policy ?? null}
          projectedAt={obs?.observedAt ?? null}
          loading={journalLoading}
          error={journalError}
        />

        <DatasetTable
          datasets={obs?.datasets ?? null}
          epoch={obs?.epoch ?? null}
          loading={stateLoading}
        />
      </main>

      <footer className="mx-auto w-full max-w-[110rem] px-4 pb-8 pt-2 text-[11px] text-zinc-600 sm:px-6">
        Decisions are made by a pure, deterministic policy engine over on-chain reads. The LLM only
        narrates them.
      </footer>
    </>
  );
}

/** Operator approval + pricing: the preconditions that make the spend possible. */
function ContextStrip({ state }: { state: AgentState | null }) {
  if (!state) return null;
  const { approval, pricing } = state.observation;
  if (!approval && !pricing) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-2.5 text-[11px]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        Service approval
      </span>
      {approval ? (
        <>
          <Chip
            className={
              approval.isApproved
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }
          >
            {approval.isApproved ? 'Warm Storage approved' : 'Not approved'}
          </Chip>
          <span className="font-mono tabular-nums text-zinc-500">
            rate{' '}
            <span className="text-zinc-300" title={approval.rateUsage}>
              {formatAllowance(approval.rateUsage)}
            </span>{' '}
            /{' '}
            <span className="text-zinc-400" title={approval.rateAllowance}>
              {formatAllowance(approval.rateAllowance)}
            </span>
          </span>
          <span className="font-mono tabular-nums text-zinc-500">
            lockup{' '}
            <span className="text-zinc-300" title={approval.lockupUsage}>
              {formatAllowance(approval.lockupUsage)}
            </span>{' '}
            /{' '}
            <span className="text-zinc-400" title={approval.lockupAllowance}>
              {formatAllowance(approval.lockupAllowance)}
            </span>
          </span>
        </>
      ) : (
        <span className="text-zinc-600">no approval record</span>
      )}
      {pricing && (
        <span className="font-mono tabular-nums text-zinc-500">
          price{' '}
          <span className="text-zinc-300" title={pricing.perTiBPerMonth}>
            {formatAllowance(pricing.perTiBPerMonth, 2)}
          </span>{' '}
          USDFC / TiB / month
        </span>
      )}
    </div>
  );
}
