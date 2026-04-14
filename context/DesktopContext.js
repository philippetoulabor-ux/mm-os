"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APPS, getDefaultDesktopIconPositions } from "@/lib/apps";
import {
  migrateDesktopIconPositions,
  migrateNotesText,
  migrateWindowState,
} from "@/lib/webAssetIds";
import { getMentionToken } from "@/lib/noteRefs";

/** Höhe des Site-Headers (kompaktes Logo + Padding); Näherung für Fenster-Layout */
const SITE_HEADER_H = 270;
/** OSWindow Titelleiste (entspricht Tailwind h-10; gleicher Inset zum Schließen-Button h-8) */
const OS_TITLEBAR_H = 60;
const MIN_WIN_W = 360;
const MIN_WIN_H = 240;
/** Inhaltshöhe (ohne OS-Titelleiste), wenn der Media-Player nur Titelzeile + Transport hat (Video ausgeblendet). */
const MEDIA_COMPACT_CLIENT_H = 180;
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

export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH_PX;
}

/**
 * Mini-Dock unten links visuell abblenden, wenn ein Fenster die untere Dock-Zone überlappt
 * (gleiche Logik wie früheres zentriertes Dock: Streifen an der Layer-Unterkante).
 */
export function windowShouldDimDock(win, desktopW, desktopH) {
  if (win.minimized) return false;
  const DOCK_DIM_ZONE_PX = 102;
  const dockTop = desktopH - DOCK_DIM_ZONE_PX;
  const bottom = win.y + win.h;
  if (bottom <= dockTop) return false;
  if (win.y >= desktopH) return false;
  const hx1 = Math.max(0, win.x);
  const hx2 = Math.min(desktopW, win.x + win.w);
  return hx2 > hx1;
}

/**
 * Grenzen im Koordinatensystem von OSWindow (relativ zu `[data-mm-desktop-layer]`).
 * Nutzt gemessene Layer-Größe statt `innerHeight - SITE_HEADER`, damit Resize nicht künstlich kleiner bleibt.
 */
