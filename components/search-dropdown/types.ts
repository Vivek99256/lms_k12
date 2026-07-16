export type DropdownField =
  | "section"
  | "standard"
  | "division"
  | "subject";

export type DropdownValue = string | string[];

export interface AcademicSection {
  id: number;
  sub_institute_id: number;
  title: string;
  short_name: string;
  sort_order: number;
  shift: string;
  medium: string;
}

export interface Standard {
  id: number;
  grade_id: number;
  name: string;
  short_name: string;
  medium: string;
  sub_institute_id: number;
}

export interface Division {
  id: number;
  name: string;
}

export interface Subject {
  subject_id: number;
  subject_name: string;
  standard_id: number;
  standard_name: string;
  subject_image?: string;
  subject_category?: string;
}

export interface SearchDropdownValues {
  section: DropdownValue;
  standard: DropdownValue;
  division: DropdownValue;
  subject: DropdownValue;
}

export interface MultipleSelectionConfig {
  section?: boolean;
  standard?: boolean;
  division?: boolean;
  subject?: boolean;
}

export interface SearchDropdownProps {
  fields?: DropdownField[];
  token?: string;
  subInstituteId?: string | number;
  values?: Partial<SearchDropdownValues>;
  multiple?: MultipleSelectionConfig;
  disabled?: Partial<Record<DropdownField, boolean>>;
  required?: Partial<Record<DropdownField, boolean>>;
  labels?: Partial<Record<DropdownField, string>>;
  placeholders?: Partial<Record<DropdownField, string>>;
  className?: string;
  onChange?: (
    values: SearchDropdownValues,
    changedField: DropdownField
  ) => void;
  onSectionChange?: (
    value: DropdownValue,
    selectedData: AcademicSection[]
  ) => void;
  onStandardChange?: (
    value: DropdownValue,
    selectedData: Standard[]
  ) => void;
  onDivisionChange?: (
    value: DropdownValue,
    selectedData: Division[]
  ) => void;
  onSubjectChange?: (
    value: DropdownValue,
    selectedData: Subject[]
  ) => void;
}
