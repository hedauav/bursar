import { NextResponse } from 'next/server';

import { observe } from '@/lib/agent/observe';
import { decide } from '@/lib/agent/policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live read of the agent's on-chain position plus what the policy WOULD do,
 * without executing anything. This is the endpoint the dashboard polls, so a
 * judge can watch the tier flip in real time before any transaction fires.
 */
export async function GET() {
  try {
    const observation = await observe();
    const policy = decide(observation);
    return NextResponse.json({ observation, policy });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
