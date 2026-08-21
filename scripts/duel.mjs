import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const statePath = path.join(root, "verification", "duel-state.json");
const feedbackPath = path.join(root, "verification", "kane-feedback.md");
const promptPath = path.join(root, "verification", "able-repair-prompt.md");
const roomPath = path.join(root, "rooms", "current-room.json");

const maxRounds = Number(process.env.ABLE_MAX_ROUNDS || 3);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeState(patch, dialogue) {
  const current = await readJson(statePath, {
    running: false,
    phase: "idle",
    round: 0,
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

  const next = {
    ...current,
    ...patch,
    dialogue: nextDialogue,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(statePath, JSON.stringify(next, null, 2) + "\n");
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: options.stdinText ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      shell: options.shell ?? (process.platform === "win32"),
      env: { ...process.env, ...(options.env || {}) },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    if (options.stdinText) {
      child.stdin.write(options.stdinText);
      child.stdin.end();
    }

    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function commandExists(command) {
  const probe = process.platform === "win32"
    ? await runProcess("where", [command], { shell: true }).catch(() => ({ code: 1 }))
    : await runProcess("sh", ["-lc", `command -v ${command}`], { shell: false }).catch(() => ({ code: 1 }));
  return probe.code === 0;
}

async function runKane(round) {
  await writeState(
    {
      running: true,
      phase: "kane_running",
      round,
      message: `Kane is attempting dungeon round ${round}.`,
    },
    {
      speaker: "KANE",
      text: `Round ${round}. Entering the dungeon with no solution provided.`,
    }
  );

  return runProcess(process.execPath, ["scripts/run-kane.mjs"], {
    env: { DUEL_MANAGED: "1", DUEL_ROUND: String(round) },
    shell: false,
  });
}

async function buildRepairPrompt(round) {
  const feedback = await fs.readFile(feedbackPath, "utf8");
  const room = await fs.readFile(roomPath, "utf8");

  return `# ABLE autonomous repair — round ${round}

You are ABLE — Artificial Builder of Labyrinthine Escapes.

Kane just attempted the current browser dungeon and FAILED.

Your single task is to repair the actual dungeon definition in:
rooms/current-room.json

STRICT RULES:
- Read AGENTS.md.
- Use Kane's evidence below.
- Repair the real gameplay dependency or clue problem.
- Do NOT edit tests/escape-room_test.md.
- Do NOT edit scripts/run-kane.mjs.
- Do NOT hard-code a pass.
- Do NOT reveal the solution to Kane.
- Do NOT weaken the exit requirements merely to force success.
- Prefer changing only rooms/current-room.json.
- Ensure the resulting file remains valid JSON.
- Increment or revise the room version.
- Update ABLE's confidence/message to reflect the repair.
- Do NOT run Kane yourself. The duel orchestrator will rerun Kane when you exit.

KANE FEEDBACK:
----------------
${feedback}

CURRENT ROOM:
-------------
${room}

Make the smallest valid repair, save it, then exit.
`;
}

async function runAbleRepair(round) {
  const prompt = await buildRepairPrompt(round);
  await fs.writeFile(promptPath, prompt);

  await writeState(
    {
      running: true,
      phase: "able_repairing",
      round,
      message: "ABLE is reading Kane's evidence and repairing the dungeon.",
    },
    {
      speaker: "ABLE",
      text: round > 1
        ? "We are now entering advanced architectural tuning. This is definitely not a second repair."
        : "I have reviewed Kane's accusation. Making a tiny, completely non-embarrassing architectural adjustment.",
      status: "warning",
    }
  );

  const configured = process.env.ABLE_AGENT_COMMAND?.trim();

  if (configured) {
    const result = await runProcess(configured, [], {
      stdinText: prompt,
      shell: true,
      env: {
        ABLE_PROMPT_FILE: promptPath,
        ABLE_FEEDBACK_FILE: feedbackPath,
        ABLE_ROOM_FILE: roomPath,
      },
    });
    return { ...result, provider: "configured agent" };
  }

  if (await commandExists("codex")) {
    const result = await runProcess(
      "codex",
      [
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        "workspace-write",
        prompt,
      ],
      { shell: false }
    );
    return { ...result, provider: "Codex CLI" };
  }

  await writeState(
    {
      running: false,
      phase: "awaiting_agent",
      message: "Kane failed, but no autonomous ABLE coding-agent command is configured.",
    },
    {
      speaker: "SYSTEM",
      text: "No local coding-agent CLI was detected. Configure ABLE_AGENT_COMMAND or use the manual AGENTS.md flow.",
      status: "failed",
    }
  );

  return { code: 90, provider: null };
}

async function validateRoom() {
  const raw = await fs.readFile(roomPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.objects) || !parsed.exit?.code) {
    throw new Error("ABLE produced a room that does not match the required schema.");
  }
}

async function main() {
  await writeState(
    {
      running: true,
      phase: "starting",
      round: 0,
      message: "The duel is starting.",
      dialogue: [],
    },
    {
      speaker: "ABLE",
      text: "My dungeon is, naturally, flawless. Kane may begin.",
    }
  );

  for (let round = 1; round <= maxRounds; round += 1) {
    const kaneResult = await runKane(round);

    if (kaneResult.code === 0) {
      await writeState(
        {
          running: false,
          phase: "complete",
          round,
          message: `Kane proved the dungeon solvable in round ${round}.`,
        },
        {
          speaker: "KANE",
          text: "Dungeon solved. Browser evidence recorded. ABLE's confidence was technically justified eventually.",
          status: "passed",
        }
      );
      process.exit(0);
    }

    await writeState(
      {
        running: true,
        phase: "kane_failed",
        round,
        message: `Kane rejected dungeon round ${round}.`,
      },
      {
        speaker: "KANE",
        text: "I cannot complete this dungeon as presented. Returning the blocking evidence to ABLE.",
        status: "failed",
      }
    );

    if (round >= maxRounds) break;

    const repair = await runAbleRepair(round);
    if (repair.code === 90) process.exit(90);

    if (repair.code !== 0) {
      await writeState(
        {
          running: false,
          phase: "agent_error",
          round,
          message: `${repair.provider || "ABLE agent"} failed before completing the repair.`,
        },
        {
          speaker: "SYSTEM",
          text: "ABLE's coding-agent process exited with an error. The dungeon was not re-verified.",
          status: "failed",
        }
      );
      process.exit(repair.code || 2);
    }

    try {
      await validateRoom();
    } catch (error) {
      await writeState(
        {
          running: false,
          phase: "agent_error",
          round,
          message: error.message,
        },
        {
          speaker: "SYSTEM",
          text: `ABLE produced invalid room data: ${error.message}`,
          status: "failed",
        }
      );
      process.exit(3);
    }

    await writeState(
      {
        running: true,
        phase: "room_repaired",
        round,
        message: "ABLE changed the dungeon. Kane will re-enter.",
      },
      {
        speaker: "ABLE",
        text: "The dungeon has been repaired. I prefer the term 'evolved.' Kane may try again.",
        status: "passed",
      }
    );
  }

  await writeState(
    {
      running: false,
      phase: "failed",
      message: `The duel ended without a verified escape after ${maxRounds} rounds.`,
    },
    {
      speaker: "SYSTEM",
      text: "Maximum repair rounds reached. Kane has not proved the dungeon solvable.",
      status: "failed",
    }
  );
  process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await writeState(
    {
      running: false,
      phase: "error",
      message: error.message,
    },
    {
      speaker: "SYSTEM",
      text: error.message,
      status: "failed",
    }
  ).catch(() => {});
  process.exit(2);
});
