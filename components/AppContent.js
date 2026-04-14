"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  APPS,
  isDesktopAtDefaultLayout,
  webAssetAppId,
} from "@/lib/apps";
import {
  FINDER_BROWSE_ROWS,
  filterFinderSearchIndex,
} from "@/lib/finderSearch";
import { webAssetManifest } from "@/lib/webAssetManifest";
import { useDesktop } from "@/context/DesktopContext";
import { AppIcon } from "@/components/AppIcon";
import { NotesAppView } from "@/components/NotesAppView";
import { MediaAppView } from "@/components/MediaAppView";
import { Model3DViewer } from "@/components/Model3DViewer";
import { resolveModelBackground } from "@/lib/model3dBackground";
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

function fileHref(basePath, dir, file) {
  return `${basePath}/${encodeURIComponent(dir)}/${encodeURIComponent(file)}`;
}

/** PDF im iframe: Toolbar aus; view=FitH = Seite an Breite anpassen (skaliert mit Fenster/iframe, v. a. Chromium). */
function assetIframeSrc(file, url) {
  if (!/\.pdf$/i.test(file)) return url;
  const params = "toolbar=0&view=FitH";
  return url.includes("#") ? `${url}&${params}` : `${url}#${params}`;
}

function isPreviewImageFile(name) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

function isPreviewVideoFile(name) {
  return /\.(mov|mp4|webm)$/i.test(name);
}

/** Kleines Vorschaubild in der Ordnerliste (Bild/Video), sonst Typ-Emoji. */
function AssetFileListThumb({ href, file }) {
  const [imgFailed, setImgFailed] = useState(false);
  const videoRef = useRef(null);

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
          className="h-11 w-11 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-600"
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
        className="h-11 w-11 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-600"
        aria-hidden
      />
    );
  }

  const ext = fileExtensionDisplay(file);

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-100 px-1 dark:border-zinc-600 dark:bg-zinc-800"
      aria-hidden
    >
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
/** Horizontales Wischen zwischen Assets (nur bei Zoom 1). */
const ASSET_SWIPE_MIN_DX = 56;
const ASSET_SWIPE_DOMINANCE = 1.12;
const ASSET_SWIPE_MAX_MS = 700;

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
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef(null);
  const panTouchRef = useRef(null);
  const swipePrevRef = useRef(onSwipePrevious);
  const swipeNextRef = useRef(onSwipeNext);
  const swipeTrackRef = useRef(null);

  useLayoutEffect(() => {
    scaleRef.current = scale;
    panRef.current = pan;
  });

  useLayoutEffect(() => {
    swipePrevRef.current = onSwipePrevious;
    swipeNextRef.current = onSwipeNext;
  });

  useEffect(() => {
    setScale(ASSET_IMG_ZOOM_MIN);
    setPan({ x: 0, y: 0 });
    swipeTrackRef.current = null;
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
          t0: typeof performance !== "undefined" ? performance.now() : Date.now(),
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
        if (
          Math.abs(dx) > 12 &&
          Math.abs(dx) > Math.abs(dy) * ASSET_SWIPE_DOMINANCE
        ) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) panTouchRef.current = null;

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
        if (
          dt <= ASSET_SWIPE_MAX_MS &&
          Math.abs(dx) >= ASSET_SWIPE_MIN_DX &&
          Math.abs(dx) > Math.abs(dy) * ASSET_SWIPE_DOMINANCE
        ) {
          if (dx > 0) swipePrevRef.current?.();
          else swipeNextRef.current?.();
        }
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
        <div className="flex h-full w-full items-center justify-center">
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

function AssetFileViewer({ dir, file, basePath, windowId, unifiedParentScroll = false }) {
  const { fitWindowToContentSize, setAssetFileForWindow, windows } = useDesktop();
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
      if (windowId) fitWindowToContentSize(windowId, w, h);
    },
    [windowId, fitWindowToContentSize]
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

  const manifestFiles = manifestEntry?.files ?? [];
  const assetIdx = manifestFileIndex(manifestFiles, file);
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
    if (!windowId || isImage || isVideo || is3d) return;
    const { w, h } = iframeAspectHint(file);
    const isPdf = /\.pdf$/i.test(file);
    fitWindowToContentSize(windowId, w, h, {
      lockAspectForResize: !isPdf,
    });
  }, [windowId, file, url, isImage, isVideo, is3d, fitWindowToContentSize]);

  useEffect(() => {
    if (!windowId) return;
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
      if (topVisibleWindowId(windows) !== windowId) return;

      const idx = manifestFileIndex(files, file);
      if (idx < 0) return;

      const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
      const next = forward
        ? Math.min(files.length - 1, idx + 1)
        : Math.max(0, idx - 1);
      if (next === idx) return;
      e.preventDefault();
      e.stopPropagation();
      setAssetFileForWindow(windowId, {
        dir,
        file: files[next],
        basePath,
      });
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [windowId, dir, file, basePath, windows, setAssetFileForWindow]);

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
function FinderFileVideoThumb({ href, file }) {
  const videoRef = useRef(null);

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
      className="h-9 w-9 shrink-0 rounded-lg object-cover"
      aria-hidden
    />
  );
}

