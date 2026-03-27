"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APPS, DESKTOP_ICONS } from "@/lib/apps";
import { useDesktop } from "@/context/DesktopContext";

const ICON_W = 80;
const ICON_H = 100;

export function DesktopIcons() {
  const { openOrFocus, desktopIconPositions, setDesktopIconPosition } =
    useDesktop();
  const [selected, setSelected] = useState(null);
  const desktopRef = useRef(null);
  const dragRef = useRef(null);
  const blockClickRef = useRef(false);

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
    const pos = desktopIconPositions[appId] ?? { x: 16, y: 16 };
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
        const pos = desktopIconPositions[item.appId] ?? { x: 16, y: 16 };
        const isSel = selected === item.appId;
        return (
          <button
            key={item.appId}
            type="button"
            style={{ left: pos.x, top: pos.y }}
            className={`pointer-events-auto absolute flex min-h-[var(--mm-desktop-folder-tile)] w-20 flex-col items-center gap-1 rounded-lg p-2 text-center outline-none transition-colors ${
              isSel
                ? "bg-black/10 dark:bg-white/15"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
            onPointerDown={(e) => onPointerDown(e, item.appId)}
            onClick={() => {
              if (blockClickRef.current) {
                blockClickRef.current = false;
                return;
              }
              setSelected(item.appId);
            }}
            onDoubleClick={() => {
              if (blockClickRef.current) return;
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
