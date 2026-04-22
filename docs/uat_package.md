# Faith Lock & Safe | Job Management System
## POC Status & UAT Package
**Prepared by:** Old North Analytics, LLC
**Date:** April 2026
**Version:** POC v1.0

---

## Current State of the Tool

The Job Management System is a working web application. It is accessible from any browser on any device with no installation required. All data is stored in a live database. The tool is functional end-to-end: jobs can be assigned, completed by techs, reviewed and approved by admin, and exported to CSV for QuickBooks.

This is a proof of concept. It is loaded with sample data representing realistic but entirely fake job activity. No real customer data has been entered. The purpose of this testing phase is to confirm the workflow makes sense, catch anything that feels wrong before real data entry begins, and agree on what needs to change before go-live.

---

## What Is Built and Working

### Admin (Rich)

**Job Assignment**
- Create a job with date, account, sub-account, job type, lead tech, assigned techs, status, scope, and site notes
- Mark a job as fixed price with a quoted dollar amount
- Pre-load expected parts and labor so techs arrive knowing what materials are anticipated
- Duplicate the last assigned job for repeat work
- View the full schedule in a date range viewer with the ability to delete unsubmitted jobs

**Job Review**
- Review queue filtered by status: Pending Review, Flagged, Approved, or All
- Expand each job card to see all completion details: time in/out, payment, tech notes, and full line items
- Override individual line item costs with a required reason field
- Fixed price jobs show quoted vs. actual side by side
- Approve, flag, or reset individual jobs
- Bulk approve all Pending Review jobs at once
- Add review notes to any job
- Reopen and fully edit any submitted job: status, scope, time, payment, tech notes, and all line items. This covers no-show jobs and jobs requiring admin correction

**Search**
- Filter jobs by date range, account, tech, status, category, and address (partial text match)
- Results show job count and total revenue for the filtered set

**Export**
- Generate a CSV formatted for QuickBooks Desktop import
- Filter by date range and status (default: Approved only)

**Accounts (CRM)**
- Full account list with sortable columns: name, type, address, phone, billing notes, job count, last service date
- Search and filter by name, address, phone, account type, and active status
- Per-account detail view with stats, sub-accounts, job history, quote forms, photos, and instructions
- Add and edit account records including parent/sub-account relationships
- Account-level instructions field for gate codes, contacts, access notes, billing quirks
- Export the full filtered account list to CSV
- Export per-account job history to CSV

**Reference Data**
- Inline editing of all parts, job types, labor types, and techs
- Add new entries, edit existing ones, and deactivate entries no longer in use

**Calendar**
- Weekly calendar view per tech
- Navigate by week
- Jobs color-coded by status
- Multi-tech jobs show lead designation

**New Customers**
- Review field-submitted customer records and migrate to the permanent account list

### Tech (Milton, Zach, Thomas)

**My Jobs**
- View assigned jobs filtered by Today, This Week, or All Open
- Fixed price jobs show a red warning banner with the quoted amount
- Expected parts and labor pre-loaded by admin appear in a blue banner and are pre-filled on the completion form

**Job Completion**
- Log time in and time out
- Search and add parts from the full catalog
- Add labor by type and hours
- Pre-loaded parts and labor are editable: adjust quantities, remove items, add items not on the list
- Log payment type and detail
- Flag for follow-up
- Write notes for Rich
- Upload photos from the phone

**Unsubmit**
- Remove a submission if Rich has not yet reviewed it, correct it, and resubmit

**Add Note**
- Append a timestamped note to a submitted job without reopening the full form

**Unscheduled Jobs**
- Log a job that was not on the schedule. Goes directly to Rich's Pending Review queue

**New Customer**
- Submit a new customer from the field for admin to add to the account list

**Quote Form**
- Techs can fill out scope observed and materials list during a site survey. Form locks after submission. Admin retains edit rights

---

## What Is Not Yet Built

The following items are confirmed for the production build but were intentionally deferred from the POC:

**Multi-visit jobs** - currently each job is one completion event. If a job requires a return visit, the workaround is to create a new job and reference the original job ID in the scope field. This is a known limitation and will be addressed in the production build with a dedicated Visits data structure.

**Individual tech logins** - the POC uses one shared tech login for all field techs. In production, each tech gets their own account so job filtering, lead tech enforcement, and submission attribution work correctly per person.

**Customer-facing quote documents** - the tool captures quote data but does not generate a formatted quote document for the customer. Rich continues to send quotes via his normal channels.

**Offline mode and push notifications** - the tool requires an internet connection. This is acceptable for the current use case.

**Recurring job templates** - not built. Repeat jobs use the Duplicate Last Job function.

**In-app invoicing and payment processing** - out of scope. QuickBooks Desktop remains the invoicing system.

---

## Known POC Limitations to Be Aware of During Testing

**Shared tech login** - all field techs sign in with the same credentials during the POC. This means any tech can see and complete any job. In production this is resolved with individual logins.

**Unit costs on line items** - techs do not see pricing. When a tech logs a part or labor entry, the unit cost recorded is pulled from the reference catalog. Admin can override costs in the review queue. The catalog must be populated with real pricing before go-live for this to work correctly.

**Instructions tab on accounts** - currently saves to the browser's local storage on whatever device you use. This means instructions entered on one device will not appear on another. This is a POC limitation only. The production build stores instructions in the database.

**Photos** - the upload function is built and working. Testing requires an actual photo upload from a mobile device to confirm the flow works end to end.

