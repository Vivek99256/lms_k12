import type { ProcessGroup, SopModule } from './sop-catalog';

/**
 * The institute's own SOP library, as a module the converter can work from.
 *
 * WHY THIS EXISTS. Two modules ship a digitized SOP (LMS + PAL, Fees), and the
 * Process group and Procedure pickers read those catalogues. Every other module
 * showed both pickers empty — nothing to choose, no indication why.
 *
 * But the institute is already writing SOPs: `ai_sops` holds the documents its
 * staff have generated or uploaded, each with its full text and its PDF, served
 * by GET /api/ai-sop. Those are the procedures a person would actually be
 * converting. So the pickers are filled from that table rather than from a
 * catalogue somebody would have to author first, and nothing here is invented:
 * every option is a document that exists, and choosing one loads its own text.
 *
 * THE SHAPE OF A STORED SOP DECIDES THE MAPPING. AiSopGenerationController
 * writes one document per procedure, sectioned Purpose / Scope /
 * Responsibilities / Procedure / Compliance / Records / Approval / Required
 * documents. A document is therefore one PROCEDURE, not a catalogue of them,
 * and the Process group above it is a bucket of documents:
 *
 *   Process group  ->  "Student SOPs" | "Institute SOP library"
 *   Procedure      ->  one stored document
 *   Load SOP text  ->  that document's `sop_content`
 *
 * WHY TWO BUCKETS. The table has no column saying which ERP module a document
 * belongs to — `department_id` points at a departments table that does not
 * resolve in every tenant — so the module is matched on the document's own
 * name. A match is a strong signal and goes in the module's own group; an
 * unmatched document is not hidden, because "the SOP I want is not in the list"
 * is worse than a second group labelled for what it is. Nothing is claimed
 * about the unmatched ones beyond their being the institute's.
 */

/** One row of `ai_sops`, as the list endpoint returns it. */
export interface StoredSop {
  id: number;
  name: string;
  /** The document's full text. Empty for a row that only has a PDF. */
  content: string;
  pdfUrl: string;
  status: string;
}

/** The ref a stored document is offered under. Unique, and visibly not an SOP number. */
export function sopRef(id: number): string {
  return `SOP-${id}`;
}

/** The document behind a ref, for loading its text. */
export function findStoredSop(sops: StoredSop[], ref: string): StoredSop | undefined {
  return sops.find((sop) => sopRef(sop.id) === ref);
}

/**
 * Whether a document is about a module, by its name.
 *
 * Deliberately narrow: whole-word-ish matching on the module's name and its
 * singular, so "Fees SOP" and "Fee Collection" match Fees while "Technical
 * Services" matches neither. A loose match would put every document in every
 * module's group and make the grouping meaningless.
 */
function mentions(name: string, moduleName: string): boolean {
  const haystack = name.toLowerCase();
  const needle = moduleName.trim().toLowerCase();

  if (!needle) return false;

  const forms = new Set([needle]);
  if (needle.endsWith('s')) forms.add(needle.slice(0, -1));
  else forms.add(`${needle}s`);

  return [...forms].some((form) => new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack));
}

/**
 * A module backed by the institute's SOP library rather than a shipped
 * catalogue.
 *
 * `digitized` is true on every entry, and it is true in the sense the flag
 * means: the document's full text is available to load. What these entries do
 * not carry is the SOP's numbered step tables, so a converted procedure will
 * still report its number as unresolved — which is accurate, because the
 * numbering belongs to a catalogue nobody has authored for this module.
 */
export function libraryModule(key: string, name: string, sops: StoredSop[]): SopModule {
  const usable = sops.filter((sop) => sop.content.trim() !== '' || sop.pdfUrl !== '');
  const mine = usable.filter((sop) => mentions(sop.name, name));
  const rest = usable.filter((sop) => !mine.includes(sop));

  const groups: ProcessGroup[] = [];

  const toGroup = (ref: string, title: string, rows: StoredSop[]): ProcessGroup => ({
    ref,
    title,
    lifecycleStage: '',
    procedures: rows.map((sop) => ({
      ref: sopRef(sop.id),
      title: sop.name,
      // The library records no actor, and the five acting modes are the SOP's
      // vocabulary, not this table's. 'teacher' is the neutral default the
      // parser uses for a person-run step; the pasted text decides the real
      // actors.
      primaryActor: 'teacher' as const,
      digitized: sop.content.trim() !== '',
    })),
  });

  if (mine.length > 0) groups.push(toGroup('SOP', `${name} SOPs`, mine));
  if (rest.length > 0) groups.push(toGroup('LIB', 'Institute SOP library', rest));

  return {
    key,
    name,
    // Still empty: these are the institute's documents, and there is no single
    // SOP document, version or effective date covering the module. Inventing
    // one would be copied onto every process saved from here.
    sop: { document: '', version: '', organization: '', effectiveDate: '' },
    lifecycleStages: [],
    groups,
    businessRules: [],
    records: [],
  };
}

/* ------------------------------------------------------------------ client */

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * The institute's active SOPs.
 *
 * Upstream: next_lms_erp/routes/api.php -> GET /api/ai-sop
 *           AiSopGenerationController::index
 *
 * Only Active documents: a draft is somebody's work in progress and a converted
 * process would carry its number as provenance.
 */
export function readStoredSops(payload: unknown): StoredSop[] {
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as Record<string, unknown>;
  const rows = Array.isArray(root.data) ? root.data : [];

  return rows.flatMap((row): StoredSop[] => {
    if (!row || typeof row !== 'object') return [];
    const record = row as Record<string, unknown>;
    const id = Number(record.id);
    const name = readString(record.sop_name).trim();

    if (!Number.isFinite(id) || id <= 0 || name === '') return [];

    return [
      {
        id,
        name,
        content: readString(record.sop_content),
        pdfUrl: readString(record.pdf_url),
        status: readString(record.status),
      },
    ];
  });
}
