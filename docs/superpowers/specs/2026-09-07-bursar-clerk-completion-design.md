# Completing the Bursar & Accounts Clerk Profiles — Design

**Date:** 2026-09-07
**Status:** Approved design, pending implementation plan
**Repos touched:** `Accounts` (backend), `Schoolfrontend` (frontend)

Continues [2026-09-02-bursar-accounts-clerk-profiles-design.md](2026-09-02-bursar-accounts-clerk-profiles-design.md),
whose Phase 2 (Banking), Phase 3 (Reports) and Phase 4 (permission revocation)
are the bulk of this document.

## Purpose

Three things are wrong or missing today:

1. The Accounts Clerk can both receipt cash and raise the invoice it is
   receipted against — the fraud path the 2026-09-02 spec identified and
   deferred to a Phase 4 that was never done.
2. The Bursar holds seven permissions with no page at all: the four banking and
   imprest codes, and `reports.view` / `reports.export`.
3. Users cannot see what their own role permits, and the sidebar offers links to
   pages that do not exist.

## Background: what these roles actually do

**Accounts Clerk** — the front counter, and only that. Opens with a cash float,
spends the day on one loop (find the student, read the balance, take cash /
M-Pesa / bank slip / cheque, issue a numbered receipt, post it against the right
invoice), prints statements on request, and closes by cashing up and preparing
the banking slip for the Bursar. They never raise invoices, never touch the
ledger, and never approve anything. The narrowness is the control.

**Bursar** — the accounting officer, working on stacked cadences rather than a
daily loop. Daily: bank yesterday's collections, check the bank balance, issue
imprest. Weekly: post journals, work the arrears list, run requisitions through
to payment vouchers. Monthly: bank reconciliation, payroll, budget vs actual.
Termly: set fee structures and raise all invoices, record capitation, close the
period. Annually: draft the budget, produce the IPSAS statements, face the OAG
audit. They prepare everything and approve nothing they prepare.

The three duties with no screen — banking the collections, the imprest cycle,
and producing the statements — are precisely the Bursar-only duties. No other
role touches them, so nothing else forced them to get built.

## Scope

In: the RBAC revocation, the Profile capability view, the Banking & Imprest
page, the Reports module, and hiding unbuilt nav links.

Out: the ~20 other coming-soon modules (HR, welfare, student conduct, academic,
compliance). Each belongs to a different role and gets its own task. Out also: a
full IPSAS operating/investing/financing cash flow statement — see section 4.

---

## 1. Revoking `fees.invoice.manage` from the Accounts Clerk

Editing the source alone changes nothing in a live database, so this is three
parts.

### 1a. Source

Remove `'fees.invoice.manage'` from the `accounts_clerk` permission list in
`Accounts/src/modules/identity/rbac.ts`. Final set:

```ts
permissions: ['fees.receipt.create', 'fees.view', 'students.view', 'dashboard.view']
```

No frontend change is needed. `FeesPage.tsx` already gates the New Invoice
button and the Invoices-tab action on `fees.invoice.manage`, so the control
disappears on its own. The clerk keeps `fees.view` and can still read invoices,
which they must be able to do in order to receipt against them.

### 1b. Revocation path: `db:sync-rbac --prune`

`sync-rbac.ts` is additive-only, so every clerk already in the database keeps the
permission until a row is deleted. Rather than write new drift logic, the flag
reuses `systemService.rbacDrift()`, which already computes
`orphanRolePermissions` — mappings present in the database but no longer in
`rbac.ts`.

Behaviour:

- Default (no flag): unchanged, additive only.
- `--prune`: prints each mapping it will delete as `role_code -> permission_code`,
  then deletes them.
- `--dry-run`: prints the same plan and exits without writing.

**`--prune` deletes role-permission mappings only** — never orphan `permissions`
or `roles` rows. Deleting a permission row cascades into `role_permissions`,
which the existing comment in `system.service.ts` already warns about; a
mis-typed code in `rbac.ts` would then silently strip that permission from every
role holding it. Orphan permission and role rows stay reported-but-not-deleted.

