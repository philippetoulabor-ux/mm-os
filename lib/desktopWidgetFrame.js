import { getLastDesktopUiScale, scaleLayoutPx } from "@/lib/desktopUiScale";

/**
 * Vollbild-Pad für Asset-Widget-Chrome — gleicher Wert wie
 * `ASSET_WIDGET_CHROME_FULLSCREEN_PAD` in `DesktopContext`.
 */
export const DESKTOP_ASSET_WIDGET_CHROME_FULLSCREEN_PAD_PX = 20;

/**
 * Finder Desktop-Start: Abstand unten/links zum Layer-Rand = 4× Vollbild-Pad
 * (`getInitialDesktopFinderPosition`).
 */
export const DESKTOP_FINDER_START_EDGE_PX =
  DESKTOP_ASSET_WIDGET_CHROME_FULLSCREEN_PAD_PX * 4;

/**
 * Slideshow-Stapel oben rechts: Abstand nach oben/rechts = gleicher Wert wie
 * Finder unten/links beim Start ({@link DESKTOP_FINDER_START_EDGE_PX}).
 */
export const DESKTOP_WIDGET_STACK_CORNER_OUTSET_PX =
  DESKTOP_FINDER_START_EDGE_PX;

/** Asset-Fenster (Finder → Datei, `widgetChrome`): quadratische Kantenlänge. Desktop-Slideshow-Kacheln: `DesktopWidgets`. */
export const DESKTOP_WIDGET_FRAME_PX = 680;

/** Abstand Finder → Asset-Fenster im Widget-Look (Desktop). */
export const FINDER_WIDGET_ASSET_GAP_PX = 12;

/**
 * Max. Kantenlänge (Höhe) des Finder-Fensters am Desktop.
 * Koppelt die Fenstergröße an die Slideshow-Kachel ({@link DESKTOP_WIDGET_FRAME_PX}) und `innerWidth`,
 * damit das Verhältnis Finder ↔ Widget-Stapel zwischen Browsern stabil bleibt (u. a. Safari).
 */
export function getFinderDesktopMaxSidePx(innerW) {
  const s = getLastDesktopUiScale();
  const capByWidth = Math.floor(innerW * 0.48);
  const unscaled = Math.max(360, Math.min(620, capByWidth));
  const scaled = Math.round(unscaled * s);
  return Math.min(
    capByWidth,
    Math.max(scaleLayoutPx(360, s), Math.min(scaleLayoutPx(620, s), scaled))
  );
}

/**
 * @param {number} [s]
 */
export function getAssetWidgetFrameSidePx(s = getLastDesktopUiScale()) {
  return scaleLayoutPx(DESKTOP_WIDGET_FRAME_PX, s);
}
