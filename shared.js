// ============================================================
// shared.js — Faith Lock & Safe Job Management System
//
// Utilities shared by admin.html, tech.html, accounts.html, and index.html.
// Load order in every HTML file:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="shared.js"></script>
//   <script> /* page-specific code here */ </script>
// ============================================================


// ---- SUPABASE CONNECTION ----
const SUPABASE_URL      = 'https://jmsrlhqbzstuczxilxua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptc3JsaHFienN0dWN6eGlseHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzA5NDcsImV4cCI6MjA5MjQwNjk0N30.jpHtuhezvfRXJ2uVhwglqS_rImZl8JqqBX85WUv2Z5g';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ---- BRAND COLORS ----
// Derived from Faith Lock & Safe logo.
// Navy (#1a2744) = primary dark. Purple (#6b6fa8) = accent. White = surface.
// Use these constants anywhere inline color is needed outside CSS.
const BRAND = {
  navy:   '#1a2744',
  purple: '#6b6fa8',
  green:  '#2a7a4a',
  red:    '#a02020',
  amber:  '#b86c00',
  bg:     '#f2f4f8',
};


// ---- DATE HELPERS ----

// formatDate: converts a Postgres date string (YYYY-MM-DD) to MM/DD/YYYY.
// Splits on '-' to avoid UTC-midnight timezone shift bugs from new Date().
function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${m}/${d}/${y}`;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// weekStart: returns most recent Monday as YYYY-MM-DD.
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().split('T')[0];
}

// nowLocal: returns current local datetime as YYYY-MM-DDTHH:MM for datetime-local inputs.
function nowLocal() {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
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
    // Log the error so it is visible in the browser console for debugging.
    if (error) console.warn('fetchPhotoUrls: signed URL failed for', p.storage_path, error.message);
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
      } else {
        return `<div style="text-align:center">
          <div style="width:110px;height:88px;background:#eee;border:1px solid #ccc;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;padding:4px">${label}</div>
          <div style="font-size:0.72rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px">${label}</div>
          ${dateHtml}
        </div>`;
      }
    }).join('') + '</div>';
}


// ---- MAPS LINK ----

function mapsLink(address) {
  if (!address) return '';
  return `<a href="https://maps.google.com/?q=${encodeURIComponent(address)}" target="_blank"
    style="color:#1a2744;text-decoration:underline">${address} &#8599;</a>`;
}


// ---- ADMIN NAV ----
// Call once per page: renderAdminNav('schedule', '<button ...>Refresh</button>')
// activePage: 'admin' | 'schedule' | 'accounts'
// extraHtml: page-specific buttons injected after the divider (optional)
function renderAdminNav(activePage, extraHtml = '') {
  const pages = [
    { label: 'Assign',     href: 'admin.html',    key: 'admin' },
    { label: 'Review',     href: 'admin.html#review', key: 'admin' },
    { label: 'Schedule',   href: 'schedule.html', key: 'schedule' },
    { label: 'Calendar',   href: 'admin.html#calendar', key: 'admin' },
    { label: 'Accounts',   href: 'accounts.html', key: 'accounts' },
    { label: 'Reference',  href: 'admin.html#reference', key: 'admin' },
    { label: 'Search',     href: 'admin.html#search', key: 'admin' },
    { label: 'Export',     href: 'admin.html#export', key: 'admin' },
  ];

  const navBtns = pages.map(p => {
    const active = p.key === activePage && p.label === pages.find(x => x.key === activePage)?.label
      ? '' : ''; // active class handled per-page below
    const isActive = (activePage === 'schedule' && p.label === 'Schedule') ||
                     (activePage === 'accounts' && p.label === 'Accounts') ||
                     (activePage === 'admin'    && p.label === 'Assign');
    const cls = isActive ? 'class="active"' : '';
    if (p.href.includes('#')) {
      // admin.html with section anchor -- navigate and let admin page handle showSection
      return `<a href="${p.href}" style="text-decoration:none"><button ${cls} style="background:transparent;border:1px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.75);padding:0.3rem 0.75rem;cursor:pointer;font-size:0.82rem;border-radius:3px">${p.label}</button></a>`;
    }
    return `<a href="${p.href}" style="text-decoration:none"><button ${cls} style="background:${isActive ? '#6b6fa8' : 'transparent'};border:1px solid ${isActive ? '#6b6fa8' : 'rgba(255,255,255,0.35)'};color:${isActive ? 'white' : 'rgba(255,255,255,0.75)'};padding:0.3rem 0.75rem;cursor:pointer;font-size:0.82rem;border-radius:3px">${p.label}</button></a>`;
  }).join('');

  const divider = extraHtml
    ? `<span style="width:1px;height:1rem;background:rgba(255,255,255,0.2);margin:0 0.4rem;display:inline-block"></span>${extraHtml}`
    : '';

  const pageTitle = activePage === 'schedule' ? 'Schedule' : activePage === 'accounts' ? 'Accounts' : 'Admin';

  document.querySelector('header').innerHTML = `
    <h1 style="margin:0;font-size:0.95rem;font-weight:600;letter-spacing:0.02em">Faith Lock &amp; Safe &nbsp;|&nbsp; ${pageTitle}</h1>
    <nav style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;flex:1;margin-left:1rem">
      ${navBtns}${divider}
    </nav>
    <button class="logout" onclick="logout()">Sign Out</button>
  `;
}


