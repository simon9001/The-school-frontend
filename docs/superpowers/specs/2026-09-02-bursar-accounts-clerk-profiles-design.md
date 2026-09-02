# Bursar & Accounts Clerk Role Profiles — Design

**Date:** 2026-09-02
**Status:** Approved design, pending implementation plan
**Repos touched:** `Schoolfrontend` (primary), `Accounts` (backend)

## Purpose

The `bursar` and `accounts_clerk` roles are fully defined in the backend RBAC
catalogue but only partly reachable in the UI. The Bursar holds permissions for
two areas that have no page at all, and the Accounts Clerk's only page is built
around a workflow that is not his. This design completes both profiles so each
role can perform its real duties end to end.

## Background: what these roles do

**Bursar** — the school's day-to-day accounting officer. Sets fee structures and
raises invoices; supervises receipting and banks collections; maintains the cash
book, ledger and trial balance; drafts and monitors the budget vote by vote;
records capitation and grant receipts; raises requisitions, LPOs and payment
vouchers; processes payroll; maintains the asset register; issues and retires
imprest; and reports monthly and termly to the Principal and BOM, producing the
annual IPSAS statements and preparing for the OAG audit. Approves nothing he
prepares — the Principal and BOM Treasurer hold every approval permission.

**Accounts Clerk** — the front counter. A parent arrives, he finds the student,
shows the balance, takes the money (cash, M-Pesa, bank slip, cheque), issues a
numbered receipt, and posts it against the right invoice. He prints fee
statements on request, cashes up at the end of the day, and prepares the banking
slip for the Bursar.

## Current state

Both roles are defined in `Accounts/src/modules/identity/rbac.ts`. Route-level
and sidebar-level permission gating already work correctly
(`components/auth/PrivateRoute.tsx`, `dashboardDesign/Sidebar.tsx`). Dashboard
widgets are permission-gated on the backend and already cover fees, budget,
grants, procurement, payroll, assets, inventory and banking.

The gaps are:

| Gap | Affects | Backend status |
|---|---|---|
| No Banking & Imprest page | Bursar | Complete — unused |
| No Reports page; `/api/reports` serves trial-balance only | Bursar | Partial |
| No in-page permission checks anywhere | Both | n/a |
| Fees page is invoice-first, no student search | Clerk | Complete — unused |
| Receipt number never surfaced, nothing printable | Clerk | Complete — unused |
| No fee statement view | Clerk, Bursar | Complete — unused |
| No payments register / daily collections | Clerk, Bursar | Missing endpoint |
| No arrears or debtors list | Bursar | Complete — unused |

Much of this is frontend work against endpoints that already exist and are never
called.

## Decisions taken

**1. Split the clerk's workflow onto its own page** rather than making one Fees
page adapt. The two workflows genuinely differ — the Bursar works from invoices,
the Clerk works from students — and the permission boundary to express it already
exists. The Bursar holds every clerk permission, so he sees both pages, which
matches reality: he covers the desk when the clerk is away.

**2. Remove `fees.invoice.manage` from `accounts_clerk`.** The clerk currently
holds both `fees.receipt.create` and `fees.invoice.manage`, meaning the person
taking cash can also write the invoice down to match — the standard way school
fee fraud is concealed. After this change the Bursar raises all invoices and the
clerk only receipts against them.

Two consequences follow, both accepted:

- **A payment requires an invoice.** `createPaymentSchema` requires `invoiceId`
  as a positive integer, so the clerk cannot receipt a parent who pays before the
  term's invoice is raised. The UI must state this plainly rather than presenting
  a form that fails. Allowing unallocated advances is a data-model change and is
  explicitly out of scope here.
- **Source edits do not revoke.** `db:sync-rbac` is additive-only and never
  removes rows, so editing `rbac.ts` alone leaves every existing clerk holding
  the permission in the database. A revocation path is required — see Phase 4.

## Design

### Phase 0 — Permission-aware UI

