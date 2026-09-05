import 'server-only';

import { randomUUID } from 'node:crypto';

import { execute } from './act';
import { appendTick } from './journal';
import { narrate } from './narrate';
import { observe } from './observe';
import { decide } from './policy';
import type { TickRecord } from './types';

/**
 * One full agent cycle: observe -> decide -> act -> record -> explain.
 *
 * This is the loop that makes the thing autonomous. Nothing in it asks a human
 * anything; a cron hits it on a schedule and it transacts on its own judgement.
 */
export async function runTick(
  opts: { trigger?: TickRecord['trigger']; dryRun?: boolean } = {},
): Promise<TickRecord> {
  const startedAt = new Date();
  const trigger = opts.trigger ?? 'manual';

  const observation = await observe();
  const { tier, tierReason, decisions } = decide(observation);
  const executed = await execute(decisions, { dryRun: opts.dryRun });
  const narration = await narrate(tier, tierReason, observation, executed);

  const finishedAt = new Date();
  const tick: TickRecord = {
    id: randomUUID(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    trigger,
    tier,
    tierReason,
    observation,
    decisions: executed,
    narration,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };

  await appendTick(tick);
  return tick;
}
