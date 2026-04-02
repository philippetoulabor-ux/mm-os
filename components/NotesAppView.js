"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppIcon } from "@/components/AppIcon";
import { useDesktop } from "@/context/DesktopContext";
import { APPS } from "@/lib/apps";
import {
  getGhostCompletion,
  getMentionedAppsInOrder,
  getMentionToken,
  tryAutoAtBeforeCursor,
} from "@/lib/noteRefs";
import { getWebAssetFolderPreviewHref } from "@/lib/webAssetFolderPreview";

const fieldClass =
  "w-full min-h-full resize-none bg-transparent p-4 text-sm leading-relaxed outline-none";

const NOTES_PLACEHOLDER = "text me :)\nyou can @ projects !";

function splitParagraphs(text) {
  if (!text) return [""];
  return text.split(/\n\n+/);
}

function renderMentionSpans(segment) {
  const re = /@(\S+)/g;
  const out = [];
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(segment)) !== null) {
    if (m.index > last) {
      out.push(segment.slice(last, m.index));
    }
    out.push(
      <span key={`m-${k++}`} className="font-medium text-amber-800">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < segment.length) {
    out.push(segment.slice(last));
  }
  return out.length ? out : segment;
}

/** Cursor-Position in Absätzen (wie `split(/\n\n+/)`). */
function cursorParaOffset(text, cursor) {
  let start = 0;
  let pi = 0;
  const re = /\n\n+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const paraEnd = m.index;
    const sepLen = m[0].length;
    if (cursor <= paraEnd) {
      return { paraIndex: pi, local: cursor - start };
    }
    if (cursor < paraEnd + sepLen) {
      return { paraIndex: pi + 1, local: 0 };
    }
    start = paraEnd + sepLen;
    pi++;
  }
  return { paraIndex: pi, local: cursor - start };
}

/** Gleiche Zeilenhöhe wie früher (`text-[0.65rem] leading-none` ≈ 10px). */
const MENTION_CHIP_ICON_PX = 10;

/** Wie `DesktopFolderIcon`: bei FolderPreview Vorschaubild, sonst `AppIcon` / Emoji. */
function MentionChipIcon({ app, folderPreview }) {
  const href =
    folderPreview && app?.assetDir
      ? getWebAssetFolderPreviewHref(app.assetDir)
      : null;
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [href]);

  const boxStyle = {
    width: MENTION_CHIP_ICON_PX,
    height: MENTION_CHIP_ICON_PX,
  };

  if (href && !imgFailed) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt=""
          style={boxStyle}
          className="shrink-0 rounded-[2px] object-cover ring-1 ring-black/15 dark:ring-white/20"
          onError={() => setImgFailed(true)}
        />
      </>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[2px]"
      style={boxStyle}
    >
      <div
        className="flex h-6 w-6 shrink-0 origin-center scale-[0.4166666667] items-center justify-center"
        aria-hidden
      >
        <AppIcon app={app} variant="compact" />
      </div>
    </div>
  );
}

function renderMirror(text, cursor, ghost) {
  const parts = splitParagraphs(text);
  const { paraIndex, local } = cursorParaOffset(text, cursor);
  const last = parts.length - 1;

  return parts.map((p, i) => {
    const isStruck = i < last;
    let inner;
    if (i === paraIndex) {
      const a = p.slice(0, local);
      const b = p.slice(local);
      inner = (
        <>
          {renderMentionSpans(a)}
          {ghost ? (
            <span className="select-none text-zinc-400/75">{ghost}</span>
          ) : null}
          {renderMentionSpans(b)}
        </>
      );
    } else {
      inner = renderMentionSpans(p);
    }
    return (
      <span key={i}>
        {i > 0 ? "\n\n" : null}
        {isStruck ? (
          <s className="text-zinc-500 decoration-zinc-400">{inner}</s>
        ) : (
          inner
        )}
      </span>
    );
  });
}

