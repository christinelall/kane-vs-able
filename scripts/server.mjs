import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const statePath = path.join(root, "verification", "duel-state.json");
const historyPath = path.join(root, "verification", "history.json");
const feedbackPath = path.join(root, "verification", "kane-feedback.md");
const brokenRoomPath = path.join(root, "rooms", "templates", "broken-room.json");
const currentRoomPath = path.join(root, "rooms", "current-room.json");
const cloudRuntime = Boolean(process.env.RAILWAY_ENVIRONMENT) || Boolean(process.env.RENDER);
const liveDuelEnabled = process.env.LIVE_DUEL_ENABLED == null
  ? !cloudRuntime
  : process.env.LIVE_DUEL_ENABLED === "1";
const duelCooldownMs = Math.max(0, Number(process.env.DUEL_COOLDOWN_SECONDS || 0) * 1000);

let duelProcess = null;
let lastDuelStartedAt = 0;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function commandExists(command) {
  return new Promise((resolve) => {
    const probe = spawn(process.platform === "win32" ? "where" : "sh", process.platform === "win32" ? [command] : ["-lc", `command -v ${command}`], {
      stdio: "ignore",
      shell: false,
    });
    probe.on("error", () => resolve(false));
    probe.on("close", (code) => resolve(code === 0));
  });
}

async function runtimeStatus() {
  const [kaneInstalled, codexInstalled] = await Promise.all([
    commandExists(process.platform === "win32" ? "kane-cli.cmd" : "kane-cli"),
    commandExists(process.platform === "win32" ? "codex.cmd" : "codex"),
  ]);

  return {
    ok: true,
    liveDuelEnabled,
    duelRunning: Boolean(duelProcess),
    host,
    port,
    playerPath: "/play",
    headless: process.env.KANE_HEADLESS === "1" || Boolean(process.env.RAILWAY_ENVIRONMENT) || Boolean(process.env.RENDER),
    kane: {
      installed: kaneInstalled,
      authMode:
        (process.env.KANE_USERNAME || process.env.LT_USERNAME) &&
        (process.env.KANE_ACCESS_KEY || process.env.LT_ACCESS_KEY)
          ? "environment credentials"
          : "stored profile / not checked",
    },
    able: {
      codexInstalled,
      authMode: process.env.OPENAI_API_KEY
        ? "API key environment"
        : process.env.CODEX_ACCESS_TOKEN
          ? "Codex access token environment"
          : "stored login / not checked",
    },
  };
}

async function startDuel(res) {
  if (!liveDuelEnabled) {
    jsonResponse(res, 503, { ok: false, error: "Live duel is disabled on this deployment." });
    return;
  }

  if (duelProcess) {
    jsonResponse(res, 409, { ok: false, error: "A duel is already running." });
    return;
  }

  const now = Date.now();
  if (duelCooldownMs && now - lastDuelStartedAt < duelCooldownMs) {
    const retryAfter = Math.ceil((duelCooldownMs - (now - lastDuelStartedAt)) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    jsonResponse(res, 429, { ok: false, error: `Duel cooldown active. Try again in ${retryAfter}s.` });
    return;
  }

  lastDuelStartedAt = now;
  duelProcess = spawn(process.execPath, ["scripts/duel.mjs"], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  duelProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
  duelProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));

  duelProcess.on("close", () => {
    duelProcess = null;
  });

  duelProcess.on("error", (error) => {
    console.error("Duel process error:", error);
    duelProcess = null;
  });

  jsonResponse(res, 202, { ok: true, started: true });
}

async function resetDemo(res) {
  if (duelProcess) {
    jsonResponse(res, 409, { ok: false, error: "Cannot reset while a duel is running." });
    return;
  }

  const broken = await fs.readFile(brokenRoomPath, "utf8");
  JSON.parse(broken);
  await fs.writeFile(currentRoomPath, broken);
  await fs.writeFile(historyPath, "[]\n");
  await fs.writeFile(
    feedbackPath,
    "# Kane Feedback for ABLE\n\nNo verification run has been recorded yet.\n"
  );
  await fs.writeFile(
    statePath,
    JSON.stringify(
      {
        running: false,
        phase: "idle",
        round: 0,
        message: "Demo reset. ABLE is confident again.",
        dialogue: [
          {
            speaker: "ABLE",
            text: "I have restored my original flawless design.",
            status: "neutral",
            timestamp: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n"
  );

  jsonResponse(res, 200, { ok: true });
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (req.method === "GET" && pathname === "/health") {
      jsonResponse(res, 200, { ok: true, service: "kane-vs-able" });
      return;
    }

    if (req.method === "GET" && pathname === "/api/runtime-status") {
      jsonResponse(res, 200, await runtimeStatus());
      return;
    }

    if (req.method === "POST" && pathname === "/api/duel") {
      await startDuel(res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/demo-reset") {
      await resetDemo(res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/duel-state") {
      try {
        const raw = await fs.readFile(statePath, "utf8");
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(raw);
      } catch {
        jsonResponse(res, 200, {
          running: false,
          phase: "idle",
          round: 0,
          message: "Ready.",
          dialogue: [],
        });
      }
      return;
    }

    let fileRequest = pathname;
    if (fileRequest === "/") fileRequest = "/index.html";
    if (fileRequest === "/play" || fileRequest === "/play/") fileRequest = "/play.html";

    const candidate = path.resolve(root, `.${fileRequest}`);
    if (!candidate.startsWith(root + path.sep) && candidate !== root) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const stat = await fs.stat(candidate);
    const filePath = stat.isDirectory() ? path.join(candidate, "index.html") : candidate;
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    res.end(body);
  } catch (error) {
    if (error?.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    console.error(error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Server error");
  }
});

server.listen(port, host, () => {
  console.log("");
  console.log("KANE vs. ABLE is running.");
  console.log(`Dashboard: http://localhost:${port}`);
  console.log(`Kane player surface: http://localhost:${port}/play`);
  console.log(`Listening on ${host}:${port}`);
  console.log("");
});
