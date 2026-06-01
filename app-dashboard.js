// app-dashboard.js -- Admin Dashboard
// KPI cards with period toggle, today's board snapshot, review backlog snapshot.

let dashPeriod     = 'week';   // 'today' | 'week' | 'month' | 'custom'
let dashCustomFrom = '';
let dashCustomTo   = '';

// ============================================================
// ENTRY POINT -- called by router when #dashboard activates
// ============================================================
async function loadDashboard() {
  renderDashboardShell();
  await refreshDashboard();
}

function renderDashboardShell() {
  document.getElementById('section-dashboard').innerHTML = `
    <!-- Period toggle -->
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-bottom:1.1rem">
      <div class="toggle-pair" style="margin-bottom:0">
        <button id="dp-today" onclick="setDashPeriod('today')">Today</button>
        <button id="dp-week"  onclick="setDashPeriod('week')">This Week</button>
        <button id="dp-month" onclick="setDashPeriod('month')">This Month</button>
        <button id="dp-custom" onclick="setDashPeriod('custom')">Custom</button>
      </div>
      <div id="dash-custom-range" style="display:none;display:flex;gap:0.3rem;align-items:center">
        <input type="date" id="dash-from" style="padding:0.3rem 0.5rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.83rem">
        <span style="color:#5a6075;font-size:0.82rem">to</span>
        <input type="date" id="dash-to"   style="padding:0.3rem 0.5rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.82rem">
        <button class="btn btn-primary" style="padding:0.3rem 0.7rem;font-size:0.82rem" onclick="applyCustomDash()">Go</button>
      </div>
      <span id="dash-period-label" style="font-size:0.82rem;color:#5a6075;margin-left:0.2rem"></span>
      <button class="btn btn-secondary" style="margin-left:auto;padding:0.28rem 0.7rem;font-size:0.81rem" onclick="refreshDashboard()">Refresh</button>
    </div>

    <!-- KPI cards -->
    <div id="dash-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin-bottom:1.2rem">
      <div class="card" style="text-align:center;padding:1rem 0.8rem;margin-bottom:0">
        <div id="kpi-board" style="font-size:2rem;font-weight:700;color:#1a2744">--</div>
        <div style="font-size:0.75rem;color:#5a6075;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.2rem">Jobs on Board</div>
      </div>
      <div class="card" style="text-align:center;padding:1rem 0.8rem;margin-bottom:0">
        <div id="kpi-review" style="font-size:2rem;font-weight:700;color:#b86c00">--</div>
        <div style="font-size:0.75rem;color:#5a6075;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.2rem">Pending Review</div>
      </div>
      <div class="card" style="text-align:center;padding:1rem 0.8rem;margin-bottom:0">
        <div id="kpi-quotes" style="font-size:2rem;font-weight:700;color:#6b6fa8">--</div>
        <div style="font-size:0.75rem;color:#5a6075;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.2rem">Open Quotes</div>
      </div>
      <div class="card" style="text-align:center;padding:1rem 0.8rem;margin-bottom:0">
        <div id="kpi-revenue" style="font-size:2rem;font-weight:700;color:#2a7a4a">--</div>
        <div style="font-size:0.75rem;color:#5a6075;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.2rem">Approved Revenue</div>
        <div id="kpi-period-note" style="font-size:0.7rem;color:#aaa;margin-top:0.15rem"></div>
      </div>
    </div>

    <!-- Two-column snapshots -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.85rem">
      <div class="card" style="margin-bottom:0">
        <h3 style="margin-bottom:0.6rem;font-size:0.92rem">Today's Board</h3>
        <div id="dash-today-board"><p class="meta">Loading...</p></div>
      </div>
      <div class="card" style="margin-bottom:0">
        <h3 style="margin-bottom:0.6rem;font-size:0.92rem">Needs Review</h3>
        <div id="dash-review-queue"><p class="meta">Loading...</p></div>
      </div>
    </div>
  `;
  highlightDashPeriod();
}

