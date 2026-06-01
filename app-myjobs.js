// app-myjobs.js -- My Jobs panel for Milton (admin with a linked techs row)
// Globals available: currentTechRow, currentUser, allParts, allLaborTypes, db,
//                   formatDate, fmtDateTime, nowLocal, escHtml, mapsLink,
//                   fetchPhotoUrls, renderPhotoGrid, resizeImage, populateSelect

let myJobsFilter    = 'open';
let mjOpenJobId     = null;  // job id whose detail panel is expanded
let mjParts         = [];
let mjLabor         = [];
let mjCharges       = [];
let mjPrimaryCache  = {};

// ============================================================
// ENTRY POINT
// ============================================================
async function loadMyJobs() {
  if (!currentTechRow) {
    document.getElementById('section-myjobs').innerHTML =
      '<p class="meta">No tech record is linked to your account. Ask an admin to link your user in the Techs tab of Reference.</p>';
    return;
  }
  renderMyJobsShell();
  await refreshMyJobs();
}

function renderMyJobsShell() {
  document.getElementById('section-myjobs').innerHTML = `
    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem">
      <button class="btn ${myJobsFilter==='today'?'btn-primary':'btn-secondary'}" id="mjf-today"
              onclick="setMJFilter('today')" style="padding:0.3rem 0.75rem;font-size:0.83rem">Today</button>
      <button class="btn ${myJobsFilter==='week'?'btn-primary':'btn-secondary'}" id="mjf-week"
              onclick="setMJFilter('week')" style="padding:0.3rem 0.75rem;font-size:0.83rem">This Week</button>
      <button class="btn ${myJobsFilter==='open'?'btn-primary':'btn-secondary'}" id="mjf-open"
              onclick="setMJFilter('open')" style="padding:0.3rem 0.75rem;font-size:0.83rem">All Open</button>
      <button class="btn btn-secondary" style="margin-left:auto;padding:0.28rem 0.7rem;font-size:0.81rem"
              onclick="refreshMyJobs()">Refresh</button>
    </div>
    <div id="mj-list"><p class="meta">Loading...</p></div>

    <!-- Inline completion form (hidden until a job is selected) -->
    <div id="mj-detail" style="display:none"></div>
  `;
}

function setMJFilter(f) {
  myJobsFilter = f;
  ['today','week','open'].forEach(k => {
    const btn = document.getElementById(`mjf-${k}`);
    if (btn) {
      btn.className = 'btn ' + (f === k ? 'btn-primary' : 'btn-secondary');
      btn.style.cssText = 'padding:0.3rem 0.75rem;font-size:0.83rem';
    }
  });
  refreshMyJobs();
}

// ============================================================
// DATA LOAD
// ============================================================
async function refreshMyJobs() {
  const list = document.getElementById('mj-list');
  if (!list) return;
  list.innerHTML = '<p class="meta">Loading...</p>';

  let query = db.from('jobs')
    .select(`id, job_date, status, scope, site_notes, is_fixed_price, quote_amount,
             work_order_number, purchase_order_number, account_id,
             assigned_tech_ids, lead_tech_id,
             accounts!jobs_account_id_fkey(account_name, address),
             sub:accounts!jobs_sub_account_id_fkey(account_name, address),
             job_types(job_type_name),
             job_completions(id,tech_notes,follow_up_flag,submitted_at),
             job_line_items(id,item_type,item_id,quantity),
             job_visits(id,visit_number,visit_date,clocked_in_at,clocked_out_at)`)
    .contains('assigned_tech_ids', [currentTechRow.id])
    .not('status', 'in', '("Cancelled","Approved")');

  if (myJobsFilter === 'today') query = query.eq('job_date', today());
  else if (myJobsFilter === 'week') query = query.gte('job_date', weekStart());

  const { data, error } = await query.order('job_date', { ascending: true });
  if (error) {
    list.innerHTML = `<div class="msg error"><strong>Error:</strong> ${error.message}</div>`;
    return;
  }

  const jobs = data || [];
  if (!jobs.length) {
    list.innerHTML = '<p class="meta">No jobs found for this filter.</p>';
    return;
  }

  // Batch-fetch primary contacts
  const acctIds = [...new Set(jobs.map(j => j.account_id).filter(Boolean))];
  mjPrimaryCache = {};
  if (acctIds.length) {
    const { data: contacts } = await db.from('account_contacts')
      .select('account_id,contact_name,work_phone,cell_phone,is_primary')
      .in('account_id', acctIds).eq('active', true).eq('is_primary', true);
    (contacts || []).forEach(c => { mjPrimaryCache[c.account_id] = c; });
  }

  list.innerHTML = jobs.map(j => mjJobCard(j)).join('');
}

