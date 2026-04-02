"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  APPS,
  assetDirDisplayName,
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
        <span className="max-w-full truncate text-center font-mono text-[10px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300">
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

function AssetFileViewer({ dir, file, basePath, windowId, unifiedParentScroll = false }) {
  const { fitWindowToContentSize } = useDesktop();
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
    fitWindowToContentSize(windowId, w, h);
  }, [windowId, file, url, isImage, isVideo, is3d, fitWindowToContentSize]);

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
        className={`flex items-center justify-center bg-zinc-200 p-2 ${
          unifiedParentScroll
            ? "min-h-[50vh] w-full"
            : "h-full min-h-0 overflow-auto"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={file}
          className="max-h-full max-w-full object-contain"
          onLoad={onImgLoad}
        />
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
    <iframe
      title={file}
      src={url}
      className={`min-h-0 w-full border-0 bg-white dark:bg-zinc-950 ${
        unifiedParentScroll
          ? "min-h-[70vh] flex-none"
          : "h-full flex-1"
      }`}
    />
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
      className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-md ring-1 ring-black/10 dark:ring-white/15"
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
        <span className="max-w-full truncate text-center font-mono text-[9px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300">
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
          className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-md ring-1 ring-black/10 dark:ring-white/15"
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
          className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-md ring-1 ring-black/10 dark:ring-white/15"
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

function FinderView({ unifiedParentScroll = false }) {
  const { openOrFocus, openAssetFileWindow, folderPreview } = useDesktop();
  const [query, setQuery] = useState("");
  const q = query.trim();
  const searchHits = filterFinderSearchIndex(q);
  const showSearch = q.length > 0;
  const rows = showSearch ? searchHits : FINDER_BROWSE_ROWS;

  const openHit = (row) => {
    if (row.kind === "file") {
      openAssetFileWindow({ dir: row.dir, file: row.file, basePath: "/web" });
    } else {
      openOrFocus(row.appId);
    }
  };

  return (
    <div
      className={`flex min-h-0 flex-col bg-white text-sm text-zinc-800 ${
        unifiedParentScroll
          ? "h-auto overflow-visible"
          : "h-full overflow-hidden"
      }`}
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
            id="finder-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
      <ul
        className={
          unifiedParentScroll
            ? "space-y-0.5 p-2"
            : "min-h-0 flex-1 space-y-0.5 overflow-auto p-2"
        }
      >
        {rows.length === 0 ? (
          <li className="px-2 py-3 text-zinc-500">
            {showSearch ? "Keine Treffer." : "Keine Einträge."}
          </li>
        ) : (
          rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => openHit(row)}
                className="flex w-full min-w-0 items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-zinc-100"
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

function AssetSubfolderView({ dir, basePath = "/web", unifiedParentScroll = false }) {
  const { openAssetFileWindow } = useDesktop();
  const entry = webAssetManifest.find((x) => x.dir === dir);
  const files = entry?.files ?? [];
  return (
    <div
      className={`flex flex-col gap-2 bg-white p-3 text-sm text-zinc-800 max-md:items-center ${
        unifiedParentScroll ? "h-auto overflow-visible" : "h-full overflow-auto"
      }`}
    >
      {!unifiedParentScroll ? (
        <>
          <p className="w-full shrink-0 text-center font-medium text-zinc-900 md:text-left">
            📁 {assetDirDisplayName(dir)}
          </p>
          <p className="w-full text-center text-xs text-zinc-500 md:text-left">
            <code className="text-zinc-600">{basePath}/{dir}</code>
          </p>
        </>
      ) : null}
      {files.length === 0 ? (
        <p className="w-full text-center text-zinc-500 md:text-left">
          Keine Dateien im Manifest —{" "}
          <code className="text-zinc-700">npm run sync:web</code> ausführen.
        </p>
      ) : (
        <ul className="w-full space-y-0.5 text-left text-zinc-700">
          {files.map((file) => (
            <li key={file}>
              <button
                type="button"
                onClick={() =>
                  openAssetFileWindow({ dir, file, basePath })
                }
                className="flex w-full min-w-0 items-center gap-2 rounded px-1 py-1 text-left text-zinc-900 underline decoration-zinc-400 hover:bg-zinc-100 hover:decoration-zinc-900"
              >
                <AssetFileListThumb
                  href={fileHref(basePath, dir, file)}
                  file={file}
                />
                <span className="min-w-0 truncate">{file}</span>
              </button>
            </li>
          ))}
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
      <AssetFileViewer
        dir={assetFile.dir}
        file={assetFile.file}
        basePath={assetFile.basePath ?? "/web"}
        windowId={windowId}
        unifiedParentScroll={unifiedParentScroll}
      />
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
