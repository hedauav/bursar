/**
 * The decision engine.
 *
 * Pure and synchronous: same observation in, same decisions out. No network, no
 * clock, no randomness. That is deliberate - the autonomous behaviour that gets
 * judged here should be reproducible and unit-testable, and the LLM narration
 * layer must never be able to change what the agent actually does.
 */

import {
  EPOCHS_PER_DAY,
  MIN_TOPUP_USDFC,
  TIER_THRESHOLDS,
  TOPUP_TARGET_DAYS,
} from './config';
import type { AgentObservation, Decision, Tier } from './types';

export interface PolicyResult {
  tier: Tier;
  tierReason: string;
  decisions: Decision[];
}

export function decide(obs: AgentObservation): PolicyResult {
  const lockupRate = BigInt(obs.pay.lockupRatePerEpoch);
  const availableFunds = BigInt(obs.pay.availableFunds);
  const debt = BigInt(obs.pay.debt);
  const walletUsdfc = BigInt(obs.wallet.usdfc);
  const walletFil = BigInt(obs.wallet.fil);
  const runwayEpochs = BigInt(obs.pay.runwayInEpochs);

  const { tier, tierReason } = classify(obs, lockupRate, debt, runwayEpochs);

  const decisions: Decision[] = [];

  // Gas is a hard precondition for every corrective action. Say so up front
  // rather than letting each action fail separately on chain.
  const hasGas = walletFil > 0n;

  // --- Tiers that need no intervention ------------------------------------

  if (tier === 'IDLE' || tier === 'GREEN') {
    decisions.push({
      action: 'HOLD',
      reasonCode: tier === 'IDLE' ? 'NO_ACTIVE_SPEND' : 'RUNWAY_COMFORTABLE',
      rationale:
        tier === 'IDLE'
          ? 'No storage rail is draining the account, so runway is unbounded. Nothing to fund and nothing to cut.'
          : `Runway of ${fmtDays(obs.pay.runwayDays)} is above the ${TIER_THRESHOLDS.greenAboveDays}-day green threshold. Topping up now would lock funds earlier than necessary.`,
      evidence: {
        runwayDays: obs.pay.runwayDays,
        greenThresholdDays: TIER_THRESHOLDS.greenAboveDays,
        lockupRatePerEpoch: obs.pay.lockupRatePerEpoch,
        datasets: obs.datasets.length,
      },
    });
    return { tier, tierReason, decisions };
  }

  if (tier === 'UNFUNDED') {
    decisions.push({
      action: 'BLOCKED_NO_FUNDS',
      reasonCode: 'NOTHING_TO_MANAGE',
      rationale:
        'The account holds no funds, has no USDFC to deposit, and pays for no datasets. There is no budget to manage yet.',
      evidence: {
        funds: obs.pay.funds,
        walletUsdfc: obs.wallet.usdfc,
        walletFil: obs.wallet.fil,
        datasets: obs.datasets.length,
      },
    });
    return { tier, tierReason, decisions };
  }

  // --- YELLOW: pre-emptive top-up, no triage ------------------------------

  if (tier === 'YELLOW') {
    const topUp = planTopUp(lockupRate, availableFunds, debt, walletUsdfc);
    if (topUp.amount > 0n && hasGas) {
      decisions.push({
        action: 'TOP_UP',
        reasonCode: 'PREEMPTIVE_TOPUP',
        rationale: `Runway fell to ${fmtDays(obs.pay.runwayDays)}, under the ${TIER_THRESHOLDS.greenAboveDays}-day green threshold but not yet critical. Depositing ${fmtUsdfc(topUp.amount)} USDFC now restores roughly ${TOPUP_TARGET_DAYS} days while every provider is still proving, so no data has to be cut.`,
        amount: topUp.amount.toString(),
        evidence: {
          runwayDays: obs.pay.runwayDays,
          targetDays: TOPUP_TARGET_DAYS,
          requiredForTarget: topUp.required.toString(),
          walletUsdfc: obs.wallet.usdfc,
          cappedByWallet: topUp.cappedByWallet,
        },
      });
    } else {
      decisions.push(
        blockedTopUp(obs, topUp.required, walletUsdfc, hasGas, 'YELLOW'),
      );
    }
    return { tier, tierReason, decisions };
  }

  // --- RED / DEFICIT: triage on proof, then fund only what earned it -------

  // A provider past its PDP proving deadline is charging for work it is not
  // doing. When money is tight that is the first thing to cut - and cutting it
  // is also what makes the remaining top-up affordable.
  const delinquent = obs.datasets.filter(
    (d) => d.proof.isProofOverdue && !d.proof.error && d.isLive,
  );
  const provingOk = obs.datasets.filter(
    (d) => !d.proof.isProofOverdue && d.isLive && !d.proof.error,
  );
  const unknown = obs.datasets.filter((d) => d.proof.error);

  for (const d of delinquent) {
    decisions.push({
      action: 'PRUNE_DATASET',
      reasonCode: 'PROVIDER_NOT_PROVING',
      rationale: `Provider ${d.providerId} is ${d.proof.epochsOverdue} epochs past the PDP proving deadline for dataset ${d.pdpVerifierDataSetId} and runway is down to ${fmtDays(obs.pay.runwayDays)}. It is taking payment for possession it has not proven, so the agent terminates this rail instead of funding it.`,
      dataSetId: d.dataSetId,
      evidence: {
        pdpVerifierDataSetId: d.pdpVerifierDataSetId,
        providerId: d.providerId,
        provingDeadlineEpoch: d.proof.provingDeadlineEpoch,
        currentEpoch: obs.epoch,
        epochsOverdue: d.proof.epochsOverdue,
        runwayDays: obs.pay.runwayDays,
      },
    });
  }

  for (const d of unknown) {
    decisions.push({
      action: 'HOLD',
      reasonCode: 'PROOF_STATE_UNKNOWN',
      rationale: `Proof state for dataset ${d.pdpVerifierDataSetId} could not be read this tick. The agent will not terminate storage on missing evidence, so this dataset is left funded and re-checked next tick.`,
      dataSetId: d.dataSetId,
      evidence: {
        pdpVerifierDataSetId: d.pdpVerifierDataSetId,
        error: d.proof.error ?? null,
      },
    });
  }

  // Fund what is left. Pruning above reduces the rate, but the on-chain rate
  // only drops once the terminate lands, so size the top-up on what remains.
  const knownCount = obs.datasets.length - unknown.length;
  const survivingShare =
    knownCount <= 0 ? 1 : provingOk.length / knownCount;
  const projectedRate =
    delinquent.length > 0
      ? (lockupRate * BigInt(Math.round(survivingShare * 1000))) / 1000n
      : lockupRate;

  const topUp = planTopUp(projectedRate, availableFunds, debt, walletUsdfc);

  if (topUp.amount > 0n && hasGas) {
    decisions.push({
      action: 'TOP_UP',
      reasonCode:
        tier === 'DEFICIT' ? 'DEFICIT_RECOVERY' : 'CRITICAL_TOPUP_PROVEN_ONLY',
      rationale:
        tier === 'DEFICIT'
          ? `The account is in deficit by ${fmtUsdfc(debt)} USDFC - settlement to providers has already halted. Depositing ${fmtUsdfc(topUp.amount)} USDFC clears the debt and restarts payment for the ${provingOk.length} dataset(s) still proving.`
          : `Runway is ${fmtDays(obs.pay.runwayDays)}, below the ${TIER_THRESHOLDS.yellowAboveDays}-day red threshold. ${provingOk.length} dataset(s) are proving on schedule and are worth keeping, so the agent deposits ${fmtUsdfc(topUp.amount)} USDFC to extend them${delinquent.length > 0 ? `, while dropping ${delinquent.length} that stopped proving` : ''}.`,
      amount: topUp.amount.toString(),
      evidence: {
        tier,
        runwayDays: obs.pay.runwayDays,
        debt: obs.pay.debt,
        provingDatasets: provingOk.length,
        prunedDatasets: delinquent.length,
        requiredForTarget: topUp.required.toString(),
        walletUsdfc: obs.wallet.usdfc,
        cappedByWallet: topUp.cappedByWallet,
      },
    });
  } else if (delinquent.length === 0) {
    // Nothing to cut and nothing to spend - the genuinely stuck case.
    decisions.push(blockedTopUp(obs, topUp.required, walletUsdfc, hasGas, tier));
  }

  return { tier, tierReason, decisions };
}

