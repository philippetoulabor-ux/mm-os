import { MODEL_3D_BACKGROUND_OVERRIDES } from "@/lib/model3dBackgroundOverrides";

const IMG_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;
const VID_EXT = /\.(mov|mp4|webm|mpe?g)$/i;

/**
 * Hintergrund für ein 3D-Modell im selben Asset-Ordner auflösen.
 * 1) Explizite Zuordnung in model3dBackgroundOverrides.js
 * 2) Konvention: {stem}.bg.{ext} (Bild) oder {stem}.background.{ext} (Video)
 */
export function resolveModelBackground(
  dir,
  file,
  filesInFolder,
  basePath = "/web"
) {
  if (!dir || !file || !Array.isArray(filesInFolder)) return null;

  const key = `${dir}/${file}`;
  const override = MODEL_3D_BACKGROUND_OVERRIDES[key];
  if (override && filesInFolder.includes(override)) {
    const u = fileHrefFromParts(basePath, dir, override);
    if (IMG_EXT.test(override)) return { url: u, kind: "image" };
    if (VID_EXT.test(override)) return { url: u, kind: "video" };
  }

  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;

  const bgImage = filesInFolder.find(
    (f) => f.startsWith(`${stem}.bg.`) && IMG_EXT.test(f)
  );
  if (bgImage) {
    return { url: fileHrefFromParts(basePath, dir, bgImage), kind: "image" };
  }

  const bgVideo = filesInFolder.find(
    (f) => f.startsWith(`${stem}.background.`) && VID_EXT.test(f)
  );
  if (bgVideo) {
    return { url: fileHrefFromParts(basePath, dir, bgVideo), kind: "video" };
  }

  return null;
}

function fileHrefFromParts(basePath, dir, name) {
  return `${basePath.replace(/\/$/, "")}/${encodeURIComponent(dir)}/${encodeURIComponent(name)}`;
}
