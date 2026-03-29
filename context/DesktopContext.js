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
import { getMentionToken } from "@/lib/noteRefs";

/** Höhe des Site-Headers (kompaktes Logo + Padding); Näherung für Fenster-Layout */
const SITE_HEADER_H = 180;
const DOCK_H = 80;
/** OSWindow Titelleiste (entspricht Tailwind h-10; gleicher Inset zum Schließen-Button h-8) */
const OS_TITLEBAR_H = 40;
const MIN_WIN_W = 240;
const MIN_WIN_H = 160;
/** Inhaltshöhe (ohne OS-Titelleiste), wenn der Media-Player nur Titelzeile + Transport hat (Video ausgeblendet). */
const MEDIA_COMPACT_CLIENT_H = 120;
/** Feste Breite im minimierten Media-Player (kleinstes Fenster). */
const MEDIA_COMPACT_W = MIN_WIN_W;
const MEDIA_COMPACT_TOTAL_H = OS_TITLEBAR_H + MEDIA_COMPACT_CLIENT_H;
/** Gleicher Abstand zum rechten und unteren Rand des Desktop-Layers (wie Dock `bottom-3`). */
export const MEDIA_MINIMIZE_INSET = 12;
export const MEDIA_MINIMIZE_INSET_X = MEDIA_MINIMIZE_INSET;
export const MEDIA_MINIMIZE_INSET_Y = MEDIA_MINIMIZE_INSET;

/**
 * Gemessene Größe des `relative`-Desktop-Layers (Fenster-Positionierungs-Container).
 * Wird von DesktopShell per ResizeObserver gesetzt — gleiche Basis für x und y wie in CSS.
 */
const desktopLayerMetrics = { w: 0, h: 0 };

/** @param {HTMLElement | null} el Desktop-Layer unter dem Site-Header */
export function syncDesktopLayerMetrics(el) {
  if (!el || typeof window === "undefined") return;
  const r = el.getBoundingClientRect();
  desktopLayerMetrics.w = r.width;
  desktopLayerMetrics.h = r.height;
}

/**
 * Größe des Desktop-Inhalts (Koordinatensystem von OSWindow: 0,0 = oben links im Layer).
 * Bevorzugt Live-Messung von `[data-mm-desktop-layer]` (identisch mit Positionierungs-Container).
 */
export function getDesktopContentRect() {
  if (typeof window === "undefined") return { w: 1920, h: 900 };
  const el = document.querySelector("[data-mm-desktop-layer]");
  if (el) {
    const r = el.getBoundingClientRect();
    desktopLayerMetrics.w = r.width;
    desktopLayerMetrics.h = r.height;
    return { w: r.width, h: r.height };
  }
  if (desktopLayerMetrics.w > 0 && desktopLayerMetrics.h > 0) {
    return { w: desktopLayerMetrics.w, h: desktopLayerMetrics.h };
  }
  const w = document.documentElement?.clientWidth ?? window.innerWidth;
  const h = window.innerHeight - SITE_HEADER_H;
  return { w, h };
}

/** Unten rechts: Rand des gemessenen Layers; gleicher Inset X/Y. */
function getMediaMinimizedPosition() {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const px = MEDIA_MINIMIZE_INSET_X;
  const py = MEDIA_MINIMIZE_INSET_Y;
  const { w: dw, h: dh } = getDesktopContentRect();
  return {
    x: Math.max(0, dw - MEDIA_COMPACT_W - px),
    y: Math.max(-SITE_HEADER_H, dh - MEDIA_COMPACT_TOTAL_H - py),
  };
}

const DesktopContext = createContext(null);

const DARK_MODE_STORAGE_KEY = "mm-os-dark";
const DESKTOP_ICONS_POS_KEY = "mm-os-desktop-icons";
const NOTES_TEXT_KEY = "mm-os-notes-text";
const WINDOWS_STATE_KEY = "mm-os-windows-v1";

const WINDOWS_PERSIST_DEBOUNCE_MS = 400;

