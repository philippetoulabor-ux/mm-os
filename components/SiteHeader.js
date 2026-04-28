"use client";

import dynamic from "next/dynamic";
import { logoConfig } from "@/lib/logoConfig";

const LogoViewer = dynamic(
  () => import("@/components/LogoViewer"),
  { ssr: false, loading: () => <div className="logo-placeholder" aria-hidden /> }
);

export function SiteHeader({ onLogoClick } = {}) {
  return (
    <header className="mm-os-site-header">
      <LogoViewer config={logoConfig} skipRouterClick onLogoClick={onLogoClick} />
    </header>
  );
}
