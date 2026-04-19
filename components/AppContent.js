"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import dynamic from "next/dynamic";
import {
  APPS,
  isDesktopAtDefaultLayout,
  webAssetAppId,
} from "@/lib/apps";
import {
  FINDER_BROWSE_FOLDER_ROWS,
  filterFinderSearchIndex,
} from "@/lib/finderSearch";
import {
  buildAssetFileTree,
  collectAssetTreeFlatRows,
} from "@/lib/assetManifestTree";
import { webAssetManifest } from "@/lib/webAssetManifest";
import { fileHref, isSlideImageFile as isPreviewImageFile } from "@/lib/webAssetUrls";
import { useDesktop } from "@/context/DesktopContext";
import { AppIcon } from "@/components/AppIcon";
import { resolveModelBackground } from "@/lib/model3dBackground";
import { WidgetChromeArrowButton } from "@/components/SlideshowWidget";

const NotesAppView = dynamic(
  () =>
    import("@/components/NotesAppView").then((m) => ({
      default: m.NotesAppView,
    })),
  {
    loading: () => (
      <div className="flex h-full min-h-[40vh] items-center justify-center bg-white text-sm text-zinc-500">
        …
      </div>
    ),
  }
);

const MediaAppView = dynamic(
  () =>
    import("@/components/MediaAppView").then((m) => ({
      default: m.MediaAppView,
    })),
  {
    loading: () => (
      <div className="flex h-full min-h-[40vh] items-center justify-center bg-white text-sm text-zinc-500">
        …
      </div>
    ),
  }
);

const Model3DViewer = dynamic(
  () =>
    import("@/components/Model3DViewer").then((m) => ({
      default: m.Model3DViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] w-full items-center justify-center bg-zinc-200 text-sm text-zinc-500">
        …
      </div>
    ),
  }
);
import { getWebAssetFolderPreviewHref } from "@/lib/webAssetFolderPreview";

function SettingsPanel({ windowId }) {
  const {
    darkMode,
    setDarkMode,
    folderPreview,
    setFolderPreview,
    resetDesktopIconPositions,
    desktopIconPositions,
    windows,
    closeAllTabs,
    fitWindowToContentSize,
  } = useDesktop();
  const cleanUpDesktopActive = isDesktopAtDefaultLayout(desktopIconPositions);
  const closeAllTabsActive = windows.length === 0;
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !windowId) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      const w = Math.ceil(r.width);
      const h = Math.ceil(r.height);
      if (w > 0 && h > 0) {
        fitWindowToContentSize(windowId, w, h, {
          lockAspectForResize: false,
        });
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [windowId, fitWindowToContentSize]);

  return (
    <div
      ref={rootRef}
      className="box-border w-max min-w-0 max-w-full space-y-4 bg-white p-4 text-sm text-zinc-800"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-zinc-600">DarkMode</span>
        <button
          type="button"
          role="switch"
          aria-checked={darkMode}
          aria-label="DarkMode"
          onClick={() => setDarkMode((d) => !d)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
            darkMode ? "bg-sky-600" : "bg-zinc-600"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
              darkMode ? "translate-x-5" : "translate-x-0"
            }`}
            aria-hidden
          />
        </button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-zinc-600">CleanUpDesktop</span>
        <button
          type="button"
          role="switch"
          aria-checked={cleanUpDesktopActive}
          aria-label="CleanUpDesktop"
          onClick={() => resetDesktopIconPositions()}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
            cleanUpDesktopActive ? "bg-sky-600" : "bg-zinc-600"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
              cleanUpDesktopActive ? "translate-x-5" : "translate-x-0"
            }`}
            aria-hidden
          />
        </button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-zinc-600">CloseAllTabs</span>
        <button
          type="button"
          role="switch"
          aria-checked={closeAllTabsActive}
          aria-label="CloseAllTabs"
          onClick={() => closeAllTabs()}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
            closeAllTabsActive ? "bg-sky-600" : "bg-zinc-600"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
              closeAllTabsActive ? "translate-x-5" : "translate-x-0"
            }`}
            aria-hidden
          />
        </button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-zinc-600">FolderPreview</span>
        <button
          type="button"
          role="switch"
          aria-checked={folderPreview}
          aria-label="FolderPreview"
          onClick={() => setFolderPreview((v) => !v)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
            folderPreview ? "bg-sky-600" : "bg-zinc-600"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
              folderPreview ? "translate-x-5" : "translate-x-0"
            }`}
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}

function fileIcon(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".stl")) return "🔷";
  if (/\.(glb|gltf)$/i.test(name)) return "🧊";
  if (lower.endsWith(".obj")) return "📦";
  if (/\.(mov|mp4|webm)$/i.test(name)) return "🎬";
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return "🖼";
  if (/\.pdf$/i.test(name)) return "📕";
  return "📄";
}

/** z. B. `candle.glb` → `.glb`; ohne gültige Endung → `null`. */
function fileExtensionDisplay(name) {
  const i = name.lastIndexOf(".");
  if (i < 0 || i >= name.length - 1) return null;
  return name.slice(i).toLowerCase();
}

/** PDF im iframe: Toolbar aus; view=FitH = Seite an Breite anpassen (skaliert mit Fenster/iframe, v. a. Chromium). */
function assetIframeSrc(file, url) {
  if (!/\.pdf$/i.test(file)) return url;
  const params = "toolbar=0&view=FitH";
  return url.includes("#") ? `${url}&${params}` : `${url}#${params}`;
}

function isPreviewVideoFile(name) {
  return /\.(mov|mp4|webm)$/i.test(name);
}

/** Kleines Vorschaubild in der Ordnerliste (Bild/Video), sonst Typ-Emoji. */
function AssetFileListThumb({ href, file, fillContainer = false }) {
  const [imgFailed, setImgFailed] = useState(false);
  const videoRef = useRef(null);

  const mediaBox = fillContainer
    ? "h-full w-full min-h-0 min-w-0 shrink-0 rounded-sm border border-zinc-200 object-cover dark:border-zinc-600"
    : "h-11 w-11 shrink-0 rounded-sm border border-zinc-200 object-cover dark:border-zinc-600";
  const extBox = fillContainer
    ? "flex h-full w-full min-h-0 min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-zinc-200 bg-zinc-100 px-1 dark:border-zinc-600 dark:bg-zinc-800"
    : "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-zinc-200 bg-zinc-100 px-1 dark:border-zinc-600 dark:bg-zinc-800";

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isPreviewVideoFile(file)) return;
    const seek = () => {
      try {
        v.currentTime = 0.05;
      } catch {
        /* ignore */
      }
    };
    v.addEventListener("loadeddata", seek);
    return () => v.removeEventListener("loadeddata", seek);
  }, [href, file]);

  if (isPreviewImageFile(file) && !imgFailed) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt=""
          className={mediaBox}
          onError={() => setImgFailed(true)}
        />
      </>
    );
  }

  if (isPreviewVideoFile(file)) {
    return (
      <video
        ref={videoRef}
        src={href}
        muted
        playsInline
        preload="metadata"
        className={mediaBox}
        aria-hidden
      />
    );
  }

  const ext = fileExtensionDisplay(file);

  return (
    <span className={extBox} aria-hidden>
      {ext ? (
        <span className="max-w-full truncate text-center font-mono text-[15px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300">
          {ext}
        </span>
      ) : (
        <span className="text-lg leading-none">{fileIcon(file)}</span>
      )}
    </span>
  );
}

/** Normalisierte Breite/Höhe nur fürs Seitenverhältnis (iframe ohne echte Intrinsic-Größe). */
function iframeAspectHint(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return { w: 210, h: 297 };
  if (/\.(html|htm)$/i.test(name)) return { w: 16, h: 9 };
  if (/\.(stl|glb|gltf|obj)$/i.test(name)) return { w: 1, h: 1 };
  return { w: 4, h: 3 };
}

