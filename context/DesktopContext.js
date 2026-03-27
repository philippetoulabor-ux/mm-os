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

/** Höhe des Site-Headers (kompaktes Logo + Padding); Näherung für Fenster-Layout */
const SITE_HEADER_H = 180;
const DOCK_H = 80;

const DesktopContext = createContext(null);

const DARK_MODE_STORAGE_KEY = "mm-os-dark";
const DESKTOP_ICONS_POS_KEY = "mm-os-desktop-icons";

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

export function DesktopProvider({ children }) {
  const [windows, setWindows] = useState([]);
  const [darkMode, setDarkModeState] = useState(false);
  const [desktopIconPositions, setDesktopIconPositions] = useState(() =>
    getDefaultDesktopIconPositions()
  );
  const skipDesktopIconPersist = useRef(true);
  const zCounter = useRef(20);

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
      const pos = centerWindow(def.defaultSize);
      const id = `${appId}-${Date.now()}`;
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

  const closeWindow = useCallback((id) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
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

  const MIN_WIN_W = 240;
  const MIN_WIN_H = 160;

  /** Vollständiges Fenster-Rechteck; nötig für Resize an linker/obere Kante */
  const setWindowBounds = useCallback((id, bounds) => {
    if (typeof window === "undefined") return;
    setWindows((prev) =>
      prev.map((win) => {
        if (win.id !== id) return win;
        let { x, y, w, h } = bounds;
        w = Math.max(MIN_WIN_W, w);
        h = Math.max(MIN_WIN_H, h);
        const vw = window.innerWidth;
        const maxBottom = window.innerHeight - DOCK_H;
        x = Math.max(0, Math.min(x, vw - w));
        y = Math.max(-SITE_HEADER_H, Math.min(y, maxBottom - h));
        return { ...win, x, y, w, h, maximized: false };
      })
    );
  }, []);

  const value = useMemo(
    () => ({
      windows,
      openOrFocus,
      closeWindow,
      focusWindow,
      minimizeWindow,
      toggleMaximize,
      moveWindow,
      setWindowBounds,
      desktopIconPositions,
      setDesktopIconPosition,
      resetDesktopIconPositions,
      darkMode,
      setDarkMode,
      /** Fenster-Koordinaten beziehen sich auf den Desktop unter dem Header; min y ≈ 0 */
      menuBarHeight: 0,
      siteHeaderHeight: SITE_HEADER_H,
      dockHeight: DOCK_H,
    }),
    [
      windows,
      openOrFocus,
      closeWindow,
      focusWindow,
      minimizeWindow,
      toggleMaximize,
      moveWindow,
      setWindowBounds,
      desktopIconPositions,
      setDesktopIconPosition,
      resetDesktopIconPositions,
      darkMode,
      setDarkMode,
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
