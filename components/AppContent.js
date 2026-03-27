"use client";

import { APPS, isDesktopAtDefaultLayout, webAssetAppId } from "@/lib/apps";
import { webAssetManifest } from "@/lib/webAssetManifest";
import { useDesktop } from "@/context/DesktopContext";

function SettingsPanel() {
  const {
    darkMode,
    setDarkMode,
    resetDesktopIconPositions,
    desktopIconPositions,
  } = useDesktop();
  const cleanUpDesktopActive = isDesktopAtDefaultLayout(desktopIconPositions);

  return (
    <div className="space-y-4 p-4 text-sm text-zinc-200">
      <div className="flex items-center justify-between gap-4">
        <span className="text-zinc-300">DarkMode</span>
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
        <span className="text-zinc-300">CleanUpDesktop</span>
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
    </div>
  );
}

function fileIcon(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".stl")) return "🔷";
  if (lower.endsWith(".glb")) return "🧊";
  if (/\.(mov|mp4|webm)$/i.test(name)) return "🎬";
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return "🖼";
  if (/\.pdf$/i.test(name)) return "📕";
  return "📄";
}

function fileHref(basePath, dir, file) {
  return `${basePath}/${encodeURIComponent(dir)}/${encodeURIComponent(file)}`;
}

function FinderView() {
  const { openOrFocus } = useDesktop();

  return (
    <div className="flex h-full min-h-0 text-sm text-zinc-200">
      <aside className="w-40 shrink-0 border-r border-white/10 bg-black/20 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Geräte
        </p>
        <ul className="mt-2 space-y-0.5 text-zinc-400">
          <li className="rounded px-2 py-1 hover:bg-white/10">Macintosh HD</li>
          <li className="rounded px-2 py-1 hover:bg-white/10">Netzwerk</li>
        </ul>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Favoriten
        </p>
        <ul className="mt-2 space-y-0.5 text-zinc-400">
          <li className="rounded px-2 py-1 hover:bg-white/10">Schreibtisch</li>
          <li className="rounded px-2 py-1 hover:bg-white/10">Dokumente</li>
        </ul>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/10 px-3 py-2">
          <p className="text-xs text-zinc-500">mm-os · Web</p>
          <p className="font-medium text-white">Ordner</p>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-auto p-2">
          {webAssetManifest.map(({ dir }) => (
            <li key={dir}>
              <button
                type="button"
                onClick={() => openOrFocus(webAssetAppId(dir))}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
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
  const entry = webAssetManifest.find((x) => x.dir === dir);
  const files = entry?.files ?? [];
  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-3 text-sm text-zinc-200">
      <p className="shrink-0 font-medium text-white">📁 {dir}</p>
      <p className="text-xs text-zinc-500">
        <code className="text-zinc-400">{basePath}/{dir}</code>
      </p>
      {files.length === 0 ? (
        <p className="text-zinc-500">Keine Dateien im Manifest — <code>npm run sync:web</code> ausführen.</p>
      ) : (
        <ul className="space-y-0.5 text-zinc-400">
          {files.map((file) => (
            <li key={file}>
              <a
                href={fileHref(basePath, dir, file)}
                className="block rounded px-1 text-sky-400 hover:bg-white/10 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {fileIcon(file)} {file}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AppContent({ appId }) {
  const app = APPS[appId];
  if (app?.assetDir) {
    return <AssetSubfolderView dir={app.assetDir} basePath="/web" />;
  }

  switch (appId) {
    case "finder":
      return <FinderView />;
    case "notes":
      return (
        <textarea
          className="h-full w-full resize-none bg-amber-50/95 p-4 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
          placeholder="Type a note…"
          defaultValue="Welcome to mm-os Notes.\n\nDouble-click icons or use the dock to open apps."
        />
      );
    case "settings":
      return <SettingsPanel />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-zinc-500">
          Unknown app
        </div>
      );
  }
}
