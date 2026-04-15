"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isMobileViewport, useDesktop } from "@/context/DesktopContext";

/** Mindestweg nach rechts (vom linken Rand). */
const EDGE_MIN_DIST_PX = 52;
/** Horizontal muss gegenüber vertikal dominieren (reduziert Verwechslung mit Scroll). */
const EDGE_DOMINANCE = 1.2;
const EDGE_MAX_MS = 700;
const EDGE_AXIS_LOCK_PX = 12;
/** Unter dem Dock (10000), über typischen Fenster-z-Indizes. */
const EDGE_BACK_Z_INDEX = 7000;

export function MobileEdgeBackGesture() {
  const { windows, closeTopVisibleWindow } = useDesktop();
  const [isMobile, setIsMobile] = useState(false);
  const trackRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const sync = () => setIsMobile(isMobileViewport());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const visibleCount = windows.filter((w) => !w.minimized).length;
  const active = isMobile && visibleCount > 0;

  useEffect(() => {
    if (!active) trackRef.current = null;
  }, [active]);

  const onTouchStart = useCallback(
    (e) => {
      if (!active) return;
      if (e.touches.length !== 1) {
        trackRef.current = null;
        return;
      }
      const t = e.touches[0];
      trackRef.current = {
        sx: t.clientX,
        sy: t.clientY,
        t0:
          typeof performance !== "undefined" ? performance.now() : Date.now(),
        axis: null,
        dead: false,
      };
    },
    [active]
  );

  const onTouchMove = useCallback((e) => {
    const tr = trackRef.current;
    if (!tr || tr.dead || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - tr.sx;
    const dy = t.clientY - tr.sy;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (!tr.axis && (ax > EDGE_AXIS_LOCK_PX || ay > EDGE_AXIS_LOCK_PX)) {
      if (ay > ax * EDGE_DOMINANCE) {
        tr.dead = true;
        trackRef.current = null;
        return;
      }
      if (ax > ay * EDGE_DOMINANCE) {
        tr.axis = "h";
      }
    }
    if (tr.axis === "h" && ax > 12 && ax > ay * EDGE_DOMINANCE) {
      e.preventDefault();
    }
  }, []);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !active) return undefined;
    const move = (e) => onTouchMove(e);
    el.addEventListener("touchmove", move, { passive: false });
    return () => el.removeEventListener("touchmove", move);
  }, [active, onTouchMove]);

  const endGesture = useCallback(() => {
    trackRef.current = null;
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      const tr = trackRef.current;
      trackRef.current = null;
      if (!tr || tr.dead || !active) return;
      if (e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - tr.sx;
      const dy = t.clientY - tr.sy;
      const t1 =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const dt = t1 - tr.t0;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (dt > EDGE_MAX_MS) return;
      if (dx < EDGE_MIN_DIST_PX) return;
      if (ax <= ay * EDGE_DOMINANCE) return;
      closeTopVisibleWindow();
    },
    [active, closeTopVisibleWindow]
  );

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className="fixed left-0 top-0 touch-none"
      style={{
        zIndex: EDGE_BACK_Z_INDEX,
        width: "max(24px, calc(24px + env(safe-area-inset-left, 0px)))",
        top: 0,
        bottom: 0,
        touchAction: "none",
      }}
      aria-hidden
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={endGesture}
    />
  );
}
