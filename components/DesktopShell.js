"use client";

import { DesktopProvider } from "@/context/DesktopContext";
import { Dock } from "@/components/Dock";
import { DesktopIcons } from "@/components/DesktopIcons";
import { OSWindow } from "@/components/OSWindow";
import { SiteHeader } from "@/components/SiteHeader";
import { useDesktop } from "@/context/DesktopContext";

function DesktopLayers() {
  const { windows } = useDesktop();
  const sorted = [...windows].sort((a, b) => a.z - b.z);

  return (
    <>
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
      {/* Inline-Höhe/-Farbe: funktioniert auch wenn Tailwind-Klassen nicht geladen werden; Flex statt Grid (weniger fragile JIT-Klassen) */}
      <div
        className="flex h-[100dvh] min-h-0 w-full flex-col overflow-x-hidden"
        style={{
          backgroundColor: "var(--mm-desktop-bg)",
          color: "var(--mm-shell-text)",
        }}
      >
        <SiteHeader />
        {/* overflow-visible: Fenster dürfen nach oben in den Header-Bereich (negatives top) */}
        <div className="relative z-10 min-h-0 flex-1 overflow-visible">
          <DesktopLayers />
        </div>
      </div>
    </DesktopProvider>
  );
}
