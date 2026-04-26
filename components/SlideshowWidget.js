"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDesktop } from "@/context/DesktopContext";
import { getSlideshowRestrictList } from "@/lib/desktopWidgets";
import {
  fileHref,
  isSlideVideoFile,
  listSlideshowMediaFiles,
} from "@/lib/webAssetUrls";

const IMAGE_SLIDE_MS = 5000;
const SLIDE_TRANSITION_MS = 650;
const SLIDE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * @param {{
 *   href: string,
 *   isVideo: boolean,
 *   videoActive: boolean,
 *   onNext: () => void,
 *   onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => void,
 * }} props
 */
function SlideshowSlideMedia({
  href,
  isVideo,
  videoActive,
  onNext,
  onTimeUpdate,
}) {
  if (isVideo) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        key={href}
        src={href}
        className="absolute inset-0 h-full w-full object-contain"
        muted
        playsInline
        autoPlay={videoActive}
        onEnded={videoActive ? onNext : () => {}}
        onError={videoActive ? onNext : () => {}}
        onTimeUpdate={videoActive ? onTimeUpdate : undefined}
        aria-label="Slideshow-Video"
      />
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      key={href}
      src={href}
      alt=""
      className="absolute inset-0 h-full w-full object-contain"
      draggable={false}
    />
  );
}