export function getDesktopWindowLayoutLimits() {
  const inset = WINDOW_DESKTOP_INSET;
  if (typeof window === "undefined") {
    const desktopH = 900;
    const layerTop = SITE_HEADER_H;
    const minLayerY = inset - layerTop;
    const maxBottomLayer = desktopH - inset;
    const maxWinH = Math.max(MIN_WIN_H, maxBottomLayer - minLayerY);
    return {
      desktopW: 1920,
      desktopH,
      inset,
      minLayerY,
      innerW: Math.max(MIN_WIN_W, 1920 - 2 * inset),
      maxWinH,
      maxBottomLayer,
    };
  }
  const { w: desktopW, h: desktopH, layerTop } = getDesktopContentRect();
  /** Viewport-Oberkante + inset ≙ Layer-Koordinate: Fenster nicht an Header-Linie blockieren. */
  const minLayerY = inset - layerTop;
  const maxBottomLayer = desktopH - inset;
  const maxWinH = Math.max(MIN_WIN_H, maxBottomLayer - minLayerY);
  return {
    desktopW,
    desktopH,
    inset,
    minLayerY,
    innerW: Math.max(MIN_WIN_W, desktopW - 2 * inset),
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
 * Vollblick-Rect im Layer-Koordinatensystem: Oberkante bündig mit dem Viewport (Screen-Oberkante),
 * Unterkante bündig mit dem unteren Rand des Desktop-Layers.
 * Früher: y = minLayerY = inset − layerTop ließ oben {@link WINDOW_DESKTOP_INSET} frei — hier y = −layerTop.
 */
export function getDesktopLayerFullscreenRect() {
  if (typeof window === "undefined") {
    const desktopH = 900;
    const layerTop = SITE_HEADER_H;
    const desktopW = 1920;
    return {
      x: 0,
      y: -layerTop,
      w: desktopW,
      h: Math.max(MIN_WIN_H, layerTop + desktopH),
    };
  }
  const { w: desktopW, h: desktopH, layerTop } = getDesktopContentRect();
  const vh = getVisualViewportHeight();
  const hFromLayer = layerTop + desktopH;
  return {
    x: 0,
    y: -layerTop,
    w: desktopW,
    h: Math.max(MIN_WIN_H, hFromLayer, vh),
  };
}

/**
 * Gemessene Größe des `relative`-Desktop-Layers (Fenster-Positionierungs-Container).
 * Wird von DesktopShell per ResizeObserver gesetzt — gleiche Basis für x und y wie in CSS.
 */
const desktopLayerMetrics = { w: 0, h: 0, top: SITE_HEADER_H };

/** @param {HTMLElement | null} el Desktop-Layer unter dem Site-Header */
export function syncDesktopLayerMetrics(el) {
  if (!el || typeof window === "undefined") return;
  const r = el.getBoundingClientRect();
  desktopLayerMetrics.w = r.width;
  desktopLayerMetrics.h = r.height;
  desktopLayerMetrics.top = r.top;
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
    desktopLayerMetrics.w = r.width;
    desktopLayerMetrics.h = r.height;
    desktopLayerMetrics.top = r.top;
    return { w: r.width, h: r.height, layerTop: r.top };
  }
  if (desktopLayerMetrics.w > 0 && desktopLayerMetrics.h > 0) {
    return {
      w: desktopLayerMetrics.w,
      h: desktopLayerMetrics.h,
      layerTop: desktopLayerMetrics.top,
    };
  }
  const w = document.documentElement?.clientWidth ?? window.innerWidth;
  const h = window.innerHeight - SITE_HEADER_H;
  return { w, h, layerTop: SITE_HEADER_H };
}

/** Unten rechts: Rand des gemessenen Layers; gleicher Inset X/Y. */
function getMediaMinimizedPosition() {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const px = MEDIA_MINIMIZE_INSET_X;
  const { w: dw, h: dh } = getDesktopContentRect();
  const ins = WINDOW_DESKTOP_INSET;
  const { minLayerY } = getDesktopWindowLayoutLimits();
  return {
    x: Math.max(ins, dw - MEDIA_COMPACT_W - px),
    y: Math.max(minLayerY, dh - MEDIA_COMPACT_TOTAL_H - ins),
  };
}

const DesktopContext = createContext(null);

const DARK_MODE_STORAGE_KEY = "mm-os-dark";
const FOLDER_PREVIEW_STORAGE_KEY = "mm-os-folder-preview";
const DESKTOP_ICONS_POS_KEY = "mm-os-desktop-icons";
/** Einmalig: gespeicherte `webasset_*`-Koordinaten verwerfen, damit das Raster aus lib/apps.js greift. */
const DESKTOP_FOLDER_GRID_VERSION = 3;
const DESKTOP_FOLDER_GRID_KEY = "mm-os-desktop-folder-grid-v";
const NOTES_TEXT_KEY = "mm-os-notes-text";
const WINDOWS_STATE_KEY = "mm-os-windows-v1";

const WINDOWS_PERSIST_DEBOUNCE_MS = 400;

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

function loadDesktopIconPositions() {
  const defaults = getDefaultDesktopIconPositions();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(DESKTOP_ICONS_POS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    let migrated = migrateDesktopIconPositions(parsed);
    if (JSON.stringify(migrated) !== JSON.stringify(parsed)) {
      try {
        localStorage.setItem(DESKTOP_ICONS_POS_KEY, JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
    }
    const gridVer = Number(localStorage.getItem(DESKTOP_FOLDER_GRID_KEY)) || 0;
    if (gridVer < DESKTOP_FOLDER_GRID_VERSION) {
      for (const key of Object.keys(migrated)) {
        if (key.startsWith("webasset_")) delete migrated[key];
      }
      try {
        localStorage.setItem(
          DESKTOP_FOLDER_GRID_KEY,
          String(DESKTOP_FOLDER_GRID_VERSION)
        );
        localStorage.setItem(DESKTOP_ICONS_POS_KEY, JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
    }
    return { ...defaults, ...migrated };
  } catch {
    return defaults;
  }
}

function num(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}

/** Ein gespeichertes Fenster nur übernehmen, wenn App und Pflichtfelder gültig sind. */
function sanitizeWindow(w) {
  if (!w || typeof w !== "object") return null;
  const appId = w.appId;
  if (typeof appId !== "string" || !APPS[appId]) return null;
  const id = typeof w.id === "string" && w.id.length > 0 ? w.id : null;
  if (!id) return null;

  let assetFile = null;
  if (appId === "assetFile" && w.assetFile && typeof w.assetFile === "object") {
    const dir = w.assetFile.dir;
    const file = w.assetFile.file;
    if (typeof dir === "string" && dir && typeof file === "string" && file) {
      assetFile = {
        dir,
        file,
        basePath:
          typeof w.assetFile.basePath === "string" && w.assetFile.basePath
            ? w.assetFile.basePath
            : "/web",
      };
    } else {
      return null;
    }
  }

  let prevBounds = null;
  if (w.prevBounds && typeof w.prevBounds === "object") {
    const pb = w.prevBounds;
    prevBounds = {
      x: num(pb.x, 0),
      y: num(pb.y, 0),
      w: num(pb.w, 360),
      h: num(pb.h, 240),
    };
  }

  let contentAspect = null;
  if (w.contentAspect && typeof w.contentAspect === "object") {
    const ca = w.contentAspect;
    const rw = num(ca.rw, 0);
    const rh = num(ca.rh, 0);
    if (rw > 0 && rh > 0) contentAspect = { rw, rh };
  }

  const base = {
    id,
    appId,
    title: typeof w.title === "string" ? w.title : APPS[appId].title,
    x: num(w.x, 0),
    y: num(w.y, 0),
    w: num(w.w, APPS[appId].defaultSize.w),
    h: num(w.h, APPS[appId].defaultSize.h),
    z: Math.max(0, Math.floor(num(w.z, 0))),
    minimized: bool(w.minimized, false),
    maximized: bool(w.maximized, false),
    prevBounds,
    mobileImmersive: bool(w.mobileImmersive, false),
    contentAspect,
    ...(assetFile ? { assetFile } : {}),
  };
  if (appId === "media") {
    return {
      ...base,
      mediaVideoCollapsed: bool(w.mediaVideoCollapsed, false),
    };
  }
  return base;
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
  } = getDesktopWindowLayoutLimits();
  const px = MEDIA_MINIMIZE_INSET_X;

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

  return list.map((win) => {
    if (win.maximized) {
      return {
        ...win,
        ...getDesktopLayerFullscreenRect(),
      };
    }
    let { x, y, w, h } = win;
    if (win.appId === "media" && win.mediaVideoCollapsed) {
      w = MEDIA_COMPACT_W;
      h = MEDIA_COMPACT_TOTAL_H;
      x = Math.max(inset, Math.min(x, desktopW - w - px));
      y = Math.max(minLayerY, Math.min(y, desktopH - h - inset));
    } else {
      w = Math.max(MIN_WIN_W, Math.min(w, innerW));
      h = Math.max(MIN_WIN_H, Math.min(h, maxWinH));
      x = Math.max(inset, Math.min(x, desktopW - w - inset));
      y = Math.max(minLayerY, Math.min(y, maxBottomLayer - h));
    }
    return { ...win, x, y, w, h };
  });
}

function loadWindowsFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WINDOWS_STATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const migrated = parsed.map(migrateWindowState);
    const changed = migrated.some(
      (w, i) => JSON.stringify(w) !== JSON.stringify(parsed[i])
    );
    if (changed) {
      try {
        localStorage.setItem(WINDOWS_STATE_KEY, JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
    }
    const out = [];
    for (const item of migrated) {
      const s = sanitizeWindow(item);
      if (s) out.push(s);
    }
    return clampWindowsToViewport(out);
  } catch {
    return [];
  }
}

export function DesktopProvider({ children }) {
  const [windows, setWindows] = useState([]);
  const [darkMode, setDarkModeState] = useState(false);
  const [folderPreview, setFolderPreviewState] = useState(true);
  const [desktopIconPositions, setDesktopIconPositions] = useState(() =>
    getDefaultDesktopIconPositions()
  );
  const skipDesktopIconPersist = useRef(true);
  const skipWindowsPersist = useRef(true);
  const windowsPersistTimerRef = useRef(null);
  const skipNotesPersist = useRef(true);
  const zCounter = useRef(20);
  /** Ein Notiz-Dokument (Absätze durch \\n\\n); ältere Absätze werden in der UI durchgestrichen. */
  const [notesText, setNotesText] = useState("");
  /** Einmaliges Vorausfüllen der Notes-App (z. B. aus Finder „Notiz zu Ordner“). */
  const [notesComposerPreset, setNotesComposerPreset] = useState(null);
  /** Bounds vor Media-„Minimieren“ (nur Video ausblenden), pro Fenster-ID */
  const mediaPreCollapseBoundsRef = useRef(new Map());

  useEffect(() => {
    try {
      if (localStorage.getItem(DARK_MODE_STORAGE_KEY) === "1") {
        setDarkModeState(true);
      }
      if (localStorage.getItem(FOLDER_PREVIEW_STORAGE_KEY) === "0") {
        setFolderPreviewState(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    setDesktopIconPositions(loadDesktopIconPositions());
  }, []);

  useEffect(() => {
    const loaded = loadWindowsFromStorage();
    if (loaded.length > 0) {
      const maxZ = Math.max(20, ...loaded.map((w) => w.z ?? 0));
      zCounter.current = maxZ;
      setWindows(loaded);
    }
  }, []);

  /** Viewport / Layer: Fenster begrenzen; Mobile = fullscreen, Desktop inkl. minimierter Media-Position. */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => {
      setWindows((prev) => clampWindowsToViewport(prev));
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (skipWindowsPersist.current) {
      skipWindowsPersist.current = false;
      return;
    }
    if (windowsPersistTimerRef.current) {
      clearTimeout(windowsPersistTimerRef.current);
    }
    windowsPersistTimerRef.current = setTimeout(() => {
      windowsPersistTimerRef.current = null;
      try {
        localStorage.setItem(WINDOWS_STATE_KEY, JSON.stringify(windows));
      } catch {
        /* ignore */
      }
    }, WINDOWS_PERSIST_DEBOUNCE_MS);
    return () => {
      if (windowsPersistTimerRef.current) {
        clearTimeout(windowsPersistTimerRef.current);
        windowsPersistTimerRef.current = null;
      }
    };
  }, [windows]);

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

  useEffect(() => {
    if (skipDesktopIconPersist.current) {
      skipDesktopIconPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(
        DESKTOP_ICONS_POS_KEY,
        JSON.stringify(desktopIconPositions)
      );
    } catch {
      /* ignore */
    }
  }, [desktopIconPositions]);

  const setDesktopIconPosition = useCallback((appId, x, y) => {
    setDesktopIconPositions((prev) => ({ ...prev, [appId]: { x, y } }));
  }, []);

  const resetDesktopIconPositions = useCallback(() => {
    setDesktopIconPositions(getDefaultDesktopIconPositions());
  }, []);

  const setDarkMode = useCallback((value) => {
    setDarkModeState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        localStorage.setItem(DARK_MODE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
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

  const openOrFocus = useCallback((appId) => {
    const def = APPS[appId];
    if (!def) return;

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
        const pos = getMediaMinimizedPosition();
        return [
          ...prev,
          {
            id,
            appId,
            title: def.title,
            x: pos.x,
            y: pos.y,
            w: MEDIA_COMPACT_W,
            h: MEDIA_COMPACT_TOTAL_H,
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
      const pos = centerWindow(def.defaultSize);
      return [
        ...prev,
        {
          id,
          appId,
          title: def.title,
          x: pos.x,
          y: pos.y,
          w: def.defaultSize.w,
          h: def.defaultSize.h,
          z: zCounter.current,
          minimized: false,
          maximized: false,
          prevBounds: null,
          mobileImmersive: false,
        },
      ];
    });
  }, []);

  /** Datei aus einem Asset-Ordner: höchstens ein Fenster pro Pfad; bestehendes nach vorne. */
  const openAssetFileWindow = useCallback(({ dir, file, basePath = "/web" }) => {
    const def = APPS.assetFile;
    if (!def || !dir || !file) return;

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
      const pos = centerWindow(def.defaultSize);
      return [
        ...prev,
        {
          id,
          appId: def.id,
          title: file,
          x: pos.x,
          y: pos.y,
          w: def.defaultSize.w,
          h: def.defaultSize.h,
          z: zCounter.current,
          minimized: false,
          maximized: false,
          prevBounds: null,
          mobileImmersive: false,
          assetFile: { dir, file, basePath },
        },
      ];
    });
  }, []);

  /** Leertaste im Finder/Baum: Fenster zur Datei öffnen oder schließen. */
  const toggleAssetFileWindow = useCallback(
    ({ dir, file, basePath = "/web" }) => {
      const def = APPS.assetFile;
      if (!def || !dir || !file) return;

      const key = assetFileDedupeKey({ dir, file, basePath });

      setWindows((prev) => {
        const existing = findAssetFileWindow(prev, key);
        if (existing) {
          return prev.filter((w) => w.id !== existing.id);
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
        const pos = centerWindow(def.defaultSize);
        return [
          ...prev,
          {
            id,
            appId: def.id,
            title: file,
            x: pos.x,
            y: pos.y,
            w: def.defaultSize.w,
            h: def.defaultSize.h,
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

  /** Gleiches Asset-Fenster: andere Datei im selben Ordner (Pfeiltasten-Navigation). */
  const setAssetFileForWindow = useCallback((windowId, { dir, file, basePath = "/web" }) => {
    if (!windowId || !dir || !file) return;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId && w.appId === "assetFile"
          ? { ...w, title: file, assetFile: { dir, file, basePath } }
          : w
      )
    );
  }, []);

  const closeWindow = useCallback((id) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  /** Oberstes nicht minimiertes Fenster schließen (Desktop-Tastatur / Dock). */
  const closeTopVisibleWindow = useCallback(() => {
    setWindows((prev) => {
      const visible = prev.filter((w) => !w.minimized);
      if (visible.length === 0) return prev;
      const top = visible.reduce((a, b) => (a.z >= b.z ? a : b));
      return prev.filter((w) => w.id !== top.id);
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setWindows([]);
  }, []);

  const focusWindow = useCallback((id) => {
    zCounter.current += 1;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, z: zCounter.current, minimized: false } : w
      )
    );
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
          const pos = getMediaMinimizedPosition();
          return {
            ...w,
            mediaVideoCollapsed: true,
            w: MEDIA_COMPACT_W,
            h: MEDIA_COMPACT_TOTAL_H,
            x: pos.x,
            y: pos.y,
          };
        }
        const saved = mediaPreCollapseBoundsRef.current.get(id);
        const fallback = APPS.media.defaultSize;
        const rw =
          saved && typeof saved.w === "number" && Number.isFinite(saved.w)
            ? Math.max(MIN_WIN_W, saved.w)
            : fallback.w;
        const rh =
          saved && typeof saved.h === "number" && Number.isFinite(saved.h)
            ? Math.max(MIN_WIN_H, saved.h)
            : fallback.h;
        // Untere rechte Ecke des kompakten Fensters beibehalten → Größe wächst nach links oben.
        let rx = w.x + w.w - rw;
        let ry = w.y + w.h - rh;
        if (typeof window !== "undefined") {
          const { desktopW, inset, maxBottomLayer, minLayerY } =
            getDesktopWindowLayoutLimits();
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
          w = MEDIA_COMPACT_W;
          h = MEDIA_COMPACT_TOTAL_H;
          const ins = WINDOW_DESKTOP_INSET;
          const { minLayerY } = getDesktopWindowLayoutLimits();
          x = Math.max(ins, Math.min(x, dW - w - px));
          y = Math.max(minLayerY, Math.min(y, dH - h - ins));
        } else {
          const {
            desktopW,
            inset,
            innerW,
            maxWinH,
            maxBottomLayer,
            minLayerY,
          } = getDesktopWindowLayoutLimits();
          w = Math.max(MIN_WIN_W, Math.min(w, innerW));
          h = Math.max(MIN_WIN_H, Math.min(h, maxWinH));
          x = Math.max(inset, Math.min(x, desktopW - w - inset));
          y = Math.max(minLayerY, Math.min(y, maxBottomLayer - h));
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

    const ins = WINDOW_DESKTOP_INSET;
    const { innerW, maxWinH } = getDesktopWindowLayoutLimits();
    const maxCW = innerW;
    const maxCH = Math.max(120, maxWinH - OS_TITLEBAR_H - ins);
    const minCW = MIN_WIN_W;
    const minCH = Math.max(MIN_WIN_H - OS_TITLEBAR_H, 120);

    let cw = intrinsicW;
    let ch = intrinsicH;

    let s = Math.min(1, maxCW / cw, maxCH / ch);
    cw *= s;
    ch *= s;

    let t = Math.max(1, minCW / cw, minCH / ch);
    cw *= t;
    ch *= t;

    let u = Math.min(1, maxCW / cw, maxCH / ch);
    cw *= u;
    ch *= u;

    cw = Math.max(minCW, Math.round(cw));
    ch = Math.max(minCH, Math.round(ch));

    const totalW = Math.max(MIN_WIN_W, cw);
    const totalH = Math.max(MIN_WIN_H, ch + OS_TITLEBAR_H);

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
      moveWindow,
      setWindowBounds,
      fitWindowToContentSize,
      desktopIconPositions,
      setDesktopIconPosition,
      resetDesktopIconPositions,
      darkMode,
      setDarkMode,
      folderPreview,
      setFolderPreview,
      notesText,
      setNotesText,
      appendNote,
      presetNotesComposer,
      consumeNotesComposerPreset,
      notesComposerPreset,
      /** Fenster-Koordinaten beziehen sich auf den Desktop unter dem Header; min y ≈ 0 */
      menuBarHeight: 0,
      siteHeaderHeight: SITE_HEADER_H,
      dockHeight: 0,
      minWindowW: MIN_WIN_W,
      minWindowH: MIN_WIN_H,
      osTitlebarH: OS_TITLEBAR_H,
    }),
    [
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
      moveWindow,
      setWindowBounds,
      fitWindowToContentSize,
      desktopIconPositions,
      setDesktopIconPosition,
      resetDesktopIconPositions,
      darkMode,
      setDarkMode,
      folderPreview,
      setFolderPreview,
      notesText,
      setNotesText,
      appendNote,
      presetNotesComposer,
      consumeNotesComposerPreset,
      notesComposerPreset,
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
