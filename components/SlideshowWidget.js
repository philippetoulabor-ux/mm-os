"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { STEP_SLIDESHOW_DEFAULT_FILES } from "@/lib/desktopWidgets";
import { fileHref, listSlideImageFiles } from "@/lib/webAssetUrls";

function ArrowButton({ dir, label, onClick }) {
  return (
    <button
      type="button"
      data-mm-widget-no-drag
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-md transition-transform active:scale-95 md:h-11 md:w-11"
    >
      <svg
        className="h-5 w-5"
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
 * }} props
 */
function slideshowRestrictTo(widget) {
  if (widget.slideShowAll) return undefined;
  if (Array.isArray(widget.slideFiles)) return widget.slideFiles;
  if (widget.assetDir === "step") return STEP_SLIDESHOW_DEFAULT_FILES;
  return undefined;
}

export function SlideshowWidget({ widget, layout, dragHandleProps }) {
  const basePath = widget.basePath ?? "/web";
  const files = useMemo(
    () =>
      listSlideImageFiles(widget.assetDir, basePath, {
        restrictTo: slideshowRestrictTo(widget),
      }),
    [widget, basePath]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [widget.assetDir, widget.id]);

  const n = files.length;

  useEffect(() => {
    setIndex((i) => (n === 0 ? 0 : Math.min(i, n - 1)));
  }, [n]);

  const safeIndex = n === 0 ? 0 : Math.min(index, n - 1);
  const currentFile = n > 0 ? files[safeIndex] : null;
  const src = currentFile
    ? fileHref(basePath, widget.assetDir, currentFile)
    : null;

  const goPrev = useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i - 1 + n) % n);
  }, [n]);

  const goNext = useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i + 1) % n);
  }, [n]);

  const isMobile = layout === "mobile";

  const rootDrag =
    layout === "desktop" && dragHandleProps ? dragHandleProps : {};

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white/55 shadow-lg shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-800/75 dark:shadow-black/40 ${
        isMobile
          ? /* Mobile Home: 3×2 Rasterzellen, rechts */
            "ml-auto aspect-[3/2] w-[75%] max-w-full shrink-0"
          : "h-full w-full md:cursor-grab md:active:cursor-grabbing"
      }`}
      {...rootDrag}
    >
      <div className="absolute left-0 right-0 top-0 z-20 w-full px-1.5 pt-1">
        <div className="flex w-full min-w-0 items-center gap-1 py-0.5">
          {n > 0 &&
            files.map((_, i) => (
              <span
                key={i}
                className={`h-1 min-w-0 flex-1 rounded-full transition-colors ${
                  i === safeIndex
                    ? "bg-zinc-900 dark:bg-white"
                    : "bg-zinc-900/35 dark:bg-white/40"
                }`}
              />
            ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-zinc-600 dark:text-white/80">
            Keine Bilder in diesem Ordner (Manifest).
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-2 md:p-3">
          <div className="pointer-events-auto">
            <ArrowButton dir="left" label="Vorheriges Bild" onClick={goPrev} />
          </div>
          <div className="pointer-events-auto">
            <ArrowButton dir="right" label="Nächstes Bild" onClick={goNext} />
          </div>
        </div>
      </div>
    </div>
  );
}
