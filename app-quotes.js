// app-quotes.js -- Quotes Pipeline
// Shows jobs submitted as quote forms from the tech app (status='Quoted').
// Admin can schedule them as real jobs, reject, or note activity.

let quotesData = [];
let quoteBuilderOpen = null; // qId of currently open builder panel

// ============================================================
// ENTRY POINT
// ============================================================
async function loadQuotes() {
  const sec = document.getElementById('section-quotes');
  if (!sec) return;

  sec.innerHTML = `
    <div style="display:flex;gap:0.45rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:1rem">
      <button class="btn btn-primary" onclick="loadQuotes()">Refresh</button>
      <span id="quotes-count" class="meta" style="align-self:center"></span>
    </div>
    <div id="quotes-list"><p class="meta">Loading...</p></div>
  `;

  await refreshQuotes();
}

async function refreshQuotes() {
  const list = document.getElementById('quotes-list');
  if (!list) return;
  list.innerHTML = '<p class="meta">Loading...</p>';

  const { data, error } = await db.from('jobs')
    .select(`id, job_date, scope, site_notes, is_fixed_price, quote_amount,
             work_order_number, purchase_order_number,
             accounts!jobs_account_id_fkey(id, account_name),
             sub:accounts!jobs_sub_account_id_fkey(account_name),
             job_types(job_type_name),
             lead_tech:techs!jobs_lead_tech_id_fkey(tech_name),
             job_completions(tech_notes, submitted_at, submitted_by),
             job_visits(visit_date, tech_notes)`)
    .eq('status', 'Quoted')
    .order('job_date', { ascending: true });

  if (error) {
    list.innerHTML = `<div class="msg error">${error.message}</div>`;
    return;
  }

  quotesData = data || [];

  const countEl = document.getElementById('quotes-count');
  if (countEl) countEl.textContent = `${quotesData.length} open quote${quotesData.length === 1 ? '' : 's'}`;

  if (!quotesData.length) {
    list.innerHTML = '<p class="meta">No open quotes.</p>';
    return;
  }

  list.innerHTML = quotesData.map(q => quoteCard(q)).join('');
}

