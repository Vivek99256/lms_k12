import { loadGeneral, saveGeneral, getGeneralSession, type GeneralRecord } from "../api";
import { buildSessionContext, readString } from "@/lib/erp-client";

export type ImplementationStrengthRow = {
  standardId: number;
  standardName: string;
  boys: string;
  girls: string;
  total: string;
};

export type ImplementationManagementData = {
  totalBoys: string;
  totalGirls: string;
  totalStrength: string;
  totalMale: string;
  totalFemale: string;
  finalStdTotalBoys: string;
  finalStdTotalGirls: string;
  finalStdTotal: string;
  rows: ImplementationStrengthRow[];
};

export type ImplementationWelcomeData = {
  accountNumber: string;
  creationDate: string;
  schoolName: string;
  userName: string;
  mobile: string;
  email: string;
  firstName: string;
  lastName: string;
};

function text(value: string | number | boolean | null | undefined): string {
  return value == null ? "" : String(value);
}

function firstRecord(records: GeneralRecord[]): GeneralRecord | null {
  return records.length > 0 ? records[0] : null;
}

export async function loadImplementationWelcome(): Promise<ImplementationWelcomeData> {
  const session = buildSessionContext();
  const stored =
    typeof window === "undefined"
      ? {}
      : (JSON.parse(localStorage.getItem("userData") || "{}") as Record<string, unknown>);
  const userId = readString(stored.user_id ?? stored.userId ?? stored.id).trim();
  const firstName = readString(stored.first_name ?? stored.firstName).trim();
  const lastName = readString(stored.last_name ?? stored.lastName).trim();
  const schoolName = readString(
    stored.school_name ?? stored.schoolName ?? stored.SchoolName ?? stored.institute_name
  ).trim();

  return {
    accountNumber: userId ? userId.padStart(5, "0") : "",
    creationDate: readString(stored.created_at ?? stored.createdAt).trim(),
    schoolName: schoolName || session.baseUrl.replace(/^https?:\/\//, ""),
    userName: readString(stored.user_name ?? stored.userName ?? stored.username).trim(),
    mobile: readString(stored.mobile ?? stored.phone).trim(),
    email: readString(stored.email).trim(),
    firstName,
    lastName,
  };
}

export async function loadImplementationManagement(): Promise<ImplementationManagementData> {
  const data = await loadGeneral("implementations", getGeneralSession());
  const savedRows = new Map<number, GeneralRecord>();

  data.records.forEach((record) => {
    const standardId = Number(record.values.standard_id ?? 0);
    if (standardId > 0) {
      savedRows.set(standardId, record);
    }
  });

  const first = firstRecord(data.records);

  return {
    totalBoys: text(first?.values.total_boys),
    totalGirls: text(first?.values.total_girls),
    totalStrength: text(first?.values.total_strenght),
    totalMale: text(first?.values.total_male),
    totalFemale: text(first?.values.total_female),
    finalStdTotalBoys: text(first?.values.final_std_total_boys),
    finalStdTotalGirls: text(first?.values.final_std_total_girls),
    finalStdTotal: text(first?.values.final_std_total),
    rows: data.standards.map((standard) => {
      const record = savedRows.get(standard.id);
      const boys = text(record?.values.std_wise_total_boys);
      const girls = text(record?.values.std_wise_total_girls);
      const total = text(record?.values.std_wise_total);

      return {
        standardId: standard.id,
        standardName: standard.label,
        boys,
        girls,
        total,
      };
    }),
  };
}

export async function saveImplementationManagement(
  input: ImplementationManagementData
): Promise<string> {
  const standardTotals = Object.fromEntries(
    input.rows.map((row) => [
      row.standardId,
      {
        boys: Number(row.boys || 0),
        girls: Number(row.girls || 0),
        std_wise_total_boys: Number(row.boys || 0),
        std_wise_total_girls: Number(row.girls || 0),
        std_wise_total: Number(row.total || 0),
      },
    ])
  );

  return saveGeneral("implementations", getGeneralSession(), {
    total_boys: Number(input.totalBoys || 0),
    total_girls: Number(input.totalGirls || 0),
    total_strenght: Number(input.totalStrength || 0),
    total_male: Number(input.totalMale || 0),
    total_female: Number(input.totalFemale || 0),
    final_std_total_boys: Number(input.finalStdTotalBoys || 0),
    final_std_total_girls: Number(input.finalStdTotalGirls || 0),
    final_std_total: Number(input.finalStdTotal || 0),
    standard_totals: JSON.stringify(standardTotals),
  });
}
