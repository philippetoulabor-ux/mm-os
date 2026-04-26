"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APPS, getDefaultDesktopIconPositions, webAssetAppId } from "@/lib/apps";
import {
  clampDesktopWidgetsToLayer,
  computeDefaultWidgetStackLayerPosition,
  DESKTOP_STACK_WIDGET_IDS,
  getDefaultDesktopWidgets,
  syncDefaultStackWidgetPositions,
} from "@/lib/desktopWidgets";
import { migrateNotesText } from "@/lib/webAssetIds";
import { getMentionToken } from "@/lib/noteRefs";
import {
  DESKTOP_ASSET_WIDGET_CHROME_FULLSCREEN_PAD_PX,
  DESKTOP_FINDER_START_EDGE_PX,
  getAssetWidgetFrameSidePx,
  getFinderDesktopMaxSidePx,
} from "@/lib/desktopWidgetFrame";
import { clampAspectWindowBounds } from "@/lib/osWindowBounds";
import {
  applyDesktopUiDocumentVars,
  getDesktopUiScaleFromDims,
  getLastDesktopUiScale,
  scaleLayoutPx,
  setLastDesktopUiScale,
} from "@/lib/desktopUiScale";

/** Höhe des Site-Headers (kompaktes Logo + Padding); Näherung für Fenster-Layout */
const SITE_HEADER_H = 270;
/** OSWindow Titelleiste (entspricht Tailwind h-10; gleicher Inset zum Schließen-Button h-8) */
const OS_TITLEBAR_H = 60;
/**
 * Zusatz zur Finder-Fensterhöhe (px), wenn die Titelleisten-Suche offen ist.
 * Fenster wird nur höher und nach oben verschoben (y↓), kein scale — Rand bleibt am Inhalt.
 */
const FINDER_TITLEBAR_EXPAND_PX = 6;
const MIN_WIN_W = 360;
const MIN_WIN_H = 240;
/** Inhaltshöhe (ohne OS-Titelleiste), wenn der Media-Player nur Titelzeile + Transport hat (Video ausgeblendet). */
const MEDIA_COMPACT_CLIENT_H = 140;
/** Feste Breite im minimierten Media-Player (kleinstes Fenster). */
const MEDIA_COMPACT_W = MIN_WIN_W;
const MEDIA_COMPACT_TOTAL_H = OS_TITLEBAR_H + MEDIA_COMPACT_CLIENT_H;
/** Abstand zum rechten und unteren Rand des Desktop-Layers (minimiertes Media-Fenster). */
export const MEDIA_MINIMIZE_INSET = 18;
export const MEDIA_MINIMIZE_INSET_X = MEDIA_MINIMIZE_INSET;
export const MEDIA_MINIMIZE_INSET_Y = MEDIA_MINIMIZE_INSET;

/** Minimaler Rand Fenster ↔ sichtbare Viewport-/Seitenkante (links/rechts/unten/oben). */
export const WINDOW_DESKTOP_INSET = 6;

/** Entspricht Tailwind `max-md` — schmale Viewports: Fenster immer fullscreen im Desktop-Layer. */
const MOBILE_LAYOUT_MAX_WIDTH_PX = 767;
/**
 * Mobile-Slideshowzeile: Kachel 208px (`WIDGET_BASE_MOBILE_HOME` in `DesktopWidgets.js`) + vertikales
 * Padding `DesktopWidgetsMobile` — nicht als Bruchteil von `desktopH` schätzen (sonst riesiger Lückenstreifen).
 */
/** Passend zu `MOBILE_WIDGET_STACK_SLOT_MIN_PX` in `DesktopIcons.js` (Slideshow + Rand). */
const MOBILE_HOME_SLIDESHOW_BAND_EST_PX = 228;

export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH_PX;
}

function getLayoutUiScale() {
  if (typeof window === "undefined" || isMobileViewport()) return 1;
  return getLastDesktopUiScale();
}

/** Kompaktes Media-Fenster (Video zu): Breite ≙ min, Höhe = Titelleiste + Transport — skaliert auf Desktop. */
function getMediaCompactWindowSize() {
  if (isMobileViewport()) {
    return { w: MIN_WIN_W, h: MEDIA_COMPACT_TOTAL_H };
  }
  const s = getLayoutUiScale();
  return {
    w: scaleLayoutPx(MIN_WIN_W, s),
    h: scaleLayoutPx(OS_TITLEBAR_H, s) + scaleLayoutPx(MEDIA_COMPACT_CLIENT_H, s),
  };
}

/**
 * Grenzen im Koordinatensystem von OSWindow (relativ zu `[data-mm-desktop-layer]`).
 * Nutzt gemessene Layer-Größe statt `innerHeight - SITE_HEADER`, damit Resize nicht künstlich kleiner bleibt.
 */
export function getDesktopWindowLayoutLimits() {
  const s = getLayoutUiScale();
  const inset = scaleLayoutPx(WINDOW_DESKTOP_INSET, s);
  const minWinW = scaleLayoutPx(MIN_WIN_W, s);
  const minWinH = scaleLayoutPx(MIN_WIN_H, s);
  if (typeof window === "undefined") {
    const desktopH = 900;
    const layerTop = SITE_HEADER_H;
    const minLayerY = inset - layerTop;
    const maxBottomLayer = desktopH - inset;
    const maxWinH = Math.max(minWinH, maxBottomLayer - minLayerY);
    return {
      desktopW: 1920,
      desktopH,
      inset,
      minWinW,
      minWinH,
      minLayerY,
      innerW: Math.max(minWinW, 1920 - 2 * inset),
      maxWinH,
      maxBottomLayer,
    };
  }
  const { w: desktopW, h: desktopH, layerTop } = getDesktopContentRect();
  /** Viewport-Oberkante + inset ≙ Layer-Koordinate: Fenster nicht an Header-Linie blockieren. */
  const minLayerY = inset - layerTop;
  const maxBottomLayer = desktopH - inset;
  const maxWinH = Math.max(minWinH, maxBottomLayer - minLayerY);
  return {
    desktopW,
    desktopH,
    inset,
    minWinW,
    minWinH,
    minLayerY,
    innerW: Math.max(minWinW, desktopW - 2 * inset),
    maxWinH,
    maxBottomLayer,
  };
}

/** Sichtbare Höhe (Mobile Safari: zuverlässiger als Layer-Bounding-Box bei Toolbars / 100dvh-Lücken). */
function getVisualViewportHeight() {
  if (typeof window === "undefined") return 900;
  return window.visualViewport?.height ?? window.innerHeight;
}

/**
 * Mobile (Chrome/Brave iOS u. a.): Layer-`getBoundingClientRect().height` kann größer sein als der
 * Streifen bis zur Visual-Viewport-Unterkante — Finder/Vollbild sonst hinter der Browser-UI.
 * @param {number} layerRectH
 * @param {number} layerTopPx `getBoundingClientRect().top` des Layers
 */
function capMobileDesktopLayerHPx(layerRectH, layerTopPx) {
  if (!isMobileViewport() || typeof window === "undefined") return layerRectH;
  const vv = window.visualViewport;
  if (!vv) return layerRectH;
  const visibleBelowTop = vv.offsetTop + vv.height - layerTopPx;
  if (!Number.isFinite(visibleBelowTop)) return layerRectH;
  const capped = Math.min(layerRectH, Math.floor(visibleBelowTop));
  return Math.max(0, capped) || layerRectH;
}

/**
 * Vollblick-Rect im Layer-Koordinatensystem: Oberkante bündig mit dem Viewport (Screen-Oberkante),
 * Unterkante bündig mit dem unteren Rand des Desktop-Layers.
 * Früher: y = minLayerY = inset − layerTop ließ oben {@link WINDOW_DESKTOP_INSET} frei — hier y = −layerTop.
 */
