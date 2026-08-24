import React from "react";
import { Icon } from "../utilities/Icon.jsx";
import { IconButton } from "../buttons/IconButton.jsx";

/**
 * DocumentPreview — preview a document with basic viewing controls (zoom, page
 * nav, download). Presentational frame; pass a `src` image/thumbnail or leave
 * empty for the generic placeholder.
 */
export function DocumentPreview({ name, src, page = 1, pageCount = 1, state = "default", onDownload, onPrint, className = "" }) {
  return (
    <div className={["ds-doc-preview", className].filter(Boolean).join(" ")}>
      <div className="ds-doc-preview__toolbar">
        <span className="ds-doc-preview__name"><Icon name="file-text" size={16} /> {name}</span>
        <span className="ds-doc-preview__tools">
          {pageCount > 1 && <span className="ds-doc-preview__pages">{page} / {pageCount}</span>}
          <IconButton icon="zoom-in" label="Zoom in" size="sm" variant="ghost" />
          <IconButton icon="printer" label="Print" size="sm" variant="ghost" onClick={onPrint} />
          <IconButton icon="download" label="Download" size="sm" variant="ghost" onClick={onDownload} />
        </span>
      </div>
      <div className="ds-doc-preview__stage">
        {state === "loading" ? (
          <div className="ds-doc-preview__placeholder"><Icon name="loader" size={28} /><span>Loading preview…</span></div>
        ) : state === "error" || state === "unsupported" ? (
          <div className="ds-doc-preview__placeholder"><Icon name="file-x" size={28} /><span>Preview unavailable</span></div>
        ) : src ? (
          <img className="ds-doc-preview__page" src={src} alt={name} />
        ) : (
          <div className="ds-doc-preview__placeholder"><Icon name="file-text" size={32} /><span>{name}</span></div>
        )}
      </div>
    </div>
  );
}
