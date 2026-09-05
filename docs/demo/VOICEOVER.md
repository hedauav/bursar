# Demo video — voiceover script

Recorded against the live site at `https://bursar-mu.vercel.app`.
Video: `docs/demo/bursar-walkthrough.webm` (~60s, silent).

**How to use:** play the video, read the lines at the marked times. Aim for an
unhurried pace — roughly 145 words/minute. Total script ≈ 155 words.

---

### 0:00 — 0:08 · Opening

> "Agents can store files. What they can't do is decide whether it's worth it.
> This one can."

*(on screen: the dashboard loads, runway meter lands)*

---

### 0:08 — 0:16 · The runway

> "This is Bursar. It has its own wallet, and it's reading its own runway on
> Filecoin Pay — thirty days before it can no longer pay for the storage it
> committed to. Those markers are its own policy thresholds."

---

### 0:16 — 0:26 · Balances and rules

> "It knows what it holds, what's locked, and what it burns per month. And the
> rules it follows are deterministic — the same on-chain state always produces
> the same decision. No model gets a vote here."

---

### 0:26 — 0:42 · The decision that matters

> "Here's the interesting case. Runway down to one day, and one provider has
> stopped proving it still holds the data.
>
> So the agent doesn't just top up. It terminates the rail for the provider
> that isn't earning it — and re-sizes the deposit down to eleven cents, for
> only the dataset that's genuinely being proven."

*(on screen: PRUNE_DATASET, then TOP_UP 0.1120 USDFC)*

---

### 0:42 — 0:56 · A real cycle

> "Let's make it act for real. It reads the chain, classifies itself, decides —
> and when it needs to, it signs and sends the transaction itself. Every
> decision is logged with the evidence behind it and a plain-English summary."

*(on screen: tick runs, decision card appears in the feed)*

---

### 0:56 — 1:05 · Close

> "Every number here is a live contract call. The proofs, the balances, the
> payments — all real, all on Filecoin Calibration.
>
> The transaction was never the hard part. The decision was."

---

## Alternative 30-second cut

> "Agents can store files. They can't decide whether it's worth it.
>
> Bursar reads its own runway on Filecoin Pay. When money gets tight it checks
> whether each provider is actually proving it still holds the data — cuts the
> ones that aren't, and funds only what's left.
>
> It signs its own transactions. A deterministic policy decides; the model only
> explains afterwards.
>
> Live, on Filecoin Calibration. The decision is the product."

---

## Recording notes

- The screen recording is silent — record voice separately and lay it over, or
  narrate live while replaying the video.
- If you'd rather re-record the capture at a different pace, edit the `beat()`
  timings in `scripts/record-demo.mjs` and re-run `node scripts/record-demo.mjs`.
- `.webm` uploads fine to X and YouTube. For LinkedIn or iOS, convert first:
  `ffmpeg -i bursar-walkthrough.webm -c:v libx264 -pix_fmt yuv420p bursar.mp4`
