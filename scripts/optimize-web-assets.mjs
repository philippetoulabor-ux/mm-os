#!/usr/bin/env node
/**
 * Komprimiert große Medien unter public/web: Raster → WebP (sharp),
 * GLB → Draco (gltf-transform), MOV → H.264 MP4 (ffmpeg-static).
 * Danach: npm run manifest:web
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "public", "web");
const GLTF_TRANSFORM = path.join(
  ROOT,
  "node_modules",
  ".bin",
  "gltf-transform"
);

const MIN_IMAGE_BYTES = 400 * 1024;
const WEBP_QUALITY = 82;
const RASTER_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".JPG",
  ".JPEG",
  ".PNG",
]);

function exists(p) {
  return fs.existsSync(p);
}

function optimizeImage(filePath) {
  const ext = path.extname(filePath);
  if (!RASTER_EXT.has(ext)) return false;
  const st = fs.statSync(filePath);
  if (st.size < MIN_IMAGE_BYTES) return false;

  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ext);
  const outPath = path.join(dir, `${base}.webp`);

  return sharp(filePath)
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toFile(outPath)
    .then((info) => {
      if (info.size >= st.size) {
        fs.unlinkSync(outPath);
        console.warn(
          `  skip   ${path.relative(WEB, filePath)} (WebP nicht kleiner: ${st.size} vs ${info.size} B)`
        );
        return false;
      }
      fs.unlinkSync(filePath);
      console.log(
        `  image  ${path.relative(WEB, filePath)} → ${path.basename(outPath)} (${st.size} → ${info.size} B)`
      );
      return true;
    });
}

function optimizeGlb(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".glb") return false;
  const st = fs.statSync(filePath);
  if (st.size < 2 * 1024 * 1024) return false;

  const tmp = `${filePath}.opt.glb`;
  execFileSync(
    GLTF_TRANSFORM,
    ["optimize", filePath, tmp, "--compress", "draco"],
    { stdio: "inherit" }
  );
  const newSt = fs.statSync(tmp);
  fs.renameSync(tmp, filePath);
  console.log(
    `  glb    ${path.relative(WEB, filePath)} (${st.size} → ${newSt.size} B)`
  );
  return true;
}

function optimizeVideo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".mov") return false;

  const outPath = filePath.slice(0, -4) + ".mp4";
  if (!ffmpegPath || !exists(ffmpegPath)) {
    console.warn("  ffmpeg-static binary missing, skip video:", filePath);
    return false;
  }

  const st = fs.statSync(filePath);
  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      filePath,
      "-c:v",
      "libx264",
      "-crf",
      "23",
      "-preset",
      "medium",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outPath,
    ],
    { stdio: "inherit" }
  );
  const newSt = fs.statSync(outPath);
  fs.unlinkSync(filePath);
  console.log(
    `  video  ${path.relative(WEB, filePath)} → ${path.basename(outPath)} (${st.size} → ${newSt.size} B)`
  );
  return true;
}

function walkFiles(dir, list) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, list);
    else if (ent.isFile()) list.push(full);
  }
}

async function main() {
  if (!exists(WEB)) {
    console.error("Fehlt:", WEB);
    process.exit(1);
  }

  const files = [];
  walkFiles(WEB, files);

  const glbs = files.filter((f) => path.extname(f).toLowerCase() === ".glb");
  const movs = files.filter((f) => path.extname(f).toLowerCase() === ".mov");
  const images = files.filter((f) => RASTER_EXT.has(path.extname(f)));

  console.log("GLB (Draco)…");
  for (const f of glbs.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)) {
    try {
      optimizeGlb(f);
    } catch (e) {
      console.error("  FEHLER GLB", f, e.message);
    }
  }

  console.log("\nVideo (MOV → MP4)…");
  for (const f of movs) {
    try {
      optimizeVideo(f);
    } catch (e) {
      console.error("  FEHLER Video", f, e.message);
    }
  }

  console.log("\nBilder → WebP (≥ " + MIN_IMAGE_BYTES / 1024 + " KB)…");
  const bigImages = images
    .filter((f) => fs.statSync(f).size >= MIN_IMAGE_BYTES)
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);

  for (const f of bigImages) {
    try {
      await optimizeImage(f);
    } catch (e) {
      console.error("  FEHLER Bild", f, e.message);
    }
  }

  console.log("\nFertig. Als Nächstes: npm run manifest:web");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
