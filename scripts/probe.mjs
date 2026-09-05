import { Synapse } from '@filoz/synapse-sdk';
import { calibration } from '@filoz/synapse-core/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { http } from 'viem';

const account = privateKeyToAccount(process.env.PK);
const synapse = Synapse.create({ account, chain: calibration, transport: http(), source: 'loops-probe' });

console.log('agent address :', account.address);
console.log('chain         :', synapse.chain.name, synapse.chain.id);

const [wallet, deposited, summary] = await Promise.all([
  synapse.payments.walletBalance(),
  synapse.payments.balance(),
  synapse.payments.accountSummary(),
]);
console.log('FIL wallet    :', wallet.toString());
console.log('USDFC in Pay  :', deposited.toString());
console.log('--- accountSummary() (LIVE onchain) ---');
for (const [k, v] of Object.entries(summary)) console.log(' ', k.padEnd(24), v.toString());
