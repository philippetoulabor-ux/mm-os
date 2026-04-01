import {
  APPS,
  DESKTOP_EXCLUDED_ASSET_DIRS,
  DESKTOP_ICONS,
  assetDirDisplayName,
  webAssetAppId,
} from "@/lib/apps";
import { webAssetManifest } from "@/lib/webAssetManifest";

const SYSTEM_APP_IDS = ["finder", "notes", "media", "settings"];

const KIND_ORDER = { app: 0, folder: 1, file: 2 };

function desktopLabel(appId) {
  return DESKTOP_ICONS.find((i) => i.appId === appId)?.label;
}

function fileIcon(file) {
  if (/\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(file)) return "🖼";
  if (/\.(mov|mp4|webm|m4v)$/i.test(file)) return "🎬";
  if (/\.(glb|stl|obj)$/i.test(file)) return "📦";
  if (/\.pdf$/i.test(file)) return "📕";
  return "📄";
}

function buildFinderSearchIndex() {
  const rows = [];

  for (const appId of SYSTEM_APP_IDS) {
    const app = APPS[appId];
    if (!app) continue;
    const label = desktopLabel(appId) ?? app.title;
    const haystack = [appId, app.title, label, app.icon]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    rows.push({
      id: `app:${appId}`,
      kind: "app",
      appId,
      primary: label,
      secondary: "App",
      icon: app.icon,
      haystack,
    });
  }

  for (const { dir, files } of webAssetManifest) {
    if (DESKTOP_EXCLUDED_ASSET_DIRS.has(dir)) continue;

    const appId = webAssetAppId(dir);
    const folderName = assetDirDisplayName(dir);
    const folderHaystack = [dir, folderName, `${dir}/`, `web/${dir}`, appId]
      .join(" ")
      .toLowerCase();

    rows.push({
      id: `folder:${dir}`,
      kind: "folder",
      appId,
      dir,
      primary: folderName,
      secondary: "Project",
      icon: "📁",
      haystack: folderHaystack,
    });

    for (const file of files) {
      const dot = file.lastIndexOf(".");
      const base = dot > 0 ? file.slice(0, dot) : file;
      const ext = dot > 0 ? file.slice(dot + 1) : "";
      const haystack = [
        file,
        base,
        ext,
        folderName,
        dir,
        `${dir}/${file}`,
        `web/${dir}/${file}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      rows.push({
        id: `file:${dir}/${file}`,
        kind: "file",
        dir,
        file,
        primary: file,
        secondary: folderName,
        icon: fileIcon(file),
        haystack,
      });
    }
  }

  return rows;
}

export const FINDER_SEARCH_INDEX = buildFinderSearchIndex();

/** Leere Suche: System-Apps plus sichtbare Web-Asset-Projekte (ohne ausgeschlossene Ordner). */
export const FINDER_BROWSE_ROWS = FINDER_SEARCH_INDEX.filter(
  (r) => r.kind === "app" || r.kind === "folder"
).sort((a, b) =>
  a.primary.localeCompare(b.primary, "de", { sensitivity: "base" })
);

export function filterFinderSearchIndex(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = FINDER_SEARCH_INDEX.filter((row) => row.haystack.includes(q));
  out.sort((a, b) => {
    const kd = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kd !== 0) return kd;
    return a.primary.localeCompare(b.primary, "de", { sensitivity: "base" });
  });
  return out;
}