export function getDesktopLayerFullscreenRect() {
  if (typeof window === "undefined") {
    const desktopH = 900;
    const layerTop = SITE_HEADER_H;
    const desktopW = 1920;
    const minH = scaleLayoutPx(MIN_WIN_H, 1);
    return {
      x: 0,
      y: -layerTop,
      w: desktopW,
      h: Math.max(minH, layerTop + desktopH),
    };
  }
  const { w: desktopW, h: desktopH, layerTop } = getDesktopContentRect();
  const vh = getVisualViewportHeight();
  const hFromLayer = layerTop + desktopH;
  const minH = scaleLayoutPx(MIN_WIN_H, getLayoutUiScale());
  return {
    x: 0,
    y: -layerTop,
    w: desktopW,
    h: Math.max(minH, hFromLayer, vh),
  };
}

/**
 * Mobile-Home: Finder als Karte unter dem Slideshow-/Widget-Stapel,
 * volle Breite zwischen den Rändern (`inset` links wie rechts),
 * unten derselbe Mindestabstand `inset` — kein Vollbild (nur Viewports ≤767px).
 */
function getMobileFinderHomeCardBounds() {
  if (typeof window === "undefined") {
    return {
      x: WINDOW_DESKTOP_INSET,
      y: MOBILE_HOME_SLIDESHOW_BAND_EST_PX + 48,
      w: Math.max(MIN_WIN_W, 360 - 2 * WINDOW_DESKTOP_INSET),
      h: 420,
    };
  }
  const { w: desktopW } = getDesktopContentRect();
  const { inset, maxBottomLayer } = getDesktopWindowLayoutLimits();
  const innerW = Math.max(MIN_WIN_W, desktopW - 2 * inset);
  /** Sichtbarer Abstand Slideshow/Stapel → Finder (abgestimmt mit `MOBILE_WIDGET_BAND_PAD_FINDER_PX` in DesktopIcons). */
  const gapBelowWidget = 48;
  /** Oberkante Finder ≈ unter der Slideshow-Kachel, nicht nach Prozent der Layer-Höhe. */
  const widgetBandH = MOBILE_HOME_SLIDESHOW_BAND_EST_PX;
  const top = Math.max(inset, widgetBandH + gapBelowWidget);
  /** `maxBottomLayer` = `desktopH - inset` — Kartenunterkante bündig, wie bei x/w für links/rechts. */
  const h = Math.max(MIN_WIN_H, maxBottomLayer - top);
  return {
    x: inset,
    y: top,
    w: innerW,
    h,
  };
}

/** Gleichmäßiger Rand zum Layer-Rand für Finder-Widget-Asset-Vollbild (animiert wie Fenster-Bounds). */
export const ASSET_WIDGET_CHROME_FULLSCREEN_PAD =
  DESKTOP_ASSET_WIDGET_CHROME_FULLSCREEN_PAD_PX;

export function getDesktopAssetWidgetChromeFullscreenBounds() {
  const fs = getDesktopLayerFullscreenRect();
  const s = getLayoutUiScale();
  const p = scaleLayoutPx(DESKTOP_ASSET_WIDGET_CHROME_FULLSCREEN_PAD_PX, s);
  const minW = scaleLayoutPx(MIN_WIN_W, s);
  const minH = scaleLayoutPx(MIN_WIN_H, s);
  return {
    x: p,
    y: fs.y + p,
    w: Math.max(minW, fs.w - 2 * p),
    h: Math.max(minH, fs.h - 2 * p),
  };
}

/**
 * Desktop: Finder unten links, Asset-Widget oben rechts — gleicher Außenrand wie
 * {@link getDesktopAssetWidgetChromeFullscreenBounds} ({@link ASSET_WIDGET_CHROME_FULLSCREEN_PAD}).
 *
 * @param {{ w: number, h: number } | null | undefined} finderSize
 * @param {{ w: number, h: number }} assetSize
 * @returns {{ finder: { x: number, y: number } | null, asset: { x: number, y: number } }}
 */
function getDesktopFinderWidgetChromeSplitBounds(finderSize, assetSize) {
  const s = getLayoutUiScale();
  const pad = scaleLayoutPx(DESKTOP_ASSET_WIDGET_CHROME_FULLSCREEN_PAD_PX, s);
  const limits = getDesktopWindowLayoutLimits();
  const fs = getDesktopLayerFullscreenRect();
  const { desktopW, desktopH, minLayerY } = limits;

  const assetX = Math.max(pad, desktopW - assetSize.w - pad);
  let assetY = Math.max(
    minLayerY,
    Math.min(fs.y + pad, desktopH - assetSize.h - pad)
  );

  if (!finderSize?.w || !finderSize?.h) {
    return { finder: null, asset: { x: assetX, y: assetY } };
  }

  let finderY = Math.max(minLayerY, desktopH - finderSize.h - pad);
  const finderX = pad;
  const gap = scaleLayoutPx(8, s);
  if (assetY + assetSize.h > finderY - gap) {
    const nextAssetY = finderY - assetSize.h - gap;
    if (nextAssetY >= minLayerY) {
      assetY = nextAssetY;
    } else {
      finderY = Math.min(
        desktopH - finderSize.h - pad,
        Math.max(minLayerY, assetY + assetSize.h + gap)
      );
    }
  }

  return {
    finder: { x: finderX, y: finderY },
    asset: { x: assetX, y: assetY },
  };
}

/**
 * Gemessene Größe des `relative`-Desktop-Layers (Fenster-Positionierungs-Container).
 * Wird per {@link syncDesktopLayerMetrics} (ResizeObserver im `DesktopProvider`) aktualisiert.
 */
const desktopLayerMetrics = { w: 0, h: 0, top: SITE_HEADER_H };

/** @param {HTMLElement | null} el Desktop-Layer unter dem Site-Header */
export function syncDesktopLayerMetrics(el) {
  if (!el || typeof window === "undefined") return;
  const r = el.getBoundingClientRect();
  const w = Math.round(r.width);
  const h = Math.round(r.height);
  desktopLayerMetrics.w = w;
  desktopLayerMetrics.h = h;
  desktopLayerMetrics.top = r.top;
  const s = getDesktopUiScaleFromDims(w, h, window.innerWidth);
  const prevS = getLastDesktopUiScale();
  if (Math.abs(s - prevS) < 0.01) {
    return;
  }
  setLastDesktopUiScale(s);
  applyDesktopUiDocumentVars(document.documentElement);
}

/**
 * Größe des Desktop-Inhalts (Koordinatensystem von OSWindow: 0,0 = oben links im Layer).
 * `layerTop`: Abstand Layer-Oberkante → Viewport-Oberkante (für Bounds bis zum Seitenrand).
 */
export function getDesktopContentRect() {
  if (typeof window === "undefined") {
    return { w: 1920, h: 900, layerTop: SITE_HEADER_H };
  }
  const el = document.querySelector("[data-mm-desktop-layer]");
  if (el) {
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width);
    const layerTop = r.top;
    const rawH = Math.round(r.height);
    const h = capMobileDesktopLayerHPx(rawH, layerTop);
    desktopLayerMetrics.w = w;
    desktopLayerMetrics.h = h;
    desktopLayerMetrics.top = layerTop;
    return { w, h, layerTop };
  }
  if (desktopLayerMetrics.w > 0 && desktopLayerMetrics.h > 0) {
    const layerTop = desktopLayerMetrics.top;
    const h = capMobileDesktopLayerHPx(desktopLayerMetrics.h, layerTop);
    return {
      w: desktopLayerMetrics.w,
      h,
      layerTop,
    };
  }
  const w = document.documentElement?.clientWidth ?? window.innerWidth;
  const layerTop = SITE_HEADER_H;
  const rawH = window.innerHeight - SITE_HEADER_H;
  const h = capMobileDesktopLayerHPx(rawH, layerTop);
  return { w, h, layerTop };
}

/**
 * Desktop: mm-Radiooo kompakt oben links — gleicher Außenrand wie Content-Vollbild
 * ({@link getDesktopAssetWidgetChromeFullscreenBounds} / {@link ASSET_WIDGET_CHROME_FULLSCREEN_PAD}).
 * Beim ersten Öffnen und wenn das Video wieder eingeklappt wird.
 */
function getInitialDesktopMediaWindowPosition() {
  const fs = getDesktopLayerFullscreenRect();
  const s = getLayoutUiScale();
  const p = scaleLayoutPx(DESKTOP_ASSET_WIDGET_CHROME_FULLSCREEN_PAD_PX, s);
  return { x: p, y: fs.y + p };
}

