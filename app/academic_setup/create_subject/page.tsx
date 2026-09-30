import { AcademicSetupPage } from "../_components/AcademicSetupPage";

export default function CreateSubjectPage() {
  return <AcademicSetupPage config={{
    module: "subjects",
    title: "Create subject",
    description: "Create and maintain the institute subject master.",
    singular: "Subject",
    fields: [
      { key: "subject_name", label: "Subject name", kind: "text", required: true },
      { key: "subject_code", label: "Subject code", kind: "text", required: true },
      { key: "short_name", label: "Short name", kind: "text", required: true },
      { key: "subject_type", label: "Major subject", kind: "checkbox" },
    ],
    columns: [
      { key: "subject_name", label: "Subject name" },
      { key: "subject_code", label: "Subject code" },
      { key: "short_name", label: "Short name" },
      { key: "subject_type", label: "Type" },
    ],
  }} />;
}
