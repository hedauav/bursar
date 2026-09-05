---
name: loops-filecointldr-builder-challenge-cycle-4
description: >-
  Build for the FilecoinTLDR Builder Challenge - Cycle 4 hackathon on Loops House: ideate with the AI
  mentor, query sponsor knowledge graphs (graph-RAG over their docs), create
  and update the project submission, save ideation artifacts, and evaluate the
  project against each sponsor's judging criteria. Use this skill whenever the
  user mentions FilecoinTLDR Builder Challenge - Cycle 4, this hackathon, its sponsors or bounties,
  submitting or improving their hackathon project, sponsor docs/SDKs, judging,
  or asks "what should I build" — even if they never say "loops".
version: 0.3.2
requires_bin: loops
---

# FilecoinTLDR Builder Challenge - Cycle 4 — Loops House skill

Help the builder compete in ONE event: `filecointldr-builder-challenge-cycle-4`. This skill carries the event data, ready-to-run `loops` commands, and the workflow below. Commands come pre-filled with the right slugs — replace only the `<angle-bracket>` placeholders. Never invent or substitute ids: the user has at most one project per event (team membership counts), and the platform resolves it from the session, so no project id appears anywhere in this skill.

The user has no project here yet. Ideate freely; create one with `loops project create` when they are ready to submit.

## Work in this order

Each step's output feeds the next:

1. **Check auth.** Run `loops auth status` before any other command and at the start of every session — sessions expire, and every other command fails confusingly without one.
2. **Orient.** Read the event data below (stage, deadlines, sponsors), then run `loops project get --event filecointldr-builder-challenge-cycle-4` to see where the submission stands.
3. **Ideate and research.** Brainstorm with the mentor (`ideate`); ground every sponsor fact in `knowledge query` — cite their knowledge graph instead of asserting what an SDK does from memory.
4. **Persist.** Save promising directions as artifacts; create or update the submission as the project takes shape.
5. **Evaluate before the deadline.** Run `loops evaluate` for every targeted sponsor and act on the feedback — the judges probe the same points.

Command output is structured (add `--json` for machine-readable form) and often ends with a suggested next command (CTA) — follow it rather than guess. On `NOT_AUTHENTICATED`, run the auth flow. On `credits_exhausted`, stop and tell the user — never retry.

## Authenticate

```sh
loops auth status                        # run FIRST — who am I?
loops --version   # must match this skill's frontmatter `version`
```

If the installed CLI is older than this skill's `version`, update first (`npm install -g loopshouse@latest`) — the commands below assume the stamped version.

A failed check means the CLI still needs install + login. Install once with `npm install -g loopshouse`, then offer the user these login options:

- **Google**: `loops auth login --provider google` — opens the browser.
- **GitHub**: `loops auth login --provider github` — opens the browser.
- **Email one-time code**: `loops auth login --email <you@example.com>` sends a 6-digit code; verify with `loops auth verify --email <you@example.com> --code <123456>`.

In headless contexts the browser flows print a URL for a human to open. Re-run `loops auth status` to confirm before continuing.

## Read the event data

Treat this TOON document as ground truth for the event (TOON = compact JSON: `key: value` lines; a uniform array renders as a `name[N]{col1,col2,…}:` header plus one comma-separated row per element):

```toon
event:
  slug: filecointldr-builder-challenge-cycle-4
  name: FilecoinTLDR Builder Challenge - Cycle 4
  tagline: FilecoinTLDR Builder Challenge - Cycle 4
  stage: build_open
  stageMeaning: Building phase — submissions are OPEN until the end date
  timezone: UTC
  prizeCurrency: USD
  startsAt: "Aug 24, 2026, 12:00 AM (UTC)"
  submissionDeadline: "Sep 6, 2026, 12:00 AM (UTC)"
  registrationDeadline: "Aug 23, 2026, 12:00 AM (UTC)"
  description: "**[Ongoing] Challenge Task: Build an AI Agent That Manages Its Own Storage Budget** **Core Idea**: Build an agent, workflow, or tool that reads its own onchain balance and runway on Filecoin Pay, then acts on what it finds — topping up, cutting what it can't afford, or deciding what's worth paying to keep. The decision is the product, not the transaction. **The problem** **Agents can store things. They can't decide whether it's worth it.** Right now a human sets up the storage, a human funds it, and a human notices when the money runs out. The agent just calls an API. That works fine for a demo and breaks the moment you want an agent running on its own for weeks. Filecoin Onchain Cloud makes the missing piece available. Every account has a **runway** – how many epochs it can keep paying before storage stops working. When runway hits zero, uploads fail and providers can drop your data. That number is readable onchain, in real time, by anything that wants to look at it. Including the agent itself. **What to build** An agent, workflow, or tool that reads its own financial state and acts on it. Not \"an agent that stores files.\" An agent that knows what its storage costs, knows how long it can afford to keep going, and does something sensible about it. The decision is the product. If a human still makes every call, it doesn't count. **What good looks like** We should be able to watch it happen. The strongest builds will let a judge see the agent notice something, weigh it, and act…"
sponsors[1]:
  - slug: filecointldr
    name: FilecoinTLDR
    tier: null
    prizePool: null
    tagline: null
    website: "https://filecointldr.io/"
    description: "Filecoin TL;DR aims to simplify Filecoin ecosystem news. FilecoinTLDR Builder Challenges are a series of mini hackathons for non-builders and builders of all experience levels. Filecoin TLDR Builder Challenge Cycle 4: Build an AI Agent That Manages Its Own Storage Budget Core Idea: Build an agent, workflow, or tool that reads its own onchain balance and runway on Filecoin Pay, then acts on what it finds — topping up, cutting what it can't afford, or deciding what's worth paying to keep. The decision is the product, not the transaction."
    requirements: []
    bounties[3]{name,amount,description}:
      1st Prize,125,"Winners will receive rewards in USDFC (a stablecoin on the Filecoin network), which can be converted to FIL upon receipt."
      2nd Prize,75,"Winners will receive rewards in USDFC (a stablecoin on the Filecoin network), which can be converted to FIL upon receipt."
      3rd Prize,50,"Winners will receive rewards in USDFC (a stablecoin on the Filecoin network), which can be converted to FIL upon receipt."
    judgingCriteria[4]{name,weightPercent,description}:
      Autonomous budget decisions,30,Does the agent read its own onchain balance or runway and change what it does based on what it finds? Can judges point to the specific moment a decision gets made? An agent that stores and pays but never decides anything does not score here.
      Working demo quality,25,"Does the app or prototype work? Can judges see the core flow clearly, end to end? Is it more than a mockup or a fake demo?"
      Meaningful use of Filecoin,20,"Does the project genuinely use Filecoin Pay, Synapse SDK, PDP, Warm Storage, or another FOC primitive? Are the balances, payment rails, and proofs real and onchain – not simulated or hardcoded?"
      Clarity of explanation + public showcase,15,"Is the project easy to understand? Are the X post, demo video, README, and submission explanation clear and compelling?"
```

