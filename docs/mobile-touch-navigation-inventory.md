# Mobile touch navigation — Bestandsübersicht (Abgleich)

Kurze Referenz für das Team: wie **Zurück** und **Asset-Bilder** heute zusammenspielen.

## Dock / „Zurück“ (`components/DesktopIcons.js`)

- **`CornerDock`**: Unter `max-width: 767px` wechselt die Leiste von **Launcher** (Finder/Settings/Media) zu **Nav**, sobald mindestens ein nicht minimiertes Fenster existiert.
- **`MobileNavDockButtons`**: Ein Button ruft `closeTopVisibleWindow()` aus dem Desktop-Context auf — gleiche Semantik wie **Escape** auf Desktop (`components/DesktopShell.js`, Escape nur wenn **nicht** Mobile).
- **`closeTopVisibleWindow`** (`context/DesktopContext.js`): Wählt unter allen nicht minimierten Fenstern das mit dem höchsten `z` und entfernt es aus dem State.
- **Media-App**: Ist das oberste sichtbare Fenster `appId === "media"`, wird der Dock-**Zurück**-Button **nicht** gerendert (Nav-Zeile bleibt leer). Inhaltliche Steuerung bleibt in der Media-App.
- **Position Dock**: Unten mittig, `z-index: 10000`, äußerer Wrapper `pointer-events-none`, `nav` `pointer-events-auto`.

## `AssetImageMobileZoom` (`components/AppContent.js`)

- Nur im Mobile-**unified**-Chrome (`unifiedParentScroll`) bei Bilddateien.
- **Zoom 1**: Achsen-Lock, dann horizontal oder vertikal zum vorherigen/nächsten Asset (`setAssetFileForWindow`); Schwellen über `ASSET_SWIPE_*` Konstanten.
- **Zoom > 1**: Pinch und Pan; kein Bild-zu-Bild-Swipe bei Zoom 1.
- **Konflikt mit Rand-Zurück**: Eine schmale **linke Rand-Zone** (`MobileEdgeBackGesture`) liegt **über** dem Viewer (`z-index` zwischen Fenster und Dock). Touches, die dort beginnen, steuern **nicht** `AssetImageMobileZoom` — horizontale Bild-Swipes starten weiterhin aus der Bildfläche rechts der Zone.

## Edge-Back vom linken Rand (`components/MobileEdgeBackGesture.js`)

- Nur Mobile + mindestens ein sichtbares Fenster.
- **Produktentscheidung Media**: Die Geste ruft ebenfalls `closeTopVisibleWindow()` auf — konsistent mit „oberstes Fenster schließen“, auch wenn der Dock-Zurück bei Media fehlt.
