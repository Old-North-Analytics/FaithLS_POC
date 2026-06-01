// shared.js -- Faith Lock & Safe Job Management System
//
// Shared utilities for app.html, tech.html, and index.html.
// Load order in every file:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="shared.js"></script>
//   <script src="export-config.js"></script>  (app.html only)
//   <script> /* page-specific code */ </script>

// ---- SUPABASE CONNECTION ----
const SUPABASE_URL      = 'https://jmsrlhqbzstuczxilxua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptc3JsaHFienN0dWN6eGlseHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzA5NDcsImV4cCI6MjA5MjQwNjk0N30.jpHtuhezvfRXJ2uVhwglqS_rImZl8JqqBX85WUv2Z5g';
// Use sessionStorage so auth tokens persist across page redirects in the same tab,
// including when serving via file:// protocol or in private browsing mode.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:          window.sessionStorage,
    persistSession:   true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});


// ---- BRAND COLORS ----
const BRAND = {
  navy:   '#1a2744',
  purple: '#6b6fa8',
  green:  '#2a7a4a',
  red:    '#a02020',
  amber:  '#b86c00',
  bg:     '#f2f4f8',
};


// ---- AUTH ----
async function logout() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}


// ---- DATE HELPERS ----

// formatDate: YYYY-MM-DD -> MM/DD/YYYY. Splits on '-' to avoid UTC shift bugs.
function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${m}/${d}/${y}`;
}

// _localDateStr: formats a Date object as YYYY-MM-DD using LOCAL time.
// Critical: never use .toISOString() for date-only values -- it returns
// UTC which is 5-6 hours behind US Central and will give yesterday's date
// for any call made after ~6-7 pm local time.
function _localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function today() {
  return _localDateStr(new Date());
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return _localDateStr(d);
}

// weekStart: returns most recent Monday as YYYY-MM-DD (local).
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return _localDateStr(d);
}

// weekEnd: returns Sunday of the current week as YYYY-MM-DD (local).
function weekEnd() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 6);
  return _localDateStr(d);
}

// monthStart/monthEnd for current calendar month.
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthEnd() {
  const d = new Date();
  return _localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// nowLocal: current local datetime as YYYY-MM-DDTHH:MM for datetime-local inputs.
function nowLocal() {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// fmtDateTime: ISO timestamp to readable local string (MM/DD/YYYY h:mm AM/PM).
function fmtDateTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

// fmtTime: ISO timestamp to time only (h:mm AM/PM).
function fmtTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}


// ---- SELECT HELPERS ----

function populateSelect(id, items, valueKey, labelKey, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(i => `<option value="${i[valueKey]}">${i[labelKey]}</option>`).join('');
}

function populateMultiSelect(id, items, valueKey, labelKey) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(i => `<option value="${i[valueKey]}">${i[labelKey]}</option>`).join('');
}


// ---- REVENUE CALCULATION ----
function calcRevenue(lineItems) {
  return (lineItems || []).reduce(
    (sum, i) => sum + ((i.override_cost ?? i.unit_cost) * i.quantity), 0
  );
}


// ---- IMAGE RESIZE ----
function resizeImage(file, maxW) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}


// ---- CSV EXPORT ----
function downloadCSV(rows, filename) {
  const csv  = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}


// ---- PHOTO GRID ----

async function fetchPhotoUrls(photos) {
  return Promise.all(photos.map(async p => {
    const { data: signed, error } = await db.storage
      .from('job-photos')
      .createSignedUrl(p.storage_path, 7200);
    if (signed?.signedUrl) return { ...p, url: signed.signedUrl };
    if (error) console.warn('fetchPhotoUrls:', p.storage_path, error.message);
    return { ...p, url: null };
  }));
}

function renderPhotoGrid(gridEl, withUrls, showDate = true) {
  if (!withUrls.length) {
    gridEl.innerHTML = '<span style="font-size:0.82rem;color:#aaa">No photos yet.</span>';
    return;
  }
  gridEl.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:0.6rem">' +
    withUrls.map(p => {
      const safeName = (p.file_name || 'photo').replace(/"/g, '&quot;');
      const label    = p.file_name || 'photo';
      const dateHtml = (showDate && p.uploaded_at)
        ? `<div style="font-size:0.72rem;color:#888">${new Date(p.uploaded_at).toLocaleDateString('en-US')}</div>`
        : '';
      if (p.url) {
        return `<div style="text-align:center">
          <a href="${p.url}" target="_blank">
            <img src="${p.url}"
              style="width:110px;height:88px;object-fit:cover;border:1px solid #ccc;border-radius:3px;display:block;cursor:pointer"
              data-name="${safeName}"
              onerror="this.parentElement.innerHTML='<div style=&quot;width:110px;height:88px;background:#eee;border:1px solid #ccc;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;padding:4px&quot;>'+this.dataset.name+'</div>'">
          </a>
          <div style="font-size:0.72rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px">
            <a href="${p.url}" target="_blank" style="color:#1a2744">${label}</a>
          </div>
          ${dateHtml}
        </div>`;
      }
      return `<div style="text-align:center">
        <div style="width:110px;height:88px;background:#eee;border:1px solid #ccc;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;padding:4px">${label}</div>
        <div style="font-size:0.72rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px">${label}</div>
        ${dateHtml}
      </div>`;
    }).join('') + '</div>';
}


// ---- MAPS LINK ----
function mapsLink(address) {
  if (!address) return '';
  return `<a href="https://maps.google.com/?q=${encodeURIComponent(address)}" target="_blank"
    style="color:#1a2744;text-decoration:underline">${address} &#8599;</a>`;
}


