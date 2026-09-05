# Recording the demo yourself

Target length: **2 minutes**. Judges are scoring "can we watch it notice, weigh,
and act" — so the whole video is built around one moment: the agent hitting a
crisis it did not create, and handling it on its own.

---

## Before you hit record

1. Open **https://bursar-mu.vercel.app** in a clean browser window.
2. Hide the bookmarks bar (`Ctrl+Shift+B`) and close other tabs.
3. Zoom to **90%** (`Ctrl+-` once) so the runway meter and the policy panel are
   both visible without scrolling.
4. **Check the starting state.** The runway should read around **30 days** and
   the tier chip should say **GREEN**.
   - If it is already low or RED, top it back up first: open a terminal and run
     `curl -X POST https://bursar-mu.vercel.app/api/agent/tick -d '{}' -H 'content-type: application/json'`
     — the agent will restore itself. Wait ~40s, reload, confirm GREEN.
5. Recorder: **OBS Studio** (free) or Windows **Game Bar** (`Win+G` → record).
   Record the browser window only, 1080p, and **enable your microphone**.

> One warning: **"Squeeze the runway" sends a real transaction.** That is the
> point — but it means step 3 genuinely withdraws funds. It is testnet, so
> nothing of value moves.

---

## The script

Say the words in **bold quotes**. Actions are in *italics*. Rough timings.

---

### 0:00 — 0:12 · The hook

*Start on the dashboard, GREEN, without scrolling.*

> **"Agents can store files. What they can't do is decide whether it's worth
> it. A human funds the storage, and a human notices when the money runs out.
> This one doesn't need either."**

---

### 0:12 — 0:30 · What it is looking at

*Point the cursor at the big number, then at the threshold markers on the bar.*

> **"This is Bursar. It has its own wallet, and it is reading its own runway on
> Filecoin Pay — thirty days before it can no longer pay for the storage it has
> committed to. That number is a live contract call, not a cached value."**

*Move the cursor across the tiles: funds, available, burn rate.*

> **"It knows what it holds, what's locked in reserve, and what it burns per
> month. And right now it's deciding to do nothing — thirty days is above its
> comfort threshold, so topping up early would just lock funds it doesn't need
> to lock. Declining to act is a decision too."**

---

### 0:30 — 0:45 · Break it, on purpose

*Scroll to the amber **DEMO CONTROL** box. Click **Squeeze the runway**.*

> **"So let's take its money away. This withdraws its spare funds — a real
> transaction, right now, on Calibration."**

*Wait for it to confirm (~10–20s). Scroll back up so the meter is visible.*

> **"Thirty days just became about two. The agent didn't cause this and hasn't
> been told about it."**

---

### 0:45 — 1:15 · It handles it

*Click **Run agent tick now** (top right).*

> **"Now let it look at itself."**

*It takes 5–20 seconds. Narrate while it runs:*

> **"It's reading its balance, its burn rate, and — this is the part that
> matters — the PDP proving record for every provider it pays. It's checking
> whether each one is actually still holding the data before it spends another
> cent on them."**

*When the decision card appears, point at it.*

> **"Red tier. Both providers verified as still proving, so both are worth
> keeping — and it deposited enough to buy itself thirty more days. It signed
> and sent that transaction itself."**

*Click the transaction link, or point at it.*

> **"That's a real transaction hash. And every decision carries the evidence
> that produced it."**

*Expand an **EVIDENCE** block.*

---

### 1:15 — 1:40 · The decision it was built for

*Scroll to **WHAT-IF**. Click **Both at once**.*

> **"But topping up is the easy case. Here's the hard one: runway at one day,
> and a provider has stopped proving it still holds your data."**

*Point at the two decision cards.*

> **"It terminates the rail for the provider that isn't earning it — and then
> re-sizes the deposit down, to eleven cents, funding only the dataset that is
> genuinely being proven. It pays for what persists."**

> **"And note what it refuses to do: if it can't read the proof state, it will
> not delete anything. Unknown isn't the same as guilty."**

---

### 1:40 — 2:00 · Close

*Scroll to the **DATASETS** table.*

> **"Everything here is real — the balances, the payment rails, the proofs, all
> on Filecoin. And the model never makes the call: a deterministic policy
> decides, and the language model only explains it afterwards."**

> **"The transaction was never the hard part. The decision was."**

---

## After recording

The agent will be sitting at ~30 days again, so the demo is repeatable — just
reload and it's ready for another take.

If you want the runway back at exactly 30 days before a retake, run one tick:

```bash
curl -X POST https://bursar-mu.vercel.app/api/agent/tick \
  -H 'content-type: application/json' -d '{}'
```

---

## If you'd rather use ElevenLabs

The word-for-word script is in `VOICEOVER.md`. Export it as **six clips**, one
per section, into `docs/demo/audio/`:

```
1-open.mp3   2-runway.mp3   3-policy.mp3
4-triage.mp3 5-cycle.mp3    6-close.mp3
```

Then:

```bash
node scripts/sync-audio.mjs
```

That measures each clip, re-records the screen capture so every visual beat
lasts exactly as long as its narration, and muxes the result to
`docs/demo/bursar-demo.mp4` (H.264/AAC, uploads straight to X and YouTube).
