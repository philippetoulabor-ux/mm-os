"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppIcon } from "@/components/AppIcon";
import { APPS, DESKTOP_ICONS } from "@/lib/apps";
import { getWebAssetFolderPreviewHref } from "@/lib/webAssetFolderPreview";
import {
  getDesktopContentRect,
  useDesktop,
  windowShouldDimDock,
} from "@/context/DesktopContext";

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

/** Apps in der Mini-Dock-Leiste unten links (früheres Dock-Verhalten). */
const DOCK_LAUNCHER_APP_IDS = new Set(["finder", "settings"]);

/** Mobile: festes iOS-ähnliches Raster (4 Spalten × min. 4 Zeilen); Finder/Settings nur im Dock wie auf Desktop. */
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

function LauncherDockButtons({ dockItems, windows, openOrFocus, focusWindow }) {
  return (
    <>
      {dockItems.map((item) => {
        const app = APPS[item.appId];
        if (!app) return null;
        return (
          <button
            key={item.appId}
            type="button"
            className="group relative flex min-h-11 min-w-[2.25rem] items-center justify-center bg-transparent px-1.5 py-1.5 transition-transform active:scale-95"
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
            <span className="relative inline-flex flex-col items-center">
              <span
                className="inline-flex transition-transform duration-200 ease-out [transform-origin:center] group-hover:scale-[1.15]"
                aria-hidden
              >
                <AppIcon app={app} />
              </span>
            </span>
            <span className="sr-only">{app.title}</span>
          </button>
        );
      })}
    </>
  );
}

function MobileNavDockButtons({ onBack }) {
  return (
    <button
      type="button"
      className="flex min-h-11 min-w-[2.25rem] items-center justify-center bg-transparent px-1.5 py-1.5 transition-transform active:scale-95"
      onClick={onBack}
      aria-label="Zurück"
    >
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-zinc-200/95 shadow-md dark:border-white/20 dark:bg-zinc-600/95"
        aria-hidden
      >
        <svg
          className="h-5 w-5 text-zinc-800 dark:text-zinc-100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </span>
    </button>
  );
}

/** Tailwind `md` — Dock bleibt auf Desktop das Launcher-Dock; Zurück nur auf schmalen Viewports. */
const DESKTOP_MIN_WIDTH_PX = 768;

function CornerDock() {
  const { windows, openOrFocus, focusWindow, closeTopVisibleWindow } =
    useDesktop();
  const [coveredByWindow, setCoveredByWindow] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const visibleCount = useMemo(
    () => windows.filter((w) => !w.minimized).length,
    [windows]
  );
  /** Mobile: sobald ein Fenster offen ist, nur Zurück. Desktop: Dock bleibt Finder/Settings. */
  const wantNavDock = visibleCount > 0 && !isDesktop;

  const [displayVariant, setDisplayVariant] = useState(
    /** @type {"launcher" | "nav"} */ ("launcher")
  );
  const [dockAnimScale, setDockAnimScale] = useState(1);

  useEffect(() => {
    const target = wantNavDock ? "nav" : "launcher";
    if (target === displayVariant) {
      setDockAnimScale(1);
      return;
    }

    setDockAnimScale(0);
    const id = window.setTimeout(() => {
      setDisplayVariant(target);
      setDockAnimScale(1);
    }, 220);
    return () => window.clearTimeout(id);
  }, [wantNavDock, displayVariant]);

  const closeTopWindow = closeTopVisibleWindow;

  const topVisibleWindow = useMemo(() => {
    const visible = windows.filter((w) => !w.minimized);
    if (visible.length === 0) return null;
    return visible.reduce((a, b) => (a.z >= b.z ? a : b));
  }, [windows]);

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

  /** Desktop: leicht transparent wenn vom Fenster verdeckt, bis Hover. Mobile: immer voll sichtbar. */
  const opacity =
    isDesktop && coveredByWindow && !hovered ? 0.5 : 1;
  const dockBase = DESKTOP_ICONS.filter((i) =>
    DOCK_LAUNCHER_APP_IDS.has(i.appId)
  );
  const mediaDockItem = DESKTOP_ICONS.find((i) => i.appId === "media");
  const mediaIsOpen = windows.some((w) => w.appId === "media");
  const dockItems =
    mediaIsOpen && mediaDockItem
      ? [...dockBase, mediaDockItem]
      : dockBase;

  const showNav = displayVariant === "nav";

  return (
    <div className="pointer-events-none absolute left-1/2 z-[10000] max-w-[calc(100vw-1rem)] -translate-x-1/2 max-md:bottom-[max(0.75rem,calc(0.75rem+env(safe-area-inset-bottom,0px)+var(--mm-vv-bottom-inset,0px)))] md:bottom-3 md:left-3 md:right-auto md:translate-x-0 md:max-w-none">
      <nav
        className="group/dock pointer-events-auto relative mx-auto flex w-max max-w-full items-end justify-center rounded-lg transition-opacity duration-200 ease-out"
        style={{ opacity }}
        aria-label={showNav ? "Navigation" : "Application dock"}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setHovered(false);
          }
        }}
      >
        <div className="relative origin-bottom scale-100 transition-transform duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] md:scale-[0.62] md:group-hover/dock:scale-100">
          <div
            className="origin-bottom transition-transform duration-[220ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]"
            style={{
              transform: `scale(${dockAnimScale})`,
            }}
          >
            {!showNav && (
              <div
                className="pointer-events-none absolute inset-0 rounded-lg border border-black/10 bg-white/55 shadow-lg shadow-black/10 backdrop-blur-xl [transform-origin:bottom] dark:border-white/10 dark:bg-zinc-800/75 dark:shadow-black/40"
                aria-hidden
              />
            )}
            <div
              className={
                showNav && topVisibleWindow?.appId === "media"
                  ? "hidden"
                  : "relative z-[1] flex items-center gap-0.5 px-2 py-1.5"
              }
            >
              {showNav ? (
                topVisibleWindow?.appId === "media" ? null : (
                  <MobileNavDockButtons onBack={closeTopWindow} />
                )
              ) : (
                <LauncherDockButtons
                  dockItems={dockItems}
                  windows={windows}
                  openOrFocus={openOrFocus}
                  focusWindow={focusWindow}
                />
              )}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}

function DesktopFolderIcon({ app, folderPreview, iconVariant = "default" }) {
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

  const floatingIcons = DESKTOP_ICONS.filter(
    (item) => !DOCK_LAUNCHER_APP_IDS.has(item.appId)
  );

  const mobileGridRows = Math.max(
    MOBILE_HOME_GRID_ROWS,
    Math.ceil(floatingIcons.length / MOBILE_HOME_GRID_COLS)
  );

  const layerTopPx = layerMetrics.top;

  return (
    <>
      {/* Mobile: festes 4×4-Raster; Dock unten separat — kein Drag */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col md:hidden"
        style={{
          paddingBottom:
            "max(5.25rem, calc(4.25rem + env(safe-area-inset-bottom, 0px) + var(--mm-vv-bottom-inset, 0px)))",
          paddingLeft: "max(0.5rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
        }}
      >
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
        {floatingIcons.map((item) => {
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

      {/* Eigenes Layer: muss nicht unter `hidden md:block` liegen — sonst fehlen Dock + Zurück auf Mobile. */}
      <CornerDock />
    </>
  );
}
