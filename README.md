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
| **Frontend** | Vanilla HTML and JavaScript. No framework, no build step. |
| **Database** | Supabase (PostgreSQL). Tables, indexes, RLS policies, and storage bucket all configured. |
| **Auth** | Supabase Auth (email/password). Role stored in `user_profiles` table. |
| **Storage** | Supabase Storage, bucket: `job-photos`. Photos resized client-side to 1200px max before upload. |
| **Export** | Client-side CSV generation. Downloads directly from the browser. No server-side processing. |
| **Hosting** | GitHub Pages. Static file serving. Any push to `main` redeploys automatically. |

API keys and credentials are in Supabase > Settings > API. Do not commit service role keys or secrets to this repo. The anon/public key embedded in the HTML files is safe to expose -- RLS is enforced at the database level.

---

## File Structure

```
/
├── index.html          # Login -- routes to admin or tech view by role
├── admin.html          # Admin interface: assign, review, calendar, reference data, new customers
├── tech.html           # Tech interface: job cards, completion form, new job, new customer
├── accounts.html       # CRM: account list, detail view, contacts, instructions, photos, export
├── schedule.html       # Standalone schedule viewer: Today/This Week/Custom Range, edit access, stocking view
├── shared.js           # Shared utilities: Supabase client, date helpers, select helpers, photo upload
└── docs/
    └── (markdown versions of internal docs for in-repo rendering)
```

---

## Roles and Access

| Role | Login | Access |
|------|-------|--------|
| Admin | admin@faithlock.test | Full access: assign, review, accounts, reference data, export, schedule |
| Tech | tech@faithlock.test | Field view only: job cards, completion form, new job, new customer |

Role is determined by the `role` column in the `user_profiles` table, not by the login credentials alone. Pricing columns are excluded from all tech-facing queries at the query level.

---

## Core Workflow

1. **Admin assigns a job** -- date, account, job type, lead tech, assigned techs, scope, site notes, WO/PO numbers. Optional: pre-load expected parts and labor, flag as fixed price with quote amount.
2. **Tech sees the job** on their My Jobs view filtered to Today by default. Fixed price jobs show a red warning banner. Expected parts/labor show in a blue banner.
3. **Tech clocks in** from the job card, setting status to In Progress with a timestamp.
4. **Tech submits the completion form** -- time in/out, parts used, labor type and hours, service call fee, Other charges, payment info, notes, photos. Submission moves the job to Pending Review.
5. **Admin reviews and approves** -- or flags, edits, reopens, or adds a day for a return visit.
6. **Admin exports** completed job data as CSV for QuickBooks Desktop import.

---

## Key Features

**Admin**
- Multi-tech assignment with designated lead
- Pre-loaded expected parts and labor at assignment
- Fixed price flag with quote amount (red banner on tech card)
- WO and PO number fields on job record
- Reopen and edit any submitted job, including all line items
- Duplicate last job (copies account, job type, lead tech)
- Bulk approve all Pending Review jobs at once
- Calendar view: weekly, tech-filterable, color-coded by status
- Schedule viewer: standalone page with Today/This Week/Custom Range filters, edit access, and truck stocking view
- Reference data CRUD: parts, job types, labor types and rates -- editable inline, never visible to techs
- New Customers queue: holds submitted new customer records for migration to account list
- Account instructions stored per account record

**Tech**
- Job card filters: Today (default), This Week, All Open
- Clock In/Clock Out with live In Progress status
- Job Details form: time in/out with Now shortcuts, parts search, labor, service call, Other charges, payment, notes, photos
- Unsubmit: pull back a submitted job before admin reviews it
- New Job and New Customer submission from the field view

**Accounts (CRM)**
- Account list with detail view: address, phone, billing notes, instructions, contacts, photos
- Multi-contact model per account (account_contacts table): primary/secondary flag, name, phone, cell, email, company
- Per-account photo library (all job photos associated with the account)
- CSV export

---

## Deploying

No build step. All files are static.

**GitHub Pages:** Settings > Pages > Source: `main` branch, root folder. Any push to `main` redeploys automatically.

To use a different platform (e.g., Cloudflare Pages): connect the repo, leave build command and publish directory blank.

---

## Database Setup

The schema is in `faithlock_schema.sql` (run once in Supabase SQL Editor to create all tables, indexes, and RLS policies). Sample data is in `sample_data.sql`.

After running the schema:
1. Create auth users in Supabase > Authentication > Users
2. Insert their UUIDs and roles into the `user_profiles` table
3. Insert tech names into the `techs` table
4. Populate reference data: accounts, parts catalog, job types, labor types and rates

---


## Go-Live Checklist

Full checklist is in `docs/FaithLock_WorkingDoc_v2.2.docx`, Section 9. Short version:

- [ ] Individual auth accounts created for Milton, Zach, and Thomas
- [ ] `assigned_tech_ids` and `lead_tech_id` updated to store auth UUIDs
- [ ] POC limitations above resolved
- [ ] Default passwords changed (admin and tech logins)
- [ ] Real accounts, parts, job types, and labor rates entered in Reference Data
- [ ] `account_contacts` table created and wired into accounts view
- [ ] Account instructions column added to DB and wired up
- [ ] QuickBooks Desktop export tested and confirmed with Brenda
- [ ] All techs confirmed on capable mobile browsers (Milton to verify)
- [ ] First field trial completed on a lower-volume day
- [ ] Supabase project transferred to Faith Lock account
- [ ] GitHub repo transferred or access granted to Faith Lock

---

## Open Questions

| Question | Status |
|----------|--------|
| QuickBooks Desktop import format and field order | Open -- Brenda to confirm |
| All techs on capable mobile devices | Open -- Milton to verify during UAT |
| Reference data population ownership and timeline | Open |
| Quote output format for customers | Open -- determines whether quote form must produce a document |
| Standard service call rate | Open -- required before service call line item can be pre-populated |
| Definition of done for field trial | Open |

---

## Contact

Thomas Johnson | Old North Analytics, LLC  
[info@oldnorthanalytics.com](mailto:info@oldnorthanalytics.com) | 919-307-1722 | [oldnorthanalytics.com](https://oldnorthanalytics.com)
