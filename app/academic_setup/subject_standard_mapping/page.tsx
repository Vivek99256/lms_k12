import { AcademicSetupPage } from "../_components/AcademicSetupPage";

export default function SubjectStandardMappingPage() {
  return <AcademicSetupPage config={{
    module: "subject-standard-mapping",
    title: "Subject standard mapping",
    description: "Assign subjects and their learning settings to one or more standards.",
    singular: "Subject Mapping",
    fields: [
      { key: "standard_id", label: "Standards", kind: "multiselect", source: "standards", required: true },
      { key: "subject_id", label: "Subject", kind: "select", source: "subjects", required: true },
      { key: "display_name", label: "Display name", kind: "text", required: true },
      { key: "allow_grades", label: "Allow grades", kind: "checkbox" },
      { key: "elective_subject", label: "Elective subject", kind: "checkbox" },
      { key: "optional_type", label: "Optional type", kind: "number" },
      { key: "allow_content", label: "Allow content", kind: "checkbox" },
      { key: "subject_category", label: "Subject category", kind: "select", source: "categories" },
      { key: "sort_order", label: "Sort order", kind: "number" },
      { key: "load", label: "Weekly load", kind: "number" },
      { key: "add_content", label: "Add content", kind: "text", placeholder: "chapterwise or topicwise" },
    ],
    columns: [
      { key: "standard_name", label: "Standard" },
      { key: "subject_name", label: "Subject" },
      { key: "subject_code", label: "Code" },
      { key: "display_name", label: "Display name" },
      { key: "elective_subject", label: "Elective" },
      { key: "sort_order", label: "Sort order" },
    ],
  }} />;
}
