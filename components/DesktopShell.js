"use client";

import { useEffect, useLayoutEffect } from "react";
import {
  DesktopProvider,
  isMobileViewport,
  useDesktop,
} from "@/context/DesktopContext";
import { DesktopIcons } from "@/components/DesktopIcons";
import { DesktopWidgets } from "@/components/DesktopWidgets";
import { MobileEdgeBackGesture } from "@/components/MobileEdgeBackGesture";
import { OSWindow } from "@/components/OSWindow";
import { SiteHeader } from "@/components/SiteHeader";

/** Mobile Safari: Abstand zwischen Layout- und Sichtfenster (Adress-/Toolleiste). */
function useSyncVisualViewportInsets() {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const sync = () => {
      const bottom = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      document.documentElement.style.setProperty(
        "--mm-vv-bottom-inset",
        `${bottom}px`
      );
      document.documentElement.style.setProperty(
        "--mm-vv-height",
        `${Math.round(vv.height)}px`
      );
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
}

function DesktopLayers() {
  const { windows } = useDesktop();

  /**
   * Nicht nach `z` sortieren: jedes `OSWindow` setzt `zIndex` selbst — die DOM-Reihenfolge
   * darf stabil bleiben, sonst verschiebt React die Knoten bei jedem Fokus-Wechsel und
   * Browser setzen Scroll in `overflow-auto`-Listen (Finder) oft auf 0 zurück.
   */
  return (
    <>
      <DesktopIcons />
      <DesktopWidgets />
      {windows.map((w) => (
        <OSWindow key={w.id} win={w} />
      ))}
    </>
  );
}

function DesktopShellInner() {
  const { closeTopVisibleWindow } = useDesktop();
  useSyncVisualViewportInsets();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (isMobileViewport()) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        if (t.closest("textarea")) return;
        if (t.isContentEditable) return;
      }
      e.preventDefault();
      closeTopVisibleWindow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeTopVisibleWindow]);

  return (
    <div
      className="flex min-h-0 w-full min-h-[100dvh] min-h-[100svh] flex-1 flex-col overflow-x-hidden md:min-h-[max(100dvh,800px)]"
      style={{
        backgroundColor: "var(--mm-desktop-bg)",
        color: "var(--mm-shell-text)",
      }}
    >
      <SiteHeader />
      {/* overflow-visible: Fenster dürfen mit negativem top in den Header bis zur Viewport-Kante */}
      <div
        data-mm-desktop-layer
        className="relative z-10 min-h-0 flex-1 overflow-visible"
      >
        <DesktopLayers />
        <MobileEdgeBackGesture />
      </div>
    </div>
  );
}

export function DesktopShell() {
  return (
    <DesktopProvider>
      <DesktopShellInner />
    </DesktopProvider>
  );
}
