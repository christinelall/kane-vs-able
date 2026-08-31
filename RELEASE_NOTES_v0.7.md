# v0.7 — Player Surface + Cloud Foundation

- Added `/play`: a dedicated player-only dungeon surface for Kane.
- Kane no longer sees BEGIN DUEL, RESET DEMO, graphs, history, or orchestration UI.
- Tightened Kane's objective: inspect every visible object before declaring impossibility and never guess missing clue digits.
- Kane now records whether a run was headed/headless and the player URL used.
- Added headless/CI authentication support via `KANE_USERNAME` + `KANE_ACCESS_KEY` (or `LT_USERNAME` + `LT_ACCESS_KEY`).
- Server now binds to `0.0.0.0:$PORT` and includes `/health` and `/api/runtime-status`.
- Existing one-duel-at-a-time lock retained, with optional cooldown support.
- Added Dockerfile containing Chrome, Kane CLI, and Codex CLI.
- Added non-interactive Codex API-key login on container startup.
- Cloud live-duel execution defaults OFF unless explicitly enabled.