// ---- PRINT JOB ----
// printJob(jobId): fetches full job record and opens a formatted print window.
// Shows actuals if job is Approved or Pending Review; otherwise shows expected items.
async function printJob(jobId) {
  // Fetch core job data
  const { data: job, error } = await db
    .from('jobs')
    .select(`
      id, job_date, status, scope, site_notes, is_fixed_price,
      work_order_number, purchase_order_number,
      accounts!jobs_account_id_fkey(account_name, address),
      sub_accounts:accounts!jobs_sub_account_id_fkey(account_name),
      job_types(job_type_name),
      lead_tech:techs!jobs_lead_tech_id_fkey(tech_name),
      job_techs(techs(tech_name)),
      job_line_items(item_type, quantity, notes, parts(part_name), labor_types(labor_type_name)),
      job_visits(visit_date, visit_notes,
        job_line_items(item_type, quantity, notes, parts(part_name), labor_types(labor_type_name)))
    `)
    .eq('id', jobId)
    .single();

  if (error || !job) { alert('Could not load job data.'); return; }

  // Fetch contacts for this account
  const { data: contacts } = await db
    .from('account_contacts')
    .select('contact_name, title, cell_phone, work_phone, contact_notes, is_primary, is_secondary')
    .eq('account_id', job.account_id)
    .eq('is_active', true)
    .order('is_primary', { ascending: false });

  const primary   = (contacts || []).find(c => c.is_primary);
  const secondary = (contacts || []).find(c => c.is_secondary);

  const useActuals = ['Approved', 'Pending Review'].includes(job.status);
  const allTechs   = (job.job_techs || []).map(t => t.techs?.tech_name).filter(Boolean).join(', ') || job.lead_tech?.tech_name || '';

  function itemRows(items) {
    if (!items?.length) return '<tr><td colspan="4" style="color:#aaa;font-style:italic;padding:4px 7px">None</td></tr>';
    return items.map(i => {
      const desc = i.item_type === 'part'   ? (i.parts?.part_name || '')
                 : i.item_type === 'labor'  ? (i.labor_types?.labor_type_name || '')
                 : i.item_type === 'service_call' ? 'Service Call Fee'
                 : 'Other';
      const badge = { part: '#dbeafe|#1e40af|Part', labor: '#dcfce7|#166534|Labor',
                      service_call: '#fef3c7|#92400e|Svc Call', other: '#f3e8ff|#6b21a8|Other' }[i.item_type] || '|#333|';
      const [bg, fg, label] = badge.split('|');
      const qty = i.item_type === 'labor' ? `${i.quantity} hr${i.quantity !== 1 ? 's' : ''}` : i.quantity;
      return `<tr style="background:inherit">
        <td><span style="font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:1px 4px;border-radius:2px;background:${bg};color:${fg}">${label}</span></td>
        <td>${desc}</td><td style="text-align:center">${qty}</td><td>${i.notes || ''}</td>
      </tr>`;
    }).join('');
  }

  function contactBlock(c, type) {
    if (!c) return '';
    const badgeColor = type === 'Primary' ? '#dbeafe|#1e40af' : '#f3e8ff|#6b21a8';
    const [bg, fg] = badgeColor.split('|');
    const phone = c.cell_phone || c.work_phone || '';
    return `
      <div style="display:grid;grid-template-columns:80px 1fr 1fr 1fr;gap:5px 12px;padding:5px 0;border-bottom:1px solid #f0ebe4;align-items:start">
        <div><span style="font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:2px 5px;border-radius:2px;background:${bg};color:${fg};display:inline-block;margin-top:1px">${type}</span></div>
        <div><div style="font-size:0.6rem;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:1px">Name</div><div style="font-size:0.76rem">${c.contact_name || ''}</div></div>
        <div><div style="font-size:0.6rem;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:1px">Title</div><div style="font-size:0.76rem">${c.title || ''}</div></div>
        <div><div style="font-size:0.6rem;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:1px">Phone</div><div style="font-size:0.76rem">${phone}</div></div>
        ${c.contact_notes ? `<div style="grid-column:1/-1;font-size:0.68rem;color:#666;font-style:italic;padding-top:2px">Notes: ${c.contact_notes}</div>` : ''}
      </div>`;
  }

  // Build visit blocks -- use visits table if multi-visit; fall back to job-level items
  const visits = job.job_visits?.length
    ? job.job_visits.map((v, i) => ({ label: `Visit ${i + 1}`, date: v.visit_date, items: useActuals ? v.job_line_items : [] }))
    : [{ label: 'Visit 1', date: job.job_date, items: job.job_line_items }];

  const visitBlocks = visits.map(v => `
    <div style="border:1px solid #e4dfd8;border-radius:3px;margin-bottom:8px;overflow:hidden">
      <div style="background:#f4f1ec;padding:4px 10px;font-size:0.65rem;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:0.07em">
        ${v.label} <span style="font-weight:400;color:#666;text-transform:none;letter-spacing:0">${formatDate(v.date)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.72rem">
        <thead><tr style="background:#1a2744;color:white">
          <th style="padding:5px 7px;text-align:left;font-weight:500;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase">Type</th>
          <th style="padding:5px 7px;text-align:left;font-weight:500;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase">Description</th>
          <th style="padding:5px 7px;text-align:center;font-weight:500;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase">Qty</th>
          <th style="padding:5px 7px;text-align:left;font-weight:500;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase">Notes</th>
        </tr></thead>
        <tbody>${itemRows(v.items)}</tbody>
      </table>
    </div>`).join('');

  const html = `<!DOCTYPE html><html><head>
    <title>Job Summary - ${job.id}</title>
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
        <div class="co-sub">Pegram, TN &nbsp;|&nbsp; (615) 555-0192</div>
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
        <div class="field"><label>All Techs</label><span>${allTechs}</span></div>
        <div class="field"><label>Account</label><span>${job.accounts?.account_name || ''}</span></div>
        <div class="field"><label>Sub-Account</label><span>${job.sub_accounts?.account_name || ''}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Site Address</div>
      <span>${job.accounts?.address || ''}</span>
    </div>

    <div class="section">
      <div class="section-title">Contacts</div>
      ${contactBlock(primary, 'Primary')}
      ${contactBlock(secondary, 'Secondary')}
    </div>

    ${job.scope ? `<div class="section"><div class="section-title">Scope of Work</div><div class="scope-box">${job.scope}</div></div>` : ''}
    ${job.site_notes ? `<div class="section"><div class="section-title">Site Notes</div><div class="notes-box">${job.site_notes}</div></div>` : ''}

    <div class="section">
      <div class="section-title">Visits and Line Items</div>
      ${visitBlocks}
    </div>

    <div class="footer">
      <span>Faith Lock &amp; Safe Co. -- Internal Use</span>
      <span>Printed ${new Date().toLocaleDateString('en-US')}</span>
    </div>

    <script>window.onload = () => window.print();<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}
