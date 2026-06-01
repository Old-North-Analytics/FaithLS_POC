// app-export.js -- QuickBooks Desktop CSV Export
// Reads field order exclusively from EXPORT_COLUMNS in export-config.js

function initExport() {
  const t = today();
  const from = document.getElementById('ex-from');
  const to   = document.getElementById('ex-to');
  if (!from.value) from.value = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]; // Jan 1
  if (!to.value)   to.value   = t;
}

async function runExport() {
  const from   = document.getElementById('ex-from').value;
  const to     = document.getElementById('ex-to').value;
  const status = document.getElementById('ex-status').value;
  const msgEl  = document.getElementById('export-msg');
  msgEl.innerHTML = '<p class="meta">Building export...</p>';

  let query = db.from('jobs')
    .select(`id, job_date, status, job_number, work_order_number, purchase_order_number,
             accounts!jobs_account_id_fkey(account_name, account_number),
             sub:accounts!jobs_sub_account_id_fkey(account_name, sub_account_number),
             job_types(job_type_name),
             job_completions(payment_type,payment_detail,tech_notes),
             job_line_items(id,item_type,item_id,quantity,unit_cost,override_cost,override_reason,notes)`)
    .order('job_date');

  if (from)   query = query.gte('job_date', from);
  if (to)     query = query.lte('job_date', to);
  if (status) query = query.eq('status', status);

  const { data: jobs, error } = await query;
  if (error) { msgEl.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  if (!jobs?.length) {
    msgEl.innerHTML = '<div class="msg error">No jobs found for the selected filters.</div>';
    return;
  }

  // Resolve part and labor names in batch
  const allItemIds = jobs.flatMap(j => (j.job_line_items||[]).map(i => i.item_id));
  const [partsRes, laborRes] = await Promise.all([
    allParts.length    ? Promise.resolve({ data: allParts })      : db.from('parts').select('id,part_name').in('id', allItemIds),
    allLaborTypes.length ? Promise.resolve({ data: allLaborTypes }) : db.from('labor_types').select('id,labor_type_name').in('id', allItemIds)
  ]);
  const partsMap = Object.fromEntries((partsRes.data || []).map(p => [p.id, p.part_name]));
  const laborMap = Object.fromEntries((laborRes.data || []).map(l => [l.id, l.labor_type_name]));

  // Expand: one row per line item (or one row per job if no line items)
  const rows = [];
  for (const j of jobs) {
    const comp    = j.job_completions?.[0] || {};
    const items   = j.job_line_items || [];
    const baseRow = {
      job_date:              j.job_date,
      account_name:          j.accounts?.account_name     || '',
      sub_account_name:      j.sub?.account_name          || '',
      job_ref:               jobRef(j.accounts?.account_number, j.sub?.sub_account_number, j.job_number),
      job_number:            j.job_number                 || '',
      job_type_name:         j.job_types?.job_type_name   || '',
      work_order_number:     j.work_order_number          || '',
      purchase_order_number: j.purchase_order_number      || '',
      status:                j.status,
      payment_type:          comp.payment_type            || '',
      payment_detail:        comp.payment_detail          || '',
      tech_notes:            comp.tech_notes              || '',
    };

    if (!items.length) {
      rows.push({ ...baseRow, item_type: '', description: '', quantity: '', unit_cost: '', extended: '' });
      continue;
    }

    for (const i of items) {
      const unitCost = i.override_cost != null ? Number(i.override_cost) : Number(i.unit_cost);
      const qty      = Number(i.quantity);
      let description = '';
      if      (i.item_type === 'Part')         description = partsMap[i.item_id] || '';
      else if (i.item_type === 'Labor')        description = laborMap[i.item_id] || '';
      else if (i.item_type === 'Service Call') description = 'Service Call Fee';
      else                                     description = i.override_reason || i.notes || 'Other';

      rows.push({
        ...baseRow,
        item_type:   i.item_type,
        description,
        quantity:    qty,
        unit_cost:   unitCost,
        extended:    unitCost * qty,
      });
    }
  }

  // Build CSV using EXPORT_COLUMNS config
  const header  = EXPORT_COLUMNS.map(col => col.label);
  const csvRows = rows.map(r => EXPORT_COLUMNS.map(col => col.value(r)));
  downloadCSV([header, ...csvRows], `faithlock_export_${from}_${to}`);

  msgEl.innerHTML = `<div class="msg success">Exported ${rows.length} rows across ${jobs.length} jobs.</div>`;
}
