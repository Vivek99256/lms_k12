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
  const ext = extensionOf(path);
  if (!ext) {
    return 'it has no file extension, so its type could not be identified. Supported types are PDF, Word, Excel, PowerPoint, text, CSV and images';
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `.${ext} files are not supported. Supported types are PDF, Word, Excel, PowerPoint, text, CSV and images`;
  }
  if (size === 0) return 'the file is empty (0 bytes)';
  if (size > MAX_FILE_BYTES) {
    return `the file is ${(size / (1024 * 1024)).toFixed(1)} MB, which is over the 50 MB limit`;
  }
  return null;
}

/** "<file>: could not be added because <reason>." */
function skipText(path: string, reason: string): string {
  return `${path}: could not be added because ${reason.replace(/[.\s]+$/, '')}.`;
}

const MAX_ZIP_DEPTH = 6;

interface ZipEntryInfo {
  name: string;
  size: number;
}

/** Budget shared across every zip (and nested zip) in one batch. */
interface ZipBudget {
  bytes: number;
}

/** Lists the real entries of a zip without inflating any of them. */
function listZipEntries(data: Uint8Array): Promise<ZipEntryInfo[]> {
  return new Promise((resolve, reject) => {
    const entries: ZipEntryInfo[] = [];
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

/** Inflates only the entries that were approved up front, so rejected ones are never decompressed. */
function inflateEntries(data: Uint8Array, approved: Set<string>): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, { filter: (entry) => approved.has(entry.name) }, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

function describeZipError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/encrypt|password/i.test(text)) return 'it is password protected';
  if (/invalid zip|unknown compression|unexpected|end of data|invalid/i.test(text)) return 'it is damaged or not a valid zip';
  return `it could not be opened (${text})`;
}

/**
 * Unpacks a zip into its files, descending into folders inside it and into any zip nested in it.
 * `label` is the path shown to the user for this archive.
 */
async function expandZip(file: File, label: string, depth: number, budget: ZipBudget): Promise<ExpandResult> {
  if (depth > MAX_ZIP_DEPTH) {
    return { files: [], skipped: [`${label}: zips are nested more than ${MAX_ZIP_DEPTH} levels deep, so this one was not opened`] };
  }

  let data: Uint8Array;
  try {
    data = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { files: [], skipped: [`${label}: the file could not be read from your device`] };
  }

  let entries: ZipEntryInfo[];
  try {
    entries = await listZipEntries(data);
  } catch (err) {
    return { files: [], skipped: [`${label}: could not be extracted because ${describeZipError(err)}`] };
  }

  const files: ExpandedFile[] = [];
  const skipped: string[] = [];
  const approved = new Set<string>();

  for (const entry of entries) {
    const entryLabel = `${label}/${entry.name}`;
    const ext = extensionOf(entry.name);
    if (ext !== 'zip') {
      const reason = rejectionReason(entry.name, entry.size);
      if (reason) {
        skipped.push(skipText(entryLabel, reason));
        continue;
      }
    } else if (entry.size === 0 || entry.size > MAX_FILE_BYTES) {
      skipped.push(
        skipText(
          entryLabel,
          entry.size === 0
            ? 'the zip inside it is empty (0 bytes)'
            : `the zip inside it is ${(entry.size / (1024 * 1024)).toFixed(1)} MB, over the 50 MB limit`,
        ),
      );
      continue;
    }
    if (budget.bytes - entry.size < 0) {
      skipped.push(skipText(entryLabel, 'the archives in this batch would unpack to more than 500 MB in total'));
      continue;
    }
    budget.bytes -= entry.size;
    approved.add(entry.name);
  }

  let extracted: Record<string, Uint8Array> = {};
  if (approved.size > 0) {
    try {
      extracted = await inflateEntries(data, approved);
    } catch (err) {
      skipped.push(`${label}: could not be extracted because ${describeZipError(err)}`);
      return { files, skipped };
    }
  }

  for (const [path, bytes] of Object.entries(extracted)) {
    const name = baseName(path);
    const ext = extensionOf(name);
    const entryLabel = `${label}/${path}`;
    const blob = new File([bytes as BlobPart], name, {
      type: ext === 'zip' ? 'application/zip' : MIME_BY_EXTENSION[ext] ?? 'application/octet-stream',
      lastModified: file.lastModified,
    });

    if (ext === 'zip') {
      const nested = await expandZip(blob, entryLabel.replace(/\.zip$/i, ''), depth + 1, budget);
      files.push(...nested.files);
      skipped.push(...nested.skipped);
    } else {
      files.push({ file: blob, path: entryLabel });
    }
  }

  if (files.length === 0 && skipped.length === 0) skipped.push(`${label}: the zip contains no files`);
  return { files, skipped };
}

/** Walk a dropped directory entry (the non-standard but universally supported webkit API). */
async function readDirectory(
  entry: FileSystemDirectoryEntry,
  prefix: string,
  out: ExpandedFile[],
  skipped: string[],
): Promise<void> {
  const reader = entry.createReader();
  const children: FileSystemEntry[] = [];
  try {
    // readEntries returns results in chunks; keep calling until it returns an empty batch.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      children.push(...batch);
    }
  } catch {
    skipped.push(skipText(prefix.replace(/\/$/, ''), 'the folder could not be read. It may have been moved, or your browser may not have permission to open it'));
    return;
  }

  for (const child of children) {
    const path = `${prefix}${child.name}`;
    if (isJunk(path)) continue;
    if (child.isDirectory) {
      await readDirectory(child as FileSystemDirectoryEntry, `${path}/`, out, skipped);
    } else {
      try {
        const file = await new Promise<File>((resolve, reject) => (child as FileSystemFileEntry).file(resolve, reject));
        out.push({ file, path });
      } catch {
        skipped.push(skipText(path, 'the file could not be read. It may be open in another program, deleted, or blocked by permissions'));
      }
    }
  }
}

