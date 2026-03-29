import { webAssetManifest } from "@/lib/webAssetManifest";

/** Bevorzugtes Vorschaubild pro Ordner (sonst erstes Bild im Manifest). */
const FOLDER_PREVIEW_FILE = {
  kerze_web: "DSCF5505-2.jpg",
};

function isPreviewImageFile(name) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

const filesByDir = Object.fromEntries(
  webAssetManifest.map(({ dir, files }) => [dir, files])
);

/**
 * URL zum ersten Bild im Ordner (Manifest), für Desktop-Icons.
 * @param {string} dir — wie in `APPS[…].assetDir`
 * @param {string} [basePath="/web"]
 * @returns {string | null}
 */
export function getWebAssetFolderPreviewHref(dir, basePath = "/web") {
  const files = filesByDir[dir];
  if (!files?.length) return null;
  const preferred = FOLDER_PREVIEW_FILE[dir];
  const file =
    preferred && files.includes(preferred) && isPreviewImageFile(preferred)
      ? preferred
      : files.find(isPreviewImageFile);
  if (!file) return null;
  const bp = basePath.replace(/\/$/, "");
  return `${bp}/${encodeURIComponent(dir)}/${encodeURIComponent(file)}`;
}