export function NotesAppView({ unifiedParentScroll = false } = {}) {
  const {
    notesText,
    setNotesText,
    notesComposerPreset,
    consumeNotesComposerPreset,
    openOrFocus,
    folderPreview,
  } = useDesktop();

  const taRef = useRef(null);
  const mirrorRef = useRef(null);
  const pendingSel = useRef(null);
  const cursorToEnd = useRef(false);
  const cursorRef = useRef(0);

  const [cursor, setCursor] = useState(0);

  const handleChange = useCallback(
    (e) => {
      let v = e.target.value;
      let sel = e.target.selectionStart;
      const auto = tryAutoAtBeforeCursor(v, sel);
      if (auto.text !== v || auto.cursor !== sel) {
        v = auto.text;
        sel = auto.cursor;
        pendingSel.current = sel;
      } else {
        pendingSel.current = null;
      }
      cursorRef.current = sel;
      setCursor(sel);
      setNotesText(v);
    },
    [setNotesText]
  );

  useLayoutEffect(() => {
    if (cursorToEnd.current) {
      cursorToEnd.current = false;
      const ta = taRef.current;
      if (ta) {
        const len = notesText.length;
        ta.setSelectionRange(len, len);
        cursorRef.current = len;
        setCursor(len);
      }
      return;
    }
    if (pendingSel.current === null) return;
    const c = pendingSel.current;
    pendingSel.current = null;
    const ta = taRef.current;
    if (ta) ta.setSelectionRange(c, c);
    cursorRef.current = c;
    setCursor(c);
  }, [notesText]);

  useEffect(() => {
    if (!notesComposerPreset) return;
    const token = getMentionToken(
      notesComposerPreset.appId,
      notesComposerPreset.fileName
    );
    setNotesText((prev) => (prev ? `${prev}\n\n${token}` : token));
    consumeNotesComposerPreset();
    cursorToEnd.current = true;
  }, [notesComposerPreset, consumeNotesComposerPreset, setNotesText]);

  const ghost = getGhostCompletion(notesText, cursor)?.ghost ?? null;

  const applyGhostCompletion = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return false;
    const sel = ta.selectionStart;
    const g = getGhostCompletion(notesText, sel);
    if (!g) return false;
    const next =
      notesText.slice(0, g.replaceFrom) +
      g.insert +
      " " +
      notesText.slice(g.replaceTo);
    const newPos = g.replaceFrom + g.insert.length + 1;
    cursorRef.current = newPos;
    pendingSel.current = newPos;
    setCursor(newPos);
    setNotesText(next);
    return true;
  }, [notesText, setNotesText]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key !== "Tab" || e.shiftKey) return;
      if (!getGhostCompletion(notesText, cursorRef.current)) return;
      e.preventDefault();
      applyGhostCompletion();
    },
    [notesText, applyGhostCompletion]
  );

  const onScroll = useCallback((ev) => {
    const top = ev.target.scrollTop;
    if (mirrorRef.current) mirrorRef.current.scrollTop = top;
  }, []);

  const hasSendableText = notesText.trim().length > 0;
  const mentionedApps = useMemo(
    () => getMentionedAppsInOrder(notesText),
    [notesText]
  );
  const fieldPadBottom =
    hasSendableText || mentionedApps.length > 0 ? "pb-20" : "";

  const handleSend = useCallback(async () => {
    const t = notesText.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      /* ignore */
    }
  }, [notesText]);

  return (
    <div
      className={`relative flex min-h-0 flex-col bg-white ${
        unifiedParentScroll ? "h-auto min-h-[70vh]" : "h-full"
      }`}
    >
      <div
        className={`relative overflow-hidden ${
          unifiedParentScroll
            ? "min-h-[70vh] flex-1"
            : "min-h-0 flex-1"
        }`}
      >
        <textarea
          ref={taRef}
          value={notesText}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onSelect={(e) => {
            const p = e.target.selectionStart;
            cursorRef.current = p;
            setCursor(p);
          }}
          onScroll={onScroll}
          spellCheck={false}
          className={`${fieldClass} absolute inset-0 z-10 overflow-auto text-transparent caret-zinc-800 placeholder:text-zinc-400/80 ${fieldPadBottom}`}
          placeholder={NOTES_PLACEHOLDER}
          aria-label="Notizen"
          autoComplete="off"
        />
        <div
          ref={mirrorRef}
          className={`${fieldClass} pointer-events-none absolute inset-0 z-0 overflow-auto whitespace-pre-wrap break-words text-zinc-800 ${fieldPadBottom}`}
          aria-hidden
        >
          {notesText ? (
            renderMirror(notesText, cursor, ghost)
          ) : (
            <span className="text-zinc-400">{NOTES_PLACEHOLDER}</span>
          )}
        </div>
        {mentionedApps.length > 0 ? (
          <div
            className={`absolute bottom-3 left-3 z-20 flex max-w-full flex-row flex-wrap items-end gap-1.5 ${
              hasSendableText ? "max-w-[calc(100%-10rem)]" : ""
            }`}
            aria-label="Erwähnte Apps"
          >
            {mentionedApps.map((p) => {
              const app = APPS[p.appId];
              if (!app) return null;
              return (
                <button
                  key={p.appId}
                  type="button"
                  onClick={() => openOrFocus(p.appId)}
                  className="flex min-w-0 max-w-[6.5rem] flex-col items-stretch gap-0.5 rounded-md bg-[var(--mm-desktop-bg)] px-2 py-1.5 text-left text-[var(--mm-shell-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                >
                  <span className="inline-flex shrink-0" aria-hidden>
                    <MentionChipIcon app={app} folderPreview={folderPreview} />
                  </span>
                  <span className="min-w-0 truncate text-[0.65rem] font-medium leading-tight">
                    {p.title}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {hasSendableText ? (
          <button
            type="button"
            className="absolute bottom-3 right-3 z-20 rounded-lg border-2 border-black bg-white px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-zinc-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            aria-label="Senden"
            onClick={handleSend}
          >
            SEND
          </button>
        ) : null}
      </div>
    </div>
  );
}
