import type { InventoryConfig, InventoryField } from "./_components/InventoryPage";

const item = { key: "item_id", label: "Item", kind: "select", source: "items", required: true } satisfies InventoryField;
const vendor = { key: "vendor_id", label: "Vendor", kind: "select", source: "vendors", required: true } satisfies InventoryField;
const dates: InventoryField[] = [{ key: "from_date", label: "From Date", kind: "date", filter: true }, { key: "to_date", label: "To Date", kind: "date", filter: true }];
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
    { key: "requisition_by", label: "Requisition By", kind: "select", source: "users", required: true },
    { key: "requisition_date", label: "Requisition Date", kind: "date", required: true }, item,
    { key: "requisition_qty", label: "Required Quantity", kind: "number", required: true },
    { key: "item_unit", label: "Item Unit", kind: "select", source: "units", required: true },
    { key: "expected_delivery_time", label: "Expected Delivery Date", kind: "date" },
    { key: "department_id", label: "Department", kind: "select", source: "departments" },
    { key: "user_group_id", label: "User Group", kind: "select", source: "user_groups" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "requisition_date", label: "Date" }, { key: "item_name", label: "Item" }, { key: "requisition_qty", label: "Quantity" }, { key: "status", label: "Status" }]),
  requisition_form_approved: workflow("requisition-approvals", "Requisition Form Approved", [
    ...dates, { key: "requisition_id", label: "Requisition", kind: "select", source: "requisitions", required: true },
    { key: "requisition_by", label: "Requisition By", kind: "select", source: "users", filter: true },
    { key: "requisition_status", label: "Status", kind: "select", source: "statuses", required: true },
    { key: "approved_qty", label: "Approved Quantity", kind: "number" }, { key: "remarks", label: "Approval Remarks", kind: "textarea" },
  ], [{ key: "requisition_date", label: "Date" }, { key: "requisition_by_name", label: "Requested By" }, { key: "item_name", label: "Item" }, { key: "requisition_qty", label: "Requested" }, { key: "approved_qty", label: "Approved" }, { key: "status", label: "Status" }]),
  item_quotation: workflow("quotations", "Item Quotation", [
    vendor, item, { key: "qty", label: "Quantity", kind: "number", required: true }, { key: "rate", label: "Rate", kind: "number", required: true },
    { key: "unit", label: "Unit", kind: "select", source: "units", required: true }, { key: "tax_id", label: "Tax", kind: "select", source: "taxes" },
    { key: "transportation_charge", label: "Transportation Charge", kind: "number" }, { key: "installation_charge", label: "Installation Charge", kind: "number" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "quotation_date", label: "Date" }, { key: "vendor_name", label: "Vendor" }, { key: "item_name", label: "Item" }, { key: "qty", label: "Quantity" }, { key: "rate", label: "Rate" }]),
  generate_po: workflow("purchase-orders", "Generate PO", [
    vendor, item, { key: "price", label: "Price", kind: "number", required: true }, { key: "qty", label: "Quantity", kind: "number", required: true },
    { key: "dis_per", label: "Discount %", kind: "number" }, { key: "tax_per", label: "Tax %", kind: "number" },
    { key: "transportation_charge", label: "Transportation Charge", kind: "number" }, { key: "installation_charge", label: "Installation Charge", kind: "number" },
    { key: "delivery_time", label: "Delivery Time", kind: "date" }, { key: "po_place_of_delivery", label: "Place of Delivery" },
    { key: "payment_terms", label: "Payment Terms", kind: "textarea" }, { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "po_number", label: "PO Number" }, { key: "po_date", label: "Date" }, { key: "vendor_name", label: "Vendor" }, { key: "grand_total", label: "Total" }, { key: "status", label: "Status" }]),
  negotiate_po: workflow("purchase-order-negotiations", "Negotiate PO", [
    { key: "po_number", label: "PO Number", kind: "select", source: "purchase_orders", required: true },
    item, { key: "price", label: "Negotiated Price", kind: "number", required: true },
    { key: "qty", label: "Quantity", kind: "number", required: true },
    { key: "dis_per", label: "Discount %", kind: "number", required: true },
    { key: "tax_per", label: "Tax %", kind: "number", required: true },
    { key: "transportation_charge", label: "Transportation Charge", kind: "number" },
    { key: "installation_charge", label: "Installation Charge", kind: "number" },
    { key: "delivery_time", label: "Delivery Time", kind: "date" },
    { key: "po_place_of_delivery", label: "Place of Delivery" },
    { key: "payment_terms", label: "Payment Terms", kind: "textarea" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
    { key: "po_approval_status", label: "Approval Status", kind: "select", source: "statuses", required: true },
    { key: "po_approval_remark", label: "Approval Remark", kind: "textarea" },
  ], [{ key: "po_number", label: "PO Number" }, { key: "vendor_name", label: "Vendor" }, { key: "item_name", label: "Item" }, { key: "price", label: "Price" }, { key: "qty", label: "Qty" }, { key: "status", label: "Status" }]),
  item_receivable: workflow("receivables", "Item Receivable", [
    { key: "po_number", label: "Approved PO", kind: "select", source: "approved_purchase_orders", required: true },
    { ...item, source: "po_items", dependsOn: "po_number" },
    { key: "actual_received_qty", label: "Received Quantity", kind: "number", required: true }, { key: "challan_no", label: "Challan No." },
    { key: "challan_date", label: "Challan Date", kind: "date" }, { key: "bill_no", label: "Bill No." }, { key: "bill_date", label: "Bill Date", kind: "date" },
    { key: "warranty_start_date", label: "Warranty Start", kind: "date" }, { key: "warranty_end_date", label: "Warranty End", kind: "date" }, { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "po_number", label: "PO Number" }, { key: "item_name", label: "Item" }, { key: "qty", label: "PO Qty" }, { key: "actual_received_qty", label: "Received" }, { key: "pending_qty", label: "Pending" }]),
  inventory_allocation: workflow("allocations", "Inventory Allocation", [
    ...dates, { key: "requisition_by", label: "Requisition By", kind: "select", source: "allocation_users", required: true },
    { ...item, source: "allocatable_items", dependsOn: "requisition_by" },
    { key: "location_of_material", label: "Material Location", required: true }, { key: "person_responsible", label: "Person Responsible", required: true },
  ], [{ key: "item_name", label: "Item" }, { key: "requisition_by_name", label: "Requested By" }, { key: "approved_qty", label: "Approved Qty" }, { key: "location_of_material", label: "Location" }, { key: "person_responsible", label: "Responsible Person" }]),
  inventory_return: workflow("returns", "Inventory Return", [
    { key: "requisition_by", label: "Issued To", kind: "select", source: "users", required: true },
    { ...item, source: "returnable_items", dependsOn: "requisition_by" },
    { key: "return_qty", label: "Return Quantity", kind: "number", required: true }, { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "return_date", label: "Return Date" }, { key: "user_name", label: "Returned By" }, { key: "item_name", label: "Item" }, { key: "return_qty", label: "Quantity" }, { key: "remarks", label: "Remarks" }]),
  inventory_defective: workflow("defectives", "Inventory Defective", [
    { ...item, source: "received_items" }, { key: "warranty_start_date", label: "Warranty Start Date", kind: "date" }, { key: "warranty_end_date", label: "Warranty End Date", kind: "date" },
    { key: "defect_remarks", label: "Defect Remarks", kind: "textarea", required: true }, { key: "item_given_to", label: "Item Given To" },
    { key: "estimated_received_date", label: "Estimated Received Date", kind: "date" },
  ], [{ key: "created_on", label: "Date" }, { key: "item_name", label: "Item" }, { key: "defect_remarks", label: "Defect" }, { key: "item_given_to", label: "Given To" }, { key: "estimated_received_date", label: "Estimated Return" }]),
  inventory_master_setup: master("master-setups", "Inventory Master Setup", [
    { key: "gst_registration_no", label: "GST Registration No.", required: true }, { key: "gst_registration_date", label: "GST Registration Date", kind: "date", required: true },
    { key: "cst_registration_no", label: "CST Registration No.", required: true }, { key: "cst_registration_date", label: "CST Registration Date", kind: "date", required: true },
    { key: "logo", label: "Logo", kind: "file" },
    { key: "po_no_prefix", label: "PO Number Prefix", required: true }, { key: "item_setting_for_requisition", label: "Item Setting for Requisition", kind: "select", source: "requisition_item_settings", required: true },
  ], [{ key: "gst_registration_no", label: "GST No." }, { key: "cst_registration_no", label: "CST No." }, { key: "po_no_prefix", label: "PO Prefix" }, { key: "item_setting_for_requisition", label: "Requisition Setting" }]),
  item_category_master: master("item-categories", "Item Category Master", [
    { key: "title", label: "Category", required: true }, { key: "description", label: "Description", kind: "textarea", required: true },
    { key: "status", label: "Status", kind: "select", source: "yes_no_statuses", required: true },
  ], [{ key: "title", label: "Category" }, { key: "description", label: "Description" }, { key: "status", label: "Status" }]),
  item_sub_category_master: master("item-sub-categories", "Item Sub Category Master", [
    { key: "category_id", label: "Category", kind: "select", source: "categories", required: true }, { key: "title", label: "Sub Category", required: true },
    { key: "description", label: "Description", kind: "textarea", required: true }, { key: "status", label: "Status", kind: "select", source: "yes_no_statuses", required: true },
  ], [{ key: "category_name", label: "Category" }, { key: "title", label: "Sub Category" }, { key: "description", label: "Description" }, { key: "status", label: "Status" }]),
  inventory_item_master: master("items", "Inventory Item Master", [
    { key: "category_id", label: "Category", kind: "select", source: "categories", required: true }, { key: "sub_category_id", label: "Sub Category", kind: "select", source: "sub_categories", required: true },
    { key: "title", label: "Item Name", required: true },
    { key: "item_type_id", label: "Item Type", kind: "select", source: "item_types", required: true },
    { key: "opening_stock", label: "Opening Stock", kind: "number" }, { key: "minimum_stock", label: "Minimum Stock", kind: "number" },
    { key: "item_attachment", label: "Item Attachment", kind: "file" },
    { key: "item_status", label: "Status", kind: "select", source: "item_statuses", required: true }, { key: "description", label: "Description", kind: "textarea", required: true },
  ], [{ key: "title", label: "Item" }, { key: "category_name", label: "Category" }, { key: "sub_category_name", label: "Sub Category" }, { key: "item_type_name", label: "Item Type" }, { key: "opening_stock", label: "Opening Stock" }, { key: "minimum_stock", label: "Minimum Stock" }, { key: "item_status", label: "Status" }]),
  tax_master: master("taxes", "Tax Master", [
    { key: "title", label: "Tax Title", required: true }, { key: "amount_percentage", label: "Percentage", kind: "number", required: true },
    { key: "description_1", label: "Description", kind: "textarea" }, { key: "sort_order", label: "Sort Order", kind: "number" },
    { key: "status", label: "Status", kind: "select", source: "yes_no_statuses", required: true },
  ], [{ key: "title", label: "Tax" }, { key: "amount_percentage", label: "Percentage" }, { key: "description_1", label: "Description" }, { key: "status", label: "Status" }]),
  vendor_master: master("vendors", "Vendor Master", [
    { key: "vendor_name", label: "Vendor Name", required: true }, { key: "contact_number", label: "Contact Number" }, { key: "short_name", label: "Short Name" },
    { key: "sort_order", label: "Sort Order", kind: "number" }, { key: "email", label: "Email" }, { key: "address", label: "Address", kind: "textarea" },
    { key: "file_number", label: "File Number" }, { key: "file_location", label: "File Location" }, { key: "company_name", label: "Company Name" },
    { key: "business_type", label: "Business Type" }, { key: "office_address", label: "Office Address", kind: "textarea" },
    { key: "office_contact_person", label: "Office Contact Person" }, { key: "office_number", label: "Office Number" },
    { key: "office_email", label: "Office Email" }, { key: "tin_no", label: "TIN No." }, { key: "tin_date", label: "TIN Date", kind: "date" },
    { key: "registration_no", label: "Registration No." }, { key: "registration_date", label: "Registration Date", kind: "date" },
    { key: "serivce_tax_no", label: "Service Tax No." }, { key: "serivce_tax_date", label: "Service Tax Date", kind: "date" },
    { key: "pan_no", label: "PAN No." }, { key: "bank_account_no", label: "Bank Account No." }, { key: "bank_name", label: "Bank Name" },
    { key: "bank_branch", label: "Bank Branch" }, { key: "bank_ifsc_code", label: "IFSC Code" },
  ], [{ key: "vendor_name", label: "Vendor" }, { key: "company_name", label: "Company" }, { key: "contact_number", label: "Contact" }, { key: "email", label: "Email" }, { key: "pan_no", label: "PAN" }]),
  item_direct_purchase: workflow("direct-purchases", "Item Direct Purchase", [
    vendor, item, { key: "qty", label: "Quantity", kind: "number", required: true },
    { key: "rate", label: "Rate", kind: "number", required: true }, { key: "challan_no", label: "Challan No." },
    { key: "challan_date", label: "Challan Date", kind: "date" }, { key: "bill_no", label: "Bill No." },
    { key: "bill_date", label: "Bill Date", kind: "date" }, { key: "remarks", label: "Remarks", kind: "textarea" },
  ], [{ key: "purchase_date", label: "Date" }, { key: "vendor_name", label: "Vendor" }, { key: "item_name", label: "Item" }, { key: "qty", label: "Quantity" }, { key: "total", label: "Total" }]),
  staff_wise_report: report("reports/staff-wise", "Staff Wise Report", [...dates, { key: "requisition_by", label: "Staff", kind: "select", source: "users", filter: true }], [{ key: "requisition_by_name", label: "Staff" }, { key: "requisition_no", label: "Requisition No." }, { key: "item_name", label: "Item" }, { key: "item_qty", label: "Requested" }, { key: "approved_qty", label: "Approved" }, { key: "requisition_date", label: "Approved Date" }, { key: "category", label: "Category" }]),
  item_delivery_status_report: report("reports/delivery-status", "Item Delivery Status Report", [...dates, { key: "requisition_by", label: "Requisition By", kind: "select", source: "users", filter: true }], [{ key: "requisition_no", label: "Requisition No." }, { key: "requisition_date", label: "Requisition Date" }, { key: "requisition_by_name", label: "Requested By" }, { key: "item_name", label: "Item" }, { key: "item_qty", label: "Quantity" }, { key: "item_unit", label: "Unit" }, { key: "expected_delivery_time", label: "Expected Delivery" }, { key: "requisition_status", label: "Status" }, { key: "requisition_approved_by", label: "Approved By" }, { key: "delivery_status", label: "Delivery Status" }, { key: "delivery_date", label: "Delivery Date" }]),
  requisition_report: report("reports/requisitions", "Requisition Report", [...dates, { key: "requisition_status", label: "Status", kind: "select", source: "statuses", filter: true }], [{ key: "requisition_date", label: "Date" }, { key: "requisition_no", label: "Requisition No." }, { key: "requisition_by_name", label: "Requested By" }, { key: "item_name", label: "Item" }, { key: "item_qty", label: "Quantity" }, { key: "expected_delivery_time", label: "Expected Delivery" }, { key: "status", label: "Status" }, { key: "approved_qty", label: "Approved Qty" }, { key: "requisition_approved_by", label: "Approved By" }]),
  item_wise_report: report("reports/item-wise", "Item Wise Report", [...dates, item], [{ key: "requisition_no", label: "Requisition No." }, { key: "requisition_by_name", label: "Requested By" }, { key: "item_name", label: "Item" }, { key: "item_qty", label: "Requested" }, { key: "approved_qty", label: "Approved" }, { key: "requisition_date", label: "Approved Date" }]),
  overall_item_report: report("reports/overall-items", "Overall Item Report", [{ ...item, filter: true }], [{ key: "item_name", label: "Item" }, { key: "description", label: "Description" }, { key: "opening_inventory_qty", label: "Opening" }, { key: "direct_purchase_stock", label: "Direct Purchase" }, { key: "purchase_qty", label: "Purchased" }, { key: "po_qty", label: "PO Qty" }, { key: "issue_qty", label: "Issued" }, { key: "lost_sold_qty", label: "Lost/Sold" }, { key: "returned_qty", label: "Returned" }, { key: "closing_inventory_value", label: "Closing" }]),
};
