import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const VERDICTS_PATH = path.join(DATA_DIR, "verdicts.json");
const TMP_PATH = path.join(DATA_DIR, "verdicts.tmp.json");

// In-memory Map: key = marketId, value = verdict object
export const verdictStore = new Map();

export function loadVerdicts() {
  try {
    if (!fs.existsSync(VERDICTS_PATH)) return;
    const raw = fs.readFileSync(VERDICTS_PATH, "utf8");
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      verdictStore.set(Number(k), v);
    }
    // eslint-disable-next-line no-console
    console.log(`[verdictStore] Loaded ${verdictStore.size} verdict(s) from disk.`);
  } catch (err) {
    console.error("[verdictStore] Failed to load verdicts:", err);
  }
}

export function saveVerdicts() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const obj = Object.fromEntries(verdictStore.entries());
    fs.writeFileSync(TMP_PATH, JSON.stringify(obj, null, 2));
    fs.renameSync(TMP_PATH, VERDICTS_PATH);
    // eslint-disable-next-line no-console
    console.log(`[verdictStore] Saved ${verdictStore.size} verdict(s) to disk.`);
  } catch (err) {
    console.error("[verdictStore] Failed to save verdicts:", err);
  }
}
