/**
 * Syncs a narration recording to the demo screen capture.
 *
 * Two accepted shapes:
 *
 *   A. ONE continuous take  ->  docs/demo/audio/narration.mp3
 *      The recording is transcribed with word-level timestamps (Whisper via
 *      Groq) and matched against the script's anchor phrases to find where each
 *      of the six sections actually begins in YOUR delivery. If the wording
 *      drifted too far to match, it falls back to detecting the pauses between
 *      sections.
 *
 *   B. SIX clips  ->  docs/demo/audio/1-open.mp3 ... 6-close.mp3
 *      Durations are read directly; no transcription needed.
 *
 * Either way the screen capture is then RE-RECORDED so every visual beat lasts
 * exactly as long as its narration, and the two are muxed.
 *
 *   node scripts/sync-audio.mjs
 *
 * Output: docs/demo/bursar-demo.mp4  (H.264/AAC)
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const DIR = 'docs/demo';
const AUDIO_DIR = join(DIR, 'audio');
const VIDEO = join(DIR, 'bursar-walkthrough.webm');
const OUT = join(DIR, 'bursar-demo.mp4');
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;

/** Section ids in script order, matching record-demo.mjs. */
const SECTIONS = ['open', 'runway', 'policy', 'triage', 'cycle', 'close'];

/**
 * Distinctive opening phrases for each section, from VOICEOVER.md. Several
 * alternatives per section so a paraphrased delivery still matches.
 */
const ANCHORS = {
  open: ['agents can store files', 'store files', 'decide whether it is worth'],
  runway: ['this is bursar', 'its own wallet', 'reading its own runway'],
  policy: ['it knows what it holds', 'what is locked', 'burns per month'],
  triage: ['the interesting case', 'stopped proving', 'runway down to one day'],
  cycle: ['act for real', 'let it look at itself', 'run a tick'],
  close: ['every number here', 'live contract call', 'never the hard part'],
};

// --- helpers --------------------------------------------------------------

const norm = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

async function durationMs(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  return Math.round(parseFloat(stdout.trim()) * 1000);
}

async function groqKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY.trim();
  try {
    const env = await readFile('.env.local', 'utf8');
    const line = env.split(/\r?\n/).find((l) => l.startsWith('GROQ_API_KEY='));
    return line ? line.slice('GROQ_API_KEY='.length).replace(/^"|"$/g, '').trim() : null;
  } catch {
    return null;
  }
}

// --- A1. transcribe with word timestamps ---------------------------------

