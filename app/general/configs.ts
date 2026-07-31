import type { GeneralConfig } from "./_components/GeneralPage";

export const templateConfig: GeneralConfig = {
  module: "templates", title: "Template Management", description: "Create and maintain reusable ERP document templates.", singular: "Template",
  fields: [
    { key: "module_name", label: "Module Name", kind: "text", required: true },
    { key: "title", label: "Template Title", kind: "text", required: true },
    { key: "html_content", label: "HTML Content", kind: "textarea", rows: 14, required: true },
  ],
  columns: [
    { key: "module_name", label: "Module" }, { key: "title", label: "Title" },
    { key: "created_by_name", label: "Created By" }, { key: "status", label: "Status" },
  ],
};

export const formBuilderConfig: GeneralConfig = {
  module: "forms", title: "Form Builder", description: "Create dynamic forms using the stored XML and JSON schema formats.", singular: "Form",
  fields: [
    { key: "form_name", label: "Form Name", kind: "text", required: true },
    { key: "form_json", label: "Form JSON", kind: "textarea", rows: 12, required: true },
    { key: "form_xml", label: "Form XML", kind: "textarea", rows: 8 },
    { key: "form_active", label: "Active", kind: "checkbox" },
  ],
  columns: [
    { key: "form_name", label: "Form Name" }, { key: "form_active", label: "Active" },
    { key: "created_at", label: "Created" }, { key: "updated_at", label: "Updated" },
  ],
};

export const userProfileConfig: GeneralConfig = {
  module: "user-profiles", title: "User Profile Masters", description: "Maintain ERP profile hierarchy and display order.", singular: "User Profile",
  fields: [
    { key: "parent_id", label: "Parent Profile", kind: "select", source: "profiles" },
    { key: "profile_name", label: "Profile Name", kind: "text", required: true },
    { key: "profile_description", label: "Description", kind: "textarea", rows: 4 },
    { key: "sort_order", label: "Sort Order", kind: "number", required: true },
  ],
  columns: [
    { key: "name", label: "Profile" }, { key: "description", label: "Description" },
    { key: "parent_name", label: "Parent" }, { key: "sort_order", label: "Sort Order" },
  ],
};

export const implementationConfig: GeneralConfig = {
  module: "implementations", title: "Implementation Management", description: "Capture expected institute and standard-wise student strength.", singular: "Implementation",
  fields: [
    { key: "total_boys", label: "Total Boys", kind: "number", required: true },
    { key: "total_girls", label: "Total Girls", kind: "number", required: true },
    { key: "total_strenght", label: "Total Strength", kind: "number", required: true },
    { key: "total_male", label: "Male Staff", kind: "number" },
    { key: "total_female", label: "Female Staff", kind: "number" },
    { key: "standard_totals", label: "Standard-wise Totals (JSON)", kind: "textarea", rows: 8, required: true },
  ],
  columns: [
    { key: "standard_name", label: "Standard" }, { key: "std_wise_total_boys", label: "Boys" },
    { key: "std_wise_total_girls", label: "Girls" }, { key: "std_wise_total", label: "Total" },
  ],
};

export const bulkUploadConfig: GeneralConfig = {
  module: "bulk-upload", title: "Bulk Upload", description: "Create multiple chapters for a grade, standard, and mapped subject.", singular: "Bulk Chapter Upload",
  fields: [
    { key: "grade_id", label: "Grade", kind: "select", source: "grades", required: true },
    { key: "standard_id", label: "Standard", kind: "select", source: "standards", dependsOn: "grade_id", required: true },
    { key: "subject_id", label: "Subject", kind: "select", source: "subjects", dependsOn: "standard_id", required: true },
    { key: "chapters", label: "Chapters (JSON array with chapter_name, chapter_desc, availability and show_hide)", kind: "textarea", rows: 12, required: true },
  ],
  columns: [
    { key: "chapter_name", label: "Chapter" }, { key: "standard_name", label: "Standard" },
    { key: "subject_name", label: "Subject" }, { key: "availability", label: "Availability" },
    { key: "show_hide", label: "Visibility" },
  ],
};
