"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AppIcon } from "@/components/AppIcon";
import { DesktopWidgetsMobile } from "@/components/DesktopWidgets";
import { APPS, DESKTOP_ICONS } from "@/lib/apps";
import { getWebAssetFolderPreviewHref } from "@/lib/webAssetFolderPreview";
import { useDesktop } from "@/context/DesktopContext";

/** Bounds fürs Drag-Clamping — an max. Kachelbreite/-höhe mit mehrzeiligem Label angepasst */
const ICON_W = 200;
const ICON_H = 240;
/** Mobile Home-Grid: Icon-Kante (rem) — Schrift/Abstand per calc daran gekoppelt (iOS-ähnliches Verhältnis) */
const MOBILE_GRID_ICON_REM = "3.5rem";
/** Abstand zum linken/rechten Rand / Fallback — wie DESKTOP_ICON_GRID in lib/apps.js */
const MARGIN_X = 180;
const START_Y = 132;
const ROW_H = 128;
/** Notes + Media: gleicher Zeilenabstand wie links, aber etwas höher am Rand */
const RIGHT_START_Y = START_Y - 60;

/** Mobile: festes iOS-ähnliches Raster (4 Spalten × min. 4 Zeilen). */
const MOBILE_HOME_GRID_COLS = 4;
const MOBILE_HOME_GRID_ROWS = 4;

/** Nach diesen Zeichen Zero-Width-Space: Zeilenumbruch nur an Trennern, nicht mitten in Wörtern/CamelCase. */
const DESKTOP_LABEL_BREAK_AFTER = /[-_.,\s/\\:;|]/g;

function desktopLabelBreakable(text) {
  if (typeof text !== "string") return text;
  return text.replace(DESKTOP_LABEL_BREAK_AFTER, (ch) => `${ch}\u200B`);
}

function toPixelPosition(pos, containerWidth, containerHeight) {
  const w = containerWidth > 0 ? containerWidth : 1200;
  const h = containerHeight > 0 ? containerHeight : 800;
  if (pos?.align === "right" && typeof pos.row === "number") {
    return {
      x: Math.max(0, w - ICON_W - MARGIN_X),
      y: RIGHT_START_Y + pos.row * ROW_H,
    };
  }
  if (
    typeof pos?.xp === "number" &&
    Number.isFinite(pos.xp) &&
    typeof pos?.yp === "number" &&
    Number.isFinite(pos.yp)
  ) {
    return {
      x: Math.max(0, pos.xp * w - ICON_W / 2),
      y: Math.max(0, pos.yp * h - ICON_H / 2),
    };
  }
  return { x: pos?.x ?? MARGIN_X, y: pos?.y ?? START_Y };
}

export function DesktopFolderIcon({ app, folderPreview, iconVariant = "default" }) {
  const href =
    folderPreview && app.assetDir
      ? getWebAssetFolderPreviewHref(app.assetDir)
      : null;
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [href]);

  const previewClass =
    iconVariant === "desktopGrid"
      ? "h-14 w-14 shrink-0 rounded object-cover"
      : iconVariant === "desktop"
        ? "h-10 w-10 shrink-0 rounded object-cover"
        : iconVariant === "compact"
          ? "h-6 w-6 shrink-0 rounded object-cover"
          : "h-9 w-9 shrink-0 rounded object-cover";

  if (href && !imgFailed) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt=""
          className={previewClass}
          onError={() => setImgFailed(true)}
        />
      </>
    );
  }

  return <AppIcon app={app} variant={iconVariant} />;
}

