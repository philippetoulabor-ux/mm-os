/**
 * **14"-Referenz:** typisch `minDim = min(Layer) ≤ REF` → Basis `max(1, minDim/REF) = 1`, also **s = 1** (wenn
 * minDim/REF<1) bzw. nur ganz knapp &gt;1 (Hoher 14"-Viewport).
 * **Größere Fläche:** derselbe Bruch, dann `LARGE_LIFT` nur auf den Anteil **über 1** — deutlich kräftigeres
 * Wachstum am 24"-o.ä.-Schirm, ohne 14" zu sprengen.
 */
export const DESKTOP_UI_REF_MIN_DIM_PX = 820;

/**
 * Vervielfachung nur der „Wachs-Anteil“: `s = 1 + (max(1, minDim/REF) - 1) * LARGE_LIFT`.
 * Beispiel: minDim/REF=1,4 → +0,4*1,65 statt +0,4.
 */
export const DESKTOP_UI_LARGE_LIFT = 1.65;

export const DESKTOP_UI_SCALE_MAX = 2.9;

let lastDesktopUiScale = 1;

/**
 * @param {number} layerW
 * @param {number} layerH
 * @param {number} viewportWidthPx
 * @returns {number} s ≥ 1 (Desktop); 1 auf schmalem Viewport
 */
export function getDesktopUiScaleFromDims(layerW, layerH, viewportWidthPx) {
  if (viewportWidthPx <= 767) return 1;
  const minDim = Math.min(Math.max(1, layerW), Math.max(1, layerH));
  const s0 = minDim / DESKTOP_UI_REF_MIN_DIM_PX;
  const sBase = Math.max(1, s0);
  const s = 1 + (sBase - 1) * DESKTOP_UI_LARGE_LIFT;
  const clamped = Math.min(DESKTOP_UI_SCALE_MAX, s);
  /** 2 Nachkommastellen: verhindert Render-Schleife bei Subpixel-Rects / Scrollbar-Flackern. */
  return Math.round(clamped * 100) / 100;
}

export function setLastDesktopUiScale(s) {
  lastDesktopUiScale =
    Number.isFinite(s) && s > 0 ? s : 1;
}

export function getLastDesktopUiScale() {
  return lastDesktopUiScale;
}

/**
 * @param {number} basePx
 * @param {number} [s]
 */
export function scaleLayoutPx(basePx, s = getLastDesktopUiScale()) {
  if (!Number.isFinite(basePx)) return 1;
  return Math.max(1, Math.round(basePx * s));
}

/**
 * @param {HTMLElement} [root]
 */
export function applyDesktopUiDocumentVars(root) {
  if (typeof document === "undefined" || !root) return;
  const s = getLastDesktopUiScale();
  root.style.setProperty("--mm-ui-scale", String(s));
}
