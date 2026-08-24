import {
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * Admission → Forms data layer (admission\admissionMasterController::index, `admission_master`).
 *
 *   GET /admission/admission_master?type=API&sub_institute_id&syear
 *
 * Mirrors resources/views/admission/master/add.blade.php. The backend has no
 * concept of multiple named "templates" — it exposes the three admission-stage
 * forms (enquiry, registration/admission-form, confirmation) built from the
 * live table schema plus any per-institute custom fields configured in
 * tblcustom_fields, along with the standards list and per-standard age
 * validation rules. Those three stages are what this screen renders as its
 * "forms" list.
 */

export interface AdmissionFormField {
  name: string;
  type: string;
  required: boolean;
}

export interface AdmissionFormTemplate {
  id: string;
  title: string;
  grades: string;
  status: 'Published' | 'Draft';
  fieldsCount: number;
  ageRule: string;
  fields: AdmissionFormField[];
}

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

function prettifyFieldName(value: string): string {
  return value
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readSchemaFields(value: unknown): AdmissionFormField[] {
  return toArray(value)
    .map((entry) => readString(entry))
    .filter(Boolean)
    .map((fieldName) => ({ name: prettifyFieldName(fieldName), type: 'text', required: false }));
}

function readCustomFields(value: unknown): AdmissionFormField[] {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    const name =
      readString(record.field_label) || readString(record.column_header) || prettifyFieldName(readString(record.field_name));
    return {
      name,
      type: readString(record.field_type) || 'text',
      required: readString(record.required) === '1',
    };
  });
}

function buildGradesSummary(standards: Record<string, unknown>[]): string {
  const names = standards.map((standard) => readString(standard.name)).filter(Boolean);
  if (names.length === 0) return 'All grades';
  if (names.length <= 3) return names.join(', ');
  return `${names[0]} – ${names[names.length - 1]} (${names.length} grades)`;
}

function buildAgeRuleSummary(ageValidation: Record<string, unknown>[]): string {
  if (ageValidation.length === 0) return 'No age validation configured';
  const parts = ageValidation
    .slice(0, 3)
    .map((row) => {
      const name = readString(row.name);
      const date = readString(row.date);
      return name && date ? `${name}: as on ${date}` : '';
    })
    .filter(Boolean);
  if (parts.length === 0) return 'No age validation configured';
  const suffix = ageValidation.length > parts.length ? ` +${ageValidation.length - parts.length} more` : '';
  return parts.join(' · ') + suffix;
}

const STAGE_TABLE_NAME_BY_ID: Record<string, string> = {
  AF: 'enquiry',
  RF: 'registration',
  CF: 'confirmation',
};

/** Adds a custom field to one of the 3 admission stages — admissionMasterController::store. */
export async function addCustomField(stageId: string, fieldLabel: string): Promise<void> {
  const tableName = STAGE_TABLE_NAME_BY_ID[stageId];
  if (!tableName) throw new Error(`Unknown admission form stage: ${stageId}`);

  const session = requireSession();
  const url = new URL(`${session.baseUrl}/admission/admission_master`);
  url.searchParams.set('type', 'API');
  if (session.subInstituteId) url.searchParams.set('sub_institute_id', session.subInstituteId);
  if (session.syear) url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({
      type: 'API',
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      table_name: tableName,
      [`${tableName}Fields`]: [fieldLabel],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to add the field.`);
  const raw = toRecord(await readJson(res, 'Failed to add the field'));
  if (readString(raw.status_code) !== '1') {
    throw new Error(readString(raw.message) || 'Failed to add the field.');
  }
}

export async function fetchAdmissionFormTemplates(): Promise<AdmissionFormTemplate[]> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/admission/admission_master`);
  url.searchParams.set('type', 'API');
  if (session.subInstituteId) url.searchParams.set('sub_institute_id', session.subInstituteId);
  if (session.syear) url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load admission forms.`);
  const raw = toRecord(await readJson(res, 'Failed to load admission forms'));
  if (readString(raw.status) === '2') {
    throw new Error(readString(raw.message) || 'Failed to load admission forms.');
  }

  const standards = toArray(raw.standard).map(toRecord);
  const ageValidation = toArray(raw.ageValidation).map(toRecord);
  const grades = buildGradesSummary(standards);
  const ageRule = buildAgeRuleSummary(ageValidation);

  const stages: Array<{ id: string; title: string; fieldsKey: string; customKey: string }> = [
    { id: 'AF', title: 'Admission enquiry form', fieldsKey: 'enquryFields', customKey: 'enquiryCustoms' },
    { id: 'RF', title: 'Admission registration form', fieldsKey: 'RegistrationFields', customKey: 'registrationCustom' },
    { id: 'CF', title: 'Admission confirmation form', fieldsKey: 'confirmationFields', customKey: 'confirmationCustom' },
  ];

  return stages.map((stage) => {
    const schemaFields = readSchemaFields(raw[stage.fieldsKey]);
    const customFields = readCustomFields(raw[stage.customKey]);
    const fields = [...schemaFields, ...customFields];

    return {
      id: stage.id,
      title: stage.title,
      grades,
      status: customFields.length > 0 ? 'Published' : 'Draft',
      fieldsCount: fields.length,
      ageRule,
      fields,
    };
  });
}
