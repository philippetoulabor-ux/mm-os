import { DesktopShell } from "@/components/DesktopShell";

export default function Home() {
  return (
    <div
      className="mm-os-page-root"
      style={{
        backgroundColor: "var(--mm-desktop-bg)",
      }}
    >
      <DesktopShell />
    </div>
  );
}
