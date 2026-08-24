import React from "react";
import { Icon } from "../utilities/Icon.jsx";
import { IconButton } from "../buttons/IconButton.jsx";
import { ProgressBar } from "../feedback/ProgressBar.jsx";

/**
 * FileUpload — dropzone with click alternative + a list of selected files.
 * files: [{ id, name, size?, status?: "uploading"|"success"|"error", progress? }].
 * Presentational: wire onFiles / onRemove to your own upload logic.
 */
export function FileUpload({ files = [], onFiles, onRemove, accept, multiple = true, hint = "PDF, JPG or PNG · up to 10MB", className = "" }) {
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef(null);
  const pick = (list) => list && list.length && onFiles && onFiles(Array.from(list));

  return (
    <div className={["ds-upload", className].filter(Boolean).join(" ")}>
      <div
        className={["ds-upload__zone", drag ? "is-drag" : ""].filter(Boolean).join(" ")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      >
        <span className="ds-upload__icon"><Icon name="upload-cloud" size={26} stroke={1.5} /></span>
        <p className="ds-upload__title"><span className="ds-upload__link">Click to upload</span> or drag and drop</p>
        <p className="ds-upload__hint">{hint}</p>
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => pick(e.target.files)} />
      </div>
      {files.length > 0 && (
        <ul className="ds-upload__list">
          {files.map((f) => (
            <li key={f.id} className="ds-upload__file">
              <Icon className="ds-upload__file-icon" name="file-text" size={18} />
              <div className="ds-upload__file-body">
                <div className="ds-upload__file-head">
                  <span className="ds-upload__file-name">{f.name}</span>
                  {f.size && <span className="ds-upload__file-size">{f.size}</span>}
                </div>
                {f.status === "uploading" && <ProgressBar size="sm" value={f.progress ?? 40} />}
                {f.status === "error" && <span className="ds-upload__file-error">Upload failed</span>}
              </div>
              {f.status === "success" && <Icon className="ds-upload__ok" name="check-circle" size={18} />}
              {onRemove && <IconButton icon="x" label="Remove file" size="sm" variant="ghost" onClick={() => onRemove(f)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
