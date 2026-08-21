import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const requested = (process.argv[2] || "").toLowerCase();
const options = {
  broken: "broken-room.json",
  fixed: "fixed-room.json",
};

if (!options[requested]) {
  console.error("Usage: node scripts/select-room.mjs broken|fixed");
  process.exit(1);
}

const source = path.join(root, "rooms", "templates", options[requested]);
const target = path.join(root, "rooms", "current-room.json");

const raw = await fs.readFile(source, "utf8");
JSON.parse(raw); // fail loudly if the template is malformed
await fs.writeFile(target, raw);

console.log(`Loaded ${requested} room into rooms/current-room.json`);
