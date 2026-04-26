import { getLastDesktopUiScale, scaleLayoutPx } from "@/lib/desktopUiScale";
import { DESKTOP_FINDER_START_EDGE_PX } from "@/lib/desktopWidgetFrame";

/** Muss zu `WINDOW_DESKTOP_INSET` / `SITE_HEADER_H` in `DesktopContext` passen (SSR-Fallback). */
const FALLBACK_WINDOW_INSET_PX = 6;
const FALLBACK_SITE_HEADER_H_PX = 270;

const WIDGET_TILE_BASE_PX = 340;
const WIDGET_STACK_RIGHT_PAD_BASE_PX = 14;

/**
 * Desktop-Slideshow-Stapel oben rechts — gleiche Logik wie
 * `getDesktopFinderWidgetChromeSplitBounds` (Asset-Ecke), aber mit
 * {@link DESKTOP_FINDER_START_EDGE_PX} statt des 20px-Chrome-Pads, damit der Rand
 * zum sichtbaren Rand wie beim Finder-Start (80px) wirkt.
 *
 * @param {number} desktopW `getDesktopWindowLayoutLimits().desktopW` / Layer-Breite
 * @param {number} desktopH `getDesktopWindowLayoutLimits().desktopH` / Layer-Höhe
 * @param {number} minLayerY `getDesktopWindowLayoutLimits().minLayerY`
 * @param {number} fsY `getDesktopLayerFullscreenRect().y` (typisch `-layerTop`)
 * @returns {{ x: number, y: number }}
 */
export function computeSlideshowStackDesktopPosition(
  desktopW,
  desktopH,
  minLayerY,
  fsY
) {
  const s = getLastDesktopUiScale();
  const tileW = scaleLayoutPx(WIDGET_TILE_BASE_PX, s);
  const rightPad = scaleLayoutPx(WIDGET_STACK_RIGHT_PAD_BASE_PX, s);
  const edge = scaleLayoutPx(DESKTOP_FINDER_START_EDGE_PX, s);
  const wTot = tileW + rightPad;
  const rawX = Math.max(edge, desktopW - wTot - edge);
  const rawY = Math.max(
    minLayerY,
    Math.min(fsY + edge, desktopH - tileW - edge)
  );
  const maxX = Math.max(0, desktopW - wTot);
  const maxY = Math.max(0, desktopH - tileW);
  return {
    x: Math.max(0, Math.min(rawX, maxX)),
    y: Math.max(minLayerY, Math.min(rawY, maxY)),
  };
}

/** SSR / ohne DOM: gleiche Fallbacks wie `getDesktopContentRect` ohne Layer-Knoten. */
export function slideshowStackPlacementFallbacks() {
  const layerTop = FALLBACK_SITE_HEADER_H_PX;
  return {
    desktopW: 1920,
    desktopH: 900,
    minLayerY: FALLBACK_WINDOW_INSET_PX - layerTop,
    fsY: -layerTop,
  };
}
