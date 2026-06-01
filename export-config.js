// export-config.js -- Faith Lock & Safe QuickBooks Desktop Export Configuration
//
// All export column names and their value functions live here.
// When Brenda confirms her QuickBooks field list, edit ONLY this array.
// The export logic in app.html reads exclusively from EXPORT_COLUMNS.
//
// Each entry: { label: 'Column Header', value: rowObj => displayValue }
// rowObj shape is documented below the array.

const EXPORT_COLUMNS = [
  { label: 'Date',           value: r => r.job_date   ? formatDate(r.job_date)   : '' },
  { label: 'Job Ref',        value: r => r.job_ref    || '' },
  { label: 'Customer',       value: r => r.account_name    || '' },
  { label: 'Sub-Account',    value: r => r.sub_account_name || '' },
  { label: 'Job Type',       value: r => r.job_type_name    || '' },
  { label: 'WO Number',      value: r => r.work_order_number    || '' },
  { label: 'PO Number',      value: r => r.purchase_order_number || '' },
  { label: 'Status',         value: r => r.status || '' },
  { label: 'Item Type',      value: r => r.item_type || '' },
  { label: 'Description',    value: r => r.description || '' },
  { label: 'Qty',            value: r => r.quantity ?? '' },
  { label: 'Unit Cost',      value: r => r.unit_cost != null ? Number(r.unit_cost).toFixed(2) : '' },
  { label: 'Extended',       value: r => r.extended  != null ? Number(r.extended).toFixed(2)  : '' },
  { label: 'Payment Type',   value: r => r.payment_type   || '' },
  { label: 'Payment Detail', value: r => r.payment_detail || '' },
  { label: 'Tech Notes',     value: r => r.tech_notes     || '' },
];

// rowObj fields available to value functions:
//   job_date, job_ref, job_number, account_name, sub_account_name, job_type_name,
//   work_order_number, purchase_order_number, status,
//   item_type, description, quantity, unit_cost, extended,
//   payment_type, payment_detail, tech_notes

// Service call rate placeholder.
// Update when Rich and Brenda confirm the standard fee.
const SERVICE_CALL_RATE = 0;
