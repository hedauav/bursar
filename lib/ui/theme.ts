/**
 * Tier / action / status visual vocabulary.
 *
 * Class strings are written out in full (never composed at runtime) so Tailwind
 * v4's source scanner can see them.
 */

import type { ActionKind, ExecutionStatus, Tier } from '@/lib/agent/types';

export interface TierStyle {
  label: string;
  /** Short gloss shown next to the tier chip. */
  gloss: string;
  chip: string;
  text: string;
  bar: string;
  glow: string;
  ring: string;
}

export const TIER_STYLES: Record<Tier, TierStyle> = {
  GREEN: {
    label: 'GREEN',
    gloss: 'comfortable',
    chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    text: 'text-emerald-300',
    bar: 'bg-emerald-400',
    glow: 'shadow-[0_0_40px_-12px_rgba(16,185,129,0.7)]',
    ring: 'ring-emerald-500/30',
  },
  YELLOW: {
    label: 'YELLOW',
    gloss: 'top up calmly',
    chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    text: 'text-amber-300',
    bar: 'bg-amber-400',
    glow: 'shadow-[0_0_40px_-12px_rgba(245,158,11,0.7)]',
    ring: 'ring-amber-500/30',
  },
  RED: {
    label: 'RED',
    gloss: 'triage on proof',
    chip: 'border-red-500/40 bg-red-500/10 text-red-300',
    text: 'text-red-300',
    bar: 'bg-red-500',
    glow: 'shadow-[0_0_40px_-12px_rgba(239,68,68,0.8)]',
    ring: 'ring-red-500/30',
  },
  DEFICIT: {
    label: 'DEFICIT',
    gloss: 'payments halted',
    chip: 'border-rose-600/50 bg-rose-700/20 text-rose-200 animate-pulse-soft',
    text: 'text-rose-300',
    bar: 'bg-rose-600 animate-pulse-soft',
    glow: 'shadow-[0_0_50px_-10px_rgba(190,18,60,0.9)]',
    ring: 'ring-rose-600/40',
  },
  IDLE: {
    label: 'IDLE',
    gloss: 'no active spend',
    chip: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
    text: 'text-slate-300',
    bar: 'bg-slate-400',
    glow: '',
    ring: 'ring-slate-500/30',
  },
  UNFUNDED: {
    label: 'UNFUNDED',
    gloss: 'nothing to manage',
    chip: 'border-slate-600/40 bg-slate-600/10 text-slate-400',
    text: 'text-slate-400',
    bar: 'bg-slate-600',
    glow: '',
    ring: 'ring-slate-600/30',
  },
};

export const UNKNOWN_TIER_STYLE: TierStyle = {
  label: 'UNKNOWN',
  gloss: 'not observed yet',
  chip: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
  text: 'text-zinc-400',
  bar: 'bg-zinc-600',
  glow: '',
  ring: 'ring-zinc-700',
};

export function tierStyle(tier: Tier | null | undefined): TierStyle {
  if (!tier) return UNKNOWN_TIER_STYLE;
  return TIER_STYLES[tier] ?? UNKNOWN_TIER_STYLE;
}

export interface ActionStyle {
  label: string;
  chip: string;
  accent: string;
}

export const ACTION_STYLES: Record<ActionKind, ActionStyle> = {
  HOLD: {
    label: 'HOLD',
    chip: 'border-zinc-600 bg-zinc-700/40 text-zinc-200',
    accent: 'border-l-zinc-600',
  },
  TOP_UP: {
    label: 'TOP UP',
    chip: 'border-sky-500/50 bg-sky-500/15 text-sky-200',
    accent: 'border-l-sky-500',
  },
  PRUNE_DATASET: {
    label: 'PRUNE DATASET',
    chip: 'border-red-500/50 bg-red-500/15 text-red-200',
    accent: 'border-l-red-500',
  },
  BLOCKED_NO_FUNDS: {
    label: 'BLOCKED — NO FUNDS',
    chip: 'border-amber-500/50 bg-amber-500/15 text-amber-200',
    accent: 'border-l-amber-500',
  },
  APPROVE_SERVICE: {
    label: 'APPROVE SERVICE',
    chip: 'border-violet-500/50 bg-violet-500/15 text-violet-200',
    accent: 'border-l-violet-500',
  },
};

export const UNKNOWN_ACTION_STYLE: ActionStyle = {
  label: 'ACTION',
  chip: 'border-zinc-600 bg-zinc-700/40 text-zinc-200',
  accent: 'border-l-zinc-600',
};

export function actionStyle(action: ActionKind | string): ActionStyle {
  return ACTION_STYLES[action as ActionKind] ?? UNKNOWN_ACTION_STYLE;
}

export interface StatusStyle {
  label: string;
  chip: string;
}

export const STATUS_STYLES: Record<ExecutionStatus, StatusStyle> = {
  SUCCESS: {
    label: 'executed',
    chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  FAILED: {
    label: 'failed',
    chip: 'border-red-500/40 bg-red-500/10 text-red-300',
  },
  SKIPPED_DRY_RUN: {
    label: 'dry run',
    chip: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  },
  NOOP: {
    label: 'no-op',
    chip: 'border-zinc-600 bg-zinc-800/60 text-zinc-400',
  },
};

export function statusStyle(status: ExecutionStatus | string | undefined): StatusStyle | null {
  if (!status) return null;
  return (
    STATUS_STYLES[status as ExecutionStatus] ?? {
      label: String(status).toLowerCase(),
      chip: 'border-zinc-600 bg-zinc-800/60 text-zinc-400',
    }
  );
}
