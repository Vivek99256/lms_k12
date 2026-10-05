'use client';

import { unzip } from 'fflate';

/** One file ready to be queued, with the folder path it came from (if any). */
export interface ExpandedFile {
  file: File;
  /** Path inside the dropped folder or zip, e.g. "Circulars/2026/notice.pdf". Equal to the name for loose files. */
  path: string;
}

export interface ExpandResult {
  files: ExpandedFile[];
  /** Human-readable reasons for anything that was skipped. */
  skipped: string[];
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
// Guards the browser against a zip bomb: stop once the extracted data would pass this.
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 200;

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff',
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

function baseName(path: string): string {
  return path.split('/').pop() || path;
}

function isJunk(path: string): boolean {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  return parts.includes('__MACOSX') || name.startsWith('.') || name === 'Thumbs.db' || name.startsWith('~$');
}

export function isZip(file: File): boolean {
  return extensionOf(file.name) === 'zip' || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
}

/** Returns a reason the file cannot be uploaded, or null when it is fine. */
function rejectionReason(path: string, size: number): string | null {
  if (!ALLOWED_EXTENSIONS.has(extensionOf(path))) return `${path}: unsupported file type`;
  if (size === 0) return `${path}: file is empty`;
  if (size > MAX_FILE_BYTES) return `${path}: larger than 50 MB`;
  return null;
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    let total = 0;
    unzip(
      data,
      {
        // Decide per entry before inflating it, so junk and oversized entries are never decompressed.
        filter: (entry) => {
          if (entry.name.endsWith('/') || isJunk(entry.name)) return false;
          if (!ALLOWED_EXTENSIONS.has(extensionOf(entry.name))) return false;
          if (entry.originalSize === 0 || entry.originalSize > MAX_FILE_BYTES) return false;
          total += entry.originalSize;
          return total <= MAX_ARCHIVE_BYTES;
        },
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
  });
}

/** Names of zip entries that the filter above dropped, so the user can be told why. */
function listZipEntries(data: Uint8Array): Promise<Array<{ name: string; size: number }>> {
  return new Promise((resolve, reject) => {
    const entries: Array<{ name: string; size: number }> = [];
    unzip(
      data,
      {
        filter: (entry) => {
          if (!entry.name.endsWith('/') && !isJunk(entry.name)) {
            entries.push({ name: entry.name, size: entry.originalSize });
          }
          return false;
        },
      },
      (err) => (err ? reject(err) : resolve(entries)),
    );
  });
}

async function expandZip(file: File): Promise<ExpandResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const skipped: string[] = [];

  let entries: Array<{ name: string; size: number }>;
  let extracted: Record<string, Uint8Array>;
  try {
    entries = await listZipEntries(data);
    extracted = await unzipAsync(data);
  } catch {
    return { files: [], skipped: [`${file.name}: could not be read as a zip (damaged or password protected)`] };
  }

  for (const entry of entries) {
    if (!(entry.name in extracted)) {
      skipped.push(`${file.name}/${entry.name}: ${rejectionReason(entry.name, entry.size) ?? 'skipped'}`);
    }
  }

  const files: ExpandedFile[] = Object.entries(extracted).map(([path, bytes]) => {
    const name = baseName(path);
    const blob = new File([bytes as BlobPart], name, {
      type: MIME_BY_EXTENSION[extensionOf(name)] ?? 'application/octet-stream',
      lastModified: file.lastModified,
    });
    return { file: blob, path: `${file.name.replace(/\.zip$/i, '')}/${path}` };
  });

  if (files.length === 0 && skipped.length === 0) skipped.push(`${file.name}: the zip has no supported files`);
  return { files, skipped };
}

/** Walk a dropped directory entry (the non-standard but universally supported webkit API). */
async function readDirectory(entry: FileSystemDirectoryEntry, prefix: string): Promise<ExpandedFile[]> {
  const reader = entry.createReader();
  const children: FileSystemEntry[] = [];
  // readEntries returns results in chunks; keep calling until it returns an empty batch.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    children.push(...batch);
  }

  const out: ExpandedFile[] = [];
  for (const child of children) {
    const path = `${prefix}${child.name}`;
    if (isJunk(path)) continue;
    if (child.isDirectory) {
      out.push(...(await readDirectory(child as FileSystemDirectoryEntry, `${path}/`)));
    } else {
      const file = await new Promise<File>((resolve, reject) =>
        (child as FileSystemFileEntry).file(resolve, reject),
      );
      out.push({ file, path });
    }
  }
  return out;
}

/** Turn a drop event's items into a flat list, descending into any folders that were dropped. */
export async function collectFromDrop(dt: DataTransfer): Promise<ExpandedFile[]> {
  const items = Array.from(dt.items ?? []);
  // Entries must be read synchronously, before the first await, or the browser invalidates the DataTransfer.
  const entries = items.map((it) => (it.kind === 'file' ? it.webkitGetAsEntry?.() ?? null : null));

  if (entries.some((e) => e?.isDirectory)) {
    const out: ExpandedFile[] = [];
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.isDirectory) {
        out.push(...(await readDirectory(entry as FileSystemDirectoryEntry, `${entry.name}/`)));
      } else {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        out.push({ file, path: file.name });
      }
    }
    return out;
  }

  return Array.from(dt.files).map((file) => ({ file, path: file.name }));
}

/** Files from a `<input webkitdirectory>` carry their folder path in webkitRelativePath. */
export function collectFromInput(list: FileList): ExpandedFile[] {
  return Array.from(list).map((file) => ({ file, path: file.webkitRelativePath || file.name }));
}

/**
 * Expand zips into their contents, drop anything that cannot be uploaded, and cap the batch size.
 * Everything returned is a plain supported file the existing one-file upload endpoint can take.
 */
export async function expandForUpload(input: ExpandedFile[]): Promise<ExpandResult> {
  const files: ExpandedFile[] = [];
  const skipped: string[] = [];

  for (const item of input) {
    if (isJunk(item.path)) continue;

    if (isZip(item.file)) {
      const res = await expandZip(item.file);
      files.push(...res.files);
      skipped.push(...res.skipped);
      continue;
    }

    const reason = rejectionReason(item.path, item.file.size);
    if (reason) skipped.push(reason);
    else files.push(item);
  }

  if (files.length > MAX_FILES_PER_BATCH) {
    skipped.push(`${files.length - MAX_FILES_PER_BATCH} files over the limit of ${MAX_FILES_PER_BATCH} per batch were not added`);
    files.length = MAX_FILES_PER_BATCH;
  }

  return { files, skipped };
}