// ============================================================
// JOB CARD
// ============================================================
function mjJobCard(j) {
  const acct      = j.accounts?.account_name || 'Unknown';
  const sub       = j.sub?.account_name ? ` / ${j.sub.account_name}` : '';
  const comp      = j.job_completions?.[0];
  const submitted = !!comp;
  const visits    = j.job_visits || [];

  const futureVisits = visits.filter(v => v.visit_date > today())
    .sort((a, b) => a.visit_date.localeCompare(b.visit_date));
  const nextVisit = futureVisits[0];

  const visitBanner = nextVisit
    ? `<div style="background:#e8f0ff;border:1px solid #b0c4f8;color:#1a3070;padding:0.3rem 0.6rem;margin-bottom:0.35rem;font-size:0.82rem;border-radius:4px">
         Return visit: <strong>${formatDate(nextVisit.visit_date)}</strong>${nextVisit.tech_notes ? ' -- ' + nextVisit.tech_notes : ''}
       </div>` : '';

  const fixedBanner = j.is_fixed_price
    ? `<div style="background:#ffe8e8;border:1px solid #f4aaaa;color:#800;padding:0.32rem 0.6rem;margin-bottom:0.35rem;font-size:0.83rem;border-radius:4px;font-weight:600">
         FIXED PRICE | Quoted: $${Number(j.quote_amount||0).toFixed(2)} | Do not exceed scope without calling Rich.
       </div>` : '';

  const pc = mjPrimaryCache[j.account_id];
  const contactLine = pc
    ? `<div class="meta">Contact: <strong>${pc.contact_name}</strong>${pc.work_phone ? ' | Work: '+pc.work_phone : ''}${pc.cell_phone ? ' | Cell: '+pc.cell_phone : ''}</div>`
    : '';

  const displayAddr = j.sub?.address || j.accounts?.address;
  const addrLine = displayAddr
    ? `<div class="meta">${mapsLink(displayAddr)}</div>` : '';

  const wopo = [
    j.work_order_number     ? `WO: ${j.work_order_number}` : '',
    j.purchase_order_number ? `PO: ${j.purchase_order_number}` : ''
  ].filter(Boolean).join(' | ');

  const statusBadge = `<span class="status-badge status-${j.status.replace(/ /g,'-')}">${j.status}</span>`;

  // Clock in/out state
  const currentVisit = visits.filter(v => v.visit_date === today()).sort((a,b) => b.visit_number - a.visit_number)[0];
  let clockBtns = '';
  if (!submitted) {
    if (!currentVisit || (!currentVisit.clocked_in_at && !currentVisit.clocked_out_at)) {
      clockBtns = `<button class="btn btn-green" style="font-size:0.82rem;padding:0.3rem 0.7rem"
                           onclick="mjClockIn('${j.id}')">Clock In</button>`;
    } else if (currentVisit.clocked_in_at && !currentVisit.clocked_out_at) {
      const inTime = fmtTime ? fmtTime(currentVisit.clocked_in_at) : fmtDateTime(currentVisit.clocked_in_at);
      clockBtns = `<span style="font-size:0.8rem;color:#2a7a4a;font-weight:600">Clocked in ${inTime}</span>
                   <button class="btn btn-warn" style="font-size:0.82rem;padding:0.3rem 0.7rem;margin-left:0.3rem"
                           onclick="mjClockOut('${j.id}','${currentVisit.id}')">Clock Out</button>`;
    } else if (currentVisit.clocked_in_at && currentVisit.clocked_out_at) {
      clockBtns = `<span style="font-size:0.8rem;color:#5a6075">Clocked out today</span>`;
    }
  }

  const detailBtn = submitted
    ? `<button class="btn btn-secondary" onclick="mjOpenDetail('${j.id}')">View / Add Photos</button>
       <button class="btn btn-warn" onclick="mjUnsubmit('${j.id}','${comp?.id}')">Unsubmit</button>`
    : `<button class="btn btn-primary" onclick="mjOpenDetail('${j.id}')">Job Details</button>`;

  return `<div class="card" id="mjcard-${j.id}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.3rem">
      <h3 style="margin:0;font-size:0.97rem">${escHtml(acct)}${escHtml(sub)}</h3>
      ${statusBadge}
    </div>
    <div class="meta" style="margin-bottom:0.22rem">${formatDate(j.job_date)} | ${j.job_types?.job_type_name || ''}</div>
    ${wopo ? `<div class="meta">${wopo}</div>` : ''}
    ${addrLine}
    ${contactLine}
    ${visitBanner}
    ${fixedBanner}
    ${j.scope ? `<p style="font-size:0.85rem;margin:0.3rem 0;color:#333"><strong>Scope:</strong> ${escHtml(j.scope)}</p>` : ''}
    ${submitted ? '<p style="font-size:0.82rem;color:#2a7a4a;font-weight:600;margin:0.25rem 0">Submitted -- awaiting review.</p>' : ''}
    <div style="margin-top:0.6rem;display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center">
      ${clockBtns}
      ${detailBtn}
    </div>
    <div id="mj-inline-${j.id}" style="display:none"></div>
  </div>`;
}

