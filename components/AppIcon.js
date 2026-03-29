"use client";

import { useId } from "react";

/** Apple-style Notes squircle: warm yellow field + ruled paper (inspired by system Notes, not a copy). */
export function NotesAppIcon({ className = "" }) {
  const uid = useId().replace(/:/g, "");
  const gid = `notes-${uid}`;

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
          id={`${gid}-y`}
          x1="24"
          y1="4"
          x2="24"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFE98A" />
          <stop offset="1" stopColor="#FFC80A" />
        </linearGradient>
        <linearGradient
          id={`${gid}-p`}
          x1="24"
          y1="20"
          x2="24"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFEF9" />
          <stop offset="1" stopColor="#F5F0E8" />
        </linearGradient>
        <filter
          id={`${gid}-s`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1.2"
            floodColor="#000"
            floodOpacity="0.14"
          />
        </filter>
      </defs>
      <rect
        x="4"
        y="4"
        width="40"
        height="40"
        rx="10.5"
        fill={`url(#${gid}-y)`}
        filter={`url(#${gid}-s)`}
      />
      <path
        d="M9 19.5c0-1.1.9-2 2-2h26c1.1 0 2 .9 2 2v20.5c0 1.66-1.34 3-3 3H12c-1.66 0-3-1.34-3-3V19.5Z"
        fill={`url(#${gid}-p)`}
        stroke="#000"
        strokeOpacity="0.06"
        strokeWidth="0.75"
      />
      <line
        x1="13"
        y1="25.5"
        x2="35"
        y2="25.5"
        stroke="#D4CDC2"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <line
        x1="13"
        y1="30.5"
        x2="35"
        y2="30.5"
        stroke="#D4CDC2"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <line
        x1="13"
        y1="35.5"
        x2="31"
        y2="35.5"
        stroke="#D4CDC2"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <line
        x1="13"
        y1="40.5"
        x2="27"
        y2="40.5"
        stroke="#D4CDC2"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * @param {{ app: { id: string; icon: string }; variant?: "default" | "compact" }} props
 */
export function AppIcon({ app, variant = "default" }) {
  if (app.id === "notes") {
    const sz = variant === "compact" ? "h-6 w-6" : "h-9 w-9";
    return <NotesAppIcon className={sz} />;
  }
  const text =
    variant === "compact" ? "text-lg leading-none" : "text-4xl leading-none";
  return (
    <span className={`inline-flex items-center justify-center ${text}`}>
      {app.icon}
    </span>
  );
}
