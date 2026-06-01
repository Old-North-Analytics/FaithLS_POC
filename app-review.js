// app-review.js -- Review Queue
// Depends on globals: currentUser, allParts, allLaborTypes, openReopen

async function loadReview() {
  const status = document.getElementById('rv-status').value;
  let query = db.from('jobs')
    .select(`id, job_date, status, scope, site_notes, is_fixed_price, quote_amount,
             job_number, work_order_number, purchase_order_number,
             accounts!jobs_account_id_fkey(account_name, account_number, address),
             sub:accounts!jobs_sub_account_id_fkey(account_name, sub_account_number),
             job_types(job_type_name),
             job_completions(id,time_in,time_out,payment_type,payment_detail,follow_up_flag,tech_notes,submitted_at),
             job_line_items(id,item_type,item_id,quantity,unit_cost,override_cost,override_reason,notes),
             job_visits(id,visit_number,visit_date,clocked_in_at,clocked_out_at,tech_notes),
             admin_reviews(review_status,review_notes,reviewed_at),
             quote_forms(scope_observed,materials_json,created_at)`)
    .order('job_date', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  const el = document.getElementById('review-list');
  if (error) { el.innerHTML = `<div class="msg error">${error.message}</div>`; return; }
  if (!data?.length) { el.innerHTML = '<p class="meta">No jobs found.</p>'; return; }

  const pending = data.filter(j => j.status === 'Pending Review');
  document.getElementById('bulk-approve-btn').style.display = pending.length > 1 ? '' : 'none';
  el.innerHTML = data.map(j => reviewCard(j)).join('');
}

function reviewCard(j) {
  const account = j.accounts?.account_name || '';
  const sub     = j.sub?.account_name ? ` / ${j.sub.account_name}` : '';
  const comp    = j.job_completions?.[0] || {};
  const items   = j.job_line_items || [];

  // Build item rows -- pricing visible to admin
  function itemRow(i, label) {
    const unitCost = Number(i.unit_cost);
    const effCost  = i.override_cost != null ? Number(i.override_cost) : unitCost;
    const ext      = effCost * Number(i.quantity);
    return `<tr>
      <td>${i.item_type}</td>
      <td>${label}</td>
      <td>${i.quantity}</td>
      <td>$${unitCost.toFixed(2)}</td>
      <td><input type="number" step="0.01" placeholder="${unitCost.toFixed(2)}"
          value="${i.override_cost != null ? i.override_cost : ''}"
          style="width:80px;padding:0.2rem 0.3rem;border:1px solid #c8cdd8;border-radius:3px"
          onchange="setOverride('${i.id}',this.value,'reason-${i.id}')"></td>
      <td><input type="text" id="reason-${i.id}" placeholder="Reason"
          value="${escHtml(i.override_reason||'')}"
          style="width:130px;padding:0.2rem 0.3rem;border:1px solid #c8cdd8;border-radius:3px"></td>
      <td><strong>$${ext.toFixed(2)}</strong></td>
    </tr>`;
  }

  const partRows   = items.filter(i => i.item_type === 'Part')
    .map(i => itemRow(i, allParts.find(p => p.id === i.item_id)?.part_name || i.item_id)).join('');
  const laborRows  = items.filter(i => i.item_type === 'Labor')
    .map(i => itemRow(i, (allLaborTypes.find(l => l.id === i.item_id)?.labor_type_name || i.item_id) + ' (hrs)')).join('');
  const chargeRows = items.filter(i => i.item_type === 'Service Call' || i.item_type === 'Other')
    .map(i => itemRow(i, i.override_reason || i.item_type)).join('');

  const totalRev   = calcRevenue(items);
  const fixedBanner = j.is_fixed_price
    ? `<div class="fixed-banner">FIXED PRICE | Quoted: $${Number(j.quote_amount || 0).toFixed(2)}</div>` : '';

  const wopo = [
    j.work_order_number     ? `WO: ${j.work_order_number}`     : '',
    j.purchase_order_number ? `PO: ${j.purchase_order_number}` : ''
  ].filter(Boolean).join(' | ');

  const qf = j.quote_forms?.[0];
  const quoteSection = qf ? `
    <div class="section-title">Quote Form</div>
    ${qf.scope_observed ? `<p style="font-size:0.84rem;margin:0.25rem 0"><strong>Scope observed:</strong> ${qf.scope_observed}</p>` : ''}
    ${qf.materials_json ? `<p style="font-size:0.84rem;margin:0.25rem 0"><strong>Materials / notes:</strong> ${
      Array.isArray(qf.materials_json) ? qf.materials_json.map(m => m.notes || JSON.stringify(m)).join('; ') : JSON.stringify(qf.materials_json)
    }</p>` : ''}
    <p style="font-size:0.77rem;color:#888">Submitted: ${fmtDateTime(qf.created_at)}</p>` : '';

  const lastReview = j.admin_reviews?.length
    ? j.admin_reviews[j.admin_reviews.length - 1] : null;

  const ref = jobRef(j.accounts?.account_number, j.sub?.sub_account_number, j.job_number);
  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.4rem">
      <div>
        <h3 style="margin-bottom:0.2rem">${account}${sub}</h3>
        <div class="meta">${formatDate(j.job_date)} | ${j.job_types?.job_type_name || ''}${ref ? ` | <span style="font-family:monospace;color:#6b6fa8">${ref}</span>` : ''}</div>
        ${j.accounts?.address ? `<div class="meta">${mapsLink(j.accounts.address)}</div>` : ''}
        ${wopo ? `<div class="meta" style="color:#1a2744;font-weight:500">${wopo}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem">
        <span class="status-badge status-${j.status.replace(/ /g,'-')}">${j.status}</span>
        ${totalRev > 0 ? `<span style="font-size:0.82rem;color:#2a7a4a;font-weight:600">$${totalRev.toFixed(2)}</span>` : ''}
      </div>
    </div>
    ${fixedBanner}
    <div style="margin-top:0.65rem;display:flex;flex-wrap:wrap;gap:0.25rem">
      <button class="btn btn-secondary btn-sm" onclick="toggleExpand('exp-${j.id}')">Details</button>
      <button class="btn btn-green btn-sm"     onclick="reviewAction('${j.id}','Approved')">Approve</button>
      <button class="btn btn-yellow btn-sm"    onclick="reviewAction('${j.id}','Flagged')">Flag</button>
      <button class="btn btn-secondary btn-sm" onclick="reviewAction('${j.id}','Reset')">Reset</button>
      <button class="btn btn-blue btn-sm"      onclick="openReopen('${j.id}')">Edit</button>
      <button class="btn btn-secondary btn-sm" onclick="printJob('${j.id}')">Print</button>
    </div>

    <div id="exp-${j.id}" class="expandable">
      ${j.scope      ? `<div class="section-title">Scope</div><p style="font-size:0.87rem;margin:0.25rem 0">${j.scope}</p>` : ''}
      ${j.site_notes ? `<div class="section-title">Site Notes</div><p style="font-size:0.87rem;margin:0.25rem 0">${j.site_notes}</p>` : ''}

      <div class="section-title">Visits</div>
      ${j.job_visits?.length ? `<div style="overflow-x:auto"><table>
        <thead><tr><th>Visit</th><th>Date</th><th>In</th><th>Out</th><th>Notes</th></tr></thead>
        <tbody>${(j.job_visits||[]).sort((a,b)=>a.visit_number-b.visit_number).map(v=>`<tr>
          <td>${v.visit_number}</td>
          <td style="white-space:nowrap">${formatDate(v.visit_date)}</td>
          <td style="font-size:0.81rem;white-space:nowrap">${v.clocked_in_at  ? fmtDateTime(v.clocked_in_at)  : '--'}</td>
          <td style="font-size:0.81rem;white-space:nowrap">${v.clocked_out_at ? fmtDateTime(v.clocked_out_at) : '--'}</td>
          <td style="font-size:0.81rem">${v.tech_notes||''}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="meta">No visits recorded.</p>'}

      <div class="section-title">Completion</div>
      <div style="background:#f8f9fc;border-radius:4px;padding:0.55rem;font-size:0.84rem;line-height:1.7">
        <strong>Time In:</strong> ${fmtDateTime(comp.time_in)} &nbsp;|&nbsp;
        <strong>Time Out:</strong> ${fmtDateTime(comp.time_out)} &nbsp;|&nbsp;
        <strong>Payment:</strong> ${comp.payment_type || '--'} ${comp.payment_detail || ''} &nbsp;|&nbsp;
        <strong>Follow-up:</strong> ${comp.follow_up_flag ? '<span style="color:#a02020;font-weight:600">YES</span>' : 'No'} &nbsp;|&nbsp;
        <strong>Submitted:</strong> ${fmtDateTime(comp.submitted_at)}
      </div>
      ${comp.tech_notes ? `<div style="margin-top:0.45rem;font-size:0.84rem"><strong>Tech Notes:</strong> ${comp.tech_notes}</div>` : ''}

      ${items.length ? `
        <div class="section-title">Line Items</div>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>Type</th><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Override</th><th>Override Reason</th><th>Extended</th></tr></thead>
          <tbody>${partRows}${laborRows}${chargeRows}</tbody>
        </table></div>` : '<p class="meta">No line items.</p>'}

      ${quoteSection}

      <div class="section-title">Photos</div>
      <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;margin-bottom:0.45rem">
        <input type="file" id="aphoto-${j.id}" accept="image/*" multiple style="font-size:0.84rem">
        <button class="btn btn-primary btn-sm" onclick="uploadAdminPhotos('${j.id}')">Upload Photos</button>
        <span id="aphoto-msg-${j.id}" style="font-size:0.81rem;color:#2a7a4a"></span>
      </div>
      <div id="job-photos-${j.id}" style="margin-bottom:0.45rem">
        <span style="font-size:0.81rem;color:#aaa">Click "Load Photos" to view.</span>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="loadJobPhotos('${j.id}')">Load Photos</button>

      <div class="section-title">Admin Note</div>
      <div style="display:flex;gap:0.4rem;margin-top:0.3rem">
        <input type="text" id="rnote-${j.id}" placeholder="Add a review note..."
          style="flex:1;padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px">
        <button class="btn btn-primary btn-sm" onclick="saveReviewNote('${j.id}')">Save Note</button>
      </div>
      ${lastReview ? `<div style="font-size:0.81rem;margin-top:0.35rem;color:#444;background:#f8f9fc;padding:0.38rem 0.55rem;border-radius:4px">
        Last note: ${lastReview.review_notes || ''} (${lastReview.review_status})</div>` : ''}
    </div>
  </div>`;
}

function toggleExpand(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

async function reviewAction(jobId, action) {
  const statusMap = { Approved: 'Approved', Flagged: 'Flagged', Reset: 'Pending Review' };
  await db.from('jobs').update({ status: statusMap[action], updated_at: new Date().toISOString() }).eq('id', jobId);
  await db.from('admin_reviews').insert({ job_id: jobId, review_status: action, reviewed_by: currentUser.id });
  refreshBadges();
  loadReview();
}

async function saveReviewNote(jobId) {
  const note = document.getElementById(`rnote-${jobId}`).value.trim();
  if (!note) { alert('Enter a note before saving.'); return; }
  await db.from('admin_reviews').insert({
    job_id: jobId, review_status: 'Note', review_notes: note, reviewed_by: currentUser.id
  });
  document.getElementById(`rnote-${jobId}`).value = '';
  // Refresh the card so the note shows inline
  loadReview();
}

async function bulkApprove() {
  if (!confirm('Approve all Pending Review jobs?')) return;
  const { data } = await db.from('jobs').select('id').eq('status', 'Pending Review');
  if (!data?.length) return;
  await db.from('jobs').update({ status: 'Approved', updated_at: new Date().toISOString() }).eq('status', 'Pending Review');
  const reviews = data.map(j => ({ job_id: j.id, review_status: 'Approved', reviewed_by: currentUser.id }));
  await db.from('admin_reviews').insert(reviews);
  refreshBadges();
  loadReview();
}

async function setOverride(lineItemId, val, reasonFieldId) {
  const reason = document.getElementById(reasonFieldId)?.value || '';
  await db.from('job_line_items').update({
    override_cost:   val ? parseFloat(val) : null,
    override_reason: reason || null
  }).eq('id', lineItemId);
}

async function uploadAdminPhotos(jobId) {
  const input = document.getElementById(`aphoto-${jobId}`);
  const msgEl = document.getElementById(`aphoto-msg-${jobId}`);
  if (!input.files?.length) { msgEl.textContent = 'No files selected.'; return; }
  msgEl.textContent = 'Uploading...';
  const { data: job } = await db.from('jobs').select('account_id').eq('id', jobId).single();
  let uploaded = 0;
  for (const file of input.files) {
    const resized = await resizeImage(file, 1200);
    const path    = `${jobId}/admin_${Date.now()}_${file.name}`;
    const { error } = await db.storage.from('job-photos').upload(path, resized);
    if (error) continue;
    await db.from('job_photos').insert({
      job_id: jobId, account_id: job?.account_id || null,
      storage_path: path, file_name: file.name, uploaded_by: currentUser.id
    });
    uploaded++;
  }
  msgEl.textContent = `${uploaded} photo(s) uploaded.`;
  input.value = '';
  await loadJobPhotos(jobId);
}

async function loadJobPhotos(jobId) {
  const grid = document.getElementById(`job-photos-${jobId}`);
  if (!grid) return;
  grid.innerHTML = '<span style="font-size:0.81rem;color:#aaa">Loading...</span>';
  const { data: photos } = await db.from('job_photos')
    .select('id,storage_path,file_name,uploaded_at').eq('job_id', jobId)
    .order('uploaded_at', { ascending: false });
  if (!photos?.length) {
    grid.innerHTML = '<span style="font-size:0.81rem;color:#aaa">No photos uploaded yet.</span>';
    return;
  }
  const withUrls = await fetchPhotoUrls(photos);
  renderPhotoGrid(grid, withUrls, true);
}
