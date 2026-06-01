// app-activitylog.js -- Activity Log
// Unified timeline of logins, clock events, job completions, and admin reviews.

let logPeriod     = 'week';
let logCustomFrom = '';
let logCustomTo   = '';
let logTypeFilter = '';

// ============================================================
// ENTRY POINT
// ============================================================
async function loadActivityLog() {
  renderLogShell();
  await refreshLog();
}

function renderLogShell() {
  document.getElementById('section-activitylog').innerHTML = `
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem">
      <div class="toggle-pair" style="margin-bottom:0">
        <button id="lp-today"  onclick="setLogPeriod('today')">Today</button>
        <button id="lp-week"   onclick="setLogPeriod('week')">This Week</button>
        <button id="lp-month"  onclick="setLogPeriod('month')">This Month</button>
        <button id="lp-custom" onclick="setLogPeriod('custom')">Custom</button>
      </div>
      <div id="log-custom-range" style="display:none;gap:0.3rem;align-items:center">
        <input type="date" id="log-from" style="padding:0.3rem 0.5rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.83rem">
        <span style="color:#5a6075;font-size:0.82rem">to</span>
        <input type="date" id="log-to"   style="padding:0.3rem 0.5rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.82rem">
        <button class="btn btn-primary" style="padding:0.3rem 0.7rem;font-size:0.82rem" onclick="applyCustomLog()">Go</button>
      </div>
      <select id="log-type-filter" onchange="logTypeFilter=this.value;refreshLog()"
        style="padding:0.3rem 0.55rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.83rem">
        <option value="">All Events</option>
        <option value="login">Logins</option>
        <option value="clockin">Clock In</option>
        <option value="clockout">Clock Out</option>
        <option value="completion">Completion Submitted</option>
        <option value="review">Admin Reviews</option>
      </select>
      <span id="log-period-label" style="font-size:0.82rem;color:#5a6075;margin-left:0.2rem"></span>
      <button class="btn btn-secondary" style="margin-left:auto;padding:0.28rem 0.7rem;font-size:0.81rem" onclick="refreshLog()">Refresh</button>
    </div>
    <div id="log-list"><p class="meta">Loading...</p></div>
  `;
  highlightLogPeriod();
}

// ============================================================
// PERIOD MANAGEMENT
// ============================================================
function setLogPeriod(period) {
  logPeriod = period;
  const cr = document.getElementById('log-custom-range');
  if (cr) cr.style.display = period === 'custom' ? 'flex' : 'none';
  highlightLogPeriod();
  if (period !== 'custom') refreshLog();
}

function applyCustomLog() {
  logCustomFrom = document.getElementById('log-from').value;
  logCustomTo   = document.getElementById('log-to').value;
  if (!logCustomFrom || !logCustomTo) return;
  refreshLog();
}

function highlightLogPeriod() {
  ['today','week','month','custom'].forEach(p => {
    const btn = document.getElementById(`lp-${p}`);
    if (btn) btn.className = p === logPeriod ? 'active' : '';
  });
  const labelEl = document.getElementById('log-period-label');
  if (labelEl) labelEl.textContent = logPeriodLabel();
}

function logDateRange() {
  if (logPeriod === 'today')  return { from: today(),      to: today() };
  if (logPeriod === 'week')   return { from: weekStart(),  to: weekEnd() };
  if (logPeriod === 'month')  return { from: monthStart(), to: monthEnd() };
  if (logPeriod === 'custom') return { from: logCustomFrom, to: logCustomTo };
  return { from: weekStart(), to: weekEnd() };
}

function logPeriodLabel() {
  const { from, to } = logDateRange();
  if (!from || !to) return '';
  if (from === to) return formatDate(from);
  return `${formatDate(from)} - ${formatDate(to)}`;
}


