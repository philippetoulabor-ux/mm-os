import { DESKTOP_EXCLUDED_ASSET_DIRS } from "@/lib/apps";
import { getLastDesktopUiScale, scaleLayoutPx } from "@/lib/desktopUiScale";
import {
  computeSlideshowStackDesktopPosition,
  slideshowStackPlacementFallbacks,
} from "@/lib/desktopSlideshowPlacement";
import { isSlideshowMediaFile } from "@/lib/webAssetUrls";
import { webAssetManifest } from "@/lib/webAssetManifest";

export const DEFAULT_SLIDESHOW_WIDGET_ID = "slideshow-1";

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

/** Desktop-Slideshow für Ordner `grillz`: nur diese drei Bilder. */
export const GRILLZ_SLIDESHOW_DEFAULT_FILES = [
  "4-b.webp",
  "6-textured-b.webp",
  "star+1-t.webp",
];

/** Aus der Desktop-Slideshow `mm-series` / `slideshow-3` — Finder zeigt weiter alle Dateien. */
const MM_SERIES_WIDGET_SLIDESHOW_EXCLUDE = new Set([
  "DSCF6551.webp",
  "DSCF6553.webp",
  "DSCF6556.webp",
  "DSCF6557.webp",
  "DSCF6560.webp",
  "DSCF6622.webp",
]);

/** @returns {string[]} Manifest-Reihenfolge, ohne die ausgeschlossenen DSCF-Webps. */
function mmSeriesWidgetSlideFiles() {
  const entry = webAssetManifest.find((x) => x.dir === "mm-series");
  if (!entry?.files?.length) return [];
  return entry.files.filter(
    (f) =>
      !MM_SERIES_WIDGET_SLIDESHOW_EXCLUDE.has(f) && isSlideshowMediaFile(f)
  );
}

/**
 * `restrictTo` für `listSlideshowMediaFiles` (gleiche Logik wie SlideshowWidget).
 * @param {DesktopSlideshowWidget} widget
 * @returns {string[] | undefined}
 */
export function getSlideshowRestrictList(widget) {
  if (widget.slideShowAll) return undefined;
  if (Array.isArray(widget.slideFiles)) return widget.slideFiles;
  if (widget.assetDir === "step") return STEP_SLIDESHOW_DEFAULT_FILES;
  if (widget.assetDir === "grillz") return GRILLZ_SLIDESHOW_DEFAULT_FILES;
  if (widget.assetDir === "mm-series") return mmSeriesWidgetSlideFiles();
  return undefined;
}

const WIDGET_BOX_BASE_PX = 340;

/**
 * Zusätzliche Breite nach rechts bei gestapelten Slideshows (hintere Karte),
 * gleich `STACK_OFFSET_PX` / `stackPad` in `DesktopWidgets`.
 */
export const DESKTOP_WIDGET_STACK_OFFSET_PX = 14;

/**
 * @param {number} desktopW
 * @param {number} desktopH
 * @param {number} minLayerY siehe `getDesktopWindowLayoutLimits().minLayerY`
 * @param {number} fsY siehe `getDesktopLayerFullscreenRect().y`
 * @returns {{ x: number, y: number }}
 */
export function computeDefaultWidgetStackLayerPosition(
  desktopW,
  desktopH,
  minLayerY,
  fsY
) {
  return computeSlideshowStackDesktopPosition(
    desktopW,
    desktopH,
    minLayerY,
    fsY
  );
}

/**
 * @param {number | undefined} minLayerY optional — wie `getDesktopWindowLayoutLimits().minLayerY`
 * (sonst `WINDOW_DESKTOP_INSET − layerTop`, vgl. DesktopContext).
 */
