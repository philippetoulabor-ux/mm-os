"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktop } from "@/context/DesktopContext";

/** Passt zu `w-64` / 16rem (Library-Breite in globals.css). */
const LIBRARY_PANEL_PX = 256;

/**
 * Pro Eintrag: `youtubePlaylistId` (?list=…) oder `videos: ["id1", …]`.
 * Wiedergabe: YouTube-Embed mit IFrame API (nur für Titelleiste, kein API-Key).
 */
const PLAYLISTS = [
  {
    label: "Meine Playlist",
    youtubePlaylistId: "PLug6cjFdyrQKNHXgv-VrzW8_3jP4Fp3Gc",
  },
];

const MEDIA_STATE_KEY = "mm-os-media-state";

function readPlaylistIndex() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(MEDIA_STATE_KEY);
    if (!raw) return 0;
    const o = JSON.parse(raw);
    const rawPi = Number.isFinite(o?.playlistIndex)
      ? Math.max(0, Math.floor(o.playlistIndex))
      : 0;
    return Math.min(rawPi, Math.max(0, PLAYLISTS.length - 1));
  } catch {
    return 0;
  }
}

/** @param {{ youtubePlaylistId?: string; videos?: string[] }} entry @param {string} [origin] */
function embedUrlForEntry(entry, origin) {
  if (!entry) return null;
  const base = {
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    controls: "0",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    playsinline: "1",
  };
  if (entry.youtubePlaylistId) {
    const q = new URLSearchParams({
      ...base,
      list: entry.youtubePlaylistId,
    });
    if (origin) q.set("origin", origin);
    return `https://www.youtube.com/embed/videoseries?${q.toString()}`;
  }
  if (entry.videos?.length) {
    const [first, ...rest] = entry.videos;
    const q = new URLSearchParams({ ...base });
    if (origin) q.set("origin", origin);
    if (rest.length) q.set("playlist", rest.join(","));
    return `https://www.youtube.com/embed/${encodeURIComponent(first)}?${q.toString()}`;
  }
  return null;
}

const YT_IFRAME_ID = "mm-wmp-yt-iframe";

/** Sekunden: darüber → Zurück springt an den Anfang; darunter → vorheriges Video. */
const SKIP_BACK_RESTART_SEC = 2.5;

/** Max. automatische Weiterschaltungen bei Fehler (Alter, Embed, nicht gefunden, …). */
const MAX_ERROR_AUTO_SKIPS = 48;

/** @returns {Promise<void>} */
function loadYoutubeIframeApi() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      if (window.YT?.Player) resolve();
    };
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      prev?.();
      finish();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    } else {
      const id = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(id);
          resolve();
        }
      }, 32);
      window.setTimeout(() => window.clearInterval(id), 20000);
    }
  });
}

