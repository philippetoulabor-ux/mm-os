"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { APPS, DESKTOP_ICONS } from "@/lib/apps";
import { getWebAssetFolderPreviewHref } from "@/lib/webAssetFolderPreview";
import {
  getDesktopContentRect,
  useDesktop,
  windowShouldDimDock,
} from "@/context/DesktopContext";

const ICON_W = 80;
const ICON_H = 100;
/** Abstand zum rechten Rand / Fallback — wie DESKTOP_ICON_GRID in lib/apps.js */
const MARGIN_X = 32;
const START_Y = 40;
const ROW_H = 110;

/** Apps in der Mini-Dock-Leiste unten links (früheres Dock-Verhalten). */
const DOCK_LAUNCHER_APP_IDS = new Set(["finder", "settings"]);

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

function CornerDock() {
  const { windows, openOrFocus, focusWindow } = useDesktop();
  const [coveredByWindow, setCoveredByWindow] = useState(false);
  const [hovered, setHovered] = useState(false);

  useLayoutEffect(() => {
    const layer = document.querySelector("[data-mm-desktop-layer]");
    const tick = () => {
      const { w, h } = getDesktopContentRect();
      setCoveredByWindow(
        windows.some((win) => windowShouldDimDock(win, w, h))
      );
    };
    tick();
    window.addEventListener("resize", tick);
    const ro = layer ? new ResizeObserver(tick) : null;
    if (layer) ro.observe(layer);
    return () => {
      window.removeEventListener("resize", tick);
      ro?.disconnect();
    };
  }, [windows]);

  const opacity = coveredByWindow && !hovered ? 0.5 : 1;
  const dockItems = DESKTOP_ICONS.filter((i) =>
    DOCK_LAUNCHER_APP_IDS.has(i.appId)
  );

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[190]">
      <nav
        className="group/dock pointer-events-auto relative flex items-end justify-center rounded-2xl transition-opacity duration-200 ease-out"
        style={{ opacity }}
        aria-label="Application dock"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setHovered(false);
          }
        }}
      >
        <div className="relative origin-bottom scale-[0.72] transition-transform duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] group-hover/dock:scale-100 [@media(hover:none)]:scale-100">
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl border border-black/10 bg-white/55 shadow-lg shadow-black/10 backdrop-blur-xl [transform-origin:bottom] dark:border-white/10 dark:bg-zinc-800/75 dark:shadow-black/40"
            aria-hidden
          />
          <div className="relative z-[1] flex items-end gap-1 px-3 py-2">
            {dockItems.map((item) => {
              const app = APPS[item.appId];
              if (!app) return null;
              return (
                <button
                  key={item.appId}
                  type="button"
                  className="group relative flex min-h-[3.25rem] min-w-[2.5rem] flex-col items-center justify-end bg-transparent px-2 pb-1 pt-2 transition-transform active:scale-95"
                  onClick={() => {
                    const openWin = windows.find((x) => x.appId === item.appId);
                    if (openWin && !openWin.minimized) focusWindow(openWin.id);
                    else openOrFocus(item.appId);
                  }}
                >
                  <span
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-black/10 bg-white/95 px-2 py-0.5 text-xs font-medium text-zinc-800 opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 dark:border-white/15 dark:bg-zinc-900/95 dark:text-zinc-100"
                    aria-hidden
                  >
                    {app.title}
                  </span>
                  <span className="relative flex flex-col items-center">
                    <span
                      className="inline-flex drop-shadow-md transition-transform duration-200 ease-out [transform-origin:bottom] group-hover:scale-[1.15]"
                      aria-hidden
                    >
                      <AppIcon app={app} />
                    </span>
                  </span>
                  <span className="sr-only">{app.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

function DesktopFolderIcon({ app, folderPreview }) {
  const href =
    folderPreview && app.assetDir
      ? getWebAssetFolderPreviewHref(app.assetDir)
      : null;
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [href]);

  if (href && !imgFailed) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-md ring-1 ring-black/10 dark:ring-white/15"
          onError={() => setImgFailed(true)}
        />
      </>
    );
  }

  return <AppIcon app={app} />;
}

export function DesktopIcons() {
  const {
    openOrFocus,
    desktopIconPositions,
    setDesktopIconPosition,
    folderPreview,
  } = useDesktop();
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
    const r = el.getBoundingClientRect();
    const pos = toPixelPosition(raw, r.width);
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
      {DESKTOP_ICONS.filter((item) => !DOCK_LAUNCHER_APP_IDS.has(item.appId)).map(
        (item) => {
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
              <span className="inline-flex drop-shadow-md filter" aria-hidden>
                <DesktopFolderIcon app={app} folderPreview={folderPreview} />
              </span>
              <span className="w-full min-w-0 max-w-full break-words text-center text-xs font-medium leading-tight text-zinc-800 line-clamp-2 [text-shadow:0_1px_0_rgba(255,255,255,0.6)] dark:text-zinc-100 dark:[text-shadow:0_1px_0_rgba(0,0,0,0.35)]">
                {item.label}
              </span>
            </button>
          );
        }
      )}
      <CornerDock />
    </div>
  );
}
