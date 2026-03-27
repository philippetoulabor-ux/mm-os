import { DesktopShell } from "@/components/DesktopShell";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--mm-desktop-bg)",
      }}
    >
      <DesktopShell />
    </div>
  );
}
