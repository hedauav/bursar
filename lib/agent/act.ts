import 'server-only';

import { EXPLORER_TX } from './config';
import { getSynapse } from './synapse';
import type { Decision, ExecutedDecision } from './types';

/**
 * Execute the decisions the policy produced.
 *
 * Every branch here maps one decision to one real on-chain transaction. Nothing
 * is simulated: TOP_UP deposits USDFC into Filecoin Pay, PRUNE_DATASET
 * terminates a Warm Storage rail. Failures are recorded on the decision rather
 * than thrown, so one bad action cannot hide the rest of the agent's reasoning.
 */
export async function execute(
  decisions: Decision[],
  opts: { dryRun?: boolean } = {},
): Promise<ExecutedDecision[]> {
  const out: ExecutedDecision[] = [];
  for (const d of decisions) {
    out.push(await executeOne(d, opts.dryRun ?? false));
  }
  return out;
}

async function executeOne(
  decision: Decision,
  dryRun: boolean,
): Promise<ExecutedDecision> {
  const base = { ...decision, executedAt: new Date().toISOString() };

  // HOLD and BLOCKED are conclusions, not transactions. They still belong in the
  // journal — "decided to do nothing, here is why" is a real decision.
  if (decision.action === 'HOLD' || decision.action === 'BLOCKED_NO_FUNDS') {
    return { ...base, status: 'NOOP' };
  }

  if (dryRun) {
    return { ...base, status: 'SKIPPED_DRY_RUN' };
  }

  const synapse = getSynapse();

  try {
    switch (decision.action) {
      case 'TOP_UP': {
        if (!decision.amount) throw new Error('TOP_UP decision carried no amount');
        const amount = BigInt(decision.amount);

        // Single transaction: EIP-2612 permit + deposit, no separate approve.
        const hash = await synapse.payments.depositWithPermit({ amount });
        await synapse.client.waitForTransactionReceipt({ hash });

        return {
          ...base,
          status: 'SUCCESS',
          txHash: hash,
          explorerUrl: EXPLORER_TX(hash),
        };
      }

      case 'APPROVE_SERVICE': {
        const hash = await synapse.payments.approveService();
        await synapse.client.waitForTransactionReceipt({ hash });
        return {
          ...base,
          status: 'SUCCESS',
          txHash: hash,
          explorerUrl: EXPLORER_TX(hash),
        };
      }

      case 'PRUNE_DATASET': {
        if (!decision.dataSetId) {
          throw new Error('PRUNE_DATASET decision carried no dataSetId');
        }
        const result = await synapse.storage.terminateService({
          dataSetId: BigInt(decision.dataSetId),
        });
        const hash = result.confirmedTxHash ?? result.txHash;
        return {
          ...base,
          status: 'SUCCESS',
          txHash: hash,
          explorerUrl: hash ? EXPLORER_TX(hash) : undefined,
        };
      }

      default:
        return { ...base, status: 'NOOP' };
    }
  } catch (e) {
    return {
      ...base,
      status: 'FAILED',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
