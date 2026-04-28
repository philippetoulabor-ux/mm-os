"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getDesktopContentRect,
  getDesktopWindowLayoutLimits,
  MEDIA_MINIMIZE_INSET_X,
  useDesktop,
} from "@/context/DesktopContext";
import { AppContent } from "@/components/AppContent";
import { WidgetChromeArrowButton } from "@/components/SlideshowWidget";
import { APPS } from "@/lib/apps";
import { clampAspectWindowBounds } from "@/lib/osWindowBounds";

/** Über Schreibtisch-Icons/Widgets (`z` 1–2); `win.z` bleibt die relative Reihenfolge. */
const OS_WINDOW_Z_BASE = 100;

/** Mobile Finder: vertikales Wischen groß/klein (nicht mit horizontalem Raster verwechseln). */
const FINDER_MOBILE_SWIPE_AXIS_LOCK_PX = 14;
const FINDER_MOBILE_SWIPE_VERT_DOMINANCE = 1.28;
const FINDER_MOBILE_SWIPE_MIN_DIST_PX = 48;
const FINDER_MOBILE_SWIPE_MAX_MS = 580;
const FINDER_MOBILE_SWIPE_PREVENT_DEFAULT_MIN_PX = 22;
/**
 * @param {object} rs resizeState mit startWinX, startWinY, startW, startH, edge
 * @param {{ rw: number, rh: number }} aspect Inhalts-Seitenverhältnis (Breite/Höhe ohne Titelleiste)
 */
/** Inhalts-Seitenverhältnis: Medien-Intrinsic oder aktuelle Fensterfläche unter der Titelleiste. */
function getEffectiveContentAspect(win, titlebarH) {
  const ca = win.contentAspect;
  if (ca && ca.rw > 0 && ca.rh > 0) return { rw: ca.rw, rh: ca.rh };
  const rh = Math.max(1, win.h - titlebarH);
  return { rw: Math.max(1, win.w), rh };
}

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

function useIsMobileLayout() {
  const [isMobile, setIsMobile] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isMobile;
}

