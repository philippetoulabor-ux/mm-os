#!/usr/bin/env node
/**
 * Schreibt nur lib/webAssetManifest.js aus dem aktuellen Stand von public/web
 * (ohne rsync). Nach manueller Optimierung/Kompression der Assets aufrufen.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildManifest, writeManifest, ROOT } from "./lib/webManifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(ROOT, "public", "web");

if (!fs.existsSync(WEB)) {
  console.error("Fehlt:", WEB);
  process.exit(1);
}

const manifest = buildManifest(WEB);
writeManifest(manifest, { generatedBy: "scripts/write-web-manifest.mjs" });
console.log(
  "OK: webAssetManifest.js aktualisiert:",
  manifest.length,
  "Ordner"
);
