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
  const min = 360;
  const hardMax = 560;
  const frac = 0.44;
  return Math.max(min, Math.min(hardMax, Math.floor(innerW * frac)));
}
