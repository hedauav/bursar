import 'server-only';

import { formatRunway } from './config';
import type { AgentObservation, ExecutedDecision, Tier } from './types';

/**
 * An LLM explains the tick in plain English.
 *
 * Strictly presentation. The policy engine has already decided and acted by the
 * time this runs, and its output is never fed back into the decision path - so a
 * slow, unavailable, or plain wrong model can degrade the explanation but can
 * never change what the agent did with real money.
 *
 * Groq is used by default (OpenAI-compatible); Anthropic is supported as a
 * fallback if that key is present instead.
 */

const SYSTEM_PROMPT =
  'You are the reporting voice of an autonomous storage-budget agent on Filecoin. ' +
  "You are given the agent's on-chain observation and the decisions it ALREADY made and executed. " +
  'Write 2-4 sentences, first person ("I"), explaining what you noticed, what you concluded, and what you did about it. ' +
  'Be concrete: cite the runway in days, the USDFC amounts, and any provider that stopped proving. ' +
  'Never invent a number that is not in the data. Never claim an action succeeded if its status is FAILED or NOOP. ' +
  'No preamble, no markdown, no bullet points, no headings.';

export async function narrate(
  tier: Tier,
  tierReason: string,
  obs: AgentObservation,
  decisions: ExecutedDecision[],
): Promise<string | undefined> {
  const facts = buildFacts(tier, tierReason, obs, decisions);

  if (process.env.GROQ_API_KEY) return narrateGroq(facts);
  if (process.env.ANTHROPIC_API_KEY) return narrateAnthropic(facts);
  return undefined;
}

function buildFacts(
  tier: Tier,
  tierReason: string,
  obs: AgentObservation,
  decisions: ExecutedDecision[],
) {
  return {
    tier,
    tierReason,
    runway: formatRunway(BigInt(obs.pay.runwayInEpochs)),
    runwayDays: obs.pay.runwayDays,
    epoch: obs.epoch,
    fundsInPayUsdfc: fmt(obs.pay.funds),
    availableFundsUsdfc: fmt(obs.pay.availableFunds),
    debtUsdfc: fmt(obs.pay.debt),
    burnPerMonthUsdfc: fmt(obs.pay.lockupRatePerMonth),
    walletUsdfc: fmt(obs.wallet.usdfc),
    walletFil: fmt(obs.wallet.fil),
    datasets: obs.datasets.map((d) => ({
      id: d.pdpVerifierDataSetId,
      provider: d.providerId,
      live: d.isLive,
      provenThisPeriod: d.proof.provenThisPeriod,
      isProofOverdue: d.proof.isProofOverdue,
      epochsOverdue: d.proof.epochsOverdue,
      lastProvenAt: d.proof.lastProvenAt,
    })),
    decisions: decisions.map((d) => ({
      action: d.action,
      reasonCode: d.reasonCode,
      rationale: d.rationale,
      status: d.status,
      amountUsdfc: d.amount ? fmt(d.amount) : undefined,
      txHash: d.txHash,
      error: d.error,
    })),
  };
}

/** 18-decimal string -> readable number, so the model never sees raw wei. */
function fmt(v: string): string {
  return (Number(v) / 1e18).toFixed(6);
}

async function narrateGroq(facts: unknown): Promise<string | undefined> {
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(facts, null, 2) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.warn(`[narrate] groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return undefined;
    }
    const json = await res.json();
    const text: string | undefined = json?.choices?.[0]?.message?.content;
    return text?.trim() || undefined;
  } catch (e) {
    console.warn('[narrate] groq failed:', e instanceof Error ? e.message : e);
    return undefined;
  }
}

async function narrateAnthropic(facts: unknown): Promise<string | undefined> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(facts, null, 2) }],
    });
    const text = msg.content
      .filter((b): b is { type: 'text'; text: string; citations: never } =>
        b.type === 'text',
      )
      .map((b) => b.text)
      .join('')
      .trim();
    return text || undefined;
  } catch (e) {
    console.warn('[narrate] anthropic failed:', e instanceof Error ? e.message : e);
    return undefined;
  }
}