// ============================================================
// CLOCK IN / OUT
// ============================================================
async function mjClockIn(jobId) {
  // Enforce one active job per tech
  const { data: active } = await db.from('jobs')
    .select('id,accounts!jobs_account_id_fkey(account_name)')
    .eq('status', 'In Progress')
    .contains('assigned_tech_ids', [currentTechRow.id]);

  if (active?.length) {
    const name = active[0].accounts?.account_name || 'another job';
    if (!confirm(`You appear to already be clocked in on "${name}". Clock in here anyway?`)) return;
  }

  const now = new Date().toISOString();

  // Update or create today's visit with clocked_in_at
  const { data: existingVisit } = await db.from('job_visits')
    .select('id').eq('job_id', jobId).eq('visit_date', today()).maybeSingle();

  if (existingVisit) {
    await db.from('job_visits').update({
      clocked_in_at: now,
      clocked_in_by: currentUser.id
    }).eq('id', existingVisit.id);
  } else {
    // Find max visit number for this job
    const { data: visits } = await db.from('job_visits').select('visit_number').eq('job_id', jobId);
    const maxNum = (visits || []).reduce((m, v) => Math.max(m, v.visit_number || 1), 0);
    await db.from('job_visits').insert({
      job_id:        jobId,
      visit_number:  maxNum + 1,
      visit_date:    today(),
      clocked_in_at: now,
      clocked_in_by: currentUser.id
    });
  }

  // Set job to In Progress
  await db.from('jobs').update({ status: 'In Progress', updated_at: now }).eq('id', jobId);
  await refreshMyJobs();
}

async function mjClockOut(jobId, visitId) {
  const now = new Date().toISOString();
  await db.from('job_visits').update({ clocked_out_at: now }).eq('id', visitId);
  // Do NOT auto-change status -- tech will submit completion when done
  await refreshMyJobs();
}

