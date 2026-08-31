# Railway deployment notes

The project is now container-ready, but the public live-agent switch is intentionally conservative.

## What the container contains

- Node.js
- Google Chrome
- Kane CLI
- Codex CLI
- KANE vs. ABLE server + dashboard + `/play` player surface

The server binds to `0.0.0.0:$PORT`, which works with Railway's injected `PORT`.

## Required secrets for a real cloud duel

Set these in Railway Variables. Never commit them to GitHub.

```text
KANE_USERNAME=<TestMu AI username>
KANE_ACCESS_KEY=<TestMu AI access key>
OPENAI_API_KEY=<OpenAI Platform API key>
LIVE_DUEL_ENABLED=1
```

Optional:

```text
ABLE_MAX_ROUNDS=3
KANE_MAX_STEPS=40
DUEL_COOLDOWN_SECONDS=120
```

Kane receives username/access-key flags on each headless run. Codex is authenticated at container startup using the API key.

## Safety note

On cloud runtimes, live duel execution defaults to OFF unless `LIVE_DUEL_ENABLED=1` is explicitly set. The public endpoint can spend Kane credits and OpenAI API usage, so do not enable it on an unrestricted public deployment until rate limiting / judge access controls are finalized.

The public Judge Replay mode can remain available without live-agent credentials or spend.
