"use client";

import { AppIcon } from "@/components/AppIcon";
import { APPS } from "@/lib/apps";
import { useDesktop } from "@/context/DesktopContext";

const BASE_ORDER = ["finder", "notes", "media", "settings"];

export function Dock() {
  const { windows, openOrFocus, focusWindow } = useDesktop();

  const dockIds = BASE_ORDER;

  return (
    <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-[190] flex justify-center px-4">
      <nav
        className="group/dock pointer-events-auto relative flex items-end justify-center rounded-2xl"
        aria-label="Application dock"
      >
        <div
          className="relative origin-bottom scale-[0.72] transition-transform duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] group-hover/dock:scale-100 [@media(hover:none)]:scale-100"
        >
          <div
            className="mm-dock-frame pointer-events-none absolute inset-0 rounded-2xl border border-black/10 bg-white/55 shadow-lg shadow-black/10 backdrop-blur-xl [transform-origin:bottom] dark:border-white/10 dark:bg-zinc-800/75 dark:shadow-black/40"
            aria-hidden
          />
          <div className="relative z-[1] flex items-end gap-1 px-3 py-2">
            {dockIds.map((id) => {
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
                      className="inline-flex drop-shadow-md transition-transform duration-200 ease-out [transform-origin:bottom] group-hover:scale-[1.15]"
                      aria-hidden
                    >
                      <AppIcon app={app} />
                    </span>
                  </span>
                  <span className="sr-only">{app.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
