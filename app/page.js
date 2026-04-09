import { DesktopShell } from "@/components/DesktopShell";

export default function Home() {
  return (
    <div
      className="mm-os-page-root"
      style={{
        minHeight: "max(100dvh, 800px)",
        backgroundColor: "var(--mm-desktop-bg)",
      }}
    >
      <DesktopShell />
    </div>
  );
}