// ============================================================
// DETAIL PANEL (inline, below the card)
// ============================================================
async function mjOpenDetail(jobId) {
  // If already open, close it
  if (mjOpenJobId === jobId) {
    const panel = document.getElementById(`mj-inline-${jobId}`);
    if (panel) panel.style.display = 'none';
    mjOpenJobId = null;
    return;
  }

  mjOpenJobId  = jobId;
  mjParts      = [];
  mjLabor      = [];
  mjCharges    = [];

  const panel = document.getElementById(`mj-inline-${jobId}`);
  if (!panel) return;
  panel.style.display = '';
  panel.innerHTML = '<p class="meta" style="padding:0.5rem 0">Loading...</p>';

  const { data: job, error } = await db.from('jobs')
    .select(`*, accounts!jobs_account_id_fkey(account_name, address, phone),
             sub:accounts!jobs_sub_account_id_fkey(account_name, address),
             job_types(job_type_name),
             job_completions(id,time_in,time_out,payment_type,payment_detail,follow_up_flag,tech_notes,submitted_at),
             job_line_items(id,item_type,item_id,quantity),
             job_visits(id,visit_number,visit_date,clocked_in_at,clocked_out_at)`)
    .eq('id', jobId).single();

  if (error) {
    panel.innerHTML = `<div class="msg error">${error.message}</div>`;
    return;
  }

  const comp      = job.job_completions?.[0];
  const submitted = !!comp;

  // Pre-load expected line items
  (job.job_line_items || []).forEach(i => {
    if (i.item_type === 'Part') {
      const p = allParts.find(x => x.id === i.item_id);
      if (p) mjParts.push({ id: p.id, name: p.part_name, qty: i.quantity });
    } else if (i.item_type === 'Labor') {
      const l = allLaborTypes.find(x => x.id === i.item_id);
      if (l) mjLabor.push({ id: l.id, name: l.labor_type_name, hours: i.quantity });
    }
  });

  const laborOpts = allLaborTypes.map(l =>
    `<option value="${l.id}">${escHtml(l.labor_type_name)}</option>`).join('');

  const todayVisit = (job.job_visits || [])
    .filter(v => v.visit_date === today())
    .sort((a, b) => b.visit_number - a.visit_number)[0];

  // Pre-fill time from today's visit if clocked in/out
  const prefillIn  = todayVisit?.clocked_in_at  ? new Date(todayVisit.clocked_in_at).toISOString().slice(0,16)  : '';
  const prefillOut = todayVisit?.clocked_out_at ? new Date(todayVisit.clocked_out_at).toISOString().slice(0,16) : '';

  const hasExpected = (job.job_line_items||[]).some(i => i.item_type === 'Part' || i.item_type === 'Labor');
  const preNote = hasExpected
    ? `<p style="font-size:0.82rem;color:#1a3070;margin:0 0 0.45rem;background:#eaf2ff;border-radius:3px;padding:0.38rem 0.55rem">Expected items are pre-loaded. Adjust as needed.</p>`
    : '';

  let content = '';

  if (submitted) {
    content = `
      <div style="margin-top:0.75rem;background:#f8f9fc;border:1px solid #dde1ea;border-radius:5px;padding:0.95rem">
        <div class="section-title">Submitted</div>
        <div class="meta">Time In: ${fmtDateTime(comp.time_in)}</div>
        <div class="meta">Time Out: ${fmtDateTime(comp.time_out)}</div>
        <div class="meta">Payment: ${comp.payment_type || '--'} ${comp.payment_detail || ''}</div>
        ${comp.tech_notes ? `<div class="meta">Notes: ${escHtml(comp.tech_notes)}</div>` : ''}
        <div style="margin-top:0.6rem">
          <div class="section-title">Photos</div>
          <div id="mj-photos-${jobId}" style="margin-bottom:0.5rem"><span class="meta">Loading...</span></div>
          <div class="form-row" style="margin-top:0.5rem">
            <label>Add Photos</label>
            <input type="file" id="mj-extraphotos-${jobId}" accept="image/*" multiple>
          </div>
          <button class="btn btn-secondary" onclick="mjUploadPhotos('${jobId}')">Upload</button>
          <div id="mj-photo-msg-${jobId}" class="meta" style="margin-top:0.25rem"></div>
        </div>
      </div>`;
  } else {
    content = `
      <div style="margin-top:0.75rem;background:#f8f9fc;border:1px solid #dde1ea;border-radius:5px;padding:0.95rem">
        <div class="section-title">Time</div>
        <div class="form-row">
          <label>Time In</label>
          <div style="display:flex;gap:0.4rem">
            <input type="datetime-local" id="mj-timein-${jobId}" value="${prefillIn}" style="flex:1">
            <button type="button" class="btn btn-secondary" style="white-space:nowrap;padding:0.38rem 0.65rem"
              onclick="document.getElementById('mj-timein-${jobId}').value=nowLocal()">Now</button>
          </div>
        </div>
        <div class="form-row">
          <label>Time Out</label>
          <div style="display:flex;gap:0.4rem">
            <input type="datetime-local" id="mj-timeout-${jobId}" value="${prefillOut}" style="flex:1">
            <button type="button" class="btn btn-secondary" style="white-space:nowrap;padding:0.38rem 0.65rem"
              onclick="document.getElementById('mj-timeout-${jobId}').value=nowLocal()">Now</button>
          </div>
        </div>

        <div class="section-title">Parts Used</div>
        ${preNote}
        <div style="position:relative;margin-bottom:0.45rem">
          <input type="text" id="mj-partsearch-${jobId}" placeholder="Search parts..."
                 oninput="mjSearchParts('${jobId}')" autocomplete="off"
                 style="width:100%;padding:0.48rem 0.6rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.87rem;font-family:inherit">
          <div id="mj-parts-results-${jobId}" style="display:none;border:1px solid #c8cdd8;background:white;max-height:200px;overflow-y:auto;position:absolute;z-index:50;width:100%;top:100%;left:0;box-shadow:0 4px 14px rgba(26,39,68,0.14);border-radius:0 0 4px 4px"></div>
        </div>
        <table id="mj-parts-table-${jobId}">
          <thead><tr><th>Part</th><th>Qty</th><th></th></tr></thead>
          <tbody></tbody>
        </table>

        <div class="section-title">Labor</div>
        <div style="display:flex;gap:0.4rem;margin-bottom:0.38rem;flex-wrap:wrap">
          <select id="mj-labortype-${jobId}" style="flex:2;padding:0.48rem;border:1px solid #c8cdd8;border-radius:4px;min-width:140px">
            <option value="">Select type...</option>${laborOpts}
          </select>
          <input type="number" id="mj-laborhours-${jobId}" placeholder="Hrs"
                 style="width:68px;padding:0.48rem;border:1px solid #c8cdd8;border-radius:4px">
          <button class="btn btn-secondary" onclick="mjAddLabor('${jobId}')">Add</button>
        </div>
        <table id="mj-labor-table-${jobId}">
          <thead><tr><th>Type</th><th>Hours</th><th></th></tr></thead>
          <tbody></tbody>
        </table>

        <div class="section-title">Additional Charges</div>
        <div style="display:flex;gap:0.4rem;margin-bottom:0.38rem;flex-wrap:wrap;align-items:flex-end">
          <select id="mj-chargetype-${jobId}" style="padding:0.4rem;border:1px solid #c8cdd8;border-radius:4px">
            <option value="Service Call">Service Call</option>
            <option value="Other">Other</option>
          </select>
          <input type="text" id="mj-chargedesc-${jobId}" placeholder="Description"
                 style="flex:2;padding:0.4rem;border:1px solid #c8cdd8;border-radius:4px">
          <input type="number" id="mj-chargeamt-${jobId}" placeholder="$" step="0.01"
                 style="width:78px;padding:0.4rem;border:1px solid #c8cdd8;border-radius:4px">
          <button class="btn btn-secondary" onclick="mjAddCharge('${jobId}')">Add</button>
        </div>
        <table id="mj-charges-table-${jobId}">
          <thead><tr><th>Type</th><th>Desc</th><th>Amt</th><th></th></tr></thead>
          <tbody></tbody>
        </table>

        <div class="section-title">Payment</div>
        <div class="form-row">
          <label>Payment Type</label>
          <select id="mj-paytype-${jobId}">
            <option value="">Select...</option>
            <option>Cash</option><option>Check</option><option>Card</option><option>Invoice</option>
          </select>
        </div>
        <div class="form-row">
          <label>Payment Detail</label>
          <input type="text" id="mj-paydetail-${jobId}" placeholder="Check number, last 4, etc.">
        </div>

        <div class="form-row">
          <label>Tech Notes</label>
          <textarea id="mj-notes-${jobId}" style="height:64px;width:100%;padding:0.48rem 0.6rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.87rem;font-family:inherit;resize:vertical"></textarea>
        </div>
        <div class="form-row">
          <label style="display:flex;align-items:center;gap:0.4rem">
            <input type="checkbox" id="mj-followup-${jobId}"> Flag for Follow-up
          </label>
        </div>
        <div class="form-row">
          <label>Photos</label>
          <input type="file" id="mj-photos-input-${jobId}" accept="image/*" multiple>
        </div>

        <div id="mj-msg-${jobId}" style="margin-top:0.5rem"></div>
        <div style="margin-top:0.55rem;display:flex;gap:0.35rem;flex-wrap:wrap">
          <button class="btn btn-green" style="flex:1;padding:0.6rem;font-size:0.92rem"
                  onclick="mjSubmitCompletion('${jobId}')">Submit Completion</button>
          <button class="btn btn-secondary" onclick="mjCloseDetail('${jobId}')">Cancel</button>
        </div>
      </div>`;
  }

  panel.innerHTML = content;
  mjRenderPartsTable(jobId);
  mjRenderLaborTable(jobId);
  mjRenderChargesTable(jobId);

  if (submitted) mjLoadPhotos(jobId);
}

