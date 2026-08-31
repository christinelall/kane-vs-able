import { spawn } from "node:child_process";

function exists(command) {
  return new Promise((resolve) => {
    const p = spawn(process.platform === "win32" ? "where" : "sh", process.platform === "win32" ? [command] : ["-lc", `command -v ${command}`], {
      stdio: "ignore",
      shell: false,
    });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

const [kane, codex, chromeA, chromeB, chromeC] = await Promise.all([
  exists(process.platform === "win32" ? "kane-cli.cmd" : "kane-cli"),
  exists(process.platform === "win32" ? "codex.cmd" : "codex"),
  exists("google-chrome"),
  exists("google-chrome-stable"),
  exists("chromium"),
]);
const chrome = chromeA || chromeB || chromeC;

const basicAuth = Boolean(
  (process.env.KANE_USERNAME || process.env.LT_USERNAME) &&
  (process.env.KANE_ACCESS_KEY || process.env.LT_ACCESS_KEY)
);
const codexEnvAuth = Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_ACCESS_TOKEN);

console.log("KANE vs. ABLE preflight");
console.log(`Kane CLI: ${kane ? "found" : "missing"}`);
console.log(`Codex CLI: ${codex ? "found" : "missing"}`);
console.log(`Chrome/Chromium in PATH: ${chrome ? "found" : "not found in PATH (local macOS Chrome may still work)"}`);
console.log(`Kane CI credentials: ${basicAuth ? "configured" : "not set (stored local profile may be used)"}`);
console.log(`Codex environment auth: ${codexEnvAuth ? "configured" : "not set (stored local login may be used)"}`);
console.log(`Headless requested: ${process.env.KANE_HEADLESS === "1" ? "yes" : "no"}`);

if (!kane || !codex) process.exitCode = 1;
