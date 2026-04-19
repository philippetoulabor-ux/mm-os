import { DESKTOP_EXCLUDED_ASSET_DIRS } from "@/lib/apps";
import { isSlideshowMediaFile } from "@/lib/webAssetUrls";
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
 * `restrictTo` für `listSlideshowMediaFiles` (gleiche Logik wie SlideshowWidget).
 * @param {DesktopSlideshowWidget} widget
 * @returns {string[] | undefined}
 */
export function getSlideshowRestrictList(widget) {
  if (widget.slideShowAll) return undefined;
  if (Array.isArray(widget.slideFiles)) return widget.slideFiles;
  if (widget.assetDir === "step") return STEP_SLIDESHOW_DEFAULT_FILES;
  return undefined;
}

/** Gleiche Kantenlänge wie `DesktopWidgets` (Slideshow-Kachel). */
const WIDGET_BOX_PX = 340;

/** Nach Resize oder schmalerem Viewport: gespeicherte Pixel-Lagen in den Layer ziehen. */
export function clampDesktopWidgetsToLayer(widgets, layerW, layerH, layerTop) {
  if (!Array.isArray(widgets) || layerW <= 0 || layerH <= 0) return widgets;
  const maxX = Math.max(0, layerW - WIDGET_BOX_PX);
  const maxY = Math.max(0, layerH - WIDGET_BOX_PX);
  const minY = -layerTop;
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

  const slideShowAll = w.slideShowAll === true;

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

/** Gleiche Fraktion wie bisher — mehrere Widgets = ein Stapel an derselben Stelle. */
const DEFAULT_WIDGET_STACK_POS = { xp: 0.78, yp: 0.38 };

/** Diese Slideshow-IDs teilen sich immer eine gemeinsame Desktop-Lage (ein Stapel). */
export const DESKTOP_STACK_WIDGET_IDS = [
  DEFAULT_SLIDESHOW_WIDGET_ID,
  "slideshow-2",
  "slideshow-3",
];

/**
 * Gleicht die Position von slideshow-1/2/3 an (Referenz: slideshow-1), damit sie nicht
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
  return [
    {
      id: DEFAULT_SLIDESHOW_WIDGET_ID,
      kind: "slideshow",
      assetDir: "step",
      basePath: "/web",
      desktop: { ...DEFAULT_WIDGET_STACK_POS },
      slideFiles: [...STEP_SLIDESHOW_DEFAULT_FILES],
    },
    {
      id: "slideshow-2",
      kind: "slideshow",
      assetDir: "clay",
      basePath: "/web",
      desktop: { ...DEFAULT_WIDGET_STACK_POS },
      slideShowAll: true,
    },
    {
      id: "slideshow-3",
      kind: "slideshow",
      assetDir: "mm-series",
      basePath: "/web",
      desktop: { ...DEFAULT_WIDGET_STACK_POS },
      slideShowAll: true,
    },
  ];
}

/** @returns {DesktopSlideshowWidget[]} */
export function loadDesktopWidgets() {
  const defaults = getDefaultDesktopWidgets();
  const finish = (list) => syncDefaultStackWidgetPositions(list);
  if (typeof window === "undefined") return finish(defaults);
  try {
    const raw = localStorage.getItem(DESKTOP_WIDGETS_STORAGE_KEY);
    if (!raw) return finish(defaults);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return finish(defaults);
    const out = [];
    const seen = new Set();
    for (const item of parsed) {
      const s = sanitizeDesktopWidget(item);
      if (s) {
        out.push(s);
        seen.add(s.id);
      }
    }
    /* Stapelfähige Defaults nachziehen (z. B. nur slideshow-1 gespeichert). */
    for (const d of defaults) {
      if (!seen.has(d.id)) {
        const s = sanitizeDesktopWidget(d);
        if (s) out.push(s);
      }
    }
    return finish(out.length > 0 ? out : defaults);
  } catch {
    return finish(defaults);
  }
}