async function transcribe(file) {
  const key = await groqKey();
  if (!key) throw new Error('GROQ_API_KEY not found (env or .env.local)');

  const form = new FormData();
  form.append('file', new Blob([await readFile(file)]), basename(file));
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`transcription failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Find where each section begins, by locating its anchor phrase in the
 * transcript's word stream. Returns start times in ms, or null if too few
 * sections matched to trust the result.
 */
function alignByAnchors(words) {
  const toks = words.map((w) => norm(w.word)).filter(Boolean);
  const starts = words.map((w) => Math.round((w.start ?? 0) * 1000));

  /** Best window index for a phrase, searching at or after `from`. */
  function find(phrase, from) {
    const target = norm(phrase).split(' ');
    if (!target.length) return -1;
    let best = -1;
    let bestScore = 0;
    for (let i = from; i <= toks.length - 1; i++) {
      let hit = 0;
      for (let j = 0; j < target.length && i + j < toks.length; j++) {
        if (toks[i + j] === target[j]) hit++;
      }
      const score = hit / target.length;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
      if (bestScore === 1) break;
    }
    // Demand most of the phrase, so a stray common word cannot anchor a section.
    return bestScore >= 0.7 ? best : -1;
  }

  const found = {};
  let cursor = 0;
  for (const id of SECTIONS) {
    let idx = -1;
    for (const phrase of ANCHORS[id]) {
      idx = find(phrase, cursor);
      if (idx >= 0) break;
    }
    if (idx >= 0) {
      found[id] = starts[idx];
      cursor = idx + 1;
    }
  }

  const matched = Object.keys(found).length;
  console.log(`  anchor match: ${matched}/${SECTIONS.length} sections`);
  if (matched < 4) return null;

  // Interpolate any section whose anchor was missed.
  let last = 0;
  for (const id of SECTIONS) {
    if (found[id] == null) found[id] = last;
    else last = found[id];
  }
  return found;
}

// --- A2. fallback: split on the pauses between sections -------------------

async function alignBySilence(file, totalMs) {
  console.log('  falling back to pause detection');
  const { stderr } = await run(
    'ffmpeg',
    ['-i', file, '-af', 'silencedetect=noise=-35dB:d=1.0', '-f', 'null', '-'],
    { maxBuffer: 1024 * 1024 * 20 },
  ).catch((e) => ({ stderr: e.stderr ?? '' }));

  const gaps = [...stderr.matchAll(/silence_start:\s*([0-9.]+)[\s\S]*?silence_duration:\s*([0-9.]+)/g)]
    .map((m) => ({ at: parseFloat(m[1]) * 1000, len: parseFloat(m[2]) * 1000 }))
    .filter((g) => g.at > 1000 && g.at < totalMs - 1000);

  if (gaps.length < SECTIONS.length - 1) {
    console.log(`  only ${gaps.length} usable pause(s); splitting evenly instead`);
    const each = Math.round(totalMs / SECTIONS.length);
    return Object.fromEntries(SECTIONS.map((s, i) => [s, i * each]));
  }

  // The five longest pauses are the section breaks; order them by position.
  const cuts = gaps
    .sort((a, b) => b.len - a.len)
    .slice(0, SECTIONS.length - 1)
    .map((g) => Math.round(g.at + g.len / 2))
    .sort((a, b) => a - b);

  return Object.fromEntries(SECTIONS.map((s, i) => [s, i === 0 ? 0 : cuts[i - 1]]));
}

// --- main -----------------------------------------------------------------

async function main() {
  await mkdir(AUDIO_DIR, { recursive: true });
  const files = (await readdir(AUDIO_DIR)).filter((f) => AUDIO_EXT.test(f)).sort();

  if (files.length === 0) {
    console.error(`No audio in ${AUDIO_DIR}/`);
    console.error('Either one continuous take:');
    console.error('  docs/demo/audio/narration.mp3');
    console.error('or six clips:');
    SECTIONS.forEach((s, i) => console.error(`  ${i + 1}-${s}.mp3`));
    process.exitCode = 1;
    return;
  }

  const paths = files.map((f) => join(AUDIO_DIR, f));
  let timings;

  if (files.length === SECTIONS.length) {
    // --- B. one clip per section ---
    console.log(`six clips found - reading durations directly`);
    timings = {};
    for (const [i, p] of paths.entries()) {
      const ms = await durationMs(p);
      const id = SECTIONS.find((s) => files[i].toLowerCase().includes(s)) ?? SECTIONS[i];
      timings[id] = ms;
      console.log(`  ${files[i].padEnd(22)} ${(ms / 1000).toFixed(2)}s -> ${id}`);
    }
  } else {
    // --- A. one continuous take ---
    if (files.length > 1) {
      console.log(`${files.length} files found; treating the first as the take: ${files[0]}`);
    }
    const file = paths[0];
    const totalMs = await durationMs(file);
    console.log(`continuous take: ${files[0]} (${(totalMs / 1000).toFixed(1)}s)`);

    let starts = null;
    try {
      console.log('  transcribing with whisper-large-v3...');
      const tr = await transcribe(file);
      if (tr.words?.length) starts = alignByAnchors(tr.words);
      else console.log('  no word timestamps returned');
    } catch (e) {
      console.log(`  transcription unavailable: ${e.message}`);
    }

    if (!starts) starts = await alignBySilence(file, totalMs);

    // Convert start times to per-section durations.
    timings = {};
    SECTIONS.forEach((id, i) => {
      const end = i === SECTIONS.length - 1 ? totalMs : starts[SECTIONS[i + 1]];
      timings[id] = Math.max(2000, end - starts[id]);
    });
    console.log('  section durations:');
    for (const id of SECTIONS) console.log(`    ${id.padEnd(7)} ${(timings[id] / 1000).toFixed(2)}s`);
  }

  await writeFile(join(DIR, 'timings.json'), JSON.stringify(timings, null, 2));
  console.log('\nwrote docs/demo/timings.json');

  console.log('re-recording the video against those timings...\n');
  try {
    const { stdout } = await run('node', ['scripts/record-demo.mjs'], {
      maxBuffer: 1024 * 1024 * 10,
    });
    process.stdout.write(stdout);
  } catch (e) {
    throw new Error(`recording failed: ${e.stderr || e.message}`);
  }

  // --- narration track --------------------------------------------------
  const joined = join(DIR, '.narration.m4a');
  if (files.length === SECTIONS.length) {
    const listFile = join(DIR, '.audio-list.txt');
    await writeFile(
      listFile,
      files.map((f) => `file '${join('audio', f).replace(/\\/g, '/')}'`).join('\n'),
    );
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c:a', 'aac', '-b:a', '192k', joined]);
    await rm(listFile, { force: true });
  } else {
    await run('ffmpeg', ['-y', '-i', paths[0], '-c:a', 'aac', '-b:a', '192k', joined]);
  }

  // --- mux ---------------------------------------------------------------
  // The two tracks rarely end together: the 'cycle' section holds for a real
  // on-chain tick regardless of how fast that line is read. Plain -shortest
  // would amputate whichever track is longer - usually the closing line, or
  // the final shot. So pad both and let -shortest land on max(video, audio):
  //   apad  - silence after the narration ends
  //   tpad  - hold the last video frame after the capture ends
  // Playwright begins capturing at context creation, so the page load sits at
  // the head of the file as dead frames. Trim it, or section one starts late
  // and every later section inherits the same drift.
  let leadInMs = 0;
  try {
    ({ leadInMs } = JSON.parse(await readFile(join(DIR, 'offset.json'), 'utf8')));
  } catch {
    // Older recording without an offset file; assume none.
  }

  const rawVMs = await durationMs(VIDEO);
  const vMs = rawVMs - leadInMs;
  const aMs = await durationMs(joined);
  console.log(
    `\nlead-in trimmed ${(leadInMs / 1000).toFixed(2)}s` +
      ` | video ${(vMs / 1000).toFixed(1)}s | narration ${(aMs / 1000).toFixed(1)}s` +
      ` -> output ${(Math.max(vMs, aMs) / 1000).toFixed(1)}s`,
  );
  const holdS = Math.max(0, Math.ceil((aMs - vMs) / 1000)) + 1;

  await run('ffmpeg', [
    '-y',
    '-ss', (leadInMs / 1000).toFixed(3), '-i', VIDEO,
    '-i', joined,
    '-map', '0:v:0', '-map', '1:a:0',
    '-vf', `tpad=stop_mode=clone:stop_duration=${holdS}`,
    '-af', 'apad',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-pix_fmt', 'yuv420p',       // QuickTime / iOS / X compatibility
    '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    OUT,
  ]);
  await rm(joined, { force: true });

  console.log(`\ndone -> ${OUT}  (${((await durationMs(OUT)) / 1000).toFixed(1)}s, H.264/AAC)`);
  console.log('Uploads directly to X, YouTube and LinkedIn.');
}

await main();
