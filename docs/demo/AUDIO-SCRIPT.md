# Record your narration

You record **audio only**. I'll re-time the screen capture to fit your delivery
and mux them together — so read at whatever pace feels natural. Don't try to
match a stopwatch.

---

## Setup

- **Any recorder works**: phone voice memo, Audacity, OBS, Windows Voice
  Recorder, even Discord. Quiet room, mic ~20cm from your mouth.
- **Save it as** `docs/demo/audio/narration.mp3`
  (`.wav`, `.m4a`, `.ogg` and `.flac` also work).
- Tell me when it's saved and I'll run the sync.

## The one rule that matters

> **Pause for ~2 seconds between the six sections.**

Take a breath, stay silent, then start the next one. Those pauses are how I
find your section boundaries. Everything else is flexible.

## Other notes

- **One continuous take.** Don't stop and restart the recording between
  sections — just pause.
- **Fluff a line? Just pause and say it again.** I can work around a retake,
  and small stumbles sound human.
- **Paraphrasing is fine.** I match on distinctive key phrases, not word-for-word,
  and there's a fallback that works purely off your pauses. Try to keep the
  *first sentence* of each section close to the script — that's the anchor.
- **Target ~2 minutes total.** Roughly 20 seconds per section.

## Pronunciation

| Written | Say it as |
|---|---|
| PDP | "P-D-P" (spell it out) |
| USDFC | "U-S-D-F-C" |
| Filecoin | "FILE-coin" |
| Bursar | "BUR-ser" |

---

# The script

Read the plain text. *(Italics are direction — don't read those.)*

---

## SECTION 1 — open

*Confident, unhurried. This is the hook — let it land.*

Agents can store files. What they can't do is decide whether it's worth it.

A human funds the storage, and a human notices when the money runs out. This
one doesn't need either.

*— pause 2 seconds —*

---

## SECTION 2 — runway

This is Bursar. It has its own wallet, and it's reading its own runway on
Filecoin Pay — thirty days before it can no longer pay for the storage it has
committed to.

That number is a live contract call, not a cached value.

*— pause 2 seconds —*

---

## SECTION 3 — policy

It knows what it holds, what's locked in reserve, and what it burns per month.

And right now it's deciding to do nothing. Thirty days is above its comfort
threshold, so topping up early would just lock funds it doesn't need to lock.
Declining to act is a decision too.

*— pause 2 seconds —*

---

## SECTION 4 — triage

*This is the most important section. Slow down here.*

But topping up is the easy case. Here's the hard one — runway down to one day,
and a provider has stopped proving it still holds your data.

So it terminates the rail for the provider that isn't earning it, and re-sizes
the deposit down to eleven cents, funding only the dataset that is genuinely
being proven. It pays for what persists.

And note what it refuses to do. If it can't read the proof state, it will not
delete anything. Unknown isn't the same as guilty.

*— pause 2 seconds —*

---

## SECTION 5 — cycle

*Slightly more energy — this is the part where it acts.*

> **Don't rush this one.** On screen the agent is running a real on-chain tick,
> which takes ~15 seconds no matter how fast you read. If your narration here
> is much shorter than that, the video will hold on the spinner after you've
> stopped talking. Read it at a relaxed pace and it lines up.

Now let's make it act for real.

It's reading its balance, its burn rate, and — this is the part that matters —
the P-D-P proving record for every provider it pays. It's checking whether each
one is actually still holding the data before it spends another cent on them.

Both verified as still proving, so it deposited enough to buy itself thirty
more days. It signed and sent that transaction itself, and every decision
carries the evidence that produced it.

*— pause 2 seconds —*

---

## SECTION 6 — close

*Land it. Slow, deliberate, then stop.*

Everything here is real — the balances, the payment rails, the proofs, all on
Filecoin.

And the model never makes the call. A deterministic policy decides, and the
language model only explains it afterwards.

The transaction was never the hard part. The decision was.

*— stop recording —*

---

## When you're done

Save to `docs/demo/audio/narration.mp3` and tell me. I'll run:

```bash
node scripts/sync-audio.mjs
```

which transcribes your take, finds where each section starts in **your**
delivery, re-records the screen capture so every visual beat lands on your
words, and produces `docs/demo/bursar-demo.mp4` — ready to upload.

### Prefer six separate files?

Also fine, and slightly more precise. Name them:

```
docs/demo/audio/1-open.mp3    docs/demo/audio/2-runway.mp3
docs/demo/audio/3-policy.mp3  docs/demo/audio/4-triage.mp3
docs/demo/audio/5-cycle.mp3   docs/demo/audio/6-close.mp3
```

No pauses needed in that case — I read the durations directly.
