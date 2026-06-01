// app-reference.js -- Reference / Settings CRUD and User Management

// ============================================================
// TAB SWITCHER
// ============================================================
function showRefTab(tab) {
  ['parts','jobtypes','labortypes','techs','users','templates'].forEach(t => {
    const el  = document.getElementById(`ref-${t}`);
    if (el)  el.style.display = t === tab ? '' : 'none';
    const btn = document.getElementById(`reftab-${t}`);
    if (btn) btn.className = t === tab ? 'btn btn-primary' : 'btn btn-secondary';
  });
  if (tab === 'parts')      renderPartsRef();
  if (tab === 'jobtypes')   renderJobTypesRef();
  if (tab === 'labortypes') renderLaborTypesRef();
  if (tab === 'techs')      renderTechsRef();
  if (tab === 'users')      loadUsersTab();
  if (tab === 'templates')  renderTemplatesRef();
}


// ============================================================
// PARTS
// ============================================================
async function renderPartsRef() {
  const { data, error } = await db.from('parts').select('*').order('part_name');
  if (error) { document.getElementById('parts-ref-body').innerHTML = `<tr><td colspan="7" style="color:#a02020">${error.message}</td></tr>`; return; }
  document.getElementById('parts-ref-body').innerHTML = (data || []).map(p => {
    const stock = p.stock_qty || 0;
    const lowBadge = stock < 3 ? '<span style="font-size:0.69rem;background:#ffe8cc;color:#7a3800;padding:0.1rem 0.32rem;border-radius:3px;margin-left:0.3rem">Low</span>' : '';
    return `<tr>
      <td>${escHtml(p.part_name)}</td>
      <td>${escHtml(p.category || '')}</td>
      <td>${escHtml(p.unit || '')}</td>
      <td>$${Number(p.unit_cost).toFixed(2)}</td>
      <td style="white-space:nowrap">
        <input type="number" min="0" value="${stock}" title="Quantity on hand"
          style="width:58px;padding:0.2rem 0.3rem;border:1px solid #c8cdd8;border-radius:3px;text-align:center"
          onchange="updateStockQty('${p.id}',this.value)">${lowBadge}
      </td>
      <td>${p.active ? 'Yes' : '<span style="color:#bbb">No</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-secondary btn-sm" onclick="togglePartActive('${p.id}',${p.active})">${p.active ? 'Deactivate' : 'Activate'}</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="color:#aaa;font-style:italic">None</td></tr>';
  allParts = (data || []).filter(p => p.active);
}

async function updateStockQty(partId, rawVal) {
  const qty = Math.max(0, parseInt(rawVal, 10) || 0);
  await db.from('parts').update({ stock_qty: qty }).eq('id', partId);
  // Refresh allParts in memory
  const p = allParts.find(x => x.id === partId);
  if (p) p.stock_qty = qty;
}

async function addPart() {
  const name = document.getElementById('rp-name').value.trim();
  const msg  = document.getElementById('parts-ref-msg');
  if (!name) { msg.innerHTML = '<div class="msg error">Part name is required.</div>'; return; }
  const { error } = await db.from('parts').insert({
    part_name: name,
    category:  document.getElementById('rp-category').value.trim() || null,
    unit:      document.getElementById('rp-unit').value.trim()     || null,
    unit_cost: parseFloat(document.getElementById('rp-cost').value) || 0
  });
  if (error) { msg.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  msg.innerHTML = '<div class="msg success">Part added.</div>';
  ['rp-name','rp-category','rp-unit','rp-cost'].forEach(id => document.getElementById(id).value = '');
  await renderPartsRef();
  // Refresh assign form dropdown
  populateSelect('a-labortype', allLaborTypes, 'id', 'labor_type_name', 'Select type...');
}

async function togglePartActive(id, current) {
  await db.from('parts').update({ active: !current }).eq('id', id);
  await renderPartsRef();
}


// ============================================================
// JOB TYPES
// ============================================================
async function renderJobTypesRef() {
  const { data } = await db.from('job_types').select('*').order('job_type_name');
  document.getElementById('jobtypes-ref-body').innerHTML = (data || []).map(jt => `
    <tr>
      <td>${jt.job_type_name}</td>
      <td>${jt.category || ''}</td>
      <td>${jt.flat_rate != null ? '$' + Number(jt.flat_rate).toFixed(2) : ''}</td>
      <td>${jt.active ? 'Yes' : '<span style="color:#bbb">No</span>'}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="toggleJobTypeActive('${jt.id}',${jt.active})">${jt.active ? 'Deactivate' : 'Activate'}</button></td>
    </tr>`).join('') || '<tr><td colspan="5" style="color:#aaa;font-style:italic">None</td></tr>';
  allJobTypes = (data || []).filter(j => j.active);
  populateSelect('a-jobtype', allJobTypes, 'id', 'job_type_name', '-- Select --');
}

async function addJobType() {
  const name = document.getElementById('rjt-name').value.trim();
  if (!name) return;
  await db.from('job_types').insert({
    job_type_name: name,
    category:  document.getElementById('rjt-category').value.trim() || null,
    flat_rate: parseFloat(document.getElementById('rjt-rate').value) || null
  });
  ['rjt-name','rjt-category','rjt-rate'].forEach(id => document.getElementById(id).value = '');
  await renderJobTypesRef();
}

async function toggleJobTypeActive(id, current) {
  await db.from('job_types').update({ active: !current }).eq('id', id);
  await renderJobTypesRef();
}


// ============================================================
// LABOR TYPES
// ============================================================
async function renderLaborTypesRef() {
  const { data } = await db.from('labor_types').select('*').order('labor_type_name');
  document.getElementById('labortypes-ref-body').innerHTML = (data || []).map(lt => `
    <tr>
      <td>${lt.labor_type_name}</td>
      <td>$${Number(lt.hourly_rate).toFixed(2)}/hr</td>
      <td><button class="btn btn-red btn-sm" onclick="deleteLaborType('${lt.id}')">Delete</button></td>
    </tr>`).join('') || '<tr><td colspan="3" style="color:#aaa;font-style:italic">None</td></tr>';
  allLaborTypes = data || [];
  populateSelect('a-labortype', allLaborTypes, 'id', 'labor_type_name', 'Select type...');
}

async function addLaborType() {
  const name = document.getElementById('rlt-name').value.trim();
  const rate = parseFloat(document.getElementById('rlt-rate').value);
  if (!name || isNaN(rate)) return;
  await db.from('labor_types').insert({ labor_type_name: name, hourly_rate: rate });
  ['rlt-name','rlt-rate'].forEach(id => document.getElementById(id).value = '');
  await renderLaborTypesRef();
}

async function deleteLaborType(id) {
  if (!confirm('Delete this labor type?')) return;
  await db.from('labor_types').delete().eq('id', id);
  await renderLaborTypesRef();
}


// ============================================================
// TECHS
// ============================================================
async function renderTechsRef() {
  const { data: techs } = await db.from('techs').select('id,tech_name,active,user_id').order('tech_name');
  const { data: profiles } = await db.from('user_profiles').select('id,display_name').order('display_name');
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]));

  document.getElementById('techs-ref-body').innerHTML = (techs || []).map(t => {
    const linkedUser = t.user_id ? (profileMap[t.user_id] || t.user_id.slice(0,8) + '...') : '--';
    const profileOpts = `<option value="">-- None --</option>` +
      (profiles || []).map(p => `<option value="${p.id}" ${p.id === t.user_id ? 'selected' : ''}>${p.display_name || p.id.slice(0,8)}</option>`).join('');
    return `<tr>
      <td>${t.tech_name}</td>
      <td>
        <select onchange="linkTechUser('${t.id}',this.value)" style="padding:0.2rem 0.35rem;border:1px solid #c8cdd8;border-radius:3px;font-size:0.82rem">
          ${profileOpts}
        </select>
      </td>
      <td>${t.active ? 'Yes' : '<span style="color:#bbb">No</span>'}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="toggleTechActive('${t.id}',${t.active})">${t.active ? 'Deactivate' : 'Activate'}</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" style="color:#aaa;font-style:italic">None</td></tr>';

  allTechs = (techs || []).filter(t => t.active);
  populateSelect('a-leadtech', allTechs, 'id', 'tech_name', '-- Select Lead --');
  populateMultiSelect('a-techs', allTechs, 'id', 'tech_name');
  const techSel = document.getElementById('sv-tech');
  if (techSel) {
    techSel.innerHTML = '<option value="">All Techs</option>' +
      allTechs.map(t => `<option value="${t.id}">${t.tech_name}</option>`).join('');
  }
}

async function addTech() {
  const name = document.getElementById('rt-name').value.trim();
  if (!name) return;
  await db.from('techs').insert({ tech_name: name });
  document.getElementById('rt-name').value = '';
  await renderTechsRef();
}

async function toggleTechActive(id, current) {
  await db.from('techs').update({ active: !current }).eq('id', id);
  await renderTechsRef();
}

async function linkTechUser(techId, userId) {
  await db.from('techs').update({ user_id: userId || null }).eq('id', techId);
  // Refresh Milton check -- if the current admin just got linked, show My Jobs
  if (userId === currentUser?.id || !userId) {
    const { data: techRow } = await db.from('techs')
      .select('id,tech_name').eq('user_id', currentUser.id).maybeSingle();
    currentTechRow = techRow || null;
    document.getElementById('nav-myjobs').style.display = currentTechRow ? '' : 'none';
  }
}


// ============================================================
// USERS (Phase 1)
// ============================================================
async function loadUsersTab() {
  const el = document.getElementById('users-list');
  el.innerHTML = '<p class="meta">Loading...</p>';

  const { data: profiles, error } = await db.from('user_profiles')
    .select('id,role,display_name,active,created_at').order('created_at');
  if (error) { el.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  if (!profiles?.length) { el.innerHTML = '<p class="meta">No user profiles found.</p>'; return; }

  // Load techs to show linkage
  const { data: techRows } = await db.from('techs').select('id,tech_name,user_id').order('tech_name');
  const techByUserId = Object.fromEntries((techRows || []).filter(t => t.user_id).map(t => [t.user_id, t.tech_name]));

  el.innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr>
      <th>Display Name</th><th>Role</th><th>Linked Tech</th><th>Active</th><th>User ID</th><th></th>
    </tr></thead>
    <tbody>
    ${profiles.map(p => `<tr>
      <td>
        <input type="text" value="${escHtml(p.display_name||'')}" id="uname-${p.id}"
          style="padding:0.22rem 0.38rem;border:1px solid #c8cdd8;border-radius:3px;width:150px;font-size:0.84rem">
      </td>
      <td>
        <select id="urole-${p.id}" style="padding:0.22rem 0.38rem;border:1px solid #c8cdd8;border-radius:3px;font-size:0.84rem">
          <option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="tech"  ${p.role === 'tech'  ? 'selected' : ''}>Tech</option>
        </select>
      </td>
      <td style="font-size:0.82rem">${techByUserId[p.id] || '--'}</td>
      <td>
        <input type="checkbox" id="uactive-${p.id}" ${p.active ? 'checked' : ''}>
      </td>
      <td style="font-size:0.72rem;color:#888;font-family:monospace">${p.id.slice(0,13)}...</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="saveUserProfile('${p.id}')">Save</button>
      </td>
    </tr>`).join('')}
    </tbody>
  </table></div>`;
}

async function saveUserProfile(userId) {
  const name   = document.getElementById(`uname-${userId}`).value.trim();
  const role   = document.getElementById(`urole-${userId}`).value;
  const active = document.getElementById(`uactive-${userId}`).checked;

  const { error } = await db.from('user_profiles')
    .update({ display_name: name || null, role, active }).eq('id', userId);

  if (error) { alert('Save failed: ' + error.message); return; }
  // Refresh techs ref if role changes affect linkage visibility
  await loadUsersTab();
}

async function addUserProfile() {
  const id   = document.getElementById('nu-id').value.trim();
  const name = document.getElementById('nu-name').value.trim();
  const role = document.getElementById('nu-role').value;
  const techId = document.getElementById('nu-tech').value;
  const msg  = document.getElementById('nu-msg');
  msg.innerHTML = '';

  if (!id || !name) {
    msg.innerHTML = '<div class="msg error">User ID and display name are required.</div>';
    return;
  }
  // Basic UUID check
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    msg.innerHTML = '<div class="msg error">User ID does not look like a valid UUID. Copy it from the Supabase Auth dashboard.</div>';
    return;
  }

  const { error: profErr } = await db.from('user_profiles').insert({
    id, role, display_name: name, active: true
  });
  if (profErr) { msg.innerHTML = `<div class="msg error">${profErr.message}</div>`; return; }

  if (techId) {
    await db.from('techs').update({ user_id: id }).eq('id', techId);
  }

  msg.innerHTML = '<div class="msg success">User profile created.</div>';
  document.getElementById('nu-id').value   = '';
  document.getElementById('nu-name').value = '';
  document.getElementById('nu-tech').value = '';
  await loadUsersTab();
}


// ============================================================
// JOB TEMPLATES (subdued -- Settings > Templates tab)
// ============================================================
async function renderTemplatesRef() {
  const el = document.getElementById('templates-list');
  if (!el) return;
  el.innerHTML = '<p class="meta">Loading...</p>';

  const { data, error } = await db.from('job_templates')
    .select(`*, account:accounts!job_templates_account_id_fkey(account_name),
             jt:job_types!job_templates_job_type_id_fkey(job_type_name),
             lt:techs!job_templates_lead_tech_id_fkey(tech_name)`)
    .order('name');

  if (error) { el.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  if (!(data && data.length)) {
    el.innerHTML = '<p class="meta">No templates yet. Add one above.</p>';
    return;
  }

  el.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Account</th><th>Job Type</th><th>Lead Tech</th><th>Active</th><th></th></tr></thead>
    <tbody>${(data || []).map(t => `<tr>
      <td style="font-weight:600">${escHtml(t.name)}</td>
      <td style="font-size:0.82rem">${escHtml(t.account?.account_name || '')}</td>
      <td style="font-size:0.82rem">${escHtml(t.jt?.job_type_name    || '')}</td>
      <td style="font-size:0.82rem">${escHtml(t.lt?.tech_name        || '')}</td>
      <td style="font-size:0.82rem">${t.active ? 'Yes' : '<span style="color:#bbb">No</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-secondary btn-sm" onclick="toggleTemplateActive('${t.id}',${t.active})">${t.active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-red btn-sm"       onclick="deleteTemplate('${t.id}')">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;

  // Also refresh the assign form select
  if (typeof loadTemplatesForSelect === 'function') loadTemplatesForSelect();
}

function openAddTemplate() {
  document.getElementById('template-add-form').style.display = '';
  document.getElementById('tmpl-name').focus();
}

function closeAddTemplate() {
  document.getElementById('template-add-form').style.display = 'none';
  ['tmpl-name','tmpl-account','tmpl-scope','tmpl-sitenotes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('tmpl-account-id').value   = '';
  document.getElementById('tmpl-jobtype').value      = '';
  document.getElementById('tmpl-leadtech').value     = '';
  document.getElementById('tmpl-subaccount').innerHTML = '<option value="">-- None --</option>';
  document.getElementById('tmpl-msg').innerHTML      = '';
}

function searchTemplateAccount() {
  const input   = document.getElementById('tmpl-account');
  const results = document.getElementById('tmpl-account-results');
  const q = input.value.toLowerCase().trim();
  if (!q) { results.style.display = 'none'; document.getElementById('tmpl-account-id').value = ''; return; }
  const masters = allAccounts.filter(a => !a.parent_account_id && a.account_name.toLowerCase().includes(q)).slice(0, 10);
  if (!masters.length) { results.style.display = 'none'; return; }
  results.innerHTML = masters.map(a =>
    `<div data-id="${a.id}" data-name="${escHtml(a.account_name)}">${a.account_name}</div>`).join('');
  results.style.display = 'block';
  results.querySelectorAll('div').forEach(div => {
    div.addEventListener('mousedown', e => {
      e.preventDefault();
      document.getElementById('tmpl-account').value    = div.dataset.name;
      document.getElementById('tmpl-account-id').value = div.dataset.id;
      results.style.display = 'none';
      // Load sub-accounts
      const subs = allAccounts.filter(a => a.parent_account_id === div.dataset.id);
      const subSel = document.getElementById('tmpl-subaccount');
      subSel.innerHTML = '<option value="">-- None --</option>' +
        subs.map(s => `<option value="${s.id}">${escHtml(s.account_name)}</option>`).join('');
    });
  });
}

async function saveTemplate() {
  const name = document.getElementById('tmpl-name').value.trim();
  const msg  = document.getElementById('tmpl-msg');
  msg.innerHTML = '';
  if (!name) { msg.innerHTML = '<div class="msg error">Template name is required.</div>'; return; }

  const { error } = await db.from('job_templates').insert({
    name,
    account_id:     document.getElementById('tmpl-account-id').value  || null,
    sub_account_id: document.getElementById('tmpl-subaccount').value  || null,
    job_type_id:    document.getElementById('tmpl-jobtype').value     || null,
    lead_tech_id:   document.getElementById('tmpl-leadtech').value    || null,
    scope:          document.getElementById('tmpl-scope').value.trim()      || null,
    site_notes:     document.getElementById('tmpl-sitenotes').value.trim()  || null,
    created_by:     currentUser.id
  });
  if (error) { msg.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  msg.innerHTML = '<div class="msg success">Template saved.</div>';
  setTimeout(() => { closeAddTemplate(); renderTemplatesRef(); }, 700);
}

async function toggleTemplateActive(id, current) {
  await db.from('job_templates').update({ active: !current }).eq('id', id);
  await renderTemplatesRef();
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template? This cannot be undone.')) return;
  await db.from('job_templates').delete().eq('id', id);
  await renderTemplatesRef();
}
