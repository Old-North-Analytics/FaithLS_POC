// ============================================================
// shared.js — Faith Lock & Safe Job Management System
//
// Utilities shared by admin.html, tech.html, accounts.html, and index.html.
// This file must be loaded AFTER the Supabase CDN script tag and BEFORE each
// page's own <script> block so these globals are available everywhere.
//
// Load order in every HTML file:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="shared.js"></script>
//   <script> /* page-specific code here */ </script>
// ============================================================


// ---- SUPABASE CONNECTION ----
// One place to update credentials if they ever change.
//
// The ANON KEY is safe to expose in client-side code — it only identifies the
// project. Actual data access is controlled by Row Level Security (RLS) policies
// defined on each Supabase table and enforced server-side, so users can only
// read/write what the policies allow regardless of what they send.
const SUPABASE_URL = 'https://jmsrlhqbzstuczxilxua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptc3JsaHFienN0dWN6eGlseHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzA5NDcsImV4cCI6MjA5MjQwNjk0N30.jpHtuhezvfRXJ2uVhwglqS_rImZl8JqqBX85WUv2Z5g';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ---- DATE HELPERS ----

// formatDate: converts a Postgres date string (YYYY-MM-DD) to MM/DD/YYYY for display.
//
// WHY we split on '-' instead of using new Date():
//   new Date('2025-01-15') creates midnight UTC. In US timezones (behind UTC),
//   that renders as Jan 14. Splitting avoids any timezone math entirely.
function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${m}/${d}/${y}`;
}

// today: returns today's date as YYYY-MM-DD — the format Postgres date fields expect.
function today() {
  return new Date().toISOString().split('T')[0];
}

// tomorrow: returns tomorrow's date as YYYY-MM-DD.
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// weekStart: returns the most recent Monday as YYYY-MM-DD.
// Used by the admin schedule range shortcut and the tech weekly job filter.
// The formula (day + 6) % 7 maps Sunday=0..Saturday=6 to days-since-Monday.
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().split('T')[0];
}

// nowLocal: returns the current local datetime as YYYY-MM-DDTHH:MM.
// This is the exact format required by <input type="datetime-local">.
//
// WHY we can't use .toISOString() directly:
//   toISOString() returns UTC time. Subtracting the timezone offset converts
//   it to local time before slicing, so the field shows the correct local hour.
function nowLocal() {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}


// ---- SELECT DROPDOWN HELPERS ----

// populateSelect: fills a <select> element's options from an array of objects.
//
//   id          — HTML element id of the <select> to populate
//   items       — array of objects (e.g. rows returned from Supabase)
//   valueKey    — property name to use as each <option>'s value (usually 'id')
//   labelKey    — property name to use as each <option>'s visible text
//   placeholder — text for the first blank/default option (e.g. '-- Select Account --')
//
// Example: populateSelect('a-account', accounts, 'id', 'account_name', '-- Select --')
function populateSelect(id, items, valueKey, labelKey, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(i => `<option value="${i[valueKey]}">${i[labelKey]}</option>`).join('');
}

// populateMultiSelect: same as populateSelect but without a blank first option.
// Used for multi-select inputs (e.g. "Assign Techs") where no default selection
// is needed and every option should be selectable independently.
function populateMultiSelect(id, items, valueKey, labelKey) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(i => `<option value="${i[valueKey]}">${i[labelKey]}</option>`).join('');
}


// ---- REVENUE CALCULATION ----

// calcRevenue: sums the billed cost across all line items for a job.
//
// Line items have a unit_cost from the catalog, but an admin can override it.
// The ?? (nullish coalescing) operator picks override_cost only when it is not
// null/undefined — so a deliberate $0 override is honored, but a missing
// override falls back to the catalog unit_cost.
function calcRevenue(lineItems) {
  return (lineItems || []).reduce(
    (sum, i) => sum + ((i.override_cost ?? i.unit_cost) * i.quantity),
    0
  );
}


// ---- IMAGE RESIZE ----

// resizeImage: scales an image file down to maxW pixels wide before uploading.
// Keeps storage costs low and page-load times fast without losing useful detail.
// Never upscales — if the image is already smaller than maxW, it is unchanged.
// Returns a Promise<Blob> (JPEG at 85% quality).
function resizeImage(file, maxW) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width); // clamp: never enlarge
      const canvas = document.createElement('canvas');
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
      URL.revokeObjectURL(url); // free memory
    };
    img.src = url;
  });
}


// ---- CSV EXPORT ----

// downloadCSV: converts a 2D array into a .csv file and triggers a browser download.
//
//   rows     — array of arrays; the first row should be column headers
//   filename — base file name without the .csv extension
//
// Each cell value is wrapped in double-quotes, and any " in the value is
// escaped as "" per the CSV standard, so commas and quotes in data are safe.
function downloadCSV(rows, filename) {
  const csv = rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


// ---- PHOTO GRID ----

// fetchPhotoUrls: given an array of job_photos rows from Supabase, fetches a
// short-lived signed URL for each photo.
//
// WHY signed URLs: the job-photos storage bucket is private (not public).
// Signed URLs grant temporary read access (7200 seconds = 2 hours) without
// making the bucket public. Falls back to a public URL if signing fails
// (e.g. if the bucket is later changed to public).
//
// Returns the same array with a 'url' property added to each item.
async function fetchPhotoUrls(photos) {
  return Promise.all(photos.map(async p => {
    const { data: signed } = await db.storage
      .from('job-photos')
      .createSignedUrl(p.storage_path, 7200);
    if (signed?.signedUrl) return { ...p, url: signed.signedUrl };
    // Fallback: public URL (works if bucket policy is set to public)
    const { data: pub } = db.storage.from('job-photos').getPublicUrl(p.storage_path);
    return { ...p, url: pub?.publicUrl || null };
  }));
}

// renderPhotoGrid: builds a thumbnail grid and injects it into gridEl (a DOM element).
//
//   gridEl   — the container DOM element to fill
//   withUrls — array of photo objects (each with a 'url' property from fetchPhotoUrls)
//   showDate — whether to show the upload date under each thumbnail (default true)
//
// Each thumbnail is 100×80px, links to the full-size photo in a new tab,
// and shows the filename below. If the image fails to load (broken URL),
// a grey fallback box with the filename is shown instead.
//
// ⚠ IMPORTANT — the onerror attribute uses &quot; for quote characters inside
//   the inline style string. This is intentional and correct:
//   When this string is assigned to innerHTML, the HTML parser decodes &quot; → "
//   before the browser sees it as an attribute value.
//   Do NOT replace &quot; with template literal ${ } expressions — the JS parser
//   runs before HTML decoding inside <script> blocks and would see a syntax error.
//   The filename is passed via data-name attribute (HTML-encoded) to avoid
//   quote/injection issues in the event handler.
function renderPhotoGrid(gridEl, withUrls, showDate = true) {
  if (!withUrls.length) {
    gridEl.innerHTML = '<span style="font-size:0.82rem;color:#aaa">No photos yet.</span>';
    return;
  }
  gridEl.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">' +
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
              style="width:100px;height:80px;object-fit:cover;border:1px solid #ccc;display:block;cursor:pointer"
              data-name="${safeName}"
              onerror="this.parentElement.innerHTML='<div style=&quot;width:100px;height:80px;background:#eee;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:0.75rem;padding:4px&quot;>'+this.dataset.name+'</div>'">
          </a>
          <div style="font-size:0.72rem;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">
            <a href="${p.url}" target="_blank" style="color:#1a4a8a">${label}</a>
          </div>
          ${dateHtml}
        </div>`;
      } else {
        return `<div style="text-align:center">
          <div style="width:100px;height:80px;background:#eee;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:0.75rem;padding:4px">${label}</div>
          <div style="font-size:0.72rem;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${label}</div>
          ${dateHtml}
        </div>`;
      }
    }).join('') +
    '</div>';
}


// ---- MAPS LINK ----

// mapsLink: wraps an address string in a Google Maps link that opens in a new tab.
// Returns an empty string if no address is provided (safe to use inline without null checks).
// The ↗ arrow (&#8599;) gives a visual hint that the link opens externally.
// Useful for field techs who need turn-by-turn directions to job sites.
function mapsLink(address) {
  if (!address) return '';
  return `<a href="https://maps.google.com/?q=${encodeURIComponent(address)}" target="_blank"
    style="color:#1a4a8a;text-decoration:none">${address} &#8599;</a>`;
}


// ---- SIGN OUT ----

// logout: signs the current user out of Supabase (invalidates their auth token)
// and redirects to the login page. Called from the Sign Out button in every header.
async function logout() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}
