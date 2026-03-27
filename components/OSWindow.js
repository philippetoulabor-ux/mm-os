"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDesktop } from "@/context/DesktopContext";
import { AppContent } from "@/components/AppContent";

export function OSWindow({ win }) {
  const {
    closeWindow,
    focusWindow,
    minimizeWindow,
    toggleMaximize,
    moveWindow,
    menuBarHeight,
    dockHeight,
  } = useDesktop();

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
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

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || win.maximized) return;
      const nx = e.clientX - dragOffset.current.x;
      const ny = e.clientY - dragOffset.current.y;
      const maxX = window.innerWidth - 80;
      const maxY = window.innerHeight - dockHeight - 40;
      moveWindow(
        win.id,
        Math.max(0, Math.min(nx, maxX)),
        Math.max(menuBarHeight, Math.min(ny, maxY))
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
  }, [win.id, win.maximized, moveWindow, menuBarHeight, dockHeight]);

  if (!mounted || win.minimized) return null;

  const style = {
    left: win.x,
    top: win.y,
    width: win.w,
    height: win.h,
    zIndex: win.z,
  };

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
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Close"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-110"
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(win.id);
            }}
          />
          <button
            type="button"
            aria-label="Minimize"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:brightness-110"
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(win.id);
            }}
          />
          <button
            type="button"
            aria-label="Zoom"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110"
            onClick={(e) => {
              e.stopPropagation();
              toggleMaximize(win.id);
            }}
          />
        </div>
        <span className="flex-1 select-none text-center text-xs font-medium text-zinc-300">
          {win.title}
        </span>
        <span className="w-14" aria-hidden />
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <AppContent appId={win.appId} />
      </div>
    </div>
  );
}
