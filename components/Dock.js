"use client";

import { APPS } from "@/lib/apps";
import { useDesktop } from "@/context/DesktopContext";

const ORDER = ["finder", "browser", "notes", "terminal", "settings"];

export function Dock() {
  const { windows, openOrFocus, focusWindow } = useDesktop();

  const isRunning = (appId) => windows.some((w) => w.appId === appId);

  return (
    <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-[190] flex justify-center px-4">
      <nav
        className="pointer-events-auto flex items-end gap-1 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 shadow-lg backdrop-blur-xl"
        aria-label="Application dock"
      >
        {ORDER.map((id) => {
          const app = APPS[id];
          if (!app) return null;
          return (
            <button
              key={id}
              type="button"
              className="group relative flex flex-col items-center rounded-xl px-2 pb-1 pt-2 transition-transform hover:scale-110 active:scale-95"
              onClick={() => {
                const w = windows.find((x) => x.appId === id);
                if (w && !w.minimized) focusWindow(w.id);
                else openOrFocus(id);
              }}
              title={app.title}
            >
              <span className="text-4xl drop-shadow-md" aria-hidden>
                {app.icon}
              </span>
              {isRunning(id) && (
                <span
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-white/90"
                  aria-hidden
                />
              )}
              <span className="sr-only">{app.title}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
