"use client";

import { useLayoutEffect, useRef } from "react";
import {
  DesktopProvider,
  syncDesktopLayerMetrics,
  useDesktop,
} from "@/context/DesktopContext";

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
import { DesktopIcons } from "@/components/DesktopIcons";
import { OSWindow } from "@/components/OSWindow";
import { SiteHeader } from "@/components/SiteHeader";
function DesktopLayers() {
  const { windows } = useDesktop();
  const sorted = [...windows].sort((a, b) => a.z - b.z);

  return (
    <>
      <DesktopIcons />
      {sorted.map((w) => (
        <OSWindow key={w.id} win={w} />
      ))}
    </>
  );
}

function DesktopShellInner() {
  const layerRef = useRef(null);
  useSyncVisualViewportInsets();

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
