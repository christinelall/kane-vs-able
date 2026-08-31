# KANE vs. ABLE

**Can one AI build an escape room another AI can prove is solvable?**

KANE vs. ABLE is an adversarial browser-verification game built for the TestMu AI Kane CLI Online Hackathon.

- **ABLE** — Artificial Builder of Labyrinthine Escapes — is an AI Dungeon Master powered by a coding agent.
- **Kane CLI** is the independent browser verifier.
- ABLE claims its generated dungeon is solvable.
- Kane explores only the visible browser UI and attempts to prove that claim.
- If Kane finds a real blocker, its structured result is fed back to ABLE.
- ABLE must repair the dungeon **without weakening Kane's verification**.
- Kane automatically re-enters and verifies the repaired version.

The included first dungeon contains a genuine reachability defect: the Silver Key needed to open a chest is initially inside that same chest.

## 30-second orientation

Start the app:

```bash
npm start
```

Open:

```text
http://localhost:4173
```

The human/judge watches `/`. Kane is sent to the separate player-only surface at:

```text
http://localhost:4173/play
```

Click **RESET DEMO**, then **BEGIN DUEL**.

## Prerequisites for the full live duel

The application itself has no project-level npm dependencies. The autonomous agents are external prerequisites:

- Node.js 20+
- Google Chrome
- Kane CLI authenticated with TestMu AI
- Codex CLI authenticated with OpenAI

Install/authenticate Kane:

```bash
npm install -g @testmuai/kane-cli
kane-cli login
```

Install/authenticate Codex:

```bash
npm install -g @openai/codex
codex login
```

Then:

```bash
npm start
```

Optional preflight:

```bash
npm run preflight
```

## What happens during BEGIN DUEL

```text
ABLE claims room is solvable
        ↓
Kane opens /play in Chrome
        ↓
Kane exhausts visible interactions
        ↓
PASS? ───────────────→ verified escape
  │
  no
  ↓
structured Kane evidence
        ↓
ABLE / Codex repairs rooms/current-room.json
        ↓
room schema is validated
        ↓
Kane opens /play again
        ↓
verified PASS or another repair round
```

The dashboard visualizes the exact dependency graph stored with each Kane attempt, but that graph does **not** decide Kane's verdict. Kane must discover the gameplay blocker through browser interaction.

## Integrity rules

ABLE may repair the dungeon, but it may not:

- edit Kane's objective/test to accommodate a bad room;
- hard-code a passing result;
- remove the exit requirement merely to force success;
- reveal the exit code to Kane;
- fabricate verification history;
- replace a live repair with the known-fixed template.

The repair should be the smallest legitimate change to restore a reachable user path.

## Why `/play` exists

The dashboard contains BEGIN DUEL, RESET DEMO, graphs, history, sprites, and ABLE's commentary. Those are useful to a judge but irrelevant to a player.

Kane therefore receives a dedicated `/play` route containing only:

- visible room objects;
- inventory;
- discovered clues;
- exit requirements;
- keypad;
- observable room-event log.

Kane is explicitly instructed to inspect **every visible object at least once** before concluding that the room is impossible.

## Cloud/container support

v0.7 adds the foundation for Railway/Render deployment:

- server binds to `0.0.0.0:$PORT`;
- Kane supports `--headless` automatically in Railway/Render;
- Kane can use non-interactive `KANE_USERNAME` / `KANE_ACCESS_KEY` credentials;
- Docker image includes Google Chrome, Kane CLI, and Codex CLI;
- Codex can authenticate non-interactively from `OPENAI_API_KEY` at container startup;
- `/health` and `/api/runtime-status` expose non-secret runtime readiness information;
- only one duel may run at a time;
- optional `DUEL_COOLDOWN_SECONDS` prevents rapid repeated launches.

See [`RAILWAY.md`](RAILWAY.md).

**Important:** cloud live-agent execution defaults to disabled unless `LIVE_DUEL_ENABLED=1` is explicitly set. Agent execution can consume Kane credits and OpenAI API usage, so public judge access controls/rate limits should be finalized before enabling it on an unrestricted public URL.

## CI/headless variables

Kane accepts either pair:

```text
KANE_USERNAME
KANE_ACCESS_KEY
```

or:

```text
LT_USERNAME
LT_ACCESS_KEY
```

Headless mode can be forced locally with:

```bash
KANE_HEADLESS=1 npm run verify:kane
```

Codex container authentication can use:

```text
OPENAI_API_KEY
```

The key is never committed to the project.

## Project structure

```text
kane-vs-able/
├── index.html                  # human/judge dashboard
├── play.html                   # Kane-only dungeon surface
├── Dockerfile
├── RAILWAY.md
├── AGENTS.md                   # ABLE's repair contract
├── rooms/
│   ├── current-room.json
│   └── templates/
├── scripts/
│   ├── server.mjs
│   ├── duel.mjs
│   ├── run-kane.mjs
│   ├── graph-analysis.mjs
│   ├── preflight.mjs
│   └── docker-entrypoint.sh
├── src/
│   ├── game.js
│   ├── main.js
│   ├── play.js
│   ├── style.css
│   └── play.css
├── tests/
│   └── escape-room_test.md
└── verification/
    ├── history.json
    ├── duel-state.json
    └── kane-feedback.md
```

## Useful commands

```bash
npm start
```
Start the dashboard and player surface.

```bash
npm run demo:prepare
```
Reset history and restore ABLE's deliberately impossible v1 room.

```bash
npm run duel
```
Launch the autonomous Kane → ABLE → Kane loop directly from Terminal.

```bash
npm run verify:kane
```
Run one Kane browser verification against `/play` and write structured ABLE feedback.

```bash
npm run preflight
```
Check whether Kane/Codex executables and cloud-style auth variables are available without printing secrets.

```bash
npm run room:broken
npm run room:fixed
```
Load the reference templates manually. `room:fixed` is a development backup, not the live repair path.

## Evidence integrity

The code displayed as "Kane discovered" comes from:

```text
run_end.final_state.discovered_code
```

—not from `rooms/current-room.json`.

Each verification history entry stores the exact room version and dependency graph Kane attempted, plus the Kane evidence URL when one is returned.

## Character rule

ABLE never says "bug" if a more dignified phrase is available.

Canonical metric:

```text
Times admitting fault: 0
```

See [`ABLE_CHARACTER.md`](ABLE_CHARACTER.md) and [`SPRITES.md`](SPRITES.md).