### 1c. Make the fix durable

`system.service.ts` already carries a `SEGREGATION_RULES` list that flags any
user holding both halves of an incompatible pair, surfaced on the System Health
page. It has five rules and does not include the fees pair. Add a sixth:

```ts
{ rule: 'Receipts payments and raises the invoices they are receipted against',
  permissions: ['fees.receipt.create', 'fees.invoice.manage'] }
```

Without this, the same conflict can return the moment someone grants a clerk a
second role, and nothing would report it. This is the part that makes 1a more
than a one-time correction.

---

## 2. Profile: "What you can do"

`ProfilePage.tsx` currently shows role chips (`bursar`, `accounts_clerk`) and
nothing about what those roles permit.

Add a card below the header: the user's granted permissions grouped by module,
each rendered as its existing plain-English description — "Receipt fee payments
from parents", "Reconcile bank statements".

### Backend change

`PERMISSIONS` in `rbac.ts` already carries `module` and `description` per code,
and `seed.ts` inserts both into the `permissions` table. The data exists and only
needs surfacing.

`authRepository.findRolesAndPermissions` already joins to `permissions`; add
`module` and `description` to that existing select — no extra query. Then extend
`AuthenticatedUser` with:

```ts
permissionDetails: { code: string; module: string; description: string }[]
```

This is **additive**. The existing `permissions: string[]` stays exactly as it
is, because `PrivateRoute`, `Sidebar`, `useCan`, `GlobalSearchBar` and every
page's inline check all read it.

### Why not a frontend label map

Hand-writing 80 code-to-label pairs in the frontend would duplicate data that
already exists in `rbac.ts` and would drift the first time anyone edits a
description. The backend is the source of truth for what a permission means.

### Result

The clerk's profile reads as four concrete capabilities. The Bursar's reads as
~30, grouped under Ledger, Budget, Fees, Grants, Procurement, Payroll, Assets,
Banking and Reports.

---

## 3. Banking & Imprest page

A pure frontend fill-in: all 11 backend routes exist, are permission-gated, and
are called by nothing.

New `Schoolfrontend/src/modules/banking/` — `BankingApi.ts`, `types.ts`,
`BankingPage.tsx` — following the established `ProcurementPage` tab pattern.

| Tab | Contents | Actions | Gate |
|---|---|---|---|
| Bank Accounts | list, linked GL account, fund, branch | New Bank Account | `banking.manage` |
| Reconciliations | per account; statement vs book balance, items | New Reconciliation; **Mark Reconciled** | `banking.manage` / `banking.reconcile` |
| Imprest | request no, purpose, amount, status, retirement | **Issue Imprest**; **Retire** | `imprest.issue` / `imprest.retire` |

Action buttons use the same inline `user?.permissions.includes(...)` pattern as
the sibling finance pages. `banking.manage` and `banking.reconcile` are separate
gates because they are separate duties: preparing a reconciliation is not the
same act as signing it off.

Then set `built: true` on the Banking nav entry and add the route to `App.tsx`
gated on `banking.manage`.

---

## 4. Reports

New backend module `Accounts/src/modules/reports/` following the standard
controller / service / repository / routes / schema / types shape used by every
existing module.

It **reuses `journalRepository.trialBalanceRows`** rather than rewriting the
aggregation SQL. That query already returns `type` and `normalBalance` per
account, which is everything the statements need. Where a period-bounded (rather
than as-at) variant is required, the repository gains a `from`/`to` overload
beside the existing one.

### Endpoints

| Endpoint | Query | Returns |
|---|---|---|
| `GET /api/reports/income-expenditure` | `from`, `to`, `fundId?` | revenue and expense accounts over the period, netting to surplus/deficit |
| `GET /api/reports/balance-sheet` | `asOf`, `fundId?` | asset, liability and `net_assets` as at the date |
| `GET /api/reports/cash-movement` | `from`, `to` | opening cash, receipts and payments grouped by contra-account, closing cash |
| `GET /api/reports/trial-balance` | existing | unchanged |

