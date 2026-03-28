"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { APPS, DESKTOP_ICONS } from "@/lib/apps";
import { useDesktop } from "@/context/DesktopContext";

const ICON_W = 80;
const ICON_H = 100;
/** Abstand zum rechten Rand — wie DESKTOP_ICON_GRID.startX in lib/apps.js */
const MARGIN_X = 16;
const START_Y = 16;
const ROW_H = 110;

function toPixelPosition(pos, containerWidth) {
  if (pos?.align === "right" && typeof pos.row === "number") {
    const w = containerWidth > 0 ? containerWidth : 800;
    return {
      x: Math.max(0, w - ICON_W - MARGIN_X),
      y: START_Y + pos.row * ROW_H,
    };
  }
  return { x: pos?.x ?? MARGIN_X, y: pos?.y ?? START_Y };
}

export function DesktopIcons() {
  const { openOrFocus, desktopIconPositions, setDesktopIconPosition } =
    useDesktop();
  const [containerW, setContainerW] = useState(0);
  const desktopRef = useRef(null);
  const dragRef = useRef(null);
  const blockClickRef = useRef(false);

  useLayoutEffect(() => {
    const el = desktopRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setContainerW(r.width);
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setContainerW(r.width);
    return () => ro.disconnect();
  }, []);

  const clamp = useCallback((x, y) => {
    const el = desktopRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const maxX = Math.max(0, rect.width - ICON_W);
    const maxY = Math.max(0, rect.height - ICON_H);
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const el = desktopRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = e.clientX - rect.left - d.offX;
      const ny = e.clientY - rect.top - d.offY;
      if (
        Math.abs(e.clientX - d.startClientX) > 4 ||
        Math.abs(e.clientY - d.startClientY) > 4
      ) {
        d.didDrag = true;
      }
      const c = clamp(nx, ny);
      setDesktopIconPosition(d.appId, c.x, c.y);
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.didDrag) blockClickRef.current = true;
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [clamp, setDesktopIconPosition]);

  const onPointerDown = (e, appId) => {
    if (e.button !== 0) return;
    blockClickRef.current = false;
    const el = desktopRef.current;
    if (!el) return;
    const raw = desktopIconPositions[appId] ?? { x: MARGIN_X, y: START_Y };
    const pos = toPixelPosition(raw, el.getBoundingClientRect().width);
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      appId,
      offX: e.clientX - rect.left - pos.x,
      offY: e.clientY - rect.top - pos.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      didDrag: false,
    };
    e.preventDefault();
  };

  return (
    <div
      ref={desktopRef}
      className="pointer-events-none absolute inset-0"
    >
      {DESKTOP_ICONS.map((item) => {
        const app = APPS[item.appId];
        if (!app) return null;
        const raw = desktopIconPositions[item.appId] ?? {
          x: MARGIN_X,
          y: START_Y,
        };
        const pos = toPixelPosition(raw, containerW);
        return (
          <button
            key={item.appId}
            type="button"
            style={{ left: pos.x, top: pos.y }}
            className="pointer-events-auto absolute flex min-h-[var(--mm-desktop-folder-tile)] w-20 flex-col items-center gap-1 rounded-lg p-2 text-center outline-none transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
            onPointerDown={(e) => onPointerDown(e, item.appId)}
            onClick={() => {
              if (blockClickRef.current) {
                blockClickRef.current = false;
                return;
              }
              openOrFocus(item.appId);
            }}
          >
            <span className="text-4xl drop-shadow-md filter" aria-hidden>
              {app.icon}
            </span>
            <span className="max-w-full truncate text-xs font-medium text-zinc-800 [text-shadow:0_1px_0_rgba(255,255,255,0.6)] dark:text-zinc-100 dark:[text-shadow:0_1px_0_rgba(0,0,0,0.35)]">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
