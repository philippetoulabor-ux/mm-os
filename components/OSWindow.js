"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDesktopContentRect,
  MEDIA_MINIMIZE_INSET_X,
  MEDIA_MINIMIZE_INSET_Y,
  useDesktop,
} from "@/context/DesktopContext";
import { AppContent } from "@/components/AppContent";
import { APPS } from "@/lib/apps";

/**
 * @param {object} rs resizeState mit startWinX, startWinY, startW, startH, edge
 * @param {{ rw: number, rh: number }} aspect Inhalts-Seitenverhältnis (Breite/Höhe ohne Titelleiste)
 */
function computeAspectResizeBounds(rs, dx, dy, aspect, titlebar) {
  const { rw, rh } = aspect;
  const sx = rs.startWinX;
  const sy = rs.startWinY;
  const sw = rs.startW;
  const sh = rs.startH;
  let nx = sx;
  let ny = sy;
  let nw = sw;
  let nh = sh;

  switch (rs.edge) {
    case "e": {
      nw = sw + dx;
      nh = nw * (rh / rw) + titlebar;
      break;
    }
    case "w": {
      nw = sw - dx;
      nx = sx + dx;
      nh = nw * (rh / rw) + titlebar;
      break;
    }
    case "s": {
      nh = sh + dy;
      nw = (nh - titlebar) * (rw / rh);
      break;
    }
    case "n": {
      nh = sh - dy;
      ny = sy + sh - nh;
      nw = (nh - titlebar) * (rw / rh);
      nx = sx + (sw - nw) / 2;
      break;
    }
    case "se": {
      nw = sw + dx;
      nh = nw * (rh / rw) + titlebar;
      break;
    }
    case "sw": {
      nw = sw - dx;
      nx = sx + dx;
      nh = nw * (rh / rw) + titlebar;
      ny = sy;
      break;
    }
    case "ne": {
      nw = sw + dx;
      nh = nw * (rh / rw) + titlebar;
      nx = sx;
      ny = sy + sh - nh;
      break;
    }
    case "nw": {
      nw = sw - dx;
      nx = sx + dx;
      nh = nw * (rh / rw) + titlebar;
      ny = sy + sh - nh;
      break;
    }
    default:
      return null;
  }

  if (rs.edge === "n" || rs.edge === "ne" || rs.edge === "nw") {
    if (nh > rs.startH) {
      nh = rs.startH;
      ny = rs.startWinY + rs.startH - nh;
      nw = (nh - titlebar) * (rw / rh);
      if (rs.edge === "n") {
        nx = rs.startWinX + (rs.startW - nw) / 2;
      } else if (rs.edge === "ne") {
        nx = rs.startWinX;
      } else if (rs.edge === "nw") {
        nx = rs.startWinX + rs.startW - nw;
      }
    }
  }

  return { x: nx, y: ny, w: nw, h: nh };
}

function clampAspectWindowBounds(
  nx,
  ny,
  nw,
  nh,
  rw,
  rh,
  titlebar,
  minW,
  minH,
  vw,
  siteHeader,
  dock
) {
  const maxBottom = window.innerHeight - dock;
  const maxWinH = window.innerHeight - siteHeader - dock;

  let w = Math.max(minW, nw);
  let h = w * (rh / rw) + titlebar;

  if (h < minH) {
    h = minH;
    w = Math.max(minW, (h - titlebar) * (rw / rh));
    h = w * (rh / rw) + titlebar;
  }

  let s = Math.min(1, vw / w, maxWinH / h);
  w = Math.max(minW, Math.floor(w * s));
  h = w * (rh / rw) + titlebar;

  if (h > maxWinH) {
    h = maxWinH;
    w = Math.max(minW, (h - titlebar) * (rw / rh));
    h = w * (rh / rw) + titlebar;
  }
  if (w > vw) {
    w = vw;
    h = w * (rh / rw) + titlebar;
  }
  if (h < minH) {
    h = minH;
    w = Math.max(minW, (h - titlebar) * (rw / rh));
    h = w * (rh / rw) + titlebar;
  }

  let x = nx;
  let y = ny;
  x = Math.max(0, Math.min(x, vw - w));
  y = Math.max(-siteHeader, Math.min(y, maxBottom - h));
  return { x, y, w, h };
}