function mjCloseDetail(jobId) {
  const panel = document.getElementById(`mj-inline-${jobId}`);
  if (panel) panel.style.display = 'none';
  if (mjOpenJobId === jobId) mjOpenJobId = null;
}

// ============================================================
// PARTS
// ============================================================
function mjSearchParts(jobId) {
  const input   = document.getElementById(`mj-partsearch-${jobId}`);
  const results = document.getElementById(`mj-parts-results-${jobId}`);
  if (!input || !results) return;
  const q = input.value.toLowerCase().trim();
  if (!q) { results.style.display = 'none'; return; }
  const matches = allParts.filter(p => p.part_name.toLowerCase().includes(q)).slice(0, 12);
  if (!matches.length) { results.style.display = 'none'; return; }
  results.innerHTML = matches.map(p =>
    `<div data-id="${p.id}" data-name="${escHtml(p.part_name)}"
          style="padding:0.52rem 0.6rem;cursor:pointer;border-bottom:1px solid #eef0f6;font-size:0.88rem"
          onmouseover="this.style.background='#e8eaf8'" onmouseout="this.style.background=''"
          onmousedown="event.preventDefault();mjAddPart('${jobId}','${p.id}','${escHtml(p.part_name).replace(/'/g,"\\'")}')">
      ${escHtml(p.part_name)}${p.unit ? ' ('+p.unit+')' : ''}${p.category ? ' | '+p.category : ''}
    </div>`
  ).join('');
  results.style.display = 'block';
}

