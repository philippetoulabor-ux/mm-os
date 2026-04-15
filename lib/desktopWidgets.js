import { DESKTOP_EXCLUDED_ASSET_DIRS } from "@/lib/apps";
import { isSlideImageFile } from "@/lib/webAssetUrls";
import { webAssetManifest } from "@/lib/webAssetManifest";

export const DEFAULT_SLIDESHOW_WIDGET_ID = "slideshow-1";

export const DESKTOP_WIDGETS_STORAGE_KEY = "mm-os-desktop-widgets-v1";

/**
 * Slideshow für Ordner `step`: nur diese Dateien (ohne Render-Webp, ohne ältere IMG_23xx).
 * Zum Anpassen: `slideFiles` im Widget oder `slideShowAll: true` für alle Bilder im Ordner.
 */
export const STEP_SLIDESHOW_DEFAULT_FILES = [
  "IMG_8996.webp",
  "IMG_9055.webp",
  "IMG_9070.webp",
  "IMG_9075.webp",
  "IMG_9578.webp",
  "IMG_9586.webp",
];

/**
 * @typedef {{
 *   id: string,
 *   kind: 'slideshow',
 *   assetDir: string,
 *   basePath?: string,
 *   desktop: { xp: number, yp: number } | { x: number, y: number },
 *   slideFiles?: string[],
 *   slideShowAll?: boolean,
 * }} DesktopSlideshowWidget
 */

const validDirs = new Set(webAssetManifest.map((x) => x.dir));

function isFracPos(d) {
  return (
    typeof d?.xp === "number" &&
    Number.isFinite(d.xp) &&
    typeof d?.yp === "number" &&
    Number.isFinite(d.yp)
  );
}

function isPixelPos(d) {
  return (
    typeof d?.x === "number" &&
    Number.isFinite(d.x) &&
    typeof d?.y === "number" &&
    Number.isFinite(d.y)
  );
}

/**
 * @param {unknown} w
 * @returns {DesktopSlideshowWidget | null}
 */
export function sanitizeDesktopWidget(w) {
  if (!w || typeof w !== "object") return null;
  const id = typeof w.id === "string" && w.id ? w.id : null;
  const kind = w.kind;
  if (!id || kind !== "slideshow") return null;
  const assetDir = typeof w.assetDir === "string" ? w.assetDir : "";
  if (
    !assetDir ||
    !validDirs.has(assetDir) ||
    DESKTOP_EXCLUDED_ASSET_DIRS.has(assetDir)
  ) {
    return null;
  }
  const basePath =
    typeof w.basePath === "string" && w.basePath ? w.basePath : "/web";
  const desktop = w.desktop;
  let pos = null;
  if (isFracPos(desktop)) {
    pos = {
      xp: Math.min(1, Math.max(0, desktop.xp)),
      yp: Math.min(1, Math.max(0, desktop.yp)),
    };
  } else if (isPixelPos(desktop)) {
    pos = { x: desktop.x, y: desktop.y };
  } else {
    return null;
  }

  const entry = webAssetManifest.find((x) => x.dir === assetDir);
  const manifestSet = entry?.files?.length
    ? new Set(entry.files)
    : new Set();

  const slideShowAll = w.slideShowAll === true;

  /** @type {string[] | undefined} */
  let slideFiles;
  if (Array.isArray(w.slideFiles)) {
    slideFiles = w.slideFiles.filter(
      (f) =>
        typeof f === "string" &&
        manifestSet.has(f) &&
        isSlideImageFile(f)
    );
  }

  const out = {
    id,
    kind: "slideshow",
    assetDir,
    basePath,
    desktop: pos,
  };
  if (slideShowAll) {
    out.slideShowAll = true;
  } else if (slideFiles !== undefined) {
    out.slideFiles = slideFiles;
  }
  return out;
}

/** @returns {DesktopSlideshowWidget[]} */
export function getDefaultDesktopWidgets() {
  return [
    {
      id: DEFAULT_SLIDESHOW_WIDGET_ID,
      kind: "slideshow",
      assetDir: "step",
      basePath: "/web",
      desktop: { xp: 0.78, yp: 0.38 },
      slideFiles: [...STEP_SLIDESHOW_DEFAULT_FILES],
    },
  ];
}

/** @returns {DesktopSlideshowWidget[]} */
export function loadDesktopWidgets() {
  const defaults = getDefaultDesktopWidgets();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(DESKTOP_WIDGETS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    const out = [];
    for (const item of parsed) {
      const s = sanitizeDesktopWidget(item);
      if (s) out.push(s);
    }
    return out.length > 0 ? out : defaults;
  } catch {
    return defaults;
  }
}
