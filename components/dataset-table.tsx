'use client';

import type { DatasetObservation } from '@/lib/agent/types';
import { formatCount, formatEpoch, formatUsdfc, relativeTime } from '@/lib/ui/format';
import { Chip, EmptyNote, Panel, Skeleton } from '@/components/ui';
import { useNow } from '@/components/use-now';

/** The chip that makes the pay-on-proof rule visible at a glance. */
function ProofChip({ proof }: { proof: DatasetObservation['proof'] }) {
  if (proof.error) {
    return (
      <Chip className="border-zinc-700 bg-zinc-800/60 text-zinc-400" title={proof.error}>
        Unknown
      </Chip>
    );
  }
  if (proof.isProofOverdue) {
    return (
      <Chip
        className="border-red-500/50 bg-red-500/15 text-red-300"
        title={`${proof.epochsOverdue} epochs past the proving deadline`}
      >
        Overdue
        <span className="font-mono normal-case tabular-nums">+{formatCount(proof.epochsOverdue)}</span>
      </Chip>
    );
  }
  if (proof.provenThisPeriod) {
    return (
      <Chip
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
        title="Provider satisfied the current PDP proving period"
      >
        Proving ✓
      </Chip>
    );
  }
  return (
    <Chip
      className="border-amber-500/40 bg-amber-500/10 text-amber-300"
      title="Current proving period is still open — not yet proven, not yet late"
    >
      Awaiting
    </Chip>
  );
}

function BoolCell({ value, yes, no }: { value: boolean; yes: string; no: string }) {
  return (
    <span className={value ? 'text-emerald-300' : 'text-zinc-500'}>{value ? yes : no}</span>
  );
}

export default function DatasetTable({
  datasets,
  epoch,
  loading,
}: {
  datasets: DatasetObservation[] | null;
  epoch: string | null;
  loading: boolean;
}) {
  const now = useNow();

  const overdue = (datasets ?? []).filter((d) => d.proof.isProofOverdue && !d.proof.error).length;

  return (
    <Panel
      title="Datasets"
      subtitle="What the agent is paying for, and whether the provider is earning it"
      right={
        <div className="flex items-center gap-2">
          {overdue > 0 && (
            <Chip className="border-red-500/50 bg-red-500/15 text-red-300">
              {overdue} not proving
            </Chip>
          )}
          <span className="font-mono text-[11px] tabular-nums text-zinc-500">
            epoch {formatEpoch(epoch)}
          </span>
        </div>
      }
      bodyClassName="p-0"
    >
      {!datasets && (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
          <span className="sr-only">{loading ? 'Loading datasets' : 'No data'}</span>
        </div>
      )}

      {datasets && datasets.length === 0 && (
        <div className="p-4">
          <EmptyNote>
            No datasets on this account yet — nothing is draining the runway.
          </EmptyNote>
        </div>
      )}

      {datasets && datasets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Datasets funded by the agent, with PDP proof status per provider
            </caption>
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Dataset
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Provider
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Live
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Pieces
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Proof status
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Last proven
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Proving deadline
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Reserve
                </th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr
                  key={d.dataSetId}
                  className={`border-b border-zinc-900 transition-colors last:border-0 hover:bg-zinc-900/40 ${
                    d.proof.isProofOverdue && !d.proof.error ? 'bg-red-950/15' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono tabular-nums text-zinc-100">
                      #{d.pdpVerifierDataSetId}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-zinc-600">
                      rail {d.pdpRailId} · id {d.dataSetId}
                      {d.withCDN ? ' · CDN' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono tabular-nums text-zinc-200">{d.providerId}</span>
                    <span
                      className="mt-0.5 block font-mono text-[10px] text-zinc-600"
                      title={d.serviceProvider}
                    >
                      {d.serviceProvider ? `${d.serviceProvider.slice(0, 10)}…` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BoolCell value={d.isLive} yes="live" no="ended" />
                  </td>
                  <td className="px-4 py-3">
                    <BoolCell value={d.hasActivePieces} yes="yes" no="none" />
                  </td>
                  <td className="px-4 py-3">
                    <ProofChip proof={d.proof} />
                  </td>
                  <td className="px-4 py-3 text-zinc-300" title={d.proof.lastProvenAt ?? 'never'}>
                    {d.proof.lastProvenAt ? (
                      relativeTime(d.proof.lastProvenAt, now)
                    ) : (
                      <span className="text-zinc-600">never</span>
                    )}
                    {d.proof.lastProvenEpoch && (
                      <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-zinc-600">
                        epoch {formatEpoch(d.proof.lastProvenEpoch)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-300">
                    {formatEpoch(d.proof.provingDeadlineEpoch)}
                    {d.proof.nextChallengeEpoch && (
                      <span className="mt-0.5 block text-[10px] text-zinc-600">
                        next challenge {formatEpoch(d.proof.nextChallengeEpoch)}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-mono tabular-nums text-zinc-300"
                    title={`${d.lifecycleReserveBalance} (raw, 18 decimals)`}
                  >
                    {formatUsdfc(d.lifecycleReserveBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