const ASSET_IMG_ZOOM_MIN = 1;
const ASSET_IMG_ZOOM_MAX = 4;
/** Horizontal + vertikal zwischen Assets (nur bei Zoom 1). */
const ASSET_SWIPE_MIN_DIST = 60;
/** Abgeschlossene Geste / preventDefault: strengere Dominanz. */
const ASSET_SWIPE_DOMINANCE = 1.2;
/** Frühe Achsenwahl nach Lock-Pixeln: etwas lockerer als Abschluss, damit die Achse zuverlässig greift. */
const ASSET_SWIPE_AXIS_CHOOSE_RATIO = 1.14;
const ASSET_SWIPE_MAX_MS = 700;
const ASSET_SWIPE_AXIS_LOCK_PX = 12;
/** Aktuelles Bild aus dem View; nächstes schiebt nach — kurz, damit die Kette lesbar bleibt */
const ASSET_SWIPE_EXIT_MS = 420;
const ASSET_SWIPE_ENTER_MS = 380;
const ASSET_SWIPE_SNAP_MS = 360;
const ASSET_SWIPE_EASE = "cubic-bezier(0.22, 0.99, 0.22, 1)";
const ASSET_SWIPE_EDGE_RESIST = 0.22;

function touchDistance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function clampAssetImagePan(scale, px, py, cw, ch, iw, ih) {
  if (scale <= ASSET_IMG_ZOOM_MIN || !cw || !ch || !iw || !ih) {
    return { x: 0, y: 0 };
  }
  const sw = iw * scale;
  const sh = ih * scale;
  const maxX = Math.max(0, (sw - cw) / 2);
  const maxY = Math.max(0, (sh - ch) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, px)),
    y: Math.min(maxY, Math.max(-maxY, py)),
  };
}

