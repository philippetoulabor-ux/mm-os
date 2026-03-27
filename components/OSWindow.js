"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDesktop } from "@/context/DesktopContext";
import { AppContent } from "@/components/AppContent";
import { APPS } from "@/lib/apps";

export function OSWindow({ win }) {
  const {
    closeWindow,
    focusWindow,
    moveWindow,
    setWindowBounds,
    openOrFocus,
    siteHeaderHeight,
    dockHeight,
  } = useDesktop();

  const showNotesLauncher = win.appId !== "notes";

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeState = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onBarMouseDown = useCallback(
    (e) => {
      if (win.maximized) return;
      e.preventDefault();
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
      focusWindow(win.id);
      resizeState.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startW: win.w,
        startH: win.h,
        startWinX: win.x,
        startWinY: win.y,
      };
    },
    [win.id, win.w, win.h, win.x, win.y, win.maximized, focusWindow]
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || win.maximized) return;
      const nx = e.clientX - dragOffset.current.x;
      const ny = e.clientY - dragOffset.current.y;
      const maxX = window.innerWidth - 80;
      const maxY =
        window.innerHeight - siteHeaderHeight - dockHeight - 40;
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
  }, [win.id, win.maximized, moveWindow, siteHeaderHeight, dockHeight]);

  useEffect(() => {
    const onMove = (e) => {
      const rs = resizeState.current;
      if (!rs || win.maximized) return;
      const dx = e.clientX - rs.startX;
      const dy = e.clientY - rs.startY;
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
      // Oben nicht vergrößern: nur nach unten schmaler machen, nicht nach oben höher ziehen.
      if (rs.edge === "n" || rs.edge === "ne" || rs.edge === "nw") {
        if (nh > rs.startH) nh = rs.startH;
        ny = rs.startWinY + rs.startH - nh;
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
  }, [win.id, win.maximized, setWindowBounds]);

  if (!mounted || win.minimized) return null;

  const style = {
    left: win.x,
    top: win.y,
    width: win.w,
    height: win.h,
    zIndex: win.z,
  };

  const showResize = !win.maximized;
  const edge = "absolute z-10";
  const corner = "absolute z-20 h-4 w-4";

  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-xl border border-white/20 bg-zinc-900/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={style}
      onMouseDown={() => focusWindow(win.id)}
    >
      <header
        className="flex h-9 shrink-0 cursor-default items-center gap-2 border-b border-white/10 bg-white/5 px-3"
        onMouseDown={onBarMouseDown}
      >
        <div className="flex w-14 shrink-0 items-center justify-start gap-1.5">
          <button
            type="button"
            aria-label="Schließen"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-110"
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(win.id);
            }}
          />
        </div>
        <span className="flex-1 select-none text-center text-xs font-medium text-zinc-300">
          {win.title}
        </span>
        {showNotesLauncher ? (
          <div className="flex w-14 shrink-0 items-center justify-end">
            <button
              type="button"
              aria-label="Notes öffnen"
              title="Notes"
              className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
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
        <AppContent appId={win.appId} />
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
