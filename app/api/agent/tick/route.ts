import { NextResponse } from 'next/server';

import { runTick } from '@/lib/agent/tick';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Run one agent cycle on demand. Left open on Calibration testnet so a judge can
 * trigger a decision from the dashboard and watch it settle on chain.
 */
export async function POST(request: Request) {
  try {
    let dryRun = false;
    try {
      const body = await request.json();
      dryRun = Boolean(body?.dryRun);
    } catch {
      // Empty body is fine.
    }
    const tick = await runTick({ trigger: 'manual', dryRun });
    return NextResponse.json(tick);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