/** Pinch-Zoom + Pan; nur für Mobile-Asset-Layout. */
function AssetImageMobileZoom({
  url,
  alt,
  onLoad,
  className = "",
  onSwipePrevious,
  onSwipeNext,
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layoutTick, setLayoutTick] = useState(0);
  const [navOffset, setNavOffset] = useState({ x: 0, y: 0 });
  const [navTween, setNavTween] = useState(false);
  const [navTweenMs, setNavTweenMs] = useState(ASSET_SWIPE_EXIT_MS);
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef(null);
  const panTouchRef = useRef(null);
  const swipePrevRef = useRef(onSwipePrevious);
  const swipeNextRef = useRef(onSwipeNext);
  const swipeTrackRef = useRef(null);
  const navOffsetRef = useRef({ x: 0, y: 0 });
  const interactionLockRef = useRef(false);
  const pendingExitCallbackRef = useRef(null);
  const pendingEnterRef = useRef(null);

  useLayoutEffect(() => {
    scaleRef.current = scale;
    panRef.current = pan;
  });

  useLayoutEffect(() => {
    navOffsetRef.current = navOffset;
  });

  useLayoutEffect(() => {
    swipePrevRef.current = onSwipePrevious;
    swipeNextRef.current = onSwipeNext;
  });

  const handleNavTransitionEnd = useCallback((e) => {
    if (e.propertyName !== "transform") return;
    if (pendingExitCallbackRef.current) {
      const fn = pendingExitCallbackRef.current;
      pendingExitCallbackRef.current = null;
      fn();
      return;
    }
    interactionLockRef.current = false;
  }, []);

  useEffect(() => {
    setScale(ASSET_IMG_ZOOM_MIN);
    setPan({ x: 0, y: 0 });
    swipeTrackRef.current = null;

    const pe = pendingEnterRef.current;
    if (pe) {
      pendingEnterRef.current = null;
      const c = containerRef.current;
      const w = c?.clientWidth ?? 0;
      const h = c?.clientHeight ?? 0;
      let start = { x: 0, y: 0 };
      if (pe.axis === "h") {
        start = { x: pe.isNext ? w : -w, y: 0 };
      } else {
        start = { x: 0, y: pe.isNext ? h : -h };
      }
      interactionLockRef.current = true;
      setNavTween(false);
      setNavTweenMs(ASSET_SWIPE_ENTER_MS);
      setNavOffset(start);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setNavTween(true);
          setNavOffset({ x: 0, y: 0 });
        });
      });
    } else {
      setNavOffset({ x: 0, y: 0 });
      setNavTween(false);
    }
  }, [url]);

  const clampPanFromDom = useCallback((nextScale, px, py) => {
    const c = containerRef.current;
    const im = imgRef.current;
    if (!c || !im) return { x: 0, y: 0 };
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const iw = im.offsetWidth;
    const ih = im.offsetHeight;
    return clampAssetImagePan(nextScale, px, py, cw, ch, iw, ih);
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setLayoutTick((t) => t + 1);
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (scale <= ASSET_IMG_ZOOM_MIN) {
      setPan({ x: 0, y: 0 });
      return;
    }
    setPan((p) => clampPanFromDom(scale, p.x, p.y));
  }, [scale, clampPanFromDom, layoutTick]);

  const handleImgLoad = useCallback(
    (e) => {
      onLoad?.(e);
      setLayoutTick((t) => t + 1);
    },
    [onLoad]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const snapNavToOrigin = () => {
      const o = navOffsetRef.current;
      if (o.x === 0 && o.y === 0) return;
      interactionLockRef.current = true;
      setNavTweenMs(ASSET_SWIPE_SNAP_MS);
      setNavTween(true);
      setNavOffset({ x: 0, y: 0 });
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        swipeTrackRef.current = null;
        pinchRef.current = {
          d0: touchDistance(e.touches[0], e.touches[1]),
          scale0: scaleRef.current,
        };
        panTouchRef.current = null;
        return;
      }
      if (e.touches.length === 1 && interactionLockRef.current) {
        return;
      }
      if (e.touches.length === 1 && scaleRef.current > ASSET_IMG_ZOOM_MIN) {
        swipeTrackRef.current = null;
        const t = e.touches[0];
        panTouchRef.current = {
          startPan: { ...panRef.current },
          sx: t.clientX,
          sy: t.clientY,
        };
        pinchRef.current = null;
        return;
      }
      if (
        e.touches.length === 1 &&
        scaleRef.current <= ASSET_IMG_ZOOM_MIN &&
        (swipePrevRef.current || swipeNextRef.current)
      ) {
        const t = e.touches[0];
        swipeTrackRef.current = {
          sx: t.clientX,
          sy: t.clientY,
          t0:
            typeof performance !== "undefined"
              ? performance.now()
              : Date.now(),
          axis: null,
        };
        pinchRef.current = null;
        panTouchRef.current = null;
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const { d0, scale0 } = pinchRef.current;
        const d = touchDistance(e.touches[0], e.touches[1]);
        if (d0 < 1) return;
        const raw = scale0 * (d / d0);
        const next = Math.min(
          ASSET_IMG_ZOOM_MAX,
          Math.max(ASSET_IMG_ZOOM_MIN, raw)
        );
        setScale(next);
        return;
      }
      if (
        e.touches.length === 1 &&
        panTouchRef.current &&
        scaleRef.current > ASSET_IMG_ZOOM_MIN
      ) {
        e.preventDefault();
        const t = e.touches[0];
        const { startPan, sx, sy } = panTouchRef.current;
        const nx = startPan.x + (t.clientX - sx);
        const ny = startPan.y + (t.clientY - sy);
        setPan(clampPanFromDom(scaleRef.current, nx, ny));
        return;
      }
      if (
        e.touches.length === 1 &&
        swipeTrackRef.current &&
        scaleRef.current <= ASSET_IMG_ZOOM_MIN
      ) {
        const tr = swipeTrackRef.current;
        const t = e.touches[0];
        const dx = t.clientX - tr.sx;
        const dy = t.clientY - tr.sy;
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        if (!tr.axis) {
          if (
            ax > ASSET_SWIPE_AXIS_LOCK_PX ||
            ay > ASSET_SWIPE_AXIS_LOCK_PX
          ) {
            if (ax > ay * ASSET_SWIPE_AXIS_CHOOSE_RATIO) tr.axis = "h";
            else if (ay > ax * ASSET_SWIPE_AXIS_CHOOSE_RATIO) tr.axis = "v";
          }
        }
        if (tr.axis === "h") {
          let nx = dx;
          if (nx > 0 && !swipePrevRef.current) nx *= ASSET_SWIPE_EDGE_RESIST;
          if (nx < 0 && !swipeNextRef.current) nx *= ASSET_SWIPE_EDGE_RESIST;
          setNavTween(false);
          setNavOffset({ x: nx, y: 0 });
        } else if (tr.axis === "v") {
          let ny = dy;
          /* Nach oben = nächstes Bild, nach unten = vorheriges (wie ArrowDown / ArrowUp). */
          if (ny < 0 && !swipeNextRef.current) ny *= ASSET_SWIPE_EDGE_RESIST;
          if (ny > 0 && !swipePrevRef.current) ny *= ASSET_SWIPE_EDGE_RESIST;
          setNavTween(false);
          setNavOffset({ x: 0, y: ny });
        }
        if (
          ax > 12 &&
          ax > ay * ASSET_SWIPE_DOMINANCE
        ) {
          e.preventDefault();
        } else if (
          ay > 12 &&
          ay > ax * ASSET_SWIPE_DOMINANCE
        ) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) panTouchRef.current = null;

      if (e.type === "touchcancel" && swipeTrackRef.current) {
        swipeTrackRef.current = null;
        snapNavToOrigin();
        return;
      }

      if (
        e.changedTouches.length === 1 &&
        swipeTrackRef.current &&
        scaleRef.current <= ASSET_IMG_ZOOM_MIN
      ) {
        const tr = swipeTrackRef.current;
        const t = e.changedTouches[0];
        const dx = t.clientX - tr.sx;
        const dy = t.clientY - tr.sy;
        const t1 =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const dt = t1 - tr.t0;
        swipeTrackRef.current = null;

        if (dt > ASSET_SWIPE_MAX_MS) {
          snapNavToOrigin();
          return;
        }

        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        const horiz =
          ax >= ASSET_SWIPE_MIN_DIST &&
          ax > ay * ASSET_SWIPE_DOMINANCE;
        const vert =
          ay >= ASSET_SWIPE_MIN_DIST &&
          ay > ax * ASSET_SWIPE_DOMINANCE;

        if (!horiz && !vert) {
          snapNavToOrigin();
          return;
        }

        const reduceMotion =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (reduceMotion) {
          setNavTween(false);
          setNavOffset({ x: 0, y: 0 });
          if (horiz && !vert) {
            if (dx > 0) swipePrevRef.current?.();
            else swipeNextRef.current?.();
          } else if (vert && !horiz) {
            if (dy < 0) swipeNextRef.current?.();
            else swipePrevRef.current?.();
          } else if (horiz && vert) {
            if (ax >= ay) {
              if (dx > 0) swipePrevRef.current?.();
              else swipeNextRef.current?.();
            } else {
              if (dy < 0) swipeNextRef.current?.();
              else swipePrevRef.current?.();
            }
          }
          return;
        }

        const c = containerRef.current;
        const w = c?.clientWidth ?? 0;
        const h = c?.clientHeight ?? 0;
        let tx = 0;
        let ty = 0;
        if (horiz && !vert) {
          tx = dx > 0 ? w : -w;
        } else if (vert && !horiz) {
          /* Aktuelles Bild folgt dem Finger aus dem View: oben raus = next, unten raus = prev. */
          ty = dy < 0 ? -h : h;
        } else if (horiz && vert) {
          if (ax >= ay) tx = dx > 0 ? w : -w;
          else ty = dy < 0 ? -h : h;
        }

        const axis =
          horiz && vert ? (ax >= ay ? "h" : "v") : horiz ? "h" : "v";
        const isNext =
          horiz && vert
            ? ax >= ay
              ? dx < 0
              : dy < 0
            : horiz
              ? dx < 0
              : dy < 0;

        pendingExitCallbackRef.current = () => {
          pendingEnterRef.current = { axis, isNext };
          if (horiz && !vert) {
            if (dx > 0) swipePrevRef.current?.();
            else swipeNextRef.current?.();
          } else if (vert && !horiz) {
            if (dy < 0) swipeNextRef.current?.();
            else swipePrevRef.current?.();
          } else if (horiz && vert) {
            if (ax >= ay) {
              if (dx > 0) swipePrevRef.current?.();
              else swipeNextRef.current?.();
            } else {
              if (dy < 0) swipeNextRef.current?.();
              else swipePrevRef.current?.();
            }
          }
        };

        interactionLockRef.current = true;
        setNavTweenMs(ASSET_SWIPE_EXIT_MS);
        setNavTween(true);
        setNavOffset({ x: tx, y: ty });
      } else if (e.touches.length === 0) {
        swipeTrackRef.current = null;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [clampPanFromDom]);

  return (
    <div className={`relative min-h-0 w-full flex-1 ${className}`}>
      <div
        ref={containerRef}
        className="relative h-full min-h-0 w-full overflow-hidden"
        style={{
          touchAction: scale > ASSET_IMG_ZOOM_MIN ? "none" : "pan-y",
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          onTransitionEnd={handleNavTransitionEnd}
          style={{
            transform: `translate(${navOffset.x}px, ${navOffset.y}px)`,
            transition: navTween
              ? `transform ${navTweenMs}ms ${ASSET_SWIPE_EASE}`
              : "none",
            willChange: "transform",
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "center center",
            }}
            className="flex max-h-full max-w-full items-center justify-center will-change-transform"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={url}
              alt={alt}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
              onLoad={handleImgLoad}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Oberstes sichtbares Fenster (höchstes z), für Tastatur nur dort reagieren. */
function topVisibleWindowId(windows) {
  const visible = windows.filter((w) => !w.minimized);
  if (visible.length === 0) return null;
  return visible.reduce((a, b) => (a.z >= b.z ? a : b)).id;
}

/** Index der Datei in `files` (Manifest), tolerant bei Pfad-Varianten. */
function manifestFileIndex(files, file) {
  if (!files?.length) return -1;
  let i = files.indexOf(file);
  if (i >= 0) return i;
  const tail = file.includes("/") ? file.slice(file.lastIndexOf("/") + 1) : file;
  return files.findIndex((f) => f === tail || file.endsWith(f));
}

function AssetFileViewer({
  dir,
  file,
  basePath,
  windowId,
  unifiedParentScroll = false,
  /** Eingebettet im Finder: Pfeiltasten wechseln die Datei ohne Fenster-`windowId`. */
  onNavigateAdjacentFile,
  /** Desktop: gleicher Rahmen/Pfeile wie Slideshow-Widgets (vom Finder geöffnet). */
  widgetChrome = false,
  /** Titelleistenlos: zum Verschieben des OSWindow (nur mit `widgetChrome`). */
  windowDragProps,
}) {
  const {
    fitWindowToContentSize,
    setAssetFileForWindow,
    windows,
    closeWindow,
  } = useDesktop();
  const videoRef = useRef(null);
  const url = fileHref(basePath, dir, file);
  const manifestEntry = webAssetManifest.find((x) => x.dir === dir);
  const modelBg = resolveModelBackground(
    dir,
    file,
    manifestEntry?.files ?? [],
    basePath
  );

  const fitFromDimensions = useCallback(
    (w, h) => {
      if (widgetChrome) return;
      if (windowId) fitWindowToContentSize(windowId, w, h);
    },
    [windowId, fitWindowToContentSize, widgetChrome]
  );

  const onImgLoad = useCallback(
    (e) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      fitFromDimensions(naturalWidth, naturalHeight);
    },
    [fitFromDimensions]
  );

  const onVideoMeta = useCallback(
    (e) => {
      const v = e.currentTarget;
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        fitFromDimensions(v.videoWidth, v.videoHeight);
      }
    },
    [fitFromDimensions]
  );

  const onVideoClick = useCallback((e) => {
    const v = e.currentTarget;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  }, []);

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
  const isVideo = /\.(mov|mp4|webm)$/i.test(file);
  const is3d = /\.(stl|glb|gltf|obj)$/i.test(file);

  const manifestFiles = useMemo(
    () => manifestEntry?.files ?? [],
    [manifestEntry]
  );
  const assetIdx = manifestFileIndex(manifestFiles, file);

  const useWidgetChrome = widgetChrome && windowId && !unifiedParentScroll;

  const goPrevAsset = useCallback(() => {
    if (!windowId || manifestFiles.length < 2) return;
    const i = manifestFileIndex(manifestFiles, file);
    if (i < 0) return;
    const n = manifestFiles.length;
    const prev = i === 0 ? n - 1 : i - 1;
    setAssetFileForWindow(windowId, {
      dir,
      file: manifestFiles[prev],
      basePath,
    });
  }, [
    windowId,
    manifestFiles,
    file,
    dir,
    basePath,
    setAssetFileForWindow,
  ]);

  const goNextAsset = useCallback(() => {
    if (!windowId || manifestFiles.length < 2) return;
    const i = manifestFileIndex(manifestFiles, file);
    if (i < 0) return;
    const n = manifestFiles.length;
    const next = i >= n - 1 ? 0 : i + 1;
    setAssetFileForWindow(windowId, {
      dir,
      file: manifestFiles[next],
      basePath,
    });
  }, [
    windowId,
    manifestFiles,
    file,
    dir,
    basePath,
    setAssetFileForWindow,
  ]);

  useEffect(() => {
    if (!useWidgetChrome || !windowId) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        return;
      }
      e.preventDefault();
      closeWindow(windowId);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [useWidgetChrome, windowId, closeWindow]);

  const swipeToPrevImage =
    unifiedParentScroll &&
    windowId &&
    isImage &&
    assetIdx > 0
      ? () => {
          setAssetFileForWindow(windowId, {
            dir,
            file: manifestFiles[assetIdx - 1],
            basePath,
          });
        }
      : undefined;
  const swipeToNextImage =
    unifiedParentScroll &&
    windowId &&
    isImage &&
    assetIdx >= 0 &&
    assetIdx < manifestFiles.length - 1
      ? () => {
          setAssetFileForWindow(windowId, {
            dir,
            file: manifestFiles[assetIdx + 1],
            basePath,
          });
        }
      : undefined;

  useEffect(() => {
    if (!isVideo) return;
    const el = videoRef.current;
    if (!el) return;
    const p = el.play();
    if (p !== undefined && typeof p.catch === "function") p.catch(() => {});
  }, [isVideo, url]);

  useEffect(() => {
    if (widgetChrome || !windowId || isImage || isVideo || is3d) return;
    const { w, h } = iframeAspectHint(file);
    const isPdf = /\.pdf$/i.test(file);
    fitWindowToContentSize(windowId, w, h, {
      lockAspectForResize: !isPdf,
    });
  }, [
    widgetChrome,
    windowId,
    file,
    url,
    isImage,
    isVideo,
    is3d,
    fitWindowToContentSize,
  ]);

  useEffect(() => {
    const files = webAssetManifest.find((x) => x.dir === dir)?.files ?? [];
    if (files.length < 2) return;

    const onKeyDown = (e) => {
      if (
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight" &&
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown"
      ) {
        return;
      }
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        return;
      }
      if (t instanceof HTMLElement && t.isContentEditable) return;

      const topId = topVisibleWindowId(windows);
      if (onNavigateAdjacentFile) {
        const finderWin = windows.find(
          (w) => w.appId === "finder" && !w.minimized
        );
        if (!finderWin || finderWin.id !== topId) return;
      } else if (!windowId || topId !== windowId) {
        return;
      }

      const idx = manifestFileIndex(files, file);
      if (idx < 0) return;

      const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
      let next;
      if (widgetChrome && files.length > 1) {
        next = forward
          ? (idx + 1) % files.length
          : (idx - 1 + files.length) % files.length;
      } else {
        next = forward
          ? Math.min(files.length - 1, idx + 1)
          : Math.max(0, idx - 1);
        if (next === idx) return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (onNavigateAdjacentFile) {
        onNavigateAdjacentFile(forward);
      } else {
        setAssetFileForWindow(windowId, {
          dir,
          file: files[next],
          basePath,
        });
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    windowId,
    dir,
    file,
    basePath,
    windows,
    setAssetFileForWindow,
    onNavigateAdjacentFile,
    widgetChrome,
  ]);

  if (useWidgetChrome) {
    const n = manifestFiles.length;
    const canCycle = n > 1;

    const shell = (body) => (
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white md:cursor-grab md:active:cursor-grabbing"
        onMouseDown={windowDragProps?.onMouseDown}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden">{body}</div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-2 md:p-3">
          <div
            className="pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <WidgetChromeArrowButton
              dir="left"
              label="Vorherige Datei"
              disabled={!canCycle}
              onClick={goPrevAsset}
            />
          </div>
          <div
            className="pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <WidgetChromeArrowButton
              dir="right"
              label="Nächste Datei"
              disabled={!canCycle}
              onClick={goNextAsset}
            />
          </div>
        </div>
      </div>
    );

    if (is3d) {
      return shell(
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
          <Model3DViewer
            modelUrl={url}
            fileName={file}
            background={modelBg}
            windowId={windowId}
            unifiedParentScroll={false}
            lockWindowSize
          />
        </div>
      );
    }

    if (isImage) {
      return shell(
        <div className="flex h-full min-h-0 w-full items-center justify-center p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        </div>
      );
    }

    if (isVideo) {
      return shell(
        <div className="flex h-full min-h-0 w-full items-center justify-center bg-black p-1">
          <video
            ref={videoRef}
            src={url}
            autoPlay
            loop
            playsInline
            className="max-h-full max-w-full cursor-pointer"
            onLoadedMetadata={onVideoMeta}
            onClick={onVideoClick}
          />
        </div>
      );
    }

    return shell(
      <iframe
        title={file}
        src={assetIframeSrc(file, url)}
        className="min-h-0 w-full flex-1 border-0 bg-white dark:bg-zinc-950"
      />
    );
  }

  if (is3d) {
    return (
      <Model3DViewer
        modelUrl={url}
        fileName={file}
        background={modelBg}
        windowId={windowId}
        unifiedParentScroll={unifiedParentScroll}
      />
    );
  }

  if (isImage) {
    return (
      <div
        className={`flex w-full min-h-0 flex-col ${
          unifiedParentScroll
            ? // Viewport-Höhe minus Mobile-Chrome: Zentrierung bezieht sich auf den sichtbaren Screen, nicht auf einen hohen flex-1-Block
              "max-md:my-auto max-md:h-[calc(100dvh-5.75rem-env(safe-area-inset-top,0px)-var(--mm-vv-bottom-inset,0px))] max-md:max-h-[calc(100dvh-5.75rem-env(safe-area-inset-top,0px)-var(--mm-vv-bottom-inset,0px))] max-md:min-h-0 max-md:shrink-0 max-md:bg-transparent max-md:p-0 md:min-h-[50vh] md:items-center md:justify-center md:bg-zinc-200 md:p-2"
            : "h-full min-h-0 items-center justify-center overflow-auto bg-zinc-200 p-2"
        }`}
      >
        {unifiedParentScroll ? (
          <AssetImageMobileZoom
            url={url}
            alt={file}
            onLoad={onImgLoad}
            className="min-h-0"
            onSwipePrevious={swipeToPrevImage}
            onSwipeNext={swipeToNextImage}
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={file}
              className="max-h-full max-w-full object-contain"
              onLoad={onImgLoad}
            />
          </>
        )}
      </div>
    );
  }
  if (isVideo) {
    return (
      <div
        className={`flex items-center justify-center bg-black p-2 ${
          unifiedParentScroll
            ? "min-h-[50vh] w-full"
            : "h-full min-h-0"
        }`}
      >
        <video
          ref={videoRef}
          src={url}
          autoPlay
          loop
          playsInline
          className="max-h-full max-w-full cursor-pointer"
          onLoadedMetadata={onVideoMeta}
          onClick={onVideoClick}
        />
      </div>
    );
  }
  return (
    <div
      className={
        unifiedParentScroll
          ? "flex w-full min-h-[70vh] flex-none flex-col"
          : "flex min-h-0 w-full min-w-0 flex-1 flex-col"
      }
    >
      <iframe
        title={file}
        src={assetIframeSrc(file, url)}
        className={
          unifiedParentScroll
            ? "min-h-[70vh] w-full flex-none border-0 bg-white dark:bg-zinc-950"
            : "min-h-0 w-full flex-1 basis-0 border-0 bg-white dark:bg-zinc-950"
        }
      />
    </div>
  );
}

function finderFilePreviewHref(dir, file) {
  if (!dir || !file || !/\.(jpe?g|png|gif|webp)$/i.test(file)) return null;
  return `/web/${encodeURIComponent(dir)}/${encodeURIComponent(file)}`;
}

/** Wie `AssetFileListThumb`: Video-Frame als Miniatur in der Finder-Liste. */
function FinderFileVideoThumb({ href, file, tileSize = "list" }) {
  const videoRef = useRef(null);
  const box =
    tileSize === "grid"
      ? "h-14 w-14 shrink-0 rounded-lg object-cover"
      : "h-[37.5px] w-[37.5px] shrink-0 rounded-lg object-cover";

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isPreviewVideoFile(file)) return;
    const seek = () => {
      try {
        v.currentTime = 0.05;
      } catch {
        /* ignore */
      }
    };
    v.addEventListener("loadeddata", seek);
    return () => v.removeEventListener("loadeddata", seek);
  }, [href, file]);

  return (
    <video
      ref={videoRef}
      src={href}
      muted
      playsInline
      preload="metadata"
      className={box}
      aria-hidden
    />
  );
}

/** Wie `AssetFileListThumb` ohne Bild/Video: Endung im Kasten statt Emoji. */
function FinderFileFormatThumb({ file, tileSize = "list" }) {
  const ext = fileExtensionDisplay(file);
  const grid = tileSize === "grid";
  const box = grid
    ? "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-100 px-0.5 dark:border-zinc-600 dark:bg-zinc-800"
    : "flex h-[37.5px] w-[37.5px] shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-100 px-0.5 dark:border-zinc-600 dark:bg-zinc-800";
  const extClass = grid
    ? "max-w-full truncate text-center font-mono text-[13.5px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300"
    : "max-w-full truncate text-center font-mono text-[13px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300";
  const fallbackIcon = grid ? "text-base leading-none" : "text-xl leading-none";
  return (
    <span className={box} aria-hidden>
      {ext ? (
        <span className={extClass}>{ext}</span>
      ) : (
        <span className={fallbackIcon}>{fileIcon(file)}</span>
      )}
    </span>
  );
}

/**
 * Wie DesktopFolderIcon / Ordnerliste: Vorschaubild/Video bei FolderPreview,
 * sonst AppIcon bzw. Dateiendung wie in der Ordnerdateiliste (keine Typ-Emojis).
 */
function FinderListIcon({ row, folderPreview, tileSize = "list" }) {
  const app = row.appId ? APPS[row.appId] : null;
  const grid = tileSize === "grid";
  const imgBox = grid
    ? "h-14 w-14 shrink-0 rounded-lg object-cover"
    : "h-[37.5px] w-[37.5px] shrink-0 rounded-lg object-cover";
  const appBox = grid
    ? "inline-flex h-14 w-14 shrink-0 items-center justify-center"
    : "inline-flex h-[37.5px] w-[37.5px] shrink-0 items-center justify-center";
  const emojiBox = grid
    ? "inline-flex h-14 w-14 shrink-0 items-center justify-center text-2xl leading-none"
    : "inline-flex h-[37.5px] w-[37.5px] shrink-0 items-center justify-center text-2xl leading-none";
  const appIconVariant = grid ? "default" : "finderList";

  const folderPreviewHref =
    row.kind === "folder" && folderPreview && row.dir
      ? getWebAssetFolderPreviewHref(row.dir)
      : null;

  const fileImageHref =
    row.kind === "file" && folderPreview
      ? finderFilePreviewHref(row.dir, row.file)
      : null;

  const fileVideoHref =
    row.kind === "file" && folderPreview && isPreviewVideoFile(row.file)
      ? `/web/${encodeURIComponent(row.dir)}/${encodeURIComponent(row.file)}`
      : null;

  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [row.id, folderPreviewHref, fileImageHref]);

  if (row.kind === "app" && app) {
    return (
      <span className={appBox}>
        <AppIcon app={app} variant={appIconVariant} />
      </span>
    );
  }

  if (row.kind === "folder" && folderPreviewHref && !imgFailed) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={folderPreviewHref}
          alt=""
          className={imgBox}
          onError={() => setImgFailed(true)}
        />
      </>
    );
  }

  if (row.kind === "file" && fileImageHref && !imgFailed) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileImageHref}
          alt=""
          className={imgBox}
          onError={() => setImgFailed(true)}
        />
      </>
    );
  }

  if (row.kind === "file" && fileVideoHref) {
    return (
      <FinderFileVideoThumb
        href={fileVideoHref}
        file={row.file}
        tileSize={tileSize}
      />
    );
  }

  if (row.kind === "folder" && app) {
    return (
      <span className={appBox}>
        <AppIcon app={app} variant={appIconVariant} />
      </span>
    );
  }

  if (row.kind === "file") {
    return <FinderFileFormatThumb file={row.file} tileSize={tileSize} />;
  }

  return (
    <span className={emojiBox} aria-hidden>
      {row.icon}
    </span>
  );
}