---

## How to Access the Tool

**URL:** [your GitHub Pages or Cloudflare URL]

**Admin login**
- Email: admin@faithlock.test
- Password: [shared separately]

**Tech login**
- Email: tech@faithlock.test
- Password: [shared separately]

Both logins route to the correct view automatically after sign-in.

---

## What to Test

### Rich - Admin Testing

Work through these in order. For each step, note whether it worked, felt confusing, or is missing something.

**1. Assign a job**
Go to Assign. Create a job for one of the sample accounts for today or tomorrow. Assign it to Milton as lead. Add scope and site notes. Pre-load one part using the parts search and add one labor entry. Submit. Then check the Schedule Viewer to confirm it appears.

**2. Fixed price job**
Assign a second job and mark it as Fixed Price with a dollar amount. Note what you see.

**3. Review the sample data**
Go to Review. Filter by Pending Review. Expand two or three job cards and read through the completion details. Try overriding a line item cost and adding a reason. Approve one job. Flag one job with a review note.

**4. Bulk approve**
With multiple Pending Review jobs showing, use Bulk Approve.

**5. Reopen and edit**
Find any submitted job. Click Reopen / Edit. Change the tech notes and adjust a line item quantity. Save. Re-expand the job and confirm the changes are there.

**6. Search**
Try searching by account, by address using a partial street name, and by status. Review the result count and total.

**7. Export**
Export Approved jobs for the full sample date range. Open the file in Excel. Review whether the columns and data make sense for QuickBooks entry.

**8. Accounts**
Go to Accounts. Find Cheatham County School District. Click View. Review the sub-accounts, job history, and stats. Go to the Instructions tab and enter sample access notes. Save. Go to another account and come back to confirm the instructions are still there (note: on the same device only during POC).

**9. Calendar**
Go to Calendar. Select a tech. Navigate between weeks.

**10. Reference data**
Go to Reference > Parts. Edit a part name and save it. Add a new part. Go to Labor Types and change a rate.

**Key questions for Rich:**
- Does the assign form capture everything you need to brief a tech?
- Is the review queue the right workflow for end-of-day processing?
- Does the fixed price warning make sense?
- Is anything missing from the export that Brenda needs for QuickBooks?
- Are the account records useful for looking up customer history?

---

### Milton - Tech Testing

Do all of this on your phone.

**1. Sign in and check your jobs**
Sign in as tech. Confirm jobs appear on the Today view. Switch to This Week and All Open.

**2. Complete a job**
Open a job card. Tap Complete Job. Fill out the form: time in and out, add parts by searching the catalog, add a labor entry, select a payment type, write a tech note. Submit. Confirm the job shows as Submitted.

**3. Parts search specifically**
In the completion form, type a partial part name in the search box. Confirm results appear as you type. Add a part. Remove a part. Add it again with a different quantity.

**4. Expected parts**
Ask Rich to assign a test job with pre-loaded parts and labor before your testing session. Open that job and confirm the blue banner shows the expected items and they are pre-filled on the form.

**5. Fixed price job**
Ask Rich to assign a fixed price job. Confirm the red banner appears with the quoted amount.

**6. Unsubmit**
After submitting a job, tap Unsubmit before Rich has reviewed it. Confirm it returns to open. Resubmit with a correction.

**7. Add note**
On a submitted job, tap Add Note and enter a note. Confirm it saves.

**8. Unscheduled job**
Go to + New Job. Log a job that was not on the schedule. Fill in all fields and submit.

**Key questions for Milton:**
- Is the parts search usable on your phone?
- Is the completion form easy to fill out in the field?
- Is anything missing from the form that you need to record?
- Does the time in/out picker work on your phone?
- Would you feel comfortable using this instead of the paper sheet?

---

### Brenda - QuickBooks Handoff Testing

**1. Review the export**
Have Rich approve all pending jobs in the sample data, then export to CSV. Open the file in Excel.

**2. Review the columns**
The export includes: Date, Customer, Sub-Customer, Job Type, Item Type, Item, Qty, Unit Cost, Override Cost, Extended, Payment Type, Payment Detail, Tech Notes, Status.

**Key questions for Brenda:**
- Is the customer name in a format that matches your QuickBooks customer list?
- Are the line items broken out the way you need them?
- Is there anything missing that you currently get from the legal pad that is not in this export?
- Is there anything in the export you do not need?
- Would this replace your current manual entry process without creating extra work?

---

## Feedback to Collect

After testing, everyone should answer these five questions and send responses to Thomas:

1. Was anything confusing or unclear on first use, without help?
2. Is anything missing that you need to do your job?
3. Is there anything that feels wrong or backward about the workflow?
4. Did anything break or produce an error? What were you doing when it happened?
5. On a scale of 1 to 5, how ready does this feel for real job data?

---

## Go/No-Go for Real Data Entry

The tool is ready for real data when all of the following are true:

- Rich can assign, review, approve, and export without assistance
- Milton can complete a job form on his phone without assistance
- Brenda confirms the CSV format is usable for QuickBooks
- No critical bugs (broken submissions, missing data, failed exports)
- Admin PIN is changed from the default
- Real accounts, parts, job types, and labor rates are populated in Reference Data
- All techs have confirmed their phone browsers can access the tool

Items that can wait until after initial go-live:
- Full reference data population (this is a milestone, not a blocker for the first real job)
- Cosmetic or layout preferences
- Nice-to-have features not in the current requirements
