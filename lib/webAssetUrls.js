import { buildAssetFileTree, collectAssetTreeFlatRows } from "@/lib/assetManifestTree";
import { webAssetManifest } from "@/lib/webAssetManifest";

export function fileHref(basePath, dir, file) {
  return `${basePath}/${encodeURIComponent(dir)}/${encodeURIComponent(file)}`;
}

export function isSlideImageFile(name) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

/**
 * Bild-Pfade relativ zum Ordner — gleiche Reihenfolge wie im Finder (AssetSubfolderView),
 * nur Bildformate; keine PDFs.
 * @param {string} dir
 * @param {string} [basePath="/web"]
 * @param {{ restrictTo?: string[] }} [options]
 * `restrictTo`: nur diese Pfade (müssen im Manifest vorkommen); Reihenfolge = Array-Reihenfolge.
 * `undefined` = alle Bilder aus dem Ordner. `[]` = keine.
 * @returns {string[]}
 */
export function listSlideImageFiles(dir, basePath = "/web", options) {
  const entry = webAssetManifest.find((x) => x.dir === dir);
  if (!entry?.files?.length) return [];
  const tree = buildAssetFileTree(entry.files);
  const rows = collectAssetTreeFlatRows(tree, dir, basePath, new Set());
  const finderImages = rows
    .filter((r) => r.kind === "file" && isSlideImageFile(r.fullPath))
    .map((r) => r.fullPath);

  const restrictTo = options?.restrictTo;
  if (restrictTo === undefined) return finderImages;
  if (restrictTo.length === 0) return [];

  const allowed = new Set(finderImages);
  return restrictTo.filter((f) => allowed.has(f));
}
