"use client";

import { useEffect, useState } from "react";

export function MenuBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      setTime(
        new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date())
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="relative z-[200] flex h-7 items-center justify-between border-b border-white/10 bg-black/35 px-3 text-xs text-white backdrop-blur-md">
      <div className="flex items-center gap-4">
        <span className="text-base leading-none opacity-90" aria-hidden title="Menu">
          ⌘
        </span>
        <span className="font-semibold">mm-os</span>
        <span className="hidden text-zinc-300 sm:inline">File</span>
        <span className="hidden text-zinc-300 sm:inline">Edit</span>
        <span className="hidden text-zinc-300 sm:inline">View</span>
        <span className="hidden text-zinc-300 sm:inline">Window</span>
        <span className="hidden text-zinc-300 sm:inline">Help</span>
      </div>
      <div className="flex items-center gap-3 tabular-nums text-zinc-200">
        <span className="hidden sm:inline">100%</span>
        <span>{time}</span>
      </div>
    </header>
  );
}
