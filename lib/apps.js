import { webAssetManifest } from "@/lib/webAssetManifest";

/** Stabile App-ID pro Asset-Ordner (für Fenster / Dock). */
export function webAssetAppId(dir) {
  return `webasset_${dir.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

const ASSET_FOLDER_APPS = Object.fromEntries(
  webAssetManifest.map(({ dir }) => {
    const id = webAssetAppId(dir);
    return [
      id,
      {
        id,
        title: dir,
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
    icon: "📝",
    defaultSize: { w: 440, h: 520 },
  },
  settings: {
    id: "settings",
    title: "Settings",
    icon: "⚙️",
    defaultSize: { w: 480, h: 420 },
  },
  ...ASSET_FOLDER_APPS,
};

const ASSET_DESKTOP_ICONS = webAssetManifest.map(({ dir }) => ({
  appId: webAssetAppId(dir),
  label: dir,
}));

export const DESKTOP_ICONS = [
  ...ASSET_DESKTOP_ICONS,
  { appId: "notes", label: "Notes" },
];

/** Start-Raster für Schreibtisch-Ordner (relativ zum Desktop-Bereich unter dem Header). */
const DESKTOP_ICON_GRID = {
  startX: 16,
  startY: 16,
  colW: 112,
  rowH: 110,
  cols: 2,
};

export function getDefaultDesktopIconPositions() {
  const positions = {};
  DESKTOP_ICONS.forEach((item, i) => {
    const col = i % DESKTOP_ICON_GRID.cols;
    const row = Math.floor(i / DESKTOP_ICON_GRID.cols);
    positions[item.appId] = {
      x: DESKTOP_ICON_GRID.startX + col * DESKTOP_ICON_GRID.colW,
      y: DESKTOP_ICON_GRID.startY + row * DESKTOP_ICON_GRID.rowH,
    };
  });
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
    return cur.x === def.x && cur.y === def.y;
  });
}
