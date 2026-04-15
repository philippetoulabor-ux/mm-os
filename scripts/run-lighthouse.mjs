#!/usr/bin/env node
/**
 * Nach `npm run build`: startet `next start`, führt Lighthouse (CLI) aus,
 * schreibt reports/lighthouse-report.json und reports/lighthouse-summary.txt (FCP, TBT, …).
 */
import { spawn, execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "reports");
const OUT_JSON = path.join(OUT_DIR, "lighthouse-report.json");
const OUT_TXT = path.join(OUT_DIR, "lighthouse-summary.txt");
const PORT = process.env.PORT || "3010";
const URL =
  process.env.LIGHTHOUSE_URL || `http://127.0.0.1:${PORT}`;
const LIGHTHOUSE = path.join(ROOT, "node_modules", ".bin", "lighthouse");
const NEXT = path.join(ROOT, "node_modules", ".bin", "next");

function fmtAudit(audits, id) {
  const a = audits[id];
  if (!a) return null;
  const ms = typeof a.numericValue === "number" ? a.numericValue : null;
  if (ms != null) return `${ms.toFixed(0)} ms`;
  return a.displayValue ?? "—";
}

async function waitForServer(maxAttempts = 90) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(URL, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`Server nicht erreichbar: ${URL}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const server = spawn(NEXT, ["start", "-p", PORT], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PORT },
  });

  try {
    await waitForServer();

    execFileSync(
      LIGHTHOUSE,
      [
        URL,
        "--preset=desktop",
        "--only-categories=performance",
        "--output=json",
        `--output-path=${OUT_JSON}`,
        "--chrome-flags=--headless=new",
        "--quiet",
      ],
      { cwd: ROOT, stdio: "inherit", env: process.env }
    );

    const raw = readFileSync(OUT_JSON, "utf8");
    const report = JSON.parse(raw);
    const audits = report.audits ?? {};
    const perf = report.categories?.performance?.score;

    const lines = [
      `URL: ${URL}`,
      `Date: ${new Date().toISOString()}`,
      `Lighthouse: --preset=desktop --only-categories=performance`,
      `Performance score: ${perf != null ? (perf * 100).toFixed(0) : "—"}`,
      `First Contentful Paint: ${fmtAudit(audits, "first-contentful-paint") ?? "—"}`,
      `Total Blocking Time: ${fmtAudit(audits, "total-blocking-time") ?? "—"}`,
      `Speed Index: ${fmtAudit(audits, "speed-index") ?? "—"}`,
      `Largest Contentful Paint: ${fmtAudit(audits, "largest-contentful-paint") ?? "—"}`,
      "",
    ];
    writeFileSync(OUT_TXT, lines.join("\n"), "utf8");
    console.log("\n" + lines.join("\n"));
    console.log("Vollständiger Report:", OUT_JSON);
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
