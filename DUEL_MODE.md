# Autonomous Duel Mode

## v0.7 reliability change

Kane now navigates to `http://localhost:4173/play`, a player-only surface that contains the dungeon and nothing else. The dashboard remains at `/` for the human/judge. This prevents Kane from mistaking orchestration controls for gameplay.

## What changed in v0.2

The project now has three competition-focused upgrades:

1. **BEGIN DUEL** — the browser can launch the Kane → ABLE → Kane closed loop.
2. **Before/after dependency graph** — each Kane attempt stores a snapshot of the room's item dependency graph; circular dependencies are highlighted.
3. **Kane-discovered code** — Kane is explicitly told to `store` the four-digit code it derives as `discovered_code`, and the UI reads that value only from Kane's `run_end.final_state`.

## One-click duel with Codex CLI

If `codex` is installed and authenticated, no extra project configuration is required.

Start the app:

```bash
npm start
```

Open:

```text
http://localhost:4173
```

Click **RESET DEMO**, then **BEGIN DUEL**.

The orchestrator auto-detects Codex and invokes:

```bash
codex exec --skip-git-repo-check --sandbox workspace-write "<repair prompt>"
```

The repair prompt is passed directly to Codex. `--skip-git-repo-check` keeps the downloaded hackathon project runnable even when Git tooling is unavailable. Codex is told to modify the dungeon, not the Kane verification.

## Another coding agent

Set `ABLE_AGENT_COMMAND` before starting the app. The orchestrator sends the complete repair prompt to the command's stdin.

macOS/Linux example:

```bash
export ABLE_AGENT_COMMAND="your-agent-command-that-reads-stdin"
npm start
```

PowerShell:

```powershell
$env:ABLE_AGENT_COMMAND = "your-agent-command-that-reads-stdin"
npm start
```

The command also receives:

```text
ABLE_PROMPT_FILE
ABLE_FEEDBACK_FILE
ABLE_ROOM_FILE
```

so an adapter may ignore stdin and read those files instead.

## If no agent is detected

Kane will still run from **BEGIN DUEL**. If it fails, the UI enters `ABLE needs an agent` instead of faking a repair.

That is intentional: the project never fabricates the AI part of the closed loop.

## Evidence integrity

The four displayed exit-code digits come from:

```text
run_end.final_state.discovered_code
```

not from:

```text
rooms/current-room.json -> exit.code
```

The dependency graph is saved with each verification-history entry, so the "before" and "after" views correspond to the exact room Kane attempted in those runs.
