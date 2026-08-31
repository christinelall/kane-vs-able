import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { analyzeRoom } from "./graph-analysis.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const verificationDir = path.join(root, "verification");
const historyPath = path.join(verificationDir, "history.json");
const feedbackPath = path.join(verificationDir, "kane-feedback.md");
const latestPath = path.join(verificationDir, "latest-kane-result.json");
const rawPath = path.join(verificationDir, "raw-kane.ndjson");
const duelStatePath = path.join(verificationDir, "duel-state.json");
const roomPath = path.join(root, "rooms", "current-room.json");

const port = Number(process.env.PORT || 4173);
const appUrl =
  process.env.KANE_PLAY_URL ||
  process.env.APP_URL ||
  `http://127.0.0.1:${port}/play`;
const managed = process.env.DUEL_MANAGED === "1";
const managedRound = Number(process.env.DUEL_ROUND || 0);
const headless =
  process.env.KANE_HEADLESS === "1" ||
  Boolean(process.env.RAILWAY_ENVIRONMENT) ||
  Boolean(process.env.RENDER);
const kaneUsername = process.env.KANE_USERNAME || process.env.LT_USERNAME || "";
const kaneAccessKey = process.env.KANE_ACCESS_KEY || process.env.LT_ACCESS_KEY || "";

const objective = [
  "You are KANE, independently verifying an escape room created by ABLE.",
  "You are already on the player-only dungeon page. There are no orchestration controls on this page.",
  "Solve the room only through visible browser interactions. Do not inspect source files, network data, developer tools, or hidden application state.",
  "Inspect every visible room object at least once before declaring the room impossible.",
  "If an object is locked, record what item it requires, then continue inspecting every other visible object that can still be attempted.",
  "Collect items and clues only when the UI visibly reveals them.",
  "The final keypad uses the visible color sequence. Derive each digit only from clues you actually discovered; do not guess missing digits.",
  "Once you have independently derived the complete four-digit code, store it as 'discovered_code'.",
  'Enter that code and verify the page displays "YOU ESCAPED".',
  "Only fail as logically impossible after every visible room object has been attempted and a required item or clue still has no reachable acquisition path.",
  "When failing for impossibility, explain the observed blocking dependency using the object and item names shown in the browser.",
  "If you determine the room is logically impossible after exhausting the visible objects, immediately end the run as FAILED. Do not keep clicking, retrying, or guessing. State LOGICALLY IMPOSSIBLE and name the blocking dependency.",
].join(" ");

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function updateDuelState(patch, dialogue) {
  if (!managed) return;

  const current = await readJson(duelStatePath, {
    running: true,
    phase: "kane_running",
    round: managedRound,
    dialogue: [],
  });

  const nextDialogue = Array.isArray(current.dialogue) ? current.dialogue : [];
  if (dialogue) {
    nextDialogue.push({
      speaker: dialogue.speaker,
      text: dialogue.text,
      status: dialogue.status || "neutral",
      timestamp: new Date().toISOString(),
    });
    while (nextDialogue.length > 30) nextDialogue.shift();
  }

  await fs.writeFile(
    duelStatePath,
    JSON.stringify(
      {
        ...current,
        ...patch,
        dialogue: nextDialogue,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n"
  );
}

await fs.mkdir(verificationDir, { recursive: true });
await fs.writeFile(rawPath, "");

console.log("");
console.log("KANE vs. ABLE — verification run");
console.log(`Player target: ${appUrl}`);
console.log(`Browser mode: ${headless ? "headless" : "headed"}`);
console.log(`Kane auth: ${kaneUsername && kaneAccessKey ? "per-run basic auth" : "stored profile"}`);
console.log("");

await updateDuelState({
  running: true,
  phase: "kane_running",
  round: managedRound || undefined,
  message: "Kane is exploring the player-only dungeon through Chrome.",
});

const command = process.platform === "win32" ? "kane-cli.cmd" : "kane-cli";
const kaneArgs = [
  "run", objective,
  "--url", appUrl,
  "--agent",
  "--max-steps", process.env.KANE_MAX_STEPS || "40",
  "--timeout", process.env.KANE_TIMEOUT || "120",
];
if (headless) kaneArgs.push("--headless");
if (kaneUsername && kaneAccessKey) {
  kaneArgs.push("--username", kaneUsername, "--access-key", kaneAccessKey);
}

const child = spawn(command, kaneArgs, {
  cwd: root,
  stdio: ["ignore", "pipe", "inherit"],
  shell: false,
  env: process.env,
});

let runEnd = null;
const progress = [];
const rawLines = [];

const rl = readline.createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  rawLines.push(trimmed);
  console.log(trimmed);

  try {
    const event = JSON.parse(trimmed);
    if (event?.type === "run_end") {
      runEnd = event;
    } else if (typeof event?.step === "number") {
      progress.push(event);
      await updateDuelState(
        {
          phase: "kane_running",
          lastKaneStep: {
            step: event.step,
            status: event.status,
            remark: event.remark || "",
          },
        },
        event.remark
          ? {
              speaker: "KANE",
              text: event.remark,
              status: event.status === "failed" ? "failed" : "neutral",
            }
          : null
      );
    }
  } catch {
    // Preserve unstructured lines in the raw log, but do not automate against them.
  }
});