// ============================================================
// QUOTE CARD
// ============================================================
function quoteCard(q) {
  const acct  = q.accounts?.account_name || 'Unknown';
  const sub   = q.sub?.account_name ? ` / ${q.sub.account_name}` : '';
  const comp  = q.job_completions?.[0];
  const tech  = q.lead_tech?.tech_name || '';
  const visit = (q.job_visits || []).sort((a,b) => b.visit_date.localeCompare(a.visit_date))[0];
  const visitDate = visit ? formatDate(visit.visit_date) : formatDate(q.job_date);

  return `<div class="card" id="qcard-${q.id}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.3rem;flex-wrap:wrap;gap:0.35rem">
      <h3 style="margin:0;font-size:0.97rem">${escHtml(acct)}${escHtml(sub)}</h3>
      <span class="status-badge status-Quoted">Quoted</span>
    </div>
    <div class="meta" style="margin-bottom:0.22rem">Site visit: ${visitDate}${tech ? ' | Tech: ' + escHtml(tech) : ''}</div>

    ${comp?.tech_notes ? `
      <div style="margin:0.45rem 0">
        <div class="section-title" style="margin-bottom:0.25rem">Tech Notes</div>
        <p style="font-size:0.85rem;margin:0;color:#333;white-space:pre-wrap">${escHtml(comp.tech_notes)}</p>
      </div>` : ''}

    ${q.scope ? `
      <div style="margin:0.45rem 0">
        <div class="section-title" style="margin-bottom:0.25rem">Scope Observed</div>
        <p style="font-size:0.85rem;margin:0;color:#333;white-space:pre-wrap">${escHtml(q.scope)}</p>
      </div>` : ''}

    ${q.site_notes ? `
      <div style="margin:0.45rem 0">
        <div class="section-title" style="margin-bottom:0.25rem">Materials / Notes</div>
        <p style="font-size:0.85rem;margin:0;color:#333;white-space:pre-wrap">${escHtml(q.site_notes)}</p>
      </div>` : ''}

    <!-- Convert to job form (hidden) -->
    <div id="qconvert-${q.id}" style="display:none;margin-top:0.75rem;background:#f8f9fc;border:1px solid #dde1ea;border-radius:5px;padding:0.9rem">
      <div class="section-title">Schedule as Job</div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-end">
        <div>
          <label style="font-size:0.79rem;font-weight:600;display:block;margin-bottom:0.2rem;color:#4a5070">Date *</label>
          <input type="date" id="qdate-${q.id}" style="padding:0.38rem 0.55rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.86rem">
        </div>
        <div style="flex:2;min-width:140px">
          <label style="font-size:0.79rem;font-weight:600;display:block;margin-bottom:0.2rem;color:#4a5070">Lead Tech</label>
          <select id="qtech-${q.id}" style="width:100%;padding:0.38rem 0.55rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.86rem">
            <option value="">-- Select --</option>
            ${allTechs.map(t => `<option value="${t.id}">${escHtml(t.tech_name)}</option>`).join('')}
          </select>
        </div>
        <div style="flex:3;min-width:180px">
          <label style="font-size:0.79rem;font-weight:600;display:block;margin-bottom:0.2rem;color:#4a5070">Quote Amount $</label>
          <input type="number" id="qamt-${q.id}" step="0.01" placeholder="0.00"
                 style="width:100%;padding:0.38rem 0.55rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.86rem">
        </div>
      </div>
      <div id="qconvert-msg-${q.id}" style="margin-top:0.45rem"></div>
      <div style="margin-top:0.55rem;display:flex;gap:0.35rem;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="quoteConvert('${q.id}')">Schedule Job</button>
        <button class="btn btn-secondary" onclick="toggleConvertForm('${q.id}')">Cancel</button>
      </div>
    </div>

    <div id="qreject-${q.id}" style="display:none;margin-top:0.75rem;background:#fff8f8;border:1px solid #f4aaaa;border-radius:5px;padding:0.9rem">
      <div class="section-title" style="color:#a02020">Reject Quote</div>
      <div class="form-row">
        <label>Reason (optional)</label>
        <textarea id="qrejectnote-${q.id}" style="height:52px;width:100%;padding:0.48rem 0.6rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.86rem;font-family:inherit"></textarea>
      </div>
      <div id="qreject-msg-${q.id}" style="margin-bottom:0.35rem"></div>
      <button class="btn btn-warn" onclick="quoteReject('${q.id}')">Confirm Reject</button>
      <button class="btn btn-secondary" onclick="toggleRejectForm('${q.id}')">Cancel</button>
    </div>

    <div style="margin-top:0.75rem;display:flex;gap:0.35rem;flex-wrap:wrap" id="qactions-${q.id}">
      <button class="btn btn-primary"   onclick="toggleConvertForm('${q.id}')">Schedule as Job</button>
      <button class="btn btn-secondary" onclick="toggleQuoteBuilder('${q.id}')">Build Quote PDF</button>
      <button class="btn btn-warn"      onclick="toggleRejectForm('${q.id}')">Reject</button>
    </div>

    <!-- Quote PDF Builder (hidden until toggled) -->
    <div id="qbuilder-${q.id}" style="display:none;margin-top:0.75rem;background:#f4f6fb;border:1px solid #c8cdd8;border-radius:5px;padding:0.95rem">
      <div class="section-title" style="margin-top:0">Quote Document Builder</div>
      <p class="meta" style="margin-bottom:0.7rem">Select which fields to include. Edit any value before generating.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem 1.2rem;margin-bottom:0.8rem">
        <label style="font-size:0.82rem;display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="qb-acct-${q.id}" checked> Account name and address</label>
        <label style="font-size:0.82rem;display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="qb-contact-${q.id}" checked> Primary contact</label>
        <label style="font-size:0.82rem;display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="qb-visitdate-${q.id}" checked> Date of site visit</label>
        <label style="font-size:0.82rem;display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="qb-scope-${q.id}" checked> Scope of work</label>
        <label style="font-size:0.82rem;display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="qb-materials-${q.id}"> Materials / notes</label>
        <label style="font-size:0.82rem;display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="qb-ref-${q.id}"> Job reference number</label>
        <label style="font-size:0.82rem;display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="qb-tech-${q.id}"> Tech name</label>
        <label style="font-size:0.82rem;display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="qb-amount-${q.id}" checked> Quote amount</label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.65rem">
        <div class="form-row">
          <label style="font-size:0.79rem">Quote Amount $</label>
          <input type="number" id="qb-amtval-${q.id}" step="0.01" placeholder="0.00"
            value="${q.is_fixed_price && q.quote_amount ? q.quote_amount : ''}"
            style="padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px;width:100%">
        </div>
        <div class="form-row">
          <label style="font-size:0.79rem">Valid Through</label>
          <input type="date" id="qb-valid-${q.id}"
            style="padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px;width:100%">
        </div>
        <div class="form-row">
          <label style="font-size:0.79rem">Prepared By</label>
          <input type="text" id="qb-prepby-${q.id}" placeholder="Name"
            style="padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px;width:100%">
        </div>
      </div>
      <div class="form-row">
        <label style="font-size:0.79rem">Additional Notes (shown on quote)</label>
        <textarea id="qb-addnotes-${q.id}" style="height:48px;width:100%;padding:0.38rem;border:1px solid #c8cdd8;border-radius:4px;font-size:0.85rem;font-family:inherit;resize:vertical"></textarea>
      </div>
      <div style="margin-top:0.55rem;display:flex;gap:0.35rem">
        <button class="btn btn-primary" onclick="generateQuotePDF('${q.id}')">Generate PDF</button>
        <button class="btn btn-secondary" onclick="toggleQuoteBuilder('${q.id}')">Cancel</button>
      </div>
    </div>
  </div>`;
}

