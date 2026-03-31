/**
 * Stabile Slugs pro Asset-Ordner (`public/web/…`) — unabhängig von späteren Umbenennungen
 * der Ordner selbst. `webasset_<slug>` bleibt in localStorage gültig.
 */
export const STABLE_WEB_ASSET_SLUG_BY_DIR = {
  LuckyStar_candle: "kerze",
  "Sound-System": "lsradio",
  clay: "clay",
  logo: "logo",
  step: "step",
  "mm-series": "mm_series",
  buttons: "buttons",
};

function slugFromDir(dir) {
  return dir.replace(/[^a-zA-Z0-9]+/g, "_");
}

/** @param {string} dir — Ordnername wie in `webAssetManifest` */
export function webAssetAppId(dir) {
  const stable = STABLE_WEB_ASSET_SLUG_BY_DIR[dir];
  const slug = stable ?? slugFromDir(dir);
  return `webasset_${slug}`;
}

/**
 * Frühere `webasset_*`-IDs (alte Ordnernamen + einmalig abgeleitete Slugs) → kanonische ID.
 */
const LEGACY_WEB_ASSET_APP_ID_TO_CANONICAL = {
  webasset_kerze_web: "webasset_kerze",
  webasset_LuckyStar_candle: "webasset_kerze",
  webasset_LSradio_web: "webasset_lsradio",
  webasset_Sound_System: "webasset_lsradio",
  webasset_clay_web: "webasset_clay",
  webasset_logo_web: "webasset_logo",
  webasset_step_web: "webasset_step",
};

/** @param {string} appId */
export function migrateWebAssetAppId(appId) {
  if (typeof appId !== "string") return appId;
  return LEGACY_WEB_ASSET_APP_ID_TO_CANONICAL[appId] ?? appId;
}

const LEGACY_ASSET_DIR_TO_CURRENT = {
  kerze_web: "LuckyStar_candle",
  LSradio_web: "Sound-System",
  clay_web: "clay",
  logo_web: "logo",
  step_web: "step",
};

/** @param {string} dir */
export function migrateAssetDir(dir) {
  if (typeof dir !== "string") return dir;
  return LEGACY_ASSET_DIR_TO_CURRENT[dir] ?? dir;
}

/** @param {Record<string, unknown>} pos */
export function migrateDesktopIconPositions(pos) {
  if (!pos || typeof pos !== "object") return pos;
  const out = {};
  for (const [k, v] of Object.entries(pos)) {
    const nk = migrateWebAssetAppId(k);
    if (!(nk in out)) out[nk] = v;
  }
  return out;
}

/** @param {object} w */
export function migrateWindowState(w) {
  if (!w || typeof w !== "object") return w;
  const appId = migrateWebAssetAppId(w.appId);
  let next = { ...w, appId };
  if (w.assetFile && typeof w.assetFile === "object") {
    const dir = migrateAssetDir(w.assetFile.dir);
    if (dir !== w.assetFile.dir) {
      next = { ...next, assetFile: { ...w.assetFile, dir } };
    }
  }
  return next;
}

const LEGACY_NOTE_AT_PREFIXES = [
  ["@kerze_web/", "@LuckyStar_candle/"],
  ["@LSradio_web/", "@Sound-System/"],
  ["@clay_web/", "@clay/"],
  ["@logo_web/", "@logo/"],
  ["@step_web/", "@step/"],
];

/** @param {string} text */
export function migrateNotesText(text) {
  if (typeof text !== "string" || !text) return text;
  let t = text;
  for (const [from, to] of LEGACY_NOTE_AT_PREFIXES) {
    if (t.includes(from)) t = t.split(from).join(to);
  }
  return t;
}
