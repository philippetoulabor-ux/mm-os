"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  DesktopProvider,
  isMobileViewport,
  syncDesktopLayerMetrics,
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
  const sorted = [...windows].sort((a, b) => a.z - b.z);

  return (
    <>
      <DesktopIcons />
      <DesktopWidgets />
      {sorted.map((w) => (
        <OSWindow key={w.id} win={w} />
      ))}
    </>
  );
}

function DesktopShellInner() {
  const layerRef = useRef(null);
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

  useLayoutEffect(() => {
    const el = layerRef.current;
    if (!el) return undefined;
    const run = () => syncDesktopLayerMetrics(el);
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    window.addEventListener("resize", run);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", run);
    };
  }, []);

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
        ref={layerRef}
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