export function OSWindow({ win }) {
  const {
    closeWindow,
    focusWindow,
    moveWindow,
    setWindowBounds,
    openOrFocus,
    toggleMediaPlayerVideoPanel,
    siteHeaderHeight,
    dockHeight,
    minWindowW,
    minWindowH,
    osTitlebarH,
  } = useDesktop();

  const showNotesLauncher =
    win.appId !== "notes" &&
    !(win.appId === "media" && win.mediaVideoCollapsed);

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeState = useRef(null);
  const [mounted, setMounted] = useState(false);
  /** Keine CSS-Transition der Bounds während Ziehen/Resize — sonst folgt das Fenster der Maus mit Verzögerung. */
  const [boundsInteraction, setBoundsInteraction] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onUp = () => setBoundsInteraction(false);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  const onBarMouseDown = useCallback(
    (e) => {
      if (win.maximized) return;
      e.preventDefault();
      setBoundsInteraction(true);
      focusWindow(win.id);
      dragging.current = true;
      dragOffset.current = {
        x: e.clientX - win.x,
        y: e.clientY - win.y,
      };
    },
    [win.id, win.x, win.y, win.maximized, focusWindow]
  );

  const onResizeStart = useCallback(
    (e, edge) => {
      if (win.maximized) return;
      e.preventDefault();
      e.stopPropagation();
      setBoundsInteraction(true);
      focusWindow(win.id);
      resizeState.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startW: win.w,
        startH: win.h,
        startWinX: win.x,
        startWinY: win.y,
        contentAspect: win.contentAspect ?? null,
      };
    },
    [
      win.id,
      win.w,
      win.h,
      win.x,
      win.y,
      win.maximized,
      win.contentAspect,
      focusWindow,
    ]
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || win.maximized) return;
      const nx = e.clientX - dragOffset.current.x;
      const ny = e.clientY - dragOffset.current.y;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { w: dW, h: dH } = getDesktopContentRect();
      const px = MEDIA_MINIMIZE_INSET_X;
      const py = MEDIA_MINIMIZE_INSET_Y;
      let maxX;
      let maxY;
      if (win.appId === "media" && win.mediaVideoCollapsed) {
        maxX = dW - win.w - px;
        maxY = dH - win.h - py;
      } else {
        maxX = vw - 80;
        maxY = vh - siteHeaderHeight - dockHeight - 40;
      }
      moveWindow(
        win.id,
        Math.max(0, Math.min(nx, maxX)),
        Math.max(-siteHeaderHeight, Math.min(ny, maxY))
      );
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    win.id,
    win.maximized,
    win.appId,
    win.mediaVideoCollapsed,
    win.w,
    win.h,
    moveWindow,
    siteHeaderHeight,
    dockHeight,
  ]);

  useEffect(() => {
    const onMove = (e) => {
      const rs = resizeState.current;
      if (!rs || win.maximized) return;
      const dx = e.clientX - rs.startX;
      const dy = e.clientY - rs.startY;

      const aspect = rs.contentAspect;
      if (
        aspect?.rw > 0 &&
        aspect?.rh > 0 &&
        typeof minWindowW === "number" &&
        typeof minWindowH === "number"
      ) {
        const raw = computeAspectResizeBounds(rs, dx, dy, aspect, osTitlebarH);
        if (!raw) return;
        const vw = window.innerWidth;
        const clamped = clampAspectWindowBounds(
          raw.x,
          raw.y,
          raw.w,
          raw.h,
          aspect.rw,
          aspect.rh,
          osTitlebarH,
          minWindowW,
          minWindowH,
          vw,
          siteHeaderHeight,
          dockHeight
        );
        setWindowBounds(win.id, clamped);
        return;
      }

      let nx = rs.startWinX;
      let ny = rs.startWinY;
      let nw = rs.startW;
      let nh = rs.startH;
      switch (rs.edge) {
        case "e":
          nw = rs.startW + dx;
          break;
        case "w":
          nx = rs.startWinX + dx;
          nw = rs.startW - dx;
          break;
        case "s":
          nh = rs.startH + dy;
          break;
        case "n":
          ny = rs.startWinY + dy;
          nh = rs.startH - dy;
          break;
        case "se":
          nw = rs.startW + dx;
          nh = rs.startH + dy;
          break;
        case "sw":
          nx = rs.startWinX + dx;
          nw = rs.startW - dx;
          nh = rs.startH + dy;
          break;
        case "ne":
          nw = rs.startW + dx;
          ny = rs.startWinY + dy;
          nh = rs.startH - dy;
          break;
        case "nw":
          nx = rs.startWinX + dx;
          nw = rs.startW - dx;
          ny = rs.startWinY + dy;
          nh = rs.startH - dy;
          break;
        default:
          return;
      }
      setWindowBounds(win.id, { x: nx, y: ny, w: nw, h: nh });
    };
    const onUp = () => {
      resizeState.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    win.id,
    win.maximized,
    setWindowBounds,
    minWindowW,
    minWindowH,
    osTitlebarH,
    siteHeaderHeight,
    dockHeight,
  ]);

  if (!mounted || win.minimized) return null;

  const style = {
    left: win.x,
    top: win.y,
    width: win.w,
    height: win.h,
    zIndex: win.z,
    ...(mounted && !boundsInteraction
      ? {
          transitionProperty: "width, height, left, top",
          transitionDuration: "var(--mm-library-motion-duration)",
          transitionTimingFunction: "var(--mm-library-motion-easing)",
        }
      : {}),
  };

  const showResize =
    !win.maximized && !(win.appId === "media" && win.mediaVideoCollapsed);
  const edge = "absolute z-10";
  const corner = "absolute z-20 h-4 w-4";

  return (
    <div
      className={`absolute flex flex-col overflow-hidden border-2 border-black bg-white shadow-none ${
        win.maximized ? "rounded-none" : "rounded-lg"
      }`}
      style={style}
      onMouseDown={() => focusWindow(win.id)}
    >
      <header
        className="flex h-10 shrink-0 cursor-default items-center gap-2 border-b-2 border-black bg-[var(--mm-desktop-bg)] pl-0 pr-3 font-sans"
        onMouseDown={onBarMouseDown}
      >
        <div
          className={
            win.appId === "media"
              ? "flex w-[4.125rem] shrink-0 items-center justify-start gap-0.5 pl-2"
              : "flex w-14 shrink-0 items-center justify-start pl-1"
          }
        >
          <button
            type="button"
            aria-label="Schließen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(win.id);
            }}
          >
            <span
              className="block h-3 w-3 shrink-0 rounded-full bg-[rgb(255,0,0)]"
              aria-hidden
            />
          </button>
          {win.appId === "media" ? (
            <button
              type="button"
              aria-label={
                win.mediaVideoCollapsed
                  ? "Player wiederherstellen"
                  : "Player minimieren"
              }
              aria-pressed={!!win.mediaVideoCollapsed}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent hover:opacity-90"
              onClick={(e) => {
                e.stopPropagation();
                toggleMediaPlayerVideoPanel(win.id);
              }}
            >
              <span
                className={`block h-3 w-3 shrink-0 rounded-full ${
                  win.mediaVideoCollapsed
                    ? "bg-[rgb(0,255,0)]"
                    : "bg-[rgb(255,204,0)]"
                }`}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
        <span className="flex-1 select-none text-center text-xs font-medium text-black dark:text-zinc-100">
          {win.title}
        </span>
        {showNotesLauncher ? (
          <div className="flex w-14 shrink-0 items-center justify-end">
            <button
              type="button"
              aria-label="Notes öffnen"
              title="Notes"
              className="flex min-h-7 min-w-7 items-center justify-center rounded-full bg-white px-2.5 py-1 text-lg font-bold leading-none text-black hover:bg-zinc-100"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                openOrFocus("notes");
              }}
            >
              <span aria-hidden>{APPS.notes.icon}</span>
            </button>
          </div>
        ) : (
          <span className="w-14 shrink-0" aria-hidden />
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <AppContent
          appId={win.appId}
          assetFile={win.assetFile}
          windowId={win.id}
        />
      </div>
      {showResize && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            className={`${edge} left-3 right-3 top-0 h-3 cursor-n-resize`}
            onMouseDown={(e) => onResizeStart(e, "n")}
          />
          <div
            role="separator"
            aria-orientation="horizontal"
            className={`${edge} bottom-0 left-3 right-3 h-3 cursor-ns-resize`}
            onMouseDown={(e) => onResizeStart(e, "s")}
          />
          <div
            role="separator"
            aria-orientation="vertical"
            className={`${edge} bottom-3 left-0 top-3 w-3 cursor-ew-resize`}
            onMouseDown={(e) => onResizeStart(e, "w")}
          />
          <div
            role="separator"
            aria-orientation="vertical"
            className={`${edge} bottom-3 right-0 top-3 w-3 cursor-ew-resize`}
            onMouseDown={(e) => onResizeStart(e, "e")}
          />
          <div
            className={`${corner} left-0 top-0 cursor-nw-resize`}
            aria-hidden
            onMouseDown={(e) => onResizeStart(e, "nw")}
          />
          <div
            className={`${corner} right-0 top-0 cursor-ne-resize`}
            aria-hidden
            onMouseDown={(e) => onResizeStart(e, "ne")}
          />
          <div
            className={`${corner} bottom-0 left-0 cursor-nesw-resize`}
            aria-hidden
            onMouseDown={(e) => onResizeStart(e, "sw")}
          />
          <div
            className={`${corner} bottom-0 right-0 cursor-nwse-resize`}
            aria-hidden
            onMouseDown={(e) => onResizeStart(e, "se")}
          />
        </>
      )}
    </div>
  );
}
