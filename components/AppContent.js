"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { APPS, isDesktopAtDefaultLayout, webAssetAppId } from "@/lib/apps";
import { webAssetManifest } from "@/lib/webAssetManifest";
import { useDesktop } from "@/context/DesktopContext";
import { NotesAppView } from "@/components/NotesAppView";
import { MediaAppView } from "@/components/MediaAppView";
import { Model3DViewer } from "@/components/Model3DViewer";
import { resolveModelBackground } from "@/lib/model3dBackground";

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
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
              darkMode ? "translate-x-[1.375rem]" : "translate-x-0.5"
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
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
              cleanUpDesktopActive
                ? "translate-x-[1.375rem]"
                : "translate-x-0.5"
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
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
              closeAllTabsActive
                ? "translate-x-[1.375rem]"
                : "translate-x-0.5"
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
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
              folderPreview ? "translate-x-[1.375rem]" : "translate-x-0.5"
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

function AssetFileViewer({ dir, file, basePath, windowId }) {
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
      />
    );
  }

  if (isImage) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-zinc-200 p-2">
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
      <div className="flex h-full min-h-0 items-center justify-center bg-black p-2">
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
      className="h-full min-h-0 w-full flex-1 border-0 bg-white dark:bg-zinc-950"
    />
  );
}

function FinderView() {
  const { openOrFocus } = useDesktop();

  return (
    <div className="flex h-full min-h-0 bg-white text-sm text-zinc-800">
      <aside className="w-40 shrink-0 border-r-2 border-black bg-zinc-100 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Geräte
        </p>
        <ul className="mt-2 space-y-0.5 text-zinc-700">
          <li className="px-2 py-1 hover:bg-zinc-200/80">Macintosh HD</li>
          <li className="px-2 py-1 hover:bg-zinc-200/80">Netzwerk</li>
        </ul>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Favoriten
        </p>
        <ul className="mt-2 space-y-0.5 text-zinc-700">
          <li className="px-2 py-1 hover:bg-zinc-200/80">Schreibtisch</li>
          <li className="px-2 py-1 hover:bg-zinc-200/80">Dokumente</li>
        </ul>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b-2 border-black px-3 py-2">
          <p className="text-xs text-zinc-500">mm-os · Web</p>
          <p className="font-medium text-zinc-900">Ordner</p>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-auto p-2">
          {webAssetManifest.map(({ dir }) => (
            <li key={dir}>
              <button
                type="button"
                onClick={() => openOrFocus(webAssetAppId(dir))}
                className="flex w-full min-w-0 items-center gap-2 px-2 py-2 text-left text-zinc-800 transition-colors hover:bg-zinc-100"
              >
                <span aria-hidden>📁</span>
                <span className="truncate">{dir}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AssetSubfolderView({ dir, basePath = "/web" }) {
  const { openAssetFileWindow } = useDesktop();
  const entry = webAssetManifest.find((x) => x.dir === dir);
  const files = entry?.files ?? [];
  return (
    <div className="flex h-full flex-col gap-2 overflow-auto bg-white p-3 text-sm text-zinc-800">
      <p className="shrink-0 font-medium text-zinc-900">📁 {dir}</p>
      <p className="text-xs text-zinc-500">
        <code className="text-zinc-600">{basePath}/{dir}</code>
      </p>
      {files.length === 0 ? (
        <p className="text-zinc-500">Keine Dateien im Manifest — <code className="text-zinc-700">npm run sync:web</code> ausführen.</p>
      ) : (
        <ul className="space-y-0.5 text-zinc-700">
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

export function AppContent({ appId, assetFile, windowId }) {
  const app = APPS[appId];
  if (appId === "assetFile" && assetFile?.dir && assetFile?.file) {
    return (
      <AssetFileViewer
        dir={assetFile.dir}
        file={assetFile.file}
        basePath={assetFile.basePath ?? "/web"}
        windowId={windowId}
      />
    );
  }

  if (app?.assetDir) {
    return (
      <AssetSubfolderView dir={app.assetDir} basePath="/web" />
    );
  }

  switch (appId) {
    case "finder":
      return <FinderView />;
    case "notes":
      return <NotesAppView />;
    case "media":
      return <MediaAppView windowId={windowId} />;
    case "settings":
      return (
        <div className="flex h-full min-h-0 w-full items-start justify-center overflow-auto">
          <SettingsPanel windowId={windowId} />
        </div>
      );
    default:
      return (
        <div className="flex h-full items-center justify-center bg-white text-sm text-zinc-500">
          Unknown app
        </div>
      );
  }
}