// ---- HTML ESCAPE ----
function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ---- HUMAN-READABLE JOB REFERENCE ----
// jobRef(job, visitNumber): builds the display ID in ACCOUNT-SUB-JOB-VISIT format.
// job object must include account_number (from accounts join), job_number,
// and optionally sub_account_number and visit_number.
// Any missing segment is omitted from the string.
function jobRef(acctNum, subNum, jobNum, visitNum) {
  const parts = [];
  if (acctNum) parts.push(acctNum);
  if (subNum)  parts.push(subNum);
  if (jobNum)  parts.push(jobNum);
  if (visitNum != null && visitNum !== undefined) parts.push(String(visitNum));
  return parts.join('-');
}


// ---- PRINT JOB ----
async function printJob(jobId) {
  const { data: job, error } = await db
    .from('jobs')
    .select(`
      id, job_date, status, scope, site_notes, is_fixed_price,
      account_id, job_address, assigned_tech_ids,
      work_order_number, purchase_order_number,
      accounts!jobs_account_id_fkey(account_name, address),
      sub_accounts:accounts!jobs_sub_account_id_fkey(account_name),
      job_types(job_type_name),
      lead_tech:techs!jobs_lead_tech_id_fkey(tech_name),
      job_line_items(id, item_type, item_id, quantity, notes),
      job_visits(visit_number, visit_date, clocked_in_at, clocked_out_at, tech_notes)
    `)
    .eq('id', jobId)
    .single();

  if (error || !job) { alert('Could not load job data: ' + (error?.message || 'unknown')); return; }

  let techNames = '';
  if (job.assigned_tech_ids?.length) {
    const { data: techRows } = await db.from('techs')
      .select('id, tech_name').in('id', job.assigned_tech_ids);
    techNames = (techRows || []).map(t => t.tech_name).join(', ');
  }
  if (!techNames) techNames = job.lead_tech?.tech_name || '';

  const lineItems = job.job_line_items || [];
  const partIds   = lineItems.filter(i => i.item_type === 'Part').map(i => i.item_id);
  const laborIds  = lineItems.filter(i => i.item_type === 'Labor').map(i => i.item_id);
  const [partsRes, laborRes] = await Promise.all([
    partIds.length  ? db.from('parts').select('id, part_name').in('id', partIds)              : { data: [] },
    laborIds.length ? db.from('labor_types').select('id, labor_type_name').in('id', laborIds) : { data: [] }
  ]);
  const partsMap = Object.fromEntries((partsRes.data || []).map(p => [p.id, p.part_name]));
  const laborMap = Object.fromEntries((laborRes.data || []).map(l => [l.id, l.labor_type_name]));

  const { data: contacts } = await db
    .from('account_contacts')
    .select('contact_name, title, cell_phone, work_phone, notes, is_primary, is_secondary')
    .eq('account_id', job.account_id)
    .eq('active', true)
    .order('is_primary', { ascending: false });

  const primary   = (contacts || []).find(c => c.is_primary);
  const secondary = (contacts || []).find(c => c.is_secondary && !c.is_primary);
  const useActuals = ['Approved', 'Pending Review'].includes(job.status);

  function itemRows(items) {
    if (!items?.length) return '<tr><td colspan="4" style="color:#aaa;font-style:italic;padding:4px 7px">None</td></tr>';
    return items.map(i => {
      const desc = i.item_type === 'Part'         ? (partsMap[i.item_id] || '')
                 : i.item_type === 'Labor'        ? (laborMap[i.item_id] || '')
                 : i.item_type === 'Service Call' ? 'Service Call Fee'
                 : (i.notes || 'Other');
      const badges = { Part: '#dbeafe|#1e40af|Part', Labor: '#dcfce7|#166534|Labor',
                       'Service Call': '#fef3c7|#92400e|Svc Call', Other: '#f3e8ff|#6b21a8|Other' };
      const [bg, fg, lbl] = (badges[i.item_type] || '|#333|').split('|');
      const qty = i.item_type === 'Labor' ? `${i.quantity} hr${i.quantity !== 1 ? 's' : ''}` : i.quantity;
      return `<tr>
        <td><span style="font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:1px 4px;border-radius:2px;background:${bg};color:${fg}">${lbl}</span></td>
        <td>${desc}</td><td style="text-align:center">${qty}</td><td>${i.notes || ''}</td>
      </tr>`;
    }).join('');
  }

  function contactBlock(c, type) {
    if (!c) return '';
    const [bg, fg] = type === 'Primary' ? ['#dbeafe', '#1e40af'] : ['#f3e8ff', '#6b21a8'];
    const phone = c.cell_phone || c.work_phone || '';
    return `<div style="display:grid;grid-template-columns:80px 1fr 1fr 1fr;gap:5px 12px;padding:5px 0;border-bottom:1px solid #f0ebe4;align-items:start">
      <div><span style="font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:2px 5px;border-radius:2px;background:${bg};color:${fg};display:inline-block;margin-top:1px">${type}</span></div>
      <div><div style="font-size:0.6rem;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:1px">Name</div><div style="font-size:0.76rem">${c.contact_name || ''}</div></div>
      <div><div style="font-size:0.6rem;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:1px">Title</div><div style="font-size:0.76rem">${c.title || ''}</div></div>
      <div><div style="font-size:0.6rem;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:1px">Phone</div><div style="font-size:0.76rem">${phone}</div></div>
      ${c.notes ? `<div style="grid-column:1/-1;font-size:0.68rem;color:#666;font-style:italic;padding-top:2px">Notes: ${c.notes}</div>` : ''}
    </div>`;
  }

  const sortedVisits = (job.job_visits || []).sort((a, b) => a.visit_number - b.visit_number);
  const visitBlocks = sortedVisits.length
    ? sortedVisits.map(v => `
        <div style="border:1px solid #e4dfd8;border-radius:3px;margin-bottom:6px;overflow:hidden">
          <div style="background:#f4f1ec;padding:4px 10px;font-size:0.65rem;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:0.07em;display:flex;gap:16px">
            Visit ${v.visit_number}
            <span style="font-weight:400;color:#666;text-transform:none;letter-spacing:0">${formatDate(v.visit_date)}</span>
            ${v.clocked_in_at  ? `<span style="font-weight:400;color:#888;text-transform:none;letter-spacing:0">In: ${fmtTime(v.clocked_in_at)}</span>`  : ''}
            ${v.clocked_out_at ? `<span style="font-weight:400;color:#888;text-transform:none;letter-spacing:0">Out: ${fmtTime(v.clocked_out_at)}</span>` : ''}
          </div>
          ${v.tech_notes ? `<div style="padding:5px 10px;font-size:0.72rem;color:#444;font-style:italic">${v.tech_notes}</div>` : ''}
        </div>`).join('')
    : `<div style="font-size:0.76rem;color:#aaa;font-style:italic">No visit records.</div>`;

  const serviceAddr = job.job_address || job.accounts?.address || '';

  const html = `<!DOCTYPE html><html><head>
    <title>Job Summary</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'IBM Plex Sans',sans-serif; background:white; padding:28px 36px; font-size:0.76rem; color:#1a1a1a; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1a2744; padding-bottom:10px; margin-bottom:12px; }
      .co-name { font-size:1rem; font-weight:600; color:#1a2744; }
      .co-sub { font-size:0.68rem; color:#777; margin-top:1px; }
      .job-id { font-family:'IBM Plex Mono',monospace; font-size:0.78rem; font-weight:500; color:#1a2744; background:#eef2f7; padding:2px 7px; border-radius:2px; }
      .section { margin-bottom:11px; }
      .section-title { font-size:0.6rem; font-weight:600; text-transform:uppercase; letter-spacing:0.1em; color:#888; border-bottom:1px solid #e4dfd8; padding-bottom:3px; margin-bottom:7px; }
      .grid-4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:5px 12px; }
      .field label { display:block; font-size:0.6rem; font-weight:500; text-transform:uppercase; letter-spacing:0.07em; color:#aaa; margin-bottom:1px; }
      .scope-box { background:#f4f1ec; border-left:2.5px solid #1a2744; padding:6px 10px; font-size:0.75rem; line-height:1.45; border-radius:0 2px 2px 0; }
      .notes-box { background:#fffbf0; border:1px solid #e5dbb8; padding:6px 10px; font-size:0.75rem; line-height:1.45; border-radius:2px; }
      .footer { border-top:1px solid #e0dbd4; margin-top:10px; padding-top:7px; display:flex; justify-content:space-between; font-size:0.6rem; color:#bbb; font-family:'IBM Plex Mono',monospace; }
      @media print { @page { margin:0.4in; size:letter; } body { padding:0; } }
      tbody tr:nth-child(even) { background:#f8f6f3; }
      tbody td { padding:4px 7px; border-bottom:1px solid #ede9e3; }
    </style>
  </head><body>
    <div class="header">
      <div>
        <div class="co-name">Faith Lock &amp; Safe Co.</div>
        <div class="co-sub">Pegram, TN</div>
      </div>
      <div style="text-align:right">
        <div class="job-id">JOB-${job.id.slice(0,8).toUpperCase()}</div>
        <div style="font-size:0.63rem;color:#999;text-transform:uppercase;letter-spacing:0.06em;margin-top:3px">Job Summary${useActuals ? ' - Actuals' : ' - Expected'}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Job Information</div>
      <div class="grid-4">
        <div class="field"><label>Job Type</label><span>${job.job_types?.job_type_name || ''}</span></div>
        <div class="field"><label>Status</label><span>${job.status}</span></div>
        <div class="field"><label>WO Number</label><span style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem">${job.work_order_number || ''}</span></div>
        <div class="field"><label>PO Number</label><span style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem">${job.purchase_order_number || ''}</span></div>
        <div class="field"><label>Lead Tech</label><span>${job.lead_tech?.tech_name || ''}</span></div>
        <div class="field"><label>All Techs</label><span>${techNames}</span></div>
        <div class="field"><label>Account</label><span>${job.accounts?.account_name || ''}</span></div>
        <div class="field"><label>Sub-Account</label><span>${job.sub_accounts?.account_name || ''}</span></div>
      </div>
    </div>
    ${serviceAddr ? `<div class="section"><div class="section-title">Site Address</div><span>${serviceAddr}</span></div>` : ''}
    <div class="section">
      <div class="section-title">Contacts</div>
      ${contactBlock(primary, 'Primary')}
      ${contactBlock(secondary, 'Secondary')}
    </div>
    ${job.scope      ? `<div class="section"><div class="section-title">Scope of Work</div><div class="scope-box">${job.scope}</div></div>` : ''}
    ${job.site_notes ? `<div class="section"><div class="section-title">Site Notes</div><div class="notes-box">${job.site_notes}</div></div>` : ''}
    <div class="section">
      <div class="section-title">Visits</div>
      ${visitBlocks}
      <div style="border:1px solid #e4dfd8;border-radius:3px;overflow:hidden;margin-top:8px">
        <div style="background:#f4f1ec;padding:4px 10px;font-size:0.65rem;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:0.07em">
          Line Items ${useActuals ? '(Actuals)' : '(Expected)'}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.72rem">
          <thead><tr style="background:#1a2744;color:white">
            <th style="padding:5px 7px;text-align:left;font-weight:500;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase">Type</th>
            <th style="padding:5px 7px;text-align:left;font-weight:500;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase">Description</th>
            <th style="padding:5px 7px;text-align:center;font-weight:500;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase">Qty</th>
            <th style="padding:5px 7px;text-align:left;font-weight:500;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase">Notes</th>
          </tr></thead>
          <tbody>${itemRows(job.job_line_items)}</tbody>
        </table>
      </div>
    </div>
    <div class="footer">
      <span>Faith Lock &amp; Safe Co. | Internal Use</span>
      <span>Printed ${new Date().toLocaleDateString('en-US')}</span>
    </div>
    <script>window.onload = () => window.print();<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}
