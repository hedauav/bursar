/**
 * Display-only formatting helpers for the dashboard.
 *
 * Everything here is pure and client-safe: no BigInt literals, no chain SDKs.
 * On-chain values arrive as decimal integer strings with 18 decimals; we format
 * them with string arithmetic so nothing is lost to float rounding, and we keep
 * the raw string around so the UI can show it in a tooltip.
 */

export const EPOCH_SECONDS = 30;
export const EPOCHS_PER_DAY = (24 * 60 * 60) / EPOCH_SECONDS; // 2880

/** Anything above this is the uint256 "never" sentinel, not a real duration. */
const SENTINEL_FLOOR = 1e15;

const DASH = '\u2014';

/**
 * Format an 18-decimal integer string as human USDFC/tFIL.
 * `formatUsdfc('1234500000000000000')` -> `'1.2345'`
 */
export function formatUsdfc(v: string | null | undefined, dp = 4): string {
  if (v === null || v === undefined || v === '') return DASH;

  let s = String(v).trim();
  let sign = '';
  if (s.startsWith('-')) {
    sign = '-';
    s = s.slice(1);
  }

  if (!/^\d+$/.test(s)) {
    // Not a raw integer string - fall back to float display rather than lying.
    const n = Number(s);
    if (!Number.isFinite(n)) return DASH;
    return `${sign}${n.toFixed(dp)}`;
  }

  const padded = s.padStart(19, '0');
  const cut = padded.length - 18;
  const whole = padded.slice(0, cut).replace(/^0+(?=\d)/, '');
  const frac = dp > 0 ? padded.slice(cut, cut + dp) : '';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${frac ? `.${frac}` : ''}`;
}

/**
 * Allowances are often set to the uint256 maximum, which means "unlimited"
 * rather than an astronomically large balance. Render it as such.
 */
export function formatAllowance(v: string | null | undefined, dp = 4): string {
  if (v === null || v === undefined || v === '') return DASH;
  const digits = String(v).replace('-', '');
  if (/^\d+$/.test(digits) && digits.length > 30) return '∞';
  return formatUsdfc(v, dp);
}

/** True when an 18dp string is greater than zero. */
export function isPositive(v: string | null | undefined): boolean {
  if (!v) return false;
  return /[1-9]/.test(String(v).replace('-', ''));
}

/** Human duration for a day count. `null` means unbounded. */
export function formatDays(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '\u221e';
  if (n >= SENTINEL_FLOOR) return '\u221e';
  if (n >= 1) return `${n.toFixed(1)} days`;
  const hours = n * 24;
  if (hours >= 1) return `${hours.toFixed(1)} hours`;
  return `${Math.max(0, Math.round(hours * 60))} min`;
}

/** Just the numeral, for the hero readout (unit rendered separately). */
export function formatDaysNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '\u221e';
  if (n >= SENTINEL_FLOOR) return '\u221e';
  return n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

/** Epoch count string -> days, or null when it is the infinite sentinel. */
export function epochsToDays(epochs: string | null | undefined): number | null {
  if (epochs === null || epochs === undefined || epochs === '') return null;
  const n = Number(epochs);
  if (!Number.isFinite(n) || n >= SENTINEL_FLOOR) return null;
  return n / EPOCHS_PER_DAY;
}

/** Thousands-separated epoch number. */
export function formatEpoch(e: string | null | undefined): string {
  if (e === null || e === undefined || e === '') return DASH;
  const n = Number(e);
  if (!Number.isFinite(n) || n >= SENTINEL_FLOOR) return DASH;
  return Math.trunc(n).toLocaleString('en-US');
}

export function formatCount(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return DASH;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-US');
}

export function shortAddress(a: string | null | undefined, lead = 6, tail = 4): string {
  if (!a) return DASH;
  if (a.length <= lead + tail + 2) return a;
  return `${a.slice(0, lead)}\u2026${a.slice(-tail)}`;
}

/** "23m ago" / "in 4m". Empty input renders an em dash. */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return DASH;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return DASH;
  const deltaSec = Math.round((now - t) / 1000);
  const ago = deltaSec >= 0;
  const s = Math.abs(deltaSec);
  let body: string;
  if (s < 10) return ago ? 'just now' : 'now';
  if (s < 60) body = `${s}s`;
  else if (s < 3600) body = `${Math.floor(s / 60)}m`;
  else if (s < 86400) body = `${Math.floor(s / 3600)}h`;
  else body = `${Math.floor(s / 86400)}d`;
  return ago ? `${body} ago` : `in ${body}`;
}

/** Local wall clock, e.g. "14:03:22". */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour12: false })}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return DASH;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const EXPLORER_ADDRESS = (addr: string) =>
  `https://calibration.filfox.info/en/address/${addr}`;
export const EXPLORER_TX = (hash: string) =>
  `https://calibration.filfox.info/en/message/${hash}`;

/** Render an evidence value without collapsing meaningful falsy values. */
export function formatEvidenceValue(v: string | number | boolean | null): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
  // Long integer strings are almost always 18dp token amounts.
  if (/^-?\d{16,}$/.test(v)) return `${formatUsdfc(v)} (18dp)`;
  return v;
}
