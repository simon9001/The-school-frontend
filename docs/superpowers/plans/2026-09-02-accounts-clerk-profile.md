# Accounts Clerk Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Accounts Clerk a working front-counter workflow — find a student, see the balance, receipt a payment, print the receipt and statement, cash up at the end of the day — and stop showing every role buttons it has no permission to press.

**Architecture:** A new `useCan()` hook makes page actions permission-aware for the first time (routes and sidebar already are). A new student-first Fee Counter page sits alongside the existing invoice-first Fees page, both gated so each role sees only its own. One new backend endpoint lists payments by date range for cash-up; one existing endpoint gains a paid-to-date figure so invoices can show an outstanding balance. Two pure calculation helpers carry the only non-trivial logic and are unit tested.

**Tech Stack:** React 19, Redux Toolkit + RTK Query, react-hook-form, react-router 8, TailwindCSS 4 + daisyUI 5, lucide-react, sonner. Backend: Hono 4, Drizzle ORM, Zod 4, Postgres. Vitest (added by this plan, backend only). Package manager: pnpm.

**Spec:** `Schoolfrontend/docs/superpowers/specs/2026-09-02-bursar-accounts-clerk-profiles-design.md`

**Scope:** This plan covers Phase 0 and Phase 1 of that spec. Phases 2 (Banking & Imprest), 3 (Reports) and 4 (permission revocation) each get their own plan.

## Global Constraints

- Two separate git repos. Frontend paths are relative to `Schoolfrontend/`, backend paths to `Accounts/`. Never commit across both in one commit.
- Backend `tsconfig.json` sets `verbatimModuleSyntax: true` — every type-only import MUST use `import type { … }`.
- Backend is ESM with `module: NodeNext` — every relative import MUST carry a `.js` extension, even when the file on disk is `.ts`.
- Every backend API response is wrapped by `ok()` / `created()` from `src/common/response.js` as `{ success, data }`. RTK Query endpoints unwrap it with `transformResponse: (r: ApiEnvelope<T>) => r.data`.
- Every backend route is gated with `requirePermission(code)` from `src/common/auth.js`.
- Frontend money is rendered with the existing `formatMoney` idiom: `Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- Frontend tests are out of scope (decision recorded in the spec). Backend tests are Vitest, and cover pure functions only — no test database.
- The clerk's permission set after Phase 4 will be `fees.receipt.create`, `fees.view`, `students.view`, `dashboard.view`. Gate against those codes now; Phase 4 removes `fees.invoice.manage` from the role.

---

### Task 1: `useCan` permission hook

`PrivateRoute.tsx:15-16` documents the intent that page actions do their own finer-grained permission checks. No page does. This hook is that missing piece, and every later task depends on it.

**Files:**
- Create: `Schoolfrontend/src/hooks/usePermissions.ts`

**Interfaces:**
- Consumes: `RootState` from `src/store/store.ts`; `authSlice.user.permissions: string[]`.
- Produces: `useCan(): { can: (code: string) => boolean; canAny: (codes: string[]) => boolean }`. Every later task imports `useCan` from `../../hooks/usePermissions`.

- [ ] **Step 1: Create the hook**

```ts
import { useSelector } from 'react-redux'
import type { RootState } from '../store/store'

/**
 * Page-level permission checks. Routing and the sidebar are already gated
 * (PrivateRoute, Sidebar), but individual actions — buttons, tabs, table
 * columns — were not, so every role saw controls that return 403 on click.
 *
 * Mirrors the sidebar's rule exactly: a user has a permission only if the
 * exact code is in their granted list. No wildcards, no role-name checks.
 */
