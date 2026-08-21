# KANE vs. ABLE

> v0.2: autonomous duel button, before/after dependency evidence, and Kane-extracted exit code.

**Can one AI build an escape room another AI can prove is solvable?**

KANE vs. ABLE is a deliberately small browser game built around a larger idea:

1. **ABLE** (Artificial Builder of Labyrinthine Escapes), an AI coding agent acting as Dungeon Master, creates a room definition.
2. **Kane CLI** attempts the room through the real browser UI without being given the solution.
3. Kane returns a structured `run_end` result.
4. A failed result becomes feedback for ABLE.
5. ABLE repairs the room definition — **not the test**.
6. Kane runs again and proves the repaired room is solvable.

The included demo room starts with a genuine circular item dependency so the first Kane attempt has something meaningful to discover.

---

## Requirements

- Node.js (Node 20+ recommended)
- Google Chrome
- Kane CLI / TestMu AI account

Install Kane:

```bash
npm install -g @testmuai/kane-cli
kane-cli login
```

Kane's current documentation recommends `--agent` when another agent or script consumes the result because it returns NDJSON and a stable `run_end` event. This project parses that terminal event in `scripts/run-kane.mjs`.

Optional, if you are using a supported coding-agent CLI:

```bash
npx @testmuai/kane-cli-skill
```

---

## Run the app

There are intentionally **no application dependencies** to install.

```bash
npm start
```

Then open:

```text
http://localhost:4173
```

The project uses a tiny Node static server so you do not have to spend hackathon time learning a framework or build tool.

---

## Run the demo loop

In a second terminal:

```bash
npm run demo:prepare
npm run verify:kane
```

The first Kane run is expected to fail because the included room is logically impossible.

After Kane fails, ask your coding agent:

> Act as ABLE. Read `AGENTS.md` and `verification/kane-feedback.md`. Repair `rooms/current-room.json` without modifying the Kane verification or weakening the game. Run `npm run verify:kane` again until Kane proves the dungeon solvable.

The browser polls `verification/history.json` every few seconds, so the verification panel updates as Kane attempts the room.

---

## What the first failure is designed to demonstrate

The broken room contains a circular dependency:

```text
Silver Key
   ↓ required to open
Moon-Locked Chest
   ↓ contains
Silver Key + Moon Seal
   ↓
Exit requires Moon Seal
```

The exit cannot be brute-forced because the keypad also requires the Moon Seal.

ABLE should reason from Kane's inability to progress and move the Silver Key somewhere accessible. The known-fixed template demonstrates one valid repair, but the AI agent should make the live fix itself.

---

## Project structure

```text
kane-vs-able/
├── index.html
├── package.json
├── AGENTS.md
├── ABLE_START_HERE.md
├── src/
│   ├── game.js
│   ├── main.js
│   └── style.css
├── rooms/
│   ├── current-room.json
│   └── templates/
│       ├── broken-room.json
│       └── fixed-room.json
├── tests/
│   └── escape-room_test.md
├── scripts/
│   ├── server.mjs
│   ├── run-kane.mjs
│   ├── select-room.mjs
│   └── reset-history.mjs
└── verification/
    ├── history.json
    └── kane-feedback.md
```

---

## Useful commands

```bash
npm start
```

Start the local site on port `4173`.

```bash
npm run demo:prepare
```

Reset verification history and load the deliberately broken room.

```bash
npm run verify:kane
```

Run Kane in `--agent` mode, parse the `run_end` event, append it to the UI history, and write a repair brief for ABLE.

```bash
npm run test:kane
```

Run the committed Markdown Kane test directly.

```bash
npm run room:broken
npm run room:fixed
```

Load the broken or known-fixed template. The fixed template is a backup/reference, not the main closed-loop demo.

```bash
npm run verify:reset
```

Clear verification history.

---

## The integrity rule

The point of the project is the feedback loop.

If Kane fails, **do not change Kane to make it pass**.

Change the dungeon.

That is the product.


---

## v0.2 competition demo

Start the server:

```bash
npm start
```

In the browser:

1. Click **RESET DEMO**.
2. Click **BEGIN DUEL**.
3. Kane launches from the local server.
4. The Live Duel panel streams Kane/ABLE state from `verification/duel-state.json`.
5. The first Kane run stores the exact dependency graph it attempted.
6. On failure, ABLE's agent receives `verification/kane-feedback.md`.
7. ABLE repairs `rooms/current-room.json`.
8. Kane re-enters automatically.
9. A successful run displays the code Kane independently stored as `discovered_code`.
10. The UI shows the failed and repaired graphs side by side.

See `DUEL_MODE.md` for coding-agent configuration.


---

## ABLE as a character

ABLE now has a scripted reactive character layer.

Real duel phases drive ABLE through states such as `smug`, `defensive`, `repairing`, and `vindicated`. The state affects ABLE's title, avatar, dialogue, and deliberately-not-scientific confidence meter.

If Kane detects a circular dependency, ABLE's confidence display glitches before collapsing.

ABLE's sidebar also tracks "dignity metrics," including the canonical:

```text
Times admitting fault: 0
```

See `ABLE_CHARACTER.md`.


---

## v0.4 — pixel character sprites

Kane and ABLE now have state-driven retro character portraits.

Kane moves through idle → investigating → evidence → victory. ABLE moves through smug/amused → glitching when caught → architect mode while repairing. The portraits appear in ABLE's character card, the live duel stage, and the win overlay.

See `SPRITES.md`.
