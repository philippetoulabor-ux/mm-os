"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { APPS } from "@/lib/apps";

const MENU_BAR_H = 28;
const DOCK_H = 80;

const DesktopContext = createContext(null);

function centerWindow(size) {
  if (typeof window === "undefined") {
    return { x: 80, y: 120 };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const availH = vh - MENU_BAR_H - DOCK_H;
  return {
    x: Math.max(16, (vw - size.w) / 2),
    y: Math.max(MENU_BAR_H + 16, MENU_BAR_H + (availH - size.h) / 2),
  };
}

export function DesktopProvider({ children }) {
  const [windows, setWindows] = useState([]);
  const zCounter = useRef(20);

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
          y: MENU_BAR_H,
          w: window.innerWidth,
          h: window.innerHeight - MENU_BAR_H - DOCK_H,
        };
      })
    );
  }, []);

  const moveWindow = useCallback((id, x, y) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y, maximized: false } : w))
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
      menuBarHeight: MENU_BAR_H,
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