`PrivateRoute.tsx` documents the intent that page actions perform their own
finer-grained permission checks. No page does. This is the root cause of the
clerk being shown buttons that return 403.

- Add `Schoolfrontend/src/hooks/usePermissions.ts` exporting `useCan()`, returning
  `{ can(code), canAny(codes) }` read from `authSlice.user.permissions`.
- The hook is the single place page-level gating is expressed; pages never read
  `state.authSlice.user.permissions` directly for gating.

Applied in Phase 1 onward. No behaviour changes on its own.

### Phase 1 — Accounts Clerk

**New page: Fee Counter** (`/dashboard/finance/counter`, permission
`fees.receipt.create`, sidebar under Finance).

Student-first, built for someone standing at a desk:

- Search a student by name or admission number.
- Student fee card: invoices, payments, and running balance, from the existing
  `GET /fees/students/:id/invoices` and `GET /fees/students/:id/payments`.
- Receipt a payment directly from the card.
- Where a student has no open invoice, show an explicit "No invoice raised for
  this period — ask the Bursar to raise one" state, not a disabled form.

**Printable receipt.** `FeePayment.receiptNo` is already generated by the backend
and present on the frontend type; it is never displayed. After a payment is
recorded, show a receipt with receipt number, student, amount, method, reference,
date and receiving officer, printable via a dedicated print stylesheet.

**School name.** Receipts and statements carry the school's own name as their
letterhead. It is configured in the frontend's `.env` as `VITE_SCHOOL_NAME`,
not served by the API: a printed receipt must never wait on a network call for
its letterhead, and a failed request would otherwise hand a parent a receipt
with no school name on it. Changing the name requires a frontend rebuild, which
is acceptable for a value that changes almost never. This introduces the
frontend's first `.env`, so `.gitignore` must be corrected at the same time — it
currently ignores `*.local` but not `.env`.

**Printable fee statement.** The same student fee card in a print layout —
invoices, payments and closing balance for the period.

**Fees page gating.** Hide the Fee Structures tab and the New Fee Structure
button without `fees.structure.manage`; hide New Invoice without
`fees.invoice.manage`; hide the Record Payment action without
`fees.receipt.create`.

**Invoice list.** Add search, a status filter, an outstanding-balance column, and
an arrears filter. The arrears filter is the Bursar's debtors list — there is no
separate page for it.

**Daily collections register.** A list of the day's payments with totals by
method, for cash-up and preparing the banking slip.

- **New backend endpoint:** `GET /fees/payments?from=&to=&method=`, gated
  `fees.view`. Only the per-student listing exists today.

### Phase 2 — Bursar: Banking & Imprest

The backend is complete and unused: `Accounts/src/modules/banking/` provides bank
accounts, reconciliations with items, and imprest issue and retirement, with the
journal postings already wired in the schema.

- New frontend module `Schoolfrontend/src/modules/banking/` — `BankingApi.ts`,
  `types.ts`, `BankingPage.tsx`.
- Three tabs: Bank Accounts, Reconciliations, Imprest.
  - Bank Accounts: list, create, link to GL account and optionally a fund.
  - Reconciliations: list per bank account; create with statement date, statement
    balance, book balance and items (outstanding cheque, deposit in transit, bank
    charge, other); mark reconciled. Creating requires `banking.manage`, marking
    reconciled requires `banking.reconcile`.
  - Imprest: list requests, issue (`imprest.issue`), retire with expense lines
    and balance returned (`imprest.retire`); surface overdue status.
- Flip `built: true` on the existing Banking entry in `navigation.ts`.

No backend changes.

### Phase 3 — Bursar: Reports

`journalRepository.trialBalanceRows` already returns each account's `type`
(`asset`, `liability`, `net_assets`, `revenue`, `expense`) and `normalBalance`,
so the IPSAS statements are a grouping over a query that exists.

**New backend endpoints**, all gated `reports.view`, added to `reportsRoutes`:

