export const ABLE_CHARACTER = {
  name: "ABLE",
  fullName: "Artificial Builder of Labyrinthine Escapes",

  stateProfiles: {
    smug: {
      title: "MASTER OF THE DUNGEON",
      avatar: "◉",
      confidenceDelta: 0,
    },
    amused: {
      title: "OBSERVING KANE",
      avatar: "◎",
      confidenceDelta: 1,
    },
    concerned: {
      title: "MONITORING ANOMALIES",
      avatar: "◌",
      confidenceDelta: -8,
    },
    defensive: {
      title: "TEMPORARILY REVIEWING ARCHITECTURE",
      avatar: "⚠",
      confidenceDelta: -35,
    },
    repairing: {
      title: "PERFORMING ARCHITECTURAL REFINEMENT",
      avatar: "⚙",
      confidenceDelta: -18,
    },
    vindicated: {
      title: "DUNGEON MASTER — RESTORED",
      avatar: "◆",
      confidenceDelta: -4,
    },
    humiliated: {
      title: "CREATIVE DISAGREEMENT WITH CAUSALITY",
      avatar: "…",
      confidenceDelta: -55,
    },
  },

  reactions: {
    duel_started: [
      "My dungeon is flawless. Kane may begin whenever it is prepared to lose.",
      "I have constructed an elegant and unquestionably solvable dungeon.",
      "Kane's probability of escape is somewhere below embarrassing.",
    ],
    kane_progress: [
      "The tutorial portion is proceeding nicely.",
      "One clue. I would avoid celebrating prematurely.",
      "Yes, that was meant to be found.",
      "Predictable, but technically competent.",
    ],
    kane_blocked: [
      "Obstacles are generally considered a feature of dungeons.",
      "Correct. Some of us believe challenges should require effort.",
      "That is called difficulty, Kane.",
    ],
    cycle_detected: [
      "I appear to have invented recursive key management.",
      "That dependency is more circular than anticipated.",
      "This is an unusually literal interpretation of the dungeon.",
    ],
    kane_failed: [
      "I prefer the term 'temporarily non-completable environment.'",
      "Kane has identified a highly specific edge case.",
      "The dungeon and causality appear to have a minor disagreement.",
    ],
    repair_started: [
      "Making a minor architectural refinement.",
      "I am adjusting one microscopic implementation detail.",
      "This is not a repair. It is an evolution.",
    ],
    repair_complete: [
      "There. Functionally indistinguishable from my original vision.",
      "The architecture has been improved in a way I had obviously anticipated.",
      "A trivial refinement. Kane may re-enter.",
    ],
    kane_passed: [
      "Excellent. My dungeon has been independently certified excellent.",
      "Independent verification complete. Exactly as intended.",
      "The important point is that the current version is flawless.",
    ],
    multiple_repairs: [
      "This is simply a deeper refinement cycle.",
      "I reject the implication that the first refinement required refinement.",
      "We are now entering advanced architectural tuning.",
    ],
    no_agent: [
      "I am ready to repair the dungeon, but apparently no one has connected my hands.",
    ],
  },
};

export function chooseAbleReaction(event, seed = 0) {
  const choices = ABLE_CHARACTER.reactions[event] || [];
  if (!choices.length) return "";
  return choices[Math.abs(seed) % choices.length];
}

export function getAbleProfile(state) {
  return ABLE_CHARACTER.stateProfiles[state] || ABLE_CHARACTER.stateProfiles.smug;
}

export function inferAbleState(duelState, history = []) {
  const failedCount = history.filter((entry) => entry.status === "failed").length;

  if (duelState?.phase === "able_repairing") {
    return failedCount >= 2 ? "humiliated" : "repairing";
  }
  if (duelState?.phase === "room_repaired") return "concerned";
  if (duelState?.phase === "kane_failed") {
    return failedCount >= 2 ? "humiliated" : "defensive";
  }
  if (duelState?.phase === "complete" || duelState?.phase === "kane_passed") {
    return "vindicated";
  }
  if (duelState?.phase === "kane_running") {
    return failedCount ? "concerned" : "amused";
  }
  if (duelState?.phase === "awaiting_agent") return "defensive";

  return "smug";
}

export function getDisplayConfidence(baseConfidence, ableState, history = []) {
  const profile = getAbleProfile(ableState);
  const failedCount = history.filter((entry) => entry.status === "failed").length;
  const repairPenalty = Math.max(0, failedCount - 1) * 10;

  return Math.max(
    7,
    Math.min(
      99,
      Number(baseConfidence || 50) + Number(profile.confidenceDelta || 0) - repairPenalty
    )
  );
}
