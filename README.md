# Faith Lock & Safe | Job Management System

Web-based job management tool for Faith Lock & Safe Co. Replaces a paper daily sheet workflow with a digital system for job assignment, tech field view, completion forms, admin review, and QuickBooks CSV export.

Built by Old North Analytics, LLC.

---

## Live Site

[https://old-north-analytics.github.io/FaithLS_POC/](https://old-north-analytics.github.io/FaithLS_POC/)

---

## Stack

| Component | Details |
|-----------|---------|
| **Frontend** | Vanilla HTML and JavaScript. No framework, no build step. Multi-module SPA behind a hash router. |
| **Database** | Supabase (PostgreSQL). Tables, indexes, RLS policies, and storage bucket all configured. Project ID: jmsrlhqbzstuczxilxua |
| **Auth** | Supabase Auth (email/password). Role stored in `user_profiles` table. |
| **Storage** | Supabase Storage, bucket: `job-photos`. Photos resized client-side to 1200px max before upload. |
| **Export** | Client-side CSV generation. Downloads directly from the browser. No server-side processing. |
| **Hosting** | GitHub Pages. Static file serving. Any push to `main` redeploys automatically. |

API keys and credentials are in Supabase > Settings > API. Do not commit service role keys or secrets to this repo. The anon/public key embedded in the HTML files is safe to expose -- RLS is enforced at the database level.

---

## File Structure

```
/
├── index.html            # Login -- routes to admin or tech view by role
├── app.html              # Admin SPA -- all admin sections behind hash router
├── tech.html             # Tech field interface -- job cards, completion form, new job, new customer
├── admin.html            # Redirect to app.html (backward compatibility)
├── accounts.html         # Redirect to app.html#accounts (backward compatibility)
├── schedule.html         # Redirect to app.html#dispatch (backward compatibility)
├── shared.js             # Supabase client, auth, date helpers, photo upload, shared utilities
├── export-config.js      # QuickBooks CSV field map -- single source of truth for export columns
├── app-accounts.js       # Accounts CRM section
├── app-activitylog.js    # Activity log section
├── app-dashboard.js      # Dashboard KPIs and summary panels
├── app-dispatch.js       # Dispatch board, calendar view, assign job form, job templates
├── app-export.js         # QuickBooks CSV export section
├── app-myjobs.js         # My Jobs panel (Milton hybrid admin/tech view)
├── app-quotes.js         # Quotes pipeline and PDF builder
├── app-reference.js      # Reference data CRUD (parts, job types, labor types, techs, templates)
├── app-review.js         # Review queue
├── app-stockprep.js      # Stock Prep / truck stocking view
└── docs/
    └── uat_package.md    # UAT test scenarios and feedback collection
```

---

## Roles and Access

| Name | Email | Password | Role |
|------|-------|----------|------|
| Rich | rich@faithlock.test | admin | Admin |
| Milton | milton@faithlock.test | admin | Admin + My Jobs (hybrid) |
| Zach | zach@faithlock.test | tech | Tech |
| Thomas | thomas@faithlock.test | tech | Tech |

Legacy shared accounts (`admin@faithlock.test`, `tech@faithlock.test`) remain active as a fallback.

Role is determined by the `role` column in `user_profiles`. The Milton hybrid activates when an admin's auth UID matches a row in the `techs` table. Pricing is excluded from all tech-facing queries at the query level.

---

## Core Workflow

1. **Admin assigns a job** -- date, account, sub-account, job type, lead tech, assigned techs, scope, site notes, WO/PO numbers. Optional: pre-load expected parts and labor, flag as fixed price with quote amount.
2. **Tech sees the job** on their My Jobs view filtered to Today by default. Fixed price jobs show a red warning banner. Expected parts and labor show in a blue banner.
3. **Tech clocks in** from the job card, setting status to In Progress with a timestamp.
4. **Tech submits the completion form** -- time in/out, parts used, labor type and hours, service call fee, Other charges, payment info, notes, photos.
5. **Admin reviews and approves** -- or flags, edits, reopens, or adds a visit date for a return trip.
6. **Admin exports** completed job data as CSV for QuickBooks Desktop import.

---

## Key Features

**Admin**
- Multi-tech assignment with designated lead; edit date, sub-account, and tech assignment after creation
- Pre-loaded expected parts and labor at assignment
- Fixed price flag with quote amount (red banner on tech card)
- WO and PO number fields on job record
- Reopen and edit any submitted job including all line items, completion details, and visit clock times
- Multi-visit support: add a return visit date to an existing job
- Dispatch board grouped by date, filterable by account, job type, and status
- Calendar view: weekly, tech-filterable, color-coded by status
- Activity log: all clock events, completions, and reviews with period filters
- Stock Prep view: aggregated parts and labor totals for truck stocking
- Quote pipeline and PDF builder: selectable fields, printable output
- Job templates for recurring job types
- Parts inventory tracking with low-stock flags
- Reference data CRUD: parts, job types, labor types and rates
- New Customers queue: holds field-submitted records for admin migration

**Tech**
- Job card shows sub-account address (not master), primary contact, site notes, WO/PO
- Clock In/Clock Out with live In Progress status; soft block if already clocked in on another job
- Job Details form: time in/out with Now shortcuts, parts search, labor, service call, Other charges, payment, notes, photos
- Unsubmit: pull back a submitted job before admin reviews it
- New Job and New Customer submission from the field

**Accounts (CRM)**
- Master and sub-account model with sortable list view
- Multi-contact per account: primary, secondary, on-site flags; name, phone, cell, email, company
- Per-account job history with date range and status filters
- Per-account photo library
- Account instructions tab (gate codes, billing notes, access restrictions)
- CSV export

---

## Deploying

No build step. All files are static.

**GitHub Pages:** Settings > Pages > Source: `main` branch, root folder. Any push to `main` redeploys automatically within ~60 seconds.

To use a different platform (e.g., Cloudflare Pages): connect the repo, leave build command and publish directory blank.

---

## Go-Live Checklist

- [x] Individual auth accounts created for Rich, Milton, Zach, Thomas
- [ ] `assigned_tech_ids` and `lead_tech_id` migrated to store auth UUIDs (currently store techs-table UUIDs; requires code change to assign form and tech filtering)
- [ ] Default passwords changed to strong passwords for all accounts
- [ ] Old shared accounts (admin@faithlock.test, tech@faithlock.test) deactivated
- [ ] Real accounts, parts, job types, and labor rates entered in Reference Data
- [ ] QuickBooks Desktop export tested and confirmed with Brenda
- [ ] All techs confirmed on capable mobile browsers
- [ ] First field trial completed on a lower-volume day
- [ ] Supabase project transferred to Faith Lock account (or new project created under their account)
- [ ] GitHub repo transferred or access granted to Faith Lock

---

## Open Questions

| Question | Status |
|----------|--------|
| QuickBooks Desktop import format and field order | Open -- Brenda to confirm |
| All techs on capable mobile devices | Open -- Milton to verify during UAT |
| Reference data population ownership and timeline | Open |
| Standard service call rate | Open -- required before service call line item can be pre-populated |
| Definition of done for field trial | Open |
| Quote output format confirmed with customers | Resolved -- PDF builder added, selectable fields per generation |

---

## Contact

Thomas Johnson | Old North Analytics, LLC  
[info@oldnorthanalytics.com](mailto:info@oldnorthanalytics.com) | 919-307-1722 | [oldnorthanalytics.com](https://oldnorthanalytics.com)