/** Gleiche Pfeil-Buttons wie in der Slideshow — auch für Asset-Fenster im Widget-Look. */
export function WidgetChromeArrowButton({ dir, label, onClick, disabled }) {
  return (
    <button
      type="button"
      data-mm-widget-no-drag
      aria-label={label}
      disabled={!!disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--mm-desktop-bg)] text-[var(--mm-shell-text)] transition duration-200 ease-out ${
        disabled
          ? "cursor-not-allowed opacity-25"
          : "opacity-50 hover:opacity-100 focus-visible:opacity-100 active:scale-95 active:opacity-100"
      }`}
    >
      <svg
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {dir === "left" ? (
          <path d="M15 18l-6-6 6-6" />
        ) : (
          <path d="M9 18l6-6-6-6" />
        )}
      </svg>
    </button>
  );
}

/**
 * @param {{
 *   widget: import('@/lib/desktopWidgets').DesktopSlideshowWidget,
 *   layout: 'desktop' | 'mobile',
 *   dragHandleProps?: React.HTMLAttributes<HTMLDivElement>,
 *   stackNavigation?: { onNext: () => void, onPrev: () => void, locked?: boolean } | null,
 *   stackDeckLayer?: boolean,
 *   stackMediaReveal?: { popped: boolean, fromScale: number, durationMs: number, easing: string } | null,
 *   blockClickAfterDragRef?: import('react').MutableRefObject<boolean> | null,
 * }} props
 */
export function SlideshowWidget({
  widget,
  layout,
  dragHandleProps,
  stackNavigation = null,
  stackDeckLayer = false,
  stackMediaReveal = null,
  blockClickAfterDragRef = null,
}) {
  const { finderOpenProjectFile } = useDesktop();
  const basePath = widget.basePath ?? "/web";
  const files = useMemo(
    () =>
      listSlideshowMediaFiles(widget.assetDir, basePath, {
        restrictTo: getSlideshowRestrictList(widget),
      }),
    [widget, basePath]
  );
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);
  const [direction, setDirection] = useState(1);
  const [slideReady, setSlideReady] = useState(false);

  useEffect(() => {
    setIndex(0);
    setPrevIndex(null);
    setSlideReady(false);
  }, [widget.assetDir, widget.id]);

  const n = files.length;

  useEffect(() => {
    setIndex((i) => (n === 0 ? 0 : Math.min(i, n - 1)));
    setPrevIndex(null);
    setSlideReady(false);
  }, [n]);

  const safeIndex = n === 0 ? 0 : Math.min(index, n - 1);
  const currentFile = n > 0 ? files[safeIndex] : null;
  const src = currentFile
    ? fileHref(basePath, widget.assetDir, currentFile)
    : null;

  /** Stapel: nach einem kompletten Durchlauf (letztes Medium) → nächstes Widget statt wieder von vorn. */
  const tryStackAfterFullCycle = useCallback(() => {
    if (!stackNavigation || stackNavigation.locked || prevIndex !== null)
      return false;
    if (n === 0) return false;
    if (n === 1) {
      stackNavigation.onNext();
      return true;
    }
    if (safeIndex === n - 1) {
      stackNavigation.onNext();
      return true;
    }
    return false;
  }, [stackNavigation, prevIndex, n, safeIndex]);

  const goPrev = useCallback(() => {
    if (n <= 1 || prevIndex !== null) return;
    setDirection(-1);
    setPrevIndex(safeIndex);
    setIndex((i) => (i - 1 + n) % n);
  }, [n, prevIndex, safeIndex]);

  const goNext = useCallback(() => {
    if (prevIndex !== null) return;
    if (tryStackAfterFullCycle()) return;
    if (n <= 1) return;
    setDirection(1);
    setPrevIndex(safeIndex);
    setIndex((i) => (i + 1) % n);
  }, [tryStackAfterFullCycle, n, prevIndex, safeIndex]);

  const isVideoSlide =
    currentFile != null && isSlideVideoFile(currentFile);

  const [videoProgress, setVideoProgress] = useState(0);

  useEffect(() => {
    setVideoProgress(0);
  }, [safeIndex, src, isVideoSlide]);

  const handleVideoTimeUpdate = useCallback((e) => {
    const v = e.currentTarget;
    if (!v.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;
    setVideoProgress(Math.min(1, v.currentTime / v.duration));
  }, []);

  /** Auto-Advance nur wenn der Fortschrittsbalken fertig ist — gleiche Zeitbasis wie die CSS-Animation (kein setInterval-Drift). */
  const handleSegmentFillEnd = useCallback(
    (e) => {
      const names = String(e.animationName || "")
        .split(",")
        .map((s) => s.trim());
      if (!names.includes("mm-slideshow-segment-fill")) return;
      e.stopPropagation();
      if (stackDeckLayer) return;
      if (prevIndex !== null || isVideoSlide) return;
      if (tryStackAfterFullCycle()) return;
      if (n <= 1) return;
      setDirection(1);
      setPrevIndex(safeIndex);
      setIndex((i) => (i + 1) % n);
    },
    [
      n,
      prevIndex,
      isVideoSlide,
      safeIndex,
      stackDeckLayer,
      tryStackAfterFullCycle,
    ]
  );

  useEffect(() => {
    if (prevIndex === null) {
      setSlideReady(false);
      return;
    }
    setSlideReady(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSlideReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, [prevIndex, index]);

  useEffect(() => {
    if (prevIndex === null) return;
    const id = window.setTimeout(() => {
      setPrevIndex(null);
      setSlideReady(false);
    }, SLIDE_TRANSITION_MS);
    return () => window.clearTimeout(id);
  }, [prevIndex, index]);

  const isMobile = layout === "mobile";

  const openCurrentInFinder = useCallback(() => {
    if (!currentFile || !widget.assetDir) return;
    finderOpenProjectFile({
      dir: widget.assetDir,
      file: currentFile,
      basePath,
    });
  }, [currentFile, widget.assetDir, basePath, finderOpenProjectFile]);

  const onRootClick = useCallback(
    (e) => {
      if (stackDeckLayer) return;
      const t = e.target;
      if (!(t instanceof Element) || t.closest("[data-mm-widget-no-drag]"))
        return;
      const block = blockClickAfterDragRef;
      if (block?.current) {
        block.current = false;
        return;
      }
      openCurrentInFinder();
    },
    [
      stackDeckLayer,
      blockClickAfterDragRef,
      openCurrentInFinder,
    ]
  );

  const rootDrag =
    stackDeckLayer || !(layout === "desktop" && dragHandleProps)
      ? {}
      : dragHandleProps;

  const transitionCss = slideReady
    ? `transform ${SLIDE_TRANSITION_MS}ms ${SLIDE_EASE}`
    : "none";

  const slideMedia = (slideIdx, videoActive) => {
    const file = files[slideIdx];
    if (!file) return null;
    const href = fileHref(basePath, widget.assetDir, file);
    const vActive = stackDeckLayer ? false : videoActive;
    return (
      <SlideshowSlideMedia
        href={href}
        isVideo={isSlideVideoFile(file)}
        videoActive={vActive}
        onNext={goNext}
        onTimeUpdate={handleVideoTimeUpdate}
      />
    );
  };

  const deckChrome = !stackDeckLayer;
  const stackNav =
    stackDeckLayer ? null : stackNavigation;

  const stackMediaRevealStyle = stackMediaReveal
    ? {
        transform: `scale(${stackMediaReveal.popped ? 1 : stackMediaReveal.fromScale})`,
        transformOrigin: "50% 50%",
        transition: stackMediaReveal.popped
          ? `transform ${stackMediaReveal.durationMs}ms ${stackMediaReveal.easing}`
          : "none",
      }
    : null;

  const mediaLayer = (
    <>
      {src ? (
        prevIndex != null ? (
          <>
            <div
              className="absolute inset-0 z-10 will-change-transform"
              style={{
                transform: slideReady
                  ? `translateX(${-direction * 100}%)`
                  : "translateX(0)",
                transition: transitionCss,
              }}
            >
              {slideMedia(prevIndex, false)}
            </div>
            <div
              className="absolute inset-0 z-[11] will-change-transform"
              style={{
                transform: slideReady
                  ? "translateX(0)"
                  : `translateX(${direction * 100}%)`,
                transition: transitionCss,
              }}
            >
              {slideMedia(safeIndex, true)}
            </div>
          </>
        ) : (
          slideMedia(safeIndex, true)
        )
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-zinc-600">
          Keine Bilder oder Videos in diesem Ordner (Manifest).
        </div>
      )}
    </>
  );

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-lg mm-os-paint-stroke bg-white shadow-none ${
        stackDeckLayer ? "pointer-events-none" : ""
      } ${
        isMobile
          ? /* Mobile Home: 3×2 Rasterzellen, rechts */
            "ml-auto aspect-[3/2] w-[75%] max-w-full shrink-0"
          : stackDeckLayer
            ? "h-full w-full"
            : "h-full w-full md:cursor-grab md:active:cursor-grabbing"
      }`}
      {...rootDrag}
      onClick={onRootClick}
    >
      {deckChrome ? (
      <div className="absolute left-0 right-0 top-0 z-20 w-full px-1.5 pt-1">
        <div className="flex w-full min-w-0 items-center gap-1 py-0.5">
          {n > 0 &&
            files.map((_, i) => {
              const active = i === safeIndex;
              if (!active) {
                return (
                  <span
                    key={i}
                    className="h-1 min-w-0 flex-1 rounded-full bg-zinc-200 opacity-25"
                    aria-hidden
                  />
                );
              }
              return (
                <span
                  key={i}
                  className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200/50"
                  aria-hidden
                >
                  {isVideoSlide ? (
                    <span
                      className="absolute left-0 top-0 bottom-0 rounded-full bg-black/50"
                      style={{ width: `${videoProgress * 100}%` }}
                    />
                  ) : (
                    <span
                      key={`fill-${safeIndex}-${currentFile}`}
                      className="mm-slideshow-segment-fill block h-full w-full bg-black/50"
                      style={{
                        animationDuration: `${IMAGE_SLIDE_MS}ms`,
                      }}
                      onAnimationEnd={handleSegmentFillEnd}
                    />
                  )}
                </span>
              );
            })}
        </div>
      </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {stackMediaRevealStyle ? (
          <div
            className="absolute inset-0 overflow-hidden"
            style={stackMediaRevealStyle}
          >
            {mediaLayer}
          </div>
        ) : (
          mediaLayer
        )}

        {deckChrome ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-2 md:p-3">
          <div className="pointer-events-auto">
            <WidgetChromeArrowButton
              dir="left"
              label={
                stackNav ? "Vorheriges Widget" : "Vorheriges Bild"
              }
              onClick={
                stackNav ? stackNav.onPrev : goPrev
              }
              disabled={
                prevIndex != null || !!stackNav?.locked
              }
            />
          </div>
          <div className="pointer-events-auto">
            <WidgetChromeArrowButton
              dir="right"
              label={stackNav ? "Nächstes Widget" : "Nächstes Bild"}
              onClick={stackNav ? stackNav.onNext : goNext}
              disabled={
                prevIndex != null || !!stackNav?.locked
              }
            />
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