export function clampDesktopWidgetsToLayer(
  widgets,
  layerW,
  layerH,
  layerTop,
  minLayerY
) {
  if (!Array.isArray(widgets) || layerW <= 0 || layerH <= 0) return widgets;
  const s = getLastDesktopUiScale();
  const box = scaleLayoutPx(WIDGET_BOX_BASE_PX, s);
  const stackXPad = scaleLayoutPx(DESKTOP_WIDGET_STACK_OFFSET_PX, s);
  const maxX = Math.max(0, layerW - box - stackXPad);
  const maxY = Math.max(0, layerH - box);
  const minY =
    typeof minLayerY === "number" && Number.isFinite(minLayerY)
      ? minLayerY
      : 6 - layerTop;
  return widgets.map((w) => {
    const d = w.desktop;
    if (
      typeof d?.xp === "number" &&
      Number.isFinite(d.xp) &&
      typeof d?.yp === "number" &&
      Number.isFinite(d.yp)
    ) {
      return {
        ...w,
        desktop: {
          xp: Math.min(1, Math.max(0, d.xp)),
          yp: Math.min(1, Math.max(0, d.yp)),
        },
      };
    }
    if (
      typeof d?.x === "number" &&
      Number.isFinite(d.x) &&
      typeof d?.y === "number" &&
      Number.isFinite(d.y)
    ) {
      return {
        ...w,
        desktop: {
          x: Math.max(0, Math.min(d.x, maxX)),
          y: Math.max(minY, Math.min(d.y, maxY)),
        },
      };
    }
    return w;
  });
}

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

  let slideShowAll = w.slideShowAll === true;

  /** @type {string[] | undefined} */
  let slideFiles;
  if (Array.isArray(w.slideFiles)) {
    slideFiles = w.slideFiles.filter(
      (f) =>
        typeof f === "string" &&
        manifestSet.has(f) &&
        isSlideshowMediaFile(f)
    );
  }

  if (id === "slideshow-3" && assetDir === "mm-series" && slideShowAll) {
    slideShowAll = false;
    slideFiles = mmSeriesWidgetSlideFiles();
  }

  if (
    id === "slideshow-3" &&
    assetDir === "mm-series" &&
    slideFiles !== undefined
  ) {
    slideFiles = slideFiles.filter(
      (f) => !MM_SERIES_WIDGET_SLIDESHOW_EXCLUDE.has(f)
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

/** Diese Slideshow-IDs teilen sich immer eine gemeinsame Desktop-Lage (ein Stapel). */
export const DESKTOP_STACK_WIDGET_IDS = [
  DEFAULT_SLIDESHOW_WIDGET_ID,
  "slideshow-grillz",
  "slideshow-3",
];

/**
 * Gleicht die Position der Stapelfähigen Slideshows an (Referenz: slideshow-1), damit sie nicht
 * auseinanderdriften (z. B. alte Saves oder fehlende Multi-Drag-Updates).
 * @param {DesktopSlideshowWidget[]} widgets
 * @returns {DesktopSlideshowWidget[]}
 */
export function syncDefaultStackWidgetPositions(widgets) {
  if (!Array.isArray(widgets) || widgets.length < 2) return widgets;
  const idSet = new Set(DESKTOP_STACK_WIDGET_IDS);
  const stack = widgets.filter(
    (w) => w.kind === "slideshow" && idSet.has(w.id)
  );
  if (stack.length <= 1) return widgets;
  const primary =
    stack.find((w) => w.id === DEFAULT_SLIDESHOW_WIDGET_ID) ?? stack[0];
  const desktop = primary.desktop;
  return widgets.map((w) => {
    if (w.kind !== "slideshow" || !idSet.has(w.id)) return w;
    return { ...w, desktop: { ...desktop } };
  });
}

/** @returns {DesktopSlideshowWidget[]} */
export function getDefaultDesktopWidgets() {
  const fb = slideshowStackPlacementFallbacks();
  const defaultStackDesktop = computeDefaultWidgetStackLayerPosition(
    fb.desktopW,
    fb.desktopH,
    fb.minLayerY,
    fb.fsY
  );
  return [
    {
      id: DEFAULT_SLIDESHOW_WIDGET_ID,
      kind: "slideshow",
      assetDir: "step",
      basePath: "/web",
      desktop: { ...defaultStackDesktop },
      slideFiles: [...STEP_SLIDESHOW_DEFAULT_FILES],
    },
    {
      id: "slideshow-grillz",
      kind: "slideshow",
      assetDir: "grillz",
      basePath: "/web",
      desktop: { ...defaultStackDesktop },
      slideFiles: [...GRILLZ_SLIDESHOW_DEFAULT_FILES],
    },
    {
      id: "slideshow-3",
      kind: "slideshow",
      assetDir: "mm-series",
      basePath: "/web",
      desktop: { ...defaultStackDesktop },
      slideFiles: mmSeriesWidgetSlideFiles(),
    },
  ];
}

/**
 * Frische Desktop-Slideshow-Liste (kein localStorage).
 * @returns {DesktopSlideshowWidget[]}
 */
export function loadDesktopWidgets() {
  return syncDefaultStackWidgetPositions(getDefaultDesktopWidgets());
}
