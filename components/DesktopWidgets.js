"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDesktop } from "@/context/DesktopContext";
import { SlideshowWidget } from "@/components/SlideshowWidget";

const WIDGET_W = 340;
const WIDGET_H = WIDGET_W;

function widgetToPixelPosition(pos, containerWidth, containerHeight) {
  const w = containerWidth > 0 ? containerWidth : 1200;
  const h = containerHeight > 0 ? containerHeight : 800;
  if (
    typeof pos?.xp === "number" &&
    Number.isFinite(pos.xp) &&
    typeof pos?.yp === "number" &&
    Number.isFinite(pos.yp)
  ) {
    return {
      x: Math.max(0, pos.xp * w - WIDGET_W / 2),
      y: Math.max(0, pos.yp * h - WIDGET_H / 2),
    };
  }
  return { x: pos?.x ?? 80, y: pos?.y ?? 80 };
}

/** Mobile: Slideshow über dem Icon-Raster — in DesktopIcons als erste Zeile einbinden. */
export function DesktopWidgetsMobile() {
  const { desktopWidgets } = useDesktop();

  return (
    <div className="pointer-events-auto z-[2] w-full shrink-0 px-1 pb-2 pt-1 min-[400px]:px-2">
      {desktopWidgets.map((w) =>
        w.kind === "slideshow" ? (
          <SlideshowWidget key={w.id} widget={w} layout="mobile" />
        ) : null
      )}
    </div>
  );
}

export function DesktopWidgets() {
  const { desktopWidgets, setDesktopWidgetPosition } = useDesktop();
  const [layerMetrics, setLayerMetrics] = useState({
    top: 0,
    w: 0,
    h: 0,
  });
  const desktopRef = useRef(null);
  const dragRef = useRef(null);

  useLayoutEffect(() => {
    const layer = document.querySelector("[data-mm-desktop-layer]");
    if (!layer) return undefined;
    const sync = () => {
      const r = layer.getBoundingClientRect();
      setLayerMetrics({ top: r.top, w: r.width, h: r.height });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(layer);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  const clamp = useCallback(
    (x, y) => {
      const { w, h, top: layerTop } = layerMetrics;
      if (w <= 0 || h <= 0) return { x, y };
      const maxX = Math.max(0, w - WIDGET_W);
      const maxY = Math.max(0, h - WIDGET_H);
      const minY = -layerTop;
      return {
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(minY, Math.min(y, maxY)),
      };
    },
    [layerMetrics]
  );

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const el = desktopRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { top: layerTop } = layerMetrics;
      const nxCont = e.clientX - rect.left - d.offX;
      const nyCont = e.clientY - rect.top - d.offY;
      const nxLayer = nxCont;
      const nyLayer = nyCont - layerTop;
      if (
        Math.abs(e.clientX - d.startClientX) > 8 ||
        Math.abs(e.clientY - d.startClientY) > 8
      ) {
        d.didDrag = true;
      }
      const c = clamp(nxLayer, nyLayer);
      setDesktopWidgetPosition(d.widgetId, c.x, c.y);
    };
    const onUp = () => {
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
  }, [clamp, layerMetrics, setDesktopWidgetPosition]);

  const onPointerDown = useCallback(
    (e, widgetId) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (t instanceof Element && t.closest("[data-mm-widget-no-drag]")) {
        return;
      }
      const el = desktopRef.current;
      if (!el) return;
      const w = desktopWidgets.find((x) => x.id === widgetId);
      if (!w) return;
      const raw = w.desktop;
      const rect = el.getBoundingClientRect();
      const pos = widgetToPixelPosition(raw, layerMetrics.w, layerMetrics.h);
      const { top: layerTop } = layerMetrics;
      const topPx = pos.y + layerTop;
      dragRef.current = {
        widgetId,
        offX: e.clientX - rect.left - pos.x,
        offY: e.clientY - rect.top - topPx,
        startClientX: e.clientX,
        startClientY: e.clientY,
        didDrag: false,
      };
      e.preventDefault();
    },
    [desktopWidgets, layerMetrics]
  );

  const layerTopPx = layerMetrics.top;

  return (
    <div
      ref={desktopRef}
      className="pointer-events-none absolute left-0 right-0 z-[2] hidden md:block"
      style={{
        top: layerTopPx ? -layerTopPx : 0,
        height: layerTopPx ? `calc(100% + ${layerTopPx}px)` : "100%",
      }}
    >
      {desktopWidgets.map((w) => {
        if (w.kind !== "slideshow") return null;
        const raw = w.desktop;
        const pos = widgetToPixelPosition(raw, layerMetrics.w, layerMetrics.h);
        return (
          <div
            key={w.id}
            className="pointer-events-auto absolute"
            style={{
              left: pos.x,
              top: pos.y + layerTopPx,
              width: WIDGET_W,
              height: WIDGET_H,
            }}
          >
            <SlideshowWidget
              widget={w}
              layout="desktop"
              dragHandleProps={{
                onPointerDown: (e) => onPointerDown(e, w.id),
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
