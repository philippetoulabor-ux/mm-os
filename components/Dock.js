"use client";

import { APPS } from "@/lib/apps";
import { useDesktop } from "@/context/DesktopContext";

const ORDER = ["finder", "notes", "settings"];

export function Dock() {
  const { windows, openOrFocus, focusWindow } = useDesktop();

  const isRunning = (appId) => windows.some((w) => w.appId === appId);

  return (
    <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-[190] flex justify-center px-4">
      <nav
        className="pointer-events-auto relative flex items-end rounded-2xl has-[button:hover]:[&_.mm-dock-frame]:scale-[1.05]"
        aria-label="Application dock"
      >
        <div
          className="mm-dock-frame pointer-events-none absolute inset-0 rounded-2xl border border-black/10 bg-white/55 shadow-lg shadow-black/10 backdrop-blur-xl transition-transform duration-200 ease-out [transform-origin:bottom] dark:border-white/10 dark:bg-zinc-800/75 dark:shadow-black/40"
          aria-hidden
        />
        <div className="relative z-[1] flex items-end gap-1 px-3 py-2">
          {ORDER.map((id) => {
            const app = APPS[id];
            if (!app) return null;
            return (
              <button
                key={id}
                type="button"
                className="group relative flex min-h-[3.25rem] min-w-[2.5rem] flex-col items-center justify-end bg-transparent px-2 pb-1 pt-2 transition-transform active:scale-95"
                onClick={() => {
                  const w = windows.find((x) => x.appId === id);
                  if (w && !w.minimized) focusWindow(w.id);
                  else openOrFocus(id);
                }}
              >
                <span
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-black/10 bg-white/95 px-2 py-0.5 text-xs font-medium text-zinc-800 opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 dark:border-white/15 dark:bg-zinc-900/95 dark:text-zinc-100"
                  aria-hidden
                >
                  {app.title}
                </span>
                <span className="relative flex flex-col items-center">
                  <span
                    className="text-4xl drop-shadow-md transition-transform duration-200 ease-out [transform-origin:bottom] group-hover:scale-[1.15]"
                    aria-hidden
                  >
                    {app.icon}
                  </span>
                  {isRunning(id) && (
                    <span
                      className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-zinc-800/80 dark:bg-zinc-200/90"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="sr-only">{app.title}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