// ============================================================
// TOGGLE FORMS
// ============================================================
function toggleConvertForm(qId) {
  const form = document.getElementById(`qconvert-${qId}`);
  const rejectForm = document.getElementById(`qreject-${qId}`);
  if (!form) return;
  const open = form.style.display !== 'none';
  form.style.display = open ? 'none' : '';
  if (!open && rejectForm) rejectForm.style.display = 'none';
  // Pre-fill today's date
  const dateEl = document.getElementById(`qdate-${qId}`);
  if (dateEl && !dateEl.value) dateEl.value = today();
}

function toggleRejectForm(qId) {
  const form = document.getElementById(`qreject-${qId}`);
  const convertForm = document.getElementById(`qconvert-${qId}`);
  if (!form) return;
  const open = form.style.display !== 'none';
  form.style.display = open ? 'none' : '';
  if (!open && convertForm) convertForm.style.display = 'none';
}

// ============================================================
// CONVERT TO JOB
// ============================================================
async function quoteConvert(qId) {
  const msgEl  = document.getElementById(`qconvert-msg-${qId}`);
  const date   = document.getElementById(`qdate-${qId}`)?.value;
  const techId = document.getElementById(`qtech-${qId}`)?.value;
  const amt    = parseFloat(document.getElementById(`qamt-${qId}`)?.value) || null;

  if (!date) {
    if (msgEl) msgEl.innerHTML = '<div class="msg error">Date is required.</div>';
    return;
  }

  const q = quotesData.find(x => x.id === qId);
  if (!q) return;

  const update = {
    status:           'Scheduled',
    job_date:         date,
    is_fixed_price:   amt != null,
    quote_amount:     amt,
    updated_at:       new Date().toISOString()
  };
  if (techId) {
    update.lead_tech_id    = techId;
    update.assigned_tech_ids = [techId];
  }

  const { error } = await db.from('jobs').update(update).eq('id', qId);
  if (error) {
    if (msgEl) msgEl.innerHTML = `<div class="msg error">${error.message}</div>`;
    return;
  }

  // Create a visit row for the scheduled date, using the next available visit_number.
  // (A visit may already exist from when the job was submitted as a quote.)
  const { count: existingVisits } = await db.from('job_visits')
    .select('id', { count: 'exact', head: true }).eq('job_id', qId);
  await db.from('job_visits').insert({
    job_id:       qId,
    visit_number: (existingVisits || 0) + 1,
    visit_date:   date
  });

  await refreshQuotes();
  refreshBadges();
}