function mjAddPart(jobId, id, name) {
  const ex = mjParts.find(p => p.id === id);
  if (ex) ex.qty += 1; else mjParts.push({ id, name, qty: 1 });
  mjRenderPartsTable(jobId);
  const results = document.getElementById(`mj-parts-results-${jobId}`);
  const input   = document.getElementById(`mj-partsearch-${jobId}`);
  if (results) results.style.display = 'none';
  if (input)   input.value = '';
}

function mjRemovePart(jobId, idx) { mjParts.splice(idx, 1); mjRenderPartsTable(jobId); }

function mjRenderPartsTable(jobId) {
  const tbody = document.querySelector(`#mj-parts-table-${jobId} tbody`);
  if (!tbody) return;
  tbody.innerHTML = mjParts.map((p, i) =>
    `<tr>
      <td>${escHtml(p.name)}</td>
      <td><input type="number" min="0.1" step="0.1" value="${p.qty}"
            style="width:62px;padding:0.28rem;border:1px solid #c8cdd8;border-radius:3px;font-size:0.88rem"
            onchange="mjParts[${i}].qty=parseFloat(this.value)||1"></td>
      <td><button onclick="mjRemovePart('${jobId}',${i})"
            style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700;font-size:0.95rem;padding:0.1rem 0.3rem">X</button></td>
    </tr>`
  ).join('') || '<tr><td colspan="3" style="color:#aaa;font-style:italic;font-size:0.82rem">None added</td></tr>';
}

