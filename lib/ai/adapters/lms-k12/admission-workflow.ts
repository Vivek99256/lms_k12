export type AdmissionOption = {
  value: string;
  label: string;
};

export type AdmissionSlot = {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "phone";
  required: boolean;
  value?: string;
  options?: AdmissionOption[];
};

const REQUIRED_CONFIRMATION_FIELDS = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "standardId",
  "divisionId",
  "studentQuotaId",
  "admissionDate",
] as const;

const FIELD_ALIASES: Record<string, RegExp[]> = {
  first_name: [/(?:first\s*name|firstname)\s*[:=-]\s*([^,;\n]+)/i],
  middle_name: [/(?:middle\s*name|middlename)\s*[:=-]\s*([^,;\n]+)/i],
  last_name: [/(?:last\s*name|lastname|surname)\s*[:=-]\s*([^,;\n]+)/i],
  mobile: [/(?:mobile\s*(?:number|no)?|phone)\s*[:=-]\s*([0-9+\-\s]+)/i],
  date_of_birth: [/(?:date\s*of\s*birth|birth\s*date|dob)\s*[:=-]\s*([^,;\n]+)/i],
  admission_standard: [
    /(?:admission\s*standard|standard|std|class|grade)\s*[:=-]\s*([^,;\n]+)/i,
  ],
  admission_division: [/(?:division|divisio|div|section)\s*[:=-]\s*([^,;\n]+)/i],
  student_quota: [/(?:student\s*quota|quota)\s*[:=-]\s*([^,;\n]+)/i],
  admission_date: [/(?:admission\s*date|admissiondate)\s*[:=-]\s*([^,;\n]+)/i],
  enquiry_no: [/(?:enquiry|inquiry)(?:\s*(?:number|no|id))?\s*[:=#-]\s*([a-z0-9/-]+)/i],
};

function readText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function isFilled(value: unknown) {
  return readText(value) !== "";
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeOptionToken(value: string) {
  return normalizeToken(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function toOptions(rows: unknown, labelKeys: string[]) {
  if (!Array.isArray(rows)) {
    return [] as AdmissionOption[];
  }

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const record = row as Record<string, unknown>;
      const value = readText(record.id ?? record.value ?? record.display_value);
      const label = labelKeys
        .map((key) => readText(record[key]))
        .find(Boolean);
      if (!value || !label) {
        return null;
      }
      return { value, label };
    })
    .filter((option): option is AdmissionOption => Boolean(option));
}

export function buildAdmissionSlots(
  detail: Record<string, unknown>,
  detailPayload: Record<string, unknown> | null
) {
  const standardOptions = toOptions(detailPayload?.standard, ["name", "title"]);
  const divisionOptions = toOptions(detailPayload?.division, ["name", "title"]);
  const quotaOptions = toOptions(detailPayload?.category, ["title", "name"]);

  const slots: AdmissionSlot[] = [
    { key: "first_name", label: "First name", type: "text", required: true, value: readText(detail.first_name) },
    { key: "last_name", label: "Last name", type: "text", required: true, value: readText(detail.last_name) },
    { key: "mobile", label: "Mobile number", type: "phone", required: true, value: readText(detail.mobile) },
    { key: "date_of_birth", label: "Date of birth", type: "date", required: true, value: readText(detail.date_of_birth) },
    {
      key: "admission_standard",
      label: "Admission standard",
      type: "select",
      required: true,
      value: readText(detail.admission_standard || detail.std_name),
      options: standardOptions,
    },
    {
      key: "admission_division",
      label: "Division",
      type: "select",
      required: true,
      value: readText(detail.admission_division),
      options: divisionOptions,
    },
    {
      key: "student_quota",
      label: "Student quota",
      type: "select",
      required: true,
      value: readText(detail.student_quota),
      options: quotaOptions,
    },
    {
      key: "admission_date",
      label: "Admission date",
      type: "date",
      required: true,
      value: readText(detail.admission_date),
    },
  ];

  return slots.filter((slot) => slot.required && !isFilled(slot.value)).slice(0, 8);
}

export function normalizeAdmissionData(data: Record<string, unknown>) {
  const firstName =
    readText(data.firstName) ||
    readText(data.first_name) ||
    readText(data.firstname);
  const middleName =
    readText(data.middleName) ||
    readText(data.middle_name) ||
    readText(data.middlename);
  const lastName =
    readText(data.lastName) ||
    readText(data.last_name) ||
    readText(data.lastname) ||
    readText(data.surname);
  const standardId =
    readText(data.standardId) ||
    readText(data.standard_id) ||
    readText(data.admission_standard_id);
  const standardName =
    readText(data.standardName) ||
    readText(data.standard_name) ||
    readText(data.standard) ||
    readText(data.admission_standard) ||
    readText(data.std_name);
  const divisionId =
    readText(data.divisionId) ||
    readText(data.division_id) ||
    readText(data.admission_division_id);
  const divisionName =
    readText(data.divisionName) ||
    readText(data.division_name) ||
    readText(data.division) ||
    readText(data.admission_division);
  const studentQuotaId =
    readText(data.studentQuotaId) ||
    readText(data.student_quota_id) ||
    readText(data.quota_id);
  const studentQuotaName =
    readText(data.studentQuotaName) ||
    readText(data.student_quota_name) ||
    readText(data.quota_name) ||
    readText(data.studentQuota) ||
    readText(data.student_quota);

  return {
    ...data,
    firstName,
    first_name: firstName,
    middleName,
    middle_name: middleName,
    lastName,
    last_name: lastName,
    dateOfBirth:
      readText(data.dateOfBirth) ||
      readText(data.date_of_birth) ||
      readText(data.dob),
    date_of_birth:
      readText(data.dateOfBirth) ||
      readText(data.date_of_birth) ||
      readText(data.dob),
    standardId,
    standard_id: standardId,
    standardName,
    standard_name: standardName,
    admission_standard: standardId || standardName,
    divisionId,
    division_id: divisionId,
    divisionName,
    division_name: divisionName,
    admission_division: divisionId || divisionName,
    studentQuotaId,
    student_quota_id: studentQuotaId,
    studentQuotaName,
    student_quota_name: studentQuotaName,
    student_quota: studentQuotaId || studentQuotaName,
    admissionDate:
      readText(data.admissionDate) || readText(data.admission_date),
    admission_date:
      readText(data.admissionDate) || readText(data.admission_date),
    mobile: readText(data.mobile) || readText(data.mobileNo),
    enquiryNo:
      readText(data.enquiryNo) || readText(data.enquiry_no),
    enquiry_no:
      readText(data.enquiryNo) || readText(data.enquiry_no),
  };
}

export function getMissingAdmissionFields(data: Record<string, unknown>) {
  const normalized = normalizeAdmissionData(data);
  return REQUIRED_CONFIRMATION_FIELDS.filter((field) => !isFilled(normalized[field]));
}

function resolveSelectValue(rawValue: string, slot?: AdmissionSlot) {
  if (!slot?.options?.length) {
    return rawValue.trim();
  }

  const wanted = normalizeOptionToken(rawValue);
  const exact = slot.options.find((option) => {
    const optionLabel = normalizeOptionToken(option.label);
    const optionValue = normalizeOptionToken(option.value);
    return optionLabel === wanted || optionValue === wanted;
  });

  if (exact) {
    return exact.value;
  }

  const partial = slot.options.find((option) => {
    const optionLabel = normalizeOptionToken(option.label);
    const optionValue = normalizeOptionToken(option.value);
    return optionLabel.includes(wanted) || wanted.includes(optionLabel) || optionValue === wanted;
  });

  return partial?.value || rawValue.trim();
}

export function parseAdmissionFieldReply(
  message: string,
  expectedFields: string[] = []
) {
  const updates: Record<string, string> = {};

  for (const [field, patterns] of Object.entries(FIELD_ALIASES)) {
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match?.[1]) {
        updates[field] = match[1].trim();
        break;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    return updates;
  }

  if (!expectedFields.length) {
    return updates;
  }

  const values = message
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length !== expectedFields.length) {
    return updates;
  }

  return expectedFields.reduce<Record<string, string>>((result, field, index) => {
    const value = values[index];
    if (value) {
      result[field] = value;
    }
    return result;
  }, {});
}

export function parseAdmissionSlotInput(message: string, slots: AdmissionSlot[]) {
  const expectedFields = slots.map((slot) => slot.key);
  const parsed = parseAdmissionFieldReply(message, expectedFields);
  const normalized = message.trim();
  const lower = normalizeToken(normalized);
  const updates: Record<string, string> = {};

  slots.forEach((slot) => {
    const provided = parsed[slot.key];
    if (provided) {
      updates[slot.key] = resolveSelectValue(provided, slot);
    }
  });

  for (const slot of slots) {
    if (updates[slot.key] || !slot.options?.length) {
      continue;
    }
    const matched = slot.options.find((option) => {
      const normalizedLabel = normalizeToken(option.label);
      return lower.includes(normalizedLabel) || normalizeOptionToken(option.label) === normalizeOptionToken(message);
    });
    if (matched) {
      updates[slot.key] = matched.value;
    }
  }

  if (!updates.first_name && slots.some((slot) => slot.key === "first_name")) {
    const nameParts = normalized
      .replace(/\b(?:first\s*name|last\s*name|date\s*of\s*birth|dob|standard|std|class|grade|division|divisio|div|section|quota|student\s*quota|admission\s*date)\b.*$/i, "")
      .split(/\s+/)
      .filter(Boolean);
    if (nameParts.length >= 1) {
      updates.first_name = nameParts[0];
    }
    if (!updates.last_name && nameParts.length >= 2) {
      updates.last_name = nameParts[nameParts.length - 1];
    }
  }

  return updates;
}

export function resolveAdmissionSelection(
  message: string,
  candidates: Array<{ id: string; studentName?: string; enquiryNo?: string; standard?: string }>
) {
  const normalized = normalizeToken(message);
  const ordinalPatterns: Array<[RegExp, number]> = [
    [/\b(first|1st|one|1)\b/, 0],
    [/\b(second|2nd|two|2)\b/, 1],
    [/\b(third|3rd|three|3)\b/, 2],
    [/\b(fourth|4th|four|4)\b/, 3],
  ];

  for (const [pattern, index] of ordinalPatterns) {
    if (pattern.test(normalized) && candidates[index]) {
      return candidates[index];
    }
  }

  return (
    candidates.find((candidate) => {
      const parts = [
        candidate.studentName || "",
        candidate.enquiryNo || "",
        candidate.standard || "",
      ]
        .map(normalizeToken)
        .filter(Boolean);
      return parts.some((part) => normalized.includes(part) || part.includes(normalized));
    }) || null
  );
}