All gated on `reports.view`. The existing `reportsRoutes` in `journal.routes.ts`
moves into the new module; the `/api/reports/trial-balance` path does not change.

### Cash flow: what is and isn't being built

A real IPSAS cash flow statement splits movements into operating, investing and
financing. Nothing in the schema records that classification — `accounts` carries
only `type` (`asset`, `liability`, `net_assets`, `revenue`, `expense`). It is not
derivable from what exists.

**Decision: build a Cash Movement Statement** — direct method, from movements on
the cash and bank GL accounts, grouped by contra-account. Fully derivable today
and immediately useful for the Bursar's daily banking work.

It is labelled "Cash Movement Statement", **not** "Cash Flow Statement". The real
statement needs a `cash_flow_category` column on `accounts`, a migration, and a
classification decision for every account in the chart. That is its own task, and
mislabelling this one as that one would be worse than not having it.

### CSV export

Client-side, from the already-fetched report data. This is what finally backs
`reports.export`, currently granted to four roles and wired to nothing. No
backend work and no export library — a small `toCsv(rows)` helper and a Blob
download, since the report shapes are flat tables.

### Frontend

New `Schoolfrontend/src/modules/reports/` — `ReportsApi.ts`, `types.ts`,
`ReportsPage.tsx` with one tab per statement, a date-range or as-at control, an
optional fund filter, and an Export CSV button gated on `reports.export`.

Add a Reports nav entry to the Finance section gated on `reports.view` with
`built: true`, and the corresponding route. This entry does not exist today in
any form — the permission has never had a home in the UI.

---

## 5. Hiding unbuilt navigation links

`navigation.ts` currently maps every RBAC permission to a nav item, and every
item without `built: true` routes to a `ComingSoon` placeholder. That is 22 dead
ends across all roles — two of which (Banking, Notifications) the Bursar sees.

### Change

`Sidebar.tsx` renders only items with `built: true`. `GlobalSearchBar.tsx` reads
the same nav config and applies the same filter, or unbuilt pages keep surfacing
in search results.

**The generated placeholder routes in `App.tsx` stay.** `App.tsx` has no
catch-all route, so removing them would render a blank white screen for any typed
or bookmarked URL under an unbuilt module. Unreachable from the UI, they remain
as the fallback that explains itself.

`navigation.ts` itself is left intact, including the unbuilt entries. It keeps
its value as the 1:1 map of the RBAC catalogue to the UI, and flipping
`built: true` stays the single action that ships a page.

### Consequences

- After sections 3 and 4, every link in the Bursar's sidebar leads to a working
  page.
- The Principal loses the Notifications link too — the nav config is shared.
- `notifications.send` is hidden only until it is built. Bulk SMS and email to
  parents is a confirmed requirement with its own spec (see section 8, item D);
  when that work sets `built: true` on the Notifications entry, the link returns
  automatically. Nothing about the permission or its 5 backend routes changes
  here. This is the reason `navigation.ts` keeps its unbuilt entries rather than
  having them deleted — a hidden link is one flag away from shipping.
- The comment at the top of `navigation.ts` claiming every permission has a home
  in the UI must be corrected to describe what is now true.

---

## 6. Testing

The backend has vitest with one existing test file
(`fees.calculations.test.ts`). The frontend has no test runner, so verification
there is manual.

Tests are written first for the statement math, which is where the real risk sits
and where a wrong answer is both plausible and invisible:

- Sign rules by `normalBalance` — a debit-normal account with net credits must
  yield a negative balance, and vice versa.
- Income & Expenditure nets to surplus/deficit, and is bounded by `from`/`to`
  rather than accumulating from inception.
- Balance Sheet actually balances: assets = liabilities + net assets, with the
  period surplus rolled into accumulated surplus.
- Cash Movement: opening + receipts - payments = closing, and the closing figure
  agrees to the cash and bank balances on the Balance Sheet for the same date.
- Only `posted` journal entries are included; drafts and pending-approval entries
  never reach a statement.

`--prune` also gets a test: given a mapping in the database and absent from
`rbac.ts`, it is deleted; given one present in both, it survives; and orphan
permission rows are never touched.

