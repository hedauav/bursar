/**
 * One-time setup: give the agent something real to pay for.
 *
 * Deposits USDFC into Filecoin Pay, approves Warm Storage as operator, and
 * uploads a payload so a PDP payment rail actually starts draining the account.
 * Until this runs, lockupRate is 0 and runway is infinite - which makes for a
 * meaningless demo.
 */
import { Synapse } from '@filoz/synapse-sdk';
import { calibration } from '@filoz/synapse-core/chains';
import { formatUnits } from 'viem';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const PK = process.env.PK;
if (!PK) throw new Error('set PK');

// Target starting runway. 7 days lands the agent in the YELLOW tier so its very
// first autonomous tick has a real decision to make.
const EXTRA_RUNWAY_EPOCHS = BigInt(process.env.EXTRA_RUNWAY_EPOCHS ?? 20160);

const account = privateKeyToAccount(PK);
const synapse = Synapse.create({
  account,
  chain: calibration,
  transport: http(),
  source: 'filecoin-runway-agent',
});

const usdfc = (v) => `${formatUnits(v, 18)} USDFC`;

console.log('agent :', account.address);

const payload = new TextEncoder().encode(
  `Filecoin Runway Agent - autonomous storage budget demo\n` +
    `This payload exists so the agent has a real PDP payment rail to reason about.\n` +
    `Created at ${new Date().toISOString()}\n` +
    `The agent reads its own runway on Filecoin Pay and decides whether keeping this data is affordable.\n`,
);
console.log('payload:', payload.byteLength, 'bytes');

// --- 1. What will this cost, and what needs funding? ----------------------
const prep = await synapse.storage.prepare({
  pieceSizes: [BigInt(payload.byteLength)],
  extraRunwayEpochs: EXTRA_RUNWAY_EPOCHS,
});

console.log('\n--- cost model (live from Warm Storage) ---');
console.log('rate/epoch      :', usdfc(prep.costs.rates.perEpoch));
console.log('rate/month      :', usdfc(prep.costs.rates.perMonth));
console.log('lockup total    :', usdfc(prep.costs.lockups.total));
console.log('  streaming     :', usdfc(prep.costs.lockups.streamingLockup));
console.log('  lifecycle     :', usdfc(prep.costs.lockups.lifecycleLockup));
console.log('depositNeeded   :', usdfc(prep.costs.depositNeeded));
console.log('needsApproval   :', prep.costs.needsFwssMaxApproval);
console.log('ready           :', prep.costs.ready);

// --- 2. Deposit + approve in one transaction ------------------------------
if (prep.transaction) {
  console.log('\n--- funding ---');
  console.log('depositAmount   :', usdfc(prep.transaction.depositAmount));
  console.log('includesApproval:', prep.transaction.includesApproval);
  const { hash, receipt } = await prep.transaction.execute({
    onHash: (h) => console.log('tx submitted    :', h),
  });
  console.log('confirmed       :', receipt?.status ?? 'pending', hash);
  console.log('explorer        : https://calibration.filfox.info/en/message/' + hash);
} else {
  console.log('\nalready funded and approved, nothing to send');
}

// --- 3. Upload, which creates the dataset + starts the rail ---------------
console.log('\n--- upload ---');
const result = await synapse.storage.upload(payload, {
  pieceMetadata: { name: 'runway-agent-demo.txt' },
  callbacks: {
    onProviderSelected: (p) => console.log('provider        :', p.id, p.serviceProvider ?? ''),
    onDataSetResolved: (i) => console.log('dataset         :', i.dataSetId.toString()),
    onPiecesAdded: (tx) => console.log('pieces tx       :', tx),
    onPiecesConfirmed: (dsId) => console.log('confirmed on    :', dsId.toString()),
  },
});

console.log('\npieceCid        :', result.pieceCid.toString());
console.log('size            :', result.size);
console.log('complete        :', result.complete);
for (const c of result.copies) {
  console.log(`copy            : provider=${c.providerId} dataSet=${c.dataSetId} role=${c.role} new=${c.isNewDataSet}`);
}
for (const f of result.failedAttempts) {
  console.log(`FAILED copy     : provider=${f.providerId} ${f.error}`);
}

// --- 4. What does the agent now see? -------------------------------------
const summary = await synapse.payments.accountSummary();
console.log('\n--- agent financial state after bootstrap ---');
console.log('funds           :', usdfc(summary.funds));
console.log('availableFunds  :', usdfc(summary.availableFunds));
console.log('debt            :', usdfc(summary.debt));
console.log('burn/month      :', usdfc(summary.lockupRatePerMonth));
console.log('totalLockup     :', usdfc(summary.totalLockup));
console.log('runwayInEpochs  :', summary.runwayInEpochs.toString());
console.log('runway (days)   :', (Number(summary.runwayInEpochs) / 2880).toFixed(2));
console.log('grossCoverage   :', (Number(summary.grossCoverageInEpochs) / 2880).toFixed(2), 'days');
console.log('epoch           :', summary.epoch.toString());
