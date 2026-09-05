/**
 * Proves the prune path end-to-end against the real chain.
 *
 * The RED-tier policy terminates the rail of a provider that has stopped
 * proving. That branch only fires when a provider actually faults, which cannot
 * be arranged on demand - so this script exercises the same call the agent makes
 * (`storage.terminateService`) and captures the transaction hash, so the
 * mechanism is verifiable rather than merely asserted.
 *
 * It creates a DISPOSABLE dataset as the target. The datasets the live demo
 * depends on are never touched, because termination is one-way.
 *
 *   PK=0x... node scripts/prove-terminate.mjs
 */
import { Synapse } from '@filoz/synapse-sdk';
import { calibration } from '@filoz/synapse-core/chains';
import { formatUnits, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const PK = process.env.PK;
if (!PK) throw new Error('set PK');

const synapse = Synapse.create({
  account: privateKeyToAccount(PK),
  chain: calibration,
  transport: http(),
  source: 'filecoin-runway-agent',
});

const explorer = (h) => `https://calibration.filfox.info/en/message/${h}`;
const usdfc = (v) => `${formatUnits(v, 18)} USDFC`;

const before = await synapse.storage.findDataSets();
console.log('datasets before:', before.map((d) => d.pdpVerifierDataSetId.toString()).join(', '));
const keep = new Set(before.map((d) => d.pdpVerifierDataSetId.toString()));

// --- 1. create a throwaway dataset --------------------------------------
const payload = new TextEncoder().encode(
  'Disposable dataset created solely to prove terminateService() works ' +
    'end-to-end on Filecoin Calibration. Created at ' +
    new Date().toISOString() +
    '. It is terminated immediately after creation; the datasets the demo ' +
    'relies on are untouched.\n',
);

console.log('\ncreating a disposable dataset (single copy)...');
const prep = await synapse.storage.prepare({ pieceSizes: [BigInt(payload.byteLength)] });
if (prep.transaction) {
  console.log('  funding:', usdfc(prep.transaction.depositAmount));
  const { hash } = await prep.transaction.execute();
  console.log('  funded tx:', hash);
}

// Excluding the providers already in use forces a brand-new dataset. Without
// this the SDK reuses an existing one (isNewDataSet:false) and there is nothing
// safe to terminate.
const inUse = [...new Set(before.map((d) => d.providerId))];
console.log('  excluding providers already in use:', inUse.join(', '));

const upload = await synapse.storage.upload(payload, {
  copies: 1,
  excludeProviderIds: inUse,
  pieceMetadata: { name: 'terminate-proof.txt' },
});
console.log('  pieceCid:', upload.pieceCid.toString());
for (const c of upload.copies) {
  console.log(`  copy: provider=${c.providerId} dataSet=${c.dataSetId} new=${c.isNewDataSet}`);
}

// --- 2. find the one we just made ---------------------------------------
const after = await synapse.storage.findDataSets();
const target = after.find((d) => !keep.has(d.pdpVerifierDataSetId.toString()));

if (!target) {
  console.error('\nNo new dataset appeared - refusing to terminate an existing one.');
  process.exit(1);
}

console.log(
  `\ntarget: dataSetId=${target.dataSetId} pdpId=${target.pdpVerifierDataSetId}` +
    ` provider=${target.providerId} rail=${target.pdpRailId}`,
);

// --- 3. terminate it, exactly as the RED-tier policy would ---------------
console.log('\nterminating (same call lib/agent/act.ts makes for PRUNE_DATASET)...');
const result = await synapse.storage.terminateService({
  dataSetId: target.dataSetId,
  onSubmitted: (tx) => console.log('  submitted:', tx),
});

const hash = result.confirmedTxHash ?? result.txHash;
console.log('\n--- PRUNE PROVEN ---');
console.log('dataSetId :', result.dataSetId.toString());
console.log('endEpoch  :', result.endEpoch.toString());
console.log('txHash    :', hash);
console.log('explorer  :', hash ? explorer(hash) : 'n/a');

const summary = await synapse.payments.accountSummary();
console.log('\nburn/month now:', usdfc(summary.lockupRatePerMonth));
console.log('runway (days) :', (Number(summary.runwayInEpochs) / 2880).toFixed(2));
