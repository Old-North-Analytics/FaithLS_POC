**# Faith Lock & Safe | Job Management System

Web-based job management tool for Faith Lock & Safe Co. (Pegram, TN). Replaces a paper daily sheet workflow with a digital system for job assignment, tech completion forms, admin review, and QuickBooks CSV export.

Built by Old North Analytics, LLC.

---

## Live Site

[https://old-north-analytics.github.io/FaithLS_POC/]

---

## Stack

- **Frontend:** Vanilla HTML/JS, no framework, no build step
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (job photos)
- **Hosting:** GitHub Pages / Cloudflare Pages (static file serving)

Supabase project ID: `jmsrlhqbzstuczxilxua`
Supabase dashboard: [https://supabase.com/dashboard/project/jmsrlhqbzstuczxilxua](https://supabase.com/dashboard/project/jmsrlhqbzstuczxilxua)

API keys and credentials are in the Supabase dashboard under Settings > API. Do not commit credentials to this repo beyond the anon/public key already embedded in the HTML files (this key is safe to expose - RLS is enforced at the database level).

---

## File Structure

```
/
├── index.html              # Login - routes to admin or tech view by role
├── admin.html              # Admin interface (Rich)
├── tech.html               # Tech interface (Milton, Zach, Thomas)
├── accounts.html           # CRM / account management
├── guide_admin.html        # Admin user guide (rendered Markdown)
├── guide_tech.html         # Tech user guide (rendered Markdown)
├── guide_admin.md          # Admin guide source
├── guide_tech.md           # Tech guide source
└── docs/
    ├── FaithLock_WorkingDoc_v2.1.docx   # Full requirements and technical reference
    ├── uat_package.md                   # POC testing guide
    └── requirements_updates.md         # Change notes from v2.0 to v2.1
```

---

## Deploying

No build step. All files are static.

**GitHub Pages:** Settings > Pages > Source: main branch, root folder.

**Cloudflare Pages:** Connect repo, leave build command and publish directory blank.

Any push to main redeploys automatically on either platform.

---

## Database Setup

The schema is in `faithlock_schema.sql` (run once in Supabase SQL Editor to create all tables, indexes, and RLS policies). Sample data is in `sample_data.sql`.

After running the schema:
1. Create two auth users in Supabase dashboard > Authentication > Users
2. Insert their UUIDs into `user_profiles` (instructions in the schema file)
3. Insert tech names into the `techs` table

---

## POC Limitations

The current build is a proof of concept with the following known gaps that must be resolved before go-live with real data:

**Shared tech login** - all field techs share one Supabase auth account. Job filtering and lead tech enforcement are disabled. Fix: create individual auth accounts per tech and update `assigned_tech_ids` and `lead_tech_id` to store auth UUIDs.

**Account instructions** - saved to browser localStorage, not the database. Not visible across devices. Fix: add an `instructions` text column to the `accounts` table and update the save/load calls in `accounts.html`.

**Unit costs on tech submissions** - line items inserted from the tech view store `unit_cost: 0`. Admin sees correct costs via the reference catalog during review. Fix: pass unit cost from the catalog at insert time on the tech side.

---

## Go-Live Prerequisites

Full checklist is in `docs/FaithLock_WorkingDoc_v2.1.docx`, Section 9. Short version:

- Individual auth accounts created for Milton, Zach, and Thomas
- POC limitations above resolved
- Default passwords changed
- Real accounts, parts, job types, and labor rates entered in Reference Data
- QuickBooks export tested and confirmed with Brenda
- All techs confirmed on capable mobile browsers
- Supabase project and GitHub repo transferred to Faith Lock account

---

## Contact

Thomas Johnson | Old North Analytics, LLC
info@oldnorthanalytics.com | 919-307-1722 | oldnorthanalytics.com
**
