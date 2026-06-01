# Faith Lock & Safe | Job Management System
## UAT Package
**Prepared by:** Old North Analytics, LLC  
**Version:** v3.0, June 2026

---

## How to Access

**URL:** https://old-north-analytics.github.io/FaithLS_POC/

| Name | Email | Password | Role |
|------|-------|----------|------|
| Rich | rich@faithlock.test | admin | Admin |
| Milton | milton@faithlock.test | admin | Admin + My Jobs |
| Zach | zach@faithlock.test | tech | Tech (field) |
| Thomas | thomas@faithlock.test | tech | Tech (field) |

The system routes each user to the correct interface automatically after sign-in. Milton sees both the full admin panel and a My Jobs tab.

All accounts, parts, job types, and jobs in the system are sample data. Click freely without affecting anything real.

---

## What Is Built

### Admin (Rich, Milton)

- Assign jobs: date, account, sub-account, job type, lead tech, assigned techs, scope, site notes, WO/PO numbers, fixed price flag with quote amount, pre-loaded expected parts and labor
- Edit any job after creation: correct date, sub-account, tech assignment, status, scope, line items, and visit clock times
- Dispatch board grouped by date, filterable by account, job type, and status
- Calendar view: weekly, color-coded by job status, filterable by tech
- Multi-visit jobs: add a return visit date to an existing job instead of creating a duplicate record
- Review queue: expand job cards, override line item costs, approve, flag, add notes, bulk approve
- Activity log: full history of clock events, completions, and reviews
- Accounts (CRM): master and sub-account model, multi-contact per account (primary, secondary, on-site), per-account job history, photos, and instructions
- Quote PDF builder: generate a printable quote document from any quote record, with selectable fields
- Parts inventory: stock quantities on parts, low-stock flags, To Order totals in Stock Prep
- Job templates: save recurring job setups for quick re-use
- Reference data full CRUD: parts, job types, labor types, techs
- QuickBooks export: CSV filtered by date range and status

### Tech / Field (Zach, Thomas, Milton via My Jobs)

- My Jobs filtered by Today, This Week, or All Open
- Job card shows site address (sub-account address when applicable), primary contact, site notes, WO/PO, fixed price warning, and expected parts/labor banner
- Clock In and Clock Out buttons timestamp the moment and update job status to In Progress
- Completion form: time in/out with Now shortcuts, parts search, labor, service call fee, Other charges, payment, tech notes, photos, follow-up flag
- Unsubmit: pull back a submission before admin reviews it

---

## What Is Not Yet Built

- **Invoice generation** -- waitlisted. QuickBooks Desktop export is the current path.
- **GPS location stamp** -- not built; noted as a future option.
- **Push/SMS notifications** -- out of scope.

---

## Test Scenarios

### Rich -- Admin

**1. Assign a job**  
Go to Dispatch > + Assign Job. Create a job for a sample sub-account. Assign Milton as lead. Add scope and site notes. Pre-load one part and one labor entry. Submit. Confirm it appears on the board grouped under today's date.

**2. Edit after creation**  
Find the job you just created. Click Edit. Change the date to tomorrow and swap the sub-account. Save. Confirm the board reflects the change.

**3. Fixed price job**  
Assign a second job. Mark it Fixed Price with a dollar amount. Note the flag on the dispatch card.

**4. Calendar**  
Go to Dispatch > Calendar. Navigate to this week. Select a tech from the dropdown and confirm only their jobs appear.

**5. Review**  
Go to Review. Filter by Pending Review. Expand a job card. Override one line item cost with a reason. Add a review note. Approve it.

**6. Bulk approve**  
With multiple Pending Review jobs showing, use Bulk Approve. Confirm all move to Approved.

**7. Export**  
Export Approved jobs for the full sample date range. Open in Excel. Review columns for QuickBooks compatibility.

**8. Accounts**  
Open any master account. Review sub-accounts, job history, and the Contacts tab. Add a contact with name, phone, and On-Site flag. Open the Instructions tab and enter sample access notes. Save.

**9. Activity Log**  
Go to Activity Log. Filter by This Week. Confirm clock events and completions appear. Try the event type filter.

**Key questions for Rich:**  
- Does the assign form capture everything you need to brief a tech?  
- Does the edit modal cover the corrections you make most often?  
- Is the review queue the right workflow for end-of-day processing?  
- Is anything missing from the export that Brenda needs for QuickBooks?

---

### Milton -- Tech (do this on your phone)

**1. Sign in and check jobs**  
Sign in as milton@faithlock.test. Go to the My Jobs tab. Switch between Today, This Week, and All Open.

**2. Clock in**  
Open a job card. Tap Clock In. Confirm status changes to In Progress and the button switches to Clock Out.

**3. Check site address**  
If a job is at a sub-account location, confirm the sub-account address (not the master address) appears on the card with a tap-to-navigate link.

**4. Complete a job**  
Tap Job Details on an open job. Fill out the form: time in and out using the Now buttons, add a part by searching the catalog, add a labor entry, add a service call charge, select a payment type, write a tech note. Submit.

**5. Unsubmit**  
After submitting, tap Unsubmit before Rich has reviewed it. Confirm it returns to open. Resubmit.

**6. New job from field**  
Tap + New Job. Log an unscheduled job. Fill all fields and submit.

**Key questions for Milton:**  
- Is the parts search usable on your phone?  
- Does the job card show everything you need before arriving on site?  
- Is anything missing from the completion form?  
- Would you use this instead of the paper sheet?

---

### Brenda -- QuickBooks Review

**1. Review the export**  
Have Rich approve all pending sample jobs and export to CSV. Open in Excel.

**2. Review columns**  
The export includes: Date, Account, Sub-Account, Job Type, Item Type, Item, Qty, Unit Cost, Total, Payment Type, Payment Detail, Tech Notes, Status.

**Key questions for Brenda:**  
- Are customer names in a format that matches your QuickBooks list?  
- Are line items broken out the way you need them?  
- Is anything missing that you currently pull from the daily sheet?  
- Is there anything in the export you do not need?

---

## Feedback to Collect

After testing, send responses to Thomas (tmj1090@gmail.com):

1. Was anything confusing or unclear on first use?
2. Is anything missing that you need to do your job?
3. Is there anything that feels wrong or backward about the workflow?
4. Did anything break or produce an error? What were you doing?
5. Scale of 1 to 5: how ready does this feel for real job data?
