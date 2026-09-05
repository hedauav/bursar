/**
 * Agent configuration + policy thresholds.
 *
 * Everything the autonomous policy uses to make a call lives here so a judge can
 * read the rules in one place and predict what the agent will do.
 */

/** Filecoin epochs are 30s. 2 per minute, 120/hr, 2880/day. */
export const EPOCH_SECONDS = 30;
export const EPOCHS_PER_DAY = (24 * 60 * 60) / EPOCH_SECONDS; // 2880
export const EPOCHS_PER_HOUR = 3600 / EPOCH_SECONDS; // 120

/** Sentinel the Filecoin Pay contract returns for "nothing is being spent". */
export const MAX_UINT256 = (1n << 256n) - 1n;

/**
 * Runway tiers, in days of remaining coverage.
 *
 * GREEN  : comfortable, do nothing but keep watching.
 * YELLOW : getting close, top up pre-emptively while it's cheap and calm.
 * RED    : about to lose data. Top-ups are no longer unconditional --
 *          the agent first checks whether each provider is actually proving
 *          the data it's being paid for, and only funds the ones that are.
 */
export const TIER_THRESHOLDS = {
  /** Above this many days of runway => GREEN. */
  greenAboveDays: 10,
  /** Above this many days (and <= green) => YELLOW. At or below => RED. */
  yellowAboveDays: 3,
} as const;

export type Tier = 'GREEN' | 'YELLOW' | 'RED' | 'UNFUNDED' | 'IDLE';

/** How much runway the agent tries to restore when it decides to top up. */
export const TOPUP_TARGET_DAYS = 30;

/** Never send a top-up smaller than this (USDFC, 18dp) - avoids dust txs. */
export const MIN_TOPUP_USDFC = 100_000_000_000_000_000n; // 0.1 USDFC

/**
 * A provider that has not produced a PDP proof within this many epochs past its
 * due time is considered delinquent: the agent stops paying for that dataset
 * rather than topping up to fund a provider that isn't doing the work.
 */
export const PROOF_OVERDUE_GRACE_EPOCHS = 120n; // 1 hour

export const DEFAULT_RPC_URL = 'https://api.calibration.node.glif.io/rpc/v1';
export const EXPLORER_TX = (hash: string) =>
  `https://calibration.filfox.info/en/message/${hash}`;
export const EXPLORER_ADDRESS = (addr: string) =>
  `https://calibration.filfox.info/en/address/${addr}`;

export function epochsToDays(epochs: bigint): number {
  return Number(epochs) / EPOCHS_PER_DAY;
}

/** Human string for an epoch count, handling the infinite sentinel. */
export function formatRunway(epochs: bigint): string {
  if (epochs >= MAX_UINT256 / 2n) return '∞';
  const days = epochsToDays(epochs);
  if (days >= 1) return `${days.toFixed(1)}d`;
  const hours = Number(epochs) / EPOCHS_PER_HOUR;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Number(epochs)} epochs`;
}
