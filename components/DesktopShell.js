"use client";

import { useLayoutEffect, useRef } from "react";
import {
  DesktopProvider,
  syncDesktopLayerMetrics,
  useDesktop,
} from "@/context/DesktopContext";
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
      className="flex min-h-0 w-full flex-1 flex-col overflow-x-hidden min-h-[max(100dvh,400px)]"
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
