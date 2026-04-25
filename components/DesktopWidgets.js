"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktop } from "@/context/DesktopContext";
import { SlideshowWidget } from "@/components/SlideshowWidget";

const WIDGET_W = 340;
const WIDGET_H = WIDGET_W;
/** Hintere Karten: Versatz nach oben/rechts (wie Referenz-UI). */
const STACK_OFFSET_PX = 14;
/** Stapel-Wechsel: kurzer Hub — vordere Karte weicht seitlich leicht aus. */
const STACK_DEAL_EXIT_MS = 155;
/** Gleichmäßige Weg-Geschwindigkeit (Bezier-Kurven wirken oft „langsam–schnell“). */
const STACK_DEAL_EASE_TRANSFORM = "linear";
/** Medien-Inhalt: aus der Mitte „explodieren“ (scale), kein Opacity-Fade. */
const STACK_DEAL_REAR_REVEAL_MS = 165;
const STACK_DEAL_FRONT_REVEAL_MS = 195;
const STACK_DEAL_REVEAL_FROM_SCALE = 0.12;
/** Leichter Überschwung am Ende (Out-Back-artig). */
const STACK_DEAL_REVEAL_EASE = "cubic-bezier(0.175, 0.88, 0.32, 1.12)";
const STACK_DEAL_FLY_X = 32;
const STACK_DEAL_FLY_Y = -7;

function stackPadForWidgetIds(widgetIds, desktopWidgets) {
  const w0 = desktopWidgets.find((x) => x.id === widgetIds[0]);
  if (!w0 || w0.kind !== "slideshow") return 0;
  const key = desktopPositionKey(w0);
  const n = desktopWidgets.filter(
    (x) => x.kind === "slideshow" && desktopPositionKey(x) === key
  ).length;
  /* Visuell nur eine Kachel hinter dem vorderen Widget — ein Versatz. */
  return n > 1 ? STACK_OFFSET_PX : 0;
}

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

function desktopPositionKey(w) {
  const d = w.desktop;
  if (
    typeof d?.xp === "number" &&
    Number.isFinite(d.xp) &&
    typeof d?.yp === "number" &&
    Number.isFinite(d.yp)
  ) {
    return `f:${d.xp.toFixed(4)},${d.yp.toFixed(4)}`;
  }
  if (
    typeof d?.x === "number" &&
    Number.isFinite(d.x) &&
    typeof d?.y === "number" &&
    Number.isFinite(d.y)
  ) {
    return `p:${Math.round(d.x)},${Math.round(d.y)}`;
  }
  return `solo:${w.id}`;
}

/** Slideshow-Widgets an gleicher Desktop-Position → ein Stapel. */
function groupDesktopWidgets(widgets) {
  const map = new Map();
  for (const w of widgets) {
    if (w.kind !== "slideshow") continue;
    const k = desktopPositionKey(w);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(w);
  }
  const out = [];
  for (const [, list] of map) {
    list.sort((a, b) => a.id.localeCompare(b.id));
    out.push(list);
  }
  out.sort((a, b) => a[0].id.localeCompare(b[0].id));
  return out;
}

/** Leere Kachel für den Stapel (Ruhezustand); Inhalt nur während des Wechsels. */
function WidgetStackBackPlate() {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border-[2.25px] border-black bg-white shadow-none"
      aria-hidden
    />
  );
}

/**
 * @param {{
 *   widgets: import('@/lib/desktopWidgets').DesktopSlideshowWidget[],
 *   layout: 'desktop' | 'mobile',
 *   pos?: { x: number, y: number },
 *   layerTopPx?: number,
 *   onPointerDownStack?: (e: React.PointerEvent, ids: string[]) => void,
 * }} props
 */
