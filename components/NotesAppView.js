"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDesktop } from "@/context/DesktopContext";
import {
  getGhostCompletion,
  getMentionToken,
  tryAutoAtBeforeCursor,
} from "@/lib/noteRefs";

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

export function NotesAppView() {
  const {
    notesText,
    setNotesText,
    notesComposerPreset,
    consumeNotesComposerPreset,
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

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-white">
      <div className="relative min-h-0 flex-1 overflow-hidden">
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
          className={`${fieldClass} absolute inset-0 z-10 overflow-auto text-transparent caret-zinc-800 placeholder:text-zinc-400/80`}
          placeholder={NOTES_PLACEHOLDER}
          aria-label="Notizen"
          autoComplete="off"
        />
        <div
          ref={mirrorRef}
          className={`${fieldClass} pointer-events-none absolute inset-0 z-0 overflow-auto whitespace-pre-wrap break-words text-zinc-800`}
          aria-hidden
        >
          {notesText ? (
            renderMirror(notesText, cursor, ghost)
          ) : (
            <span className="text-zinc-400">{NOTES_PLACEHOLDER}</span>
          )}
        </div>
      </div>
    </div>
  );
}
