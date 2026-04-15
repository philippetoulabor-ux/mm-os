#!/usr/bin/env node
/**
 * Kopiert public/web aus webdata3d/landing-page nach mm-os/public/web,
 * setzt public/webdata3d → Symlink auf web (eine physische Kopie),
 * und schreibt lib/webAssetManifest.js für die Desktop-Ordneransicht
 * (Dateien rekursiv, Pfade relativ mit `/` bei Unterordnern).
 *
 * Nach rsync: Legacy-Ordnernamen aus der Quelle werden in die kanonischen Namen
 * umbenannt (gleiche wie Desktop-Labels), siehe FOLDER_RENAMES_FROM_LEGACY_SOURCE.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { buildManifest, writeManifest, ROOT } from "./lib/webManifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = path.join(
  process.env.HOME,
  "Desktop",
  "webdata3d",
  "landing-page",
  "public",
  "web"
);
const SOURCE = process.env.WEB_ASSETS_SOURCE || DEFAULT_SOURCE;
const DEST_WEB = path.join(ROOT, "public", "web");
const DEST_WEBDATA3D = path.join(ROOT, "public", "webdata3d");

/** Alte Ordnernamen aus der Landing-Page-Quelle → kanonische Namen unter public/web */
const FOLDER_RENAMES_FROM_LEGACY_SOURCE = [
  ["kerze_web", "LuckyStar_candle"],
  ["LSradio_web", "Sound-System"],
  ["clay_web", "clay"],
  ["logo_web", "logo"],
  ["step_web", "step"],
];

function renameLegacyFolders(webRoot) {
  for (const [from, to] of FOLDER_RENAMES_FROM_LEGACY_SOURCE) {
    const fromPath = path.join(webRoot, from);
    const toPath = path.join(webRoot, to);
    if (!fs.existsSync(fromPath)) continue;
    if (fs.existsSync(toPath)) {
      console.warn(
        `sync:web: überspringe ${from} → ${to}: Ziel existiert bereits`
      );
      continue;
    }
    fs.renameSync(fromPath, toPath);
    console.log(`sync:web: Ordner umbenannt: ${from} → ${to}`);
  }
}

if (!fs.existsSync(SOURCE)) {
  console.error("Quelle fehlt:", SOURCE);
  console.error("Setze WEB_ASSETS_SOURCE auf den Ordner …/public/web");
  process.exit(1);
}

execSync(
  `rsync -a --delete --exclude ".DS_Store" "${SOURCE}/" "${DEST_WEB}/"`,
  { stdio: "inherit" }
);

renameLegacyFolders(DEST_WEB);

if (fs.existsSync(DEST_WEBDATA3D)) {
  fs.rmSync(DEST_WEBDATA3D, { recursive: true, force: true });
}
fs.symlinkSync("web", DEST_WEBDATA3D);

const manifest = buildManifest(DEST_WEB);
writeManifest(manifest, { generatedBy: "scripts/sync-web-assets.mjs" });
console.log("OK: public/web synchronisiert, public/webdata3d → web, Manifest:", manifest.length, "Ordner");