const exitCode = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("close", resolve);
}).catch(async (error) => {
  const help = [
    "# Kane Feedback for ABLE",
    "",
    "## Infrastructure error",
    "",
    `Could not start Kane CLI: ${error.message}`,
    "",
    "This is not a dungeon-design failure. Check that Kane is installed and authenticated.",
    "",
  ].join("\n");

  await fs.writeFile(feedbackPath, help);
  await updateDuelState({
    running: false,
    phase: "kane_error",
    message: "Kane CLI could not be launched.",
  });
  console.error("");
  console.error("Could not launch kane-cli.");
  process.exit(2);
});

await fs.writeFile(rawPath, rawLines.join("\n") + (rawLines.length ? "\n" : ""));

if (!runEnd) {
  const help = [
    "# Kane Feedback for ABLE",
    "",
    "## Verification infrastructure problem",
    "",
    `Kane exited with code ${exitCode}, but no stable \`run_end\` event was captured.`,
    "",
    "Do not modify the dungeon yet. This is not evidence of a gameplay failure.",
    "",
    "Inspect `verification/raw-kane.ndjson` and Kane authentication/Chrome setup.",
    "",
  ].join("\n");

  await fs.writeFile(feedbackPath, help);
  await updateDuelState({
    running: false,
    phase: "kane_error",
    message: "No stable Kane run_end event was captured.",
  });
  process.exit(exitCode || 2);
}

await fs.writeFile(latestPath, JSON.stringify(runEnd, null, 2) + "\n");

let history = await readJson(historyPath, []);
if (!Array.isArray(history)) history = [];

const roomSnapshot = await readJson(roomPath, {});
const graph = analyzeRoom(roomSnapshot);
const discoveredCode =
  runEnd.final_state?.discovered_code ??
  runEnd.final_state?.discoveredCode ??
  null;

const entry = {
  attempt: history.length + 1,
  round: managedRound || null,
  status: runEnd.status,
  summary: runEnd.summary || runEnd.one_liner || "",
  reason: runEnd.reason || "",
  duration: runEnd.duration ?? null,
  credits: runEnd.credits ?? null,
  discoveredCode: discoveredCode == null ? null : String(discoveredCode),
  finalState: runEnd.final_state || {},
  timestamp: new Date().toISOString(),
  testUrl: runEnd.test_url || null,
  roomVersion: roomSnapshot.version || null,
  roomName: roomSnapshot.name || null,
  playerUrl: appUrl,
  browserMode: headless ? "headless" : "headed",
  graph,
};

history.push(entry);
await fs.writeFile(historyPath, JSON.stringify(history, null, 2) + "\n");

const progressLines = progress.length
  ? progress.map(
      (step) =>
        `- Step ${step.step}: **${String(step.status).toUpperCase()}** — ${step.remark || "No remark"}`
    )
  : ["- No progress-step events were captured."];

const feedback = [
  "# Kane Feedback for ABLE",
  "",
  `## Attempt ${entry.attempt}: ${String(entry.status).toUpperCase()}`,
  "",
  `**Summary:** ${entry.summary || "No summary returned."}`,
  "",
  `**Reason:** ${entry.reason || "No reason returned."}`,
  "",
  `**Kane-discovered exit code:** ${entry.discoveredCode || "Not captured before termination."}`,
  "",
  `**Static dependency cycle detected in this room snapshot:** ${graph.hasCycle ? "YES" : "NO"}`,
  "",
  "## Browser observations",
  "",
  ...progressLines,
  "",
  "## ABLE's next action",
  "",
  entry.status === "passed"
    ? "Kane proved the current dungeon browser-solvable. Stop repairing it."
    : [
        "Treat this as evidence about the dungeon, not as permission to weaken verification.",
        "",
        "1. Inspect `rooms/current-room.json`.",
        "2. Identify the real inaccessible item, circular dependency, missing clue, contradictory sequence, or other gameplay blocker supported by Kane's result.",
        "3. Repair the room definition.",
        "4. Do **not** edit the Kane objective/test to make the failure disappear.",
        "5. Let the duel orchestrator rerun Kane.",
      ].join("\n"),
  "",
].join("\n");

await fs.writeFile(feedbackPath, feedback);

await updateDuelState(
  {
    phase: runEnd.status === "passed" ? "kane_passed" : "kane_failed",
    message:
      runEnd.status === "passed"
        ? "Kane proved the dungeon solvable."
        : "Kane rejected the dungeon and returned evidence to ABLE.",
    latestResult: {
      status: entry.status,
      summary: entry.summary,
      discoveredCode: entry.discoveredCode,
      duration: entry.duration,
      testUrl: entry.testUrl,
    },
  },
  {
    speaker: "KANE",
    text:
      runEnd.status === "passed"
        ? `Verified escape${entry.discoveredCode ? ` with independently discovered code ${entry.discoveredCode}` : ""}.`
        : entry.summary || entry.reason || "Dungeon failed verification.",
    status: runEnd.status === "passed" ? "passed" : "failed",
  }
);

console.log("");
console.log(`Kane status: ${String(runEnd.status).toUpperCase()}`);
if (entry.discoveredCode) console.log(`Kane discovered code: ${entry.discoveredCode}`);
console.log(`History updated: verification/history.json`);
console.log(`ABLE feedback: verification/kane-feedback.md`);
if (runEnd.test_url) console.log(`Evidence: ${runEnd.test_url}`);
console.log("");

process.exit(runEnd.status === "passed" ? 0 : 1);