// ============================================================
// REJECT QUOTE
// ============================================================
async function quoteReject(qId) {
  const msgEl  = document.getElementById(`qreject-msg-${qId}`);
  const note   = document.getElementById(`qrejectnote-${qId}`)?.value.trim();

  const { error } = await db.from('jobs').update({
    status:     'Cancelled',
    scope:      note ? `[Rejected: ${note}]` : '[Rejected by admin]',
    updated_at: new Date().toISOString()
  }).eq('id', qId);

  if (error) {
    if (msgEl) msgEl.innerHTML = `<div class="msg error">${error.message}</div>`;
    return;
  }

  await refreshQuotes();
  refreshBadges();
}


// ============================================================
// QUOTE PDF BUILDER
// ============================================================
function toggleQuoteBuilder(qId) {
  const panel = document.getElementById(`qbuilder-${qId}`);
  if (!panel) return;

  // Close any other open builder
  if (quoteBuilderOpen && quoteBuilderOpen !== qId) {
    const prev = document.getElementById(`qbuilder-${quoteBuilderOpen}`);
    if (prev) prev.style.display = 'none';
  }

  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  quoteBuilderOpen = isOpen ? null : qId;

  // Close convert/reject forms if builder opens
  if (!isOpen) {
    const cf = document.getElementById(`qconvert-${qId}`);
    const rf = document.getElementById(`qreject-${qId}`);
    if (cf) cf.style.display = 'none';
    if (rf) rf.style.display = 'none';
  }
}

