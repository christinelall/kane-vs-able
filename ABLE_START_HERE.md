# KANE vs. ABLE — Start Here

## The one-sentence concept

**ABLE**, an AI Dungeon Master, creates a browser escape room and claims it is solvable. **Kane** tries to beat it using only the visible UI. If Kane proves the room impossible, its structured failure goes back to ABLE, which repairs the dungeon and asks Kane to try again.

## Fastest demo path

### Terminal 1 — start the app

```bash
npm start
```

Open:

```text
http://localhost:4173/play
```

### Terminal 2 — prepare the deliberately broken room

```bash
npm run demo:prepare
```

Refresh the browser.

### Verify with Kane

```bash
npm run verify:kane
```

The included broken room contains a circular dependency. Kane should fail to escape.

Then give your coding agent this instruction:

> Act as ABLE. Read `AGENTS.md` and `verification/kane-feedback.md`. Repair the current dungeon without modifying the Kane test or weakening gameplay. Run `npm run verify:kane` again and keep repairing the room until Kane proves it solvable.

The website polls `verification/history.json`, so the right-hand verification panel will update after each Kane run.

## Emergency fallback

A known-solvable room is included only as a backup:

```bash
npm run room:fixed
```

Do **not** use that as the main hackathon demo. The interesting part is showing the coding agent reason from Kane's actual failure and repair `rooms/current-room.json`.

## Kane installation

Current Kane CLI install:

```bash
npm install -g @testmuai/kane-cli
kane-cli login
```

Optional skill installer for supported coding agents:

```bash
npx @testmuai/kane-cli-skill
```
