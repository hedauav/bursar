import 'server-only';

import { TOKENS } from '@filoz/synapse-sdk';
import { calibration } from '@filoz/synapse-core/chains';

import { MAX_UINT256, epochsToDays } from './config';
import { getSynapse } from './synapse';
import type { AgentObservation, DatasetObservation } from './types';

/**
 * Read the agent's complete financial and storage position from chain.
 *
 * This function makes no decisions. Observation and policy are deliberately
 * separated so that what the agent *saw* and what it *concluded* stay
 * independently auditable.
 */
export async function observe(): Promise<AgentObservation> {
  const synapse = getSynapse();
  const warnings: string[] = [];
  const address = synapse.client.account.address;

  const [summary, filBalance, usdfcBalance] = await Promise.all([
    synapse.payments.accountSummary(),
    synapse.payments.walletBalance({ token: TOKENS.FIL }),
    synapse.payments.walletBalance({ token: TOKENS.USDFC }),
  ]);

  const runwayIsInfinite = summary.runwayInEpochs >= MAX_UINT256 / 2n;

  // Operator approval: without it Warm Storage cannot charge the account at all,
  // which would make a "healthy" runway misleading.
  let approval: AgentObservation['approval'] = null;
  try {
    const a = await synapse.payments.serviceApproval();
    approval = {
      isApproved: a.isApproved,
      rateAllowance: a.rateAllowance.toString(),
      lockupAllowance: a.lockupAllowance.toString(),
      rateUsage: a.rateUsage.toString(),
      lockupUsage: a.lockupUsage.toString(),
      maxLockupPeriod: a.maxLockupPeriod.toString(),
    };
  } catch (e) {
    warnings.push(`serviceApproval() failed: ${errMsg(e)}`);
  }

  let pricing: AgentObservation['pricing'] = null;
  try {
    const info = await synapse.storage.getStorageInfo();
    pricing = {
      perTiBPerMonth: info.pricing.noCDN.perTiBPerMonth.toString(),
      perTiBPerEpoch: info.pricing.noCDN.perTiBPerEpoch.toString(),
      epochsPerMonth: info.serviceParameters.epochsPerMonth.toString(),
      epochDuration: info.serviceParameters.epochDuration,
    };
  } catch (e) {
    warnings.push(`getStorageInfo() failed: ${errMsg(e)}`);
  }

  const datasets = await observeDatasets(summary.epoch, warnings);

  return {
    observedAt: new Date().toISOString(),
    address,
    chainId: synapse.chain.id,
    epoch: summary.epoch.toString(),
    pay: {
      funds: summary.funds.toString(),
      availableFunds: summary.availableFunds.toString(),
      debt: summary.debt.toString(),
      lockupRatePerEpoch: summary.lockupRatePerEpoch.toString(),
      lockupRatePerMonth: summary.lockupRatePerMonth.toString(),
      totalLockup: summary.totalLockup.toString(),
      totalFixedLockup: summary.totalFixedLockup.toString(),
      totalRateBasedLockup: summary.totalRateBasedLockup.toString(),
      runwayInEpochs: summary.runwayInEpochs.toString(),
      grossCoverageInEpochs: summary.grossCoverageInEpochs.toString(),
      runwayIsInfinite,
      runwayDays: runwayIsInfinite ? null : epochsToDays(summary.runwayInEpochs),
    },
    wallet: { fil: filBalance.toString(), usdfc: usdfcBalance.toString() },
    approval,
    pricing,
    datasets,
    warnings,
  };
}

/**
 * For each dataset the agent pays for, read whether the provider is actually
 * proving possession.
 *
 * These are recorded facts, not inferences: FWSS records `provenThisPeriod` and
 * `provingDeadline`, and PDPVerifier records `getDataSetLastProvenEpoch`. A
 * provider past its deadline with the period still unproven is taking money for
 * work it has not done — which is what the RED-tier policy acts on.
 */
async function observeDatasets(
  currentEpoch: bigint,
  warnings: string[],
): Promise<DatasetObservation[]> {
  const synapse = getSynapse();

  let sets;
  try {
    sets = await synapse.storage.findDataSets();
  } catch (e) {
    warnings.push(`findDataSets() failed: ${errMsg(e)}`);
    return [];
  }

  const client = synapse.readClient;
  const fwssView = calibration.contracts.fwssView;
  const pdp = calibration.contracts.pdp;
  const genesis = synapse.chain.genesisTimestamp;

  return Promise.all(
    sets.map(async (ds): Promise<DatasetObservation> => {
      const id = ds.pdpVerifierDataSetId;
      const proof: DatasetObservation['proof'] = {
        provenThisPeriod: false,
        provingDeadlineEpoch: null,
        lastProvenEpoch: null,
        lastProvenAt: null,
        nextChallengeEpoch: null,
        isProofOverdue: false,
        epochsOverdue: '0',
        dataSetLive: false,
      };

      try {
        const [live, provenThisPeriod, deadline, lastProven, nextChallenge] =
          await Promise.all([
            client.readContract({
              address: pdp.address,
              abi: pdp.abi,
              functionName: 'dataSetLive',
              args: [id],
            }) as Promise<boolean>,
            client.readContract({
              address: fwssView.address,
              abi: fwssView.abi,
              functionName: 'provenThisPeriod',
              args: [id],
            }) as Promise<boolean>,
            client.readContract({
              address: fwssView.address,
              abi: fwssView.abi,
              functionName: 'provingDeadline',
              args: [id],
            }) as Promise<bigint>,
            client.readContract({
              address: pdp.address,
              abi: pdp.abi,
              functionName: 'getDataSetLastProvenEpoch',
              args: [id],
            }) as Promise<bigint>,
            client.readContract({
              address: pdp.address,
              abi: pdp.abi,
              functionName: 'getNextChallengeEpoch',
              args: [id],
            }) as Promise<bigint>,
          ]);

        proof.dataSetLive = live;
        proof.provenThisPeriod = provenThisPeriod;
        proof.nextChallengeEpoch = nextChallenge.toString();

        if (lastProven > 0n) {
          proof.lastProvenEpoch = lastProven.toString();
          proof.lastProvenAt = new Date(
            (genesis + Number(lastProven) * 30) * 1000,
          ).toISOString();
        }

        if (deadline > 0n) {
          proof.provingDeadlineEpoch = deadline.toString();
          // Overdue requires BOTH: the deadline passed and the period unproven.
          // A provider that already proved this period is fine even past the line.
          if (currentEpoch > deadline && !provenThisPeriod) {
            proof.isProofOverdue = true;
            proof.epochsOverdue = (currentEpoch - deadline).toString();
          }
        }
      } catch (e) {
        // Unknown proof state must never read as "delinquent" — otherwise the
        // agent would cut storage on an RPC hiccup.
        proof.error = errMsg(e);
        warnings.push(`PDP read failed for dataset ${id}: ${errMsg(e)}`);
      }

      return {
        dataSetId: ds.dataSetId.toString(),
        pdpVerifierDataSetId: id.toString(),
        providerId: ds.providerId.toString(),
        serviceProvider: ds.serviceProvider,
        isLive: ds.isLive,
        hasActivePieces: ds.hasActivePieces,
        withCDN: ds.withCDN,
        metadata: ds.metadata,
        pdpRailId: ds.pdpRailId.toString(),
        lifecycleReserveBalance: ds.lifecycleReserveBalance.toString(),
        proof,
      };
    }),
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
