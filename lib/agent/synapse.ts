import 'server-only';

import { Synapse } from '@filoz/synapse-sdk';
import { WarmStorageService } from '@filoz/synapse-sdk/warm-storage';
import { calibration } from '@filoz/synapse-core/chains';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { DEFAULT_RPC_URL } from './config';

/** Namespaces datasets created by this agent. Required by SynapseOptions. */
export const SOURCE = 'filecoin-runway-agent';

function requireKey(): `0x${string}` {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      'AGENT_PRIVATE_KEY is not set. The agent has no wallet to read or spend from.',
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('AGENT_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string.');
  }
  return key as `0x${string}`;
}

/**
 * The agent's own wallet. Server-only: this key signs top-up and prune
 * transactions, so it must never reach the browser bundle.
 */
export function getAgentAccount() {
  return privateKeyToAccount(requireKey());
}

let cached: Synapse | null = null;

export function getSynapse(): Synapse {
  if (cached) return cached;
  cached = Synapse.create({
    account: getAgentAccount(),
    chain: calibration,
    transport: http(process.env.FILECOIN_RPC_URL || DEFAULT_RPC_URL),
    source: SOURCE,
  });
  return cached;
}

export function getWarmStorage(): WarmStorageService {
  return WarmStorageService.create({ account: getAgentAccount() });
}
