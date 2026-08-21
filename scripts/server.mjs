import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const statePath = path.join(root, "verification", "duel-state.json");
const historyPath = path.join(root, "verification", "history.json");
const feedbackPath = path.join(root, "verification", "kane-feedback.md");
const brokenRoomPath = path.join(root, "rooms", "templates", "broken-room.json");
const currentRoomPath = path.join(root, "rooms", "current-room.json");

let duelProcess = null;

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

async function startDuel(res) {
  if (duelProcess) {
    jsonResponse(res, 409, { ok: false, error: "A duel is already running." });
    return;
  }

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
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

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

server.listen(port, "127.0.0.1", () => {
  console.log("");
  console.log("KANE vs. ABLE is running.");
  console.log(`Open: http://localhost:${port}`);
  console.log("");
  console.log("The BEGIN DUEL button can now launch Kane from the browser.");
});
