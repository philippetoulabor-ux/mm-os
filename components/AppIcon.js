"use client";

import { useId } from "react";

/** Stift-Icon für die Notes-App (kompakt, gut lesbar in h-9 w-9). */
export function NotesAppIcon({ className = "" }) {
  const uid = useId().replace(/:/g, "");
  const gid = `notes-pencil-${uid}`;

  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={`${gid}-wood`}
          x1="20.5"
          y1="16"
          x2="27.5"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <filter
          id={`${gid}-s`}
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
        >
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="1.5"
            floodColor="#000"
            floodOpacity="0.18"
          />
        </filter>
      </defs>
      <g filter={`url(#${gid}-s)`}>
        <g transform="translate(24 24) rotate(-45) translate(-24 -24)">
          <rect x="20" y="6" width="8" height="7" rx="2" fill="#F472B6" />
          <rect x="20.5" y="13" width="7" height="3" rx="0.5" fill="#94A3B8" />
          <rect
            x="20.5"
            y="16"
            width="7"
            height="20"
            rx="1"
            fill={`url(#${gid}-wood)`}
          />
          <path d="M20.5 36 L24 42 L27.5 36 Z" fill="#0F172A" />
          <path d="M22.5 36 L24 39.2 L25.5 36 Z" fill="#64748B" />
        </g>
      </g>
    </svg>
  );
}

/**
 * @param {{ app: { id: string; icon: string; iconSrc?: string }; variant?: "default" | "compact" | "desktop" | "desktopGrid" | "finderList" }} props
 */
export function AppIcon({ app, variant = "default" }) {
  if (app.id === "notes") {
    const sz =
      variant === "compact"
        ? "h-6 w-6"
        : variant === "finderList"
          ? "h-[37.5px] w-[37.5px]"
          : variant === "desktopGrid"
            ? "h-14 w-14"
            : variant === "desktop"
              ? "h-10 w-10"
              : "h-9 w-9";
    return <NotesAppIcon className={sz} />;
  }
  if (app.iconSrc) {
    const sz =
      variant === "compact"
        ? "h-6 w-6"
        : variant === "finderList"
          ? "h-[37.5px] w-[37.5px]"
          : variant === "desktopGrid"
            ? "h-14 w-14"
            : variant === "desktop"
              ? "h-10 w-10"
              : "h-9 w-9";
    const isSvg = app.iconSrc.endsWith(".svg");
    return (
      <span
        className={`inline-flex overflow-hidden ${
          isSvg ? "rounded-md" : "rounded-full"
        } ${sz} shrink-0`}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={app.iconSrc}
          alt=""
          className={
            isSvg
              ? "h-full w-full object-contain object-center p-0.5"
              : "h-full w-full scale-[1.26] object-cover object-center"
          }
          draggable={false}
        />
      </span>
    );
  }
  const text =
    variant === "compact"
      ? "text-lg leading-none"
      : variant === "finderList"
        ? "text-4xl leading-none"
        : variant === "desktopGrid"
          ? "text-[3.5rem] leading-none"
          : variant === "desktop"
            ? "text-[2.5rem] leading-none"
            : "text-4xl leading-none";
  return (
    <span className={`inline-flex items-center justify-center ${text}`}>
      {app.icon}
    </span>
  );
}
