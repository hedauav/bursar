import { createPublicClient, http, formatUnits } from 'viem';
import { calibration } from '@filoz/synapse-core/chains';

const c = createPublicClient({ chain: calibration, transport: http() });
const hashes = process.argv.slice(2);
for (const h of hashes) {
  try {
    const r = await c.getTransactionReceipt({ hash: h });
    console.log(h.slice(0, 12), '->', r.status, 'block', r.blockNumber);
  } catch (e) {
    console.log(h.slice(0, 12), '-> pending/not found:', e.shortMessage || e.message);
  }
}
const addr = '0x7085f12a9B5e51dD9B01443F7568A2De40AACC98';
const fil = await c.getBalance({ address: addr });
const usdfc = await c.readContract({
  address: calibration.contracts.usdfc.address,
  abi: calibration.contracts.usdfc.abi,
  functionName: 'balanceOf',
  args: [addr],
});
console.log('tFIL :', formatUnits(fil, 18));
console.log('USDFC:', formatUnits(usdfc, 18));
