import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const TEXT_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".json", ".html", ".css", ".md", ".txt", ".yml", ".yaml",
  ".xml", ".svg", ".toml", ".ini", ".env"
]);

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "playwright-report",
  "test-results"
]);

const suspiciousPatterns = [
  /\uFFFD/g, // replacement char
  /ï¿½/g,    // common mojibake of replacement char
  /Ã[\x80-\xBF]/g, // UTF-8 interpreted as latin1 pattern
  /Â[\x80-\xBF]/g
];

const failures = [];
const allMode = process.argv.includes("--all");
const SELF_PATH = path.join(ROOT, "scripts", "check-encoding.mjs");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    scanFile(fullPath);
  }
}

function scanFile(filePath) {
  if (path.resolve(filePath) === path.resolve(SELF_PATH)) return;
  const raw = fs.readFileSync(filePath);
  const utf8 = raw.toString("utf8");
  for (const pattern of suspiciousPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(utf8)) {
      failures.push(path.relative(ROOT, filePath));
      return;
    }
  }
}

function getStagedFiles() {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((f) => path.join(ROOT, f))
      .filter((f) => fs.existsSync(f));
  } catch {
    return [];
  }
}

if (allMode) {
  walk(ROOT);
} else {
  const staged = getStagedFiles();
  for (const filePath of staged) {
    const ext = path.extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    scanFile(filePath);
  }
}

if (failures.length > 0) {
  console.error("Encoding check failed. Suspicious mojibake found in:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("Encoding check passed.");