// --- helpers --------------------------------------------------------------

function classify(
  obs: AgentObservation,
  lockupRate: bigint,
  debt: bigint,
  runwayEpochs: bigint,
): { tier: Tier; tierReason: string } {
  const funds = BigInt(obs.pay.funds);
  const walletUsdfc = BigInt(obs.wallet.usdfc);

  if (debt > 0n) {
    return {
      tier: 'DEFICIT',
      tierReason: `Account owes ${fmtUsdfc(debt)} USDFC more than it holds. Payment flow to providers has halted and data is at risk now.`,
    };
  }

  if (lockupRate === 0n) {
    if (funds === 0n && walletUsdfc === 0n && obs.datasets.length === 0) {
      return {
        tier: 'UNFUNDED',
        tierReason:
          'No funds, no USDFC to deposit, and no datasets. The agent has nothing to manage.',
      };
    }
    return {
      tier: 'IDLE',
      tierReason:
        'No payment rail is draining the account (lockup rate is zero), so runway is unbounded.',
    };
  }

  if (runwayEpochs === 0n) {
    return {
      tier: 'DEFICIT',
      tierReason:
        'Runway has reached zero: the account can no longer cover its committed rate.',
    };
  }

  const days = Number(runwayEpochs) / EPOCHS_PER_DAY;
  if (days > TIER_THRESHOLDS.greenAboveDays) {
    return {
      tier: 'GREEN',
      tierReason: `${days.toFixed(1)} days of runway, above the ${TIER_THRESHOLDS.greenAboveDays}-day comfort threshold.`,
    };
  }
  if (days > TIER_THRESHOLDS.yellowAboveDays) {
    return {
      tier: 'YELLOW',
      tierReason: `${days.toFixed(1)} days of runway, between the ${TIER_THRESHOLDS.yellowAboveDays}- and ${TIER_THRESHOLDS.greenAboveDays}-day thresholds. Time to top up calmly.`,
    };
  }
  return {
    tier: 'RED',
    tierReason: `${days.toFixed(1)} days of runway, at or below the ${TIER_THRESHOLDS.yellowAboveDays}-day critical threshold. Every remaining USDFC has to be justified.`,
  };
}

