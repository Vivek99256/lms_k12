import type { InventoryConfig, InventoryField } from "./_components/InventoryPage";

const item = { key: "item_id", label: "Item", kind: "select", source: "items", required: true } satisfies InventoryField;
const vendor = { key: "vendor_id", label: "Vendor", kind: "select", source: "vendors", required: true } satisfies InventoryField;
const dates: InventoryField[] = [{ key: "from_date", label: "From date", kind: "date", filter: true }, { key: "to_date", label: "To date", kind: "date", filter: true }];
const report = (module: string, title: string, fields: InventoryField[], columns: InventoryConfig["columns"]): InventoryConfig => ({
  module, title, description: `Review and export ${title.toLowerCase()} data.`, singular: "Report", mode: "report", fields, columns,
});
const workflow = (module: string, title: string, fields: InventoryField[], columns: InventoryConfig["columns"]): InventoryConfig => ({
  module, title, description: `Manage the ${title.toLowerCase()} workflow.`, singular: title, mode: "workflow", fields, columns,
});
const master = (module: string, title: string, fields: InventoryField[], columns: InventoryConfig["columns"]): InventoryConfig => ({
  module, title, description: `Create and maintain ${title.toLowerCase()} records.`, singular: title.replace(" Master", ""), mode: "master", fields, columns,
});

