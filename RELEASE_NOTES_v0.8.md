# v0.8 — Kane stall safety

- Added a 120-second hard timeout to Kane runs (override with `KANE_TIMEOUT`).
- Tightened the objective so Kane explicitly ends FAILED once it proves the dungeon logically impossible.
- Duel now fails closed: ABLE may repair only after Kane exits with ordinary verification failure code 1. Timeouts, cancellations, and infrastructure errors cannot trigger an autonomous repair.
