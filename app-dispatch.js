// app-dispatch.js -- Dispatch Board and Assign Job
// Depends on globals: currentUser, allAccounts, allTechs, allJobTypes, allParts, allLaborTypes

// ---- STATE ----
let assignParts          = [];
let assignLabor          = [];
let assignCharges        = [];
let lastJob              = null;
let currentAccountContacts = [];
let contactEditMode      = false;

// Calendar state
let calWeekStart = weekStart(); // Monday of displayed week

// Reopen modal state (shared with review)
let reopenJobId  = null;
let reopenParts  = [];
let reopenLabor  = [];
let reopenCharges = [];
let reopenVisits = [];
let reopenCompId = null;


// ============================================================
// DISPATCH PANEL TOGGLE
// ============================================================
function showDispatchPanel(name) {
  ['board','calendar','assign'].forEach(p => {
    const el = document.getElementById(`dp-${p}`);
    if (el) el.style.display = p === name ? '' : 'none';
    const btn = document.getElementById(`dp-btn-${p}`);
    if (btn) btn.className = p === name ? 'active' : '';
  });
  document.getElementById('stocking-panel').style.display = 'none';
  if (name === 'calendar') loadCalendar();
}


// ============================================================
// CALENDAR VIEW
// ============================================================
function weekDates(monday) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday + 'T12:00:00');
    d.setDate(d.getDate() + i);
    dates.push(_localDateStr(d));
  }
  return dates;
}