const DesktopContext = createContext(null);

const FOLDER_PREVIEW_STORAGE_KEY = "mm-os-folder-preview";
const NOTES_TEXT_KEY = "mm-os-notes-text";

function centerWindow(size) {
  if (typeof window === "undefined") {
    return { x: 120, y: 180 };
  }
  const { desktopW, inset, maxBottomLayer, minLayerY } =
    getDesktopWindowLayoutLimits();
  const yMax = maxBottomLayer - size.h;
  return {
    x: Math.max(inset, (desktopW - size.w) / 2),
    y: Math.max(minLayerY, Math.min((minLayerY + yMax) / 2, yMax)),
  };
}

/**
 * Desktop: Start-Position unten links — gleiches Randmaß wie {@link DESKTOP_FINDER_START_EDGE_PX}.
 */
function getInitialDesktopFinderPosition(size) {
  const s = getLayoutUiScale();
  const edge = scaleLayoutPx(DESKTOP_FINDER_START_EDGE_PX, s);
  const { desktopH, minLayerY } = getDesktopWindowLayoutLimits();
  return {
    x: edge,
    y: Math.max(minLayerY, desktopH - size.h - edge),
  };
}

/**
 * @param {string} appId
 */
function getScaledAppDefaultSize(appId) {
  const def = APPS[appId];
  if (!def?.defaultSize) return { w: 520, h: 520 };
  if (isMobileViewport()) {
    return { w: def.defaultSize.w, h: def.defaultSize.h };
  }
  const s = getLastDesktopUiScale();
  return {
    w: scaleLayoutPx(def.defaultSize.w, s),
    h: scaleLayoutPx(def.defaultSize.h, s),
  };
}

/** Erstes Laden ohne gespeicherten State: Finder fest positioniert (Desktop) bzw. Karte unter Widgets (Mobile). */
function createInitialFinderWindow() {
  const def = APPS.finder;
  const id = `finder-${Date.now()}`;
  const baseZ = 21;
  if (isMobileViewport()) {
    return {
      id,
      appId: "finder",
      title: def.title,
      ...getMobileFinderHomeCardBounds(),
      z: baseZ,
      minimized: false,
      maximized: false,
      prevBounds: null,
      mobileImmersive: false,
    };
  }
  const defSize = getScaledAppDefaultSize("finder");
  const pos = getInitialDesktopFinderPosition(defSize);
  return {
    id,
    appId: "finder",
    title: def.title,
    x: pos.x,
    y: pos.y,
    w: defSize.w,
    h: defSize.h,
    z: baseZ,
    minimized: false,
    maximized: false,
    prevBounds: null,
    mobileImmersive: false,
  };
}

/** Einheitlicher Schlüssel für „eine Datei = ein Fenster“. */
export function assetFileDedupeKey({ dir, file, basePath = "/web" }) {
  return `${basePath}::${dir}::${file}`;
}

function findAssetFileWindow(prev, key) {
  return prev.find(
    (w) =>
      w.appId === "assetFile" &&
      w.assetFile &&
      assetFileDedupeKey(w.assetFile) === key
  );
}

function findAnyAssetFileWindow(prev) {
  const assetWins = prev.filter((w) => w.appId === "assetFile" && w.assetFile);
  if (assetWins.length === 0) return undefined;
  return assetWins.reduce((a, b) => (a.z >= b.z ? a : b));
}

/** Wie `DesktopIcons`: schwebende Kacheln (Pixel-Drag). */
const DESKTOP_FLOAT_ICON_W = 200;
const DESKTOP_FLOAT_ICON_H = 240;

/**
 * @param {Record<string, unknown>} positions
 * @returns {Record<string, unknown>}
 */
function clampFloatingDesktopIconPositions(positions, layerW, layerH, layerTop) {
  if (layerW <= 0 || layerH <= 0 || !positions || typeof positions !== "object") {
    return positions;
  }
  const s = isMobileViewport() ? 1 : getLastDesktopUiScale();
  const floatW = scaleLayoutPx(DESKTOP_FLOAT_ICON_W, s);
  const floatH = scaleLayoutPx(DESKTOP_FLOAT_ICON_H, s);
  const maxX = Math.max(0, layerW - floatW);
  const maxY = Math.max(0, layerH - floatH);
  const minY = -layerTop;
  const out = { ...positions };
  for (const key of Object.keys(out)) {
    const pos = out[key];
    if (!pos || typeof pos !== "object") continue;
    if ("align" in pos && pos.align === "bottom-left") continue;
    const p = /** @type {{ xp?: number, yp?: number, x?: number, y?: number, align?: string }} */ (
      pos
    );
    if (
      typeof p.xp === "number" &&
      Number.isFinite(p.xp) &&
      typeof p.yp === "number" &&
      Number.isFinite(p.yp)
    ) {
      out[key] = {
        ...p,
        xp: Math.min(1, Math.max(0, p.xp)),
        yp: Math.min(1, Math.max(0, p.yp)),
      };
      continue;
    }
    if (
      typeof p.x === "number" &&
      Number.isFinite(p.x) &&
      typeof p.y === "number" &&
      Number.isFinite(p.y)
    ) {
      out[key] = {
        ...p,
        x: Math.max(0, Math.min(p.x, maxX)),
        y: Math.max(minY, Math.min(p.y, maxY)),
      };
    }
  }
  return out;
}

/** Desktop-Icons: immer Standard aus `lib/apps`, an den Layer geklemmt — kein localStorage. */
function getClampedDefaultDesktopIconPositions() {
  const defaults = getDefaultDesktopIconPositions();
  if (typeof window === "undefined") return defaults;
  const { w, h, layerTop } = getDesktopContentRect();
  return clampFloatingDesktopIconPositions(defaults, w, h, layerTop);
}

function clampWindowsToViewport(windows) {
  if (typeof window === "undefined") return windows;
  const {
    desktopW,
    desktopH,
    inset,
    innerW,
    maxWinH,
    maxBottomLayer,
    minLayerY,
    minWinW,
    minWinH,
  } = getDesktopWindowLayoutLimits();
  const s = getLayoutUiScale();
  const mediaPxX = scaleLayoutPx(MEDIA_MINIMIZE_INSET_X, s);
  const mediaPxY = scaleLayoutPx(MEDIA_MINIMIZE_INSET_Y, s);
  const { w: mCompactW, h: mCompactH } = getMediaCompactWindowSize();

  let list = windows.map((win) => {
    if (!isMobileViewport() && win.mobileImmersive && win.prevBounds) {
      const pb = win.prevBounds;
      return {
        ...win,
        x: pb.x,
        y: pb.y,
        w: pb.w,
        h: pb.h,
        maximized: false,
        mobileImmersive: false,
      };
    }
    return win;
  });

  if (isMobileViewport()) {
    return list.map((win) => {
      if (win.minimized) return win;
      if (win.appId === "finder") {
        return {
          ...win,
          ...getMobileFinderHomeCardBounds(),
          maximized: false,
          mobileImmersive: false,
          prevBounds: null,
        };
      }
      const fs = getDesktopLayerFullscreenRect();
      if (win.appId === "media" && win.mediaVideoCollapsed) {
        const def = APPS.media;
        const pos = centerWindow(def.defaultSize);
        const fallbackPb = {
          x: pos.x,
          y: pos.y,
          w: def.defaultSize.w,
          h: def.defaultSize.h,
        };
        const pb =
          win.prevBounds && typeof win.prevBounds.w === "number"
            ? win.prevBounds
            : fallbackPb;
        return {
          ...win,
          mediaVideoCollapsed: false,
          ...fs,
          maximized: true,
          prevBounds: pb,
          mobileImmersive: true,
        };
      }
      const pb =
        win.mobileImmersive && win.prevBounds
          ? win.prevBounds
          : { x: win.x, y: win.y, w: win.w, h: win.h };
      return {
        ...win,
        ...fs,
        maximized: true,
        prevBounds: pb,
        mobileImmersive: true,
      };
    });
  }

  const desktopClamped = list.map((win) => {
    if (win.maximized) {
      return {
        ...win,
        ...getDesktopLayerFullscreenRect(),
      };
    }
    if (
      win.appId === "assetFile" &&
      win.assetFile?.widgetChrome &&
      win.assetFile?.widgetChromeFullscreen
    ) {
      return {
        ...win,
        ...getDesktopAssetWidgetChromeFullscreenBounds(),
      };
    }
    let { x, y, w, h } = win;
    if (win.appId === "media" && win.mediaVideoCollapsed) {
      w = mCompactW;
      h = mCompactH;
      x = Math.max(inset, Math.min(x, desktopW - w - mediaPxX));
      y = Math.max(minLayerY, Math.min(y, desktopH - h - mediaPxY));
    } else {
      w = Math.max(minWinW, Math.min(w, innerW));
      h = Math.max(minWinH, Math.min(h, maxWinH));
      if (win.appId === "finder") {
        h = Math.min(h, getFinderDesktopMaxSidePx(innerW));
      }
      x = Math.max(inset, Math.min(x, desktopW - w - inset));
      y = Math.max(minLayerY, Math.min(y, maxBottomLayer - h));
    }
    return { ...win, x, y, w, h };
  });

  return desktopClamped;
}