/** Turn a drop event's items into a flat list, descending into any folders that were dropped. */
export async function collectFromDrop(dt: DataTransfer): Promise<ExpandResult> {
  const items = Array.from(dt.items ?? []);
  // Entries and loose files must be read synchronously, before the first await, or the browser invalidates the DataTransfer.
  const entries = items.map((it) => (it.kind === 'file' ? it.webkitGetAsEntry?.() ?? null : null));
  const looseFiles = Array.from(dt.files);

  const out: ExpandedFile[] = [];
  const skipped: string[] = [];

  if (entries.some((e) => e?.isDirectory)) {
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.isDirectory) {
        await readDirectory(entry as FileSystemDirectoryEntry, `${entry.name}/`, out, skipped);
      } else {
        try {
          const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
          out.push({ file, path: file.name });
        } catch {
          skipped.push(skipText(entry.name, 'the file could not be read. It may be open in another program, deleted, or blocked by permissions'));
        }
      }
    }
    return { files: out, skipped };
  }

  return { files: looseFiles.map((file) => ({ file, path: file.name })), skipped };
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
  const budget: ZipBudget = { bytes: MAX_ARCHIVE_BYTES };

  for (const item of input) {
    if (isJunk(item.path)) continue;

    if (isZip(item.file)) {
      const res = await expandZip(item.file, item.path.replace(/\.zip$/i, ''), 0, budget);
      files.push(...res.files);
      skipped.push(...res.skipped);
      continue;
    }

    const reason = rejectionReason(item.path, item.file.size);
    if (reason) skipped.push(skipText(item.path, reason));
    else files.push(item);
  }

  if (files.length > MAX_FILES_PER_BATCH) {
    for (const extra of files.slice(MAX_FILES_PER_BATCH)) {
      skipped.push(skipText(extra.path, `a batch can hold at most ${MAX_FILES_PER_BATCH} files. Upload the rest in another batch`));
    }
    files.length = MAX_FILES_PER_BATCH;
  }

  return { files, skipped };
}
