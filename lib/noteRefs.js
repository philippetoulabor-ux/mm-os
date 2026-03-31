import { APPS } from "@/lib/apps";
import { webAssetManifest } from "@/lib/webAssetManifest";

/** Anzeigename für eine Notiz-Referenz (App und optional Datei im Asset-Ordner). */
export function getNoteTargetLabel(appId, fileName) {
  const app = APPS[appId];
  const title = app?.title ?? appId;
  if (fileName) return `${title} · ${fileName}`;
  return title;
}

/** Alle Apps als mögliche Bezüge, inkl. Dateiliste für Asset-Ordner. */
export function getAllNoteTargets() {
  return Object.keys(APPS).map((appId) => {
    const app = APPS[appId];
    const entry = app?.assetDir
      ? webAssetManifest.find((x) => x.dir === app.assetDir)
      : null;
    return {
      appId,
      label: app.title,
      files: entry?.files?.length ? entry.files : null,
    };
  });
}

/**
 * Einheitliches @-Token für QuickNote / Preset (gleiche Form wie Autocomplete).
 */
export function getMentionToken(appId, fileName) {
  const app = APPS[appId];
  if (!app) return `@${appId}`;
  if (fileName && app.assetDir) {
    return `@${app.assetDir}/${fileName}`;
  }
  return `@${app.title}`;
}

/**
 * Kandidaten für Autocomplete & Auto-@: `word` exakter Treffer (ohne @),
 * `insert` inkl. @, `label` nur für die Liste.
 */
export function getMentionScanList() {
  const out = [];
  const seen = new Set();

  const add = (word, insert, label) => {
    if (!word || seen.has(word)) return;
    seen.add(word);
    out.push({ word, insert, label });
  };

  for (const t of getAllNoteTargets()) {
    const title = APPS[t.appId]?.title ?? t.appId;
    add(title, `@${title}`, title);
    if (t.files?.length && APPS[t.appId]?.assetDir) {
      const dir = APPS[t.appId].assetDir;
      add(dir, `@${dir}`, dir);
      for (const f of t.files) {
        add(f, `@${f}`, f);
        add(`${dir}/${f}`, `@${dir}/${f}`, `${dir}/${f}`);
      }
    }
  }

  out.sort((a, b) => b.word.length - a.word.length);
  return out;
}

/**
 * Nach vollständigem Tippen eines bekannten Namens: @ davor setzen (Cursor am Wortende).
 */
export function tryAutoAtBeforeCursor(text, cursor) {
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const m = before.match(/([\w./-]+)$/);
  if (!m) return { text, cursor };
  const word = m[1];
  const list = getMentionScanList();
  const hit = list.find((x) => x.word === word);
  if (!hit) return { text, cursor };
  const wordStart = before.length - word.length;
  if (wordStart > 0) {
    const prev = text[wordStart - 1];
    if (prev === "@") return { text, cursor };
  }
  const next = text.slice(wordStart + word.length, wordStart + word.length + 1);
  if (next && /[\w./-]/.test(next)) return { text, cursor };

  const nextText = text.slice(0, wordStart) + hit.insert + after;
  const nextCursor = wordStart + hit.insert.length;
  return { text: nextText, cursor: nextCursor };
}

/** Filter für @-Autocomplete (query ohne führendes @). */
export function filterMentionSuggestions(query) {
  const q = query.trim().toLowerCase();
  const list = getMentionScanList();
  if (!q) return list.slice(0, 12);
  return list
    .filter((x) => {
      const ins = x.insert.slice(1).toLowerCase();
      const w = x.word.toLowerCase();
      return ins.startsWith(q) || w.startsWith(q);
    })
    .slice(0, 12);
}

/**
 * Aktives @… direkt vor dem Cursor (kein Leerzeichen nach @).
 * `typed` = inkl. führendem @ bis Cursor.
 */
export function getMentionContext(text, cursor) {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const afterAt = before.slice(at + 1);
  if (/\s/.test(afterAt)) return null;
  const typed = before.slice(at);
  return { start: at, query: afterAt, typed };
}

/**
 * Inline-Vorschlag (grauer „Rest“) ab mindestens `minPrefix` passenden Zeichen:
 * entweder nach @… oder als ausgeschriebenes Wort (ohne @), Tab setzt `insert` + Leerzeichen.
 * @returns {null | { ghost: string, replaceFrom: number, replaceTo: number, insert: string }}
 */
export function getGhostCompletion(text, cursor, { minPrefix = 2 } = {}) {
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);

  const atCtx = getMentionContext(text, cursor);
  if (atCtx) {
    const q = atCtx.query;
    if (q.length < minPrefix) return null;
    const typed = atCtx.typed;
    const tLow = typed.toLowerCase();
    const candidates = filterMentionSuggestions(q).filter((x) =>
      x.insert.toLowerCase().startsWith(tLow)
    );
    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) =>
        a.insert.length - b.insert.length || a.insert.localeCompare(b.insert)
    );
    const pick = candidates[0];
    const ghost = pick.insert.slice(typed.length);
    if (!ghost) return null;
    return {
      ghost,
      replaceFrom: atCtx.start,
      replaceTo: cursor,
      insert: pick.insert,
    };
  }

  const m = before.match(/([\w./-]+)$/);
  if (!m) return null;
  const word = m[1];
  if (word.length < minPrefix) return null;
  if (after && /^[\w./-]/.test(after)) return null;

  const wordStart = before.length - word.length;
  if (wordStart > 0 && text[wordStart - 1] === "@") return null;

  const wLow = word.toLowerCase();
  const list = getMentionScanList().filter(
    (x) =>
      x.word.toLowerCase().startsWith(wLow) && x.word.length > word.length
  );
  if (list.length === 0) return null;
  list.sort(
    (a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word)
  );
  const pick = list[0];
  const ghost = pick.word.slice(word.length);
  if (!ghost) return null;
  return {
    ghost,
    replaceFrom: wordStart,
    replaceTo: cursor,
    insert: pick.insert,
  };
}

/** Entspricht `getMentionScanList` / `getMentionToken` — ein `@…`-Token → App + optional Datei. */
function resolveMentionInsert(insert) {
  if (!insert || typeof insert !== "string" || !insert.startsWith("@")) {
    return null;
  }
  for (const t of getAllNoteTargets()) {
    const app = APPS[t.appId];
    if (!app) continue;
    const title = app.title ?? t.appId;
    if (`@${title}` === insert) {
      return { appId: t.appId, fileName: null };
    }
    if (t.files?.length && app.assetDir) {
      const dir = app.assetDir;
      if (`@${dir}` === insert) {
        return { appId: t.appId, fileName: null };
      }
      for (const f of t.files) {
        if (`@${f}` === insert) {
          return { appId: t.appId, fileName: f };
        }
        if (`@${dir}/${f}` === insert) {
          return { appId: t.appId, fileName: f };
        }
      }
    }
  }
  return null;
}

/**
 * Apps, die im Text als @-Token vorkommen (inkl. Ordner-Projekte, Media, Finder, …) —
 * eindeutig nach `appId`, Reihenfolge wie erste Nennung.
 */
export function getMentionedAppsInOrder(text) {
  if (!text) return [];
  const re = /@(\S+)/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const insert = `@${m[1]}`;
    const resolved = resolveMentionInsert(insert);
    if (!resolved) continue;
    const app = APPS[resolved.appId];
    if (!app) continue;
    if (seen.has(resolved.appId)) continue;
    seen.add(resolved.appId);
    out.push({
      appId: resolved.appId,
      title: app.title ?? resolved.appId,
      icon: app.icon ?? "📁",
    });
  }
  return out;
}
