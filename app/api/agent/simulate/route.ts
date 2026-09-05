import { NextResponse } from 'next/server';

import { observe } from '@/lib/agent/observe';
import { decide } from '@/lib/agent/policy';
import type { AgentObservation } from '@/lib/agent/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Run the REAL policy function against a modified copy of the REAL observation.
 *
 * This exists because some branches of the policy depend on conditions we cannot
 * conjure on demand - a storage provider actually missing its PDP deadline, for
 * instance. Rather than fake on-chain state, this endpoint takes the genuine
 * live observation, perturbs one field, and shows what the same deterministic
 * decision function produces. Nothing is executed and no transaction is sent.
 */
const SCENARIOS = {
  live: 'The unmodified on-chain observation.',
  'provider-delinquent':
    'Live state, except the first provider is past its PDP proving deadline. Shows how the agent triages when a provider stops earning its payment.',
  'runway-critical':
    'Live state, except runway is forced to 1 day. Shows the RED-tier branch.',
  'critical-and-delinquent':
    'Runway at 1 day AND the first provider not proving - the case the agent was built for: cut what is not being proven, fund what is.',
  'wallet-empty':
    'Runway at 1 day with an empty wallet. Shows the agent escalating instead of destroying data it cannot pay for.',
} as const;

type Scenario = keyof typeof SCENARIOS;

function perturb(obs: AgentObservation, scenario: Scenario): AgentObservation {
  const next: AgentObservation = structuredClone(obs);
  const oneDayEpochs = 2880n;

  const makeCritical = () => {
    next.pay.runwayInEpochs = oneDayEpochs.toString();
    next.pay.runwayIsInfinite = false;
    next.pay.runwayDays = 1;
    // Keep the rate non-zero so the tier logic is exercised honestly.
    if (BigInt(next.pay.lockupRatePerEpoch) === 0n) {
      next.pay.lockupRatePerEpoch = '2777777792776';
      next.pay.lockupRatePerMonth = '240000001295000000';
    }
    const rate = BigInt(next.pay.lockupRatePerEpoch);
    next.pay.availableFunds = (rate * oneDayEpochs).toString();
  };

  const makeDelinquent = () => {
    const d = next.datasets[0];
    if (!d) return;
    d.proof.isProofOverdue = true;
    d.proof.provenThisPeriod = false;
    d.proof.epochsOverdue = '312';
    d.proof.error = undefined;
  };

  switch (scenario) {
    case 'provider-delinquent':
      makeDelinquent();
      break;
    case 'runway-critical':
      makeCritical();
      break;
    case 'critical-and-delinquent':
      makeCritical();
      makeDelinquent();
      break;
    case 'wallet-empty':
      makeCritical();
      next.wallet.usdfc = '0';
      break;
    case 'live':
    default:
      break;
  }
  return next;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scenario = (url.searchParams.get('scenario') ?? 'live') as Scenario;
  if (!(scenario in SCENARIOS)) {
    return NextResponse.json(
      { error: `unknown scenario. one of: ${Object.keys(SCENARIOS).join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const live = await observe();
    const observation = perturb(live, scenario);
    const policy = decide(observation);
    return NextResponse.json({
      scenario,
      description: SCENARIOS[scenario],
      projection: true,
      note: 'Policy run against a modified copy of live on-chain state. No transaction was sent.',
      observation,
      policy,
      scenarios: SCENARIOS,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