export const useCan = () => {
  const permissions = useSelector((state: RootState) => state.authSlice.user?.permissions) ?? []

  const can = (code: string) => permissions.includes(code)
  const canAny = (codes: string[]) => codes.some((code) => permissions.includes(code))

  return { can, canAny }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd Schoolfrontend && pnpm build`
Expected: build succeeds. The hook is not yet imported anywhere, so this only proves it compiles against `RootState`.

- [ ] **Step 3: Commit**

```bash
cd Schoolfrontend
git add src/hooks/usePermissions.ts
git commit -m "Add useCan hook for page-level permission checks"
```

---

### Task 2: Gate the Fees page actions

The clerk holds `fees.view` and `fees.receipt.create` but not `fees.structure.manage`, so today the Fee Structures tab and its New Fee Structure button both 403 on click. After Phase 4 he will not hold `fees.invoice.manage` either.

**Files:**
- Modify: `Schoolfrontend/src/modules/fees/FeesPage.tsx`

**Interfaces:**
- Consumes: `useCan()` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Import the hook**

Add to the imports at the top of `FeesPage.tsx`:

```tsx
import { useCan } from '../../hooks/usePermissions'
```

- [ ] **Step 2: Derive the permission flags in the page component**

Inside `const FeesPage: React.FC = () => {`, immediately after the existing `useState` declarations, add:

```tsx
const { can } = useCan()
const canManageStructures = can('fees.structure.manage')
const canManageInvoices = can('fees.invoice.manage')
const canReceipt = can('fees.receipt.create')
```

- [ ] **Step 3: Hide the Fee Structures tab trigger**

The tab state already defaults to `'invoices'`, which every `fees.view` holder can see, so the initial value needs no change — hiding the trigger is enough to make the structures tab unreachable.

Replace the tab list block:

```tsx
<div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
    <a role="tab" className={`tab ${tab === 'invoices' ? 'tab-active' : ''}`} onClick={() => setTab('invoices')}>Invoices</a>
    <a role="tab" className={`tab ${tab === 'structures' ? 'tab-active' : ''}`} onClick={() => setTab('structures')}>Fee Structures</a>
</div>
```

with:

```tsx
<div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
    <a role="tab" className={`tab ${tab === 'invoices' ? 'tab-active' : ''}`} onClick={() => setTab('invoices')}>Invoices</a>
    {canManageStructures && (
        <a role="tab" className={`tab ${tab === 'structures' ? 'tab-active' : ''}`} onClick={() => setTab('structures')}>Fee Structures</a>
    )}
</div>
```

- [ ] **Step 4: Hide the header action buttons**

Replace the header button block:

```tsx
{tab === 'structures' ? (
    <button onClick={() => setIsStructureModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
        <Plus size={16} /> New Fee Structure
    </button>
) : (
    <button onClick={() => setIsInvoiceModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
        <Plus size={16} /> New Invoice
    </button>
)}
```

with:

```tsx
{tab === 'structures' && canManageStructures && (
    <button onClick={() => setIsStructureModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
        <Plus size={16} /> New Fee Structure
    </button>
)}
{tab === 'invoices' && canManageInvoices && (
    <button onClick={() => setIsInvoiceModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
        <Plus size={16} /> New Invoice
    </button>
)}
```

- [ ] **Step 5: Gate the per-row Record Payment action**

In the invoices table body, replace:

```tsx
{(inv.status === 'open' || inv.status === 'partially_paid') && (
```

with:

```tsx
{canReceipt && (inv.status === 'open' || inv.status === 'partially_paid') && (
```

- [ ] **Step 6: Verify by logging in as each role**

Run: `cd Schoolfrontend && pnpm build && pnpm dev`

Log in as a Bursar: both tabs visible, both buttons appear on their tab, Record Payment icon present.
Log in as an Accounts Clerk: only the Invoices tab, no New Fee Structure button, Record Payment icon present. (New Invoice remains visible until Phase 4 removes the permission — expected.)

- [ ] **Step 7: Commit**

```bash
cd Schoolfrontend
git add src/modules/fees/FeesPage.tsx
git commit -m "Gate Fees page actions on the caller's permissions"
```

---

### Task 3: Backend Vitest setup and the payment date-range parser

Sets up the test runner and lands its first real test. The parser matters because the cash-up register defaults to *today* when no range is given — a wrong default silently shows the clerk the wrong money.

**Files:**
- Create: `Accounts/vitest.config.ts`
- Create: `Accounts/src/modules/fees/fees.calculations.ts`
- Create: `Accounts/src/modules/fees/fees.calculations.test.ts`
- Modify: `Accounts/package.json`
- Modify: `Accounts/tsconfig.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseDateRange(from: string | undefined, to: string | undefined, today: string): { from: string; to: string }` — exported from `fees.calculations.js`, used by Task 4's controller.

- [ ] **Step 1: Install Vitest**

```bash
cd Accounts
pnpm add -D vitest
```

- [ ] **Step 2: Add the Vitest config**

Create `Accounts/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // The codebase is ESM with NodeNext, so every relative import carries a
    // `.js` extension even though the file on disk is `.ts`. Vite does not
    // resolve that by default, so strip the extension and let it find the .ts.
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }],
  },
})
```

- [ ] **Step 3: Add the test scripts**

In `Accounts/package.json`, add to `"scripts"` after `"start"`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 4: Keep tests out of the production build**

In `Accounts/tsconfig.json`, change the `exclude` array to:

```json
  "exclude": ["node_modules", "drizzle.config.ts", "drizzle", "vitest.config.ts", "src/**/*.test.ts"]
```

- [ ] **Step 5: Write the failing test**

Create `Accounts/src/modules/fees/fees.calculations.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseDateRange } from './fees.calculations.js'

describe('parseDateRange', () => {
  it('defaults both ends to today when neither is given', () => {
    expect(parseDateRange(undefined, undefined, '2026-09-02')).toEqual({ from: '2026-09-02', to: '2026-09-02' })
  })

  it('defaults the end of an open range to today', () => {
    expect(parseDateRange('2026-09-01', undefined, '2026-09-02')).toEqual({ from: '2026-09-01', to: '2026-09-02' })
  })

  it('defaults the start of an open range to the end date, not to today', () => {
    expect(parseDateRange(undefined, '2026-08-31', '2026-09-02')).toEqual({ from: '2026-08-31', to: '2026-08-31' })
  })

  it('keeps an explicit range as given', () => {
    expect(parseDateRange('2026-08-01', '2026-08-31', '2026-09-02')).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })

  it('swaps a backwards range rather than returning nothing', () => {
    expect(parseDateRange('2026-08-31', '2026-08-01', '2026-09-02')).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })

  it('rejects a malformed date', () => {
    expect(() => parseDateRange('31-08-2026', undefined, '2026-09-02')).toThrow('Invalid date')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd Accounts && pnpm test`
Expected: FAIL — cannot resolve `./fees.calculations.js`.

- [ ] **Step 7: Write the implementation**

Create `Accounts/src/modules/fees/fees.calculations.ts`:

```ts
import { ValidationError } from '../../common/errors.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function assertIsoDate(value: string): string {
  if (!ISO_DATE.test(value)) throw new ValidationError(`Invalid date: ${value}. Expected YYYY-MM-DD.`)
  return value
}

/**
 * Resolves the date window for the collections register.
 *
 * The clerk's normal use is "what did I take today", so an absent range means
 * today at both ends rather than all-time. An open-ended range anchors to the
 * end the caller did give — asking for everything up to 31 August should not
 * silently stretch forward to today.
 */
export function parseDateRange(
  from: string | undefined,
  to: string | undefined,
  today: string,
): { from: string; to: string } {
  const start = from ? assertIsoDate(from) : to ? assertIsoDate(to) : today
  const end = to ? assertIsoDate(to) : from ? today : today

  return start <= end ? { from: start, to: end } : { from: end, to: start }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd Accounts && pnpm test`
Expected: PASS — 6 tests.

- [ ] **Step 9: Commit**

```bash
cd Accounts
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts src/modules/fees/fees.calculations.ts src/modules/fees/fees.calculations.test.ts
git commit -m "Add Vitest and the collections date-range parser"
```

---

### Task 4: Invoice balance calculation

The invoice list needs an outstanding-balance column, but `fee_payments` has no invoice link — allocation runs through `fee_payment_allocations` to `fee_invoice_items`. Fetching that per invoice would be an N+1, so one grouped query returns every invoice's allocated total and a pure function merges it in.

**Files:**
- Modify: `Accounts/src/modules/fees/fees.calculations.ts`
- Modify: `Accounts/src/modules/fees/fees.calculations.test.ts`

**Interfaces:**
- Consumes: `parseDateRange` from Task 3 (same file, no import needed).
- Produces:
  - `type InvoiceBalance = { amountPaid: number; balance: number }`
  - `mergeInvoiceBalances<T extends { id: number; totalAmount: string }>(invoices: T[], allocated: { invoiceId: number; allocated: number }[]): (T & InvoiceBalance)[]` — used by Task 5's service.

- [ ] **Step 1: Write the failing test**

In `Accounts/src/modules/fees/fees.calculations.test.ts`, extend the existing import to `import { mergeInvoiceBalances, parseDateRange } from './fees.calculations.js'`, then append this block below the existing `describe`:

```ts
describe('mergeInvoiceBalances', () => {
  const invoices = [
    { id: 1, totalAmount: '15000.00' },
    { id: 2, totalAmount: '8000.00' },
  ]

  it('reports a fully unpaid invoice as owing the whole amount', () => {
    expect(mergeInvoiceBalances(invoices, [])).toEqual([
      { id: 1, totalAmount: '15000.00', amountPaid: 0, balance: 15000 },
      { id: 2, totalAmount: '8000.00', amountPaid: 0, balance: 8000 },
    ])
  })

  it('subtracts what has been allocated', () => {
    const result = mergeInvoiceBalances(invoices, [{ invoiceId: 1, allocated: 5000 }])
    expect(result[0]).toEqual({ id: 1, totalAmount: '15000.00', amountPaid: 5000, balance: 10000 })
    expect(result[1]).toEqual({ id: 2, totalAmount: '8000.00', amountPaid: 0, balance: 8000 })
  })

  it('reports a fully paid invoice as zero, not a negative', () => {
    const result = mergeInvoiceBalances(invoices, [{ invoiceId: 1, allocated: 15000 }])
    expect(result[0].balance).toBe(0)
  })

  it('never returns a negative balance when over-allocated', () => {
    const result = mergeInvoiceBalances(invoices, [{ invoiceId: 1, allocated: 20000 }])
    expect(result[0].balance).toBe(0)
    expect(result[0].amountPaid).toBe(20000)
  })

  it('ignores allocation rows for invoices not in the list', () => {
    const result = mergeInvoiceBalances(invoices, [{ invoiceId: 999, allocated: 1000 }])
    expect(result[0].amountPaid).toBe(0)
    expect(result[1].amountPaid).toBe(0)
  })

  it('rounds to cents rather than leaking float drift', () => {
    const result = mergeInvoiceBalances([{ id: 1, totalAmount: '0.30' }], [{ invoiceId: 1, allocated: 0.1 + 0.2 }])
    expect(result[0].balance).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Accounts && pnpm test`
Expected: FAIL — `mergeInvoiceBalances` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `Accounts/src/modules/fees/fees.calculations.ts`:

```ts
export interface InvoiceBalance {
  amountPaid: number
  balance: number
}

const toCents = (value: number) => Math.round(value * 100)

/**
 * Attaches paid-to-date and outstanding figures to invoices.
 *
 * Payments reach an invoice only through fee_payment_allocations, so the
 * allocated totals arrive as one grouped query rather than a lookup per
 * invoice. Comparison is done in integer cents: 0.1 + 0.2 !== 0.3 in floats,
 * and a fully paid invoice must read as exactly zero, never as 0.0000001 owing.
 */
export function mergeInvoiceBalances<T extends { id: number; totalAmount: string }>(
  invoices: T[],
  allocated: { invoiceId: number; allocated: number }[],
): (T & InvoiceBalance)[] {
  const allocatedByInvoice = new Map(allocated.map((row) => [row.invoiceId, row.allocated]))

  return invoices.map((invoice) => {
    const amountPaid = allocatedByInvoice.get(invoice.id) ?? 0
    const outstandingCents = Math.max(0, toCents(Number(invoice.totalAmount)) - toCents(amountPaid))
    return { ...invoice, amountPaid, balance: outstandingCents / 100 }
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Accounts && pnpm test`
Expected: PASS — 12 tests total.

- [ ] **Step 5: Commit**

```bash
cd Accounts
git add src/modules/fees/fees.calculations.ts src/modules/fees/fees.calculations.test.ts
git commit -m "Add invoice outstanding-balance calculation"
```

---

### Task 5: Backend — payments listing and invoice balances

**Files:**
- Modify: `Accounts/src/modules/fees/fees.repository.ts`
- Modify: `Accounts/src/modules/fees/fees.service.ts`
- Modify: `Accounts/src/modules/fees/fees.controller.ts`
- Modify: `Accounts/src/modules/fees/fees.routes.ts`

**Interfaces:**
- Consumes: `parseDateRange`, `mergeInvoiceBalances` from Tasks 3 and 4.
- Produces:
  - `GET /api/fees/payments?from=&to=&method=` → `FeePayment[]`, gated `fees.view`.
  - `GET /api/fees/invoices` → now returns each invoice with `amountPaid: number` and `balance: number` added.

- [ ] **Step 1: Add the repository queries**

In `Accounts/src/modules/fees/fees.repository.ts`, extend the drizzle import on line 1 to include the operators used below:

```ts
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
```

Then add these two functions to the `feesRepository` object, after `findPaymentsByStudent`:

```ts
  findPaymentsInRange: (from: string, to: string, method?: 'cash' | 'bank' | 'mpesa' | 'cheque') => {
    const conditions = [gte(feePayments.paymentDate, from), lte(feePayments.paymentDate, to)]
    if (method) conditions.push(eq(feePayments.paymentMethod, method))
    return db.select().from(feePayments).where(and(...conditions)).orderBy(feePayments.paymentDate, feePayments.id)
  },

  // One grouped query for every invoice's allocated total. Doing this per
  // invoice would be an N+1 across the whole invoice list.
  async allocatedByInvoice(invoiceIds: number[]) {
    if (invoiceIds.length === 0) return []
    const rows = await db
      .select({
        invoiceId: feeInvoiceItems.invoiceId,
        allocated: sql<string>`coalesce(sum(${feePaymentAllocations.amountAllocated}), 0)`,
      })
      .from(feeInvoiceItems)
      .leftJoin(feePaymentAllocations, eq(feePaymentAllocations.invoiceItemId, feeInvoiceItems.id))
      .where(inArray(feeInvoiceItems.invoiceId, invoiceIds))
      .groupBy(feeInvoiceItems.invoiceId)
    return rows.map((r) => ({ invoiceId: r.invoiceId, allocated: Number(r.allocated) }))
  },
```

- [ ] **Step 2: Add the service functions**

In `Accounts/src/modules/fees/fees.service.ts`, add the import below the existing ones:

```ts
import { mergeInvoiceBalances } from './fees.calculations.js'
```

Replace the existing `listInvoices` line:

```ts
  listInvoices: () => feesRepository.findAllInvoices(),
```

with:

```ts
  async listInvoices() {
    const invoices = await feesRepository.findAllInvoices()
    const allocated = await feesRepository.allocatedByInvoice(invoices.map((i) => i.id))
    return mergeInvoiceBalances(invoices, allocated)
  },
```

Then add, next to `listPaymentsByStudent`:

```ts
  listPaymentsInRange: (from: string, to: string, method?: 'cash' | 'bank' | 'mpesa' | 'cheque') =>
    feesRepository.findPaymentsInRange(from, to, method),
```

- [ ] **Step 3: Add the controller**

In `Accounts/src/modules/fees/fees.controller.ts`, add the import:

```ts
import { parseDateRange } from './fees.calculations.js'
```

Add to the `feesController` object, next to `listPaymentsByStudent`:

```ts
  listPayments: async (c: Context) => {
    const today = new Date().toISOString().slice(0, 10)
    const { from, to } = parseDateRange(c.req.query('from'), c.req.query('to'), today)
    const methodParam = c.req.query('method')
    const method = methodParam as 'cash' | 'bank' | 'mpesa' | 'cheque' | undefined
    return ok(c, await feesService.listPaymentsInRange(from, to, method))
  },
```

- [ ] **Step 4: Register the route**

In `Accounts/src/modules/fees/fees.routes.ts`, add above the existing `feesRoutes.get('/students/:studentId/payments', …)` line:

```ts
feesRoutes.get('/payments', requirePermission('fees.view'), feesController.listPayments)
```

Order matters only against other `/payments` paths; the existing `POST /payments` is a different method, so there is no conflict.

- [ ] **Step 5: Verify the build and tests still pass**

Run: `cd Accounts && pnpm build && pnpm test`
Expected: build succeeds, 12 tests pass.

- [ ] **Step 6: Verify the endpoints against a running server**

Run: `cd Accounts && pnpm dev`, then with a Bursar or Clerk token:

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/fees/payments"
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/fees/invoices"
```

Expected: the first returns only today's payments; the second returns invoices each carrying `amountPaid` and `balance`.

- [ ] **Step 7: Commit**

```bash
cd Accounts
git add src/modules/fees/
git commit -m "Add payments listing by date range and invoice balances"
```

---

### Task 6: Frontend — payments and invoice balance types and API

**Files:**
- Modify: `Schoolfrontend/src/modules/fees/types.ts`
- Modify: `Schoolfrontend/src/modules/fees/FeesApi.ts`

**Interfaces:**
- Consumes: the two endpoints from Task 5.
- Produces:
  - `FeeInvoiceWithBalance` — `FeeInvoice & { amountPaid: number; balance: number }`
  - `PaymentRangeQuery` — `{ from?: string; to?: string; method?: PaymentMethod }`
  - `useGetAllInvoicesQuery` now returns `FeeInvoiceWithBalance[]`
  - `useGetPaymentsInRangeQuery(query: PaymentRangeQuery)` returning `FeePayment[]`

- [ ] **Step 1: Add the types**

In `Schoolfrontend/src/modules/fees/types.ts`, add after the `FeeInvoiceWithItems` interface:

```ts
export interface FeeInvoiceWithBalance extends FeeInvoice {
  amountPaid: number
  balance: number
}
```

And after the `FeePayment` interface:

```ts
export type PaymentRangeQuery = {
  from?: string
  to?: string
  method?: PaymentMethod
}
```

- [ ] **Step 2: Update the API module**

In `Schoolfrontend/src/modules/fees/FeesApi.ts`, add `FeeInvoiceWithBalance` and `PaymentRangeQuery` to the type import list.

Replace the `getAllInvoices` endpoint:

```ts
    getAllInvoices: builder.query<FeeInvoice[], void>({
      query: () => 'fees/invoices',
      transformResponse: (response: ApiEnvelope<FeeInvoice[]>) => response.data,
      providesTags: ['FeeInvoices'],
    }),
```

with:

```ts
    getAllInvoices: builder.query<FeeInvoiceWithBalance[], void>({
      query: () => 'fees/invoices',
      transformResponse: (response: ApiEnvelope<FeeInvoiceWithBalance[]>) => response.data,
      providesTags: ['FeeInvoices', 'FeePayments'],
    }),
```

The added `FeePayments` tag matters: recording a payment must refresh the balance column, and `recordPayment` already invalidates that tag.

Add a new endpoint after `getPaymentsByStudent`:

```ts
    getPaymentsInRange: builder.query<FeePayment[], PaymentRangeQuery>({
      query: ({ from, to, method }) => {
        const params = new URLSearchParams()
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        if (method) params.set('method', method)
        const qs = params.toString()
        return qs ? `fees/payments?${qs}` : 'fees/payments'
      },
      transformResponse: (response: ApiEnvelope<FeePayment[]>) => response.data,
      providesTags: ['FeePayments'],
    }),
```

Add `useGetPaymentsInRangeQuery` to the exported hooks list at the bottom.

- [ ] **Step 3: Verify it typechecks**

Run: `cd Schoolfrontend && pnpm build`
Expected: build succeeds. `FeesPage.tsx` consumes `getAllInvoices` but only reads fields present on both types, so it still compiles.

- [ ] **Step 4: Commit**

```bash
cd Schoolfrontend
git add src/modules/fees/types.ts src/modules/fees/FeesApi.ts
git commit -m "Add payments-in-range query and invoice balance types"
```

---

### Task 7: School name config, print stylesheet, and the printable receipt

Kenyan schools must hand the parent a numbered receipt. `receiptNo` has always been generated by the backend and shown nowhere.

The receipt and statement carry the school's own name as their letterhead, so this task also introduces the frontend's first `.env`. The name lives on the frontend rather than the backend deliberately: a printed receipt must never wait on a network call for its letterhead, and a failed request would otherwise produce a receipt with no school name on it. The cost is that changing the name needs a rebuild — acceptable for a value that changes almost never.

**Files:**
- Create: `Schoolfrontend/.env`
- Create: `Schoolfrontend/.env.example`
- Create: `Schoolfrontend/src/vite-env.d.ts`
- Create: `Schoolfrontend/src/config/school.ts`
- Create: `Schoolfrontend/src/modules/fees/PrintableReceipt.tsx`
- Modify: `Schoolfrontend/.gitignore`
- Modify: `Schoolfrontend/src/index.css`

**Interfaces:**
- Consumes: `FeePayment` from `./types`; `Student` from `../students/types`.
- Produces:
  - `schoolName: string` exported from `src/config/school.ts` — imported by Tasks 9 and 10.
  - `<PrintableReceipt payment={…} student={…} schoolName={…} receivedByName={…} onClose={…} />` — a modal with a Print button. Used by Task 9.

- [ ] **Step 1: Stop `.env` files being committed**

The frontend `.gitignore` ignores `*.local` but not `.env`, so without this the file below would be committed. Append to `Schoolfrontend/.gitignore`, after the `*.local` line:

```gitignore
# Local environment config — .env.example is the committed template
.env
.env.*
!.env.example
```

- [ ] **Step 2: Create the env template and the local file**

Create `Schoolfrontend/.env.example`:

```dotenv
# The school's own name. Printed as the letterhead on fee receipts and
# statements handed to parents, so set it to the school's full official name.
# Vite inlines VITE_* variables at build time — change this and rebuild.
VITE_SCHOOL_NAME=Your School Name Here
```

Create `Schoolfrontend/.env` with the real name:

```dotenv
VITE_SCHOOL_NAME=Your School Name Here
```

Ask the user for the school's actual official name and put it here. Do not guess it — it is printed on documents that go home to parents.

- [ ] **Step 3: Type the env variable**

`tsconfig.app.json` already sets `"types": ["vite/client"]`, so `import.meta.env` resolves — but `vite/client` types unknown keys as `any`. Declaring it makes a typo a build error instead of `undefined` at runtime.

Create `Schoolfrontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SCHOOL_NAME?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
```

- [ ] **Step 4: Create the config module**

Create `Schoolfrontend/src/config/school.ts`:

```ts
/**
 * The school's own name, printed as the letterhead on fee receipts and
 * statements.
 *
 * Read from the frontend's .env rather than the API on purpose: a printed
 * receipt must never wait on a network call for its letterhead, and a failed
 * request would otherwise hand a parent a receipt with no school name on it.
 * The trade is that changing the name needs a rebuild.
 *
 * The fallback is deliberately obvious rather than a plausible-looking name —
 * a receipt reading "SCHOOL NAME NOT CONFIGURED" gets fixed immediately,
 * where a quietly wrong name gets printed for a term before anyone notices.
 */
export const schoolName = import.meta.env.VITE_SCHOOL_NAME?.trim() || 'SCHOOL NAME NOT CONFIGURED'
```

- [ ] **Step 5: Add print rules to the stylesheet**

Append to `Schoolfrontend/src/index.css`:

```css
/* Printing a receipt or statement should produce the document alone — not the
   sidebar, navbar, and modal chrome around it. Everything is hidden by default
   at print time; only the marked region and its descendants come back. */
@media print {
    body * {
        visibility: hidden;
    }

    .print-region,
    .print-region * {
        visibility: visible;
    }

    .print-region {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 0;
        margin: 0;
        box-shadow: none;
        border: none;
    }

    .no-print {
        display: none !important;
    }
}
```

- [ ] **Step 6: Create the component**

Create `Schoolfrontend/src/modules/fees/PrintableReceipt.tsx`:

```tsx
import React from 'react'
import { Printer, X } from 'lucide-react'
import type { FeePayment } from './types'
import type { Student } from '../students/types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const METHOD_LABEL: Record<string, string> = {
    cash: 'Cash',
    bank: 'Bank Deposit',
    mpesa: 'M-Pesa',
    cheque: 'Cheque',
}

interface PrintableReceiptProps {
    payment: FeePayment
    student: Student | undefined
    /** Shown as the receipt letterhead. */
    schoolName: string
    /** Full name of the officer who took the money, for the signature line. */
    receivedByName: string
    onClose: () => void
}

const PrintableReceipt: React.FC<PrintableReceiptProps> = ({ payment, student, schoolName, receivedByName, onClose }) => (
    <div className="modal modal-open">
        <div className="modal-box max-w-lg">
            <div className="print-region bg-white p-6">
                <div className="text-center border-b border-gray-300 pb-4 mb-4">
                    <h2 className="text-lg font-bold uppercase tracking-wide">{schoolName}</h2>
                    <p className="text-sm text-gray-600">Official Fee Receipt</p>
                </div>

                <div className="flex justify-between text-sm mb-4">
                    <span className="font-semibold">Receipt No.</span>
                    <span className="font-mono">{payment.receiptNo}</span>
                </div>

                <table className="w-full text-sm mb-6">
                    <tbody>
                        <tr>
                            <td className="py-1 text-gray-600">Student</td>
                            <td className="py-1 text-right font-medium">
                                {student ? `${student.firstName} ${student.lastName}` : `#${payment.studentId}`}
                            </td>
                        </tr>
                        <tr>
                            <td className="py-1 text-gray-600">Admission No.</td>
                            <td className="py-1 text-right font-mono">{student?.admissionNo ?? '—'}</td>
                        </tr>
                        <tr>
                            <td className="py-1 text-gray-600">Date</td>
                            <td className="py-1 text-right">{payment.paymentDate}</td>
                        </tr>
                        <tr>
                            <td className="py-1 text-gray-600">Method</td>
                            <td className="py-1 text-right">{METHOD_LABEL[payment.paymentMethod] ?? payment.paymentMethod}</td>
                        </tr>
                        {payment.referenceNo && (
                            <tr>
                                <td className="py-1 text-gray-600">Reference</td>
                                <td className="py-1 text-right font-mono">{payment.referenceNo}</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="flex justify-between items-center border-t-2 border-gray-800 pt-3 mb-8">
                    <span className="font-bold">Amount Received</span>
                    <span className="font-bold font-mono text-lg">KES {formatMoney(payment.amount)}</span>
                </div>

                <div className="text-sm">
                    <div className="border-b border-gray-400 w-56 mb-1">&nbsp;</div>
                    <p className="text-gray-600">Received by: {receivedByName}</p>
                </div>
            </div>

            <div className="modal-action no-print">
                <button onClick={onClose} className="btn btn-ghost">
                    <X size={16} /> Close
                </button>
                <button onClick={() => window.print()} className="btn bg-green-800 hover:bg-green-900 text-white">
                    <Printer size={16} /> Print
                </button>
            </div>
        </div>
    </div>
)

export default PrintableReceipt
```

- [ ] **Step 7: Verify it typechecks and the name resolves**

Run: `cd Schoolfrontend && pnpm build`
Expected: build succeeds. The component is not yet rendered anywhere.

Then confirm the env wiring works rather than silently falling back. Run `pnpm dev`, and in the browser console on any page:

```js
// Vite inlines this at build time, so it must show the configured name.
```

Simpler check without a console: temporarily delete `Schoolfrontend/.env`, run `pnpm build`, and confirm the fallback string appears in the bundle — then restore the file. If the configured name never appears, the variable is missing its `VITE_` prefix or the dev server was not restarted after the file was created (Vite does not hot-reload `.env`).

- [ ] **Step 8: Commit**

`.env` is now gitignored and must not be committed — only the example is.

```bash
cd Schoolfrontend
git add .gitignore .env.example src/vite-env.d.ts src/config/school.ts src/index.css src/modules/fees/PrintableReceipt.tsx
git status --short
git commit -m "Add configurable school name, print stylesheet and printable receipt"
```

Confirm `git status --short` does not list `.env` as staged before committing.

---

### Task 8: Fee Counter page — student search and fee card

The clerk's actual job. Route and nav wiring are included so the page is reachable the moment it exists.

**Files:**
- Create: `Schoolfrontend/src/modules/fees/FeeCounterPage.tsx`
- Modify: `Schoolfrontend/src/dashboardDesign/navigation.ts`
- Modify: `Schoolfrontend/src/App.tsx`

**Interfaces:**
- Consumes: `useGetAllStudentsQuery` from `../students/StudentApi`; `useGetInvoicesByStudentQuery`, `useGetPaymentsByStudentQuery` from `./FeesApi`; `useCan` from Task 1.
- Produces: the route `/dashboard/finance/counter`. Task 9 adds payment recording to this page; Task 10 adds statement printing.

- [ ] **Step 1: Create the page**

Create `Schoolfrontend/src/modules/fees/FeeCounterPage.tsx`:

```tsx
import React, { useState } from 'react'
import { Search, UserSquare2, AlertCircle } from 'lucide-react'
import { Toaster } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllStudentsQuery } from '../students/StudentApi'
import { useGetInvoicesByStudentQuery, useGetPaymentsByStudentQuery } from './FeesApi'
import type { Student } from '../students/types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const INVOICE_STATUS_BADGE: Record<string, string> = {
    open: 'badge-warning',
    partially_paid: 'badge-info',
    paid: 'badge-success',
    cancelled: 'badge-ghost',
}

// ---- Student fee card ----

const StudentFeeCard: React.FC<{ student: Student }> = ({ student }) => {
    const { data: invoices, isLoading: invoicesLoading } = useGetInvoicesByStudentQuery(student.id)
    const { data: payments, isLoading: paymentsLoading } = useGetPaymentsByStudentQuery(student.id)

    if (invoicesLoading || paymentsLoading) {
        return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
    }

    const totalBilled = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
    const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
    const balance = totalBilled - totalPaid

    const hasNoInvoice = !invoices || invoices.length === 0

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{student.firstName} {student.lastName}</h2>
                        <p className="text-sm text-gray-500 font-mono">{student.admissionNo}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Balance</div>
                        <div className={`text-2xl font-bold font-mono ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {formatMoney(balance)}
                        </div>
                        <div className="text-xs text-gray-500">
                            Billed {formatMoney(totalBilled)} · Paid {formatMoney(totalPaid)}
                        </div>
                    </div>
                </div>
            </div>

            {hasNoInvoice ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 flex items-start gap-3">
                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-medium text-amber-900">No invoice has been raised for this student.</p>
                        <p className="text-sm text-amber-800 mt-1">
                            A payment can only be receipted against an invoice. Ask the Bursar to raise one for the
                            current term, then receipt the payment here.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-5 pt-4">Invoices</h3>
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Invoice No.</th>
                                    <th>Date</th>
                                    <th className="text-right">Total</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{inv.invoiceNo}</td>
                                        <td>{inv.invoiceDate}</td>
                                        <td className="text-right font-mono">{formatMoney(inv.totalAmount)}</td>
                                        <td><span className={`badge ${INVOICE_STATUS_BADGE[inv.status] ?? 'badge-ghost'} capitalize`}>{inv.status.replace('_', ' ')}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-5 pt-4">Payments</h3>
                {!payments || payments.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">No payments received yet.</div>
                ) : (
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Receipt No.</th>
                                    <th>Date</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th className="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{p.receiptNo}</td>
                                        <td>{p.paymentDate}</td>
                                        <td className="capitalize">{p.paymentMethod}</td>
                                        <td className="font-mono text-sm text-gray-500">{p.referenceNo ?? '—'}</td>
                                        <td className="text-right font-mono">{formatMoney(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

// ---- Page ----

const FeeCounterPage: React.FC = () => {
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Student | null>(null)
    const { data: students, isLoading } = useGetAllStudentsQuery()

    // Matches how a parent identifies a child at the counter: by name, or by
    // the admission number printed on the fee slip they are holding.
    const term = search.trim().toLowerCase()
    const matches = term.length < 2
        ? []
        : (students ?? []).filter((s) =>
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(term) ||
            s.admissionNo.toLowerCase().includes(term),
        ).slice(0, 8)

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <UserSquare2 className="text-green-800" size={24} />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Fee Counter</h1>
                    <p className="text-sm text-gray-500">Find a student to view their balance and receipt a payment</p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <label className="relative block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        autoFocus
                        className="input input-bordered w-full pl-10"
                        placeholder="Search by student name or admission number"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setSelected(null) }}
                    />
                </label>

                {isLoading && <p className="text-sm text-gray-400 mt-3">Loading students…</p>}

                {!selected && term.length >= 2 && (
                    matches.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-3">No student matches “{search}”.</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-gray-100 border border-gray-100 rounded-lg">
                            {matches.map((s) => (
                                <li key={s.id}>
                                    <button
                                        onClick={() => setSelected(s)}
                                        className="w-full text-left px-4 py-2 hover:bg-green-50 flex justify-between items-center"
                                    >
                                        <span className="font-medium text-gray-800">{s.firstName} {s.lastName}</span>
                                        <span className="font-mono text-sm text-gray-500">{s.admissionNo}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )
                )}
            </div>

            {selected
                ? <StudentFeeCard student={selected} />
                : <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">Search for a student to begin.</div>}
        </DashboardLayout>
    )
}

export default FeeCounterPage
```

- [ ] **Step 2: Add the nav entry**

In `Schoolfrontend/src/dashboardDesign/navigation.ts`, add to the Finance section's `items`, directly after the Fees entry:

```ts
            { name: 'Fee Counter', path: '/dashboard/finance/counter', icon: Banknote, permission: 'fees.receipt.create', built: true },
```

`Banknote` is already imported in that file.

- [ ] **Step 3: Register the route**

In `Schoolfrontend/src/App.tsx`, add the import:

```tsx
import FeeCounterPage from './modules/fees/FeeCounterPage'
```

and add the route directly after the existing fees route:

```tsx
    { path: '/dashboard/finance/counter', element: <PrivateRoute requiredPermission="fees.receipt.create"><FeeCounterPage /></PrivateRoute> },
```

- [ ] **Step 4: Verify against a running app**

Run: `cd Schoolfrontend && pnpm build && pnpm dev`

As an Accounts Clerk: Fee Counter appears in the Finance section. Type two letters of a student's name — matches appear. Pick one — the fee card shows billed, paid and balance, plus invoice and payment tables. Pick a student with no invoice — the amber "ask the Bursar" panel appears instead of the invoice table.
As a Bursar: Fee Counter is also visible (he holds `fees.receipt.create`).
As a role without `fees.receipt.create` (e.g. Registrar): the item is absent and navigating to the URL directly lands on `/access-denied`.

- [ ] **Step 5: Commit**

```bash
cd Schoolfrontend
git add src/modules/fees/FeeCounterPage.tsx src/dashboardDesign/navigation.ts src/App.tsx
git commit -m "Add Fee Counter page with student search and fee card"
```

---

### Task 9: Receipt a payment from the counter

**Files:**
- Modify: `Schoolfrontend/src/modules/fees/FeeCounterPage.tsx`

**Interfaces:**
- Consumes: `PrintableReceipt` from Task 7; `useRecordPaymentMutation` from `./FeesApi`; `useGetAllAccountsQuery` from `../finance/AccountApi`; `useCan` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the imports**

In `FeeCounterPage.tsx`, add `Banknote`, `SaveIcon` and `X` to the **existing** `lucide-react` import line, add `useRecordPaymentMutation` to the **existing** `./FeesApi` import line, and add `toast` to the **existing** `sonner` import line. Then add these as new import statements:

```tsx
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { useGetAllAccountsQuery } from '../finance/AccountApi'
import { useCan } from '../../hooks/usePermissions'
import PrintableReceipt from './PrintableReceipt'
import { schoolName } from '../../config/school'
import type { RootState } from '../../store/store'
import type { FeeInvoice, FeePayment, NewPaymentValues } from './types'
```

The `./types` import is new — Task 8 imported only `Student` from `../students/types`.

- [ ] **Step 2: Add the payment modal component**

Insert above `// ---- Page ----`:

```tsx
const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

const CounterPaymentModal: React.FC<{
    invoice: FeeInvoice
    onClose: () => void
    onRecorded: (payment: FeePayment) => void
}> = ({ invoice, onClose, onRecorded }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: accounts } = useGetAllAccountsQuery()
    const assetAccounts = accounts?.filter((a) => a.type === 'asset')

    const [recordPayment] = useRecordPaymentMutation()
    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<NewPaymentValues>({
        defaultValues: { paymentDate: new Date().toISOString().slice(0, 10), periodId: invoice.periodId },
    })
    const method = watch('paymentMethod')

    const onSubmit: SubmitHandler<NewPaymentValues> = async (formValues) => {
        const loadingToastId = toast.loading('Recording payment...')
        try {
            const payment = await recordPayment({
                studentId: invoice.studentId,
                invoiceId: invoice.id,
                paymentDate: formValues.paymentDate,
                amount: Number(formValues.amount),
                paymentMethod: formValues.paymentMethod,
                referenceNo: blank(formValues.referenceNo),
                cashAccountId: Number(formValues.cashAccountId),
                debtorsAccountId: Number(formValues.debtorsAccountId),
                periodId: Number(formValues.periodId),
                receivedBy: user!.id,
            }).unwrap()
            toast.success(`Receipt ${payment.receiptNo} recorded`, { id: loadingToastId })
            onRecorded(payment)
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to record payment'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl">
                <h2 className="text-xl font-bold text-green-800 mb-1">Receipt Payment</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Invoice {invoice.invoiceNo} — total {formatMoney(invoice.totalAmount)}
                </p>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" step="0.01" autoFocus className="input input-bordered w-full" {...register('amount', { required: 'Amount is required' })} />
                            {errors.amount && <p className="text-red-500 text-sm">{errors.amount.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('paymentDate', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Method</label>
                            <select className="select select-bordered w-full" {...register('paymentMethod', { required: true })}>
                                <option value="cash">Cash</option>
                                <option value="bank">Bank</option>
                                <option value="mpesa">M-Pesa</option>
                                <option value="cheque">Cheque</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{method === 'mpesa' ? 'M-Pesa Code' : 'Reference No.'}</label>
                            <input className="input input-bordered w-full" {...register('referenceNo')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Cash/Bank Account</label>
                            <select className="select select-bordered w-full" {...register('cashAccountId', { required: true })}>
                                <option value="">Select account</option>
                                {assetAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Debtors Account</label>
                            <select className="select select-bordered w-full" {...register('debtorsAccountId', { required: true })}>
                                <option value="">Select account</option>
                                {assetAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            <X size={16} /> Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="btn bg-green-800 hover:bg-green-900 text-white">
                            <SaveIcon size={16} /> Receipt
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Wire the action into the fee card**

Inside `StudentFeeCard`, add above the `if (invoicesLoading …)` guard:

```tsx
    const { can } = useCan()
    const [payingInvoice, setPayingInvoice] = useState<FeeInvoice | null>(null)
    const [issuedReceipt, setIssuedReceipt] = useState<FeePayment | null>(null)
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canReceipt = can('fees.receipt.create')
```

Add an Action column header to the invoices table:

```tsx
                                    <th>Status</th>
                                    <th className="text-center">Action</th>
```

and the matching cell at the end of each invoice row:

```tsx
                                        <td><span className={`badge ${INVOICE_STATUS_BADGE[inv.status] ?? 'badge-ghost'} capitalize`}>{inv.status.replace('_', ' ')}</span></td>
                                        <td className="text-center">
                                            {canReceipt && (inv.status === 'open' || inv.status === 'partially_paid') && (
                                                <button onClick={() => setPayingInvoice(inv)} className="btn btn-ghost btn-xs text-green-800" title="Receipt Payment">
                                                    <Banknote size={14} />
                                                </button>
                                            )}
                                        </td>
```

Then render the two modals just before the closing `</div>` of the `StudentFeeCard` return:

```tsx
            {payingInvoice && (
                <CounterPaymentModal
                    invoice={payingInvoice}
                    onClose={() => setPayingInvoice(null)}
                    onRecorded={(payment) => { setPayingInvoice(null); setIssuedReceipt(payment) }}
                />
            )}
            {issuedReceipt && (
                <PrintableReceipt
                    payment={issuedReceipt}
                    student={student}
                    schoolName={schoolName}
                    receivedByName={user?.fullName ?? ''}
                    onClose={() => setIssuedReceipt(null)}
                />
            )}
```

- [ ] **Step 4: Verify against a running app**

Run: `cd Schoolfrontend && pnpm build && pnpm dev`

As an Accounts Clerk: pick a student with an open invoice, press the receipt icon, enter an amount, save. The receipt modal opens showing the receipt number. Press Print — the browser print preview shows only the receipt, with no sidebar or navbar. Close it; the balance and payment table have both refreshed.

- [ ] **Step 5: Commit**

```bash
cd Schoolfrontend
git add src/modules/fees/FeeCounterPage.tsx
git commit -m "Receipt payments from the Fee Counter and print the receipt"
```

---

### Task 10: Printable fee statement

**Files:**
- Create: `Schoolfrontend/src/modules/fees/PrintableStatement.tsx`
- Modify: `Schoolfrontend/src/modules/fees/FeeCounterPage.tsx`

**Interfaces:**
- Consumes: `FeeInvoice`, `FeePayment` from `./types`; `Student` from `../students/types`; the print CSS and `schoolName` from Task 7.
- Produces: `<PrintableStatement student invoices payments schoolName onClose />`.

- [ ] **Step 1: Create the component**

Create `Schoolfrontend/src/modules/fees/PrintableStatement.tsx`:

```tsx
import React from 'react'
import { Printer, X } from 'lucide-react'
import type { FeeInvoice, FeePayment } from './types'
import type { Student } from '../students/types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface StatementLine {
    date: string
    reference: string
    description: string
    debit: number
    credit: number
}

interface PrintableStatementProps {
    student: Student
    invoices: FeeInvoice[]
    payments: FeePayment[]
    schoolName: string
    onClose: () => void
}

const PrintableStatement: React.FC<PrintableStatementProps> = ({ student, invoices, payments, schoolName, onClose }) => {
    // A statement reads as one chronological account: invoices debit the
    // student, payments credit them, and the balance is the running total —
    // which is what a parent asks to be shown.
    const lines: StatementLine[] = [
        ...invoices.map((inv) => ({
            date: inv.invoiceDate,
            reference: inv.invoiceNo,
            description: 'Fee invoice',
            debit: Number(inv.totalAmount),
            credit: 0,
        })),
        ...payments.map((p) => ({
            date: p.paymentDate,
            reference: p.receiptNo,
            description: `Payment — ${p.paymentMethod}`,
            debit: 0,
            credit: Number(p.amount),
        })),
    ].sort((a, b) => (a.date === b.date ? a.reference.localeCompare(b.reference) : a.date.localeCompare(b.date)))

    let running = 0

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <div className="print-region bg-white p-6">
                    <div className="text-center border-b border-gray-300 pb-4 mb-4">
                        <h2 className="text-lg font-bold uppercase tracking-wide">{schoolName}</h2>
                        <p className="text-sm text-gray-600">Student Fee Statement</p>
                    </div>

                    <div className="flex justify-between text-sm mb-4">
                        <div>
                            <div className="font-semibold">{student.firstName} {student.lastName}</div>
                            <div className="text-gray-600 font-mono">{student.admissionNo}</div>
                        </div>
                        <div className="text-right text-gray-600">
                            Printed {new Date().toISOString().slice(0, 10)}
                        </div>
                    </div>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b-2 border-gray-800">
                                <th className="text-left py-2">Date</th>
                                <th className="text-left py-2">Reference</th>
                                <th className="text-left py-2">Description</th>
                                <th className="text-right py-2">Debit</th>
                                <th className="text-right py-2">Credit</th>
                                <th className="text-right py-2">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-6 text-gray-400">No transactions.</td></tr>
                            ) : lines.map((line, i) => {
                                running += line.debit - line.credit
                                return (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-1.5">{line.date}</td>
                                        <td className="py-1.5 font-mono text-xs">{line.reference}</td>
                                        <td className="py-1.5">{line.description}</td>
                                        <td className="py-1.5 text-right font-mono">{line.debit ? formatMoney(line.debit) : ''}</td>
                                        <td className="py-1.5 text-right font-mono">{line.credit ? formatMoney(line.credit) : ''}</td>
                                        <td className="py-1.5 text-right font-mono">{formatMoney(running)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-gray-800 font-bold">
                                <td colSpan={5} className="py-2">Balance Due</td>
                                <td className="py-2 text-right font-mono">KES {formatMoney(running)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="modal-action no-print">
                    <button onClick={onClose} className="btn btn-ghost">
                        <X size={16} /> Close
                    </button>
                    <button onClick={() => window.print()} className="btn bg-green-800 hover:bg-green-900 text-white">
                        <Printer size={16} /> Print
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PrintableStatement
```

- [ ] **Step 2: Add the trigger to the fee card**

In `FeeCounterPage.tsx`, add `FileText` to the **existing** `lucide-react` import line, then add:

```tsx
import PrintableStatement from './PrintableStatement'
```

`schoolName` is already imported by Task 9 — do not import it twice. `tsconfig.app.json` sets `noUnusedLocals: true`, so a duplicate or unused import fails the build.

Add the state inside `StudentFeeCard`, next to the other `useState` calls:

```tsx
    const [showStatement, setShowStatement] = useState(false)
```

Add the button in the fee card header, replacing the closing `</div>` of the balance block's parent flex row so the button sits beside the balance:

```tsx
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Balance</div>
                        <div className={`text-2xl font-bold font-mono ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {formatMoney(balance)}
                        </div>
                        <div className="text-xs text-gray-500">
                            Billed {formatMoney(totalBilled)} · Paid {formatMoney(totalPaid)}
                        </div>
                        <button onClick={() => setShowStatement(true)} className="btn btn-ghost btn-xs text-green-800 mt-2">
                            <FileText size={14} /> Statement
                        </button>
                    </div>
```

Render the modal alongside the others:

```tsx
            {showStatement && (
                <PrintableStatement
                    student={student}
                    invoices={invoices ?? []}
                    payments={payments ?? []}
                    schoolName={schoolName}
                    onClose={() => setShowStatement(false)}
                />
            )}
```

- [ ] **Step 3: Verify against a running app**

Run: `cd Schoolfrontend && pnpm build && pnpm dev`

Pick a student with at least one invoice and one payment. Press Statement. The lines appear in date order with a running balance, and the closing Balance Due equals the balance shown on the fee card. Print shows the statement alone.

- [ ] **Step 4: Commit**

```bash
cd Schoolfrontend
git add src/modules/fees/PrintableStatement.tsx src/modules/fees/FeeCounterPage.tsx
git commit -m "Add printable student fee statement"
```

---

### Task 11: Daily collections register

What the clerk cashes up from at the end of the day, and what the Bursar banks against.

**Files:**
- Create: `Schoolfrontend/src/modules/fees/CollectionsTab.tsx`
- Modify: `Schoolfrontend/src/modules/fees/FeesPage.tsx`

**Interfaces:**
- Consumes: `useGetPaymentsInRangeQuery` from Task 6; `useGetAllStudentsQuery` from `../students/StudentApi`.
- Produces: `<CollectionsTab />` — self-contained, owns its own date state.

- [ ] **Step 1: Create the component**

Create `Schoolfrontend/src/modules/fees/CollectionsTab.tsx`:

```tsx
import React, { useState } from 'react'
import { XCircle } from 'lucide-react'
import { useGetPaymentsInRangeQuery } from './FeesApi'
import { useGetAllStudentsQuery } from '../students/StudentApi'
import type { PaymentMethod } from './types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const METHODS: PaymentMethod[] = ['cash', 'bank', 'mpesa', 'cheque']

const CollectionsTab: React.FC = () => {
    const today = new Date().toISOString().slice(0, 10)
    const [from, setFrom] = useState(today)
    const [to, setTo] = useState(today)

    const { data: payments, isLoading, isError } = useGetPaymentsInRangeQuery({ from, to })
    const { data: students } = useGetAllStudentsQuery()

    const studentLabel = (id: number) => {
        const s = students?.find((s) => s.id === id)
        return s ? `${s.firstName} ${s.lastName}` : `#${id}`
    }

    const rows = payments ?? []
    const total = rows.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalByMethod = METHODS.map((method) => ({
        method,
        amount: rows.filter((p) => p.paymentMethod === method).reduce((sum, p) => sum + Number(p.amount), 0),
        count: rows.filter((p) => p.paymentMethod === method).length,
    }))

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">From</label>
                    <input type="date" className="input input-bordered" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">To</label>
                    <input type="date" className="input input-bordered" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <button onClick={() => { setFrom(today); setTo(today) }} className="btn btn-ghost">Today</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {totalByMethod.map(({ method, amount, count }) => (
                    <div key={method} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wide capitalize">{method}</div>
                        <div className="text-lg font-bold font-mono text-gray-800">{formatMoney(amount)}</div>
                        <div className="text-xs text-gray-400">{count} receipt{count === 1 ? '' : 's'}</div>
                    </div>
                ))}
                <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
                    <div className="text-xs text-green-800 uppercase tracking-wide font-semibold">Total</div>
                    <div className="text-lg font-bold font-mono text-green-900">{formatMoney(total)}</div>
                    <div className="text-xs text-green-700">{rows.length} receipt{rows.length === 1 ? '' : 's'}</div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                    <p className="text-red-700">Unable to load collections.</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No payments received in this period.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Receipt No.</th>
                                    <th>Date</th>
                                    <th>Student</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th className="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{p.receiptNo}</td>
                                        <td>{p.paymentDate}</td>
                                        <td className="font-medium text-gray-800">{studentLabel(p.studentId)}</td>
                                        <td className="capitalize">{p.paymentMethod}</td>
                                        <td className="font-mono text-sm text-gray-500">{p.referenceNo ?? '—'}</td>
                                        <td className="text-right font-mono">{formatMoney(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CollectionsTab
```

- [ ] **Step 2: Add it as a third tab on the Fees page**

In `FeesPage.tsx`, add the import:

```tsx
import CollectionsTab from './CollectionsTab'
```

Widen the tab state type:

```tsx
const [tab, setTab] = useState<'structures' | 'invoices' | 'collections'>('invoices')
```

Add the tab trigger after the Invoices trigger (visible to every `fees.view` holder — the register is a read of data they can already see):

```tsx
<a role="tab" className={`tab ${tab === 'collections' ? 'tab-active' : ''}`} onClick={() => setTab('collections')}>Collections</a>
```

Render it after the invoices block:

```tsx
{tab === 'collections' && <CollectionsTab />}
```

- [ ] **Step 3: Verify against a running app**

Run: `cd Schoolfrontend && pnpm build && pnpm dev`

Open Fees → Collections. It defaults to today and shows only today's receipts. The five tiles sum correctly and the Total tile equals the sum of the Amount column. Widen the range to cover a day with known receipts and confirm they appear.

- [ ] **Step 4: Commit**

```bash
cd Schoolfrontend
git add src/modules/fees/CollectionsTab.tsx src/modules/fees/FeesPage.tsx
git commit -m "Add daily collections register for cash-up"
```

---

### Task 12: Invoice list search, filter and balance column

**Files:**
- Modify: `Schoolfrontend/src/modules/fees/FeesPage.tsx`

**Interfaces:**
- Consumes: `FeeInvoiceWithBalance` from Task 6.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the filter state**

In `FeesPage.tsx`, add next to the other `useState` calls:

```tsx
const [invoiceSearch, setInvoiceSearch] = useState('')
const [statusFilter, setStatusFilter] = useState<'all' | 'arrears' | 'open' | 'partially_paid' | 'paid' | 'cancelled'>('all')
```

Add the `Search` icon to the existing `lucide-react` import.

- [ ] **Step 2: Derive the filtered rows**

Add below the existing `periodLabel` helper:

```tsx
// "Arrears" is the Bursar's debtors list: anything still carrying a balance,
// regardless of whether it has been partly paid.
const visibleInvoices = (invoices ?? []).filter((inv) => {
    const matchesStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'arrears' ? inv.balance > 0 && inv.status !== 'cancelled' :
        inv.status === statusFilter

    if (!matchesStatus) return false

    const term = invoiceSearch.trim().toLowerCase()
    if (!term) return true

    const student = students?.find((s) => s.id === inv.studentId)
    return (
        inv.invoiceNo.toLowerCase().includes(term) ||
        (student ? `${student.firstName} ${student.lastName}`.toLowerCase().includes(term) : false) ||
        (student ? student.admissionNo.toLowerCase().includes(term) : false)
    )
})
```

- [ ] **Step 3: Add the filter controls above the invoices table**

Inside the `{tab === 'invoices' && (` block, immediately before the loading check, wrap the existing conditional in a fragment and add the controls first:

```tsx
{tab === 'invoices' && (
    <>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-4">
            <label className="relative block flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    className="input input-bordered w-full pl-10"
                    placeholder="Search invoice no., student name or admission no."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                />
            </label>
            <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select className="select select-bordered" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                    <option value="all">All</option>
                    <option value="arrears">Arrears (owing)</option>
                    <option value="open">Open</option>
                    <option value="partially_paid">Partially paid</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>
        </div>
        {/* The existing `invoicesLoading ? … : invoicesError ? … : … ` chain
            moves here unchanged. Step 4 then edits it in place. */}
    </>
)}
```

Move the whole existing conditional chain — from `invoicesLoading ? (` through its closing `)` — inside this fragment, directly replacing the comment. Do not retype it; cut and paste it so nothing is lost.

- [ ] **Step 4: Show the balance column and use the filtered rows**

In the invoices table, change the empty check from `!invoices || invoices.length === 0` to `visibleInvoices.length === 0`, and its message to `No invoices match this filter.`

Change `{invoices.map((inv) => (` to `{visibleInvoices.map((inv) => (`.

Add the header cell after `Total`:

```tsx
                                        <th className="text-right">Balance</th>
```

and the matching body cell after the total cell:

```tsx
                                            <td className={`text-right font-mono ${inv.balance > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                                                {formatMoney(inv.balance)}
                                            </td>
```

- [ ] **Step 5: Verify against a running app**

Run: `cd Schoolfrontend && pnpm build && pnpm dev`

On Fees → Invoices: the Balance column shows outstanding amounts in red and zero in grey. Search by an admission number and only that student's invoices remain. Select Arrears and only invoices with a balance above zero remain, including partially paid ones. Receipt a payment from the Fee Counter, return here, and confirm the balance has dropped without a manual refresh.

- [ ] **Step 6: Commit**

```bash
cd Schoolfrontend
git add src/modules/fees/FeesPage.tsx
git commit -m "Add invoice search, status filter and outstanding balance column"
```

---

## Final verification

Run the clerk's whole day end to end, as a user holding only `fees.receipt.create`, `fees.view`, `students.view`, `dashboard.view`:

- [ ] Sidebar shows Overview, My Profile, Fees, Fee Counter, Students — and nothing else.
- [ ] Fees page shows the Invoices and Collections tabs only; no Fee Structures tab, no New Fee Structure button.
- [ ] Fee Counter: search a student by partial name and by admission number; both find them.
- [ ] A student with no invoice shows the amber "ask the Bursar" panel, and no receipt button.
- [ ] A student with an open invoice can be receipted; the receipt modal shows the receipt number; printing shows the receipt alone.
- [ ] The receipt and statement letterheads show the school's real name, not `SCHOOL NAME NOT CONFIGURED`.
- [ ] `git status` in `Schoolfrontend` does not show `.env` as untracked-and-stageable — it is ignored, and only `.env.example` is committed.
- [ ] The Statement button prints a chronological statement whose closing balance matches the fee card.
- [ ] Collections defaults to today, totals reconcile against the listed receipts.
- [ ] Invoices → Arrears lists exactly the invoices still owing.
- [ ] `cd Accounts && pnpm test` passes.
- [ ] `cd Accounts && pnpm build` and `cd Schoolfrontend && pnpm build` both succeed.

Then confirm the Bursar is unaffected: he still sees all three Fees tabs, both action buttons, and the Fee Counter.

## Follow-on plans

- Phase 2 — Banking & Imprest page (frontend only; backend complete)
- Phase 3 — Reports module (new backend endpoints plus a Reports page)
- Phase 4 — Remove `fees.invoice.manage` from `accounts_clerk` and add `--prune` to `db:sync-rbac`
