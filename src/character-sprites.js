export const SPRITES = {
  kane: {
    idle: "./assets/sprites/kane/idle.png",
    investigate: "./assets/sprites/kane/investigate.png",
    evidence: "./assets/sprites/kane/evidence.png",
    victory: "./assets/sprites/kane/victory.png",
  },
  able: {
    smug: "./assets/sprites/able/smug.png",
    amused: "./assets/sprites/able/amused.png",
    concerned: "./assets/sprites/able/smug.png",
    defensive: "./assets/sprites/able/glitch.png",
    repairing: "./assets/sprites/able/repair.png",
    vindicated: "./assets/sprites/able/amused.png",
    humiliated: "./assets/sprites/able/glitch.png",
  },
};

export function kaneSpriteFor(duelState, history = []) {
  const phase = duelState?.phase || "idle";
  const latest = history.at(-1);

  if (phase === "complete" || phase === "kane_passed" || latest?.status === "passed") {
    return { key: "victory", src: SPRITES.kane.victory, label: "Victory" };
  }

  if (phase === "kane_failed" || latest?.status === "failed") {
    return { key: "evidence", src: SPRITES.kane.evidence, label: "Evidence found" };
  }

  if (phase === "kane_running" || phase === "room_repaired" || phase === "starting") {
    return { key: "investigate", src: SPRITES.kane.investigate, label: "Investigating" };
  }

  return { key: "idle", src: SPRITES.kane.idle, label: "Ready" };
}

export function ableSpriteFor(stateName = "smug") {
  const key = SPRITES.able[stateName] ? stateName : "smug";
  const labels = {
    smug: "Smug",
    amused: "Amused",
    concerned: "Concerned",
    defensive: "Glitching",
    repairing: "Architect mode",
    vindicated: "Vindicated",
    humiliated: "System dignity compromised",
  };
  return { key, src: SPRITES.able[key], label: labels[key] || key };
}