export function OSWindow({ win }) {
  const {
    closeWindow,
    focusWindow,
    focusFinderWindow,
    moveWindow,
    setWindowBounds,
    toggleMediaPlayerVideoPanel,
    toggleAssetWidgetChromeFullscreen,
    minWindowW,
    minWindowH,
    osTitlebarH,
    finderProjectAppId,
    finderTabAppIds,
    finderClassicSearchExpanded,
    expandFinderClassicSearch,
    finderProjectSearchStripExpanded,
    expandFinderProjectSearchStrip,
    finderGoHome,
    setFinderTitlebarSearchSlotEl,
    collapseFinderClassicSearch,
    collapseFinderProjectSearchStrip,
    toggleFinderMobileExpanded,
  } = useDesktop();

  const isMobile = useIsMobileLayout();

  const isFinderClassicHome =
    win.appId === "finder" &&
    finderProjectAppId === null &&
    finderTabAppIds.length === 0;
  const finderShowTitlebarLupe =
    win.appId === "finder" &&
    !isMobile &&
    ((isFinderClassicHome && !finderClassicSearchExpanded) ||
      (!isFinderClassicHome && !finderProjectSearchStripExpanded));

  /** Mobile: Titelleiste + gescrollter Inhalt — unabhängig vom Media-„Mini“-Modus (Desktop). */
  const useMobileUnifiedChrome = isMobile && win.appId !== "notes";

  const appMeta = APPS[win.appId];
  const mobileAssetFolderChromeDir =
    useMobileUnifiedChrome && appMeta?.assetDir ? appMeta.assetDir : null;

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeState = useRef(null);
  const finderShellRef = useRef(null);
  const finderMobileScrollRef = useRef(null);
  const finderExpandedRef = useRef(false);
  finderExpandedRef.current =
    win.appId === "finder" && !!win.finderMobileExpanded;
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

  /** Vertikales Wischen: nur Karte → groß (nach oben); Schließen per Wischen nach unten absichtlich nicht. */
  useEffect(() => {
    if (!isMobile || win.appId !== "finder" || win.minimized) return undefined;
    const shell = finderShellRef.current;
    if (!shell) return undefined;

    let tr = null;

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) {
        tr = null;
        return;
      }
      const t0 = e.touches[0];
      const el = t0.target;
      if (
        el instanceof Element &&
        (el.closest("[data-mm-finder-expand-toggle]") ||
          el.closest("[data-mm-finder-project-back]"))
      ) {
        tr = null;
        return;
      }
      tr = {
        sx: t0.clientX,
        sy: t0.clientY,
        t0:
          typeof performance !== "undefined" ? performance.now() : Date.now(),
        axis: null,
      };
    };

    const onTouchMove = (e) => {
      if (!tr || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - tr.sx;
      const dy = t.clientY - tr.sy;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (!tr.axis && (ax > FINDER_MOBILE_SWIPE_AXIS_LOCK_PX || ay > FINDER_MOBILE_SWIPE_AXIS_LOCK_PX)) {
        if (ax > ay * FINDER_MOBILE_SWIPE_VERT_DOMINANCE) {
          tr = null;
          return;
        }
        if (ay > ax * FINDER_MOBILE_SWIPE_VERT_DOMINANCE) {
          tr.axis = "v";
        }
      }
      if (
        tr.axis === "v" &&
        ay > FINDER_MOBILE_SWIPE_PREVENT_DEFAULT_MIN_PX &&
        !finderExpandedRef.current
      ) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e) => {
      const saved = tr;
      tr = null;
      if (!saved || saved.axis !== "v") return;
      if (e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dy = t.clientY - saved.sy;
      const t1 =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (t1 - saved.t0 > FINDER_MOBILE_SWIPE_MAX_MS) return;
      const expanded = finderExpandedRef.current;
      if (!expanded && dy <= -FINDER_MOBILE_SWIPE_MIN_DIST_PX) {
        toggleFinderMobileExpanded();
      }
    };

    shell.addEventListener("touchstart", onTouchStart, { passive: true });
    shell.addEventListener("touchmove", onTouchMove, { passive: false });
    shell.addEventListener("touchend", onTouchEnd, { passive: true });
    shell.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      shell.removeEventListener("touchstart", onTouchStart);
      shell.removeEventListener("touchmove", onTouchMove);
      shell.removeEventListener("touchend", onTouchEnd);
      shell.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [
    isMobile,
    win.appId,
    win.minimized,
    mounted,
    toggleFinderMobileExpanded,
  ]);

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

  const onFinderHeaderMouseDown = useCallback(
    (e) => {
      const el = e.target;
      if (
        el instanceof Element &&
        (el.closest("button") ||
          el.closest("input") ||
          el.closest("textarea") ||
          el.closest("select") ||
          el.closest("label"))
      ) {
        return;
      }
      onBarMouseDown(e);
    },
    [onBarMouseDown]
  );

  /** Fenster nach vorne: nur in der Capture-Phase von `click` — nicht bei `mousedown`, sonst Re-Render vor `mouseup`/`click` und der erste Klick auf Finder-Inhalt geht verloren. */
  const onShellClickCapture = useCallback(
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      focusWindow(win.id);
    },
    [focusWindow, win.id]
  );

  const onResizePointerDown = useCallback(
    (e, edge) => {
      if (win.maximized) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
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
        contentAspect: getEffectiveContentAspect(win, osTitlebarH),
      };

      const target = e.currentTarget;
      const pointerId = e.pointerId;

      const onMove = (moveEvent) => {
        const rs = resizeState.current;
        if (!rs) return;
        const dx = moveEvent.clientX - rs.startX;
        const dy = moveEvent.clientY - rs.startY;

        const aspect = rs.contentAspect;
        if (
          aspect?.rw > 0 &&
          aspect?.rh > 0 &&
          typeof minWindowW === "number" &&
          typeof minWindowH === "number"
        ) {
          const raw = computeAspectResizeBounds(
            rs,
            dx,
            dy,
            aspect,
            osTitlebarH
          );
          if (!raw) return;
          const limits = getDesktopWindowLayoutLimits();
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
            limits
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
        setBoundsInteraction(false);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          /* ignore */
        }
      };

      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    },
    [win, osTitlebarH, focusWindow, setWindowBounds, minWindowW, minWindowH]
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || win.maximized) return;
      const nx = e.clientX - dragOffset.current.x;
      const ny = e.clientY - dragOffset.current.y;
      const { w: dW, h: dH } = getDesktopContentRect();
      const {
        desktopW,
        inset,
        minLayerY,
        maxBottomLayer,
      } = getDesktopWindowLayoutLimits();
      const px = MEDIA_MINIMIZE_INSET_X;
      let maxX;
      let maxY;
      if (win.appId === "media" && win.mediaVideoCollapsed) {
        maxX = dW - win.w - px;
        maxY = dH - win.h - inset;
      } else {
        maxX = desktopW - win.w - inset;
        maxY = maxBottomLayer - win.h;
      }
      moveWindow(
        win.id,
        Math.max(inset, Math.min(nx, maxX)),
        Math.max(minLayerY, Math.min(ny, maxY))
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
  ]);

  if (!mounted || win.minimized) return null;

  const style = {
    left: win.x,
    top: win.y,
    width: win.w,
    height: win.h,
    zIndex: OS_WINDOW_Z_BASE + win.z,
    ...(mounted && !boundsInteraction
      ? {
          transitionProperty: "width, height, left, top",
          transitionDuration: "var(--mm-library-motion-duration)",
          transitionTimingFunction: "var(--mm-library-motion-easing)",
        }
      : {}),
  };

  const appAllowsResize = APPS[win.appId]?.resizable !== false;
  const isWidgetChromeAsset =
    win.appId === "assetFile" &&
    win.assetFile?.widgetChrome &&
    !isMobile;
  const showResize =
    appAllowsResize &&
    !win.maximized &&
    !(win.appId === "media" && win.mediaVideoCollapsed) &&
    !isWidgetChromeAsset;
  const edge = "absolute z-[60] touch-none";
  const corner = "absolute z-[70] h-4 w-4 touch-none";

  return (
    <div
      ref={win.appId === "finder" && isMobile ? finderShellRef : undefined}
      className={`absolute flex flex-col overflow-hidden mm-os-paint-stroke bg-white shadow-[0_12px_36px_rgba(0,0,0,0.14)] ${
        win.maximized && !(isMobile && win.mobileImmersive)
          ? "rounded-none"
          : "rounded-lg"
      }`}
      style={style}
      onClickCapture={onShellClickCapture}
    >
      {isWidgetChromeAsset ? (
        <div
          className={`absolute left-2 top-2 z-30 flex items-center gap-1 ${
            win.assetFile?.widgetChromeFullscreen ? "flex-row" : "flex-col"
          }`}
        >
          <button
            type="button"
            data-mm-widget-no-drag
            aria-label={
              win.assetFile?.widgetChromeFullscreen
                ? "Vollbild beenden"
                : "Schließen"
            }
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent transition duration-200 ease-out opacity-50 hover:opacity-100 focus-visible:opacity-100 active:scale-95 active:opacity-100"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (win.assetFile?.widgetChromeFullscreen) {
                toggleAssetWidgetChromeFullscreen(win.id);
              } else {
                closeWindow(win.id);
              }
            }}
          >
            <span
              className={`block h-3 w-3 shrink-0 rounded-full ${
                win.assetFile?.widgetChromeFullscreen
                  ? "bg-[rgb(255,204,0)]"
                  : "bg-[rgb(255,0,0)]"
              }`}
              aria-hidden
            />
          </button>
          {!win.assetFile?.widgetChromeFullscreen ? (
            <button
              type="button"
              data-mm-widget-no-drag
              aria-label="Vollbild"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent transition duration-200 ease-out opacity-50 hover:opacity-100 focus-visible:opacity-100 active:scale-95 active:opacity-100"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                toggleAssetWidgetChromeFullscreen(win.id);
              }}
            >
              <span
                className="block h-3 w-3 shrink-0 rounded-full bg-[rgb(0,255,0)]"
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      ) : null}
      {!isMobile ? (
        win.appId === "finder" ? (
          <div className="relative z-20 shrink-0 overflow-hidden bg-transparent transition-[height,min-height] duration-[var(--mm-library-motion-duration)] ease-[var(--mm-library-motion-easing)] h-10 has-[#finder-search]:h-[2.875rem] has-[#finder-search]:min-h-[2.875rem]">
            <header
              className="box-border flex h-full min-h-0 w-full cursor-default items-center overflow-hidden border-0 border-solid bg-transparent px-3 has-[#finder-search]:[&_img]:scale-[1.15] has-[#finder-search]:[&_img]:origin-center"
              onMouseDown={onFinderHeaderMouseDown}
            >
              <div className="flex h-full w-10 shrink-0 items-center justify-center pl-2">
                {finderShowTitlebarLupe ? (
                  <button
                    type="button"
                    className="group flex h-full w-4 shrink-0 cursor-pointer items-center justify-center rounded"
                    aria-label="Suche öffnen"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFinderClassicHome) {
                        expandFinderClassicSearch();
                      } else {
                        expandFinderProjectSearchStrip();
                      }
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/web/buttons/lupe.svg"
                      alt=""
                      aria-hidden
                      className="h-4 w-4 shrink-0 opacity-50 transition-[opacity,transform] duration-200 ease-out group-hover:scale-[1.15] group-hover:opacity-100"
                      draggable={false}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="group flex h-full w-4 shrink-0 cursor-pointer items-center justify-center rounded"
                    aria-label="Suche schließen"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFinderClassicHome) {
                        collapseFinderClassicSearch();
                      } else {
                        collapseFinderProjectSearchStrip();
                      }
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/web/buttons/lupe.svg"
                      alt=""
                      aria-hidden
                      className="h-4 w-4 shrink-0 opacity-50 transition-[opacity,transform] duration-[var(--mm-library-motion-duration)] ease-[var(--mm-library-motion-easing)] group-hover:opacity-100"
                      draggable={false}
                    />
                  </button>
                )}
              </div>
              <div
                ref={setFinderTitlebarSearchSlotEl}
                data-mm-finder-titlebar-search
                className="flex h-full min-h-0 min-w-0 flex-1 items-center px-1"
              />
              {!isFinderClassicHome ? (
                <div className="flex h-full w-10 shrink-0 items-center justify-end pr-0">
                  <button
                    type="button"
                    className="group flex h-full w-4 shrink-0 cursor-pointer items-center justify-center rounded"
                    aria-label="Zur Kachelansicht"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      finderGoHome();
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/web/buttons/kacheln.svg"
                      alt=""
                      aria-hidden
                      className="h-4 w-4 shrink-0 opacity-50 transition-[opacity,transform] duration-[var(--mm-library-motion-duration)] ease-[var(--mm-library-motion-easing)] group-hover:opacity-100"
                      draggable={false}
                    />
                  </button>
                </div>
              ) : null}
            </header>
          </div>
        ) : isWidgetChromeAsset ? null : (
          <header
            className="flex h-10 shrink-0 cursor-default items-center gap-2 border-0 border-solid border-white/10 mm-os-paint-stroke-b bg-[#050508] pl-0 pr-3 font-sans"
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
            <span className="flex-1 select-none text-center text-xs font-medium text-white [text-shadow:0_1.5px_0_rgba(0,0,0,0.5)]">
              {win.title}
            </span>
            <span className="w-14 shrink-0" aria-hidden />
          </header>
        )
      ) : null}
      <div
        className={
          useMobileUnifiedChrome
            ? "relative flex min-h-0 flex-1 flex-col overflow-hidden"
            : `flex min-h-0 flex-1 flex-col overflow-hidden${
                win.appId === "media" && win.mediaVideoCollapsed
                  ? " bg-[#050508]"
                  : ""
              }`
        }
      >
        {useMobileUnifiedChrome ? (
          <div
            ref={
              win.appId === "finder" && useMobileUnifiedChrome
                ? finderMobileScrollRef
                : undefined
            }
            className={`flex min-h-0 flex-1 flex-col pb-0 ${
              win.appId === "finder" && !win.finderMobileExpanded
                ? "overflow-hidden"
                : "overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]"
            }`}
          >
            <div className="flex min-h-full w-full flex-1 flex-col">
              <div
                className={`flex min-h-0 flex-1 flex-col ${
                  win.appId === "media"
                    ? "bg-[#050508]"
                    : win.appId === "finder" && !win.finderMobileExpanded
                      ? "pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
                      : win.appId === "finder"
                        ? ""
                        : "pt-[max(0.5rem,env(safe-area-inset-top,0px))]"
                }`}
              >
                <AppContent
                  unifiedParentScroll
                  finderMobileAllowsScroll={
                    win.appId !== "finder" || !!win.finderMobileExpanded
                  }
                  appId={win.appId}
                  assetFile={win.assetFile}
                  windowId={win.id}
                />
              </div>
              {win.appId !== "finder" ? (
                <div
                  className={`flex w-full min-w-0 items-center gap-2 z-20 shrink-0 border-t-2 border-black px-2 pb-[max(0.5rem,calc(env(safe-area-inset-bottom,0px)+var(--mm-vv-bottom-inset,0px)))] pt-2 ${
                    win.appId === "media"
                      ? "bg-[#050508]"
                      : "bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1 px-1 text-left">
                    <p
                      className={`truncate text-sm leading-tight ${
                        win.appId === "media"
                          ? "font-semibold leading-[1.3] tracking-[0.01em] text-white [text-shadow:0_2px_0_rgba(0,0,0,0.5)]"
                          : "font-medium text-zinc-900"
                      }`}
                    >
                      {win.title}
                    </p>
                    {mobileAssetFolderChromeDir ? (
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          win.appId === "media"
                            ? "text-zinc-400"
                            : "text-zinc-500"
                        }`}
                      >
                        <code
                          className={
                            win.appId === "media"
                              ? "text-zinc-400"
                              : "text-zinc-600"
                          }
                        >
                          /web/{mobileAssetFolderChromeDir}
                        </code>
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center self-center"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <WidgetChromeArrowButton
                      dir="left"
                      label="Zurück zum Finder-Projekt"
                      opaqueAlways
                      onClick={() => {
                        /** Nach dem Event — Fenster unmountet; vermeidet Click-/Portal-Warnungen wie im Finder. */
                        queueMicrotask(() => {
                          closeWindow(win.id);
                          focusFinderWindow();
                        });
                      }}
                    />
                  </div>
                </div>
              ) : (
                <span className="sr-only">{win.title}</span>
              )}
            </div>
          </div>
        ) : (
          <AppContent
            appId={win.appId}
            assetFile={win.assetFile}
            windowId={win.id}
            windowDragProps={
              isWidgetChromeAsset
                ? { onMouseDown: onBarMouseDown }
                : undefined
            }
          />
        )}
      </div>
      {showResize && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            className={`${edge} left-3 right-3 top-0 h-3 cursor-n-resize`}
            onPointerDown={(e) => onResizePointerDown(e, "n")}
          />
          <div
            role="separator"
            aria-orientation="horizontal"
            className={`${edge} bottom-0 left-3 right-3 h-3 cursor-ns-resize`}
            onPointerDown={(e) => onResizePointerDown(e, "s")}
          />
          <div
            role="separator"
            aria-orientation="vertical"
            className={`${edge} bottom-3 left-0 top-3 w-3 cursor-ew-resize`}
            onPointerDown={(e) => onResizePointerDown(e, "w")}
          />
          <div
            role="separator"
            aria-orientation="vertical"
            className={`${edge} bottom-3 right-0 top-3 w-3 cursor-ew-resize`}
            onPointerDown={(e) => onResizePointerDown(e, "e")}
          />
          <div
            className={`${corner} left-0 top-0 cursor-nw-resize`}
            aria-hidden
            onPointerDown={(e) => onResizePointerDown(e, "nw")}
          />
          <div
            className={`${corner} right-0 top-0 cursor-ne-resize`}
            aria-hidden
            onPointerDown={(e) => onResizePointerDown(e, "ne")}
          />
          <div
            className={`${corner} bottom-0 left-0 cursor-nesw-resize`}
            aria-hidden
            onPointerDown={(e) => onResizePointerDown(e, "sw")}
          />
          <div
            className={`${corner} bottom-0 right-0 cursor-nwse-resize`}
            aria-hidden
            onPointerDown={(e) => onResizePointerDown(e, "se")}
          />
        </>
      )}
    </div>
  );
}
