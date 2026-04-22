"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/** Statische Datei (Kopie aus `pdfjs-dist` via `npm run postinstall`), damit der Next-Bundler den Worker nicht minifiziert. */
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/** Summe linker+rechter Innenabstand der Seitenliste (0 = volle Breite). */
const PAGE_H_PADDING = 0;

/**
 * PDF per pdf.js: einheitliche **Anzeige-Höhe** aller Seiten (nach breitester Seite skaliert),
 * schmalere Seiten horizontal zentriert.
 */
const PdfJsViewer = forwardRef(function PdfJsViewer(
  { src, fileLabel, onFirstPageGeometry, className },
  ref
) {
  const rootRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loadError, setLoadError] = useState(null);
  /** max(viewport.width / viewport.height) über alle Seiten (scale 1) */
  const [maxPageAspect, setMaxPageAspect] = useState(null);

  useEffect(() => {
    setNumPages(0);
    setLoadError(null);
    setMaxPageAspect(null);
  }, [src]);

  const assignRef = useCallback(
    (node) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w > 0) setContainerWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [src]);

  const onDocumentLoadSuccess = useCallback(
    async (pdf) => {
      setLoadError(null);
      setNumPages(pdf.numPages);
      let maxR = 0;
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          const r = vp.width / Math.max(1e-6, vp.height);
          if (r > maxR) maxR = r;
        }
        if (maxR > 0) setMaxPageAspect(maxR);
        onFirstPageGeometry?.({
          width: Math.max(1, maxR * 1000),
          height: 1000,
          numPages: pdf.numPages,
        });
      } catch {
        /* ignore */
      }
    },
    [onFirstPageGeometry]
  );

  const onDocumentLoadError = useCallback((err) => {
    setLoadError(err?.message || String(err));
    setNumPages(0);
    setMaxPageAspect(null);
  }, []);

  /** Gleiche Pixelhöhe für jede Seite: breiteste Seite füllt die Zeilenbreite (minus Padding). */
  const uniformPageHeight = useMemo(() => {
    if (!containerWidth || !maxPageAspect || maxPageAspect <= 0) {
      return undefined;
    }
    const innerW = Math.max(1, containerWidth - PAGE_H_PADDING);
    return Math.max(48, Math.floor(innerW / maxPageAspect));
  }, [containerWidth, maxPageAspect]);

  const pages = useMemo(() => {
    if (!numPages) return null;
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [numPages]);

  /** `className` von außen ergänzen — nie `overflow-y-auto`/`flex-col` überschreiben. */
  const outerClass = [
    "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-white touch-pan-y [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const ready = Boolean(uniformPageHeight && pages);

  return (
    <div
      ref={assignRef}
      className={outerClass}
      aria-label={fileLabel ? `PDF: ${fileLabel}` : "PDF-Dokument"}
    >
      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-zinc-600">
          <p>PDF konnte nicht geladen werden.</p>
          <p className="font-mono text-xs text-zinc-500">{loadError}</p>
        </div>
      ) : (
        <Document
          file={src}
          loading={
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-zinc-500">
              PDF wird geladen …
            </div>
          }
          noData={
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-zinc-500">
              Keine Daten
            </div>
          }
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
        >
          {ready ? (
            <div className="flex flex-col gap-2 py-1">
              {pages.map((pageNum) => (
                <div
                  key={pageNum}
                  className="flex w-full shrink-0 justify-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <Page
                    pageNumber={pageNum}
                    height={uniformPageHeight}
                    renderTextLayer
                    renderAnnotationLayer
                    className="bg-white !border-0 !shadow-none"
                    canvasBackground="white"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-zinc-500">
              …
            </div>
          )}
        </Document>
      )}
    </div>
  );
});

PdfJsViewer.displayName = "PdfJsViewer";

export default PdfJsViewer;
