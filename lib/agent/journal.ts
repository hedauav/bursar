import 'server-only';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { TickRecord } from './types';

/**
 * Append-only decision journal.
 *
 * The authoritative record of what the agent did is on chain - every TOP_UP and
 * PRUNE_DATASET carries a tx hash. This journal is the readable narrative around
 * those hashes: what the agent saw and why it acted.
 *
 * Storage is chosen per environment. Serverless filesystems are ephemeral, so a
 * deployed agent would forget every decision the moment its instance recycled -
 * which defeats the point of a decision history. When a Blob store is bound the
 * journal persists there; locally it is a plain file.
 */
const MAX_TICKS = 200;
const BLOB_KEY = 'journal.json';

/** In-process cache so a warm instance avoids a round trip per request. */
let memory: TickRecord[] | null = null;

function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function filePath(): string {
  const base = process.env.VERCEL ? '/tmp' : join(process.cwd(), '.data');
  return join(base, BLOB_KEY);
}

export async function readJournal(): Promise<TickRecord[]> {
  if (memory) return memory;
  memory = hasBlob() ? await readFromBlob() : await readFromFile();
  return memory;
}

export async function appendTick(tick: TickRecord): Promise<void> {
  // Read the CURRENT stored journal rather than this instance's cache. Each
  // serverless instance keeps its own copy, so appending to a stale one silently
  // drops every tick another instance recorded in the meantime.
  const ticks = hasBlob() ? await readFromBlob() : await readFromFile();

  // Guard against a re-run appending the same tick twice.
  if (!ticks.some((t) => t.id === tick.id)) ticks.unshift(tick);
  ticks.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  if (ticks.length > MAX_TICKS) ticks.length = MAX_TICKS;
  memory = ticks;

  if (hasBlob()) {
    await writeToBlob(ticks);
  } else {
    await writeToFile(ticks);
  }
}

// --- Blob (production) ----------------------------------------------------

async function readFromBlob(): Promise<TickRecord[]> {
  try {
    const { get } = await import('@vercel/blob');
    // useCache:false - a tick written seconds ago must be readable immediately,
    // otherwise the dashboard shows a stale feed right after it acts.
    const result = await get(BLOB_KEY, { access: 'private', useCache: false });
    if (!result) return [];
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as TickRecord[];
  } catch (e) {
    console.warn('[journal] blob read failed:', errMsg(e));
    return [];
  }
}

async function writeToBlob(ticks: TickRecord[]): Promise<void> {
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_KEY, JSON.stringify(ticks), {
      access: 'private',
      contentType: 'application/json',
      // One canonical object rather than a new URL per write.
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
  } catch (e) {
    // Losing the narrative must never fail a tick - the transactions are real
    // and already settled by this point.
    console.warn('[journal] blob write failed:', errMsg(e));
  }
}

// --- File (local dev) -----------------------------------------------------

async function readFromFile(): Promise<TickRecord[]> {
  try {
    return JSON.parse(await readFile(filePath(), 'utf8')) as TickRecord[];
  } catch {
    return [];
  }
}

async function writeToFile(ticks: TickRecord[]): Promise<void> {
  const path = filePath();
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(ticks, null, 2), 'utf8');
  } catch {
    // Read-only FS: the in-memory journal still serves this instance.
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
