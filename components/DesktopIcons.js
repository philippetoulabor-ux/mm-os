"use client";

import { useState } from "react";
import { APPS, DESKTOP_ICONS } from "@/lib/apps";
import { useDesktop } from "@/context/DesktopContext";

export function DesktopIcons() {
  const { openOrFocus } = useDesktop();
  const [selected, setSelected] = useState(null);

  return (
    <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-6 sm:left-6 sm:top-6">
      {DESKTOP_ICONS.map((item) => {
        const app = APPS[item.appId];
        if (!app) return null;
        const isSel = selected === item.appId;
        return (
          <button
            key={item.appId}
            type="button"
            className={`flex w-20 flex-col items-center gap-1 rounded-lg p-2 text-center outline-none transition-colors ${
              isSel ? "bg-white/15" : "hover:bg-white/10"
            }`}
            onClick={() => setSelected(item.appId)}
            onDoubleClick={() => openOrFocus(item.appId)}
          >
            <span className="text-4xl drop-shadow-md filter" aria-hidden>
              {app.icon}
            </span>
            <span className="max-w-full truncate text-xs font-medium text-white drop-shadow [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