// ============================================================
// LABOR
// ============================================================
function mjAddLabor(jobId) {
  const typeId = document.getElementById(`mj-labortype-${jobId}`)?.value;
  const hours  = parseFloat(document.getElementById(`mj-laborhours-${jobId}`)?.value);
  if (!typeId || isNaN(hours) || hours <= 0) return;
  const lt = allLaborTypes.find(l => l.id === typeId);
  const ex = mjLabor.find(l => l.id === typeId);
  if (ex) ex.hours = hours; else mjLabor.push({ id: typeId, name: lt.labor_type_name, hours });
  mjRenderLaborTable(jobId);
  const hoursEl = document.getElementById(`mj-laborhours-${jobId}`);
  if (hoursEl) hoursEl.value = '';
}

function mjRemoveLabor(jobId, idx) { mjLabor.splice(idx, 1); mjRenderLaborTable(jobId); }

function mjRenderLaborTable(jobId) {
  const tbody = document.querySelector(`#mj-labor-table-${jobId} tbody`);
  if (!tbody) return;
  tbody.innerHTML = mjLabor.map((l, i) =>
    `<tr>
      <td>${escHtml(l.name)}</td><td>${l.hours} hr</td>
      <td><button onclick="mjRemoveLabor('${jobId}',${i})"
            style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700;font-size:0.95rem;padding:0.1rem 0.3rem">X</button></td>
    </tr>`
  ).join('') || '<tr><td colspan="3" style="color:#aaa;font-style:italic;font-size:0.82rem">None added</td></tr>';
}

// ============================================================
// CHARGES
// ============================================================
function mjAddCharge(jobId) {
  const type = document.getElementById(`mj-chargetype-${jobId}`)?.value;
  const desc = document.getElementById(`mj-chargedesc-${jobId}`)?.value.trim();
  const amt  = parseFloat(document.getElementById(`mj-chargeamt-${jobId}`)?.value);
  if (isNaN(amt) || amt < 0) return;
  mjCharges.push({ type, description: desc, amount: amt });
  mjRenderChargesTable(jobId);
  const descEl = document.getElementById(`mj-chargedesc-${jobId}`);
  const amtEl  = document.getElementById(`mj-chargeamt-${jobId}`);
  if (descEl) descEl.value = '';
  if (amtEl)  amtEl.value  = '';
}

function mjRemoveCharge(jobId, idx) { mjCharges.splice(idx, 1); mjRenderChargesTable(jobId); }

function mjRenderChargesTable(jobId) {
  const tbody = document.querySelector(`#mj-charges-table-${jobId} tbody`);
  if (!tbody) return;
  tbody.innerHTML = mjCharges.map((c, i) =>
    `<tr>
      <td>${c.type}</td><td>${escHtml(c.description)}</td><td>$${Number(c.amount).toFixed(2)}</td>
      <td><button onclick="mjRemoveCharge('${jobId}',${i})"
            style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700;font-size:0.95rem;padding:0.1rem 0.3rem">X</button></td>
    </tr>`
  ).join('') || '<tr><td colspan="4" style="color:#aaa;font-style:italic;font-size:0.82rem">None added</td></tr>';
}