async function generateQuotePDF(qId) {
  const q = quotesData.find(x => x.id === qId);
  if (!q) return;

  const inc = id => document.getElementById(`${id}-${qId}`)?.checked;
  const val = id => document.getElementById(`${id}-${qId}`)?.value?.trim() || '';

  const showAcct      = inc('qb-acct');
  const showContact   = inc('qb-contact');
  const showVisitDate = inc('qb-visitdate');
  const showScope     = inc('qb-scope');
  const showMaterials = inc('qb-materials');
  const showRef       = inc('qb-ref');
  const showTech      = inc('qb-tech');
  const showAmount    = inc('qb-amount');
  const amtVal        = val('qb-amtval');
  const validThrough  = val('qb-valid');
  const prepBy        = val('qb-prepby');
  const addNotes      = val('qb-addnotes');

  // Fetch full data for PDF
  const { data: job } = await db.from('jobs')
    .select(`*, accounts!jobs_account_id_fkey(account_name, address, account_number),
             sub:accounts!jobs_sub_account_id_fkey(account_name, sub_account_number),
             job_types(job_type_name),
             lead_tech:techs!jobs_lead_tech_id_fkey(tech_name),
             job_visits(visit_date), job_number`)
    .eq('id', qId).single();

  let contactHtml = '';
  if (showContact && job?.account_id) {
    const { data: contacts } = await db.from('account_contacts')
      .select('contact_name,title,work_phone,cell_phone,email,is_primary')
      .eq('account_id', job.account_id).eq('active', true)
      .order('is_primary', { ascending: false });
    const primary = (contacts || []).find(c => c.is_primary) || (contacts || [])[0];
    if (primary) {
      contactHtml = `<strong>${primary.contact_name}</strong>`;
      if (primary.title)      contactHtml += ` &bull; ${primary.title}`;
      contactHtml += '<br>';
      if (primary.work_phone) contactHtml += `Work: ${primary.work_phone}&nbsp;&nbsp;`;
      if (primary.cell_phone) contactHtml += `Cell: ${primary.cell_phone}&nbsp;&nbsp;`;
      if (primary.email)      contactHtml += primary.email;
    }
  }

  const ref = job ? jobRef(job.accounts?.account_number, job.sub?.sub_account_number, job.job_number) : '';
  const visits = (job?.job_visits || []).sort((a,b) => b.visit_date.localeCompare(a.visit_date));
  const visitDate = visits.length ? formatDate(visits[0].visit_date) : formatDate(q.job_date);

  const amountDisplay = amtVal
    ? `$${Number(amtVal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : (q.is_fixed_price && q.quote_amount ? `$${Number(q.quote_amount).toFixed(2)}` : 'To be determined');

  const validHtml = validThrough ? formatDate(validThrough) : '30 days from date of issue';

  const rows = [
    showAcct && job?.accounts?.account_name
      ? `<tr><td>Customer</td><td><strong>${job.accounts.account_name}</strong>${job.sub?.account_name ? ' / ' + job.sub.account_name : ''}${job.accounts.address ? '<br>' + job.accounts.address : ''}</td></tr>` : '',
    showContact && contactHtml
      ? `<tr><td>Contact</td><td>${contactHtml}</td></tr>` : '',
    showVisitDate
      ? `<tr><td>Site Visit</td><td>${visitDate}</td></tr>` : '',
    showRef && ref
      ? `<tr><td>Job Reference</td><td style="font-family:monospace">${ref}</td></tr>` : '',
    showTech && job?.lead_tech?.tech_name
      ? `<tr><td>Technician</td><td>${job.lead_tech.tech_name}</td></tr>` : '',
    showAmount
      ? `<tr><td>Quote Amount</td><td><strong style="font-size:1.05rem">${amountDisplay}</strong></td></tr>` : '',
    `<tr><td>Valid Through</td><td>${validHtml}</td></tr>`,
  ].filter(Boolean).join('');

  const html = `<!DOCTYPE html><html><head>
    <title>Quote &ndash; ${job?.accounts?.account_name || 'Customer'}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; padding: 40px 48px; font-size: 0.82rem; color: #1a1a2e; background: white; }
      .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a2744; padding-bottom: 14px; margin-bottom: 20px; }
      .co-name { font-size: 1.1rem; font-weight: 700; color: #1a2744; }
      .co-sub  { font-size: 0.72rem; color: #5a6075; margin-top: 2px; }
      .doc-title { font-size: 1rem; font-weight: 700; color: #6b6fa8; text-align: right; }
      .doc-date  { font-size: 0.72rem; color: #5a6075; text-align: right; margin-top: 3px; }
      table.info { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
      table.info td { padding: 7px 10px; border-bottom: 1px solid #eef0f6; font-size: 0.82rem; }
      table.info td:first-child { width: 140px; font-weight: 600; color: #6b6fa8; text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.05em; }
      .section-title { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6fa8; margin: 18px 0 6px; border-bottom: 1px solid #dde1ea; padding-bottom: 4px; }
      .scope-box { background: #f4f6fb; border-left: 3px solid #1a2744; padding: 10px 14px; font-size: 0.82rem; line-height: 1.55; border-radius: 0 3px 3px 0; }
      .notes-box { background: #fffbe8; border: 1px solid #e0d870; padding: 10px 14px; font-size: 0.82rem; line-height: 1.55; border-radius: 3px; margin-top: 12px; }
      .signature { margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
      .sig-line  { border-top: 1px solid #888; padding-top: 6px; font-size: 0.72rem; color: #666; }
      .footer    { margin-top: 28px; border-top: 1px solid #dde1ea; padding-top: 8px; font-size: 0.68rem; color: #aaa; display: flex; justify-content: space-between; }
      @media print { @page { margin: 0.5in; } body { padding: 0; } }
    </style>
  </head><body>
    <div class="hdr">
      <div>
        <div class="co-name">Faith Lock &amp; Safe Co.</div>
        <div class="co-sub">Pegram, TN &bull; Locksmith &bull; Safe Service &bull; Access Control</div>
      </div>
      <div>
        <div class="doc-title">SERVICE QUOTE</div>
        <div class="doc-date">Issued: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        ${prepBy ? `<div class="doc-date">Prepared by: ${prepBy}</div>` : ''}
      </div>
    </div>
    <table class="info">${rows}</table>
    ${showScope && q.scope ? `<div class="section-title">Scope of Work</div><div class="scope-box">${q.scope.replace(/\n/g,'<br>')}</div>` : ''}
    ${showMaterials && q.site_notes ? `<div class="section-title">Materials / Notes</div><div class="scope-box">${q.site_notes.replace(/\n/g,'<br>')}</div>` : ''}
    ${addNotes ? `<div class="notes-box"><strong>Additional Notes:</strong><br>${addNotes.replace(/\n/g,'<br>')}</div>` : ''}
    <div class="signature">
      <div><div class="sig-line">Authorized Signature &bull; Faith Lock &amp; Safe Co.</div></div>
      <div><div class="sig-line">Customer Acceptance &bull; Date</div></div>
    </div>
    <div class="footer">
      <span>Faith Lock &amp; Safe Co. &bull; Pegram, TN</span>
      <span>Valid ${validHtml}</span>
    </div>
    <script>window.onload = () => window.print();<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}