export const configs: Record<string, InventoryConfig> = {
  requisition_form: workflow("requisitions", "Requisition Form", [
    { key: "requisition_by", label: "Requisition by", kind: "select", source: "users", required: true },
    { key: "requisition_date", label: "Requisition date", kind: "date", required: true }, item,
    { key: "requisition_qty", label: "Required quantity", kind: "number", required: true },
    { key: "item_unit", label: "Item unit", kind: "select", source: "units", required: true },
    { key: "expected_delivery_time", label: "Expected delivery date", kind: "date" },
    { key: "department_id", label: "Department", kind: "select", source: "departments" },
    { key: "user_group_id", label: "User group", kind: "select", source: "user_groups" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "requisition_date", label: "Date" }, { key: "item_name", label: "Item" }, { key: "requisition_qty", label: "Quantity" }, { key: "status", label: "Status" }]),
  requisition_form_approved: workflow("requisition-approvals", "Requisition Form Approved", [
    ...dates, { key: "requisition_id", label: "Requisition", kind: "select", source: "requisitions", required: true },
    { key: "requisition_by", label: "Requisition by", kind: "select", source: "users", filter: true },
    { key: "requisition_status", label: "Status", kind: "select", source: "statuses", required: true },
    { key: "approved_qty", label: "Approved quantity", kind: "number" }, { key: "remarks", label: "Approval remarks", kind: "textarea" },
  ], [{ key: "requisition_date", label: "Date" }, { key: "requisition_by_name", label: "Requested by" }, { key: "item_name", label: "Item" }, { key: "requisition_qty", label: "Requested" }, { key: "approved_qty", label: "Approved" }, { key: "status", label: "Status" }]),
  item_quotation: workflow("quotations", "Item Quotation", [
    vendor, item, { key: "qty", label: "Quantity", kind: "number", required: true }, { key: "rate", label: "Rate", kind: "number", required: true },
    { key: "unit", label: "Unit", kind: "select", source: "units", required: true }, { key: "tax_id", label: "Tax", kind: "select", source: "taxes" },
    { key: "transportation_charge", label: "Transportation charge", kind: "number" }, { key: "installation_charge", label: "Installation charge", kind: "number" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "quotation_date", label: "Date" }, { key: "vendor_name", label: "Vendor" }, { key: "item_name", label: "Item" }, { key: "qty", label: "Quantity" }, { key: "rate", label: "Rate" }]),
  generate_po: workflow("purchase-orders", "Generate PO", [
    vendor, item, { key: "price", label: "Price", kind: "number", required: true }, { key: "qty", label: "Quantity", kind: "number", required: true },
    { key: "dis_per", label: "Discount %", kind: "number" }, { key: "tax_per", label: "Tax %", kind: "number" },
    { key: "transportation_charge", label: "Transportation charge", kind: "number" }, { key: "installation_charge", label: "Installation charge", kind: "number" },
    { key: "delivery_time", label: "Delivery time", kind: "date" }, { key: "po_place_of_delivery", label: "Place of delivery" },
    { key: "payment_terms", label: "Payment terms", kind: "textarea" }, { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "po_number", label: "PO Number" }, { key: "po_date", label: "Date" }, { key: "vendor_name", label: "Vendor" }, { key: "grand_total", label: "Total" }, { key: "status", label: "Status" }]),
  negotiate_po: workflow("purchase-order-negotiations", "Negotiate PO", [
    { key: "po_number", label: "PO Number", kind: "select", source: "purchase_orders", required: true },
    item, { key: "price", label: "Negotiated price", kind: "number", required: true },
    { key: "qty", label: "Quantity", kind: "number", required: true },
    { key: "dis_per", label: "Discount %", kind: "number", required: true },
    { key: "tax_per", label: "Tax %", kind: "number", required: true },
    { key: "transportation_charge", label: "Transportation charge", kind: "number" },
    { key: "installation_charge", label: "Installation charge", kind: "number" },
    { key: "delivery_time", label: "Delivery time", kind: "date" },
    { key: "po_place_of_delivery", label: "Place of delivery" },
    { key: "payment_terms", label: "Payment terms", kind: "textarea" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
    { key: "po_approval_status", label: "Approval status", kind: "select", source: "statuses", required: true },
    { key: "po_approval_remark", label: "Approval remark", kind: "textarea" },
  ], [{ key: "po_number", label: "PO Number" }, { key: "vendor_name", label: "Vendor" }, { key: "item_name", label: "Item" }, { key: "price", label: "Price" }, { key: "qty", label: "Qty" }, { key: "status", label: "Status" }]),
  item_receivable: workflow("receivables", "Item Receivable", [
    { key: "po_number", label: "Approved PO", kind: "select", source: "approved_purchase_orders", required: true },
    { ...item, source: "po_items", dependsOn: "po_number" },
    { key: "actual_received_qty", label: "Received quantity", kind: "number", required: true }, { key: "challan_no", label: "Challan No." },
    { key: "challan_date", label: "Challan date", kind: "date" }, { key: "bill_no", label: "Bill No." }, { key: "bill_date", label: "Bill date", kind: "date" },
    { key: "warranty_start_date", label: "Warranty start", kind: "date" }, { key: "warranty_end_date", label: "Warranty end", kind: "date" }, { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "po_number", label: "PO Number" }, { key: "item_name", label: "Item" }, { key: "qty", label: "PO Qty" }, { key: "actual_received_qty", label: "Received" }, { key: "pending_qty", label: "Pending" }]),
  inventory_allocation: workflow("allocations", "Inventory Allocation", [
    ...dates, { key: "requisition_by", label: "Requisition by", kind: "select", source: "allocation_users", required: true },
    { ...item, source: "allocatable_items", dependsOn: "requisition_by" },
    { key: "location_of_material", label: "Material location", required: true }, { key: "person_responsible", label: "Person responsible", required: true },
  ], [{ key: "item_name", label: "Item" }, { key: "requisition_by_name", label: "Requested by" }, { key: "approved_qty", label: "Approved qty" }, { key: "location_of_material", label: "Location" }, { key: "person_responsible", label: "Responsible person" }]),
  inventory_return: workflow("returns", "Inventory Return", [
    { key: "requisition_by", label: "Issued to", kind: "select", source: "users", required: true },
    { ...item, source: "returnable_items", dependsOn: "requisition_by" },
    { key: "return_qty", label: "Return quantity", kind: "number", required: true }, { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "return_date", label: "Return date" }, { key: "user_name", label: "Returned by" }, { key: "item_name", label: "Item" }, { key: "return_qty", label: "Quantity" }, { key: "remarks", label: "Remarks" }]),
  inventory_defective: workflow("defectives", "Inventory Defective", [
    { ...item, source: "received_items" }, { key: "warranty_start_date", label: "Warranty start date", kind: "date" }, { key: "warranty_end_date", label: "Warranty end date", kind: "date" },
    { key: "defect_remarks", label: "Defect remarks", kind: "textarea", required: true }, { key: "item_given_to", label: "Item given to" },
    { key: "estimated_received_date", label: "Estimated received date", kind: "date" },
  ], [{ key: "created_on", label: "Date" }, { key: "item_name", label: "Item" }, { key: "defect_remarks", label: "Defect" }, { key: "item_given_to", label: "Given to" }, { key: "estimated_received_date", label: "Estimated return" }]),
  inventory_master_setup: master("master-setups", "Inventory Master Setup", [
    { key: "gst_registration_no", label: "GST Registration No.", required: true }, { key: "gst_registration_date", label: "GST Registration Date", kind: "date", required: true },
    { key: "cst_registration_no", label: "CST Registration No.", required: true }, { key: "cst_registration_date", label: "CST Registration Date", kind: "date", required: true },
    { key: "logo", label: "Logo", kind: "file" },
    { key: "po_no_prefix", label: "PO Number Prefix", required: true }, { key: "item_setting_for_requisition", label: "Item setting for requisition", kind: "select", source: "requisition_item_settings", required: true },
  ], [{ key: "gst_registration_no", label: "GST No." }, { key: "cst_registration_no", label: "CST No." }, { key: "po_no_prefix", label: "PO Prefix" }, { key: "item_setting_for_requisition", label: "Requisition setting" }]),
  item_category_master: master("item-categories", "Item Category Master", [
    { key: "title", label: "Category", required: true }, { key: "description", label: "Description", kind: "textarea", required: true },
    { key: "status", label: "Status", kind: "select", source: "yes_no_statuses", required: true },
  ], [{ key: "title", label: "Category" }, { key: "description", label: "Description" }, { key: "status", label: "Status" }]),
  item_sub_category_master: master("item-sub-categories", "Item Sub Category Master", [
    { key: "category_id", label: "Category", kind: "select", source: "categories", required: true }, { key: "title", label: "Sub category", required: true },
    { key: "description", label: "Description", kind: "textarea", required: true }, { key: "status", label: "Status", kind: "select", source: "yes_no_statuses", required: true },
  ], [{ key: "category_name", label: "Category" }, { key: "title", label: "Sub category" }, { key: "description", label: "Description" }, { key: "status", label: "Status" }]),
  inventory_item_master: master("items", "Inventory Item Master", [
    { key: "category_id", label: "Category", kind: "select", source: "categories", required: true }, { key: "sub_category_id", label: "Sub category", kind: "select", source: "sub_categories", required: true },
    { key: "title", label: "Item name", required: true },
    { key: "item_type_id", label: "Item type", kind: "select", source: "item_types", required: true },
    { key: "opening_stock", label: "Opening stock", kind: "number" }, { key: "minimum_stock", label: "Minimum stock", kind: "number" },
    { key: "item_attachment", label: "Item attachment", kind: "file" },
    { key: "item_status", label: "Status", kind: "select", source: "item_statuses", required: true }, { key: "description", label: "Description", kind: "textarea", required: true },
  ], [{ key: "title", label: "Item" }, { key: "category_name", label: "Category" }, { key: "sub_category_name", label: "Sub category" }, { key: "item_type_name", label: "Item type" }, { key: "opening_stock", label: "Opening stock" }, { key: "minimum_stock", label: "Minimum stock" }, { key: "item_status", label: "Status" }]),
  tax_master: master("taxes", "Tax Master", [
    { key: "title", label: "Tax title", required: true }, { key: "amount_percentage", label: "Percentage", kind: "number", required: true },
    { key: "description_1", label: "Description", kind: "textarea" }, { key: "sort_order", label: "Sort order", kind: "number" },
    { key: "status", label: "Status", kind: "select", source: "yes_no_statuses", required: true },
  ], [{ key: "title", label: "Tax" }, { key: "amount_percentage", label: "Percentage" }, { key: "description_1", label: "Description" }, { key: "status", label: "Status" }]),
  vendor_master: master("vendors", "Vendor Master", [
    { key: "vendor_name", label: "Vendor name", required: true }, { key: "contact_number", label: "Contact number" }, { key: "short_name", label: "Short name" },
    { key: "sort_order", label: "Sort order", kind: "number" }, { key: "email", label: "Email" }, { key: "address", label: "Address", kind: "textarea" },
    { key: "file_number", label: "File number" }, { key: "file_location", label: "File location" }, { key: "company_name", label: "Company name" },
    { key: "business_type", label: "Business type" }, { key: "office_address", label: "Office address", kind: "textarea" },
    { key: "office_contact_person", label: "Office contact person" }, { key: "office_number", label: "Office number" },
    { key: "office_email", label: "Office email" }, { key: "tin_no", label: "TIN No." }, { key: "tin_date", label: "TIN Date", kind: "date" },
    { key: "registration_no", label: "Registration No." }, { key: "registration_date", label: "Registration date", kind: "date" },
    { key: "serivce_tax_no", label: "Service Tax No." }, { key: "serivce_tax_date", label: "Service tax date", kind: "date" },
    { key: "pan_no", label: "PAN No." }, { key: "bank_account_no", label: "Bank Account No." }, { key: "bank_name", label: "Bank name" },
    { key: "bank_branch", label: "Bank branch" }, { key: "bank_ifsc_code", label: "IFSC Code" },
  ], [{ key: "vendor_name", label: "Vendor" }, { key: "company_name", label: "Company" }, { key: "contact_number", label: "Contact" }, { key: "email", label: "Email" }, { key: "pan_no", label: "PAN" }]),
  item_direct_purchase: workflow("direct-purchases", "Item Direct Purchase", [
    vendor, item, { key: "qty", label: "Quantity", kind: "number", required: true },
    { key: "rate", label: "Rate", kind: "number", required: true }, { key: "challan_no", label: "Challan No." },
    { key: "challan_date", label: "Challan date", kind: "date" }, { key: "bill_no", label: "Bill No." },
    { key: "bill_date", label: "Bill date", kind: "date" }, { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "purchase_date", label: "Date" }, { key: "vendor_name", label: "Vendor" }, { key: "item_name", label: "Item" }, { key: "qty", label: "Quantity" }, { key: "total", label: "Total" }]),
  staff_wise_report: report("reports/staff-wise", "Staff Wise Report", [...dates, { key: "requisition_by", label: "Staff", kind: "select", source: "users", filter: true }], [{ key: "requisition_by_name", label: "Staff" }, { key: "requisition_no", label: "Requisition No." }, { key: "item_name", label: "Item" }, { key: "item_qty", label: "Requested" }, { key: "approved_qty", label: "Approved" }, { key: "requisition_date", label: "Approved date" }, { key: "category", label: "Category" }]),
  item_delivery_status_report: report("reports/delivery-status", "Item Delivery Status Report", [...dates, { key: "requisition_by", label: "Requisition by", kind: "select", source: "users", filter: true }], [{ key: "requisition_no", label: "Requisition No." }, { key: "requisition_date", label: "Requisition date" }, { key: "requisition_by_name", label: "Requested by" }, { key: "item_name", label: "Item" }, { key: "item_qty", label: "Quantity" }, { key: "item_unit", label: "Unit" }, { key: "expected_delivery_time", label: "Expected delivery" }, { key: "requisition_status", label: "Status" }, { key: "requisition_approved_by", label: "Approved by" }, { key: "delivery_status", label: "Delivery status" }, { key: "delivery_date", label: "Delivery date" }]),
  requisition_report: report("reports/requisitions", "Requisition Report", [...dates, { key: "requisition_status", label: "Status", kind: "select", source: "statuses", filter: true }], [{ key: "requisition_date", label: "Date" }, { key: "requisition_no", label: "Requisition No." }, { key: "requisition_by_name", label: "Requested by" }, { key: "item_name", label: "Item" }, { key: "item_qty", label: "Quantity" }, { key: "expected_delivery_time", label: "Expected delivery" }, { key: "status", label: "Status" }, { key: "approved_qty", label: "Approved qty" }, { key: "requisition_approved_by", label: "Approved by" }]),
  item_wise_report: report("reports/item-wise", "Item Wise Report", [...dates, item], [{ key: "requisition_no", label: "Requisition No." }, { key: "requisition_by_name", label: "Requested by" }, { key: "item_name", label: "Item" }, { key: "item_qty", label: "Requested" }, { key: "approved_qty", label: "Approved" }, { key: "requisition_date", label: "Approved date" }]),
  overall_item_report: report("reports/overall-items", "Overall Item Report", [{ ...item, filter: true }], [{ key: "item_name", label: "Item" }, { key: "description", label: "Description" }, { key: "opening_inventory_qty", label: "Opening" }, { key: "direct_purchase_stock", label: "Direct purchase" }, { key: "purchase_qty", label: "Purchased" }, { key: "po_qty", label: "PO Qty" }, { key: "issue_qty", label: "Issued" }, { key: "lost_sold_qty", label: "Lost/Sold" }, { key: "returned_qty", label: "Returned" }, { key: "closing_inventory_value", label: "Closing" }]),
};