// ============================================================
// PERIOD MANAGEMENT
// ============================================================
function setDashPeriod(period) {
  dashPeriod = period;
  const customRange = document.getElementById('dash-custom-range');
  if (customRange) customRange.style.display = period === 'custom' ? 'flex' : 'none';
  highlightDashPeriod();
  if (period !== 'custom') refreshDashboard();
}

function applyCustomDash() {
  dashCustomFrom = document.getElementById('dash-from').value;
  dashCustomTo   = document.getElementById('dash-to').value;
  if (!dashCustomFrom || !dashCustomTo) return;
  refreshDashboard();
}

function highlightDashPeriod() {
  ['today','week','month','custom'].forEach(p => {
    const btn = document.getElementById(`dp-${p}`);
    if (btn) btn.className = p === dashPeriod ? 'active' : '';
  });
}

function dashDateRange() {
  if (dashPeriod === 'today')  return { from: today(),      to: today() };
  if (dashPeriod === 'week')   return { from: weekStart(),  to: weekEnd() };
  if (dashPeriod === 'month')  return { from: monthStart(), to: monthEnd() };
  if (dashPeriod === 'custom') return { from: dashCustomFrom, to: dashCustomTo };
  return { from: weekStart(), to: weekEnd() };
}

function dashPeriodLabel() {
  const { from, to } = dashDateRange();
  if (!from || !to) return '';
  if (from === to) return formatDate(from);
  return `${formatDate(from)} - ${formatDate(to)}`;
}

// ============================================================
// DATA REFRESH
// ============================================================
async function refreshDashboard() {
  const { from, to } = dashDateRange();
  if (!from || !to) return;

  const labelEl = document.getElementById('dash-period-label');
  if (labelEl) labelEl.textContent = dashPeriodLabel();

  // Run all queries in parallel
  const [boardRes, reviewRes, quotesRes, revenueRes, todayRes, queueRes] = await Promise.all([
    // Jobs on board (active, non-terminal) in the period
    db.from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['Scheduled','In Progress','Awaiting Parts'])
      .gte('job_date', from)
      .lte('job_date', to),

    // Pending review (all time -- backlog is not date-bounded)
    db.from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Pending Review'),

    // Open quotes (all time)
    db.from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Quoted'),

    // Approved revenue for the period (line items)
    db.from('jobs')
      .select('job_line_items(unit_cost,override_cost,quantity)')
      .eq('status', 'Approved')
      .gte('job_date', from)
      .lte('job_date', to),

    // Today's board snapshot (up to 8 jobs)
    db.from('jobs')
      .select(`id, job_date, status, scope,
               accounts!jobs_account_id_fkey(account_name),
               job_types(job_type_name),
               lead_tech:techs!jobs_lead_tech_id_fkey(tech_name)`)
      .eq('job_date', today())
      .not('status', 'in', '("Cancelled","Approved")')
      .order('job_date')
      .limit(8),

    // Review queue snapshot (up to 6 oldest pending jobs)
    db.from('jobs')
      .select(`id, job_date, status,
               accounts!jobs_account_id_fkey(account_name),
               job_types(job_type_name)`)
      .eq('status', 'Pending Review')
      .order('job_date', { ascending: true })
      .limit(6)
  ]);

  // KPI: jobs on board
  const kpiBoard = document.getElementById('kpi-board');
  if (kpiBoard) kpiBoard.textContent = boardRes.count ?? '--';

  // KPI: review backlog
  const kpiReview = document.getElementById('kpi-review');
  if (kpiReview) kpiReview.textContent = reviewRes.count ?? '--';

  // KPI: open quotes
  const kpiQuotes = document.getElementById('kpi-quotes');
  if (kpiQuotes) kpiQuotes.textContent = quotesRes.count ?? '--';

  // KPI: approved revenue
  const revenue = (revenueRes.data || []).reduce((sum, j) =>
    sum + (j.job_line_items || []).reduce((s, i) =>
      s + ((i.override_cost ?? i.unit_cost) * i.quantity), 0), 0);
  const kpiRev = document.getElementById('kpi-revenue');
  if (kpiRev) kpiRev.textContent = '$' + revenue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const kpiNote = document.getElementById('kpi-period-note');
  if (kpiNote) kpiNote.textContent = dashPeriodLabel();

  // Today's board snapshot
  renderTodaySnapshot(todayRes.data || []);

  // Review queue snapshot
  renderReviewSnapshot(queueRes.data || []);
}

