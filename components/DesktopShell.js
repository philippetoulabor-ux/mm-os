"use client";

import { DesktopProvider } from "@/context/DesktopContext";
import { Dock } from "@/components/Dock";
import { DesktopIcons } from "@/components/DesktopIcons";
import { MenuBar } from "@/components/MenuBar";
import { OSWindow } from "@/components/OSWindow";
import { useDesktop } from "@/context/DesktopContext";

function DesktopLayers() {
  const { windows } = useDesktop();
  const sorted = [...windows].sort((a, b) => a.z - b.z);

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(120,160,255,0.35),transparent),linear-gradient(165deg,#1a1d2e_0%,#0d0f18_45%,#12151f_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <DesktopIcons />
      {sorted.map((w) => (
        <OSWindow key={w.id} win={w} />
      ))}
      <Dock />
    </>
  );
}

export function DesktopShell() {
  return (
    <DesktopProvider>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-black text-zinc-100">
        <MenuBar />
        <div className="relative min-h-0 flex-1">
          <DesktopLayers />
        </div>
      </div>
    </DesktopProvider>
  );
}
