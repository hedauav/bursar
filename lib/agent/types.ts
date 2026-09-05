/** Shared types for the runway agent: what it observes, decides, and did. */

export type Tier = 'GREEN' | 'YELLOW' | 'RED' | 'DEFICIT' | 'IDLE' | 'UNFUNDED';

export type ActionKind =
  | 'HOLD'
  | 'TOP_UP'
  | 'PRUNE_DATASET'
  | 'BLOCKED_NO_FUNDS'
  | 'APPROVE_SERVICE';

/** One dataset the agent is paying for, plus whether the provider is earning it. */
export interface DatasetObservation {
  dataSetId: string;
  pdpVerifierDataSetId: string;
  providerId: string;
  serviceProvider: string;
  isLive: boolean;
  hasActivePieces: boolean;
  withCDN: boolean;
  metadata: Record<string, string>;
  /** Rail funding this dataset's PDP proving. */
  pdpRailId: string;
  lifecycleReserveBalance: string;
  /**
   * PDP proof state — the second on-chain signal the agent chains into RED-tier
   * decisions. These are read records, not inferences: `provenThisPeriod` and
   * `lastProvenEpoch` are what the contracts actually recorded.
   */
  proof: {
    /** FWSS: has the provider satisfied the CURRENT proving period? */
    provenThisPeriod: boolean;
    /** FWSS: epoch by which the current period must be proven. */
    provingDeadlineEpoch: string | null;
    /** PDPVerifier: epoch of the last accepted proof. 0 means never proven. */
    lastProvenEpoch: string | null;
    /** Wall-clock of lastProvenEpoch, derived from chain genesis. */
    lastProvenAt: string | null;
    /** PDPVerifier: next challenge the provider must answer. */
    nextChallengeEpoch: string | null;
    /** True only when the deadline has passed AND the period is unproven. */
    isProofOverdue: boolean;
    /** Epochs past the deadline (0 if not overdue). */
    epochsOverdue: string;
    /** Live on the PDPVerifier contract. */
    dataSetLive: boolean;
    /** Set when proof state could not be read (treated as "unknown", never as "delinquent"). */
    error?: string;
  };
}

/** Everything the agent read from chain in one tick. Pure observation, no judgement. */
export interface AgentObservation {
  observedAt: string;
  address: string;
  chainId: number;
  epoch: string;

  /** Filecoin Pay account state (the runway primitive). */
  pay: {
    funds: string;
    availableFunds: string;
    debt: string;
    lockupRatePerEpoch: string;
    lockupRatePerMonth: string;
    totalLockup: string;
    totalFixedLockup: string;
    totalRateBasedLockup: string;
    runwayInEpochs: string;
    grossCoverageInEpochs: string;
    /** true when lockupRate is 0 => nothing being spent => runway is the uint256 sentinel. */
    runwayIsInfinite: boolean;
    runwayDays: number | null;
  };

  wallet: {
    /** Native tFIL, for gas. */
    fil: string;
    /** USDFC sitting in the wallet, available to deposit. */
    usdfc: string;
  };

  /** Warm Storage operator approval — the agent can't be charged without it. */
  approval: {
    isApproved: boolean;
    rateAllowance: string;
    lockupAllowance: string;
    rateUsage: string;
    lockupUsage: string;
    maxLockupPeriod: string;
  } | null;

  pricing: {
    perTiBPerMonth: string;
    perTiBPerEpoch: string;
    epochsPerMonth: string;
    epochDuration: number;
  } | null;

  datasets: DatasetObservation[];

  /** Non-fatal read errors, surfaced rather than swallowed. */
  warnings: string[];
}

/** One thing the agent decided to do, with the reasoning that produced it. */
export interface Decision {
  action: ActionKind;
  /** Machine-readable reason code — stable, greppable, testable. */
  reasonCode: string;
  /** One-line deterministic explanation. Always present, never LLM-generated. */
  rationale: string;
  /** Dataset this applies to, when the action is dataset-scoped. */
  dataSetId?: string;
  /** USDFC amount for TOP_UP. */
  amount?: string;
  /** The facts that triggered this branch — shown in the UI so a judge can audit it. */
  evidence: Record<string, string | number | boolean | null>;
}

export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED_DRY_RUN' | 'NOOP';

export interface ExecutedDecision extends Decision {
  status: ExecutionStatus;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  executedAt: string;
}

/** A full agent cycle: what it saw, how it classified it, what it did. */
export interface TickRecord {
  id: string;
  startedAt: string;
  finishedAt: string;
  trigger: 'cron' | 'manual' | 'boot';
  tier: Tier;
  tierReason: string;
  observation: AgentObservation;
  decisions: ExecutedDecision[];
  /** Claude's narration of this tick. Presentation only — never affects the decision. */
  narration?: string;
  durationMs: number;
}
