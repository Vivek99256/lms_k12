import { AcademicSetupPage } from "../_components/AcademicSetupPage";

export default function CreateSubjectPage() {
  return <AcademicSetupPage config={{
    module: "subjects",
    title: "Create Subject",
    description: "Create and maintain the institute subject master.",
    singular: "Subject",
    fields: [
      { key: "subject_name", label: "Subject Name", kind: "text", required: true },
      { key: "subject_code", label: "Subject Code", kind: "text", required: true },
      { key: "short_name", label: "Short Name", kind: "text", required: true },
      { key: "subject_type", label: "Major Subject", kind: "checkbox" },
    ],
    columns: [
      { key: "subject_name", label: "Subject Name" },
      { key: "subject_code", label: "Subject Code" },
      { key: "short_name", label: "Short Name" },
      { key: "subject_type", label: "Type" },
    ],
  }} />;
}
