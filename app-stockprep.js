// app-stockprep.js -- Stock Prep
// Aggregates expected parts and labor from scheduled/in-progress jobs
// in a user-selected date range.  No pricing shown (tech view rule applies globally).

let spPeriod     = 'week';
let spCustomFrom = '';
let spCustomTo   = '';

// ============================================================
// ENTRY POINT
// ============================================================
async function loadStockPrep() {
  const sec = document.getElementById('section-stockprep');
  if (!sec) return;

  sec.innerHTML = `
    <!-- Period toggle -->
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-bottom:1.1rem">
      <div class="toggle-pair" style="margin-bottom:0">
        <button id="sp-today" onclick="setSpPeriod('today')">Today</button>
        <button id="sp-week"  onclick="setSpPeriod('week')">This Week</button>
        <button id="sp-month" onclick="setSpPeriod('month')">This Month</button>
        <button id="sp-custom" onclick="setSpPeriod('custom')">Custom</button>
      </div>
      <div id="sp-custom-range" style="display:none;gap:0.3rem;align-items:center">
        <input type="date" id="sp-from" style="padding:0.3rem 0.5rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.83rem">
        <span style="color:#5a6075;font-size:0.82rem">to</span>
        <input type="date" id="sp-to"   style="padding:0.3rem 0.5rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.83rem">
        <button class="btn btn-primary" style="padding:0.3rem 0.7rem;font-size:0.82rem" onclick="applyCustomSp()">Go</button>
      </div>
      <span id="sp-period-label" style="font-size:0.82rem;color:#5a6075;margin-left:0.2rem"></span>
      <button class="btn btn-secondary" style="margin-left:auto;padding:0.28rem 0.7rem;font-size:0.81rem" onclick="refreshStockPrep()">Refresh</button>
    </div>

    <div id="sp-content"><p class="meta">Loading...</p></div>
  `;

  highlightSpPeriod();
  await refreshStockPrep();
}

// ============================================================
// PERIOD MANAGEMENT
// ============================================================
function setSpPeriod(period) {
  spPeriod = period;
  const customRange = document.getElementById('sp-custom-range');
  if (customRange) customRange.style.display = period === 'custom' ? 'flex' : 'none';
  highlightSpPeriod();
  if (period !== 'custom') refreshStockPrep();
}

function applyCustomSp() {
  spCustomFrom = document.getElementById('sp-from')?.value || '';
  spCustomTo   = document.getElementById('sp-to')?.value   || '';
  if (!spCustomFrom || !spCustomTo) return;
  refreshStockPrep();
}

function highlightSpPeriod() {
  ['today','week','month','custom'].forEach(p => {
    const btn = document.getElementById(`sp-${p}`);
    if (btn) btn.className = p === spPeriod ? 'active' : '';
  });
}

function spDateRange() {
  if (spPeriod === 'today')  return { from: today(),      to: today() };
  if (spPeriod === 'week')   return { from: weekStart(),  to: weekEnd() };
  if (spPeriod === 'month')  return { from: monthStart(), to: monthEnd() };
  if (spPeriod === 'custom') return { from: spCustomFrom, to: spCustomTo };
  return { from: weekStart(), to: weekEnd() };
}

function spPeriodLabel() {
  const { from, to } = spDateRange();
  if (!from || !to) return '';
  return from === to ? formatDate(from) : `${formatDate(from)} - ${formatDate(to)}`;
}

