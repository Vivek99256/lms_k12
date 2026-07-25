import type { HostelModule } from "./setup-api";

export type HostelFieldConfig = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "select" | "date";
  required?: boolean;
  options?: string[];
  source?: "hostelTypes" | "roomTypes" | "admissionCategories" | "hostels" | "buildings" | "floors" | "rooms" | "profiles" | "grades" | "standards" | "divisions" | "students";
  dependsOn?: string;
};

export type HostelPageConfig = {
  module: HostelModule;
  title: string;
  description: string;
  kind: "master" | "allocation" | "report";
  singular: string;
  fields?: HostelFieldConfig[];
  columns: Array<{ key: string; label: string }>;
  filters?: HostelFieldConfig[];
};

export const hostelConfigs: Record<HostelModule, HostelPageConfig> = {
  "type-master": {
    module: "type-master",
    title: "Type Master",
    description: "Maintain hostel types, descriptions, and active status exactly as defined in the legacy ERP.",
    kind: "master",
    singular: "Hostel Type",
    fields: [
      { key: "hostel_type", label: "Hostel Type", kind: "text", required: true },
      { key: "description", label: "Description", kind: "textarea", required: true },
      { key: "status", label: "Status", kind: "select", required: true, options: ["Yes", "No"] },
    ],
    columns: [
      { key: "hostel_type", label: "Hostel Type" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
    ],
  },
  "room-type-master": {
    module: "room-type-master",
    title: "Room Type Master",
    description: "Maintain room type names and availability status for hostel room planning.",
    kind: "master",
    singular: "Room Type",
    fields: [
      { key: "room_type", label: "Room Type Name", kind: "text", required: true },
      { key: "status", label: "Status", kind: "select", required: true, options: ["Yes", "No"] },
    ],
    columns: [
      { key: "room_type", label: "Room Type" },
      { key: "status", label: "Status" },
    ],
  },
  "admission-category-master": {
    module: "admission-category-master",
    title: "Admission Category Master",
    description: "Manage hostel admission categories used during room allocation and reporting.",
    kind: "master",
    singular: "Admission Category",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "description", label: "Description", kind: "textarea", required: true },
    ],
    columns: [
      { key: "title", label: "Title" },
      { key: "description", label: "Description" },
    ],
  },
  "hostel-master": {
    module: "hostel-master",
    title: "Hostel Master",
    description: "Create and manage hostel records, hostel type mapping, warden details, and dynamic custom fields.",
    kind: "master",
    singular: "Hostel",
    fields: [
      { key: "code", label: "Code", kind: "text", required: true },
      { key: "name", label: "Hostel Name", kind: "text", required: true },
      { key: "hostel_type_id", label: "Hostel Type", kind: "select", required: true, source: "hostelTypes" },
      { key: "description", label: "Description", kind: "textarea", required: true },
      { key: "warden", label: "Warden", kind: "text", required: true },
      { key: "warden_contact", label: "Warden Contact", kind: "text", required: true },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Hostel Name" },
      { key: "hostel_type_name", label: "Hostel Type" },
      { key: "warden", label: "Warden" },
      { key: "warden_contact", label: "Warden Contact" },
    ],
  },
  "building-master": {
    module: "building-master",
    title: "Building Master",
    description: "Maintain hostel buildings with dependent hostel type and hostel selection.",
    kind: "master",
    singular: "Building",
    fields: [
      { key: "hostel_type_id", label: "Hostel Type", kind: "select", required: true, source: "hostelTypes" },
      { key: "hostel_id", label: "Hostel", kind: "select", required: true, source: "hostels", dependsOn: "hostel_type_id" },
      { key: "building_name", label: "Building Name", kind: "text", required: true },
    ],
    columns: [
      { key: "hostel_type_name", label: "Hostel Type" },
      { key: "hostel_name", label: "Hostel" },
      { key: "building_name", label: "Building Name" },
    ],
  },
  "floor-master": {
    module: "floor-master",
    title: "Floor Master",
    description: "Maintain hostel floors with dependent hostel and building selection.",
    kind: "master",
    singular: "Floor",
    fields: [
      { key: "hostel_id", label: "Hostel", kind: "select", source: "hostels" },
      { key: "building_id", label: "Building", kind: "select", required: true, source: "buildings", dependsOn: "hostel_id" },
      { key: "floor_name", label: "Floor Name", kind: "text", required: true },
    ],
    columns: [
      { key: "hostel_name", label: "Hostel" },
      { key: "building_name", label: "Building" },
      { key: "floor_name", label: "Floor" },
    ],
  },
  "room-master": {
    module: "room-master",
    title: "Room Master",
    description: "Maintain hostel room records and track allocated count from the current academic year.",
    kind: "master",
    singular: "Room",
    fields: [
      { key: "hostel_id", label: "Hostel", kind: "select", source: "hostels" },
      { key: "building_id", label: "Building", kind: "select", source: "buildings", dependsOn: "hostel_id" },
      { key: "floor_id", label: "Floor", kind: "select", required: true, source: "floors", dependsOn: "building_id" },
      { key: "room_name", label: "Room Number", kind: "text", required: true },
    ],
    columns: [
      { key: "hostel_name", label: "Hostel" },
      { key: "building_name", label: "Building" },
      { key: "floor_name", label: "Floor" },
      { key: "room_name", label: "Room" },
      { key: "allocated_count", label: "Allocated Beds" },
    ],
  },
  "hostel-room-allocation": {
    module: "hostel-room-allocation",
    title: "Hostel Room Allocation",
    description: "Search students or staff, filter available rooms, and create or update room allocations with hostel-specific details.",
    kind: "allocation",
    singular: "Allocation",
    filters: [
      { key: "user_profile_id", label: "Profile", kind: "select", source: "profiles" },
      { key: "grade_id", label: "Grade", kind: "select", source: "grades" },
      { key: "standard_id", label: "Standard", kind: "select", source: "standards", dependsOn: "grade_id" },
      { key: "division_id", label: "Division", kind: "select", source: "divisions" },
      { key: "gender", label: "Gender", kind: "select", options: ["M", "F"] },
      { key: "admission_category_id", label: "Admission Category", kind: "select", source: "admissionCategories" },
      { key: "hostel_id", label: "Hostel", kind: "select", source: "hostels" },
      { key: "building_id", label: "Building", kind: "select", source: "buildings", dependsOn: "hostel_id" },
      { key: "floor_id", label: "Floor", kind: "select", source: "floors", dependsOn: "building_id" },
      { key: "room_id", label: "Room", kind: "select", source: "rooms", dependsOn: "floor_id" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "profile_name", label: "Profile" },
      { key: "grade", label: "Grade" },
      { key: "standard", label: "Standard" },
      { key: "division", label: "Division" },
      { key: "gender_label", label: "Gender" },
      { key: "hostel_name", label: "Hostel" },
      { key: "room_name", label: "Room" },
      { key: "bed_no", label: "Bed" },
    ],
  },
  "hostel-report": {
    module: "hostel-report",
    title: "Hostel Report",
    description: "Search and export hostel allocation records using the same filters available in the legacy report.",
    kind: "report",
    singular: "Hostel Report",
    filters: [
      { key: "user_profile_id", label: "Profile", kind: "select", source: "profiles" },
      { key: "grade_id", label: "Grade", kind: "select", source: "grades" },
      { key: "standard_id", label: "Standard", kind: "select", source: "standards", dependsOn: "grade_id" },
      { key: "division_id", label: "Division", kind: "select", source: "divisions" },
      { key: "gender", label: "Gender", kind: "select", options: ["M", "F"] },
      { key: "admission_category_id", label: "Admission Category", kind: "select", source: "admissionCategories" },
      { key: "hostel_id", label: "Hostel", kind: "select", source: "hostels" },
      { key: "room_id", label: "Room", kind: "select", source: "rooms" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "profile_name", label: "Profile" },
      { key: "grade", label: "Grade" },
      { key: "standard", label: "Standard" },
      { key: "division", label: "Division" },
      { key: "gender_label", label: "Gender" },
      { key: "hostel_name", label: "Hostel" },
      { key: "room_name", label: "Room" },
      { key: "bed_no", label: "Bed" },
      { key: "locker_no", label: "Locker" },
      { key: "table_no", label: "Table" },
      { key: "bedsheet_no", label: "Bedsheet" },
    ],
  },
  "available-room-report": {
    module: "available-room-report",
    title: "Available Room Report",
    description: "Search current room availability and export occupancy status for hostels, buildings, floors, and rooms.",
    kind: "report",
    singular: "Available Room Report",
    filters: [
      { key: "hostel_id", label: "Hostel", kind: "select", source: "hostels" },
      { key: "building_id", label: "Building", kind: "select", source: "buildings", dependsOn: "hostel_id" },
      { key: "floor_id", label: "Floor", kind: "select", source: "floors", dependsOn: "building_id" },
      { key: "room_id", label: "Room", kind: "select", source: "rooms", dependsOn: "floor_id" },
    ],
    columns: [
      { key: "hostel_type", label: "Hostel Type" },
      { key: "hostel_name", label: "Hostel" },
      { key: "building_name", label: "Building" },
      { key: "floor_name", label: "Floor" },
      { key: "room_name", label: "Room" },
      { key: "total_capacity", label: "Total Capacity" },
      { key: "allocated_beds", label: "Allocated Beds" },
      { key: "available_beds", label: "Available Beds" },
      { key: "room_status", label: "Room Status" },
    ],
  },
};