// ============================================================
// DATA REFRESH
// ============================================================
async function refreshLog() {
  const el = document.getElementById('log-list');
  if (!el) return;
  el.innerHTML = '<p class="meta">Loading...</p>';

  const { from, to } = logDateRange();
  if (!from || !to) return;

  const fromTs = from + 'T00:00:00';
  const toTs   = to   + 'T23:59:59';

  const typeF = logTypeFilter;

  // Fetch all event sources in parallel -- only the ones relevant to the active filter
  const fetchLogin      = (!typeF || typeF === 'login');
  const fetchClock      = (!typeF || typeF === 'clockin' || typeF === 'clockout');
  const fetchCompletion = (!typeF || typeF === 'completion');
  const fetchReview     = (!typeF || typeF === 'review');

  // Also load user profiles for resolving display names on clock events
  const profilesRes = fetchClock
    ? await db.from('user_profiles').select('id, display_name')
    : { data: [] };
  const profileMap = {};
  (profilesRes.data || []).forEach(p => { profileMap[p.id] = p.display_name; });

  const [loginRes, visitRes, compRes, reviewRes] = await Promise.all([
    fetchLogin
      ? db.from('login_events')
          .select('id, email, created_at, user_id')
          .gte('created_at', fromTs).lte('created_at', toTs)
          .order('created_at', { ascending: false })
          .limit(200)
      : { data: [] },

    fetchClock
      // Filter by visit_date (local calendar date) -- simpler and more reliable
      // than filtering on clocked_in_at/clocked_out_at timestamps directly.
      // visit_date is always set when a visit row exists.
      ? db.from('job_visits')
          .select(`id, visit_date, visit_number, clocked_in_at, clocked_out_at, clocked_in_by,
                   jobs!job_visits_job_id_fkey(
                     job_number,
                     accounts!jobs_account_id_fkey(account_name, account_number),
                     sub:accounts!jobs_sub_account_id_fkey(sub_account_number),
                     job_types(job_type_name)
                   )`)
          .gte('visit_date', from)
          .lte('visit_date', to)
          .not('clocked_in_at', 'is', null)
          .limit(300)
      : { data: [] },

    fetchCompletion
      ? db.from('job_completions')
          .select(`id, submitted_at, last_edited_at,
                   jobs!job_completions_job_id_fkey(
                     job_number,
                     accounts!jobs_account_id_fkey(account_name, account_number),
                     sub:accounts!jobs_sub_account_id_fkey(sub_account_number),
                     job_types(job_type_name)
                   ),
                   submitter:user_profiles!job_completions_submitted_by_fkey(display_name)`)
          .gte('submitted_at', fromTs).lte('submitted_at', toTs)
          .order('submitted_at', { ascending: false })
          .limit(200)
      : { data: [] },

    fetchReview
      ? db.from('admin_reviews')
          .select(`id, review_status, review_notes, reviewed_at,
                   jobs!admin_reviews_job_id_fkey(
                     job_number,
                     accounts!jobs_account_id_fkey(account_name, account_number),
                     sub:accounts!jobs_sub_account_id_fkey(sub_account_number),
                     job_types(job_type_name)
                   ),
                   reviewer:user_profiles!admin_reviews_reviewed_by_fkey(display_name)`)
          .gte('reviewed_at', fromTs).lte('reviewed_at', toTs)
          .not('review_status', 'eq', 'Note')  // exclude note-only entries from review filter
          .order('reviewed_at', { ascending: false })
          .limit(200)
      : { data: [] }
  ]);

  // Build unified event list
  const events = [];

  // Logins
  (loginRes.data || []).forEach(e => {
    events.push({
      ts:   new Date(e.created_at),
      type: 'login',
      icon: '&#9679;',
      color: '#1a2744',
      label: 'Sign In',
      detail: e.email,
      sub: ''
    });
  });

  // Clock events
  (visitRes.data || []).forEach(v => {
    const job  = v.jobs;
    const ref  = job ? jobRef(
      job.accounts?.account_number,
      job.sub?.sub_account_number,
      job.job_number
    ) : '';
    const acct = job?.accounts?.account_name || '';
    const jtype = job?.job_types?.job_type_name || '';
    const jobLabel = [acct, jtype].filter(Boolean).join(' / ');

    const techName = v.clocked_in_by ? (profileMap[v.clocked_in_by] || '') : '';
    const visitRef  = ref || `Visit ${v.visit_number} | ${formatDate(v.visit_date)}`;

    if (v.clocked_in_at && (!typeF || typeF === 'clockin')) {
      events.push({
        ts:     new Date(v.clocked_in_at),
        type:   'clockin',
        icon:   '&#9650;',
        color:  '#2a7a4a',
        label:  'Clock In',
        detail: jobLabel,
        sub:    [visitRef, techName ? `Tech: ${techName}` : ''].filter(Boolean).join(' | ')
      });
    }
    if (v.clocked_out_at && (!typeF || typeF === 'clockout')) {
      const dur = v.clocked_in_at
        ? durationHM(new Date(v.clocked_in_at), new Date(v.clocked_out_at))
        : '';
      events.push({
        ts:     new Date(v.clocked_out_at),
        type:   'clockout',
        icon:   '&#9660;',
        color:  '#b86c00',
        label:  'Clock Out',
        detail: jobLabel,
        sub:    [visitRef, dur ? `Duration: ${dur}` : '', techName ? `Tech: ${techName}` : ''].filter(Boolean).join(' | ')
      });
    }
  });

  // Completions
  (compRes.data || []).forEach(c => {
    const job   = c.jobs;
    const ref   = job ? jobRef(job.accounts?.account_number, job.sub?.sub_account_number, job.job_number) : '';
    const acct  = job?.accounts?.account_name || '';
    const jtype = job?.job_types?.job_type_name || '';
    const who   = c.submitter?.display_name || '';
    events.push({
      ts:     new Date(c.submitted_at),
      type:   'completion',
      icon:   '&#10003;',
      color:  '#6b6fa8',
      label:  'Completion Submitted',
      detail: [acct, jtype].filter(Boolean).join(' / '),
      sub:    (ref ? `Ref: ${ref}` : '') + (who ? (ref ? ' | ' : '') + `by ${who}` : '')
    });
  });

  // Admin reviews
  (reviewRes.data || []).forEach(r => {
    const job   = r.jobs;
    const ref   = job ? jobRef(job.accounts?.account_number, job.sub?.sub_account_number, job.job_number) : '';
    const acct  = job?.accounts?.account_name || '';
    const jtype = job?.job_types?.job_type_name || '';
    const who   = r.reviewer?.display_name || '';
    const statusColor = r.review_status === 'Approved' ? '#2a7a4a'
                      : r.review_status === 'Flagged'  ? '#a02020'
                      : '#1a2744';
    events.push({
      ts:     new Date(r.reviewed_at),
      type:   'review',
      icon:   '&#9670;',
      color:  statusColor,
      label:  `Review: ${r.review_status}`,
      detail: [acct, jtype].filter(Boolean).join(' / '),
      sub:    (ref ? `Ref: ${ref}` : '') + (who ? (ref ? ' | ' : '') + `by ${who}` : '')
             + (r.review_notes ? ` | "${r.review_notes.slice(0,60)}${r.review_notes.length > 60 ? '...' : ''}"` : '')
    });
  });

  if (!events.length) {
    el.innerHTML = '<p class="meta">No activity found for this period.</p>';
    return;
  }

  // Sort newest first
  events.sort((a, b) => b.ts - a.ts);

  // Group by date
  const byDate = {};
  events.forEach(e => {
    const d = e.ts.toLocaleDateString('en-CA'); // YYYY-MM-DD
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  });

  const html = Object.keys(byDate).sort().reverse().map(dateKey => {
    const dayEvents = byDate[dateKey];
    const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(dateKey + 'T12:00:00').getDay()];
    const dayLabel = `${dow}, ${formatDate(dateKey)}`;

    const rows = dayEvents.map(ev => {
      const timeStr = ev.ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const typePill = `<span style="display:inline-block;padding:0.1rem 0.42rem;border-radius:20px;font-size:0.71rem;font-weight:700;background:${ev.color}18;color:${ev.color};white-space:nowrap">${ev.label}</span>`;
      return `<div style="display:flex;gap:0.75rem;align-items:flex-start;padding:0.48rem 0;border-bottom:1px solid #eef0f6">
        <div style="min-width:72px;text-align:right;font-size:0.8rem;color:#5a6075;padding-top:0.05rem;font-variant-numeric:tabular-nums">${timeStr}</div>
        <div style="color:${ev.color};font-size:1.1rem;padding-top:0.05rem;min-width:18px;text-align:center">${ev.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">
            ${typePill}
            <span style="font-size:0.85rem;font-weight:600;color:#1a2744">${escHtml(ev.detail)}</span>
          </div>
          ${ev.sub ? `<div style="font-size:0.77rem;color:#6b6fa8;margin-top:0.12rem">${escHtml(ev.sub)}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:1.1rem">
      <div style="background:#f2f4f8;border:1px solid #dde1ea;border-radius:4px 4px 0 0;padding:0.35rem 0.75rem;font-size:0.82rem;font-weight:600;color:#1a2744;display:flex;justify-content:space-between">
        <span>${dayLabel}</span>
        <span style="font-weight:400;color:#5a6075">${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="border:1px solid #dde1ea;border-top:none;border-radius:0 0 4px 4px;padding:0 0.75rem">
        ${rows}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = html;
}


// ============================================================
// HELPERS
// ============================================================
function durationHM(start, end) {
  const ms  = end - start;
  if (ms <= 0) return '';
  const h   = Math.floor(ms / 3600000);
  const m   = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
