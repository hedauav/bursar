import { describe, expect, it } from 'vitest';

import { decide } from './policy';
import type { AgentObservation, DatasetObservation } from './types';

/**
 * The policy engine is the part of this agent that actually gets judged, so it
 * is tested directly rather than only through the live chain. Because `decide()`
 * is pure, every branch below is deterministic and reproducible.
 */

/** Real rate observed on Calibration: 0.24 USDFC / month across 2 datasets. */
const RATE_PER_EPOCH = 2_777_777_792_776n;
const EPOCHS_PER_DAY = 2880n;
const USDFC = (n: number) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;

function dataset(over: Partial<DatasetObservation> = {}): DatasetObservation {
  return {
    dataSetId: '33745',
    pdpVerifierDataSetId: '33745',
    providerId: '4',
    serviceProvider: '0xCb9e86945cA31E6C3120725BF0385CBAD684040c',
    isLive: true,
    hasActivePieces: true,
    withCDN: false,
    metadata: {},
    pdpRailId: '1',
    lifecycleReserveBalance: '500000000000000000',
    proof: {
      provenThisPeriod: true,
      provingDeadlineEpoch: '4042589',
      lastProvenEpoch: '4042346',
      lastProvenAt: '2026-09-05T08:00:00.000Z',
      nextChallengeEpoch: '4042569',
      isProofOverdue: false,
      epochsOverdue: '0',
      dataSetLive: true,
    },
    ...over,
  };
}

function observation(opts: {
  runwayDays?: number;
  rate?: bigint;
  debt?: bigint;
  walletUsdfc?: bigint;
  walletFil?: bigint;
  datasets?: DatasetObservation[];
}): AgentObservation {
  const rate = opts.rate ?? RATE_PER_EPOCH;
  const runwayEpochs =
    opts.runwayDays === undefined
      ? 0n
      : BigInt(Math.round(opts.runwayDays * Number(EPOCHS_PER_DAY)));
  return {
    observedAt: new Date().toISOString(),
    address: '0x7085f12a9B5e51dD9B01443F7568A2De40AACC98',
    chainId: 314159,
    epoch: '4042350',
    pay: {
      funds: USDFC(1.4).toString(),
      availableFunds: (rate * runwayEpochs).toString(),
      debt: (opts.debt ?? 0n).toString(),
      lockupRatePerEpoch: rate.toString(),
      lockupRatePerMonth: (rate * 86400n).toString(),
      totalLockup: USDFC(1.168).toString(),
      totalFixedLockup: USDFC(1).toString(),
      totalRateBasedLockup: USDFC(0.24).toString(),
      runwayInEpochs: runwayEpochs.toString(),
      grossCoverageInEpochs: '440000',
      runwayIsInfinite: false,
      runwayDays: Number(runwayEpochs) / Number(EPOCHS_PER_DAY),
    },
    wallet: {
      fil: (opts.walletFil ?? 10n ** 18n).toString(),
      usdfc: (opts.walletUsdfc ?? USDFC(3.5)).toString(),
    },
    approval: {
      isApproved: true,
      rateAllowance: '0',
      lockupAllowance: '0',
      rateUsage: '0',
      lockupUsage: '0',
      maxLockupPeriod: '86400',
    },
    pricing: null,
    datasets: opts.datasets ?? [dataset()],
    warnings: [],
  };
}

describe('tier classification', () => {
  it('is GREEN above 10 days and refuses to top up early', () => {
    const r = decide(observation({ runwayDays: 30 }));
    expect(r.tier).toBe('GREEN');
    expect(r.decisions).toHaveLength(1);
    expect(r.decisions[0].action).toBe('HOLD');
    expect(r.decisions[0].reasonCode).toBe('RUNWAY_COMFORTABLE');
  });

  it('is YELLOW between 3 and 10 days', () => {
    expect(decide(observation({ runwayDays: 7 })).tier).toBe('YELLOW');
  });

  it('is RED at or below 3 days', () => {
    expect(decide(observation({ runwayDays: 2 })).tier).toBe('RED');
  });

  it('is DEFICIT when debt is outstanding, regardless of runway', () => {
    const r = decide(observation({ runwayDays: 30, debt: USDFC(0.05) }));
    expect(r.tier).toBe('DEFICIT');
  });

  it('is IDLE when nothing is being spent', () => {
    const r = decide(observation({ runwayDays: 0, rate: 0n }));
    expect(r.tier).toBe('IDLE');
    expect(r.decisions[0].reasonCode).toBe('NO_ACTIVE_SPEND');
  });
});