export function DesktopProvider({ children }) {
  const [windows, setWindows] = useState([]);
  /** Invalidiert UI, die `getLastDesktopUiScale` / `getDesktopWindowLayoutLimits` nutzt (wenn sich der Layer ändert). */
  const [desktopUiScale, setDesktopUiScale] = useState(1);
  const [folderPreview, setFolderPreviewState] = useState(true);
  const [desktopIconPositions, setDesktopIconPositions] = useState(() =>
    getDefaultDesktopIconPositions()
  );
  const [desktopWidgets, setDesktopWidgets] = useState(() =>
    getDefaultDesktopWidgets()
  );
  const skipNotesPersist = useRef(true);
  const zCounter = useRef(20);
  /** Ein Notiz-Dokument (Absätze durch \\n\\n); ältere Absätze werden in der UI durchgestrichen. */
  const [notesText, setNotesText] = useState("");
  /** Einmaliges Vorausfüllen der Notes-App (z. B. aus Finder „Notiz zu Ordner“). */
  const [notesComposerPreset, setNotesComposerPreset] = useState(null);
  /** Bounds vor Media-„Minimieren“ (nur Video ausblenden), pro Fenster-ID */
  const mediaPreCollapseBoundsRef = useRef(new Map());

  /** Finder: Projekt-Kontext + Tabs; Dateien öffnen in eigenem assetFile-Fenster. */
  const [finderProjectAppId, setFinderProjectAppId] = useState(null);
  /** Geöffnete Projekt-Tabs (Reihenfolge). */
  const [finderTabAppIds, setFinderTabAppIds] = useState([]);
  /** Desktop Classic-Home: Suche zunächst nur als Lupe in der Titelleiste; Klick klappt die Zeile aus. */
  const [finderClassicSearchExpanded, setFinderClassicSearchExpanded] =
    useState(false);
  /** Projekt-/Tab-/Vorschau-Ansicht: Suchzeile im Inhalt; einklappbar wie im Classic-Home. */
  const [finderProjectSearchStripExpanded, setFinderProjectSearchStripExpanded] =
    useState(false);
  /** DOM-Knoten in der Finder-Titelleiste — `createPortal` für die Desktop-Suche (nicht unter dem Inhalt). */
  const [finderTitlebarSearchSlotEl, setFinderTitlebarSearchSlotEl] =
    useState(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(FOLDER_PREVIEW_STORAGE_KEY) === "0") {
        setFolderPreviewState(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setDesktopIconPositions(getClampedDefaultDesktopIconPositions());
  }, []);

  useEffect(() => {
    const limits = getDesktopWindowLayoutLimits();
    const fs = getDesktopLayerFullscreenRect();
    const { w, h, layerTop } = getDesktopContentRect();
    if (w <= 0 || h <= 0) return;
    const stackPos = computeDefaultWidgetStackLayerPosition(
      w,
      h,
      limits.minLayerY,
      fs.y
    );
    const stackIdSet = new Set(DESKTOP_STACK_WIDGET_IDS);
    const placed = getDefaultDesktopWidgets().map((wig) => {
      if (wig.kind === "slideshow" && stackIdSet.has(wig.id)) {
        return { ...wig, desktop: { x: stackPos.x, y: stackPos.y } };
      }
      return wig;
    });
    const merged = syncDefaultStackWidgetPositions(placed);
    setDesktopWidgets(
      clampDesktopWidgetsToLayer(
        merged,
        w,
        h,
        layerTop,
        limits.minLayerY
      )
    );
  }, []);

  /** Voller Seiten-Reload: Fenster + Schreibtisch-Layout immer Standard (kein localStorage). */
  useEffect(() => {
    zCounter.current = 21;
    setWindows([createInitialFinderWindow()]);
  }, []);

  /** Viewport / Layer: Fenster begrenzen; Mobile = fullscreen, Desktop inkl. minimierter Media-Position. */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const el = document.querySelector("[data-mm-desktop-layer]");
    if (!el) return undefined;
    const run = () => {
      syncDesktopLayerMetrics(el);
      setDesktopUiScale(getLastDesktopUiScale());
      setWindows((prev) => clampWindowsToViewport(prev));
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    window.addEventListener("resize", run);
    window.visualViewport?.addEventListener("resize", run);
    window.visualViewport?.addEventListener("scroll", run);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", run);
      window.visualViewport?.removeEventListener("resize", run);
      window.visualViewport?.removeEventListener("scroll", run);
    };
  }, []);

  /** Letzter angewendeter Titelleisten-Zusatz (px), damit dh bei Toggle stabil bleibt. */
  const finderTitlebarExpandAppliedRef = useRef(0);

  /**
   * Finder (Desktop): Breite nach Modus (Classic 1∶1 / Projekt 10∶8), plus Zusatzhöhe wenn Titelleisten-Suche offen:
   * `h` um {@link FINDER_TITLEBAR_EXPAND_PX} vergrößern und `y` nach oben — Rahmen wächst mit, kein transform:scale.
   */
  useLayoutEffect(() => {
    if (typeof window === "undefined" || isMobileViewport()) return;

    const classicHome =
      finderProjectAppId === null && finderTabAppIds.length === 0;
    const gridSquareMode = classicHome;

    const s = getLayoutUiScale();
    const expandBase =
      finderClassicSearchExpanded || finderProjectSearchStripExpanded
        ? FINDER_TITLEBAR_EXPAND_PX
        : 0;
    const expandPx = scaleLayoutPx(expandBase, s);

    const prevExpand = finderTitlebarExpandAppliedRef.current;
    const dh = expandPx - prevExpand;

    setWindows((prev) => {
      const idx = prev.findIndex((w) => w.appId === "finder");
      if (idx === -1) return prev;

      const win = prev[idx];
      if (win.maximized) {
        finderTitlebarExpandAppliedRef.current = expandPx;
        return prev;
      }

      const { innerW, maxBottomLayer, minLayerY, desktopW, inset, minWinW, minWinH } =
        getDesktopWindowLayoutLimits();
      const maxSide = getFinderDesktopMaxSidePx(innerW);
      const defH = getScaledAppDefaultSize("finder").h;

      let nh = win.h + dh;
      nh = Math.max(minWinH, Math.min(nh, maxSide));
      /** Mindesthöhe wie Default-Größe (bis maxSide), damit der Finder nach kleinen persistierten Maßen wieder „normal“ wirkt. */
      nh = Math.max(nh, Math.min(defH, maxSide));
      const actualDh = nh - win.h;
      let ny = win.y - actualDh;

      const hCore = Math.min(nh - expandPx, maxSide);
      const hTotal = hCore + expandPx;

      let targetW = gridSquareMode
        ? Math.min(hCore, innerW)
        : Math.min(Math.round((hCore * 10) / 8), innerW);
      targetW = Math.max(minWinW, targetW);

      const x = Math.max(inset, Math.min(win.x, desktopW - targetW - inset));
      ny = Math.max(minLayerY, Math.min(ny, maxBottomLayer - hTotal));

      if (
        win.w === targetW &&
        win.h === hTotal &&
        win.x === x &&
        win.y === ny
      ) {
        finderTitlebarExpandAppliedRef.current = expandPx;
        return prev;
      }

      finderTitlebarExpandAppliedRef.current = expandPx;

      const next = [...prev];
      next[idx] = { ...win, w: targetW, h: hTotal, x, y: ny };
      return next;
    });
  }, [
    windows,
    finderProjectAppId,
    finderTabAppIds,
    finderClassicSearchExpanded,
    finderProjectSearchStripExpanded,
    desktopUiScale,
  ]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTES_TEXT_KEY);
      if (raw === null) return;
      const migrated = migrateNotesText(raw);
      if (migrated !== raw) {
        try {
          localStorage.setItem(NOTES_TEXT_KEY, migrated);
        } catch {
          /* ignore */
        }
      }
      setNotesText(migrated);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (skipNotesPersist.current) {
      skipNotesPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(NOTES_TEXT_KEY, notesText);
    } catch {
      /* ignore */
    }
  }, [notesText]);

  const setDesktopIconPosition = useCallback((appId, x, y) => {
    setDesktopIconPositions((prev) => ({ ...prev, [appId]: { x, y } }));
  }, []);

  const resetDesktopIconPositions = useCallback(() => {
    setDesktopIconPositions(getDefaultDesktopIconPositions());
  }, []);

  const setDesktopWidgetPosition = useCallback((id, x, y) => {
    setDesktopWidgets((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, desktop: { x, y } } : w
      )
    );
  }, []);

  /** Gleiche Pixel-Lage für mehrere Widgets (z. B. Stapel verschieben). */
  const setDesktopWidgetPositionsForIds = useCallback((ids, x, y) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const set = new Set(ids);
    setDesktopWidgets((prev) =>
      prev.map((w) => (set.has(w.id) ? { ...w, desktop: { x, y } } : w))
    );
  }, []);

  const setFolderPreview = useCallback((value) => {
    setFolderPreviewState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        localStorage.setItem(FOLDER_PREVIEW_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  /** Finder einblenden / anlegen — ohne Z nach vorne (Stapel wie bei anderen Fenstern). */
  const focusFinderWindow = useCallback(() => {
    setWindows((prev) => {
      const fw = prev.find((w) => w.appId === "finder");
      if (!fw) {
        zCounter.current += 1;
        return [...prev, { ...createInitialFinderWindow(), z: zCounter.current }];
      }
      return prev.map((w) =>
        w.appId === "finder" ? { ...w, minimized: false } : w
      );
    });
  }, []);

  /** Beim Öffnen/Vorschau: Tab nach vorne (Reihenfolge beim reinen Tab-Wechsel bleibt stabil). */
  const promoteFinderTabToFront = useCallback((prev, appId) => {
    const withId = prev.includes(appId) ? prev : [...prev, appId];
    return [appId, ...withId.filter((id) => id !== appId)];
  }, []);

  const expandFinderClassicSearch = useCallback(() => {
    setFinderClassicSearchExpanded(true);
  }, []);

  const collapseFinderClassicSearch = useCallback(() => {
    setFinderClassicSearchExpanded(false);
  }, []);

  const expandFinderProjectSearchStrip = useCallback(() => {
    setFinderProjectSearchStripExpanded(true);
  }, []);

  const collapseFinderProjectSearchStrip = useCallback(() => {
    setFinderProjectSearchStripExpanded(false);
  }, []);

  const finderGoHome = useCallback(() => {
    setFinderTabAppIds([]);
    setFinderProjectAppId(null);
    setFinderClassicSearchExpanded(false);
    setFinderProjectSearchStripExpanded(false);
    focusFinderWindow();
  }, [focusFinderWindow]);

  const finderOpenProject = useCallback(
    (appId) => {
      const def = APPS[appId];
      if (!def?.assetDir) return;
      setFinderProjectAppId(appId);
      setFinderTabAppIds((prev) => promoteFinderTabToFront(prev, appId));
      setWindows((prev) => {
        const fw = prev.find((w) => w.appId === "finder");
        if (!fw) {
          zCounter.current += 1;
          return [...prev, { ...createInitialFinderWindow(), z: zCounter.current }];
        }
        return prev.map((w) =>
          w.appId === "finder" ? { ...w, minimized: false } : w
        );
      });
    },
    [promoteFinderTabToFront]
  );

  const finderSwitchTab = useCallback(
    (appId) => {
      if (appId === null) {
        finderGoHome();
        return;
      }
      const def = APPS[appId];
      if (!def?.assetDir) return;
      setFinderProjectAppId(appId);
      focusFinderWindow();
    },
    [finderGoHome, focusFinderWindow]
  );

  const finderCloseTab = useCallback(
    (appId) => {
      setFinderTabAppIds((prevTabs) => {
        const nextTabs = prevTabs.filter((id) => id !== appId);
        setFinderProjectAppId((pid) => {
          if (pid !== appId) return pid;
          if (nextTabs.length === 0) {
            setFinderClassicSearchExpanded(false);
            return null;
          }
          return nextTabs[0];
        });
        return nextTabs;
      });
      focusFinderWindow();
    },
    [focusFinderWindow]
  );

  const openOrFocus = useCallback((appId) => {
    const def = APPS[appId];
    if (!def) return;

    if (def.assetDir) {
      finderOpenProject(appId);
      return;
    }

    setWindows((prev) => {
      const existing = prev.find((w) => w.appId === appId);
      if (existing) {
        zCounter.current += 1;
        return prev.map((w) =>
          w.appId === appId
            ? { ...w, minimized: false, z: zCounter.current }
            : w
        );
      }
      zCounter.current += 1;
      const id = `${appId}-${Date.now()}`;
      if (appId === "media") {
        if (isMobileViewport()) {
          const pos = centerWindow(def.defaultSize);
          const pb = {
            x: pos.x,
            y: pos.y,
            w: def.defaultSize.w,
            h: def.defaultSize.h,
          };
          const fs = getDesktopLayerFullscreenRect();
          return [
            ...prev,
            {
              id,
              appId,
              title: def.title,
              ...fs,
              z: zCounter.current,
              minimized: false,
              maximized: true,
              prevBounds: pb,
              mobileImmersive: true,
              mediaVideoCollapsed: false,
            },
          ];
        }
        const pos = getInitialDesktopMediaWindowPosition();
        const m = getMediaCompactWindowSize();
        return [
          ...prev,
          {
            id,
            appId,
            title: def.title,
            x: pos.x,
            y: pos.y,
            w: m.w,
            h: m.h,
            z: zCounter.current,
            minimized: false,
            maximized: false,
            prevBounds: null,
            mobileImmersive: false,
            mediaVideoCollapsed: true,
          },
        ];
      }
      if (isMobileViewport()) {
        const pos = centerWindow(def.defaultSize);
        const pb = {
          x: pos.x,
          y: pos.y,
          w: def.defaultSize.w,
          h: def.defaultSize.h,
        };
        const fs = getDesktopLayerFullscreenRect();
        return [
          ...prev,
          {
            id,
            appId,
            title: def.title,
            ...fs,
            z: zCounter.current,
            minimized: false,
            maximized: true,
            prevBounds: pb,
            mobileImmersive: true,
          },
        ];
      }
      const dSize = getScaledAppDefaultSize(appId);
      const pos = centerWindow(dSize);
      return [
        ...prev,
        {
          id,
          appId,
          title: def.title,
          x: pos.x,
          y: pos.y,
          w: dSize.w,
          h: dSize.h,
          z: zCounter.current,
          minimized: false,
          maximized: false,
          prevBounds: null,
          mobileImmersive: false,
        },
      ];
    });
  }, [finderOpenProject]);

  /** Datei aus einem Asset-Ordner: höchstens ein Fenster; gleiche Datei nur nach vorne; sonst Inhalt ersetzen. */
  const openAssetFileWindow = useCallback(
    ({ dir, file, basePath = "/web" }, options = {}) => {
      const def = APPS.assetFile;
      if (!def || !dir || !file) return;
      const fromFinder = options.fromFinder === true;

      const key = assetFileDedupeKey({ dir, file, basePath });

      setWindows((prev) => {
        const existing = findAssetFileWindow(prev, key);
        if (existing) {
          zCounter.current += 1;
          return prev.map((w) =>
            w.id === existing.id
              ? { ...w, minimized: false, z: zCounter.current }
              : w
          );
        }

        const reuse = findAnyAssetFileWindow(prev);
        if (reuse) {
          zCounter.current += 1;
          const nextAssetFile = fromFinder
            ? { dir, file, basePath, widgetChrome: true, widgetChromeFullscreen: false }
            : {
                dir,
                file,
                basePath,
                ...(reuse.assetFile?.widgetChrome === true
                  ? { widgetChrome: true }
                  : {}),
                widgetChromeFullscreen: false,
              };
          /**
           * Wenn schon ein Content-Fenster offen ist, nur Inhalt und Z-Order ändern —
           * kein erneutes Eck-Layout. Das passiert nur beim ersten `fromFinder`-Öffnen
           * ohne existierendes assetFile (s. unten).
           */
          return prev
            .filter((w) => w.appId !== "assetFile" || w.id === reuse.id)
            .map((w) => {
              if (w.id !== reuse.id) return w;
              const wasFullW = w.assetFile?.widgetChromeFullscreen === true;
              const restoreW =
                wasFullW && w.prevBounds ? w.prevBounds : null;
              return {
                ...w,
                title: file,
                assetFile: nextAssetFile,
                minimized: false,
                z: zCounter.current,
                ...(restoreW
                  ? {
                      x: restoreW.x,
                      y: restoreW.y,
                      w: restoreW.w,
                      h: restoreW.h,
                      prevBounds: null,
                    }
                  : {}),
              };
            });
        }

        zCounter.current += 1;
        const id = `assetFile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        if (isMobileViewport()) {
          const pos = centerWindow(def.defaultSize);
          const pb = {
            x: pos.x,
            y: pos.y,
            w: def.defaultSize.w,
            h: def.defaultSize.h,
          };
          const fs = getDesktopLayerFullscreenRect();
          return [
            ...prev,
            {
              id,
              appId: def.id,
              title: file,
              ...fs,
              z: zCounter.current,
              minimized: false,
              maximized: true,
              prevBounds: pb,
              mobileImmersive: true,
              assetFile: { dir, file, basePath },
            },
          ];
        }
        if (fromFinder) {
          const finderWin = prev.find(
            (w) => w.appId === "finder" && !w.minimized
          );
          const W = getAssetWidgetFrameSidePx();
          const split = getDesktopFinderWidgetChromeSplitBounds(
            finderWin ? { w: finderWin.w, h: finderWin.h } : null,
            { w: W, h: W }
          );
          const next = prev.map((w) => {
            if (
              split.finder &&
              finderWin &&
              w.appId === "finder" &&
              !w.minimized &&
              w.id === finderWin.id
            ) {
              return { ...w, x: split.finder.x, y: split.finder.y };
            }
            return w;
          });
          return [
            ...next,
            {
              id,
              appId: def.id,
              title: file,
              x: split.asset.x,
              y: split.asset.y,
              w: W,
              h: W,
              z: zCounter.current,
              minimized: false,
              maximized: false,
              prevBounds: null,
              mobileImmersive: false,
              assetFile: { dir, file, basePath, widgetChrome: true },
            },
          ];
        }
        const dSize = getScaledAppDefaultSize("assetFile");
        const pos = centerWindow(dSize);
        return [
          ...prev,
          {
            id,
            appId: def.id,
            title: file,
            x: pos.x,
            y: pos.y,
            w: dSize.w,
            h: dSize.h,
            z: zCounter.current,
            minimized: false,
            maximized: false,
            prevBounds: null,
            mobileImmersive: false,
            assetFile: { dir, file, basePath },
          },
        ];
      });
    },
    []
  );

  /** Leertaste im Finder/Baum: Fenster zur Datei öffnen oder schließen. */
  const toggleAssetFileWindow = useCallback(
    ({ dir, file, basePath = "/web" }, options = {}) => {
      const def = APPS.assetFile;
      if (!def || !dir || !file) return;
      const fromFinder = options.fromFinder === true;

      const key = assetFileDedupeKey({ dir, file, basePath });

      setWindows((prev) => {
        const existing = findAssetFileWindow(prev, key);
        if (existing) {
          return prev.filter((w) => w.id !== existing.id);
        }

        const reuse = findAnyAssetFileWindow(prev);
        if (reuse) {
          zCounter.current += 1;
          const nextAssetFile = fromFinder
            ? { dir, file, basePath, widgetChrome: true, widgetChromeFullscreen: false }
            : {
                dir,
                file,
                basePath,
                ...(reuse.assetFile?.widgetChrome === true
                  ? { widgetChrome: true }
                  : {}),
                widgetChromeFullscreen: false,
              };
          return prev
            .filter((w) => w.appId !== "assetFile" || w.id === reuse.id)
            .map((w) => {
              if (w.id !== reuse.id) return w;
              const wasFullW = w.assetFile?.widgetChromeFullscreen === true;
              const restoreW =
                wasFullW && w.prevBounds ? w.prevBounds : null;
              return {
                ...w,
                title: file,
                assetFile: nextAssetFile,
                minimized: false,
                z: zCounter.current,
                ...(restoreW
                  ? {
                      x: restoreW.x,
                      y: restoreW.y,
                      w: restoreW.w,
                      h: restoreW.h,
                      prevBounds: null,
                    }
                  : {}),
              };
            });
        }

        zCounter.current += 1;
        const id = `assetFile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        if (isMobileViewport()) {
          const pos = centerWindow(def.defaultSize);
          const pb = {
            x: pos.x,
            y: pos.y,
            w: def.defaultSize.w,
            h: def.defaultSize.h,
          };
          const fs = getDesktopLayerFullscreenRect();
          return [
            ...prev,
            {
              id,
              appId: def.id,
              title: file,
              ...fs,
              z: zCounter.current,
              minimized: false,
              maximized: true,
              prevBounds: pb,
              mobileImmersive: true,
              assetFile: { dir, file, basePath },
            },
          ];
        }
        if (fromFinder) {
          const finderWin = prev.find(
            (w) => w.appId === "finder" && !w.minimized
          );
          const W = getAssetWidgetFrameSidePx();
          const split = getDesktopFinderWidgetChromeSplitBounds(
            finderWin ? { w: finderWin.w, h: finderWin.h } : null,
            { w: W, h: W }
          );
          const next = prev.map((w) => {
            if (
              split.finder &&
              finderWin &&
              w.appId === "finder" &&
              !w.minimized &&
              w.id === finderWin.id
            ) {
              return { ...w, x: split.finder.x, y: split.finder.y };
            }
            return w;
          });
          return [
            ...next,
            {
              id,
              appId: def.id,
              title: file,
              x: split.asset.x,
              y: split.asset.y,
              w: W,
              h: W,
              z: zCounter.current,
              minimized: false,
              maximized: false,
              prevBounds: null,
              mobileImmersive: false,
              assetFile: { dir, file, basePath, widgetChrome: true },
            },
          ];
        }
        const dSize = getScaledAppDefaultSize("assetFile");
        const pos = centerWindow(dSize);
        return [
          ...prev,
          {
            id,
            appId: def.id,
            title: file,
            x: pos.x,
            y: pos.y,
            w: dSize.w,
            h: dSize.h,
            z: zCounter.current,
            minimized: false,
            maximized: false,
            prevBounds: null,
            mobileImmersive: false,
            assetFile: { dir, file, basePath },
          },
        ];
      });
    },
    []
  );

  /** Finder: Asset-Widget oben rechts; Finder unten links ({@link openAssetFileWindow} `fromFinder`, Kantenlänge skaliert). */
  const finderOpenProjectFile = useCallback(
    ({ dir, file, basePath = "/web" }) => {
      if (!dir || !file) return;
      const pid = webAssetAppId(dir);
      if (APPS[pid]?.assetDir) {
        setFinderProjectAppId(pid);
        setFinderTabAppIds((prev) => promoteFinderTabToFront(prev, pid));
      }
      openAssetFileWindow({ dir, file, basePath }, { fromFinder: true });
    },
    [openAssetFileWindow, promoteFinderTabToFront]
  );

  const finderToggleProjectFile = useCallback(
    ({ dir, file, basePath = "/web" }) => {
      if (!dir || !file) return;
      const pid = webAssetAppId(dir);
      if (APPS[pid]?.assetDir) {
        setFinderProjectAppId(pid);
        setFinderTabAppIds((p) => promoteFinderTabToFront(p, pid));
      }
      toggleAssetFileWindow({ dir, file, basePath }, { fromFinder: true });
    },
    [toggleAssetFileWindow, promoteFinderTabToFront]
  );

  /** Gleiches Asset-Fenster: andere Datei im selben Ordner (Pfeiltasten-Navigation). */
  const setAssetFileForWindow = useCallback((windowId, { dir, file, basePath = "/web" }) => {
    if (!windowId || !dir || !file) return;
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId || w.appId !== "assetFile") return w;
        return {
          ...w,
          title: file,
          assetFile: {
            ...w.assetFile,
            dir,
            file,
            basePath,
          },
        };
      })
    );
  }, []);

  const closeWindow = useCallback((id) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  /** Oberstes nicht minimiertes Fenster schließen (Desktop-Tastatur / Dock). Finder bleibt erhalten. */
  const closeTopVisibleWindow = useCallback(() => {
    setWindows((prev) => {
      const visible = prev.filter((w) => !w.minimized);
      if (visible.length === 0) return prev;
      const top = visible.reduce((a, b) => (a.z >= b.z ? a : b));
      if (top.appId === "finder") return prev;
      return prev.filter((w) => w.id !== top.id);
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setWindows([]);
  }, []);

  /** Klick/Titelzeile/Resize: Fenster nach vorne. Kein State-Update, wenn es bereits oben liegt (minimiert → immer heben). */
  const focusWindow = useCallback((id) => {
    setWindows((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target) return prev;
      const visible = prev.filter((w) => !w.minimized);
      const topZ =
        visible.length === 0 ? 0 : Math.max(...visible.map((w) => w.z));
      if (!target.minimized && target.z >= topZ) return prev;
      zCounter.current += 1;
      return prev.map((w) =>
        w.id === id ? { ...w, z: zCounter.current, minimized: false } : w
      );
    });
  }, []);

  const minimizeWindow = useCallback((id) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: true } : w))
    );
  }, []);

  /** Nur Media-Fenster: Video-Bereich ausblenden / wiederherstellen (Titelleiste + Transport bleiben). */
  const toggleMediaPlayerVideoPanel = useCallback((id) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id || w.appId !== "media") return w;
        const nextCollapsed = !w.mediaVideoCollapsed;
        if (nextCollapsed) {
          mediaPreCollapseBoundsRef.current.set(id, {
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
          });
          const pos = getInitialDesktopMediaWindowPosition();
          const m = getMediaCompactWindowSize();
          return {
            ...w,
            mediaVideoCollapsed: true,
            w: m.w,
            h: m.h,
            x: pos.x,
            y: pos.y,
          };
        }
        const saved = mediaPreCollapseBoundsRef.current.get(id);
        const fallback = getScaledAppDefaultSize("media");
        const { minWinW, minWinH, desktopW, inset, maxBottomLayer, minLayerY } =
          getDesktopWindowLayoutLimits();
        const rw =
          saved && typeof saved.w === "number" && Number.isFinite(saved.w)
            ? Math.max(minWinW, saved.w)
            : fallback.w;
        const rh =
          saved && typeof saved.h === "number" && Number.isFinite(saved.h)
            ? Math.max(minWinH, saved.h)
            : fallback.h;
        // Untere rechte Ecke des kompakten Fensters beibehalten → Größe wächst nach links oben.
        let rx = w.x + w.w - rw;
        let ry = w.y + w.h - rh;
        if (typeof window !== "undefined") {
          rx = Math.max(inset, Math.min(rx, desktopW - rw - inset));
          ry = Math.max(minLayerY, Math.min(ry, maxBottomLayer - rh));
        }
        return {
          ...w,
          mediaVideoCollapsed: false,
          x: rx,
          y: ry,
          w: rw,
          h: rh,
        };
      })
    );
  }, []);

  const toggleMaximize = useCallback((id) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized) {
          const pb = w.prevBounds;
          return pb
            ? {
                ...w,
                maximized: false,
                x: pb.x,
                y: pb.y,
                w: pb.w,
                h: pb.h,
                prevBounds: null,
              }
            : { ...w, maximized: false };
        }
        const pb = { x: w.x, y: w.y, w: w.w, h: w.h };
        if (typeof window === "undefined") return w;
        const fs = getDesktopLayerFullscreenRect();
        return {
          ...w,
          maximized: true,
          prevBounds: pb,
          ...fs,
        };
      })
    );
  }, []);

  /** Finder-Widget-Dateifenster: Vollbild mit gleichmäßigem Rand; Finder animiert wie Desktop-Widgets. */
  const toggleAssetWidgetChromeFullscreen = useCallback((id) => {
    setWindows((prev) => {
      const target = prev.find(
        (w) =>
          w.id === id &&
          w.appId === "assetFile" &&
          w.assetFile?.widgetChrome === true
      );
      if (!target?.assetFile) return prev;

      const full = target.assetFile.widgetChromeFullscreen === true;
      zCounter.current += 1;
      const nextZ = zCounter.current;

      return prev.map((w) => {
        if (w.id !== id || w.appId !== "assetFile" || !w.assetFile?.widgetChrome) {
          return w;
        }
        if (full) {
          const pb = w.prevBounds;
          return {
            ...w,
            z: nextZ,
            assetFile: { ...w.assetFile, widgetChromeFullscreen: false },
            ...(pb &&
            typeof pb.x === "number" &&
            typeof pb.y === "number" &&
            typeof pb.w === "number" &&
            typeof pb.h === "number"
              ? {
                  x: pb.x,
                  y: pb.y,
                  w: pb.w,
                  h: pb.h,
                  prevBounds: null,
                }
              : {}),
          };
        }
        const pb = { x: w.x, y: w.y, w: w.w, h: w.h };
        const b = getDesktopAssetWidgetChromeFullscreenBounds();
        return {
          ...w,
          z: nextZ,
          maximized: false,
          prevBounds: pb,
          ...b,
          assetFile: { ...w.assetFile, widgetChromeFullscreen: true },
        };
      });
    });
  }, []);

  const moveWindow = useCallback((id, x, y) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y, maximized: false } : w))
    );
  }, []);

  /** Hängt einen Absatz an (z. B. Schnellnotiz-Leiste); Referenz als @-Token. */
  const appendNote = useCallback((body, { appId, fileName = null } = {}) => {
    if (!appId) return;
    const trimmed = typeof body === "string" ? body.trim() : "";
    const mention = getMentionToken(appId, fileName);
    const line = [trimmed, mention].filter(Boolean).join(" ");
    if (!line) return;
    setNotesText((prev) => (prev ? `${prev}\n\n${line}` : line));
  }, []);

  const presetNotesComposer = useCallback((appId, fileName = null) => {
    if (!appId) return;
    setNotesComposerPreset({ appId, fileName: fileName || null });
  }, []);

  const consumeNotesComposerPreset = useCallback(() => {
    let taken = null;
    setNotesComposerPreset((prev) => {
      taken = prev;
      return null;
    });
    return taken;
  }, []);

  const setWindowBounds = useCallback((id, bounds) => {
    if (typeof window === "undefined") return;
    setWindows((prev) =>
      prev.map((win) => {
        if (win.id !== id) return win;
        let { x, y, w, h } = bounds;
        const { w: dW, h: dH } = getDesktopContentRect();
        const px = MEDIA_MINIMIZE_INSET_X;
        if (win.appId === "media" && win.mediaVideoCollapsed) {
          const m = getMediaCompactWindowSize();
          w = m.w;
          h = m.h;
          const { inset: ins, minLayerY } = getDesktopWindowLayoutLimits();
          x = Math.max(ins, Math.min(x, dW - w - px));
          y = Math.max(minLayerY, Math.min(y, dH - h - ins));
        } else {
          const limits = getDesktopWindowLayoutLimits();
          const { minWinW, minWinH } = limits;
          const tb = scaleLayoutPx(OS_TITLEBAR_H, getLayoutUiScale());
          const ca = win.contentAspect;
          const rw =
            ca && ca.rw > 0 && ca.rh > 0 ? ca.rw : w;
          const rh =
            ca && ca.rw > 0 && ca.rh > 0 ? ca.rh : Math.max(1, h - tb);
          const o = clampAspectWindowBounds(
            x,
            y,
            w,
            h,
            rw,
            rh,
            tb,
            minWinW,
            minWinH,
            limits
          );
          x = o.x;
          y = o.y;
          w = o.w;
          h = o.h;
        }
        return { ...win, x, y, w, h, maximized: false };
      })
    );
  }, []);

  /**
   * Passt Fensterbreite/-höhe an Medien-Seitenverhältnis an (Inhalt = Clientfläche unter Titelleiste).
   * Ruft man typischerweise nach naturalWidth/naturalHeight bzw. videoWidth/videoHeight auf.
   */
  const fitWindowToContentSize = useCallback(
    (id, intrinsicW, intrinsicH, options) => {
    if (typeof window === "undefined") return;
    if (!intrinsicW || !intrinsicH || intrinsicW <= 0 || intrinsicH <= 0) return;

    const lockAspectForResize = options?.lockAspectForResize !== false;

    if (isMobileViewport()) {
      const fs = getDesktopLayerFullscreenRect();
      setWindows((prev) =>
        prev.map((win) => {
          if (win.id !== id) return win;
          return {
            ...win,
            ...fs,
            maximized: true,
            mobileImmersive: true,
            prevBounds: win.prevBounds ?? {
              x: win.x,
              y: win.y,
              w: win.w,
              h: win.h,
            },
            contentAspect: lockAspectForResize
              ? { rw: intrinsicW, rh: intrinsicH }
              : null,
          };
        })
      );
      return;
    }

    const limits = getDesktopWindowLayoutLimits();
    const { innerW, maxWinH, minWinW, minWinH, inset: insL } = limits;
    const tb = scaleLayoutPx(OS_TITLEBAR_H, getLayoutUiScale());
    const min120 = scaleLayoutPx(120, getLayoutUiScale());
    const maxCW = innerW;
    const maxCH = Math.max(min120, maxWinH - tb - insL);
    const minCW = minWinW;
    const minCH = Math.max(minWinH - tb, min120);

    let cw = intrinsicW;
    let ch = intrinsicH;

    let s0 = Math.min(1, maxCW / cw, maxCH / ch);
    cw *= s0;
    ch *= s0;

    let t = Math.max(1, minCW / cw, minCH / ch);
    cw *= t;
    ch *= t;

    let u = Math.min(1, maxCW / cw, maxCH / ch);
    cw *= u;
    ch *= u;

    cw = Math.max(minCW, Math.round(cw));
    ch = Math.max(minCH, Math.round(ch));

    const totalW = Math.max(minWinW, cw);
    const totalH = Math.max(minWinH, ch + tb);

    setWindows((prev) =>
      prev.map((win) => {
        if (win.id !== id) return win;
        const { desktopW, inset, maxBottomLayer, minLayerY } =
          getDesktopWindowLayoutLimits();
        let x = win.x + (win.w - totalW) / 2;
        let y = win.y + (win.h - totalH) / 2;
        x = Math.max(inset, Math.min(x, desktopW - totalW - inset));
        y = Math.max(minLayerY, Math.min(y, maxBottomLayer - totalH));
        return {
          ...win,
          x,
          y,
          w: totalW,
          h: totalH,
          maximized: false,
          prevBounds: null,
          /** Nur bei resizable + Medien: Seitenverhältnis fürs Ziehen an den Kanten */
          contentAspect: lockAspectForResize
            ? { rw: intrinsicW, rh: intrinsicH }
            : null,
        };
      })
    );
  },
  []
);

  const desktopWidgetStacksCollapsed = useMemo(
    () =>
      windows.some(
        (w) =>
          w.appId === "assetFile" &&
          w.assetFile?.widgetChrome &&
          !w.minimized
      ),
    [windows]
  );

  const value = useMemo(
    () => ({
      windows,
      openOrFocus,
      openAssetFileWindow,
      toggleAssetFileWindow,
      setAssetFileForWindow,
      closeWindow,
      closeTopVisibleWindow,
      closeAllTabs,
      focusWindow,
      minimizeWindow,
      toggleMediaPlayerVideoPanel,
      toggleMaximize,
      toggleAssetWidgetChromeFullscreen,
      moveWindow,
      setWindowBounds,
      fitWindowToContentSize,
      desktopIconPositions,
      setDesktopIconPosition,
      resetDesktopIconPositions,
      desktopWidgets,
      setDesktopWidgetPosition,
      setDesktopWidgetPositionsForIds,
      folderPreview,
      setFolderPreview,
      notesText,
      setNotesText,
      appendNote,
      presetNotesComposer,
      consumeNotesComposerPreset,
      notesComposerPreset,
      finderProjectAppId,
      finderTabAppIds,
      finderGoHome,
      finderOpenProject,
      finderOpenProjectFile,
      finderToggleProjectFile,
      finderSwitchTab,
      finderCloseTab,
      focusFinderWindow,
      finderClassicSearchExpanded,
      expandFinderClassicSearch,
      collapseFinderClassicSearch,
      finderProjectSearchStripExpanded,
      expandFinderProjectSearchStrip,
      collapseFinderProjectSearchStrip,
      finderTitlebarSearchSlotEl,
      setFinderTitlebarSearchSlotEl,
      /** Ein Widget-Look-Asset-Fenster (vom Finder) ist offen → Stapel animieren. */
      desktopWidgetStacksCollapsed,
      /** Fenster-Koordinaten beziehen sich auf den Desktop unter dem Header; min y ≈ 0 */
      menuBarHeight: 0,
      siteHeaderHeight: SITE_HEADER_H,
      dockHeight: 0,
      minWindowW: scaleLayoutPx(MIN_WIN_W, desktopUiScale),
      minWindowH: scaleLayoutPx(MIN_WIN_H, desktopUiScale),
      osTitlebarH: scaleLayoutPx(OS_TITLEBAR_H, desktopUiScale),
      desktopUiScale,
    }),
    [
      windows,
      desktopUiScale,
      openOrFocus,
      openAssetFileWindow,
      toggleAssetFileWindow,
      setAssetFileForWindow,
      closeWindow,
      closeTopVisibleWindow,
      closeAllTabs,
      focusWindow,
      minimizeWindow,
      toggleMediaPlayerVideoPanel,
      toggleMaximize,
      toggleAssetWidgetChromeFullscreen,
      moveWindow,
      setWindowBounds,
      fitWindowToContentSize,
      desktopIconPositions,
      setDesktopIconPosition,
      resetDesktopIconPositions,
      desktopWidgets,
      setDesktopWidgetPosition,
      setDesktopWidgetPositionsForIds,
      folderPreview,
      setFolderPreview,
      notesText,
      setNotesText,
      appendNote,
      presetNotesComposer,
      consumeNotesComposerPreset,
      notesComposerPreset,
      finderProjectAppId,
      finderTabAppIds,
      finderGoHome,
      finderOpenProject,
      finderOpenProjectFile,
      finderToggleProjectFile,
      finderSwitchTab,
      finderCloseTab,
      focusFinderWindow,
      finderClassicSearchExpanded,
      expandFinderClassicSearch,
      collapseFinderClassicSearch,
      finderProjectSearchStripExpanded,
      expandFinderProjectSearchStrip,
      collapseFinderProjectSearchStrip,
      finderTitlebarSearchSlotEl,
      setFinderTitlebarSearchSlotEl,
      desktopWidgetStacksCollapsed,
    ]
  );

  return (
    <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>
  );
}

export function useDesktop() {
  const ctx = useContext(DesktopContext);
  if (!ctx) throw new Error("useDesktop must be used within DesktopProvider");
  return ctx;
}
