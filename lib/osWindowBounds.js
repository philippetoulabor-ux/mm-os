/**
 * Fenster-Bounds mit festem Inhalts-Seitenverhältnis (rw:rh = Clientbreite : Clienthöhe).
 * @param {{ innerW: number, maxWinH: number, maxBottomLayer: number, inset: number, minLayerY: number, desktopW: number }} limits
 */
export function clampAspectWindowBounds(
  nx,
  ny,
  nw,
  nh,
  rw,
  rh,
  titlebar,
  minW,
  minH,
  limits
) {
  const { innerW, maxWinH, maxBottomLayer, inset, minLayerY, desktopW } =
    limits;

  let w = Math.max(minW, nw);
  let h = w * (rh / rw) + titlebar;

  if (h < minH) {
    h = minH;
    w = Math.max(minW, (h - titlebar) * (rw / rh));
    h = w * (rh / rw) + titlebar;
  }

  let s = Math.min(1, innerW / w, maxWinH / h);
  w = Math.max(minW, Math.floor(w * s));
  h = w * (rh / rw) + titlebar;

  if (h > maxWinH) {
    h = maxWinH;
    w = Math.max(minW, (h - titlebar) * (rw / rh));
    h = w * (rh / rw) + titlebar;
  }
  if (w > innerW) {
    w = innerW;
    h = w * (rh / rw) + titlebar;
  }
  if (h < minH) {
    h = minH;
    w = Math.max(minW, (h - titlebar) * (rw / rh));
    h = w * (rh / rw) + titlebar;
  }

  let x = nx;
  let y = ny;
  x = Math.max(inset, Math.min(x, desktopW - w - inset));
  y = Math.max(minLayerY, Math.min(y, maxBottomLayer - h));
  return { x, y, w, h };
}