function prevCalWeek() {
  const d = new Date(calWeekStart + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  calWeekStart = _localDateStr(d);
  loadCalendar();
}
function nextCalWeek() {
  const d = new Date(calWeekStart + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  calWeekStart = _localDateStr(d);
  loadCalendar();
}
function todayCalWeek() {
  calWeekStart = weekStart();
  loadCalendar();
}

async function loadCalendar() {
  const calEl = document.getElementById('dp-calendar');
  if (!calEl) return;
  calEl.innerHTML = '<p class="meta">Loading...</p>';

  const dates = weekDates(calWeekStart);
  const from = dates[0];
  const to   = dates[6];

  const { data, error } = await db.from('jobs')
    .select(`id, job_date, status, assigned_tech_ids,
             accounts!jobs_account_id_fkey(account_name)`)
    .gte('job_date', from)
    .lte('job_date', to)
    .not('status', 'eq', 'Cancelled')
    .not('status', 'eq', 'Approved')
    .order('job_date');

  if (error) { calEl.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  const jobs = data || [];

  // Build display labels
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOW    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const d0 = new Date(from + 'T12:00:00');
  const d6 = new Date(to   + 'T12:00:00');
  const weekLabel = `${MONTHS[d0.getMonth()]} ${d0.getDate()} &ndash; ${d6.getDate()}, ${d6.getFullYear()}`;

  // Tech id -> name map
  const techMap = {};
  allTechs.forEach(t => { techMap[t.id] = t.tech_name; });

  // Group: techName -> dateKey -> jobs[]
  const byTech = {};
  const unassigned = {};
  allTechs.forEach(t => { byTech[t.tech_name] = {}; });

  jobs.forEach(j => {
    const techIds = j.assigned_tech_ids || [];
    if (!techIds.length) {
      if (!unassigned[j.job_date]) unassigned[j.job_date] = [];
      unassigned[j.job_date].push(j);
    } else {
      techIds.forEach(tid => {
        const tname = techMap[tid];
        if (!tname) return;
        if (!byTech[tname]) byTech[tname] = {};
        if (!byTech[tname][j.job_date]) byTech[tname][j.job_date] = [];
        byTech[tname][j.job_date].push(j);
      });
    }
  });

  // Status chip color map
  const chipStyle = {
    'Scheduled':      'background:#e4eaf8;color:#1a2744',
    'In Progress':    'background:#c8f0d8;color:#0e4a24',
    'Awaiting Parts': 'background:#ffe8cc;color:#7a3800',
    'Pending Review': 'background:#fff8c0;color:#6b5a00',
    'Flagged':        'background:#ffe0e0;color:#900000',
    'Quoted':         'background:#fff3d6;color:#7a4800',
  };

  function chip(j) {
    const raw   = j.accounts?.account_name || '(no account)';
    const label = raw.length > 18 ? raw.slice(0, 17) + '…' : raw;
    const style = chipStyle[j.status] || 'background:#eee;color:#333';
    return `<div onclick="openReopen('${j.id}')" title="${escHtml(raw)} | ${j.status}"
      style="${style};padding:0.18rem 0.42rem;border-radius:3px;font-size:0.73rem;font-weight:600;
             cursor:pointer;margin-bottom:0.22rem;white-space:nowrap;overflow:hidden;
             text-overflow:ellipsis;max-width:130px">${escHtml(label)}</div>`;
  }

  // Day column headers
  const dayHeaders = dates.map((d, i) => {
    const dt = new Date(d + 'T12:00:00');
    const isToday = d === today();
    return `<th style="text-align:center;min-width:130px;padding:0.42rem 0.4rem;
              ${isToday ? 'background:#e8eaf8;' : ''} ">
              <span style="font-weight:700">${DOW[i]}</span>
              <span style="font-weight:400;font-size:0.77rem;display:block;color:#5a6075">
                ${MONTHS[dt.getMonth()]} ${dt.getDate()}</span></th>`;
  }).join('');

  // Tech rows
  function techRow(techName, rowData) {
    const cells = dates.map(d => {
      const cellJobs = (rowData[d] || []);
      const isToday  = d === today();
      return `<td style="vertical-align:top;padding:0.32rem 0.4rem;border-bottom:1px solid #eef0f6;
                ${isToday ? 'background:#fafbfd;' : ''}">${cellJobs.map(chip).join('')}</td>`;
    }).join('');
    return `<tr>
      <td style="font-weight:600;font-size:0.83rem;color:#1a2744;padding:0.35rem 0.6rem;
                 white-space:nowrap;background:#f8f9fc;border-right:2px solid #dde1ea;
                 border-bottom:1px solid #eef0f6">${techName}</td>${cells}</tr>`;
  }

  const techRowsHtml = allTechs.map(t => techRow(t.tech_name, byTech[t.tech_name] || {})).join('');

  const hasUnassigned = Object.values(unassigned).some(a => a.length > 0);
  const unassignedHtml = hasUnassigned ? techRow('<span style="color:#888;font-weight:400">Unassigned</span>', unassigned) : '';

  calEl.innerHTML = `
    <div style="display:flex;gap:0.4rem;align-items:center;margin-bottom:0.85rem;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="prevCalWeek()">&#8592; Prev Week</button>
      <button class="btn btn-secondary btn-sm" onclick="todayCalWeek()">Today</button>
      <button class="btn btn-secondary btn-sm" onclick="nextCalWeek()">Next Week &#8594;</button>
      <strong style="color:#1a2744;margin-left:0.3rem">${weekLabel}</strong>
      <span class="meta" style="margin-left:auto">${jobs.length} job${jobs.length !== 1 ? 's' : ''} shown &mdash; Cancelled and Approved not displayed</span>
    </div>
    <div style="overflow-x:auto">
      <table style="border-collapse:collapse;width:100%;min-width:820px;border:1px solid #dde1ea;border-radius:4px;overflow:hidden">
        <thead><tr>
          <th style="text-align:left;min-width:110px;padding:0.42rem 0.6rem;background:#1a2744;color:white">Tech</th>
          ${dayHeaders}
        </tr></thead>
        <tbody>${techRowsHtml}${unassignedHtml}</tbody>
      </table>
    </div>
    <p class="meta" style="margin-top:0.55rem">Click any chip to open the edit modal.</p>`;
}


// ============================================================
// JOB TEMPLATES -- ASSIGN FORM INTEGRATION
// ============================================================
async function loadTemplatesForSelect() {
  const sel = document.getElementById('a-template-select');
  if (!sel) return;
  const { data } = await db.from('job_templates').select('id,name').eq('active', true).order('name');
  const opts = (data || []).map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
  sel.innerHTML = '<option value="">-- Select to pre-fill --</option>' + opts;
}

async function applyTemplate(templateId) {
  if (!templateId) return;
  const { data: tmpl, error } = await db.from('job_templates')
    .select('*, account:accounts!job_templates_account_id_fkey(id,account_name), sub:accounts!job_templates_sub_account_id_fkey(id,account_name,sub_account_number)')
    .eq('id', templateId).single();
  if (error || !tmpl) { alert('Could not load template.'); return; }

  // Switch to existing account mode
  setAssignMode('existing');

  // Pre-fill account
  if (tmpl.account_id && tmpl.account) {
    selectAccount(tmpl.account_id, tmpl.account.account_name);
    if (tmpl.sub_account_id) {
      setTimeout(() => {
        const sub = document.getElementById('a-subaccount');
        if (sub) sub.value = tmpl.sub_account_id;
      }, 400);
    }
  }

  // Job type
  if (tmpl.job_type_id) document.getElementById('a-jobtype').value = tmpl.job_type_id;

  // Lead tech
  if (tmpl.lead_tech_id) document.getElementById('a-leadtech').value = tmpl.lead_tech_id;

  // Assigned techs
  if (tmpl.assigned_tech_ids?.length) {
    const techSel = document.getElementById('a-techs');
    if (techSel) {
      Array.from(techSel.options).forEach(o => {
        o.selected = tmpl.assigned_tech_ids.includes(o.value);
      });
    }
  }

  // Scope and site notes
  if (tmpl.scope)      document.getElementById('a-scope').value     = tmpl.scope;
  if (tmpl.site_notes) document.getElementById('a-sitenotes').value = tmpl.site_notes;

  // Reset selector
  document.getElementById('a-template-select').value = '';
}


// ============================================================
// DATE RANGE PRESETS
// ============================================================
function setRange(range) {
  const from = document.getElementById('sv-from');
  const to   = document.getElementById('sv-to');
  if (range === 'today') {
    from.value = to.value = today();
  } else if (range === 'tomorrow') {
    from.value = to.value = tomorrow();
  } else if (range === 'week') {
    from.value = weekStart();
    to.value   = weekEnd();
  } else if (range === 'month') {
    from.value = monthStart();
    to.value   = monthEnd();
  }
  loadDispatch();
}


// ============================================================
// DISPATCH BOARD (schedule list) -- grouped by date
// ============================================================
async function loadDispatch() {
  const from      = document.getElementById('sv-from').value;
  const to        = document.getElementById('sv-to').value;
  const techId    = document.getElementById('sv-tech').value;
  const jobTypeId = document.getElementById('sv-jobtype')?.value || '';
  const statusVal = document.getElementById('sv-status')?.value  || '';
  const acctQ     = (document.getElementById('sv-account')?.value || '').toLowerCase().trim();
  const el        = document.getElementById('dispatch-list');
  el.innerHTML = '<p class="meta">Loading...</p>';
  document.getElementById('stocking-panel').style.display = 'none';

  let query = db.from('jobs')
    .select(`id, job_date, status, scope, is_fixed_price, work_order_number, purchase_order_number,
             job_number, assigned_tech_ids,
             accounts!jobs_account_id_fkey(account_name, account_number, address),
             sub:accounts!jobs_sub_account_id_fkey(account_name, sub_account_number),
             job_types(id, job_type_name),
             job_line_items(item_type,item_id,quantity)`)
    .order('job_date')
    .order('created_at');

  // Server-side filters
  if (from)      query = query.gte('job_date', from);
  if (to)        query = query.lte('job_date', to);
  if (techId)    query = query.contains('assigned_tech_ids', [techId]);
  if (jobTypeId) query = query.eq('job_type_id', jobTypeId);
  if (statusVal) {
    query = query.eq('status', statusVal);
  } else {
    query = query.not('status', 'eq', 'Cancelled');
  }

  const { data: rawData, error } = await query;
  if (error) { el.innerHTML = `<div class="msg error">${error.message}</div>`; return; }

  // Client-side account text filter
  const data = acctQ
    ? (rawData || []).filter(j => (j.accounts?.account_name || '').toLowerCase().includes(acctQ))
    : (rawData || []);

  if (!data.length) {
    el.innerHTML = '<p class="meta">No jobs found for this range and filters.</p>';
    return;
  }

  // Group by date
  const byDate = {};
  data.forEach(j => {
    const d = j.job_date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(j);
  });

  const addable = ['Scheduled','In Progress','Awaiting Parts','Flagged'];

  const html = Object.keys(byDate).sort().map(dateKey => {
    const jobs = byDate[dateKey];
    const dayLabel = (() => {
      const d = new Date(dateKey + 'T12:00:00');
      const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
      return `${dow}, ${formatDate(dateKey)}`;
    })();

    const rows = jobs.map(j => {
      const ref    = jobRef(j.accounts?.account_number, j.sub?.sub_account_number, j.job_number);
      const techs  = (j.assigned_tech_ids || [])
        .map(tid => allTechs.find(t => t.id === tid)?.tech_name || '')
        .filter(Boolean).join(', ');

      return `<tr>
        <td>
          <strong style="font-size:0.88rem">${j.accounts?.account_name || ''}</strong>${j.sub?.account_name ? ' <span style="color:#5a6075;font-weight:400">/ ' + j.sub.account_name + '</span>' : ''}
          ${j.accounts?.address ? `<div style="font-size:0.76rem;color:#6b6fa8">${j.accounts.address}</div>` : ''}
          ${ref ? `<div style="font-size:0.72rem;color:#6b6fa8;font-family:monospace">${ref}</div>` : ''}
        </td>
        <td style="font-size:0.82rem">${j.job_types?.job_type_name || ''}</td>
        <td style="font-size:0.81rem;color:#5a6075">${techs}</td>
        <td style="font-size:0.81rem;white-space:nowrap">${j.work_order_number || ''}</td>
        <td><span class="status-badge status-${j.status.replace(/ /g,'-')}">${j.status}</span></td>
        <td style="max-width:220px;font-size:0.81rem;color:#3a4060">${j.scope ? j.scope.slice(0,100) + (j.scope.length > 100 ? '...' : '') : ''}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-blue btn-sm" onclick="openReopen('${j.id}')">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="printJob('${j.id}')">Print</button>
          ${addable.includes(j.status) ? `<button class="btn btn-secondary btn-sm" onclick="toggleAddDayForm('${j.id}')">+ Visit</button>` : ''}
          ${!['Approved','Pending Review'].includes(j.status) ? `<button class="btn btn-red btn-sm" onclick="deleteJob('${j.id}')">Delete</button>` : ''}
        </td>
      </tr>
      <tr id="add-day-form-${j.id}" style="display:none">
        <td colspan="7" style="background:#f8f9fc;border-bottom:2px solid #dde1ea;padding:0.75rem 0.6rem">
          <div style="font-size:0.82rem;font-weight:600;color:#1a2744;margin-bottom:0.4rem">Schedule a return visit. This keeps the existing job open and adds a new visit date.</div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-end">
            <div>
              <label style="font-size:0.79rem;font-weight:600;display:block;margin-bottom:0.2rem;color:#4a5070">Return Visit Date</label>
              <input type="date" id="add-day-date-${j.id}" value="${tomorrow()}" style="padding:0.38rem 0.55rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.84rem">
            </div>
            <div style="flex:2;min-width:180px">
              <label style="font-size:0.79rem;font-weight:600;display:block;margin-bottom:0.2rem;color:#4a5070">Notes for this visit (optional)</label>
              <input type="text" id="add-day-notes-${j.id}" placeholder="What needs to happen on this visit..." style="width:100%;padding:0.38rem 0.55rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.84rem">
            </div>
            <div style="display:flex;gap:0.3rem">
              <button class="btn btn-primary" onclick="saveAddDay('${j.id}')">Save Return Visit</button>
              <button class="btn btn-secondary" onclick="toggleAddDayForm('${j.id}')">Cancel</button>
            </div>
          </div>
          <div id="add-day-msg-${j.id}" style="font-size:0.81rem;margin-top:0.35rem"></div>
        </td>
      </tr>`;
    }).join('');

    return `
      <div style="margin-bottom:1.1rem">
        <div style="background:#1a2744;color:white;padding:0.38rem 0.75rem;border-radius:4px 4px 0 0;font-size:0.83rem;font-weight:600;display:flex;justify-content:space-between;align-items:center">
          <span>${dayLabel}</span>
          <span style="font-weight:400;opacity:0.75;font-size:0.78rem">${jobs.length} job${jobs.length !== 1 ? 's' : ''}</span>
        </div>
        <div style="overflow-x:auto;border:1px solid #dde1ea;border-top:none;border-radius:0 0 4px 4px">
          <table style="margin:0">
            <thead><tr>
              <th>Account</th><th>Type</th><th>Tech(s)</th><th>WO</th><th>Status</th><th>Scope</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = html;
  renderStockingTotals(data);
}

function renderStockingTotals(jobs) {
  const partTotals  = {};
  const laborTotals = {};
  jobs.forEach(j => {
    (j.job_line_items || []).forEach(i => {
      if (i.item_type === 'Part') {
        const name = allParts.find(p => p.id === i.item_id)?.part_name || i.item_id;
        partTotals[name] = (partTotals[name] || 0) + Number(i.quantity);
      } else if (i.item_type === 'Labor') {
        const name = allLaborTypes.find(l => l.id === i.item_id)?.labor_type_name || i.item_id;
        laborTotals[name] = (laborTotals[name] || 0) + Number(i.quantity);
      }
    });
  });
  const partEntries  = Object.entries(partTotals).sort((a, b) => a[0].localeCompare(b[0]));
  const laborEntries = Object.entries(laborTotals).sort((a, b) => a[0].localeCompare(b[0]));
  const panel = document.getElementById('stocking-panel');
  if (!partEntries.length && !laborEntries.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  document.getElementById('stocking-content').innerHTML = `
    <p style="font-size:0.82rem;color:#5a6075;margin-bottom:0.75rem">Based on expected items pre-loaded on assigned jobs.</p>
    <div style="display:flex;gap:2rem;flex-wrap:wrap">
      ${partEntries.length ? `<div style="flex:1;min-width:180px">
        <div class="section-title" style="margin-top:0">Parts Needed</div>
        <table><thead><tr><th>Part</th><th>Total Qty</th></tr></thead>
        <tbody>${partEntries.map(([n,q]) => `<tr><td>${n}</td><td><strong>${q}</strong></td></tr>`).join('')}</tbody>
        </table></div>` : ''}
      ${laborEntries.length ? `<div style="flex:1;min-width:180px">
        <div class="section-title" style="margin-top:0">Labor (hrs)</div>
        <table><thead><tr><th>Type</th><th>Total Hrs</th></tr></thead>
        <tbody>${laborEntries.map(([n,h]) => `<tr><td>${n}</td><td><strong>${h}</strong></td></tr>`).join('')}</tbody>
        </table></div>` : ''}
    </div>`;
}

async function deleteJob(id) {
  if (!confirm('Delete this job? This cannot be undone.')) return;
  await db.from('jobs').delete().eq('id', id);
  loadDispatch();
}

function toggleAddDayForm(jobId) {
  document.querySelectorAll('[id^="add-day-form-"]').forEach(el => {
    if (el.id !== `add-day-form-${jobId}`) el.style.display = 'none';
  });
  const row = document.getElementById(`add-day-form-${jobId}`);
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
}

async function saveAddDay(jobId) {
  const date  = document.getElementById(`add-day-date-${jobId}`).value;
  const notes = document.getElementById(`add-day-notes-${jobId}`).value.trim();
  const msg   = document.getElementById(`add-day-msg-${jobId}`);
  if (!date) { msg.innerHTML = '<span style="color:#a02020">Date is required.</span>'; return; }

  const { count } = await db.from('job_visits').select('id', { count: 'exact', head: true }).eq('job_id', jobId);
  await db.from('job_visits').insert({
    job_id: jobId, visit_number: (count || 0) + 1,
    visit_date: date, tech_notes: notes || null
  });
  const { data: job } = await db.from('jobs').select('status').eq('id', jobId).single();
  if (job && job.status !== 'Scheduled') {
    await db.from('jobs').update({ status: 'Scheduled', updated_at: new Date().toISOString() }).eq('id', jobId);
  }
  msg.innerHTML = '<span style="color:#2a7a4a;font-weight:600">Return visit added.</span>';
  setTimeout(() => { toggleAddDayForm(jobId); loadDispatch(); }, 800);
}


// ============================================================
// ASSIGN JOB
// ============================================================
function setAssignMode(mode) {
  const isExisting = mode === 'existing';
  document.getElementById('a-existing-account-fields').style.display = isExisting ? '' : 'none';
  document.getElementById('a-new-customer-fields').style.display     = isExisting ? 'none' : '';
  document.getElementById('a-mode-existing').className = isExisting ? 'active' : '';
  document.getElementById('a-mode-new').className      = isExisting ? '' : 'active';
  if (!isExisting) {
    document.getElementById('a-account').value    = '';
    document.getElementById('a-account-id').value = '';
    document.getElementById('a-contact-panel').style.display = 'none';
    document.getElementById('a-address-panel').style.display = 'none';
    populateSelect('a-subaccount', [], 'id', 'account_name', '-- None --');
  }
}

function toggleFixed() {
  const wrap = document.getElementById('a-quotewrap');
  wrap.style.display = document.getElementById('a-fixedprice').checked ? 'flex' : 'none';
}

// Account typeahead
function searchAccountTypeahead() {
  const input   = document.getElementById('a-account');
  const results = document.getElementById('a-account-results');
  const q = input.value.toLowerCase().trim();
  if (!q) {
    results.style.display = 'none';
    document.getElementById('a-account-id').value = '';
    document.getElementById('a-contact-panel').style.display  = 'none';
    document.getElementById('a-address-panel').style.display  = 'none';
    populateSelect('a-subaccount', [], 'id', 'account_name', '-- None --');
    return;
  }
  const masters = allAccounts.filter(a => !a.parent_account_id && a.account_name.toLowerCase().includes(q)).slice(0, 12);
  if (!masters.length) { results.style.display = 'none'; return; }
  results.innerHTML = masters.map(a =>
    `<div data-id="${a.id}" data-name="${escHtml(a.account_name)}">${a.account_name}</div>`
  ).join('');
  results.style.display = 'block';
  results.querySelectorAll('div').forEach(div => {
    div.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      selectAccount(div.dataset.id, div.dataset.name);
    });
  });
}

function selectAccount(id, name) {
  document.getElementById('a-account').value    = name;
  document.getElementById('a-account-id').value = id;
  document.getElementById('a-account-results').style.display = 'none';
  // Populate sub-accounts
  const subs = allAccounts.filter(a => a.parent_account_id === id);
  populateSelect('a-subaccount', subs, 'id', 'account_name', '-- None --');
  loadAssignAccountContact(id);
}

async function loadAssignAccountContact(accountId) {
  const acct       = allAccounts.find(a => a.id === accountId);
  const addrPanel  = document.getElementById('a-address-panel');
  const addrDisp   = document.getElementById('a-address-display');
  const ctPanel    = document.getElementById('a-contact-panel');
  const ctBanner   = document.getElementById('a-contact-banner');

  // Address block
  addrDisp.textContent = acct?.address || 'No address on file.';
  addrPanel.style.display = '';

  // Contacts
  const { data: contacts } = await db.from('account_contacts')
    .select('*').eq('account_id', accountId).eq('active', true)
    .order('is_primary', { ascending: false });
  currentAccountContacts = contacts || [];

  if (!currentAccountContacts.length) {
    ctBanner.innerHTML = '<em style="color:#888">No contacts on file for this account.</em>';
    ctPanel.style.display = '';
    return;
  }

  const primary   = currentAccountContacts.find(c => c.is_primary) || currentAccountContacts[0];
  const secondary = currentAccountContacts.find(c => c.is_secondary && !c.is_primary);

  let html = `<strong>${primary.contact_name}</strong>`;
  if (primary.title)      html += ` | ${primary.title}`;
  if (primary.company)    html += ` | ${primary.company}`;
  html += '<br>';
  if (primary.work_phone) html += `Work: ${primary.work_phone} &nbsp;`;
  if (primary.cell_phone) html += `Cell: ${primary.cell_phone} &nbsp;`;
  if (primary.email)      html += primary.email;
  if (primary.notes)      html += `<br><em style="color:#555;font-size:0.82rem">${primary.notes}</em>`;
  if (secondary) {
    html += `<br><span style="font-size:0.81rem;color:#446">Secondary: ${secondary.contact_name}`;
    if (secondary.work_phone) html += ` | ${secondary.work_phone}`;
    if (secondary.cell_phone) html += ` / ${secondary.cell_phone}`;
    html += '</span>';
  }
  ctBanner.innerHTML = html;
  ctPanel.style.display = '';
  document.getElementById('a-contact-edit').style.display = 'none';
  contactEditMode = false;
}

function toggleContactEdit() {
  contactEditMode = !contactEditMode;
  const editDiv = document.getElementById('a-contact-edit');
  editDiv.style.display = contactEditMode ? '' : 'none';
  const warn = document.getElementById('a-contact-warn');
  warn.style.display = contactEditMode ? '' : 'none';
  if (contactEditMode) {
    const primary = currentAccountContacts.find(c => c.is_primary) || currentAccountContacts[0] || {};
    document.getElementById('ac-name').value      = primary.contact_name || '';
    document.getElementById('ac-title').value     = primary.title        || '';
    document.getElementById('ac-workphone').value = primary.work_phone   || '';
    document.getElementById('ac-cellphone').value = primary.cell_phone   || '';
    document.getElementById('ac-email').value     = primary.email        || '';
    document.getElementById('ac-company').value   = primary.company      || '';
    document.getElementById('ac-notes').value     = primary.notes        || '';
  }
}

// Parts search on assign form
function searchAssignParts() {
  const q   = document.getElementById('a-partsearch').value.toLowerCase();
  const res = document.getElementById('a-parts-results');
  if (q.length < 2) { res.style.display = 'none'; return; }
  const matches = allParts.filter(p => p.part_name.toLowerCase().includes(q)).slice(0, 10);
  if (!matches.length) { res.style.display = 'none'; return; }
  res.innerHTML = matches.map(p =>
    `<div data-id="${p.id}" data-name="${escHtml(p.part_name)}">${p.part_name}${p.category ? ' | ' + p.category : ''}</div>`
  ).join('');
  res.style.display = 'block';
  res.querySelectorAll('div').forEach(div => {
    div.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      addAssignPart(div.dataset.id, div.dataset.name);
    });
  });
}

function addAssignPart(id, name) {
  const ex = assignParts.find(p => p.id === id);
  if (ex) ex.qty += 1; else assignParts.push({ id, name, qty: 1 });
  renderAssignParts();
  document.getElementById('a-parts-results').style.display = 'none';
  document.getElementById('a-partsearch').value = '';
}

function removeAssignPart(idx) { assignParts.splice(idx, 1); renderAssignParts(); }

function renderAssignParts() {
  document.querySelector('#a-parts-table tbody').innerHTML =
    assignParts.map((p, i) => `<tr>
      <td>${p.name}</td>
      <td><input type="number" min="0.1" step="0.1" value="${p.qty}" style="width:62px;padding:0.22rem;border:1px solid #c8cdd8;border-radius:3px"
          onchange="assignParts[${i}].qty=parseFloat(this.value)||1"></td>
      <td><button onclick="removeAssignPart(${i})" style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700">X</button></td>
    </tr>`).join('') || '<tr><td colspan="3" style="color:#aaa;font-style:italic;font-size:0.82rem">None</td></tr>';
}

function addAssignLabor() {
  const id    = document.getElementById('a-labortype').value;
  const hours = parseFloat(document.getElementById('a-laborhours').value);
  if (!id || isNaN(hours) || hours <= 0) return;
  const lt = allLaborTypes.find(l => l.id === id);
  const ex = assignLabor.find(l => l.id === id);
  if (ex) ex.hours = hours; else assignLabor.push({ id, name: lt.labor_type_name, hours });
  renderAssignLabor();
  document.getElementById('a-laborhours').value = '';
}

function removeAssignLabor(idx) { assignLabor.splice(idx, 1); renderAssignLabor(); }

function renderAssignLabor() {
  document.querySelector('#a-labor-table tbody').innerHTML =
    assignLabor.map((l, i) => `<tr>
      <td>${l.name}</td>
      <td>${l.hours} hr</td>
      <td><button onclick="removeAssignLabor(${i})" style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700">X</button></td>
    </tr>`).join('') || '<tr><td colspan="3" style="color:#aaa;font-style:italic;font-size:0.82rem">None</td></tr>';
}

function addAssignCharge() {
  const type = document.getElementById('a-chargetype').value;
  const desc = document.getElementById('a-chargedesc').value.trim();
  const amt  = parseFloat(document.getElementById('a-chargeamt').value);
  if (isNaN(amt) || amt < 0) return;
  assignCharges.push({ type, description: desc, amount: amt });
  renderAssignCharges();
  document.getElementById('a-chargedesc').value = '';
  document.getElementById('a-chargeamt').value  = '';
}

function removeAssignCharge(idx) { assignCharges.splice(idx, 1); renderAssignCharges(); }

function renderAssignCharges() {
  document.querySelector('#a-charges-table tbody').innerHTML =
    assignCharges.map((c, i) => `<tr>
      <td>${c.type}</td><td>${c.description}</td><td>$${Number(c.amount).toFixed(2)}</td>
      <td><button onclick="removeAssignCharge(${i})" style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700">X</button></td>
    </tr>`).join('') || '<tr><td colspan="4" style="color:#aaa;font-style:italic;font-size:0.82rem">None</td></tr>';
}

async function assignJob() {
  const msg    = document.getElementById('a-msg');
  const date   = document.getElementById('a-date').value;
  const isNew  = document.getElementById('a-mode-new').classList.contains('active');
  let accountId = null;
  msg.innerHTML = '';

  if (!date) {
    msg.innerHTML = '<div class="msg error">Date is required.</div>';
    return;
  }

  if (isNew) {
    const ncName = document.getElementById('a-nc-name').value.trim();
    if (!ncName) {
      msg.innerHTML = '<div class="msg error">Customer name is required.</div>';
      return;
    }
    // Write as pending account -- correct model, no new_customers table
    const { data: newAcct, error: acctErr } = await db.from('accounts').insert({
      account_name:  ncName,
      address:       document.getElementById('a-nc-address').value.trim() || null,
      phone:         document.getElementById('a-nc-phone').value.trim()   || null,
      billing_notes: document.getElementById('a-nc-notes').value.trim()   || null,
      status:        'pending',
      submitted_by:  currentUser.id,
      submitted_at:  new Date().toISOString(),
      active:        false
    }).select('id,account_name,parent_account_id,address,phone,active,status').single();
    if (acctErr) { msg.innerHTML = `<div class="msg error">${acctErr.message}</div>`; return; }
    accountId = newAcct.id;
    allAccounts.push(newAcct);
  } else {
    accountId = document.getElementById('a-account-id').value;
    if (!accountId) {
      msg.innerHTML = '<div class="msg error">Account is required.</div>';
      return;
    }
  }

  const techIds = Array.from(document.getElementById('a-techs').selectedOptions).map(o => o.value);

  const payload = {
    job_date:              date,
    account_id:            accountId || null,
    sub_account_id:        document.getElementById('a-subaccount').value   || null,
    job_type_id:           document.getElementById('a-jobtype').value       || null,
    assigned_tech_ids:     techIds,
    lead_tech_id:          document.getElementById('a-leadtech').value      || null,
    status:                document.getElementById('a-status').value,
    scope:                 document.getElementById('a-scope').value.trim()     || null,
    site_notes:            document.getElementById('a-sitenotes').value.trim() || null,
    work_order_number:     document.getElementById('a-wo').value.trim()        || null,
    purchase_order_number: document.getElementById('a-po').value.trim()        || null,
    job_address:           document.getElementById('a-job-address').value.trim() || null,
    is_fixed_price:        document.getElementById('a-fixedprice').checked,
    quote_amount:          document.getElementById('a-fixedprice').checked
                             ? (parseFloat(document.getElementById('a-quoteamount').value) || null) : null,
    created_by: currentUser.id
  };

  const { data: job, error } = await db.from('jobs').insert(payload).select().single();
  if (error) { msg.innerHTML = `<div class="msg error">${error.message}</div>`; return; }

  lastJob = payload;

  // Create a visit record for the job date
  await db.from('job_visits').insert({
    job_id: job.id, visit_number: 1, visit_date: date
  });

  const lineItems = [
    ...assignParts.map(p => ({
      job_id: job.id, item_type: 'Part', item_id: p.id,
      quantity: p.qty, unit_cost: allParts.find(x => x.id === p.id)?.unit_cost || 0
    })),
    ...assignLabor.map(l => ({
      job_id: job.id, item_type: 'Labor', item_id: l.id,
      quantity: l.hours, unit_cost: allLaborTypes.find(x => x.id === l.id)?.hourly_rate || 0
    })),
    ...assignCharges.map(c => ({
      job_id: job.id, item_type: c.type,
      item_id: '00000000-0000-0000-0000-000000000000',
      quantity: 1, unit_cost: c.amount, override_reason: c.description
    }))
  ];
  if (lineItems.length) await db.from('job_line_items').insert(lineItems);

  msg.innerHTML = `<div class="msg success">Job assigned. <button class="btn btn-secondary btn-sm" style="margin-left:0.4rem" onclick="printJob('${job.id}')">Print Summary</button></div>`;
  resetAssignForm();
}

function resetAssignForm() {
  ['a-scope','a-sitenotes','a-wo','a-po','a-job-address',
   'a-nc-name','a-nc-address','a-nc-phone','a-nc-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('a-fixedprice').checked = false;
  document.getElementById('a-quotewrap').style.display = 'none';
  document.getElementById('a-contact-panel').style.display = 'none';
  document.getElementById('a-contact-edit').style.display  = 'none';
  document.getElementById('a-address-panel').style.display = 'none';
  document.getElementById('a-account').value    = '';
  document.getElementById('a-account-id').value = '';
  assignParts = []; assignLabor = []; assignCharges = [];
  renderAssignParts(); renderAssignLabor(); renderAssignCharges();
}

async function duplicateLast() {
  if (!lastJob) { alert('No job assigned this session to duplicate.'); return; }
  const acct = allAccounts.find(a => a.id === lastJob.account_id);
  if (acct) { selectAccount(acct.id, acct.account_name); }
  document.getElementById('a-jobtype').value  = lastJob.job_type_id  || '';
  document.getElementById('a-leadtech').value = lastJob.lead_tech_id || '';
  document.getElementById('a-date').value     = today();
  document.getElementById('a-msg').innerHTML  = '<div class="msg success">Last job duplicated. Review and assign.</div>';
}


// ============================================================
// REOPEN / EDIT MODAL (shared with review)
// ============================================================
async function openReopen(jobId) {
  reopenJobId = jobId;
  reopenParts = []; reopenLabor = []; reopenCharges = []; reopenVisits = []; reopenCompId = null;

  try {
    const [{ data: job, error: jobErr }, { data: visits }, { data: contacts }] = await Promise.all([
      db.from('jobs')
        .select(`*, accounts!jobs_account_id_fkey(account_name, address, phone),
                 sub:accounts!jobs_sub_account_id_fkey(account_name),
                 job_types(job_type_name),
                 job_completions(*), job_line_items(*)`)
        .eq('id', jobId).single(),
      db.from('job_visits').select('*').eq('job_id', jobId).order('visit_number'),
      // Fetch all active contacts and filter client-side by account_id.
      // Small dataset (few dozen contacts max) -- acceptable at this scale.
      db.from('account_contacts').select('*')
        .eq('active', true)
        .order('is_primary', { ascending: false })
    ]);
    if (jobErr) throw jobErr;
    reopenVisits = visits || [];

    const comp     = job.job_completions?.[0] || {};
    reopenCompId   = comp.id || null;
    const laborOpts = allLaborTypes.map(l => `<option value="${l.id}">${l.labor_type_name}</option>`).join('');
    const statusOpts = ['Scheduled','Quoted','Awaiting Parts','Pending Review','Flagged','Approved','Cancelled','In Progress']
      .map(s => `<option value="${s}" ${s === job.status ? 'selected' : ''}>${s}</option>`).join('');

    (job.job_line_items || []).forEach(i => {
      if (i.item_type === 'Part') {
        const p = allParts.find(x => x.id === i.item_id);
        if (p) reopenParts.push({ id: p.id, name: p.part_name, qty: i.quantity, lineItemId: i.id });
      } else if (i.item_type === 'Labor') {
        const l = allLaborTypes.find(x => x.id === i.item_id);
        if (l) reopenLabor.push({ id: l.id, name: l.labor_type_name, hours: i.quantity, lineItemId: i.id });
      } else {
        reopenCharges.push({ type: i.item_type, description: i.override_reason || '', amount: i.unit_cost, lineItemId: i.id });
      }
    });

    // Build contact banner for this account
    const jobAcctId = job.account_id;
    const acctContacts = (contacts || []).filter(c => c.account_id === jobAcctId);
    const primary = acctContacts.find(c => c.is_primary) || acctContacts[0];
    const secondary = acctContacts.find(c => c.is_secondary && !c.is_primary);
    let contactHtml = '';
    if (primary) {
      contactHtml = `<strong>${primary.contact_name}</strong>`;
      if (primary.title)      contactHtml += ` | ${primary.title}`;
      contactHtml += '<br>';
      if (primary.work_phone) contactHtml += `Work: ${primary.work_phone} &nbsp;`;
      if (primary.cell_phone) contactHtml += `Cell: ${primary.cell_phone} &nbsp;`;
      if (primary.email)      contactHtml += primary.email;
      if (secondary) {
        contactHtml += `<br><span style="font-size:0.8rem;color:#446">Secondary: ${secondary.contact_name}`;
        if (secondary.work_phone) contactHtml += ` | ${secondary.work_phone}`;
        if (secondary.cell_phone) contactHtml += ` / ${secondary.cell_phone}`;
        contactHtml += '</span>';
      }
    }
    const siteAddress = job.job_address || job.accounts?.address || '';
    const subAccounts = (allAccounts || []).filter(a => a.parent_account_id === job.account_id);
    const techCheckboxes = (allTechs || []).filter(t => t.active).map(t =>
      `<label style="display:flex;align-items:center;gap:0.3rem;font-weight:normal;font-size:0.88rem">
         <input type="checkbox" name="ro-tech" value="${t.id}" ${(job.assigned_tech_ids||[]).includes(t.id) ? 'checked' : ''}> ${escHtml(t.tech_name)}
       </label>`).join('');
    const leadTechOpts = (allTechs || []).filter(t => t.active).map(t =>
      `<option value="${t.id}" ${t.id === job.lead_tech_id ? 'selected' : ''}>${escHtml(t.tech_name)}</option>`).join('');

    document.getElementById('reopen-content').innerHTML = `
      <h3 style="margin:0 0 0.1rem;color:#1a2744">${job.accounts?.account_name || ''}${job.sub?.account_name ? ' / ' + job.sub.account_name : ''}</h3>
      <div class="meta">${formatDate(job.job_date)} | ${job.job_types?.job_type_name || ''}</div>
      ${siteAddress ? `<div style="font-size:0.81rem;color:#5a6075;margin:0.1rem 0 0.3rem">${siteAddress}</div>` : ''}
      ${contactHtml ? `<div class="contact-banner" style="margin:0.4rem 0 0.6rem;font-size:0.83rem">${contactHtml}</div>` : ''}

      <div class="form-row" style="margin-top:0.5rem"><label>Status</label><select id="ro-status">${statusOpts}</select></div>
      <div class="two-col">
        <div class="form-row"><label>Job Date</label><input type="date" id="ro-date" value="${job.job_date || ''}"></div>
        <div class="form-row"><label>Sub-Account</label>
          <select id="ro-subaccount">
            <option value="">-- None --</option>
            ${subAccounts.map(s => `<option value="${s.id}" ${s.id === job.sub_account_id ? 'selected' : ''}>${escHtml(s.account_name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row"><label>Assigned Techs</label>
        <div style="display:flex;flex-wrap:wrap;gap:0.55rem;margin-top:0.2rem">${techCheckboxes}</div>
      </div>
      <div class="form-row"><label>Lead Tech</label>
        <select id="ro-leadtech"><option value="">-- None --</option>${leadTechOpts}</select>
      </div>
      <div class="two-col">
        <div class="form-row"><label>Work Order No.</label><input type="text" id="ro-wo" value="${escHtml(job.work_order_number||'')}"></div>
        <div class="form-row"><label>Purchase Order No.</label><input type="text" id="ro-po" value="${escHtml(job.purchase_order_number||'')}"></div>
      </div>
      <div class="form-row"><label>Scope</label><textarea id="ro-scope">${escHtml(job.scope||'')}</textarea></div>
      <div class="form-row"><label>Site Notes</label><textarea id="ro-sitenotes">${escHtml(job.site_notes||'')}</textarea></div>

      <div class="section-title">Completion Details</div>
      <div class="two-col">
        <div class="form-row"><label>Time In</label><input type="datetime-local" id="ro-timein" value="${comp.time_in ? comp.time_in.slice(0,16) : ''}"></div>
        <div class="form-row"><label>Time Out</label><input type="datetime-local" id="ro-timeout" value="${comp.time_out ? comp.time_out.slice(0,16) : ''}"></div>
      </div>
      <div class="two-col">
        <div class="form-row"><label>Payment Type</label>
          <select id="ro-paytype"><option value="">-- Select --</option>
            ${['Cash','Check','Card','Invoice'].map(p => `<option ${p === comp.payment_type ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Payment Detail</label><input type="text" id="ro-paydetail" value="${escHtml(comp.payment_detail||'')}"></div>
      </div>
      <div class="form-row"><label>Tech Notes</label><textarea id="ro-technotes">${escHtml(comp.tech_notes||'')}</textarea></div>
      <div class="form-row"><label><input type="checkbox" id="ro-followup" ${comp.follow_up_flag ? 'checked' : ''}> Follow-up Flag</label></div>

      <div class="section-title">Visit Times</div>
      ${reopenVisits.length ? reopenVisits.map(v => `
        <div style="background:#f8f9fc;border:1px solid #eef0f6;border-radius:4px;padding:0.55rem;margin-bottom:0.4rem">
          <div style="font-size:0.82rem;font-weight:600;margin-bottom:0.35rem;color:#1a2744">Visit ${v.visit_number} (${formatDate(v.visit_date)})</div>
          <div class="two-col">
            <div class="form-row"><label>Clock In</label>
              <input type="datetime-local" id="vi-cin-${v.id}" value="${v.clocked_in_at ? v.clocked_in_at.slice(0,16) : ''}">
            </div>
            <div class="form-row"><label>Clock Out</label>
              <input type="datetime-local" id="vi-cout-${v.id}" value="${v.clocked_out_at ? v.clocked_out_at.slice(0,16) : ''}">
            </div>
          </div>
        </div>`).join('') : '<p class="meta">No visit records.</p>'}

      <div class="section-title">Parts</div>
      <div class="parts-search-wrap">
        <input type="text" id="ro-partsearch" placeholder="Search parts..." oninput="searchReopenParts()" autocomplete="off">
        <div class="parts-results" id="ro-parts-results"></div>
      </div>
      <table id="ro-parts-table"><thead><tr><th>Part</th><th>Qty</th><th></th></tr></thead><tbody></tbody></table>

      <div class="section-title">Labor</div>
      <div style="display:flex;gap:0.4rem;margin-bottom:0.45rem;flex-wrap:wrap">
        <select id="ro-labortype" style="flex:2;padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px">
          <option value="">-- Type --</option>${laborOpts}
        </select>
        <input type="number" id="ro-laborhours" placeholder="Hours" style="width:75px;padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px">
        <button class="btn btn-secondary" onclick="addReopenLabor()">Add</button>
      </div>
      <table id="ro-labor-table"><thead><tr><th>Type</th><th>Hours</th><th></th></tr></thead><tbody></tbody></table>

      <div class="section-title">Additional Charges</div>
      <div style="display:flex;gap:0.4rem;margin-bottom:0.45rem;flex-wrap:wrap;align-items:flex-end">
        <select id="ro-chargetype" style="padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px">
          <option value="Service Call">Service Call</option>
          <option value="Other">Other</option>
        </select>
        <input type="text" id="ro-chargedesc" placeholder="Description" style="flex:2;padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px">
        <input type="number" id="ro-chargeamt" placeholder="$" step="0.01" style="width:82px;padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px">
        <button class="btn btn-secondary" onclick="addReopenCharge()">Add</button>
      </div>
      <table id="ro-charges-table"><thead><tr><th>Type</th><th>Description</th><th>Amount</th><th></th></tr></thead><tbody></tbody></table>

      <div id="ro-msg" style="margin-top:0.55rem"></div>
      <div style="margin-top:0.9rem;display:flex;gap:0.4rem">
        <button class="btn btn-primary" onclick="saveReopen()">Save Changes</button>
        <button class="btn btn-secondary" onclick="closeReopenModal()">Cancel</button>
      </div>`;

    renderReopenParts(); renderReopenLabor(); renderReopenCharges();
    document.getElementById('reopen-modal').style.display = '';
  } catch (err) {
    alert('Error loading job: ' + (err.message || JSON.stringify(err)));
    console.error('openReopen error:', err);
  }
}

function closeReopenModal() { document.getElementById('reopen-modal').style.display = 'none'; }

function searchReopenParts() {
  const q   = document.getElementById('ro-partsearch').value.toLowerCase();
  const res = document.getElementById('ro-parts-results');
  if (q.length < 2) { res.style.display = 'none'; return; }
  const matches = allParts.filter(p => p.part_name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { res.style.display = 'none'; return; }
  res.innerHTML = matches.map(p =>
    `<div data-id="${p.id}" data-name="${escHtml(p.part_name)}">${p.part_name}${p.category ? ' | '+p.category : ''}</div>`
  ).join('');
  res.style.display = 'block';
  res.querySelectorAll('div').forEach(div => {
    div.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); addReopenPart(div.dataset.id, div.dataset.name); });
  });
}

function addReopenPart(id, name) {
  const ex = reopenParts.find(p => p.id === id);
  if (ex) ex.qty += 1; else reopenParts.push({ id, name, qty: 1 });
  renderReopenParts();
  document.getElementById('ro-parts-results').style.display = 'none';
  document.getElementById('ro-partsearch').value = '';
}
function removeReopenPart(idx) { reopenParts.splice(idx, 1); renderReopenParts(); }
function renderReopenParts() {
  document.querySelector('#ro-parts-table tbody').innerHTML = reopenParts.map((p, i) =>
    `<tr><td>${p.name}</td>
     <td><input type="number" min="0.1" step="0.1" value="${p.qty}" style="width:62px;padding:0.22rem;border:1px solid #c8cdd8;border-radius:3px" onchange="reopenParts[${i}].qty=parseFloat(this.value)||1"></td>
     <td><button onclick="removeReopenPart(${i})" style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700">X</button></td></tr>`
  ).join('') || '<tr><td colspan="3" style="color:#aaa;font-style:italic;font-size:0.82rem">None</td></tr>';
}
function addReopenLabor() {
  const id = document.getElementById('ro-labortype').value;
  const hours = parseFloat(document.getElementById('ro-laborhours').value);
  if (!id || isNaN(hours)) return;
  const lt = allLaborTypes.find(l => l.id === id);
  reopenLabor.push({ id, name: lt.labor_type_name, hours });
  renderReopenLabor();
  document.getElementById('ro-laborhours').value = '';
}
function removeReopenLabor(idx) { reopenLabor.splice(idx, 1); renderReopenLabor(); }
function renderReopenLabor() {
  document.querySelector('#ro-labor-table tbody').innerHTML = reopenLabor.map((l, i) =>
    `<tr><td>${l.name}</td><td>${l.hours} hr</td>
     <td><button onclick="removeReopenLabor(${i})" style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700">X</button></td></tr>`
  ).join('') || '<tr><td colspan="3" style="color:#aaa;font-style:italic;font-size:0.82rem">None</td></tr>';
}
function addReopenCharge() {
  const type = document.getElementById('ro-chargetype').value;
  const desc = document.getElementById('ro-chargedesc').value.trim();
  const amt  = parseFloat(document.getElementById('ro-chargeamt').value);
  if (isNaN(amt) || amt < 0) return;
  reopenCharges.push({ type, description: desc, amount: amt });
  renderReopenCharges();
  document.getElementById('ro-chargedesc').value = '';
  document.getElementById('ro-chargeamt').value  = '';
}
function removeReopenCharge(idx) { reopenCharges.splice(idx, 1); renderReopenCharges(); }
function renderReopenCharges() {
  document.querySelector('#ro-charges-table tbody').innerHTML = reopenCharges.map((c, i) =>
    `<tr><td>${c.type}</td><td>${c.description}</td><td>$${Number(c.amount).toFixed(2)}</td>
     <td><button onclick="removeReopenCharge(${i})" style="border:none;background:none;cursor:pointer;color:#a02020;font-weight:700">X</button></td></tr>`
  ).join('') || '<tr><td colspan="4" style="color:#aaa;font-style:italic;font-size:0.82rem">None</td></tr>';
}

async function saveReopen() {
  const msg = document.getElementById('ro-msg');
  msg.innerHTML = '';

  const assignedTechIds = [...document.querySelectorAll('input[name="ro-tech"]:checked')].map(cb => cb.value);
  await db.from('jobs').update({
    status:                document.getElementById('ro-status').value,
    job_date:              document.getElementById('ro-date')?.value              || null,
    sub_account_id:        document.getElementById('ro-subaccount')?.value        || null,
    assigned_tech_ids:     assignedTechIds,
    lead_tech_id:          document.getElementById('ro-leadtech')?.value          || null,
    scope:                 document.getElementById('ro-scope').value.trim()       || null,
    site_notes:            document.getElementById('ro-sitenotes').value.trim()   || null,
    work_order_number:     document.getElementById('ro-wo').value.trim()          || null,
    purchase_order_number: document.getElementById('ro-po').value.trim()          || null,
    updated_at: new Date().toISOString()
  }).eq('id', reopenJobId);

  const compPayload = {
    job_id:         reopenJobId,
    time_in:        document.getElementById('ro-timein').value    || null,
    time_out:       document.getElementById('ro-timeout').value   || null,
    payment_type:   document.getElementById('ro-paytype').value   || null,
    payment_detail: document.getElementById('ro-paydetail').value || null,
    tech_notes:     document.getElementById('ro-technotes').value || null,
    follow_up_flag: document.getElementById('ro-followup').checked,
    last_edited_by: currentUser.id,
    last_edited_at: new Date().toISOString()
  };
  if (reopenCompId) {
    await db.from('job_completions').update(compPayload).eq('id', reopenCompId);
  } else {
    compPayload.submitted_by = currentUser.id;
    await db.from('job_completions').insert(compPayload);
  }

  // Replace line items
  await db.from('job_line_items').delete().eq('job_id', reopenJobId);
  const lineItems = [
    ...reopenParts.map(p  => ({ job_id: reopenJobId, item_type: 'Part',  item_id: p.id, quantity: p.qty,   unit_cost: allParts.find(x => x.id === p.id)?.unit_cost || 0 })),
    ...reopenLabor.map(l  => ({ job_id: reopenJobId, item_type: 'Labor', item_id: l.id, quantity: l.hours, unit_cost: allLaborTypes.find(x => x.id === l.id)?.hourly_rate || 0 })),
    ...reopenCharges.map(c => ({ job_id: reopenJobId, item_type: c.type, item_id: '00000000-0000-0000-0000-000000000000', quantity: 1, unit_cost: c.amount, override_reason: c.description }))
  ];
  if (lineItems.length) await db.from('job_line_items').insert(lineItems);

  // Update visit clock times
  for (const v of reopenVisits) {
    await db.from('job_visits').update({
      clocked_in_at:  document.getElementById(`vi-cin-${v.id}`)?.value  || null,
      clocked_out_at: document.getElementById(`vi-cout-${v.id}`)?.value || null
    }).eq('id', v.id);
  }

  msg.innerHTML = '<div class="msg success">Job updated.</div>';
  setTimeout(() => {
    closeReopenModal();
    // Refresh whichever view is active
    const hash = window.location.hash.slice(1);
    if (hash === 'review') loadReview();
    else loadDispatch();
  }, 900);
}
