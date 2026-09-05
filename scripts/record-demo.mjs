/**
 * Records a walkthrough of the live agent as a video file.
 *
 * Drives the real deployed dashboard - nothing here is staged.
 *
 *   npx playwright install chromium      # once
 *   node scripts/record-demo.mjs
 *
 * Section durations default to the timings in docs/demo/VOICEOVER.md. If
 * docs/demo/timings.json exists (written by scripts/sync-audio.mjs from real
 * narration clip lengths), each section is stretched to match its audio
 * instead - so the visuals land on the words rather than near them.
 *
 * Output: docs/demo/bursar-walkthrough.webm
 */
import { chromium } from 'playwright';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const URL = process.env.DEMO_URL || 'https://bursar-mu.vercel.app';
const OUT = 'docs/demo';
const W = 1600;
const H = 900;

/** Fallback section budgets, ms - matches the written voiceover script. */
const DEFAULT_MS = {
  open: 8000,
  runway: 8000,
  policy: 10000,
  triage: 16000,
  cycle: 14000,
  close: 9000,
};

/**
 * A live tick genuinely reads chain, decides, maybe transacts, then narrates.
 * The 'cycle' section can never be shorter than that or the video would cut
 * away before the decision lands.
 */
const CYCLE_FLOOR_MS = 14000;

const beat = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

async function loadTimings() {
  try {
    const raw = await readFile(join(OUT, 'timings.json'), 'utf8');
    const t = JSON.parse(raw);
    console.log('using narration-derived timings from docs/demo/timings.json');
    if (t.cycle && t.cycle < CYCLE_FLOOR_MS) {
      console.warn(
        `  note: 'cycle' narration is ${t.cycle}ms but a live tick needs ~${CYCLE_FLOOR_MS}ms;` +
          ' holding the shot longer than the audio.',
      );
      t.cycle = CYCLE_FLOOR_MS;
    }
    return { ...DEFAULT_MS, ...t };
  } catch {
    console.log('using default timings (no timings.json)');
    return DEFAULT_MS;
  }
}

/** Smooth scroll so the recording reads as deliberate rather than jumpy. */
async function glideTo(page, y, ms = 1200) {
  await page.evaluate(
    ([target, duration]) =>
      new Promise((resolve) => {
        const start = window.scrollY;
        const delta = target - start;
        const t0 = performance.now();
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
        function step(now) {
          const p = Math.min(1, (now - t0) / duration);
          window.scrollTo(0, start + delta * ease(p));
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      }),
    [y, ms],
  );
  return ms;
}

const T = await loadTimings();
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: OUT, size: { width: W, height: H } },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const started = Date.now();
const mark = (name) =>
  console.log(`  ${name.padEnd(8)} @ ${((Date.now() - started) / 1000).toFixed(1)}s`);

// --- 1. open: the agent, live -------------------------------------------
// Playwright starts capturing the moment the context exists, so the page load
// lands at the head of the file as dead frames. That offset is written out so
// the muxer can trim it - otherwise every section sits late by the load time
// and the narration drifts out of step.
console.log('recording...');
await page.goto(URL, { waitUntil: 'networkidle' });
const leadInMs = Date.now() - started;
mark('open');
await beat(T.open);

// --- 2. runway: the hero number -----------------------------------------
mark('runway');

// Drain the account now, in the background. By the time section 5 clicks the
// tick, the agent must face a real crisis - otherwise it sits at a comfortable
// 30 days, correctly decides HOLD, and the narration's "it deposited enough"
// describes something that is not on screen.
//
// The withdrawal takes ~50s to confirm, hence starting it this early. It stays
// invisible until then, so sections 2-4 still show the healthy 30-day figure
// the narration describes, and the drop lands while the what-if panel is up.
const squeeze = fetch(`${URL}/api/demo/squeeze`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ targetDays: 2 }),
})
  .then((r) => r.json())
  .catch((e) => ({ error: String(e) }));

await beat(T.runway - (await glideTo(page, 120)));

// --- 3. policy: balances and the rules it follows ------------------------
mark('policy');
await beat(T.policy - (await glideTo(page, 430)));

// --- 4. triage: the decision the agent was built for ---------------------
mark('triage');
let spent = await glideTo(page, 860);
await beat(900);
await page.locator('button:has-text("Both at once")').click();
await beat(1800);
spent += 2700;

// Give each of the two decision cards its own screen time, in the order the
// narration describes them: terminate the delinquent rail, then re-size the
// deposit for what survives.
spent += await glideTo(page, 980);
const dwell = Math.max(2000, (T.triage - spent) / 2);
await beat(dwell);
spent += dwell + (await glideTo(page, 1150));
await beat(T.triage - spent);

// --- 5. cycle: it acts for real ------------------------------------------
mark('cycle');
// Started back in section 2, so this should already be settled. Capped anyway:
// a slow withdrawal must not stretch this section past its narration.
const sq = await Promise.race([
  squeeze,
  new Promise((r) => setTimeout(() => r({ pending: true }), 6000)),
]);
console.log(
  sq?.pending
    ? '    squeeze still pending after 6s - continuing anyway'
    : sq?.error
      ? `    squeeze failed: ${String(sq.error).slice(0, 120)}`
      : sq?.skipped
        ? `    squeeze skipped: ${sq.message}`
        : `    squeezed ${(Number(sq.withdrawn ?? 0) / 1e18).toFixed(4)} USDFC` +
          ` (was ${Number(sq.runwayDaysBefore ?? 0).toFixed(1)}d)`,
);

spent = await glideTo(page, 0, 800);
await beat(1400); // let the meter repaint at its new, much lower value
await page.locator('button:has-text("Run agent tick now")').click();
spent += 1400 + (await glideTo(page, 1500, 1400));
await beat(T.cycle - spent);

// --- 6. close: the feed and what it pays for -----------------------------
mark('close');
const half = Math.max(1500, T.close / 2);
await beat(half - (await glideTo(page, 1620)));
await beat(half - (await glideTo(page, 2050)));

await context.close();
await browser.close();

const files = (await readdir(OUT)).filter((f) => f.endsWith('.webm'));
const newest = files.filter((f) => f !== 'bursar-walkthrough.webm').sort().at(-1);
if (newest) {
  await rename(join(OUT, newest), join(OUT, 'bursar-walkthrough.webm')).catch(() => {});
}

await writeFile(join(OUT, 'offset.json'), JSON.stringify({ leadInMs }, null, 2));

console.log(
  `\nrecorded -> ${join(OUT, 'bursar-walkthrough.webm')}  (${((Date.now() - started) / 1000).toFixed(1)}s)` +
    `\nlead-in to trim: ${(leadInMs / 1000).toFixed(2)}s`,
);
