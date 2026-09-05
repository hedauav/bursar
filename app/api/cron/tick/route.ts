import { NextResponse } from 'next/server';

import { runTick } from '@/lib/agent/tick';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The autonomy entry point. Vercel Cron calls this on a schedule with no human
 * involved: the agent wakes up, reads its own balance, and transacts if its
 * policy says it should.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  try {
    const tick = await runTick({ trigger: 'cron' });
    return NextResponse.json({
      id: tick.id,
      tier: tick.tier,
      decisions: tick.decisions.map((d) => ({
        action: d.action,
        reasonCode: d.reasonCode,
        status: d.status,
        txHash: d.txHash,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