- `GET /reports/income-expenditure?from=&to=&fundId=` — revenue and expense
  grouped by type, with a surplus/deficit total. Requires a date-range variant of
  `trialBalanceRows`, which currently filters `lte(entryDate, asOfDate)` only.
- `GET /reports/financial-position?asOf=&fundId=` — assets, liabilities and net
  assets. Uses the existing as-of query unchanged.
- `GET /reports/fee-collection?from=&to=` — collections by method and by class,
  plus outstanding arrears.

**New frontend page** `/dashboard/finance/reports`, permission `reports.view`,
sidebar under Finance. Tabbed: Income & Expenditure, Financial Position, Fee
Collection, with the existing Trial Balance linked rather than duplicated.
Printing requires only `reports.view` — anyone who can read a report can print
it. CSV export requires `reports.export`.

Budget vs Actual already works and is already wired into `BudgetsPage.tsx`; it is
linked from Reports, not rebuilt.

### Phase 4 — Revoking the clerk's invoice permission

Two parts, both required. Doing only the first is a silent no-op in production.

**Source.** Remove `'fees.invoice.manage'` from the `accounts_clerk` role in
`Accounts/src/modules/identity/rbac.ts`, leaving
`['fees.receipt.create', 'fees.view', 'students.view', 'dashboard.view']`.

**Revocation.** Add an opt-in `--prune` flag to `Accounts/src/db/sync-rbac.ts`
that deletes `role_permissions` rows for roles still defined in `rbac.ts` whose
permission is no longer listed for that role. Without the flag, behaviour is
unchanged and additive-only.

- The exact set to delete is already computed as `orphanRolePermissions` in
  `systemService.rbacDrift()` — reuse that rather than recomputing it.
- The flag prints every mapping it will remove and requires confirmation before
  deleting.
- Scope is deliberately limited to role-permission mappings. Orphan *permissions*
  and orphan *roles* are not pruned: deleting a permission row cascades to
  `role_permissions`, and the existing code comments call that out as the reason
  they are surfaced rather than deleted automatically.

**Segregation rule.** Do not add a `fees.receipt.create` / `fees.invoice.manage`
pair to `SEGREGATION_RULES` in `system.service.ts`. That list documents pairs
*no single role holds* — a user only trips it by being granted two roles. Once
the clerk no longer holds both, the invariant holds by construction, and adding
the rule would correctly flag every Bursar, who legitimately holds both as the
maker with the Principal as checker.

## Out of scope

- Unallocated advance payments (receipting before an invoice exists).
- Pruning orphan permissions or orphan roles.
- Any change to approval routing — the Principal and BOM Treasurer keep every
  approval permission.
- The `academic_records` permission gap noted in `09-rbac.md`.
- Inventory management for the Bursar; `store_keeper` keeps `inventory.manage`
  and the Bursar keeps `inventory.view`.

## Testing

Each phase is verified by logging in as the affected role and walking its duty
list, not by inspecting code:

- **Phase 0/1, clerk:** search a student, view the balance, receipt a payment,
  print the receipt, print a statement, cash up from the collections register.
  Confirm the Fee Structures tab and New Invoice are absent.
- **Phase 1, bursar:** confirm both Fees and Fee Counter are visible and that
  invoice raising still works.
- **Phase 2, bursar:** create a bank account, create and reconcile a
  reconciliation, issue and retire an imprest; confirm the journal entries post.
- **Phase 3, bursar:** run each report, confirm Income & Expenditure and
  Financial Position agree with the trial balance for the same date, export CSV.
- **Phase 4:** run `db:sync-rbac --prune` against a copy, confirm exactly the one
  mapping is removed, confirm the drift widget reports in sync, and confirm a
  clerk session can no longer raise an invoice via the API directly, not just in
  the UI.

## Documentation to update on completion

- `Accounts/project-documentation/09-rbac.md` — the `accounts_clerk` row in the
  Roles table, and the note that `requirePermission` is unattached, which is now
  false; routes are gated.
- `Schoolfrontend/frontenddocumentation.md` — the new Fee Counter, Banking and
  Reports modules.