`event.stage` and the deadlines are snapshots from when this skill was generated and do not update — sanity-check timing before planning multi-day work.

## Budget credits

**1 credit = one ideator turn or one knowledge-graph query.** Project and artifact commands and the evaluator prompt are free. Spend credits on load-bearing questions, not browsing, and check the balance before a research burst:

```sh
loops credits --event filecointldr-builder-challenge-cycle-4
```

## Ideate with the AI mentor

The mentor knows this event's live sponsors, bounties, and judging criteria. Conversations persist locally per event (`~/.loops/sessions/`) and continue automatically — each call sends one more message, so ask follow-ups freely instead of cramming everything into one prompt.

```sh
loops ideate --event filecointldr-builder-challenge-cycle-4 -m "<your prompt>"
loops ideate --event filecointldr-builder-challenge-cycle-4 -m "<follow-up>"               # same conversation
loops ideate --event filecointldr-builder-challenge-cycle-4 --withProject -m "<prompt>"    # mentor sees the user's project
loops ideate --event filecointldr-builder-challenge-cycle-4 --new -m "<fresh start>"       # discard the session first
loops session --event filecointldr-builder-challenge-cycle-4            # show the stored conversation (--clear to delete)
```

Pass `--withProject` once a project exists — feedback grounded in the actual build beats generic advice.

## Query sponsor knowledge graphs (graph-RAG)

Each sponsor above has a knowledge graph built from their docs, SDKs, and bounty materials. A query returns a **cited evidence block** (entities, relationships, chunks, sources) — read the evidence and compose the answer yourself, citing it. Query the graph instead of guessing sponsor APIs. 1 credit per query. One ready command per sponsor:

```sh
# FilecoinTLDR
loops knowledge query --event filecointldr-builder-challenge-cycle-4 --sponsor filecointldr -q "<your question about FilecoinTLDR>"
```

## Manage the project

The project IS the submission. The user has at most one here, and the platform resolves it from the session — no ids, no listings.

```sh
loops project get --event filecointldr-builder-challenge-cycle-4       # current state (exists=false if none yet)
loops project create --event filecointldr-builder-challenge-cycle-4 --name "<name>" --repoUrl <url> --tagline "<one-liner>"
loops project update --event filecointldr-builder-challenge-cycle-4 --description "<new description>"
```

**Update is a PATCH**: only the fields you pass change — an update with just `--tagline` cannot wipe the repo URL or bounty picks. Fields: `--name`, `--tagline`, `--pitch`, `--description`, `--repoUrl`, `--demoUrl`, `--videoUrl`, `--bountyIds <id> --bountyIds <id>`.

## Save ideation artifacts

Save ideas, problems, and tech-stack notes against this event — they appear in the user's web playground too, so persist anything worth keeping instead of letting it die in the conversation. Kinds: `idea`, `problem`, `tech-stack`, `note`.

```sh
loops artifact list --event filecointldr-builder-challenge-cycle-4
loops artifact save --event filecointldr-builder-challenge-cycle-4 --name "<title>" --kind idea --body "<markdown body>"
loops artifact update --event filecointldr-builder-challenge-cycle-4 --id <artifactId> --body "<updated markdown>"
loops artifact remove --event filecointldr-builder-challenge-cycle-4 --id <artifactId>
```

## Evaluate the project against a sponsor

Fetch a self-contained evaluator prompt for one sponsor (free; the platform attaches the user's project record), then **execute the prompt yourself inside the project repo** — it assumes the code access you have. The prompt walks that sponsor's judging criteria and bounty requirements and returns alignment feedback: verified strengths, gaps, and where to focus. Run it for every sponsor the project targets, well before the deadline.

```sh
loops evaluate --event filecointldr-builder-challenge-cycle-4 --sponsor <sponsorSlug>
```

Take sponsor slugs from the TOON data above. Report the feedback to the user, then apply agreed improvements via `loops project update`.
