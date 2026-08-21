import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

await fs.writeFile(path.join(root, "verification", "history.json"), "[]\n");
await fs.writeFile(
  path.join(root, "verification", "kane-feedback.md"),
  "# Kane Feedback for ABLE\n\nNo verification run has been recorded yet.\n"
);
await fs.writeFile(
  path.join(root, "verification", "duel-state.json"),
  JSON.stringify(
    {
      running: false,
      phase: "idle",
      round: 0,
      message: "Ready for Kane vs. ABLE.",
      dialogue: [],
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  ) + "\n"
);

console.log("Verification and duel history reset.");
