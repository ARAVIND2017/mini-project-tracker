# User Acceptance Test (UAT) checklist

For: Dr Vidyavathi B M (HOD), the lead faculty and at least one other faculty member.
Where: the **staging** deployment, never the live roster.
Data: **fictional only**, for example "UAT Student 01". Use test mailboxes you control (for example plus-addresses of your own email, such as `you+uat01@…`) so the invitation emails arrive.
Time: about 2 hours, in three sessions.

Mark each line **Pass**, **Fail** (with a note) or **N/A**. A failure goes into the defect list at the end with a severity:

- **Critical:** data is lost or exposed, or someone can do what they must not.
- **High:** a main task cannot be completed.
- **Medium:** it works, but it is wrong or confusing.
- **Low:** cosmetic.

The phase passes when there are **no open Critical or High defects** and the HOD signs at the end.

## Session 1 — HOD: setting up a semester (about 40 min)

| # | Step | Expected | Criteria | Result |
|---|---|---|---|---|
| 1.1 | Sign in, open Semesters, create "UAT Semester" with a start date and the default settings | Saved; week 16's date is shown | AC1.1, AC1.2, AC1.3 | |
| 1.2 | Add two domains (e.g. Machine Learning, Web Systems) | Listed on the Domains tab | AC4.1 | |
| 1.3 | People & roles: invite a lead and two faculty (test mailboxes) | Each receives an email, sets a password and signs in | AC2.1 | |
| 1.4 | Appoint the lead; try to appoint a second lead | Only one active lead at a time | AC2.2 | |
| 1.5 | Roster: import a CSV with 5 fictional students and **2 blank rows**; first see the preview | The preview shows problems first; the names are saved exactly as written; the 2 blank slots stay empty | AC3.1, AC3.2 | |
| 1.6 | Import more rows than the capacity allows | Refused with a clear message | AC3.3 | |
| 1.7 | Plan: look at the weekly plan; change one week's milestone date | The date changes for that week only | AC1.3, AC6.1 | |
| 1.8 | Activate the semester | The checklist is complete; the status becomes Active | AC1.4 | |
| 1.9 | Projects: assign a guide to one project directly; leave others unassigned | The list shows the guide, or "! Unassigned" | AC4.4, AC4.5 | |
| 1.10 | Deactivate one faculty account, then try to sign in as that person | Sign-in fails; their history remains | AC2.5 | |
| 1.11 | Forgot password: request a reset for your account and for an unknown address | The same message both times; the link works once only | AC2.4 | |

## Session 2 — Faculty and students: the research and weekly loop (about 50 min)

Use two browsers (or a private window) so a student and a faculty member are signed in at the same time.

| # | Step | Expected | Criteria | Result |
|---|---|---|---|---|
| 2.1 | Faculty: record your expertise; request to guide a project in that domain, and one outside it | The first is accepted for HOD approval; the second is refused | AC4.2, AC4.3 | |
| 2.2 | HOD: approve the request | The guide appears on the project; nothing changed before approval | AC4.4 | |
| 2.3 | Student: S1 exploration — try to submit with missing fields, then complete and submit | Missing fields are listed; after submission the form is locked | AC5.1 | |
| 2.4 | Guide: request changes with 2 corrections | The student is notified; corrections show as open | AC6.4, AC10.1 | |
| 2.5 | Student: mark the corrections addressed and resubmit; guide: verify one, waive one (with a reason), accept | The stage is approved | AC6.5 | |
| 2.6 | Student: S2 — add a paper from before the target year without a justification | Refused until a justification is given | AC5.2 | |
| 2.7 | A second student selects the same paper (same DOI) | Blocked as a duplicate unless the HOD overrides with a reason | AC5.3 | |
| 2.8 | Student: S4 — record a failed attempt, then a successful one with evidence; guide verifies | "Verified" is possible only after a successful attempt with evidence | AC5.4 | |
| 2.9 | Student: S5 objectives v1 — changes requested; v2 approved | One approved version; earlier ones kept | AC5.5 | |
| 2.10 | Weekly tasks: the student submits week 1 on time and week 2 after its deadline | Week 1 "on time", week 2 "late"; earlier versions stay visible | AC6.2, AC6.3 | |
| 2.11 | Unassigned faculty: try to accept the student's task; then add a comment | Accepting is refused; the comment is saved | AC6.6 | |
| 2.12 | Lead: grant that faculty member a review authorization for 1 day; they accept the task | Now allowed | AC4.6, AC6.6 | |
| 2.13 | Leave a task past its deadline; mark one project Blocked with a reason | Shown as Overdue and Blocked on the dashboards | AC6.7 | |
| 2.14 | Student: open another student's project address (copy the URL from a faculty browser) | "Not found"; nothing about the other student is shown | Isolation | |

## Session 3 — Final stages, panels, dashboards and audit (about 30 min)

To save time, the developer can prepare one fictional project already at S6 on staging.

| # | Step | Expected | Criteria | Result |
|---|---|---|---|---|
| 3.1 | Student: S6 items (planned and added, with commit links); S7 results marked baseline and proposed, each with evidence | A result without evidence is refused | AC7.1, AC7.2 | |
| 3.2 | Student: S8 — the ten paper sections with links; guide approves them one by one | S8 completes only after all ten | AC7.3 | |
| 3.3 | HOD: form a panel of 2 and assign the project | Shown on the Panels tab | AC8.1 | |
| 3.4 | Student: complete the final checklist and submit; a panel member tries to approve with an item unverified | Refused until every item is verified and no correction is open | AC7.4, AC8.2 | |
| 3.5 | Panel: one member approves, the other requires changes; the student fixes it; the second approves | Remarks and timeliness are shown; the project completes only after both approve | AC8.3, AC8.4 | |
| 3.6 | HOD dashboard: click three different numbers | Each opens a list with exactly that many projects | AC9.1 | |
| 3.7 | Open a project's progress breakdown | It matches the approved stages and verified tasks; there is no way to type a progress value | AC9.2 | |
| 3.8 | Export the project overview, review queue, timeliness and audit log as CSV; open them in a spreadsheet | The columns are readable; faculty (not lead) see no export buttons | AC9.3 | |
| 3.9 | Notifications: check the bell as student, guide and HOD after the steps above | Each saw their own events; nobody was notified of their own action | AC10.1 | |
| 3.10 | Audit log: find the role change, guide assignment and a review; look for any way to edit an entry | Who, when and what are shown; there is no edit | AC11.1, AC11.2 | |
| 3.11 | Close the UAT semester | Everything in it becomes read-only | AC1.4 | |

## Defects found

| # | Step | What happened | Severity | Status |
|---|---|---|---|---|
| | | | | |

## Sign-off

I have run this checklist on staging with fictional data. There are no open Critical or High defects, and the system may be prepared for production (Phase 9).

Name: ______________________ Role: HOD Date: __________ Signature: __________
