"use client";

import { APPS } from "@/lib/apps";

export function AppContent({ appId }) {
  switch (appId) {
    case "finder":
      return (
        <div className="flex h-full flex-col gap-2 p-3 text-sm text-zinc-200">
          <p className="font-medium text-white">Devices</p>
          <ul className="space-y-1 text-zinc-400">
            <li className="rounded px-2 py-1 hover:bg-white/10">Macintosh HD</li>
            <li className="rounded px-2 py-1 hover:bg-white/10">Network</li>
          </ul>
          <p className="mt-2 font-medium text-white">Favorites</p>
          <ul className="space-y-1 text-zinc-400">
            <li className="rounded px-2 py-1 hover:bg-white/10">Desktop</li>
            <li className="rounded px-2 py-1 hover:bg-white/10">Documents</li>
          </ul>
        </div>
      );
    case "browser":
      return (
        <div className="flex h-full flex-col bg-zinc-900/80">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 text-xs text-zinc-500">
              <span className="opacity-60">🔒</span>
              <span>https://example.com</span>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
            Page content would load here — this is a static shell.
          </div>
        </div>
      );
    case "notes":
      return (
        <textarea
          className="h-full w-full resize-none bg-amber-50/95 p-4 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
          placeholder="Type a note…"
          defaultValue="Welcome to mm-os Notes.\n\nDouble-click icons or use the dock to open apps."
        />
      );
    case "terminal":
      return (
        <div className="h-full overflow-auto bg-[#1e1e1e] p-3 font-mono text-xs text-green-400">
          <p className="text-zinc-500">Last login: {new Date().toLocaleString()}</p>
          <p className="mt-2">
            <span className="text-green-500">user@mm-os</span>
            <span className="text-zinc-500">:~$ </span>
            <span className="animate-pulse">▌</span>
          </p>
        </div>
      );
    case "settings":
      return (
        <div className="space-y-4 p-4 text-sm text-zinc-200">
          <div>
            <label className="text-xs text-zinc-500">Appearance</label>
            <p className="mt-1 text-zinc-400">
              Desktop theme is fixed for this demo — extend with your own prefs.
            </p>
          </div>
          <div className="h-px bg-white/10" />
          <div>
            <label className="text-xs text-zinc-500">About</label>
            <p className="mt-1 text-zinc-400">{APPS.settings.title} · mm-os shell</p>
          </div>
        </div>
      );
    default:
      return (
        <div className="flex h-full items-center justify-center text-zinc-500">
          Unknown app
        </div>
      );
  }
}
