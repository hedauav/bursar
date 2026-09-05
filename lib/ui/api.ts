/**
 * Client-side view of the agent HTTP surface.
 *
 * Types are re-used from lib/agent/types (type-only import, so nothing
 * server-side is pulled into the bundle). Every call is defensive: the routes
 * do real chain reads, so they can be slow or fail, and the dashboard has to
 * show that rather than blank out.
 */

import type { AgentObservation, Decision, TickRecord, Tier } from '@/lib/agent/types';

export interface PolicyPreview {
  tier: Tier;
  tierReason: string;
  decisions: Decision[];
}

export interface AgentState {
  observation: AgentObservation;
  policy: PolicyPreview;
}

export interface JournalResponse {
  ticks: TickRecord[];
}

async function readErrorBody(res: Response): Promise<string> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    /* body unreadable - fall through to the status line */
  }
  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        const rec = parsed as Record<string, unknown>;
        const msg = rec.error ?? rec.message ?? rec.detail;
        if (typeof msg === 'string' && msg.trim()) return msg;
      }
    } catch {
      /* not JSON - show the raw text */
    }
    return text.slice(0, 400);
  }
  return `${res.status} ${res.statusText || 'Request failed'}`;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, { cache: 'no-store', ...init });
  } catch (err) {
    throw new Error(
      `Could not reach ${input} — ${err instanceof Error ? err.message : 'network error'}`,
    );
  }
  if (!res.ok) {
    throw new Error(`${input} responded ${res.status}: ${await readErrorBody(res)}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${input} returned a non-JSON response`);
  }
}

export function fetchAgentState(signal?: AbortSignal): Promise<AgentState> {
  return request<AgentState>('/api/agent/state', { signal });
}

export function fetchJournal(signal?: AbortSignal): Promise<JournalResponse> {
  return request<JournalResponse>('/api/agent/journal', { signal });
}

export function runTick(signal?: AbortSignal): Promise<TickRecord> {
  return request<TickRecord>('/api/agent/tick', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal,
  });
}

/**
 * A what-if run: the REAL policy function against a perturbed copy of the REAL
 * observation. Read-only — nothing is executed.
 */
export interface SimulationResponse {
  scenario: string;
  description: string;
  projection: boolean;
  note: string;
  observation: AgentObservation;
  policy: PolicyPreview;
  scenarios: Record<string, string>;
}

export function fetchSimulation(
  scenario: string,
  signal?: AbortSignal,
): Promise<SimulationResponse> {
  return request<SimulationResponse>(
    `/api/agent/simulate?scenario=${encodeURIComponent(scenario)}`,
    { signal },
  );
}

/** The one human action in the demo: withdraw spare funds to force a real crisis. */
export interface SqueezeResponse {
  withdrawn?: string;
  targetDays?: number;
  txHash?: string;
  explorerUrl?: string;
  runwayDaysBefore?: number | null;
  message?: string;
  skipped?: boolean;
}

export function runSqueeze(targetDays: number, signal?: AbortSignal): Promise<SqueezeResponse> {
  return request<SqueezeResponse>('/api/demo/squeeze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetDays }),
    signal,
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}
