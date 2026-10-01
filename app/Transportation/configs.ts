import type { TransportConfig } from "./_components/TransportationPage";

// Student transport mapping and transport rate are not generic CRUD screens —
// they have their own pages under `student_transport_mapping/` and
// `add_transport_rate/`, matching the search-and-bulk-grid and slab-validation
// flows the ERP requires.

export const driverConfig: TransportConfig = {
  module: "drivers", title: "Add Driver/Conductor", description: "Maintain transport drivers and conductors.", singular: "Driver/Conductor",
  fields: [
    { key: "first_name", label: "First name", kind: "text", required: true },
    { key: "last_name", label: "Last name", kind: "text", required: true },
    { key: "mobile", label: "Mobile", kind: "text", required: true },
    { key: "driver_type", label: "Type", kind: "select", options: ["Driver", "Conductor"], required: true },
    { key: "status", label: "Status", kind: "select", options: ["Active", "Inactive"], required: true },
  ],
  columns: [
    { key: "first_name", label: "First name" }, { key: "last_name", label: "Last name" },
    { key: "mobile", label: "Mobile" }, { key: "type", label: "Type" }, { key: "status", label: "Status" },
  ],
};

export const vehicleConfig: TransportConfig = {
  module: "vehicles", title: "Add vehicle", description: "Maintain vehicles, capacity, shift, driver, and conductor assignments.", singular: "Vehicle",
  fields: [
    { key: "title", label: "Vehicle name", kind: "text", required: true },
    { key: "vehicle_number", label: "Vehicle number", kind: "text", required: true },
    { key: "vehicle_type", label: "Vehicle type", kind: "select", source: "vehicleTypes", required: true },
    { key: "sitting_capacity", label: "Sitting capacity", kind: "number", required: true },
    { key: "school_shift", label: "School shift", kind: "select", source: "shifts", required: true },
    { key: "vehicle_identity_number", label: "Vehicle identity number", kind: "text", required: true },
    { key: "driver", label: "Driver", kind: "select", source: "drivers", required: true },
    { key: "conductor", label: "Conductor", kind: "select", source: "conductors" },
  ],
  columns: [
    { key: "title", label: "Vehicle" }, { key: "vehicle_number", label: "Number" },
    { key: "vehicle_type", label: "Type" }, { key: "sitting_capacity", label: "Capacity" },
    { key: "shift_title", label: "Shift" }, { key: "driver_name", label: "Driver" },
    { key: "conductor_name", label: "Conductor" },
  ],
};

export const routeConfig: TransportConfig = {
  module: "routes", title: "Add route", description: "Maintain academic-year transport routes and timings.", singular: "Route",
  fields: [
    { key: "route_name", label: "Route name", kind: "text", required: true },
    { key: "from_time", label: "From time", kind: "time", required: true },
    { key: "to_time", label: "To time", kind: "time", required: true },
  ],
  columns: [{ key: "route_name", label: "Route" }, { key: "from_time", label: "From time" }, { key: "to_time", label: "To time" }],
};

export const stopConfig: TransportConfig = {
  module: "stops", title: "Add stop", description: "Maintain academic-year transport stops.", singular: "Stop",
  fields: [{ key: "stop_name", label: "Stop name", kind: "text", required: true }],
  columns: [{ key: "stop_name", label: "Stop name" }],
};

export const routeBusConfig: TransportConfig = {
  module: "route-buses", title: "Map Route-Bus", description: "Map transport vehicles to routes.", singular: "Route-Bus Mapping",
  fields: [
    { key: "route_id", label: "Route", kind: "select", source: "routes", required: true },
    { key: "bus_id", label: "Vehicle", kind: "select", source: "vehicles", required: true },
  ],
  columns: [{ key: "route_name", label: "Route" }, { key: "vehicle_name", label: "Vehicle" }, { key: "vehicle_number", label: "Number" }],
};

export const routeStopConfig: TransportConfig = {
  module: "route-stops", title: "Map Route-Stop", description: "Map stops and pickup/drop timings to routes.", singular: "Route-Stop Mapping",
  fields: [
    { key: "route_id", label: "Route", kind: "select", source: "routes", required: true },
    { key: "stop_id", label: "Stop", kind: "select", source: "stops", required: true },
    { key: "pickuptime", label: "Pickup time", kind: "time" }, { key: "droptime", label: "Drop time", kind: "time" },
  ],
  columns: [{ key: "route_name", label: "Route" }, { key: "stop_name", label: "Stop" }, { key: "pickuptime", label: "Pickup" }, { key: "droptime", label: "Drop" }],
};

export const shiftConfig: TransportConfig = {
  module: "shifts", title: "Add shift", description: "Maintain transport shifts and rate settings.", singular: "Shift",
  fields: [
    { key: "shift_title", label: "Shift title", kind: "text", required: true },
    { key: "shift_rate", label: "Shift rate", kind: "number" }, { key: "km_amount", label: "KM Amount", kind: "number" },
  ],
  columns: [{ key: "shift_title", label: "Shift" }, { key: "shift_rate", label: "Rate" }, { key: "km_amount", label: "KM Amount" }],
};

export const vanWiseConfig: TransportConfig = {
  module: "van-wise-report", title: "Van wise report", description: "Review students by pickup/drop vehicle, route, stop, shift, or GR number.", singular: "Report",
  report: true,
  fields: [
    { key: "pickup", label: "Journey", kind: "select", options: ["pickup", "drop"] },
    { key: "van", label: "Vehicle", kind: "select", source: "vehicles" },
    { key: "shift", label: "Shift", kind: "select", source: "shifts" },
    { key: "route", label: "Route", kind: "select", source: "routes" },
    { key: "stop", label: "Stop", kind: "select", source: "stops" },
    { key: "grno", label: "GR no.", kind: "text" },
  ],
  columns: [
    { key: "student_name", label: "Student" }, { key: "enrollment_no", label: "GR no." },
    { key: "standard_division", label: "Class" }, { key: "route_name", label: "Route" },
    { key: "shift_title", label: "Shift" }, { key: "vehicle_name", label: "Vehicle" },
    { key: "from_stop_name", label: "Pickup stop" }, { key: "to_stop_name", label: "Drop stop" },
    { key: "driver_name", label: "Driver" }, { key: "conductor_name", label: "Conductor" }, { key: "amount", label: "Amount" },
  ],
};

export const vanSummaryConfig: TransportConfig = {
  module: "van-summary-report", title: "Van summary report", description: "Review student counts by vehicle and school shift.", singular: "Summary", report: true,
  fields: [],
  columns: [
    { key: "vehicle_name", label: "Vehicle" }, { key: "shift_title", label: "Shift" }, { key: "student_count", label: "Students" },
  ],
};