/** Wie `AssetFileListThumb` ohne Bild/Video: Endung im Kasten statt Emoji. */
function FinderFileFormatThumb({ file }) {
  const ext = fileExtensionDisplay(file);
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-100 px-0.5 dark:border-zinc-600 dark:bg-zinc-800"
      aria-hidden
    >
      {ext ? (
        <span className="max-w-full truncate text-center font-mono text-[13.5px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300">
          {ext}
        </span>
      ) : (
        <span className="text-base leading-none">{fileIcon(file)}</span>
      )}
    </span>
  );
}

/**
 * Wie DesktopFolderIcon / Ordnerliste: Vorschaubild/Video bei FolderPreview,
 * sonst AppIcon bzw. Dateiendung wie in der Ordnerdateiliste (keine Typ-Emojis).
 */
function FinderListIcon({ row, folderPreview }) {
  const app = row.appId ? APPS[row.appId] : null;

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
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center">
        <AppIcon app={app} />
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
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
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
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
          onError={() => setImgFailed(true)}
        />
      </>
    );
  }

  if (row.kind === "file" && fileVideoHref) {
    return <FinderFileVideoThumb href={fileVideoHref} file={row.file} />;
  }

  if (row.kind === "folder" && app) {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center">
        <AppIcon app={app} />
      </span>
    );
  }

  if (row.kind === "file") {
    return <FinderFileFormatThumb file={row.file} />;
  }

  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-xl leading-none"
      aria-hidden
    >
      {row.icon}
    </span>
  );
}

const DESKTOP_MIN_WIDTH_FINDER_KB = 768;

/** Verhindert, dass Pfeiltasten die scrollbare Liste oder die Seite scrollen (Auswahl läuft separat). */
function blockArrowScrollOnRow(e, isDesktopKb) {
  if (!isDesktopKb) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
  }
}