// ============================================================
// TODAY SNAPSHOT
// ============================================================
function renderTodaySnapshot(jobs) {
  const el = document.getElementById('dash-today-board');
  if (!el) return;

  if (!jobs.length) {
    el.innerHTML = '<p class="meta">No jobs scheduled for today.</p>';
    return;
  }

  el.innerHTML = jobs.map(j => {
    const acct  = j.accounts?.account_name || '';
    const type  = j.job_types?.job_type_name || '';
    const lead  = j.lead_tech?.tech_name || '';
    const badge = `<span class="status-badge status-${j.status.replace(/ /g,'-')}" style="font-size:0.68rem">${j.status}</span>`;
    return `<div style="padding:0.45rem 0;border-bottom:1px solid #eef0f6;display:flex;justify-content:space-between;align-items:flex-start;gap:0.4rem">
      <div style="min-width:0">
        <div style="font-weight:600;font-size:0.86rem;color:#1a2744;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${acct}</div>
        <div style="font-size:0.78rem;color:#5a6075">${type}${lead ? ' | ' + lead : ''}</div>
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:0.2rem">
        ${badge}
        <button class="btn btn-secondary" style="padding:0.15rem 0.5rem;font-size:0.74rem;margin:0" onclick="nav('dispatch');showDispatchPanel('board')">View</button>
      </div>
    </div>`;
  }).join('') +
    `<div style="margin-top:0.5rem">
       <button class="btn btn-primary" style="font-size:0.81rem;padding:0.3rem 0.7rem" onclick="nav('dispatch')">Open Dispatch Board</button>
     </div>`;
}

// ============================================================
// REVIEW QUEUE SNAPSHOT
// ============================================================
function renderReviewSnapshot(jobs) {
  const el = document.getElementById('dash-review-queue');
  if (!el) return;

  if (!jobs.length) {
    el.innerHTML = '<p class="meta">No jobs pending review.</p>';
    return;
  }

  el.innerHTML = jobs.map(j => {
    const acct = j.accounts?.account_name || '';
    const type = j.job_types?.job_type_name || '';
    const age  = Math.floor((Date.now() - new Date(j.job_date).getTime()) / 86400000);
    const ageLabel = age === 0 ? 'today' : age === 1 ? '1 day ago' : `${age} days ago`;
    const ageColor = age > 7 ? '#a02020' : age > 3 ? '#b86c00' : '#5a6075';
    return `<div style="padding:0.45rem 0;border-bottom:1px solid #eef0f6;display:flex;justify-content:space-between;align-items:flex-start;gap:0.4rem">
      <div style="min-width:0">
        <div style="font-weight:600;font-size:0.86rem;color:#1a2744;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${acct}</div>
        <div style="font-size:0.78rem;color:#5a6075">${type} | ${formatDate(j.job_date)}</div>
      </div>
      <div style="flex-shrink:0;text-align:right">
        <div style="font-size:0.73rem;color:${ageColor};font-weight:600">${ageLabel}</div>
        <button class="btn btn-secondary" style="padding:0.15rem 0.5rem;font-size:0.74rem;margin:0.15rem 0 0" onclick="nav('review')">Review</button>
      </div>
    </div>`;
  }).join('') +
    `<div style="margin-top:0.5rem">
       <button class="btn btn-yellow" style="font-size:0.81rem;padding:0.3rem 0.7rem" onclick="nav('review')">Open Review Queue</button>
     </div>`;
}