Manual frontend verification, per role, using the seeded demo users
(`bursar@school.local`, `accounts.clerk@school.local`):

- Clerk: no New Invoice control anywhere; the fee counter still receipts; Profile
  lists exactly four capabilities.
- Bursar: Banking and Reports both reachable and functional; every sidebar link
  resolves; CSV export downloads.
- Both: no Notifications link; System Health reports no segregation conflict for
  the clerk after `--prune`.

## 7. Sequencing

1. **RBAC revocation** (section 1) — smallest, self-contained, and the actual
   security fix.
2. **`/me` + Profile capability card** (section 2) — small backend change, one
   frontend card.
3. **Nav link hiding** (section 5) — two-file frontend change, independent of the
   rest.
4. **Banking & Imprest page** (section 3) — frontend only, backend already done.
5. **Reports** (section 4) — tests, then backend module, then page. Largest
   piece, last.

Steps 1-3 are independent of each other. Steps 4 and 5 are independent of
everything before them.

---

## 8. Related work: what comes after this spec

Five further requirements were raised on 2026-09-07. They are recorded here so
this spec is not read as the whole picture, and so section 5's treatment of the
Notifications link makes sense. Each gets its own spec; none is in scope here.

| | Piece | Size | Blocked on |
|---|---|---|---|
| A | Student data exposure fix | Small | Nothing |
| B | Approvals inbox for the Principal | Medium | Nothing |
| C | Parent dashboard | Medium | Nothing |
| D | Bulk SMS & email to parents | Medium | Gateway credentials |
| E | Teacher sees only their own students | Large | Schema + auth model change |

Order: A, B, C, D, then E. A-D are independent of each other; E goes last
because it changes how authorization works and would otherwise have to be
retrofitted into each of the others.

**A. Student data exposure.** `VIEW_ONLY` is computed as every permission ending
in `.view`, and `students.view` ends in `.view` — so `bom_member`,
`internal_auditor`, `external_auditor` and `system_admin` are all handed full
student records, including dates of birth, NEMIS UPI numbers and guardian
contacts. The fix follows the pattern already established for
`counseling.access` and `health.access`, both of which are deliberately not
named `.view` precisely to escape this sweep. Smallest item on the list and a
live privacy problem, so it goes first.

**B. Approvals inbox.** Approve endpoints already exist for journals, budgets,
requisitions, payments and leave, and `dashboard.widgets.ts` already surfaces
pending items to whoever holds the matching approve permission. What is missing
is one consolidated inbox for the Principal rather than five scattered pages.
Largely assembly of what exists.

**C. Parent dashboard.** `portal.routes.ts` already serves children, fee
statement, report card, attendance and notices, each protected by `requireSelf`
against the IDOR its comment describes, and `guardian_students` links parent
users to students. Frontend-only, but it needs its own layout — the current
sidebar is staff-shaped and a parent should not see it.

**D. Bulk SMS & email.** The backend has templates, `renderTemplate`, delivery
status tracking and a clean `NotificationProvider` interface, but
`sendNotificationSchema` accepts one recipient per call and the only provider is
`consoleNotificationProvider`, which logs and sends nothing. Needs a bulk/
recipient-group path ("all Form 2 parents", "all parents in arrears") and a real
adapter. **Decided: Africa's Talking for SMS, plain SMTP for email**, both behind
the existing provider interface so the console stub stays the dev default.
Requires an API key, a registered sender ID, rate limiting, and awareness that a
broadcast to 800 parents is a real cost at roughly KES 0.8-1.0 per message.

**E. Teacher data scoping.** `teacher_assignments` (teacher, subject, class,
stream, period) is the data path, but two things block it. There is no link from
a logged-in user to their teacher record — `teachers` has no `userId` and neither
does `staff` — so a schema change comes first. And `requirePermission(code)`
answers "may you do this action", not "which rows may you see"; row-level
filtering is a new authorization dimension affecting every student-touching
endpoint. `user_roles.scopeType`/`scopeId` is documented in `09-rbac.md` as an
unused extension point intended for exactly this.
