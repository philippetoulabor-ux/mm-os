/** Manifest-Pfade → Baum (Unterordner = eigene Knoten). */
export function buildAssetFileTree(paths) {
  const root = { children: new Map(), files: [] };
  for (const fullPath of paths) {
    const parts = fullPath.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (i === parts.length - 1) {
        node.files.push({ segment: seg, fullPath });
      } else {
        if (!node.children.has(seg)) {
          node.children.set(seg, { children: new Map(), files: [] });
        }
        node = node.children.get(seg);
      }
    }
  }
  return root;
}

/**
 * Sichtbare Zeilen in Baum-Reihenfolge; `collapsedKeys` = Ordner-Pfade, die zugeklappt sind.
 * Muss mit AssetSubfolderView identisch bleiben.
 */
export function collectAssetTreeFlatRows(
  node,
  dir,
  basePath,
  collapsedKeys,
  parentPath = "",
  depth = 0
) {
  const out = [];
  const childNames = [...node.children.keys()].sort((a, b) =>
    a.localeCompare(b)
  );
  const fileRows = [...node.files].sort((a, b) =>
    a.segment.localeCompare(b.segment)
  );
  for (const name of childNames) {
    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    const folderKey = `${dir}::${folderPath}`;
    out.push({
      kind: "folder",
      name,
      folderPath,
      folderKey,
      dir,
      basePath,
      depth,
    });
    if (!collapsedKeys.has(folderKey)) {
      const child = node.children.get(name);
      out.push(
        ...collectAssetTreeFlatRows(
          child,
          dir,
          basePath,
          collapsedKeys,
          folderPath,
          depth + 1
        )
      );
    }
  }
  for (const f of fileRows) {
    out.push({
      kind: "file",
      segment: f.segment,
      fullPath: f.fullPath,
      dir,
      basePath,
      depth,
    });
  }
  return out;
}