// ============================================================
// SUBMIT COMPLETION
// ============================================================
async function mjSubmitCompletion(jobId) {
  const msg = document.getElementById(`mj-msg-${jobId}`);
  if (msg) msg.innerHTML = '<span class="meta">Saving...</span>';

  // Delete existing line items (replace pattern)
  await db.from('job_line_items').delete().eq('job_id', jobId);

  const { error: ce } = await db.from('job_completions').insert({
    job_id:         jobId,
    time_in:        document.getElementById(`mj-timein-${jobId}`)?.value    || null,
    time_out:       document.getElementById(`mj-timeout-${jobId}`)?.value   || null,
    payment_type:   document.getElementById(`mj-paytype-${jobId}`)?.value   || null,
    payment_detail: document.getElementById(`mj-paydetail-${jobId}`)?.value || null,
    follow_up_flag: document.getElementById(`mj-followup-${jobId}`)?.checked || false,
    tech_notes:     document.getElementById(`mj-notes-${jobId}`)?.value     || null,
    submitted_by:   currentUser.id
  });

  if (ce) {
    if (msg) msg.innerHTML = `<div class="msg error">${ce.message}</div>`;
    return;
  }

  const NULL_UUID = '00000000-0000-0000-0000-000000000000';
  const lineItems = [
    ...mjParts.map(p   => ({ job_id: jobId, item_type: 'Part',   item_id: p.id,     quantity: p.qty,   unit_cost: 0 })),
    ...mjLabor.map(l   => ({ job_id: jobId, item_type: 'Labor',  item_id: l.id,     quantity: l.hours, unit_cost: 0 })),
    ...mjCharges.map(c => ({ job_id: jobId, item_type: c.type,   item_id: NULL_UUID, quantity: 1,      unit_cost: c.amount, override_reason: c.description }))
  ];
  if (lineItems.length) await db.from('job_line_items').insert(lineItems);

  await db.from('jobs').update({
    status:     'Pending Review',
    updated_at: new Date().toISOString()
  }).eq('id', jobId);

  // Upload photos
  const photoInput = document.getElementById(`mj-photos-input-${jobId}`);
  if (photoInput?.files?.length) await mjUploadPhotosFiles(photoInput.files, jobId);

  if (msg) msg.innerHTML = '<div style="color:#2a7a4a;font-weight:600;padding:0.35rem 0">Submitted successfully.</div>';
  setTimeout(() => refreshMyJobs(), 1100);
}

// ============================================================
// UNSUBMIT
// ============================================================
async function mjUnsubmit(jobId, compId) {
  if (!confirm('Remove your submission? The job will return to Scheduled. Only do this if Rich has not yet reviewed it.')) return;
  await db.from('job_completions').delete().eq('id', compId);
  await db.from('job_line_items').delete().eq('job_id', jobId);
  await db.from('jobs').update({ status: 'Scheduled', updated_at: new Date().toISOString() }).eq('id', jobId);
  await refreshMyJobs();
}

// ============================================================
// PHOTOS
// ============================================================
async function mjLoadPhotos(jobId) {
  const grid = document.getElementById(`mj-photos-${jobId}`);
  if (!grid) return;
  const { data: photos } = await db.from('job_photos')
    .select('id,storage_path,file_name,uploaded_at').eq('job_id', jobId)
    .order('uploaded_at', { ascending: false });
  const withUrls = await fetchPhotoUrls(photos || []);
  renderPhotoGrid(grid, withUrls, false);
}

async function mjUploadPhotos(jobId) {
  const input  = document.getElementById(`mj-extraphotos-${jobId}`);
  const msgEl  = document.getElementById(`mj-photo-msg-${jobId}`);
  if (!input?.files?.length) { if (msgEl) msgEl.textContent = 'No files selected.'; return; }
  if (msgEl) msgEl.textContent = 'Uploading...';
  await mjUploadPhotosFiles(input.files, jobId);
  if (input) input.value = '';
  if (msgEl) msgEl.textContent = 'Uploaded.';
  await mjLoadPhotos(jobId);
}

async function mjUploadPhotosFiles(files, jobId) {
  if (!files || !files.length) return;
  const { data: job } = await db.from('jobs').select('account_id').eq('id', jobId).single();
  for (const file of files) {
    const path    = `${jobId}/${Date.now()}_${file.name}`;
    const resized = await resizeImage(file, 1200);
    const { error } = await db.storage.from('job-photos').upload(path, resized);
    if (error) continue;
    await db.from('job_photos').insert({
      job_id:       jobId,
      account_id:   job?.account_id || null,
      storage_path: path,
      file_name:    file.name,
      uploaded_by:  currentUser.id
    });
  }
}