describe('YELLOW: pre-emptive top-up', () => {
  it('tops up to restore 30 days, sized from the shortfall', () => {
    const r = decide(observation({ runwayDays: 7 }));
    const topUp = r.decisions.find((d) => d.action === 'TOP_UP');
    expect(topUp).toBeDefined();
    expect(topUp!.reasonCode).toBe('PREEMPTIVE_TOPUP');

    // target 30 days minus the 7 already covered = 23 days of rate.
    const expected = RATE_PER_EPOCH * 23n * EPOCHS_PER_DAY;
    expect(BigInt(topUp!.amount!)).toBe(expected);
  });

  it('never prunes in YELLOW, even if a provider is delinquent', () => {
    const r = decide(
      observation({
        runwayDays: 7,
        datasets: [
          dataset({
            proof: {
              ...dataset().proof,
              isProofOverdue: true,
              provenThisPeriod: false,
              epochsOverdue: '400',
            },
          }),
        ],
      }),
    );
    expect(r.decisions.some((d) => d.action === 'PRUNE_DATASET')).toBe(false);
  });
});

describe('RED: triage on proof status', () => {
  const delinquent = dataset({
    dataSetId: '33745',
    pdpVerifierDataSetId: '33745',
    providerId: '4',
    proof: {
      ...dataset().proof,
      isProofOverdue: true,
      provenThisPeriod: false,
      epochsOverdue: '312',
    },
  });
  const healthy = dataset({
    dataSetId: '33746',
    pdpVerifierDataSetId: '33746',
    providerId: '2',
  });

  it('prunes the provider that stopped proving and funds the one that did not', () => {
    const r = decide(
      observation({ runwayDays: 1, datasets: [delinquent, healthy] }),
    );
    expect(r.tier).toBe('RED');

    const prunes = r.decisions.filter((d) => d.action === 'PRUNE_DATASET');
    expect(prunes).toHaveLength(1);
    expect(prunes[0].dataSetId).toBe('33745');
    expect(prunes[0].reasonCode).toBe('PROVIDER_NOT_PROVING');

    const topUp = r.decisions.find((d) => d.action === 'TOP_UP');
    expect(topUp!.reasonCode).toBe('CRITICAL_TOPUP_PROVEN_ONLY');
  });

  it('re-sizes the top-up down to only what survives triage', () => {
    const both = decide(
      observation({ runwayDays: 1, datasets: [healthy, dataset({ dataSetId: '33746' })] }),
    ).decisions.find((d) => d.action === 'TOP_UP');

    const halved = decide(
      observation({ runwayDays: 1, datasets: [delinquent, healthy] }),
    ).decisions.find((d) => d.action === 'TOP_UP');

    // One of two datasets is cut, so the projected rate - and the deposit - halve.
    expect(BigInt(halved!.amount!)).toBeLessThan(BigInt(both!.amount!));
  });

  it('does NOT prune when proof state could not be read', () => {
    const unknown = dataset({
      proof: { ...dataset().proof, error: 'RPC timeout', isProofOverdue: true },
    });
    const r = decide(observation({ runwayDays: 1, datasets: [unknown] }));
    expect(r.decisions.some((d) => d.action === 'PRUNE_DATASET')).toBe(false);
    expect(
      r.decisions.some((d) => d.reasonCode === 'PROOF_STATE_UNKNOWN'),
    ).toBe(true);
  });

  it('escalates instead of destroying data when the wallet is empty', () => {
    const r = decide(
      observation({ runwayDays: 1, walletUsdfc: 0n, datasets: [healthy] }),
    );
    expect(r.decisions.some((d) => d.action === 'PRUNE_DATASET')).toBe(false);
    const blocked = r.decisions.find((d) => d.action === 'BLOCKED_NO_FUNDS');
    expect(blocked!.reasonCode).toBe('WALLET_EMPTY');
  });

  it('reports rather than silently failing when it has no gas', () => {
    const r = decide(observation({ runwayDays: 1, walletFil: 0n }));
    const blocked = r.decisions.find((d) => d.action === 'BLOCKED_NO_FUNDS');
    expect(blocked!.reasonCode).toBe('NO_GAS');
  });
});

describe('every decision carries auditable evidence', () => {
  it('attaches evidence to all decisions in every tier', () => {
    for (const days of [30, 7, 1]) {
      for (const d of decide(observation({ runwayDays: days })).decisions) {
        expect(Object.keys(d.evidence).length).toBeGreaterThan(0);
        expect(d.rationale.length).toBeGreaterThan(40);
        expect(d.reasonCode).toMatch(/^[A-Z_]+$/);
      }
    }
  });
});
