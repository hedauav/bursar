import { NextResponse } from 'next/server';

import { EXPLORER_TX } from '@/lib/agent/config';
import { observe } from '@/lib/agent/observe';
import { getSynapse } from '@/lib/agent/synapse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Demo control: withdraw the agent's spare funds to create a real budget crisis.
 *
 * This is the ONE human action in the demo, and it is deliberately adversarial
 * rather than helpful - it takes money away. It exists so a judge can watch the
 * agent hit a genuine low-runway condition on chain and respond on its own,
 * instead of waiting days for funds to drain naturally.
 *
 * Everything the agent does in response is still entirely its own decision.
 */
export async function POST(request: Request) {
  try {
    let targetDays = 2;
    try {
      const body = await request.json();
      if (typeof body?.targetDays === 'number') targetDays = body.targetDays;
    } catch {
      // default
    }

    const synapse = getSynapse();
    const before = await observe();

    const rate = BigInt(before.pay.lockupRatePerEpoch);
    if (rate === 0n) {
      return NextResponse.json(
        {
          error:
            'No active payment rail, so runway is already unbounded. Run the storage bootstrap first.',
        },
        { status: 400 },
      );
    }

    const available = BigInt(before.pay.availableFunds);
    const keep = rate * BigInt(Math.max(0, Math.round(targetDays * 2880)));
    const amount = available > keep ? available - keep : 0n;

    if (amount === 0n) {
      return NextResponse.json({
        skipped: true,
        message: `Runway is already at or below ${targetDays} days; nothing to withdraw.`,
        runwayDaysBefore: before.pay.runwayDays,
      });
    }

    const hash = await synapse.payments.withdraw({ amount });
    await synapse.client.waitForTransactionReceipt({ hash });

    return NextResponse.json({
      withdrawn: amount.toString(),
      targetDays,
      txHash: hash,
      explorerUrl: EXPLORER_TX(hash),
      runwayDaysBefore: before.pay.runwayDays,
      message: `Withdrew ${(Number(amount) / 1e18).toFixed(4)} USDFC. The agent's runway just collapsed - watch what it decides next.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