function centerWindow(size) {
  if (typeof window === "undefined") {
    return { x: 80, y: 120 };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const availH = vh - SITE_HEADER_H - DOCK_H;
  return {
    x: Math.max(16, (vw - size.w) / 2),
    y: Math.max(16, (availH - size.h) / 2),
  };
}

function loadDesktopIconPositions() {
  const defaults = getDefaultDesktopIconPositions();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(DESKTOP_ICONS_POS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    return { ...defaults, ...parsed };
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
      w: num(pb.w, 240),
      h: num(pb.h, 160),
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
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { w: desktopW, h: desktopH } = getDesktopContentRect();
  const maxBottom = vh - DOCK_H;
  const maxH = vh - SITE_HEADER_H - DOCK_H;
  const px = MEDIA_MINIMIZE_INSET_X;
  const py = MEDIA_MINIMIZE_INSET_Y;
  return windows.map((win) => {
    if (win.maximized) {
      return {
        ...win,
        x: 0,
        y: 0,
        w: vw,
        h: maxH,
      };
    }
    let { x, y, w, h } = win;
    if (win.appId === "media" && win.mediaVideoCollapsed) {
      w = MEDIA_COMPACT_W;
      h = MEDIA_COMPACT_TOTAL_H;
      x = Math.max(0, Math.min(x, desktopW - w - px));
      y = Math.max(-SITE_HEADER_H, Math.min(y, desktopH - h - py));
    } else {
      w = Math.max(MIN_WIN_W, w);
      h = Math.max(MIN_WIN_H, h);
      x = Math.max(0, Math.min(x, vw - w));
      y = Math.max(-SITE_HEADER_H, Math.min(y, maxBottom - h));
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
    const out = [];
    for (const item of parsed) {
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

  /** Minimierten Media-Player unten rechts halten (Dock-Inset wie `bottom-3`). */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.appId !== "media" || !w.mediaVideoCollapsed) return w;
          const pos = getMediaMinimizedPosition();
          return {
            ...w,
            x: pos.x,
            y: pos.y,
            w: MEDIA_COMPACT_W,
            h: MEDIA_COMPACT_TOTAL_H,
          };
        })
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
      if (raw !== null) setNotesText(raw);
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
            mediaVideoCollapsed: true,
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
        },
      ];
    });
  }, []);

  /** Datei aus einem Asset-Ordner: immer ein neues Fenster (kein Fokus auf bestehendes). */
  const openAssetFileWindow = useCallback(
    ({ dir, file, basePath = "/web" }) => {
      const def = APPS.assetFile;
      if (!def || !dir || !file) return;

      setWindows((prev) => {
        zCounter.current += 1;
        const pos = centerWindow(def.defaultSize);
        const id = `assetFile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
            assetFile: { dir, file, basePath },
          },
        ];
      });
    },
    []
  );

  const closeWindow = useCallback((id) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
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
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const maxBottom = vh - DOCK_H;
          rx = Math.max(0, Math.min(rx, vw - rw));
          ry = Math.max(-SITE_HEADER_H, Math.min(ry, maxBottom - rh));
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
        return {
          ...w,
          maximized: true,
          prevBounds: pb,
          x: 0,
          y: 0,
          w: window.innerWidth,
          h: window.innerHeight - SITE_HEADER_H - DOCK_H,
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
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const { w: dW, h: dH } = getDesktopContentRect();
        const px = MEDIA_MINIMIZE_INSET_X;
        const py = MEDIA_MINIMIZE_INSET_Y;
        const maxBottom = vh - DOCK_H;
        if (win.appId === "media" && win.mediaVideoCollapsed) {
          w = MEDIA_COMPACT_W;
          h = MEDIA_COMPACT_TOTAL_H;
          x = Math.max(0, Math.min(x, dW - w - px));
          y = Math.max(-SITE_HEADER_H, Math.min(y, dH - h - py));
        } else {
          w = Math.max(MIN_WIN_W, w);
          h = Math.max(MIN_WIN_H, h);
          x = Math.max(0, Math.min(x, vw - w));
          y = Math.max(-SITE_HEADER_H, Math.min(y, maxBottom - h));
        }
        return { ...win, x, y, w, h, maximized: false };
      })
    );
  }, []);

  /**
   * Passt Fensterbreite/-höhe an Medien-Seitenverhältnis an (Inhalt = Clientfläche unter Titelleiste).
   * Ruft man typischerweise nach naturalWidth/naturalHeight bzw. videoWidth/videoHeight auf.
   */
  const fitWindowToContentSize = useCallback((id, intrinsicW, intrinsicH) => {
    if (typeof window === "undefined") return;
    if (!intrinsicW || !intrinsicH || intrinsicW <= 0 || intrinsicH <= 0) return;

    const pad = 24;
    const maxCW = window.innerWidth - pad * 2;
    const maxCH =
      window.innerHeight -
      SITE_HEADER_H -
      DOCK_H -
      pad * 2 -
      OS_TITLEBAR_H;
    const minCW = MIN_WIN_W;
    const minCH = Math.max(MIN_WIN_H - OS_TITLEBAR_H, 80);

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
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x = win.x + (win.w - totalW) / 2;
        let y = win.y + (win.h - totalH) / 2;
        x = Math.max(0, Math.min(x, vw - totalW));
        const maxBottom = vh - DOCK_H;
        y = Math.max(-SITE_HEADER_H, Math.min(y, maxBottom - totalH));
        return {
          ...win,
          x,
          y,
          w: totalW,
          h: totalH,
          maximized: false,
          prevBounds: null,
          /** Inhaltsfläche (ohne Titelleiste): rw×rh = Seitenverhältnis für Resize-Lock */
          contentAspect: { rw: intrinsicW, rh: intrinsicH },
        };
      })
    );
  }, []);

  const value = useMemo(
    () => ({
      windows,
      openOrFocus,
      openAssetFileWindow,
      closeWindow,
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
      notesText,
      setNotesText,
      appendNote,
      presetNotesComposer,
      consumeNotesComposerPreset,
      notesComposerPreset,
      /** Fenster-Koordinaten beziehen sich auf den Desktop unter dem Header; min y ≈ 0 */
      menuBarHeight: 0,
      siteHeaderHeight: SITE_HEADER_H,
      dockHeight: DOCK_H,
      minWindowW: MIN_WIN_W,
      minWindowH: MIN_WIN_H,
      osTitlebarH: OS_TITLEBAR_H,
    }),
    [
      windows,
      openOrFocus,
      openAssetFileWindow,
      closeWindow,
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
