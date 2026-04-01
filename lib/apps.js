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
        defaultSize: { w: 420, h: 360 },
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
    defaultSize: { w: 640, h: 420 },
  },
  notes: {
    id: "notes",
    title: "Notes",
    icon: "✏️",
    defaultSize: { w: 440, h: 520 },
  },
  media: {
    id: "media",
    title: "mm-Radiooo",
    icon: "🎬",
    iconSrc: "/web/buttons/playButton.jpg",
    defaultSize: { w: 400, h: 520 },
  },
  settings: {
    id: "settings",
    title: "Settings",
    icon: "⚙️",
    /** Platzhalter bis zur ersten Messung des Inhalts */
    defaultSize: { w: 320, h: 280 },
    resizable: false,
  },
  /** Einzeldatei aus einem Web-Asset-Ordner; pro Fenster eigener Kontext (assetFile). */
  assetFile: {
    id: "assetFile",
    title: "Datei",
    icon: "📄",
    defaultSize: { w: 800, h: 560 },
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

function orderedDesktopAssetDirs() {
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

const ASSET_DESKTOP_ICONS = orderedDesktopAssetDirs().map((dir) => ({
  appId: webAssetAppId(dir),
  label: assetDirDisplayName(dir),
}));

export const DESKTOP_ICONS = [
  ...ASSET_DESKTOP_ICONS,
  { appId: "finder", label: "Finder", align: "bottom-left", col: 0 },
  { appId: "settings", label: "Settings", align: "bottom-left", col: 1 },
  { appId: "notes", label: "text me :)", align: "right", row: 0 },
  { appId: "media", label: "mm-Radiooo", align: "right", row: 1 },
];

/** Start-Raster für Schreibtisch-Ordner (relativ zum Desktop-Bereich unter dem Header). */
const DESKTOP_ICON_GRID = {
  startX: 120,
  startY: 88,
  colW: 112,
  rowH: 110,
  cols: 2,
};

export function getDefaultDesktopIconPositions() {
  const positions = {};
  ASSET_DESKTOP_ICONS.forEach((item, i) => {
    const col = i % DESKTOP_ICON_GRID.cols;
    const row = Math.floor(i / DESKTOP_ICON_GRID.cols);
    positions[item.appId] = {
      x: DESKTOP_ICON_GRID.startX + col * DESKTOP_ICON_GRID.colW,
      y: DESKTOP_ICON_GRID.startY + row * DESKTOP_ICON_GRID.rowH,
    };
  });
  positions.finder = { align: "bottom-left", col: 0 };
  positions.settings = { align: "bottom-left", col: 1 };
  positions.notes = { align: "right", row: 0 };
  positions.media = { align: "right", row: 1 };
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
    if (def.align === "right") {
      return cur.align === "right" && cur.row === def.row;
    }
    if (def.align === "bottom-left") {
      return cur.align === "bottom-left" && cur.col === def.col;
    }
    return cur.x === def.x && cur.y === def.y;
  });
}
