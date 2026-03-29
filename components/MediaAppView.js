"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktop } from "@/context/DesktopContext";
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

const MARQUEE_KF_STYLE_ID = "mm-wmp-title-marquee-keyframes";

/** Sekunden: darüber → Zurück springt an den Anfang; darunter → vorheriges Video. */
const SKIP_BACK_RESTART_SEC = 2.5;

/** Max. automatische Weiterschaltungen bei Fehler (Alter, Embed, nicht gefunden, …). */
const MAX_ERROR_AUTO_SKIPS = 48;

/** Lautstärke beim Start (0) bis Ziel nach dieser Dauer (ms) einblenden (Autoplay-freundlich). */
const VOLUME_FADE_MS = 7000;
const VOLUME_TARGET = 100;

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

/** @param {{ windowId?: string }} props */
export function MediaAppView({ windowId }) {
  const { windows } = useDesktop();
  const videoCollapsed = Boolean(
    windowId && windows.find((w) => w.id === windowId)?.mediaVideoCollapsed
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [apiOrigin, setApiOrigin] = useState("");
  const [playingTitle, setPlayingTitle] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [titleNeedsMarquee, setTitleNeedsMarquee] = useState(false);
  const ytPlayerRef = useRef(null);
  const errorAutoSkipCountRef = useRef(0);
  const nowPlayingClipRef = useRef(null);
  const nowPlayingStaticRef = useRef(null);
  const nowPlayingMarqueeRef = useRef(null);
  const nowPlayingMarqueeSegRef = useRef(null);
  const reduceMotionRef = useRef(false);
  const volumeFadeRafRef = useRef(0);

  const [playlistIndex, setPlaylistIndex] = useState(() => readPlaylistIndex());

  useEffect(() => {
    setApiOrigin(window.location.origin);
  }, []);

  const embedUrl = useMemo(
    () => embedUrlForEntry(PLAYLISTS[playlistIndex], apiOrigin || undefined),
    [playlistIndex, apiOrigin]
  );

  useEffect(() => {
    setIframeLoaded(false);
    setPlayingTitle("");
    setIsPlaying(false);
    setPlayerReady(false);
    setTitleNeedsMarquee(false);
    errorAutoSkipCountRef.current = 0;
  }, [embedUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduceMotionRef.current = mq.matches;
    };
    sync();
    const onChange = () => {
      sync();
      if (mq.matches) setTitleNeedsMarquee(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    const clip = nowPlayingClipRef.current;
    if (!clip || !playingTitle || reduceMotionRef.current) {
      if (reduceMotionRef.current) setTitleNeedsMarquee(false);
      return undefined;
    }

    const measure = () => {
      if (!titleNeedsMarquee) {
        const s = nowPlayingStaticRef.current;
        if (s && s.scrollWidth > clip.clientWidth) setTitleNeedsMarquee(true);
      } else {
        const m = nowPlayingMarqueeSegRef.current;
        if (m && m.scrollWidth <= clip.clientWidth) setTitleNeedsMarquee(false);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(clip);
    return () => ro.disconnect();
  }, [playingTitle, titleNeedsMarquee]);

  useLayoutEffect(() => {
    const track = nowPlayingMarqueeRef.current;
    const seg = nowPlayingMarqueeSegRef.current;
    if (!titleNeedsMarquee || !track || !seg) return undefined;

    const w = seg.offsetWidth;
    const shiftPx = -w;
    const pauseSec = 2;
    const scrollSec = Math.min(40, Math.max(5, w / 28));
    const totalSec = pauseSec + scrollSec;
    const pausePct = (pauseSec / totalSec) * 100;

    track.style.setProperty("--mm-wmp-marquee-duration", `${totalSec}s`);

    let styleEl = document.getElementById(MARQUEE_KF_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = MARQUEE_KF_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
@keyframes mm-wmp-title-marquee {
  0%, ${pausePct}% { transform: translateX(0); }
  100% { transform: translateX(${shiftPx}px); }
}
`;

    return () => {
      track.style.removeProperty("--mm-wmp-marquee-duration");
    };
  }, [titleNeedsMarquee, playingTitle]);

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
            const p = e.target;
            setPlayerReady(true);
            const t = p.getVideoData()?.title;
            if (t) setPlayingTitle(t);
            const YT = window.YT;
            try {
              if (typeof p.setShuffle === "function") p.setShuffle(true);
            } catch {
              /* ignore */
            }
            try {
              p.setVolume(0);
            } catch {
              /* ignore */
            }
            try {
              p.playVideo();
            } catch {
              /* ignore */
            }
            const ps = p.getPlayerState?.();
            if (ps != null && YT) {
              setIsPlaying(
                ps === YT.PlayerState.PLAYING || ps === YT.PlayerState.BUFFERING
              );
            }
            const fadeStart = performance.now();
            const tick = (now) => {
              if (cancelled) return;
              const u = Math.min(1, (now - fadeStart) / VOLUME_FADE_MS);
              try {
                p.setVolume(Math.round(VOLUME_TARGET * u));
              } catch {
                /* ignore */
              }
              if (u < 1) {
                volumeFadeRafRef.current = requestAnimationFrame(tick);
              } else {
                volumeFadeRafRef.current = 0;
              }
            };
            volumeFadeRafRef.current = requestAnimationFrame(tick);
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
      if (volumeFadeRafRef.current) {
        cancelAnimationFrame(volumeFadeRafRef.current);
        volumeFadeRafRef.current = 0;
      }
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

  return (
    <div className="mm-wmp-shell">
      <div className="mm-wmp-main">
        <div className="mm-wmp-video-wrap relative flex min-h-0 min-w-0 flex-1 flex-col">
          {embedUrl ? (
            <div className="mm-wmp-now-playing" title={playingTitle || undefined}>
              <div ref={nowPlayingClipRef} className="mm-wmp-now-playing__clip">
                {titleNeedsMarquee ? (
                  <div
                    ref={nowPlayingMarqueeRef}
                    className="mm-wmp-now-playing__marquee"
                    aria-live="polite"
                  >
                    <span
                      ref={nowPlayingMarqueeSegRef}
                      className="mm-wmp-now-playing__marquee-seg"
                    >
                      {playingTitle}
                    </span>
                    <span
                      className="mm-wmp-now-playing__marquee-seg"
                      aria-hidden="true"
                    >
                      {playingTitle}
                    </span>
                  </div>
                ) : (
                  <span
                    ref={nowPlayingStaticRef}
                    className="mm-wmp-now-playing__static"
                  >
                    {playingTitle || "…"}
                  </span>
                )}
              </div>
            </div>
          ) : null}
          <div
            className={
              videoCollapsed
                ? "relative h-0 shrink-0 overflow-hidden"
                : "relative min-h-0 flex-1"
            }
          >
            {!embedUrl ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black text-xs text-zinc-500">
                Keine Playlist/Videos in MediaAppView.js konfiguriert.
              </div>
            ) : (
              <>
                {!iframeLoaded && !videoCollapsed && (
                  <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black text-xs text-zinc-500">
                    Player wird geladen…
                  </div>
                )}
                <div
                  className={
                    videoCollapsed
                      ? "pointer-events-none fixed left-[-2400px] top-0 z-0 h-[240px] w-[360px] overflow-hidden opacity-0"
                      : "absolute inset-0"
                  }
                  aria-hidden={videoCollapsed}
                >
                  <iframe
                    key={embedUrl}
                    id={YT_IFRAME_ID}
                    title="YouTube"
                    src={embedUrl}
                    className="pointer-events-none absolute inset-0 h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
                    loading="eager"
                    onLoad={() => setIframeLoaded(true)}
                  />
                </div>
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
      </div>
    </div>
  );
}