export function MediaAppView({ windowId }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [apiOrigin, setApiOrigin] = useState("");
  const [playingTitle, setPlayingTitle] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const ytPlayerRef = useRef(null);
  const errorAutoSkipCountRef = useRef(0);

  const [playlistIndex, setPlaylistIndex] = useState(() => readPlaylistIndex());

  useEffect(() => {
    setApiOrigin(window.location.origin);
  }, []);

  const { windows, setWindowBounds } = useDesktop();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryCloseAnimating, setLibraryCloseAnimating] = useState(false);
  const [libraryEnterAnim, setLibraryEnterAnim] = useState(false);

  const embedUrl = useMemo(
    () => embedUrlForEntry(PLAYLISTS[playlistIndex], apiOrigin || undefined),
    [playlistIndex, apiOrigin]
  );

  useEffect(() => {
    setIframeLoaded(false);
    setPlayingTitle("");
    setIsPlaying(false);
    setPlayerReady(false);
    errorAutoSkipCountRef.current = 0;
  }, [embedUrl]);

  useEffect(() => {
    if (!embedUrl || !iframeLoaded) return undefined;

    let cancelled = false;

    loadYoutubeIframeApi().then(() => {
      if (cancelled || typeof window === "undefined" || !window.YT?.Player)
        return;
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      ytPlayerRef.current = new window.YT.Player(YT_IFRAME_ID, {
        events: {
          onReady: (e) => {
            if (cancelled) return;
            setPlayerReady(true);
            const t = e.target.getVideoData()?.title;
            if (t) setPlayingTitle(t);
            const YT = window.YT;
            const ps = e.target.getPlayerState?.();
            if (ps != null && YT) {
              setIsPlaying(
                ps === YT.PlayerState.PLAYING || ps === YT.PlayerState.BUFFERING
              );
            }
          },
          onStateChange: (e) => {
            if (cancelled) return;
            const YT = window.YT;
            if (YT) {
              const ps = e.data;
              if (ps === YT.PlayerState.PLAYING) {
                errorAutoSkipCountRef.current = 0;
              }
              setIsPlaying(
                ps === YT.PlayerState.PLAYING || ps === YT.PlayerState.BUFFERING
              );
            }
            const t = e.target.getVideoData()?.title;
            if (t) setPlayingTitle(t);
          },
          onError: (e) => {
            if (cancelled) return;
            const p = e.target;
            if (!p || typeof p.nextVideo !== "function") return;
            if (errorAutoSkipCountRef.current >= MAX_ERROR_AUTO_SKIPS) return;
            errorAutoSkipCountRef.current += 1;
            try {
              p.nextVideo();
            } catch {
              /* ignore */
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      ytPlayerRef.current = null;
    };
  }, [embedUrl, iframeLoaded]);

  const togglePlayPause = useCallback(() => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.getPlayerState !== "function") return;
    const YT = window.YT;
    if (!YT) return;
    const s = p.getPlayerState();
    if (s === YT.PlayerState.PLAYING || s === YT.PlayerState.BUFFERING) {
      p.pauseVideo();
    } else {
      p.playVideo();
    }
  }, []);

  const skipForward = useCallback(() => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.nextVideo !== "function") return;
    p.nextVideo();
  }, []);

  const skipBackward = useCallback(() => {
    const p = ytPlayerRef.current;
    if (!p) return;
    if (typeof p.getCurrentTime !== "function") return;
    const t = p.getCurrentTime();
    if (t > SKIP_BACK_RESTART_SEC && typeof p.seekTo === "function") {
      p.seekTo(0, true);
    } else if (typeof p.previousVideo === "function") {
      p.previousVideo();
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MEDIA_STATE_KEY, JSON.stringify({ playlistIndex }));
    } catch {
      /* ignore */
    }
  }, [playlistIndex]);

  const libraryDocked = libraryOpen || libraryCloseAnimating;

  const openLibrary = useCallback(() => {
    if (!windowId) return;
    const win = windows.find((w) => w.id === windowId);
    if (!win) return;
    setWindowBounds(windowId, {
      x: win.x,
      y: win.y,
      w: win.w + LIBRARY_PANEL_PX,
      h: win.h,
    });
    setLibraryOpen(true);
    setLibraryEnterAnim(true);
  }, [windowId, windows, setWindowBounds]);

  const startCloseLibrary = useCallback(() => {
    setLibraryEnterAnim(false);
    setLibraryCloseAnimating(true);
    setLibraryOpen(false);
  }, []);

  const toggleLibrary = useCallback(() => {
    if (libraryCloseAnimating) return;
    if (!libraryOpen) openLibrary();
    else startCloseLibrary();
  }, [
    libraryCloseAnimating,
    libraryOpen,
    openLibrary,
    startCloseLibrary,
  ]);

  const onLibraryOpenAnimationEnd = useCallback(() => {
    setLibraryEnterAnim(false);
  }, []);

  const onLibraryCloseTransitionEnd = useCallback(
    (e) => {
      if (!libraryCloseAnimating || !windowId) return;
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "transform") return;
      const win = windows.find((w) => w.id === windowId);
      if (!win) {
        setLibraryCloseAnimating(false);
        return;
      }
      setWindowBounds(windowId, {
        x: win.x,
        y: win.y,
        w: win.w - LIBRARY_PANEL_PX,
        h: win.h,
      });
      setLibraryCloseAnimating(false);
    },
    [libraryCloseAnimating, windowId, windows, setWindowBounds]
  );

  const onPlaylistSelect = useCallback((e) => {
    setPlaylistIndex(Number(e.target.value));
  }, []);

  return (
    <div className="mm-wmp-shell">
      <div className="mm-wmp-nav mm-wmp-nav--library-only">
        <button
          type="button"
          className={`mm-wmp-tab ${libraryDocked ? "mm-wmp-tab-active" : ""}`}
          onClick={toggleLibrary}
          disabled={libraryCloseAnimating}
          aria-expanded={libraryDocked}
          aria-controls="mm-wmp-library-panel"
          id="mm-wmp-library-trigger"
        >
          Library
        </button>
      </div>

      <div className="mm-wmp-main">
        <div className="mm-wmp-video-wrap relative flex min-h-0 min-w-0 flex-1 flex-col">
          {embedUrl ? (
            <div className="mm-wmp-now-playing" title={playingTitle || undefined}>
              {playingTitle || "…"}
            </div>
          ) : null}
          <div className="relative min-h-0 flex-1">
            {!embedUrl ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black text-xs text-zinc-500">
                Keine Playlist/Videos in MediaAppView.js konfiguriert.
              </div>
            ) : (
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black text-xs text-zinc-500">
                    Player wird geladen…
                  </div>
                )}
                <iframe
                  key={embedUrl}
                  id={YT_IFRAME_ID}
                  title="YouTube"
                  src={embedUrl}
                  className="pointer-events-none absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
                  loading="lazy"
                  onLoad={() => setIframeLoaded(true)}
                />
              </>
            )}
          </div>
          {embedUrl ? (
            <div
              className="mm-wmp-video-controls"
              role="toolbar"
              aria-label="Wiedergabe"
            >
              <button
                type="button"
                className="mm-wmp-skip"
                disabled={!playerReady}
                onClick={skipBackward}
                aria-label="Zurück: zuerst von vorn, sonst vorheriges Video"
                title="Zurück: zuerst von vorn, sonst vorheriges Video"
              >
                «
              </button>
              <button
                type="button"
                className="mm-wmp-playbtn mm-wmp-playbtn--compact"
                disabled={!playerReady}
                onClick={togglePlayPause}
                aria-label={isPlaying ? "Pause" : "Wiedergabe"}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button
                type="button"
                className="mm-wmp-skip"
                disabled={!playerReady}
                onClick={skipForward}
                aria-label="Nächstes Video"
                title="Nächstes Video"
              >
                »
              </button>
            </div>
          ) : null}
        </div>

        <div
          id="mm-wmp-library-panel"
          role="region"
          aria-labelledby="mm-wmp-library-trigger"
          aria-hidden={!libraryDocked}
          className="mm-wmp-library-rail"
          data-docked={libraryDocked ? "true" : "false"}
          data-closing={
            libraryCloseAnimating && !libraryOpen ? "true" : "false"
          }
          data-enter={libraryEnterAnim ? "true" : "false"}
        >
          <aside
            className="mm-wmp-library flex h-full min-h-0 flex-col gap-2"
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              if (String(e.animationName || "").includes("mm-wmp-lib-in"))
                onLibraryOpenAnimationEnd();
            }}
            onTransitionEnd={onLibraryCloseTransitionEnd}
          >
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                Playlist
              </div>
              <select
                className="mm-wmp-select"
                value={playlistIndex}
                onChange={onPlaylistSelect}
                aria-label="Playlist auswählen"
              >
                {PLAYLISTS.map((p, i) => (
                  <option key={p.label} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] leading-snug text-slate-600">
              Wiedergabe, Anfang/vorheriges und nächstes Video über die Leiste
              unter dem Video.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