/** How much USDFC restores TOPUP_TARGET_DAYS of coverage, capped by the wallet. */
function planTopUp(
  rate: bigint,
  availableFunds: bigint,
  debt: bigint,
  walletUsdfc: bigint,
): { amount: bigint; required: bigint; cappedByWallet: boolean } {
  const targetEpochs = BigInt(Math.round(TOPUP_TARGET_DAYS * EPOCHS_PER_DAY));
  const targetFunds = rate * targetEpochs;
  const shortfall =
    targetFunds > availableFunds ? targetFunds - availableFunds : 0n;
  const required = shortfall + debt;

  if (required === 0n) return { amount: 0n, required, cappedByWallet: false };

  const cappedByWallet = required > walletUsdfc;
  let amount = cappedByWallet ? walletUsdfc : required;
  if (amount < MIN_TOPUP_USDFC) amount = 0n;
  return { amount, required, cappedByWallet };
}

function blockedTopUp(
  obs: AgentObservation,
  required: bigint,
  walletUsdfc: bigint,
  hasGas: boolean,
  tier: Tier,
): Decision {
  if (!hasGas) {
    return {
      action: 'BLOCKED_NO_FUNDS',
      reasonCode: 'NO_GAS',
      rationale: `Runway is ${fmtDays(obs.pay.runwayDays)} and a top-up is needed, but the wallet holds no tFIL to pay gas. The agent cannot transact and is reporting rather than silently failing.`,
      evidence: {
        walletFil: obs.wallet.fil,
        requiredUsdfc: required.toString(),
        tier,
      },
    };
  }
  if (required > 0n && walletUsdfc === 0n) {
    return {
      action: 'BLOCKED_NO_FUNDS',
      reasonCode: 'WALLET_EMPTY',
      rationale: `Runway is ${fmtDays(obs.pay.runwayDays)} and roughly ${fmtUsdfc(required)} USDFC is needed, but the wallet is empty. Every provider is still proving, so there is nothing the agent can justify cutting - it escalates instead of destroying data.`,
      evidence: { requiredUsdfc: required.toString(), walletUsdfc: '0', tier },
    };
  }
  return {
    action: 'HOLD',
    reasonCode: 'TOPUP_BELOW_DUST_THRESHOLD',
    rationale:
      'A top-up is indicated but the amount is below the minimum transaction threshold. The agent waits rather than burning gas on dust.',
    evidence: {
      requiredUsdfc: required.toString(),
      minTopUp: MIN_TOPUP_USDFC.toString(),
      tier,
    },
  };
}

function fmtDays(d: number | null): string {
  return d === null ? 'unbounded' : `${d.toFixed(1)} days`;
}

/** USDFC is 18dp. Short human form for rationale strings. */
function fmtUsdfc(v: bigint): string {
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n) / 10n ** 14n; // 4dp
  return `${whole}.${frac.toString().padStart(4, '0')}`;
}