const DESKTOP_MIN_WIDTH_FINDER_KB = 768;

/** Browse-Raster: Spalten (Tastatur-Pfeiltasten). */
const FINDER_BROWSE_GRID_COLS = 4;

/** Verhindert, dass Pfeiltasten die scrollbare Liste oder die Seite scrollen (Auswahl läuft separat). */
function blockArrowScrollOnRow(e, isDesktopKb) {
  if (!isDesktopKb) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
  }
}

/** Stream: große, durchlaufende Zeilen (Platzhalter — weiter ausbaubar). */
function FinderAssetStream({ dir, basePath, onOpenFile, unifiedParentScroll }) {
  const collapsedKeys = useMemo(() => new Set(), []);
  const entry = webAssetManifest.find((x) => x.dir === dir);
  const tree = useMemo(
    () => buildAssetFileTree(entry?.files ?? []),
    [entry]
  );
  const flatRows = useMemo(
    () => collectAssetTreeFlatRows(tree, dir, basePath, collapsedKeys),
    [tree, dir, basePath, collapsedKeys]
  );
  const files = flatRows.filter((r) => r.kind === "file");
  return (
    <ul
      className={
        unifiedParentScroll
          ? "space-y-4 p-2"
          : "min-h-0 flex-1 space-y-4 overflow-auto overscroll-contain p-2"
      }
    >
      {files.map((row) => (
        <li key={row.fullPath} className="list-none">
          <button
            type="button"
            onClick={() =>
              onOpenFile({
                dir: row.dir,
                file: row.fullPath,
                basePath: row.basePath,
              })
            }
            className="flex w-full min-w-0 items-center gap-3 rounded-sm border-0 bg-white p-3 text-left transition-colors hover:bg-zinc-50"
          >
            <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
              <AssetFileListThumb
                fillContainer
                href={fileHref(basePath, dir, row.fullPath)}
                file={row.fullPath}
              />
            </div>
            <span className="min-w-0 flex-1 truncate text-base font-medium text-zinc-900">
              {row.segment}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Linke Spalte „Projekte“ (Skizze Listenansicht): Liste aller Web-Asset-Projekte.
 * Im Home-Zustand (kein Projekt) Fokus auf die Suche (FinderView).
 */
function FinderProjectsColumn({ folderPreview, finderProjectAppId, finderOpenProject }) {
  return (
    <div className="flex max-h-[min(40vh,280px)] min-h-0 w-full shrink-0 flex-col bg-white dark:bg-zinc-900/40 md:max-h-none md:h-full md:w-[13.5rem] md:min-w-[12rem] md:max-w-[15rem]">
      <ul
        role="listbox"
        aria-label="Projekte"
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain py-1 pl-1 pr-0.5"
      >
        {FINDER_BROWSE_FOLDER_ROWS.map((row) => {
          const active = finderProjectAppId === row.appId;
          return (
            <li key={row.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => finderOpenProject(row.appId)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-zinc-200 font-semibold text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                <FinderListIcon
                  row={row}
                  folderPreview={folderPreview}
                  tileSize="list"
                />
                <span className="min-w-0 flex-1 truncate">{row.primary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FinderView({ unifiedParentScroll = false }) {
  const {
    openOrFocus,
    openAssetFileWindow,
    folderPreview,
    finderProjectAppId,
    finderPreview,
    finderTabAppIds,
    finderOpenProject,
    finderSetPreview,
    finderTogglePreviewForFile,
    finderClassicSearchExpanded,
    collapseFinderClassicSearch,
    finderProjectSearchStripExpanded,
    collapseFinderProjectSearchStrip,
    finderTitlebarSearchSlotEl,
  } = useDesktop();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDesktopKb, setIsDesktopKb] = useState(false);
  const rowElRefs = useRef([]);
  /** Gleiche Reihenfolge wie Anzeige — vermeidet useEffect auf instabilem rows-Array. */
  const rowsRef = useRef([]);
  const selectedIndexRef = useRef(0);
  const finderRootRef = useRef(null);
  const finderSearchRef = useRef(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia(
      `(min-width: ${DESKTOP_MIN_WIDTH_FINDER_KB}px)`
    );
    const apply = () => {
      setIsDesktopKb(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const q = query.trim();
  const showSearch = q.length > 0;
  const rows = useMemo(
    () => (showSearch ? filterFinderSearchIndex(q) : FINDER_BROWSE_FOLDER_ROWS),
    [q, showSearch]
  );
  rowsRef.current = rows;

  const browseGridMode =
    !showSearch &&
    rows.length > 0 &&
    rows.every((r) => r.kind === "folder");

  /** Pfeiltasten: natives window-capture + flushSync — Liste oder Projekt-Raster. */
  useEffect(() => {
    if (!isDesktopKb) return;
    const onKeyDown = (e) => {
      const root = finderRootRef.current;
      if (!root) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      const inFinderScope =
        root.contains(t) ||
        (t instanceof HTMLElement &&
          !!t.closest("[data-mm-finder-titlebar-search]"));
      if (!inFinderScope) return;
      /** Im geöffneten Projekt (ohne Suche): Navigation übernimmt Stream-Ansicht. */
      if (finderProjectAppId && !showSearch) return;
      const list = rowsRef.current;
      if (!list.length) return;

      const qTrim = (finderSearchRef.current?.value ?? "").trim();
      const gridBrowse =
        qTrim.length === 0 &&
        list.length > 0 &&
        list.every((r) => r.kind === "folder");

      if (!gridBrowse && e.key !== "ArrowDown" && e.key !== "ArrowUp") {
        return;
      }
      if (
        gridBrowse &&
        e.key !== "ArrowDown" &&
        e.key !== "ArrowUp" &&
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight"
      ) {
        return;
      }

      /** Suche: ↓ geht zur ersten Zeile / ersten Kachel. */
      if (t instanceof HTMLInputElement && t.id === "finder-search") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          flushSync(() => {
            setSelectedIndex(0);
            selectedIndexRef.current = 0;
          });
          rowElRefs.current[0]?.focus({ preventScroll: true });
        }
        return;
      }

      if (gridBrowse) {
        const cols = FINDER_BROWSE_GRID_COLS;
        const n = list.length;
        const i = selectedIndexRef.current;
        e.preventDefault();
        e.stopPropagation();
        const row = Math.floor(i / cols);
        const col = i % cols;
        let next = i;
        if (e.key === "ArrowRight") {
          if (col < cols - 1 && i + 1 < n) next = i + 1;
        } else if (e.key === "ArrowLeft") {
          if (col > 0) next = i - 1;
        } else if (e.key === "ArrowDown") {
          const below = i + cols;
          if (below < n) next = below;
        } else if (e.key === "ArrowUp") {
          if (row === 0) {
            finderSearchRef.current?.focus();
            return;
          }
          next = i - cols;
        }
        flushSync(() => {
          setSelectedIndex(next);
          selectedIndexRef.current = next;
        });
        rowElRefs.current[next]?.focus({ preventScroll: true });
        return;
      }

      /** Suchliste: nur vertikal. */
      if (e.key === "ArrowUp" && selectedIndexRef.current === 0) {
        e.preventDefault();
        e.stopPropagation();
        finderSearchRef.current?.focus();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      flushSync(() => {
        setSelectedIndex((idx) => {
          const next =
            e.key === "ArrowDown"
              ? Math.min(list.length - 1, idx + 1)
              : Math.max(0, idx - 1);
          selectedIndexRef.current = next;
          return next;
        });
      });
      rowElRefs.current[selectedIndexRef.current]?.focus({
        preventScroll: true,
      });
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isDesktopKb, finderProjectAppId, showSearch]);

  /** Neue Suche / Modus: Auswahl wieder von oben (erste Zeile). */
  useEffect(() => {
    setSelectedIndex(0);
  }, [q]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useLayoutEffect(() => {
    if (!isDesktopKb || rows.length === 0) return;
    const el = rowElRefs.current[selectedIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, rows, isDesktopKb]);

  const openHit = useCallback(
    (row) => {
      if (row.kind === "file") {
        finderSetPreview({
          dir: row.dir,
          file: row.file,
          basePath: "/web",
        });
      } else if (row.kind === "folder") {
        finderOpenProject(row.appId);
      } else if (row.kind === "app") {
        openOrFocus(row.appId);
      }
    },
    [finderSetPreview, finderOpenProject, openOrFocus]
  );

  const runFinderListKeys = useCallback(
    (e) => {
      const list = rowsRef.current;
      const target = e.target;
      if (!isDesktopKb) {
        return;
      }
      if (!list.length) {
        return;
      }

      if (target instanceof HTMLInputElement && target.id === "finder-search") {
        return;
      }

      if (e.key === "Enter") {
        if (e.repeat) return;
        if (
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const row = list[selectedIndexRef.current];
        if (!row) return;
        openHit(row);
        return;
      }

      if (e.key === " " || e.code === "Space") {
        if (e.repeat) return;
        if (
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable)
        ) {
          return;
        }
        const row = list[selectedIndexRef.current];
        if (!row) return;
        e.preventDefault();
        /** Nur Dateien: Toggle per Leertaste (Apps/Ordner → Enter). Kein stopPropagation — sonst fehlen oft Caret/Maus-Cursor bis zur nächsten Bewegung. */
        if (row.kind === "file") {
          finderTogglePreviewForFile({
            dir: row.dir,
            file: row.file,
            basePath: "/web",
          });
        } else {
          rowElRefs.current[selectedIndexRef.current]?.focus({
            preventScroll: true,
          });
        }
      }
    },
    [isDesktopKb, finderTogglePreviewForFile, openHit]
  );

  const projectAppMeta = finderProjectAppId ? APPS[finderProjectAppId] : null;
  const projectAssetDir = projectAppMeta?.assetDir ?? null;

  /** Wie früher: nur Suche + Raster/Liste, volle Breite — ohne Tabs/Vorschau-Spalte. */
  const isClassicFinderHome =
    finderProjectAppId === null &&
    finderPreview === null &&
    finderTabAppIds.length === 0;

  /** Desktop: Suche in der Titelleiste (Portal), nicht als zusätzliche Zeile unter der Titelleiste. */
  const finderSearchInTitlebarDesktop =
    !unifiedParentScroll &&
    ((isClassicFinderHome && finderClassicSearchExpanded) ||
      (!isClassicFinderHome && finderProjectSearchStripExpanded));

  /** Desktop: Suchzeile erst nach Klick auf die Lupe in der Titelleiste; Mobile: immer sichtbar. */
  const showClassicSearchStrip =
    !isClassicFinderHome ||
    unifiedParentScroll ||
    finderClassicSearchExpanded;

  /** Rechte Spalte nur bei Datei-Vorschau — kein leerer Platzhalter neben Projektliste. */
  const showPreviewColumn = finderPreview !== null;

  /** Kein Projekt aktiv (Home): Fokus auf die Kopf-Suche statt auf die Projekte-Spalte. */
  useEffect(() => {
    if (isClassicFinderHome) return;
    if (finderProjectAppId !== null) return;
    const id = requestAnimationFrame(() => {
      finderSearchRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [finderProjectAppId, isClassicFinderHome]);

  /** Nach Ausklappen der Suche: Fokus ins Suchfeld. */
  useLayoutEffect(() => {
    if (!isClassicFinderHome || unifiedParentScroll || !finderClassicSearchExpanded)
      return;
    const id = requestAnimationFrame(() => {
      finderSearchRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [
    isClassicFinderHome,
    unifiedParentScroll,
    finderClassicSearchExpanded,
    finderTitlebarSearchSlotEl,
  ]);

  /** Eingeklappt: Suchtext leeren (Desktop Classic). */
  useEffect(() => {
    if (
      finderClassicSearchExpanded ||
      !isClassicFinderHome ||
      unifiedParentScroll
    ) {
      return;
    }
    setQuery("");
  }, [
    finderClassicSearchExpanded,
    isClassicFinderHome,
    unifiedParentScroll,
  ]);

  /** Projekt-/Tab-Ansicht: Suchleiste zu — Text leeren. */
  useEffect(() => {
    if (finderProjectSearchStripExpanded || isClassicFinderHome) return;
    setQuery("");
  }, [finderProjectSearchStripExpanded, isClassicFinderHome]);

  const classicHomeMainScroll =
    unifiedParentScroll && !showSearch
      ? "min-h-0 overflow-visible p-3"
      : unifiedParentScroll && showSearch
        ? "min-h-0 overflow-visible"
        : !showSearch
          ? "min-h-0 flex-1 overflow-auto overscroll-contain p-3"
          : "min-h-0 flex-1 overflow-auto overscroll-contain p-2";

  const leftPaneScroll =
    unifiedParentScroll && !showSearch
      ? "min-h-0 overflow-visible p-2"
      : unifiedParentScroll && showSearch
        ? "min-h-0 overflow-visible"
        : !showSearch
          ? "min-h-0 flex-1 overflow-auto overscroll-contain p-2"
          : "min-h-0 flex-1 overflow-auto overscroll-contain p-2";

  const homeOrSearchPane =
    showSearch ? (
      <ul
        role="listbox"
        aria-label="Apps und Dateien"
        className={
          unifiedParentScroll
            ? "space-y-0.5"
            : "h-full space-y-0.5 overflow-auto overscroll-contain"
        }
        onKeyDownCapture={(e) => blockArrowScrollOnRow(e, isDesktopKb)}
      >
        {rows.length === 0 ? (
          <li className="px-2 py-3 text-zinc-500">Keine Treffer.</li>
        ) : (
          rows.map((row, index) => (
            <li key={row.id}>
              <button
                type="button"
                role="option"
                aria-selected={isDesktopKb && index === selectedIndex}
                ref={(el) => {
                  rowElRefs.current[index] = el;
                }}
                onClick={() => {
                  setSelectedIndex(index);
                  openHit(row);
                }}
                className={`flex w-full min-w-0 items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-zinc-100 ${
                  isDesktopKb && index === selectedIndex ? "bg-zinc-100" : ""
                }`}
              >
                <FinderListIcon row={row} folderPreview={folderPreview} />
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">
                  {row.primary}
                </span>
                <span
                  className="shrink-0 max-w-[40%] truncate text-right text-xs font-normal leading-snug text-zinc-500"
                  title={row.secondary}
                >
                  {row.secondary}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    ) : rows.length === 0 ? (
      <p className="px-1 py-3 text-zinc-500">Keine Einträge.</p>
    ) : (
      <div
        role="grid"
        aria-label="Projekte"
        aria-colcount={FINDER_BROWSE_GRID_COLS}
        className="grid grid-cols-4 gap-3"
        onKeyDownCapture={(e) => {
          if (!browseGridMode || !isDesktopKb) return;
          if (
            e.key === "ArrowDown" ||
            e.key === "ArrowUp" ||
            e.key === "ArrowLeft" ||
            e.key === "ArrowRight"
          ) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {rows.map((row, index) => (
          <button
            key={row.id}
            type="button"
            role="gridcell"
            aria-selected={isDesktopKb && index === selectedIndex}
            ref={(el) => {
              rowElRefs.current[index] = el;
            }}
            onClick={() => {
              setSelectedIndex(index);
              openHit(row);
            }}
            className="flex min-h-[7.5rem] flex-col items-center justify-start gap-2 rounded-lg border-0 px-1.5 py-2 text-center transition-colors hover:bg-zinc-100"
          >
            <FinderListIcon
              row={row}
              folderPreview={folderPreview}
              tileSize="grid"
            />
            <span className="line-clamp-2 w-full max-w-[10rem] text-center text-xs font-medium leading-tight text-zinc-900">
              {row.primary}
            </span>
          </button>
        ))}
      </div>
    );

  const projectPane =
    projectAssetDir ? (
      <FinderAssetStream
        dir={projectAssetDir}
        basePath="/web"
        unifiedParentScroll={unifiedParentScroll}
        onOpenFile={
          unifiedParentScroll
            ? (p) => finderSetPreview(p)
            : (p) => openAssetFileWindow(p, { fromFinder: true })
        }
      />
    ) : null;

  const finderSearchInputEl = (
    <input
      ref={finderSearchRef}
      id="finder-search"
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyUp={(e) => {
        if (e.key !== " ") return;
        const el = e.currentTarget;
        requestAnimationFrame(() => {
          const s = el.selectionStart;
          const t = el.selectionEnd;
          if (s != null && t != null) el.setSelectionRange(s, t);
        });
      }}
      placeholder="search"
      className="min-w-0 flex-1 border-0 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 [&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden"
      autoComplete="off"
      spellCheck={false}
    />
  );

  const finderTitlebarSearchPortal =
    finderTitlebarSearchSlotEl && finderSearchInTitlebarDesktop
      ? createPortal(
          <>
            <label htmlFor="finder-search" className="sr-only">
              Apps und Dateien durchsuchen
            </label>
            {isClassicFinderHome ? (
              finderSearchInputEl
            ) : (
              <div className="group/finder-search flex h-8 w-full min-w-0 items-center rounded-sm border border-zinc-300 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-800/90">
                {finderSearchInputEl}
              </div>
            )}
          </>,
          finderTitlebarSearchSlotEl
        )
      : null;

  return (
    <>
      {finderTitlebarSearchPortal}
      <div
        ref={finderRootRef}
        data-mm-finder-root
        className={`relative flex min-h-0 flex-col bg-white text-sm text-zinc-800 ${
          unifiedParentScroll
            ? "h-auto overflow-visible"
            : "h-full overflow-hidden"
        }`}
        onKeyDownCapture={runFinderListKeys}
      >
      {isClassicFinderHome &&
      showClassicSearchStrip &&
      !finderSearchInTitlebarDesktop ? (
        <div className="shrink-0 border-b-2 border-black px-3 py-2">
          <label htmlFor="finder-search" className="sr-only">
            Apps und Dateien durchsuchen
          </label>
          <div className="group/finder-search flex items-center gap-2 rounded bg-transparent px-2 py-1.5 focus-within:ring-2 focus-within:ring-zinc-400 focus-within:ring-offset-0">
            <button
              type="button"
              className="group flex h-6 w-4 shrink-0 cursor-pointer items-center justify-center rounded"
              aria-label="Suche schließen"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                collapseFinderClassicSearch();
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/web/buttons/lupe.svg"
                alt=""
                aria-hidden
                className="pointer-events-none h-4 w-4 shrink-0 opacity-50 transition-[opacity,transform] duration-200 ease-out group-focus-within/finder-search:opacity-100 group-hover:scale-[1.15] group-hover:opacity-100"
                draggable={false}
              />
            </button>
            {finderSearchInputEl}
          </div>
        </div>
      ) : null}

      {isClassicFinderHome ? (
        <div
          className={`min-h-0 min-w-0 flex-1 ${
            unifiedParentScroll ? "min-h-[min(70vh,520px)]" : ""
          } ${classicHomeMainScroll}`}
        >
          {homeOrSearchPane}
        </div>
      ) : (
        <>
          {(finderProjectSearchStripExpanded || unifiedParentScroll) &&
          !finderSearchInTitlebarDesktop ? (
            <div className="flex shrink-0 flex-col gap-2 border-b-2 border-black bg-white px-2 py-2 dark:bg-zinc-900/50">
              <div className="flex min-w-0 w-full flex-1 sm:max-w-xl">
                <label htmlFor="finder-search" className="sr-only">
                  Apps und Dateien durchsuchen
                </label>
                <div className="group/finder-search flex w-full min-w-0 items-center gap-2 rounded-sm border border-zinc-300 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-zinc-400 focus-within:ring-offset-0 dark:border-zinc-600 dark:bg-zinc-800/90">
                  {!unifiedParentScroll ? (
                    <button
                      type="button"
                      className="group flex h-6 w-4 shrink-0 cursor-pointer items-center justify-center rounded"
                      aria-label="Suche schließen"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        collapseFinderProjectSearchStrip();
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/web/buttons/lupe.svg"
                        alt=""
                        aria-hidden
                        className="pointer-events-none h-4 w-4 shrink-0 opacity-50 transition-[opacity,transform] duration-200 ease-out group-focus-within/finder-search:opacity-100 group-hover:scale-[1.15] group-hover:opacity-100 dark:opacity-60 dark:group-focus-within/finder-search:opacity-100"
                        draggable={false}
                      />
                    </button>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src="/web/buttons/lupe.svg"
                      alt=""
                      aria-hidden
                      className="h-4 w-4 shrink-0 opacity-50 dark:opacity-60"
                      draggable={false}
                    />
                  )}
                  {finderSearchInputEl}
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row ${
              unifiedParentScroll ? "min-h-[min(70vh,520px)]" : ""
            }`}
          >
            <FinderProjectsColumn
              folderPreview={folderPreview}
              finderProjectAppId={finderProjectAppId}
              finderOpenProject={finderOpenProject}
            />
            <div
              className={`relative flex min-h-0 min-w-0 flex-1 flex-col lg:min-w-0 ${leftPaneScroll}`}
            >
              {finderProjectAppId && !showSearch ? projectPane : homeOrSearchPane}
            </div>

            {showPreviewColumn ? (
              <div
                className={`flex min-h-[min(36vh,320px)] min-w-0 shrink-0 flex-col border-t border-zinc-200 bg-zinc-100/90 dark:border-zinc-700 dark:bg-zinc-950/80 lg:min-h-0 lg:w-[40%] lg:min-w-[min(260px,28vw)] lg:max-w-[min(560px,44vw)] lg:border-l lg:border-t-0 ${
                  unifiedParentScroll ? "min-h-[40vh]" : ""
                }`}
              >
                <AssetFileViewer
                  dir={finderPreview.dir}
                  file={finderPreview.file}
                  basePath={finderPreview.basePath ?? "/web"}
                  unifiedParentScroll={unifiedParentScroll}
                  onNavigateAdjacentFile={(forward) => {
                    const files =
                      webAssetManifest.find((x) => x.dir === finderPreview.dir)
                        ?.files ?? [];
                    const idx = manifestFileIndex(files, finderPreview.file);
                    const next = forward ? idx + 1 : idx - 1;
                    if (next >= 0 && next < files.length) {
                      finderSetPreview({
                        dir: finderPreview.dir,
                        file: files[next],
                        basePath: finderPreview.basePath ?? "/web",
                      });
                    }
                  }}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
    </>
  );
}

function AssetSubfolderView({
  dir,
  basePath = "/web",
  unifiedParentScroll = false,
  /** Wenn gesetzt: eingebetteter Finder (kein separates Datei-Fenster). */
  onOpenFile,
  onToggleFile,
}) {
  const { openAssetFileWindow, toggleAssetFileWindow } = useDesktop();
  const openFile = useCallback(
    (payload) => {
      if (onOpenFile) onOpenFile(payload);
      else openAssetFileWindow(payload);
    },
    [onOpenFile, openAssetFileWindow]
  );
  const toggleFile = useCallback(
    (payload) => {
      if (onToggleFile) onToggleFile(payload);
      else toggleAssetFileWindow(payload);
    },
    [onToggleFile, toggleAssetFileWindow]
  );
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDesktopKb, setIsDesktopKb] = useState(false);
  const rowElRefs = useRef([]);

  useLayoutEffect(() => {
    const mq = window.matchMedia(
      `(min-width: ${DESKTOP_MIN_WIDTH_FINDER_KB}px)`
    );
    const apply = () => setIsDesktopKb(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const entry = webAssetManifest.find((x) => x.dir === dir);
  const files = entry?.files ?? [];
  const tree = useMemo(
    () => buildAssetFileTree(entry?.files ?? []),
    [entry]
  );

  const flatRows = useMemo(
    () =>
      collectAssetTreeFlatRows(tree, dir, basePath, collapsedKeys),
    [tree, dir, basePath, collapsedKeys]
  );

  useEffect(() => {
    setSelectedIndex((i) => {
      if (flatRows.length === 0) return 0;
      return Math.min(Math.max(0, i), flatRows.length - 1);
    });
  }, [flatRows]);

  useLayoutEffect(() => {
    if (!isDesktopKb || flatRows.length === 0) return;
    const el = rowElRefs.current[selectedIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, flatRows, isDesktopKb]);

  const toggleFolderCollapsed = useCallback((folderKey) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(folderKey)) next.delete(folderKey);
      else next.add(folderKey);
      return next;
    });
  }, []);

  const handleKeyDownCapture = useCallback(
    (e) => {
      if (!isDesktopKb || flatRows.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.min(flatRows.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === " " || e.code === "Space") {
        if (e.repeat) return;
        e.preventDefault();
        e.stopPropagation();
        const row = flatRows[selectedIndex];
        if (!row) return;
        if (row.kind === "file") {
          toggleFile({
            dir: row.dir,
            file: row.fullPath,
            basePath: row.basePath,
          });
        } else {
          toggleFolderCollapsed(row.folderKey);
        }
      }
    },
    [
      isDesktopKb,
      flatRows,
      selectedIndex,
      toggleFile,
      toggleFolderCollapsed,
    ]
  );

  return (
    <div
      className={`flex flex-col gap-2 bg-white p-3 text-sm text-zinc-800 max-md:items-center ${
        unifiedParentScroll
          ? "h-auto overflow-visible"
          : "h-full overflow-auto overscroll-contain"
      }`}
      onKeyDownCapture={handleKeyDownCapture}
    >
      {files.length === 0 ? (
        <p className="w-full text-center text-zinc-500 md:text-left">
          Keine Dateien im Manifest —{" "}
          <code className="text-zinc-700">npm run sync:web</code> ausführen.
        </p>
      ) : (
        <ul
          role="listbox"
          aria-label="Dateien"
          className="w-full space-y-0.5 overscroll-contain text-left text-zinc-700"
        >
          {flatRows.map((row, index) => {
            const padStyle = { paddingLeft: `${0.75 * row.depth}rem` };
            if (row.kind === "folder") {
              const expanded = !collapsedKeys.has(row.folderKey);
              return (
                <li key={row.folderKey} className="list-none">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    ref={(el) => {
                      rowElRefs.current[index] = el;
                    }}
                    style={padStyle}
                    onKeyDownCapture={(e) => blockArrowScrollOnRow(e, isDesktopKb)}
                    onClick={() => {
                      setSelectedIndex(index);
                      toggleFolderCollapsed(row.folderKey);
                    }}
                    className={`flex w-full min-w-0 items-center gap-2 rounded py-0.5 text-left font-medium text-zinc-800 md:hover:bg-zinc-100 ${
                      isDesktopKb && index === selectedIndex ? "bg-zinc-100" : ""
                    }`}
                  >
                    <span className="min-w-0 truncate">{row.name}</span>
                  </button>
                </li>
              );
            }
            return (
              <li key={row.fullPath} className="list-none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isDesktopKb && index === selectedIndex}
                  ref={(el) => {
                    rowElRefs.current[index] = el;
                  }}
                  style={padStyle}
                  onKeyDownCapture={(e) => blockArrowScrollOnRow(e, isDesktopKb)}
                  onClick={() => {
                    setSelectedIndex(index);
                    openFile({
                      dir: row.dir,
                      file: row.fullPath,
                      basePath: row.basePath,
                    });
                  }}
                  className={`flex w-full min-w-0 items-center gap-2 rounded px-1 py-1 text-left text-zinc-900 underline decoration-zinc-400 md:hover:bg-zinc-100 md:hover:decoration-zinc-900 ${
                    isDesktopKb && index === selectedIndex ? "bg-zinc-100" : ""
                  }`}
                >
                  <AssetFileListThumb
                    href={fileHref(basePath, dir, row.fullPath)}
                    file={row.fullPath}
                  />
                  <span className="min-w-0 truncate">{row.segment}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AppContent({
  appId,
  assetFile,
  windowId,
  unifiedParentScroll = false,
  windowDragProps,
}) {
  const app = APPS[appId];
  if (appId === "assetFile" && assetFile?.dir && assetFile?.file) {
    return (
      <div
        className={
          unifiedParentScroll
            ? "flex w-full min-h-0 flex-col"
            : "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        }
      >
        <AssetFileViewer
          dir={assetFile.dir}
          file={assetFile.file}
          basePath={assetFile.basePath ?? "/web"}
          windowId={windowId}
          unifiedParentScroll={unifiedParentScroll}
          widgetChrome={!!assetFile.widgetChrome}
          windowDragProps={windowDragProps}
        />
      </div>
    );
  }

  if (app?.assetDir) {
    return (
      <AssetSubfolderView
        dir={app.assetDir}
        basePath="/web"
        unifiedParentScroll={unifiedParentScroll}
      />
    );
  }

  switch (appId) {
    case "finder":
      return <FinderView unifiedParentScroll={unifiedParentScroll} />;
    case "notes":
      return <NotesAppView unifiedParentScroll={unifiedParentScroll} />;
    case "media":
      return (
        <MediaAppView
          windowId={windowId}
          unifiedParentScroll={unifiedParentScroll}
        />
      );
    case "settings":
      return (
        <div
          className={`flex w-full items-start justify-center ${
            unifiedParentScroll
              ? "min-h-0"
              : "h-full min-h-0 overflow-auto"
          }`}
        >
          <SettingsPanel windowId={windowId} />
        </div>
      );
    default:
      return (
        <div
          className={`flex items-center justify-center bg-white text-sm text-zinc-500 ${
            unifiedParentScroll ? "min-h-[40vh]" : "h-full"
          }`}
        >
          Unknown app
        </div>
      );
  }
}