function FinderView({ unifiedParentScroll = false }) {
  const {
    openOrFocus,
    openAssetFileWindow,
    toggleAssetFileWindow,
    folderPreview,
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
    () => (showSearch ? filterFinderSearchIndex(q) : FINDER_BROWSE_ROWS),
    [q, showSearch]
  );
  rowsRef.current = rows;

  /** Pfeiltasten: natives window-capture + flushSync — verhindert Scroll und stellt Index zuverlässig ein (React preventDefault reicht oft nicht). */
  useEffect(() => {
    if (!isDesktopKb) return;
    const onKeyDown = (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const root = finderRootRef.current;
      if (!root) return;
      const t = e.target;
      if (!(t instanceof Node) || !root.contains(t)) return;
      const list = rowsRef.current;
      if (!list.length) return;

      /** Suche: ↓ geht zur ersten Zeile (Index 0), nicht 0→1. ↑ bleibt normale Caret-Bewegung im Text. */
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

      /** Erste Listezeile: ↑ zurück ins Suchfeld. */
      if (e.key === "ArrowUp" && selectedIndexRef.current === 0) {
        e.preventDefault();
        e.stopPropagation();
        finderSearchRef.current?.focus();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      flushSync(() => {
        setSelectedIndex((i) => {
          const next =
            e.key === "ArrowDown"
              ? Math.min(list.length - 1, i + 1)
              : Math.max(0, i - 1);
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
  }, [isDesktopKb]);

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
        openAssetFileWindow({ dir: row.dir, file: row.file, basePath: "/web" });
      } else {
        openOrFocus(row.appId);
      }
    },
    [openAssetFileWindow, openOrFocus]
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
          toggleAssetFileWindow({
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
    [isDesktopKb, toggleAssetFileWindow, openHit]
  );

  return (
    <div
      ref={finderRootRef}
      data-mm-finder-root
      className={`flex min-h-0 flex-col bg-white text-sm text-zinc-800 ${
        unifiedParentScroll
          ? "h-auto overflow-visible"
          : "h-full overflow-hidden"
      }`}
      onKeyDownCapture={runFinderListKeys}
    >
      <div className="shrink-0 border-b-2 border-black px-3 py-2">
        <label htmlFor="finder-search" className="sr-only">
          Apps und Dateien durchsuchen
        </label>
        <div className="flex items-center gap-2 rounded bg-zinc-50 px-2 py-1.5 focus-within:ring-2 focus-within:ring-zinc-400 focus-within:ring-offset-0">
          <span aria-hidden className="shrink-0 text-zinc-500">
            🔍
          </span>
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
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
      <ul
        role="listbox"
        aria-label="Apps und Dateien"
        className={
          unifiedParentScroll
            ? "space-y-0.5 p-2"
            : "min-h-0 flex-1 space-y-0.5 overflow-auto overscroll-contain p-2"
        }
      >
        {rows.length === 0 ? (
          <li className="px-2 py-3 text-zinc-500">
            {showSearch ? "Keine Treffer." : "Keine Einträge."}
          </li>
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
    </div>
  );
}

/** Manifest-Pfade → Baum (Unterordner = eigene Knoten). */
function buildAssetFileTree(paths) {
  const root = { children: new Map(), files: [] };
  for (const fullPath of paths) {
    const parts = fullPath.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (i === parts.length - 1) {
        node.files.push({ segment: seg, fullPath });
      } else {
        if (!node.children.has(seg)) {
          node.children.set(seg, { children: new Map(), files: [] });
        }
        node = node.children.get(seg);
      }
    }
  }
  return root;
}

/** Sichtbare Zeilen in Baum-Reihenfolge; `collapsedKeys` = Ordner-Pfade, die zugeklappt sind. */
function collectAssetTreeFlatRows(
  node,
  dir,
  basePath,
  collapsedKeys,
  parentPath = "",
  depth = 0
) {
  const out = [];
  const childNames = [...node.children.keys()].sort((a, b) =>
    a.localeCompare(b)
  );
  const fileRows = [...node.files].sort((a, b) =>
    a.segment.localeCompare(b.segment)
  );
  for (const name of childNames) {
    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    const folderKey = `${dir}::${folderPath}`;
    out.push({
      kind: "folder",
      name,
      folderPath,
      folderKey,
      dir,
      basePath,
      depth,
    });
    if (!collapsedKeys.has(folderKey)) {
      const child = node.children.get(name);
      out.push(
        ...collectAssetTreeFlatRows(
          child,
          dir,
          basePath,
          collapsedKeys,
          folderPath,
          depth + 1
        )
      );
    }
  }
  for (const f of fileRows) {
    out.push({
      kind: "file",
      segment: f.segment,
      fullPath: f.fullPath,
      dir,
      basePath,
      depth,
    });
  }
  return out;
}

function AssetSubfolderView({ dir, basePath = "/web", unifiedParentScroll = false }) {
  const { openAssetFileWindow, toggleAssetFileWindow } = useDesktop();
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
          toggleAssetFileWindow({
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
      toggleAssetFileWindow,
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
                    openAssetFileWindow({
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
