import { webAssetManifest } from "@/lib/webAssetManifest";

/** Stabile App-ID pro Asset-Ordner (für Fenster / Desktop). */
export function webAssetAppId(dir) {
  return `webasset_${dir.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

/** Manifest-Ordner ohne eigenes Schreibtisch-Icon (z. B. reine Asset-Pfade). */
const DESKTOP_EXCLUDED_ASSET_DIRS = new Set(["buttons"]);

/** Optionale Anzeigenamen pro Manifest-`dir` (sonst Regel mit `_web`-Suffix). */
const ASSET_DIR_DISPLAY_OVERRIDES = {
  kerze_web: "LuckyStar_candle",
  LSradio_web: "Sound-System",
};

/** Ordnername ohne typisches `_web`-Suffix für Anzeige (Desktop, Titel). */
export function assetDirDisplayName(dir) {
  const o = ASSET_DIR_DISPLAY_OVERRIDES[dir];
  if (o != null) return o;
  return dir.endsWith("_web") ? dir.slice(0, -4) : dir;
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
    icon: "📁",
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

const ASSET_DESKTOP_ICONS = webAssetManifest
  .filter(({ dir }) => !DESKTOP_EXCLUDED_ASSET_DIRS.has(dir))
  .map(({ dir }) => ({
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
  startX: 32,
  startY: 40,
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
