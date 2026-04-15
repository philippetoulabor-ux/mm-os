#!/usr/bin/env node
/**
 * Größte Dateien unter public/web finden (Audit für Medien-Performance).
 * Schreibt reports/web-assets-audit.json und gibt eine Tabelle auf stdout aus.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "public", "web");
const OUT_JSON = path.join(ROOT, "reports", "web-assets-audit.json");

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".JPG",
  ".JPEG",
  ".PNG",
]);
const VIDEO_EXT = new Set([".mov", ".mp4", ".webm", ".m4v", ".MOV"]);
const GLTF_EXT = new Set([".glb", ".gltf"]);

function walkFiles(dir, baseRel, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const rel = baseRel ? `${baseRel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, rel, out);
    else if (ent.isFile()) {
      const st = fs.statSync(full);
      out.push({ rel, bytes: st.size, full });
    }
  }
}

function kindFor(ext) {
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (GLTF_EXT.has(ext)) return "gltf";
  return "other";
}

function fmtBytes(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
}

function main() {
  if (!fs.existsSync(WEB)) {
    console.error("Fehlt:", WEB);
    process.exit(1);
  }

  const entries = [];
  walkFiles(WEB, "", entries);
  entries.sort((a, b) => b.bytes - a.bytes);

  const totalBytes = entries.reduce((s, e) => s + e.bytes, 0);
  const top = entries.slice(0, 80).map((e) => {
    const ext = path.extname(e.rel);
    return {
      path: e.rel.replace(/\\/g, "/"),
      bytes: e.bytes,
      kind: kindFor(ext),
    };
  });

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        webRoot: "public/web",
        totalFiles: entries.length,
        totalBytes,
        topLargest: top,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`public/web — ${entries.length} Dateien, ${fmtBytes(totalBytes)} gesamt\n`);
  console.log("Größte Dateien (Top 25):\n");
  for (const e of top.slice(0, 25)) {
    console.log(
      `${fmtBytes(e.bytes).padStart(10)}  ${e.kind.padEnd(6)}  ${e.path}`
    );
  }
  console.log(`\nVollständige Liste (Top 80): ${OUT_JSON}`);
}

main();
