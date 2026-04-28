"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
    window.addEventListener("resize", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
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
  const shellRef = useRef(null);
  const [desktopBgMode, setDesktopBgMode] = useState("default"); // "default" | "alt"
  const desktopBgModeRef = useRef(desktopBgMode);
  const [desktopBgTarget, setDesktopBgTarget] = useState(null); // null | "default" | "alt"
  const [revealActive, setRevealActive] = useState(false);
  const revealTimerRef = useRef(0);

  const ALT_BG_IMAGE = "url(/web/buttons/graupappe.webp)";

  const syncBgRevealOrigin = useCallback(() => {
    if (typeof window === "undefined") return;
    const shell = shellRef.current;
    if (!shell) return;
    const logo = document.querySelector("#logo-container");
    if (!(logo instanceof HTMLElement)) return;

    const sr = shell.getBoundingClientRect();
    const lr = logo.getBoundingClientRect();
    const cx = lr.left + lr.width / 2 - sr.left;
    const cy = lr.top + lr.height / 2 - sr.top;
    const w = sr.width;
    const h = sr.height;
    const r = Math.ceil(
      Math.max(
        Math.hypot(cx - 0, cy - 0),
        Math.hypot(cx - w, cy - 0),
        Math.hypot(cx - 0, cy - h),
        Math.hypot(cx - w, cy - h)
      )
    );

    shell.style.setProperty("--mm-reveal-x", `${cx}px`);
    shell.style.setProperty("--mm-reveal-y", `${cy}px`);
    shell.style.setProperty("--mm-reveal-r", `${r}px`);
  }, []);

  useEffect(() => {
    desktopBgModeRef.current = desktopBgMode;
  }, [desktopBgMode]);

  const onLogoClick = useCallback(() => {
    if (typeof window === "undefined") return;
    const shell = shellRef.current;
    if (!shell) return;

    window.clearTimeout(revealTimerRef.current);
    syncBgRevealOrigin();

    const curMode = desktopBgModeRef.current;
    const nextMode = curMode === "alt" ? "default" : "alt";
    setDesktopBgTarget(nextMode);
    shell.style.setProperty(
      "--mm-reveal-overlay-image",
      nextMode === "alt" ? ALT_BG_IMAGE : "none"
    );
    shell.style.setProperty(
      "--mm-reveal-overlay-color",
      nextMode === "alt" ? "transparent" : "var(--mm-desktop-bg)"
    );

    // Always explode: start immediately on click (no rAF delay).
    setRevealActive(true);

    revealTimerRef.current = window.setTimeout(() => {
      setDesktopBgMode(nextMode);
      setRevealActive(false);
      setDesktopBgTarget(null);
    }, 720);
  }, [syncBgRevealOrigin]);

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

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    // Keep origin correct when layout changes; also keep base image in sync.
    shell.style.setProperty(
      "--mm-desktop-base-image",
      desktopBgMode === "alt" ? ALT_BG_IMAGE : "none"
    );

    const onResize = () => syncBgRevealOrigin();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
  }, [desktopBgMode, syncBgRevealOrigin]);

  return (
    <div
      ref={shellRef}
      data-mm-desktop-shell
      data-mm-bg-mode={desktopBgMode}
      data-mm-bg-target={desktopBgTarget ?? undefined}
      data-mm-reveal={revealActive ? "1" : "0"}
      className="flex min-h-0 w-full flex-1 flex-col overflow-x-hidden max-md:h-full max-md:max-h-full md:min-h-[max(100dvh,800px)]"
      style={{
        "--mm-graupappe-image": ALT_BG_IMAGE,
        backgroundColor: "var(--mm-desktop-bg)",
        backgroundImage:
          desktopBgMode === "alt" ? ALT_BG_IMAGE : "none",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "cover",
        color: "var(--mm-shell-text)",
      }}
    >
      <SiteHeader onLogoClick={onLogoClick} />
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
