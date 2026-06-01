// app-accounts.js -- Accounts CRM
// Depends on globals: currentUser, allAccounts, allParts, allLaborTypes

// ---- STATE ----
let allAccountsData    = [];
let filteredAccountsData = [];
let allJobsByAccount   = {};
let allPrimaryContacts = {};
let acctSortKey        = 'account_name';
let acctSortDir        = 1;
let currentDetailAcctId = null;


// ============================================================
// SECTION NAVIGATION
// ============================================================
function showAcctSection(name) {
  ['list','add','detail'].forEach(s => {
    const el = document.getElementById(`acct-section-${s}`);
    if (el) el.style.display = s === name ? '' : 'none';
  });
}

function openAddAccount() {
  document.getElementById('acct-form-title').textContent = 'Add Account';
  document.getElementById('acct-edit-id').value = '';
  ['acct-name','acct-address','acct-phone','acct-billing'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.getElementById('acct-parent').value   = '';
  document.getElementById('acct-active').checked = true;
  document.getElementById('acct-form-msg').innerHTML = '';
  showAcctSection('add');
}

function cancelAccountEdit() {
  document.getElementById('acct-edit-id').value = '';
  showAcctSection('list');
}


// ============================================================
// LOAD ACCOUNTS
// ============================================================
async function loadAccounts() {
  document.getElementById('accounts-tbody').innerHTML =
    '<tr><td colspan="8" style="color:#888;padding:0.6rem">Loading...</td></tr>';
  try {
    const { data: accounts, error } = await db.from('accounts')
      .select('id,account_name,parent_account_id,address,phone,billing_notes,instructions,active,status')
      .order('account_name');
    if (error) throw error;
    allAccountsData = accounts || [];

    // Sync shared allAccounts for use by assign form
    allAccounts = allAccountsData.filter(a => a.status === 'active' && a.active);

    const { data: jobStats } = await db.from('jobs')
      .select('id,account_id,job_date,status,job_line_items(unit_cost,override_cost,quantity)');
    allJobsByAccount = {};
    (jobStats || []).forEach(j => {
      if (!j.account_id) return;
      if (!allJobsByAccount[j.account_id])
        allJobsByAccount[j.account_id] = { count: 0, lastDate: null, totalRevenue: 0 };
      const s = allJobsByAccount[j.account_id];
      s.count++;
      if (!s.lastDate || j.job_date > s.lastDate) s.lastDate = j.job_date;
      const rev = (j.job_line_items||[]).reduce((sum,i) => sum + (Number(i.override_cost??i.unit_cost)*Number(i.quantity)), 0);
      s.totalRevenue += rev;
    });

    const { data: contacts } = await db.from('account_contacts')
      .select('account_id,contact_name,work_phone,cell_phone,is_primary')
      .eq('active', true).eq('is_primary', true);
    allPrimaryContacts = {};
    (contacts || []).forEach(c => { allPrimaryContacts[c.account_id] = c; });

    // Populate parent dropdown for add/edit
    const masters = allAccountsData.filter(a => !a.parent_account_id && a.status === 'active');
    const parentSel = document.getElementById('acct-parent');
    if (parentSel) {
      parentSel.innerHTML = '<option value="">-- Master Account --</option>' +
        masters.map(a => `<option value="${a.id}">${a.account_name}</option>`).join('');
    }

    loadPendingCount();
    filterAccounts();
  } catch (err) {
    document.getElementById('accounts-tbody').innerHTML =
      `<tr><td colspan="8" style="color:#a02020;padding:1rem"><strong>Error:</strong> ${err.message}</td></tr>`;
    console.error('loadAccounts error:', err);
  }
}


// ============================================================
// FILTER & RENDER
// ============================================================
function filterAccounts() {
  const q         = document.getElementById('f-search').value.toLowerCase();
  const type      = document.getElementById('f-type').value;
  const activeVal = document.getElementById('f-active').value;

  filteredAccountsData = allAccountsData.filter(a => {
    if (a.status === 'pending' || a.status === 'rejected') return false; // hide pending/rejected from main list
    if (q && !`${a.account_name} ${a.address||''} ${a.phone||''}`.toLowerCase().includes(q)) return false;
    if (type === 'master' && a.parent_account_id)  return false;
    if (type === 'sub'    && !a.parent_account_id) return false;
    if (activeVal === 'true'  && !a.active) return false;
    if (activeVal === 'false' &&  a.active) return false;
    return true;
  });
  renderAccountsTable();
}

function sortAccounts(key) {
  if (acctSortKey === key) acctSortDir *= -1;
  else { acctSortKey = key; acctSortDir = 1; }
  renderAccountsTable();
}

function renderAccountsTable() {
  const masters = filteredAccountsData.filter(a => !a.parent_account_id).sort((a, b) => {
    let av, bv;
    if      (acctSortKey === 'account_name') { av = a.account_name; bv = b.account_name; }
    else if (acctSortKey === 'job_count')    { av = allJobsByAccount[a.id]?.count    || 0; bv = allJobsByAccount[b.id]?.count    || 0; }
    else if (acctSortKey === 'last_service') { av = allJobsByAccount[a.id]?.lastDate || ''; bv = allJobsByAccount[b.id]?.lastDate || ''; }
    else                                     { av = a[acctSortKey] || ''; bv = b[acctSortKey] || ''; }
    return av < bv ? -1 * acctSortDir : av > bv ? 1 * acctSortDir : 0;
  });

  const ordered = [];
  masters.forEach(m => {
    ordered.push(m);
    filteredAccountsData.filter(a => a.parent_account_id === m.id)
      .sort((a,b) => a.account_name.localeCompare(b.account_name))
      .forEach(s => ordered.push(s));
  });
  filteredAccountsData.filter(a => a.parent_account_id && !ordered.includes(a)).forEach(a => ordered.push(a));

  const totalActive = allAccountsData.filter(a => a.active && a.status === 'active').length;
  const totalMaster = allAccountsData.filter(a => !a.parent_account_id && a.active && a.status === 'active').length;
  document.getElementById('accounts-summary').textContent =
    `${filteredAccountsData.length} of ${totalActive} active accounts shown | ${totalMaster} master accounts`;

  const tbody = document.getElementById('accounts-tbody');
  if (!ordered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:#888;padding:0.6rem">No accounts found.</td></tr>';
    return;
  }

  tbody.innerHTML = ordered.map(a => {
    const stats = allJobsByAccount[a.id] || {};
    const isSub = !!a.parent_account_id;
    const pc    = allPrimaryContacts[a.id];
    const contactCell = pc
      ? `${pc.contact_name}${pc.work_phone ? '<br><span style="font-size:0.77rem;color:#5a6075">'+pc.work_phone+'</span>' : pc.cell_phone ? '<br><span style="font-size:0.77rem;color:#5a6075">'+pc.cell_phone+'</span>' : ''}`
      : '<span style="color:#bbb;font-size:0.79rem">None</span>';
    const nameCell = isSub
      ? `<span style="padding-left:1rem;color:#5a6075">&#8627; ${a.account_name}</span>`
      : `<strong style="color:#1a2744">${a.account_name}</strong>`;

    return `<tr class="${a.active ? '' : 'inactive-row'}" style="${isSub ? 'background:#f8f9fc' : ''}">
      <td>${nameCell}</td>
      <td style="font-size:0.82rem">${a.address || ''}</td>
      <td style="font-size:0.82rem">${a.phone   || ''}</td>
      <td style="font-size:0.82rem">${contactCell}</td>
      <td style="text-align:center">${stats.count || 0}</td>
      <td style="font-size:0.82rem;white-space:nowrap">${formatDate(stats.lastDate) || '--'}</td>
      <td style="text-align:center">${a.active ? 'Yes' : '<span style="color:#bbb">No</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-blue btn-sm"  onclick="openAccountDetail('${a.id}')">Open</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditAccount('${a.id}')">Edit</button>
        <button class="btn btn-red btn-sm"   onclick="toggleAccountActive('${a.id}',${a.active})">${a.active ? 'Deactivate' : 'Activate'}</button>
      </td>
    </tr>`;
  }).join('');
}


// ============================================================
// ADD / EDIT ACCOUNT
// ============================================================
function openEditAccount(id) {
  const a = allAccountsData.find(x => x.id === id);
  if (!a) return;
  document.getElementById('acct-form-title').textContent = 'Edit Account';
  document.getElementById('acct-edit-id').value  = a.id;
  document.getElementById('acct-name').value     = a.account_name;
  document.getElementById('acct-parent').value   = a.parent_account_id || '';
  document.getElementById('acct-address').value  = a.address || '';
  document.getElementById('acct-phone').value    = a.phone   || '';
  document.getElementById('acct-billing').value  = a.billing_notes || '';
  document.getElementById('acct-active').checked = a.active;
  document.getElementById('acct-form-msg').innerHTML = '';
  showAcctSection('add');
}

async function saveAccount() {
  const name = document.getElementById('acct-name').value.trim();
  const msg  = document.getElementById('acct-form-msg');
  msg.innerHTML = '';
  if (!name) { msg.innerHTML = '<div class="msg error">Account name is required.</div>'; return; }

  const payload = {
    account_name:      name,
    parent_account_id: document.getElementById('acct-parent').value  || null,
    address:           document.getElementById('acct-address').value || null,
    phone:             document.getElementById('acct-phone').value   || null,
    billing_notes:     document.getElementById('acct-billing').value || null,
    active:            document.getElementById('acct-active').checked,
    status:            'active'
  };

  const editId   = document.getElementById('acct-edit-id').value;
  const parentId = payload.parent_account_id;
  let error;
  if (editId) {
    ({ error } = await db.from('accounts').update(payload).eq('id', editId));
  } else {
    // For sub-accounts, auto-assign next letter (A, B, C...) if no number yet
    if (parentId) {
      const { data: siblings } = await db.from('accounts')
        .select('sub_account_number').eq('parent_account_id', parentId).not('sub_account_number', 'is', null);
      const used = (siblings || []).map(s => s.sub_account_number).filter(Boolean);
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const nextLetter = alphabet.split('').find(c => !used.includes(c)) || String(used.length + 1);
      payload.sub_account_number = nextLetter;
    }
    ({ error } = await db.from('accounts').insert(payload));
  }

  if (error) { msg.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  msg.innerHTML = '<div class="msg success">Saved.</div>';
  await loadAccounts();
  setTimeout(() => cancelAccountEdit(), 700);
}

async function toggleAccountActive(id, current) {
  await db.from('accounts').update({ active: !current }).eq('id', id);
  await loadAccounts();
}


// ============================================================
// PENDING ACCOUNTS
// ============================================================
async function loadPendingCount() {
  const { count } = await db.from('accounts')
    .select('id', { count: 'exact', head: true }).eq('status', 'pending');
  const btn = document.getElementById('btn-pending-accounts');
  if (!btn) return;
  setBadge('badge-accounts', count);
  btn.textContent = count > 0 ? `Pending (${count})` : 'Pending';
}

function togglePendingPanel() {
  const panel   = document.getElementById('pending-accounts-panel');
  const visible = panel.style.display === 'block';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) loadPendingList();
}

async function loadPendingList() {
  const el = document.getElementById('pending-list');
  el.innerHTML = '<p style="font-size:0.84rem;color:#888;margin:0">Loading...</p>';

  const { data: accounts, error } = await db.from('accounts')
    .select('id,account_name,address,phone,billing_notes,submitted_at')
    .eq('status', 'pending').order('submitted_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  if (!accounts?.length) { el.innerHTML = '<p style="margin:0;font-size:0.84rem;color:#888">No pending submissions.</p>'; return; }

  const pendingIds = accounts.map(a => a.id);
  const { data: allContacts } = await db.from('account_contacts')
    .select('*').in('account_id', pendingIds).order('is_primary', { ascending: false });
  const contactsByAcct = {};
  (allContacts || []).forEach(c => {
    if (!contactsByAcct[c.account_id]) contactsByAcct[c.account_id] = [];
    contactsByAcct[c.account_id].push(c);
  });

  el.innerHTML = accounts.map(a => {
    const contacts = contactsByAcct[a.id] || [];
    const date     = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-US') : 'Unknown';
    const ctHtml   = contacts.map(c => {
      const flags = [
        c.is_primary   ? '<span style="background:#1a2744;color:white;padding:0.1rem 0.38rem;border-radius:10px;font-size:0.73rem">Primary</span>'   : '',
        c.is_secondary ? '<span style="background:#6b6fa8;color:white;padding:0.1rem 0.38rem;border-radius:10px;font-size:0.73rem">Secondary</span>' : '',
        c.is_onsite    ? '<span style="background:#2a7a4a;color:white;padding:0.1rem 0.38rem;border-radius:10px;font-size:0.73rem">On-Site</span>'   : ''
      ].filter(Boolean).join(' ');
      return `<div style="background:white;border:1px solid #dde1ea;border-radius:4px;padding:0.45rem 0.65rem;margin-bottom:0.3rem;font-size:0.82rem">
        ${flags ? `<div style="margin-bottom:0.2rem">${flags}</div>` : ''}
        <strong>${c.contact_name}</strong>${c.title ? ` | ${c.title}` : ''}
        ${c.work_phone ? `<br>Work: ${c.work_phone}` : ''}
        ${c.cell_phone ? `<br>Cell: ${c.cell_phone}` : ''}
        ${c.email      ? `<br>${c.email}` : ''}
      </div>`;
    }).join('') || '<p style="font-size:0.82rem;color:#888;margin:0.15rem 0">No contacts submitted.</p>';

    return `<div style="background:white;border:1px solid #dde1ea;border-radius:5px;padding:0.9rem;margin-bottom:0.8rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.35rem;margin-bottom:0.6rem">
        <div>
          <strong style="font-size:0.97rem;color:#1a2744">${a.account_name}</strong>
          <span style="font-size:0.79rem;color:#888;margin-left:0.45rem">Submitted ${date}</span>
        </div>
        <div>
          <button class="btn btn-green btn-sm"      onclick="approvePending('${a.id}')">Approve</button>
          <button class="btn btn-red btn-sm"        onclick="rejectPending('${a.id}')">Reject</button>
        </div>
      </div>
      ${a.address ? `<div style="font-size:0.84rem;margin-bottom:0.15rem">Address: ${a.address}</div>` : ''}
      ${a.phone   ? `<div style="font-size:0.84rem;margin-bottom:0.15rem">Phone: ${a.phone}</div>`   : ''}
      ${a.billing_notes ? `<div style="font-size:0.82rem;color:#555;margin-bottom:0.35rem">Billing: ${a.billing_notes}</div>` : ''}
      <div style="font-size:0.78rem;font-weight:600;color:#6b6fa8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Contacts</div>
      ${ctHtml}
    </div>`;
  }).join('');
}

async function approvePending(accountId) {
  // Check if this account already has an account_number; if not, fetch max and assign next
  const { data: acct } = await db.from('accounts')
    .select('account_number, parent_account_id').eq('id', accountId).single();

  const update = { status: 'active', active: true };

  if (!acct?.account_number && !acct?.parent_account_id) {
    // Assign next account number (trigger only fires on INSERT, not UPDATE)
    const { data: maxRow } = await db.from('accounts')
      .select('account_number')
      .not('account_number', 'is', null)
      .eq('parent_account_id', null)
      .order('account_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNum = maxRow?.account_number
      ? String(parseInt(maxRow.account_number, 10) + 1).padStart(4, '0')
      : '0100';
    update.account_number = nextNum;
  }

  const { error } = await db.from('accounts').update(update).eq('id', accountId);
  if (error) { alert('Approve failed: ' + error.message); return; }
  await loadAccounts();
  loadPendingList();
}

async function rejectPending(accountId) {
  if (!confirm('Reject this submission? The account will be marked rejected.')) return;
  await db.from('accounts').update({ status: 'rejected' }).eq('id', accountId);
  loadPendingList();
  loadPendingCount();
}


// ============================================================
// ACCOUNT DETAIL
// ============================================================
async function openAccountDetail(accountId) {
  currentDetailAcctId = accountId;
  showAcctSection('detail');

  const a     = allAccountsData.find(x => x.id === accountId);
  const stats = allJobsByAccount[accountId] || {};
  const subs  = allAccountsData.filter(x => x.parent_account_id === accountId);

  document.getElementById('acct-detail-header').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.45rem">
      <div>
        <h3 style="margin:0 0 0.18rem;color:#1a2744">${a.account_name}</h3>
        <div class="meta">${a.parent_account_id ? 'Sub-Account' : 'Master Account'} | ${a.active ? 'Active' : '<span style="color:#a02020">Inactive</span>'}</div>
        ${a.address      ? `<div class="meta">${mapsLink(a.address)}</div>`       : ''}
        ${a.phone        ? `<div class="meta">Phone: ${a.phone}</div>`             : ''}
        ${a.billing_notes ? `<div style="margin-top:0.35rem;padding:0.38rem 0.55rem;background:#fffbe8;border:1px solid #e0cc60;border-radius:4px;font-size:0.82rem"><strong>Billing:</strong> ${a.billing_notes}</div>` : ''}
      </div>
      <button class="btn btn-secondary btn-sm" onclick="openEditAccount('${accountId}')">Edit Account</button>
    </div>`;

  document.getElementById('acct-detail-stats').innerHTML = `
    <div class="stat-box"><div class="val">${stats.count||0}</div><div class="lbl">Total Jobs</div></div>
    <div class="stat-box"><div class="val">$${(stats.totalRevenue||0).toFixed(0)}</div><div class="lbl">Revenue</div></div>
    <div class="stat-box"><div class="val">${formatDate(stats.lastDate)||'--'}</div><div class="lbl">Last Service</div></div>`;

  document.getElementById('acct-detail-subs').innerHTML = subs.length ? `
    <div class="section-title">Sub-Accounts (${subs.length})</div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th>Name</th><th>Address</th><th>Jobs</th><th></th></tr></thead>
      <tbody>${subs.map(s => {
        const ss = allJobsByAccount[s.id] || {};
        return `<tr>
          <td><strong>${s.account_name}</strong></td>
          <td style="font-size:0.82rem">${s.address ? mapsLink(s.address) : ''}</td>
          <td>${ss.count||0}</td>
          <td><button class="btn btn-blue btn-sm" onclick="openAccountDetail('${s.id}')">View</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>` : '';

  const now        = new Date();
  const oneYearAgo = new Date(now); oneYearAgo.setFullYear(now.getFullYear() - 1);
  document.getElementById('dj-from').value   = oneYearAgo.toISOString().split('T')[0];
  document.getElementById('dj-to').value     = now.toISOString().split('T')[0];
  document.getElementById('dj-status').value = '';

  switchDetailTab('history');
  await loadAccountJobs();
}


// ============================================================
// JOB HISTORY TAB
// ============================================================
async function loadAccountJobs() {
  const el     = document.getElementById('acct-detail-jobs');
  const status = document.getElementById('dj-status').value;
  const from   = document.getElementById('dj-from').value;
  const to     = document.getElementById('dj-to').value;
  el.innerHTML = '<p class="meta">Loading...</p>';

  let query = db.from('jobs')
    .select(`id, job_date, status, scope, is_fixed_price, quote_amount,
             job_number, work_order_number, purchase_order_number,
             sub:accounts!jobs_sub_account_id_fkey(account_name, sub_account_number),
             job_types(job_type_name),
             job_completions(time_in,time_out,payment_type,tech_notes,follow_up_flag),
             job_line_items(unit_cost,override_cost,quantity,item_type)`)
    .eq('account_id', currentDetailAcctId)
    .order('job_date', { ascending: false });

  if (status) query = query.eq('status', status);
  if (from)   query = query.gte('job_date', from);
  if (to)     query = query.lte('job_date', to);

  const { data, error } = await query;
  if (error) { el.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  if (!data?.length) { el.innerHTML = '<p class="meta">No jobs found for this period.</p>'; return; }

  const totalRev = data.reduce((sum,j) =>
    sum + (j.job_line_items||[]).reduce((s,i) => s+((i.override_cost??i.unit_cost)*i.quantity), 0), 0);

  el.innerHTML = `
    <div style="font-size:0.82rem;color:#5a6075;margin-bottom:0.45rem">${data.length} jobs | Total: <strong>$${totalRev.toFixed(2)}</strong></div>
    <div style="overflow-x:auto"><table>
      <thead><tr>
        <th>Date</th><th>Sub-Account</th><th>Type</th><th>WO/PO</th>
        <th>Status</th><th>Payment</th><th>Total</th><th>Follow-up</th>
      </tr></thead>
      <tbody>
      ${data.map(j => {
        const comp  = j.job_completions?.[0] || {};
        const total = (j.job_line_items||[]).reduce((s,i) => s+((i.override_cost??i.unit_cost)*i.quantity), 0);
        const wopo  = [j.work_order_number||'', j.purchase_order_number||''].filter(Boolean).join(' / ');
        // account_number comes from the parent account (currentDetailAcctId)
        const acctNum = allAccountsData.find(a => a.id === currentDetailAcctId)?.account_number;
        const ref = jobRef(acctNum, j.sub?.sub_account_number, j.job_number);
        return `<tr>
          <td style="white-space:nowrap">
            ${formatDate(j.job_date)}
            ${ref ? `<br><span style="font-family:monospace;font-size:0.71rem;color:#6b6fa8">${ref}</span>` : ''}
          </td>
          <td style="font-size:0.82rem">${j.sub?.account_name||''}</td>
          <td style="font-size:0.82rem">${j.job_types?.job_type_name||''}</td>
          <td style="font-size:0.82rem">${wopo}</td>
          <td><span class="status-badge status-${(j.status||'').replace(/ /g,'-')}">${j.status}</span></td>
          <td style="font-size:0.82rem">${comp.payment_type||'--'}</td>
          <td style="font-weight:600">$${total.toFixed(2)}</td>
          <td style="text-align:center">${comp.follow_up_flag ? '<span style="color:#a02020;font-weight:600">YES</span>' : ''}</td>
        </tr>
        ${j.scope ? `<tr><td colspan="8" style="font-size:0.79rem;color:#5a6075;padding-left:1rem;border-bottom:none">Scope: ${j.scope}</td></tr>` : ''}`;
      }).join('')}
      </tbody>
    </table></div>`;
}


// ============================================================
// CONTACTS TAB
// ============================================================
async function loadContactsTab() {
  const el = document.getElementById('contacts-list');
  el.innerHTML = '<p class="meta">Loading...</p>';
  const { data: contacts, error } = await db.from('account_contacts')
    .select('*').eq('account_id', currentDetailAcctId).eq('active', true)
    .order('is_primary',   { ascending: false })
    .order('is_secondary', { ascending: false })
    .order('contact_name');

  if (error) { el.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  if (!contacts?.length) { el.innerHTML = '<p class="meta">No contacts on file. Add one above.</p>'; return; }

  el.innerHTML = contacts.map(c => {
    const flags = [
      c.is_primary   ? '<span>Primary</span>'                    : '',
      c.is_secondary ? '<span class="secondary">Secondary</span>': '',
      c.is_onsite    ? '<span class="onsite">On-Site</span>'     : ''
    ].filter(Boolean).join('');
    return `<div class="contact-card">
      <div class="flags" style="margin-bottom:0.3rem">${flags || '<span style="background:#6b6fa8">Contact</span>'}</div>
      <strong style="font-size:0.94rem;color:#1a2744">${c.contact_name}</strong>
      ${c.title   ? `<span style="color:#5a6075;font-size:0.84rem"> | ${c.title}</span>`   : ''}
      ${c.company ? `<span style="color:#5a6075;font-size:0.84rem"> | ${c.company}</span>` : ''}
      <div style="margin-top:0.3rem;font-size:0.84rem">
        ${c.work_phone ? `<span style="margin-right:0.9rem">Work: <strong>${c.work_phone}</strong></span>` : ''}
        ${c.cell_phone ? `<span style="margin-right:0.9rem">Cell: <strong>${c.cell_phone}</strong></span>` : ''}
        ${c.email      ? `<span>${c.email}</span>` : ''}
      </div>
      ${c.notes ? `<div style="margin-top:0.3rem;font-size:0.82rem;color:#5a6075;font-style:italic">${c.notes}</div>` : ''}
      <div style="margin-top:0.45rem">
        <button class="btn btn-secondary btn-sm" onclick='openEditContact(${JSON.stringify(c).replace(/"/g,"&quot;")})'>Edit</button>
        <button class="btn btn-red btn-sm"       onclick="deactivateContact('${c.id}')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

function openAddContact() {
  document.getElementById('contact-form-title').textContent = 'Add Contact';
  document.getElementById('cf-id').value = '';
  ['cf-name','cf-title','cf-workphone','cf-cellphone','cf-email','cf-company','cf-notes']
    .forEach(id => document.getElementById(id).value = '');
  ['cf-primary','cf-secondary','cf-onsite']
    .forEach(id => document.getElementById(id).checked = false);
  document.getElementById('cf-msg').innerHTML = '';
  document.getElementById('contact-form-wrap').style.display = '';
}

function openEditContact(c) {
  document.getElementById('contact-form-title').textContent = 'Edit Contact';
  document.getElementById('cf-id').value        = c.id;
  document.getElementById('cf-name').value      = c.contact_name || '';
  document.getElementById('cf-title').value     = c.title        || '';
  document.getElementById('cf-workphone').value = c.work_phone   || '';
  document.getElementById('cf-cellphone').value = c.cell_phone   || '';
  document.getElementById('cf-email').value     = c.email        || '';
  document.getElementById('cf-company').value   = c.company      || '';
  document.getElementById('cf-notes').value     = c.notes        || '';
  document.getElementById('cf-primary').checked   = c.is_primary   || false;
  document.getElementById('cf-secondary').checked = c.is_secondary || false;
  document.getElementById('cf-onsite').checked    = c.is_onsite    || false;
  document.getElementById('cf-msg').innerHTML = '';
  document.getElementById('contact-form-wrap').style.display = '';
}

function closeContactForm() { document.getElementById('contact-form-wrap').style.display = 'none'; }

async function saveContact() {
  const name = document.getElementById('cf-name').value.trim();
  const msg  = document.getElementById('cf-msg');
  msg.innerHTML = '';
  if (!name) { msg.innerHTML = '<div class="msg error">Contact name is required.</div>'; return; }

  const isPrimary   = document.getElementById('cf-primary').checked;
  const isSecondary = document.getElementById('cf-secondary').checked;
  const editId      = document.getElementById('cf-id').value;

  // Clear existing primary/secondary flags if setting new ones
  if (isPrimary)   await db.from('account_contacts').update({ is_primary:   false }).eq('account_id', currentDetailAcctId).neq('id', editId || '00000000-0000-0000-0000-000000000000');
  if (isSecondary) await db.from('account_contacts').update({ is_secondary: false }).eq('account_id', currentDetailAcctId).neq('id', editId || '00000000-0000-0000-0000-000000000000');

  const payload = {
    account_id:   currentDetailAcctId,
    contact_name: name,
    title:        document.getElementById('cf-title').value     || null,
    work_phone:   document.getElementById('cf-workphone').value || null,
    cell_phone:   document.getElementById('cf-cellphone').value || null,
    email:        document.getElementById('cf-email').value     || null,
    company:      document.getElementById('cf-company').value   || null,
    notes:        document.getElementById('cf-notes').value     || null,
    is_primary:   isPrimary,
    is_secondary: isSecondary,
    is_onsite:    document.getElementById('cf-onsite').checked,
    updated_at:   new Date().toISOString(),
    created_by:   currentUser.id
  };

  let error;
  if (editId) ({ error } = await db.from('account_contacts').update(payload).eq('id', editId));
  else        ({ error } = await db.from('account_contacts').insert(payload));

  if (error) { msg.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  msg.innerHTML = '<div class="msg success">Saved.</div>';
  setTimeout(() => { closeContactForm(); loadContactsTab(); }, 600);
}

async function deactivateContact(id) {
  if (!confirm('Remove this contact from the active list?')) return;
  await db.from('account_contacts').update({ active: false }).eq('id', id);
  loadContactsTab();
}


// ============================================================
// QUOTES TAB
// ============================================================
async function loadAccountQuotes() {
  const el = document.getElementById('acct-detail-quotes');
  const { data: jobs } = await db.from('jobs').select('id').eq('account_id', currentDetailAcctId);
  if (!jobs?.length) { el.innerHTML = '<p class="meta">No quote forms.</p>'; return; }
  const jobIds = jobs.map(j => j.id);
  const { data: quotes } = await db.from('quote_forms')
    .select('*').in('job_id', jobIds).order('created_at', { ascending: false });
  if (!quotes?.length) { el.innerHTML = '<p class="meta">No quote forms on record.</p>'; return; }
  el.innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>Job ID</th><th>Created</th><th>Scope Observed</th><th>Locked</th></tr></thead>
    <tbody>${quotes.map(q => `<tr>
      <td style="font-size:0.77rem;color:#5a6075">${q.job_id.slice(0,8)}...</td>
      <td style="font-size:0.82rem;white-space:nowrap">${new Date(q.created_at).toLocaleDateString('en-US')}</td>
      <td style="font-size:0.82rem;max-width:200px">${q.scope_observed||''}</td>
      <td style="font-size:0.82rem">${q.locked_at ? 'Yes' : 'No'}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
}


// ============================================================
// PHOTOS TAB
// ============================================================
async function loadAccountPhotos() {
  const el = document.getElementById('acct-detail-photos');
  const { data: photos, error } = await db.from('job_photos')
    .select('id,storage_path,file_name,uploaded_at,job_id')
    .eq('account_id', currentDetailAcctId)
    .order('uploaded_at', { ascending: false });
  if (error || !photos?.length) { el.innerHTML = '<p class="meta">No photos on file.</p>'; return; }
  const withUrls = await fetchPhotoUrls(photos);
  el.innerHTML = `<p style="font-size:0.82rem;color:#5a6075;margin-bottom:0.55rem">${photos.length} photo(s) across all jobs.</p>`;
  const gridEl = document.createElement('div');
  el.appendChild(gridEl);
  renderPhotoGrid(gridEl, withUrls, true);
}


// ============================================================
// INSTRUCTIONS TAB
// ============================================================
function loadInstructions() {
  const a = allAccountsData.find(x => x.id === currentDetailAcctId);
  document.getElementById('instructions-text').value = a?.instructions || '';
}

async function saveInstructions() {
  const text = document.getElementById('instructions-text').value;
  const { error } = await db.from('accounts').update({ instructions: text || null }).eq('id', currentDetailAcctId);
  const msgEl = document.getElementById('instructions-msg');
  if (error) { msgEl.style.color = '#a02020'; msgEl.textContent = 'Save failed: ' + error.message; return; }
  const a = allAccountsData.find(x => x.id === currentDetailAcctId);
  if (a) a.instructions = text;
  msgEl.style.color = '#2a7a4a';
  msgEl.textContent = 'Saved.';
  setTimeout(() => msgEl.textContent = '', 2000);
}


// ============================================================
// DETAIL TABS
// ============================================================
function switchDetailTab(tab) {
  ['history','contacts','quotes','photos','instructions'].forEach(t => {
    document.getElementById(`dtab-${t}-panel`).style.display = t === tab ? '' : 'none';
    const btn = document.getElementById(`dtab-${t}`);
    if (btn) btn.className = t === tab ? 'btn btn-primary' : 'btn btn-secondary';
  });
  if (tab === 'contacts')     loadContactsTab();
  if (tab === 'quotes')       loadAccountQuotes();
  if (tab === 'photos')       loadAccountPhotos();
  if (tab === 'instructions') loadInstructions();
}


// ============================================================
// EXPORT CSV (accounts list)
// ============================================================
function exportAccountsCSV() {
  if (!filteredAccountsData.length) { alert('No accounts to export.'); return; }
  const rows = [['Name','Type','Parent Account','Address','Phone','Primary Contact','Jobs','Last Service','Active']];
  filteredAccountsData.forEach(a => {
    const stats  = allJobsByAccount[a.id] || {};
    const parent = a.parent_account_id ? allAccountsData.find(x => x.id === a.parent_account_id)?.account_name || '' : '';
    const pc     = allPrimaryContacts[a.id];
    rows.push([
      a.account_name, a.parent_account_id ? 'Sub' : 'Master', parent,
      a.address||'', a.phone||'',
      pc ? `${pc.contact_name}${pc.work_phone ? ' | '+pc.work_phone : ''}` : '',
      stats.count||0, formatDate(stats.lastDate)||'', a.active ? 'Yes' : 'No'
    ]);
  });
  downloadCSV(rows, 'faithlock_accounts');
}

async function exportAccountDetailCSV() {
  const a = allAccountsData.find(x => x.id === currentDetailAcctId);
  if (!a) return;
  const { data: jobs } = await db.from('jobs')
    .select(`id,job_date,status,scope,work_order_number,purchase_order_number,
             sub:accounts!jobs_sub_account_id_fkey(account_name),
             job_types(job_type_name),
             job_completions(time_in,time_out,payment_type,payment_detail,tech_notes,follow_up_flag),
             job_line_items(item_type,item_id,unit_cost,override_cost,quantity)`)
    .eq('account_id', currentDetailAcctId).order('job_date', { ascending: false });
  if (!jobs?.length) { alert('No jobs to export for this account.'); return; }
  const rows = [['Account','Date','Sub-Account','Job Type','WO','PO','Status','Payment Type','Total','Follow-up','Tech Notes']];
  jobs.forEach(j => {
    const comp  = j.job_completions?.[0] || {};
    const total = (j.job_line_items||[]).reduce((s,i) => s+((i.override_cost??i.unit_cost)*i.quantity), 0);
    rows.push([
      a.account_name, formatDate(j.job_date), j.sub?.account_name||'',
      j.job_types?.job_type_name||'', j.work_order_number||'', j.purchase_order_number||'',
      j.status, comp.payment_type||'', total.toFixed(2),
      comp.follow_up_flag ? 'Yes' : 'No', comp.tech_notes||''
    ]);
  });
  downloadCSV(rows, `faithlock_account_${a.account_name.replace(/[^a-z0-9]/gi,'_')}`);
}
