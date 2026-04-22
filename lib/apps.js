import { webAssetManifest } from "@/lib/webAssetManifest";
import { webAssetAppId } from "@/lib/webAssetIds";

export { webAssetAppId };

/** Manifest-Ordner ohne Schreibtisch-Icon und ohne Finder-Eintrag (z. B. reine Asset-Pfade). */
export const DESKTOP_EXCLUDED_ASSET_DIRS = new Set(["buttons"]);

/** Anzeige- und Fenstertitel: gleicher Name wie Ordner unter `public/web`. */
export function assetDirDisplayName(dir) {
  return dir;
}

const ASSET_FOLDER_APPS = Object.fromEntries(
  webAssetManifest.map(({ dir }) => {
    const id = webAssetAppId(dir);
    return [
      id,
      {
        id,
        title: assetDirDisplayName(dir),
        icon: "📁",
        defaultSize: { w: 630, h: 540 },
        assetDir: dir,
      },
    ];
  })
);

/** App registry: id → title, emoji icon, default size */
export const APPS = {
  finder: {
    id: "finder",
    title: "Finder",
    icon: "🔍",
    iconSrc: "/web/buttons/lupe.svg",
    defaultSize: { w: 560, h: 560 },
    resizable: false,
  },
  notes: {
    id: "notes",
    title: "Notes",
    icon: "✏️",
    defaultSize: { w: 660, h: 780 },
  },
  media: {
    id: "media",
    title: "mm-Radiooo",
    icon: "🎬",
    iconSrc: "/web/buttons/playButton.jpg",
    defaultSize: { w: 600, h: 780 },
  },
  /** Einzeldatei aus einem Web-Asset-Ordner; pro Fenster eigener Kontext (assetFile). */
  assetFile: {
    id: "assetFile",
    title: "Datei",
    icon: "📄",
    defaultSize: { w: 1200, h: 840 },
  },
  ...ASSET_FOLDER_APPS,
};

/**
 * Schreibtisch-Raster wie vor den Ordner-Umbenennungen: 2 Spalten, Zeilen
 * clay | logo → kerze | LSradio → step (neue Ordner wie mm-series ans Ende).
 * Manifest-Reihenfolge ist alphabetisch (Sync-Script) und würde sonst das Raster verschieben.
 */
const DESKTOP_ASSET_DIR_ORDER = [
  "clay",
  "logo",
  "LuckyStar_candle",
  "Sound-System",
  "step",
  "mm-series",
];

/** Projekt-Ordner in fester Reihenfolge (Finder-Raster, früheres Desktop-Raster). */
export function orderedDesktopAssetDirs() {
  const dirs = new Set(
    webAssetManifest
      .filter(({ dir }) => !DESKTOP_EXCLUDED_ASSET_DIRS.has(dir))
      .map(({ dir }) => dir)
  );
  const out = [];
  for (const d of DESKTOP_ASSET_DIR_ORDER) {
    if (dirs.has(d)) {
      out.push(d);
      dirs.delete(d);
    }
  }
  for (const d of [...dirs].sort((a, b) => a.localeCompare(b))) {
    out.push(d);
  }
  return out;
}

/** Finder + Notes — mm-Radiooo nur im Finder; Projekt-Ordner nur im Finder. */
export const DESKTOP_ICONS = [
  { appId: "finder", label: "Finder", align: "bottom-left", col: 0 },
  { appId: "notes", label: "text me :)" },
];

/**
 * Standard-Schreibtisch-Layout (Referenz-Screenshot): `xp`/`yp` = Mittelpunkt der Kachel
 * relativ zur Höhe/Breite des Desktop-Layers (0–1).
 */
const DESKTOP_ICON_DEFAULT_FRAC = {
  notes: { xp: 0.77, yp: 0.45 },
};

export function getDefaultDesktopIconPositions() {
  const positions = { ...DESKTOP_ICON_DEFAULT_FRAC };
  positions.finder = { align: "bottom-left", col: 0 };
  return positions;
}

/** True, wenn alle Schreibtisch-Icons noch auf den Standardkoordinaten liegen. */
export function isDesktopAtDefaultLayout(positions) {
  if (!positions || typeof positions !== "object") return false;
  const defaults = getDefaultDesktopIconPositions();
  return DESKTOP_ICONS.every((item) => {
    const cur = positions[item.appId];
    const def = defaults[item.appId];
    if (!cur || !def) return false;
    if (def.align === "bottom-left") {
      return cur.align === "bottom-left" && cur.col === def.col;
    }
    if (typeof def.xp === "number" && typeof def.yp === "number") {
      return cur.xp === def.xp && cur.yp === def.yp;
    }
    return cur.x === def.x && cur.y === def.y;
  });
}