function DesktopIconTile({
  item,
  folderPreview,
  openOrFocus,
  layout,
  positionStyle,
  onPointerDown,
  blockClickRef,
}) {
  const app = APPS[item.appId];
  if (!app) return null;

  const onClick = () => {
    if (blockClickRef?.current) {
      blockClickRef.current = false;
      return;
    }
    openOrFocus(item.appId);
  };

  const gridLabel = (
    <span className="w-full min-w-0 max-w-full break-normal text-center font-medium leading-tight text-zinc-800 [font-size:calc(0.165*var(--mm-mobile-grid-icon))] dark:text-zinc-100">
      {desktopLabelBreakable(item.label)}
    </span>
  );

  const iconWrap = (
    <span className="inline-flex shrink-0" aria-hidden>
      <DesktopFolderIcon
        app={app}
        folderPreview={folderPreview}
        iconVariant={layout === "grid" ? "desktopGrid" : "desktop"}
      />
    </span>
  );

  if (layout === "grid") {
    return (
      <button
        type="button"
        className="pointer-events-auto flex min-h-0 w-full max-w-[6rem] flex-col items-center justify-start rounded-xl px-0.5 py-1.5 text-center outline-none transition-colors active:bg-black/10 [gap:calc(0.09*var(--mm-mobile-grid-icon))] min-[400px]:px-1 min-[400px]:py-2 dark:active:bg-white/15"
        style={{ "--mm-mobile-grid-icon": MOBILE_GRID_ICON_REM }}
        onClick={onClick}
      >
        {iconWrap}
        {gridLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      style={positionStyle}
      className="group pointer-events-auto absolute flex min-h-[var(--mm-desktop-folder-tile)] min-w-16 w-max max-w-[11rem] items-center justify-center text-center outline-none transition-transform active:scale-95"
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <span className="inline-flex max-w-full flex-col items-center gap-1.5 rounded px-1.5 py-1.5 transition-colors duration-200 ease-out group-hover:bg-black/5 group-active:bg-black/10 dark:group-hover:bg-white/10 dark:group-active:bg-white/15">
        {iconWrap}
        <span className="w-full min-w-0 max-w-full shrink-0 break-normal text-center text-[0.6875rem] font-semibold leading-tight text-zinc-800 dark:text-zinc-100">
          {desktopLabelBreakable(item.label)}
        </span>
      </span>
    </button>
  );
}

export function DesktopIcons() {
  const {
    openOrFocus,
    desktopIconPositions,
    setDesktopIconPosition,
    folderPreview,
  } = useDesktop();
  /** Desktop-Layer: Breite/Höhe wie bisher; `top` = Abstand Layer-Oberkante → Viewport-Oberkante (= Header-Höhe) */
  const [layerMetrics, setLayerMetrics] = useState({
    top: 0,
    w: 0,
    h: 0,
  });
  const desktopRef = useRef(null);
  const dragRef = useRef(null);
  const blockClickRef = useRef(false);

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

  const clamp = useCallback((x, y) => {
    const { w, h, top: layerTop } = layerMetrics;
    if (w <= 0 || h <= 0) return { x, y };
    const maxX = Math.max(0, w - ICON_W);
    const maxY = Math.max(0, h - ICON_H);
    const minY = -layerTop;
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY)),
    };
  }, [layerMetrics]);

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
  }, [clamp, layerMetrics, setDesktopIconPosition]);

  const onPointerDown = (e, appId) => {
    if (e.button !== 0) return;
    blockClickRef.current = false;
    const el = desktopRef.current;
    if (!el) return;
    const raw = desktopIconPositions[appId] ?? { x: MARGIN_X, y: START_Y };
    const rect = el.getBoundingClientRect();
    const pos = toPixelPosition(raw, layerMetrics.w, layerMetrics.h);
    const { top: layerTop } = layerMetrics;
    const topPx = pos.y + layerTop;
    dragRef.current = {
      appId,
      offX: e.clientX - rect.left - pos.x,
      offY: e.clientY - rect.top - topPx,
      startClientX: e.clientX,
      startClientY: e.clientY,
      didDrag: false,
    };
    e.preventDefault();
  };

  const floatingIcons = DESKTOP_ICONS;
  /** Finder: immer sichtbares Fenster auf Desktop — Icon nur mobil im Raster. */
  const desktopFloatingIcons = floatingIcons.filter(
    (item) => item.appId !== "finder"
  );

  const mobileGridRows = Math.max(
    MOBILE_HOME_GRID_ROWS,
    Math.ceil(floatingIcons.length / MOBILE_HOME_GRID_COLS)
  );

  const layerTopPx = layerMetrics.top;

  return (
    <>
      {/* Mobile: festes 4×4-Raster — kein Drag */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col md:hidden"
        style={{
          paddingBottom:
            "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + var(--mm-vv-bottom-inset, 0px)))",
          paddingLeft: "max(0.5rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
        }}
      >
        <DesktopWidgetsMobile />
        <div
          className={`grid min-h-0 w-full flex-1 gap-x-1 gap-y-0.5 px-1 pt-1 min-[400px]:gap-x-2 min-[400px]:gap-y-2 min-[400px]:px-2 ${
            mobileGridRows > MOBILE_HOME_GRID_ROWS ? "overflow-y-auto" : ""
          }`}
          style={{
            gridTemplateColumns: `repeat(${MOBILE_HOME_GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${mobileGridRows}, minmax(0, 1fr))`,
          }}
        >
          {floatingIcons.map((item) => (
            <div
              key={`m-${item.appId}`}
              className="flex min-h-0 min-w-0 items-start justify-center [align-self:stretch] [justify-self:stretch]"
            >
              <DesktopIconTile
                item={item}
                folderPreview={folderPreview}
                openOrFocus={openOrFocus}
                layout="grid"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Schreibtisch inkl. Site-Header — Container reicht bis zur Viewport-Oberkante */}
      <div
        ref={desktopRef}
        className="pointer-events-none absolute left-0 right-0 z-[1] hidden md:block"
        style={{
          top: layerTopPx ? -layerTopPx : 0,
          height: layerTopPx ? `calc(100% + ${layerTopPx}px)` : "100%",
        }}
      >
        {desktopFloatingIcons.map((item) => {
          const app = APPS[item.appId];
          if (!app) return null;
          const raw = desktopIconPositions[item.appId] ?? {
            x: MARGIN_X,
            y: START_Y,
          };
          const pos = toPixelPosition(raw, layerMetrics.w, layerMetrics.h);
          return (
            <DesktopIconTile
              key={item.appId}
              item={item}
              folderPreview={folderPreview}
              openOrFocus={openOrFocus}
              layout="absolute"
              positionStyle={{ left: pos.x, top: pos.y + layerTopPx }}
              onPointerDown={(e) => onPointerDown(e, item.appId)}
              blockClickRef={blockClickRef}
            />
          );
        })}
      </div>
    </>
  );
}