// ============================================================
// DATA REFRESH
// ============================================================
async function refreshStockPrep() {
  const content = document.getElementById('sp-content');
  const labelEl = document.getElementById('sp-period-label');
  if (!content) return;
  content.innerHTML = '<p class="meta">Loading...</p>';
  if (labelEl) labelEl.textContent = spPeriodLabel();

  const { from, to } = spDateRange();
  if (!from || !to) return;

  const { data, error } = await db.from('jobs')
    .select(`id, job_date, status,
             accounts!jobs_account_id_fkey(account_name),
             lead_tech:techs!jobs_lead_tech_id_fkey(tech_name),
             job_line_items(item_type, item_id, quantity)`)
    .in('status', ['Scheduled', 'In Progress', 'Awaiting Parts'])
    .gte('job_date', from)
    .lte('job_date', to)
    .order('job_date', { ascending: true });

  if (error) {
    content.innerHTML = `<div class="msg error">${error.message}</div>`;
    return;
  }

  const jobs = data || [];
  if (!jobs.length) {
    content.innerHTML = '<p class="meta">No scheduled jobs in this range.</p>';
    return;
  }

  // Aggregate parts
  const partTotals = {};    // part_id -> { name, unit, total_qty }
  const laborTotals = {};   // labor_id -> { name, total_hours }

  jobs.forEach(j => {
    (j.job_line_items || []).forEach(i => {
      if (i.item_type === 'Part' && i.item_id) {
        if (!partTotals[i.item_id]) {
          const p = allParts.find(x => x.id === i.item_id);
          partTotals[i.item_id] = {
            name:      p?.part_name  || '(unknown)',
            unit:      p?.unit       || '',
            category:  p?.category   || '',
            stock_qty: p?.stock_qty  || 0,
            total_qty: 0
          };
        }
        partTotals[i.item_id].total_qty += Number(i.quantity) || 0;
      }
      if (i.item_type === 'Labor' && i.item_id) {
        if (!laborTotals[i.item_id]) {
          const l = allLaborTypes.find(x => x.id === i.item_id);
          laborTotals[i.item_id] = {
            name:        l?.labor_type_name || '(unknown)',
            total_hours: 0
          };
        }
        laborTotals[i.item_id].total_hours += Number(i.quantity) || 0;
      }
    });
  });

  const partRows = Object.values(partTotals).sort((a, b) => a.name.localeCompare(b.name));
  const laborRows = Object.values(laborTotals).sort((a, b) => a.name.localeCompare(b.name));

  // Job list summary
  const jobSummary = jobs.map(j => {
    const partCount  = (j.job_line_items||[]).filter(i => i.item_type === 'Part').length;
    const laborCount = (j.job_line_items||[]).filter(i => i.item_type === 'Labor').length;
    return `<tr>
      <td>${formatDate(j.job_date)}</td>
      <td>${escHtml(j.accounts?.account_name || '')}</td>
      <td>${escHtml(j.lead_tech?.tech_name || '--')}</td>
      <td><span class="status-badge status-${j.status.replace(/ /g,'-')}" style="font-size:0.72rem">${j.status}</span></td>
      <td style="text-align:center">${partCount}</td>
      <td style="text-align:center">${laborCount}</td>
    </tr>`;
  }).join('');

  const partsHtml = partRows.length
    ? `<table style="margin-top:0.3rem">
         <thead><tr><th>Part</th><th>Unit</th><th style="text-align:right">Needed</th><th style="text-align:right">On Hand</th><th style="text-align:right">To Order</th></tr></thead>
         <tbody>${partRows.map(p => {
           const needed   = p.total_qty;
           const onHand   = p.stock_qty;
           const toOrder  = Math.max(0, needed - onHand);
           const orderStyle = toOrder > 0 ? 'color:#a02020;font-weight:700' : 'color:#2a7a4a';
           return `<tr>
             <td>${escHtml(p.name)}</td>
             <td style="color:#5a6075">${escHtml(p.unit)}</td>
             <td style="text-align:right;font-weight:600">${needed}</td>
             <td style="text-align:right">${onHand}</td>
             <td style="text-align:right;${orderStyle}">${toOrder > 0 ? toOrder : '&#10003;'}</td>
           </tr>`;
         }).join('')}</tbody>
       </table>
       <p style="font-size:0.75rem;color:#5a6075;margin-top:0.35rem">To Order = Needed minus On Hand. Update On Hand quantities in Settings &rsaquo; Parts.</p>`
    : '<p class="meta">No parts pre-loaded for this range.</p>';

  const laborHtml = laborRows.length
    ? `<table style="margin-top:0.3rem">
         <thead><tr><th>Labor Type</th><th style="text-align:right">Total Hours</th></tr></thead>
         <tbody>${laborRows.map(l =>
           `<tr><td>${escHtml(l.name)}</td><td style="text-align:right;font-weight:600">${l.total_hours}</td></tr>`
         ).join('')}</tbody>
       </table>`
    : '<p class="meta">No labor pre-loaded for this range.</p>';

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.85rem;margin-bottom:0.85rem">
      <div class="card" style="margin-bottom:0">
        <h3 style="margin-bottom:0.4rem;font-size:0.92rem">Parts Required</h3>
        <p style="font-size:0.78rem;color:#5a6075;margin:0 0 0.45rem">Expected quantities across all jobs in range.</p>
        ${partsHtml}
      </div>
      <div class="card" style="margin-bottom:0">
        <h3 style="margin-bottom:0.4rem;font-size:0.92rem">Labor Summary</h3>
        <p style="font-size:0.78rem;color:#5a6075;margin:0 0 0.45rem">Total expected hours by type.</p>
        ${laborHtml}
      </div>
    </div>

    <div class="card" style="margin-bottom:0">
      <h3 style="margin-bottom:0.4rem;font-size:0.92rem">Jobs in Range <span style="font-weight:400;font-size:0.82rem;color:#5a6075">(${jobs.length} total)</span></h3>
      <table>
        <thead><tr><th>Date</th><th>Account</th><th>Lead Tech</th><th>Status</th><th style="text-align:center">Parts</th><th style="text-align:center">Labor</th></tr></thead>
        <tbody>${jobSummary}</tbody>
      </table>
    </div>
  `;
}