function WidgetStack({
  widgets,
  layout,
  pos,
  layerTopPx = 0,
  onPointerDownStack,
}) {
  const { desktopWidgetStacksCollapsed } = useDesktop();
  const [frontIndex, setFrontIndex] = useState(0);
  const [stackDealPhase, setStackDealPhase] = useState(
    /** @type {'idle' | 'exit'} */ ("idle")
  );
  const [dealDir, setDealDir] = useState(1);
  const [reduceStackMotion, setReduceStackMotion] = useState(false);
  const dealDirRef = useRef(1);
  const stackPhaseRef = useRef(/** @type {'idle' | 'exit'} */ ("idle"));
  stackPhaseRef.current = stackDealPhase;
  const n = widgets.length;

  useEffect(() => {
    setFrontIndex((i) => Math.min(i, Math.max(0, n - 1)));
    setStackDealPhase("idle");
  }, [n]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceStackMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const requestStackDeal = useCallback(
    (dir) => {
      if (n <= 1) return;
      if (reduceStackMotion) {
        setFrontIndex((j) =>
          dir === 1 ? (j + 1) % n : (j - 1 + n) % n
        );
        return;
      }
      if (stackPhaseRef.current !== "idle") return;
      dealDirRef.current = dir;
      setDealDir(dir);
      setStackDealPhase("exit");
    },
    [n, reduceStackMotion]
  );

  const onStackFrontTransitionEnd = useCallback(
    (e) => {
      if (e.propertyName !== "transform") return;
      if (e.target !== e.currentTarget) return;
      if (stackDealPhase === "exit") {
        const d = dealDirRef.current;
        setFrontIndex((j) =>
          d === 1 ? (j + 1) % n : (j - 1 + n) % n
        );
        setStackDealPhase("idle");
      }
    },
    [stackDealPhase, n]
  );

  const stackNavigation = useMemo(
    () => ({
      onNext: () => requestStackDeal(1),
      onPrev: () => requestStackDeal(-1),
      locked: stackDealPhase !== "idle",
    }),
    [requestStackDeal, stackDealPhase]
  );

  const ids = useMemo(() => widgets.map((w) => w.id), [widgets]);

  const isDesktop = layout === "desktop";
  /** Nur eine Kachel hinter dem aktiven Widget (nächstes im Zyklus); gleicher Versatz wie früher bei 2 Ebenen. */
  const showBack = n > 1;
  const stackPad = showBack ? STACK_OFFSET_PX : 0;
  const frontWidget = widgets[frontIndex];
  /** Nur während exit: die eintreffende Karte (Ruhe: hintere Kachel bleibt leer). */
  const rearIncomingWidget =
    showBack && stackDealPhase === "exit"
      ? widgets[(frontIndex + dealDir + n) % n]
      : null;

  const [rearMediaPopped, setRearMediaPopped] = useState(false);
  const [frontMediaPopped, setFrontMediaPopped] = useState(true);
  const stackPhaseForRevealRef = useRef(stackDealPhase);

  useLayoutEffect(() => {
    if (!rearIncomingWidget) {
      setRearMediaPopped(false);
      return;
    }
    if (reduceStackMotion) {
      setRearMediaPopped(true);
      return;
    }
    setRearMediaPopped(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setRearMediaPopped(true));
    });
    return () => cancelAnimationFrame(id);
  }, [rearIncomingWidget, reduceStackMotion]);

  useLayoutEffect(() => {
    const prev = stackPhaseForRevealRef.current;
    if (reduceStackMotion) {
      stackPhaseForRevealRef.current = stackDealPhase;
      setFrontMediaPopped(true);
      return;
    }
    if (prev === "exit" && stackDealPhase === "idle") {
      setFrontMediaPopped(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setFrontMediaPopped(true));
      });
      stackPhaseForRevealRef.current = stackDealPhase;
      return () => cancelAnimationFrame(id);
    }
    stackPhaseForRevealRef.current = stackDealPhase;
  }, [stackDealPhase, reduceStackMotion]);

  const outerStyle = isDesktop
    ? {
        left: pos?.x ?? 0,
        top: (pos?.y ?? 0) + layerTopPx - stackPad,
        width: WIDGET_W + stackPad,
        height: WIDGET_H + stackPad,
      }
    : showBack
      ? {
          paddingTop: stackPad,
          paddingRight: stackPad,
          boxSizing: "border-box",
        }
      : undefined;

  const stackCollapseCls = desktopWidgetStacksCollapsed
    ? "pointer-events-none scale-0 opacity-0"
    : "scale-100 opacity-100";
  const outerClass = isDesktop
    ? `pointer-events-auto absolute origin-center overflow-visible transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${stackCollapseCls}`
    : `pointer-events-auto relative ml-auto aspect-[3/2] w-[75%] max-w-full shrink-0 overflow-visible transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${stackCollapseCls}`;

  const innerStyle = isDesktop
    ? {
        position: "relative",
        width: WIDGET_W + stackPad,
        height: stackPad + WIDGET_H,
      }
    : { position: "relative", width: "100%", height: "100%" };

  const stackFrontMotionStyle = useMemo(() => {
    if (reduceStackMotion) {
      return { transform: "none", transition: "none" };
    }
    const flySign = dealDir === 1 ? 1 : -1;
    const exitTransform = `translate(${STACK_OFFSET_PX + flySign * STACK_DEAL_FLY_X}px, ${-STACK_OFFSET_PX + STACK_DEAL_FLY_Y}px)`;
    if (stackDealPhase === "idle") {
      return { transform: "none", transition: "none" };
    }
    return {
      transform: exitTransform,
      transition: `transform ${STACK_DEAL_EXIT_MS}ms ${STACK_DEAL_EASE_TRANSFORM}`,
      willChange: "transform",
    };
  }, [stackDealPhase, dealDir, reduceStackMotion]);

  const stackRearMotionStyle = useMemo(() => {
    const tucked = `translate(${STACK_OFFSET_PX}px, ${-STACK_OFFSET_PX}px)`;
    if (reduceStackMotion) {
      return { transform: tucked, transition: "none" };
    }
    if (stackDealPhase === "idle") {
      return { transform: tucked, transition: "none" };
    }
    return {
      transform: "translate(0,0)",
      transition: `transform ${STACK_DEAL_EXIT_MS}ms ${STACK_DEAL_EASE_TRANSFORM}`,
      willChange: "transform",
    };
  }, [stackDealPhase, reduceStackMotion]);

  const stackFrontPointerEvents =
    stackDealPhase !== "idle" ? "none" : "auto";

  const rearStackMediaReveal =
    reduceStackMotion || !rearIncomingWidget
      ? null
      : {
          popped: rearMediaPopped,
          fromScale: STACK_DEAL_REVEAL_FROM_SCALE,
          durationMs: STACK_DEAL_REAR_REVEAL_MS,
          easing: STACK_DEAL_REVEAL_EASE,
        };

  const frontStackMediaReveal = reduceStackMotion
    ? null
    : {
        popped: frontMediaPopped,
        fromScale: STACK_DEAL_REVEAL_FROM_SCALE,
        durationMs: STACK_DEAL_FRONT_REVEAL_MS,
        easing: STACK_DEAL_REVEAL_EASE,
      };

  return (
    <div className={outerClass} style={outerStyle}>
      <div className="overflow-visible" style={innerStyle}>
        {showBack ? (
          <div
            className={`pointer-events-none absolute left-0 box-border ${
              isDesktop ? "" : "top-0 h-full w-full"
            }`}
            style={
              isDesktop
                ? {
                    top: stackPad,
                    zIndex: 99,
                    width: WIDGET_W,
                    height: WIDGET_H,
                  }
                : {
                    zIndex: 99,
                  }
            }
          >
            <div
              className="relative h-full w-full"
              style={stackRearMotionStyle}
            >
              {rearIncomingWidget ? (
                <SlideshowWidget
                  key={rearIncomingWidget.id}
                  widget={rearIncomingWidget}
                  layout={layout}
                  stackDeckLayer
                  stackMediaReveal={rearStackMediaReveal}
                />
              ) : (
                <WidgetStackBackPlate />
              )}
            </div>
          </div>
        ) : null}
        <div
          className={`absolute left-0 box-border ${
            isDesktop ? "" : "top-0 h-full w-full"
          }`}
          style={
            isDesktop
              ? {
                  top: stackPad,
                  zIndex: 100,
                  width: WIDGET_W,
                  height: WIDGET_H,
                  pointerEvents: stackFrontPointerEvents,
                }
              : {
                  zIndex: 100,
                  pointerEvents: stackFrontPointerEvents,
                }
          }
        >
          <div
            className="relative h-full w-full"
            style={stackFrontMotionStyle}
            onTransitionEnd={
              reduceStackMotion ? undefined : onStackFrontTransitionEnd
            }
          >
            <SlideshowWidget
              widget={frontWidget}
              layout={layout}
              stackNavigation={stackNavigation}
              stackMediaReveal={frontStackMediaReveal}
              dragHandleProps={
                isDesktop && onPointerDownStack
                  ? {
                      onPointerDown: (e) => onPointerDownStack(e, ids),
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mobile: Slideshow über dem Icon-Raster — in DesktopIcons als erste Zeile einbinden. */
export function DesktopWidgetsMobile() {
  const { desktopWidgets } = useDesktop();
  const groups = useMemo(
    () => groupDesktopWidgets(desktopWidgets),
    [desktopWidgets]
  );

  return (
    <div className="pointer-events-auto z-[2] w-full shrink-0 px-1 pb-2 pt-1 min-[400px]:px-2">
      {groups.map((group) =>
        group.length === 1 ? (
          <SlideshowWidget
            key={group[0].id}
            widget={group[0]}
            layout="mobile"
          />
        ) : (
          <WidgetStack
            key={group.map((w) => w.id).join("|")}
            widgets={group}
            layout="mobile"
          />
        )
      )}
    </div>
  );
}

export function DesktopWidgets() {
  const {
    desktopWidgets,
    setDesktopWidgetPositionsForIds,
    desktopWidgetStacksCollapsed,
  } = useDesktop();
  const [layerMetrics, setLayerMetrics] = useState({
    top: 0,
    w: 0,
    h: 0,
  });
  const desktopRef = useRef(null);
  const dragRef = useRef(null);

  const groups = useMemo(
    () => groupDesktopWidgets(desktopWidgets),
    [desktopWidgets]
  );

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
      setDesktopWidgetPositionsForIds(d.widgetIds, c.x, c.y);
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
  }, [clamp, layerMetrics, setDesktopWidgetPositionsForIds]);

  const onPointerDown = useCallback(
    (e, widgetIds) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (t instanceof Element && t.closest("[data-mm-widget-no-drag]")) {
        return;
      }
      const el = desktopRef.current;
      if (!el) return;
      const w = desktopWidgets.find((x) => x.id === widgetIds[0]);
      if (!w) return;
      const raw = w.desktop;
      const rect = el.getBoundingClientRect();
      const pos = widgetToPixelPosition(raw, layerMetrics.w, layerMetrics.h);
      const { top: layerTop } = layerMetrics;
      const stackPad = stackPadForWidgetIds(widgetIds, desktopWidgets);
      const topPx = pos.y + layerTop - stackPad;
      dragRef.current = {
        widgetIds,
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

  const stackCollapseCls = desktopWidgetStacksCollapsed
    ? "pointer-events-none scale-0 opacity-0"
    : "scale-100 opacity-100";

  return (
    <div
      ref={desktopRef}
      className="pointer-events-none absolute left-0 right-0 z-[2] hidden md:block overflow-visible"
      style={{
        top: layerTopPx ? -layerTopPx : 0,
        height: layerTopPx ? `calc(100% + ${layerTopPx}px)` : "100%",
      }}
    >
      {groups.map((group) => {
        const raw = group[0].desktop;
        const pos = widgetToPixelPosition(
          raw,
          layerMetrics.w,
          layerMetrics.h
        );
        const key = group.map((w) => w.id).join("|");

        if (group.length === 1) {
          const w = group[0];
          return (
            <div
              key={w.id}
              className={`pointer-events-auto absolute origin-center transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${stackCollapseCls}`}
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
                  onPointerDown: (e) => onPointerDown(e, [w.id]),
                }}
              />
            </div>
          );
        }

        return (
          <WidgetStack
            key={key}
            widgets={group}
            layout="desktop"
            pos={pos}
            layerTopPx={layerTopPx}
            onPointerDownStack={onPointerDown}
          />
        );
      })}
    </div>
  );
}
