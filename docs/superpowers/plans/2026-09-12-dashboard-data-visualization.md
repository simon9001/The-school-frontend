# Dashboard Data Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chart widgets to the Overview dashboard so every role that can read a module also sees its trends, without any per-role code.

**Architecture:** The backend's existing permission-gated widget catalogue gains a `kind: 'series'` widget type. Aggregation SQL goes in repositories (house convention — widgets call services, never `db`), bucket/window maths and chart shaping go in pure helper modules that are unit-tested without a database, and the React client renders the new kind through a lazily-loaded Recharts component so the library stays out of the main bundle.

**Tech Stack:** Hono + Drizzle + Postgres + Vitest (`Accounts`); React 19 + Redux Toolkit Query + Tailwind + Vite + Recharts + Vitest/jsdom/@testing-library/react (`Schoolfrontend`).

**Spec:** `Schoolfrontend/docs/superpowers/specs/2026-09-12-dashboard-data-visualization-design.md`

## Global Constraints

- **Phase 1 only.** This plan implements charts 1–6 of the spec's catalogue. Charts 7–12 get their own plan.
- **Forms in scope:** `'line' | 'bar' | 'hbar'`. The spec's `'stacked-bar'` form and `kind: 'breakdown'` are Phase 2 — do **not** add them to the union in this plan. An unrendered union member is a latent crash in `WidgetCard`.
- **Bucket caps:** 12 for months, 31 for days. `buildBuckets` clamps; it never returns more.
- **Numbers stay numbers on the wire.** Chart payloads carry `number`, never pre-formatted strings. `valueFormat` tells the client how to render.
- **Money is `numeric(14,2)`** and arrives from the `postgres` driver as a **string**. Coerce with `toNumber` at the boundary, never rely on JS coercion.
- **Widgets call services, never `db`.** Aggregation SQL belongs in a repository, exposed through its service.
- **Zero-fill from the calendar.** Bucket labels and order come from the calendar, never from the result set. A month with no rows is `0`, not absent.
- **Failure stays "drop the widget"** — `dashboard.service.ts`'s existing `Promise.allSettled` handling is unchanged.
- **Existing widget kinds are untouched.** `'stats'` and `'list'` keep their current shape and rendering.
- **Backend tests exclude no new paths:** `Accounts/tsconfig.json` already excludes `src/**/*.test.ts`. Mirror that in `Schoolfrontend/tsconfig.app.json`.
- **Commit after every task.** Use the repo the files live in; the two repos have separate git histories.

## File Structure

**`Accounts` (backend)**

| File | Responsibility |
|---|---|
| `src/modules/dashboard/dashboard.types.ts` | Modify: add `ChartForm`, `ValueFormat`, `ChartSeries`, `SeriesPoint`, and the `kind: 'series'` union member |
| `src/modules/dashboard/dashboard.series.ts` | Create: pure bucket/window helpers (`buildBuckets`, `bucketKey`, `toNumber`, `zeroFill`, `activeFiscalPeriod`) |
| `src/modules/dashboard/dashboard.series.test.ts` | Create: unit tests for the above, no database |
| `src/modules/dashboard/dashboard.charts.ts` | Create: pure shapers turning repository rows into `series` widgets |
| `src/modules/dashboard/dashboard.charts.test.ts` | Create: unit tests for the shapers, no database |
| `src/modules/dashboard/dashboard.widgets.ts` | Modify: register six chart widgets that wire service → shaper |
| `src/modules/dashboard/dashboard.widgets.test.ts` | Create: registry invariants (permissions exist, ids unique) |
| `src/modules/fees/fees.repository.ts` | Modify: `sumPaymentsByMonth`, `sumInvoicedByMonth` |
| `src/modules/fees/fees.service.ts` | Modify: expose the two above |
| `src/modules/journal/journal.repository.ts` | Modify: `sumPostedByTypeAndMonth`, `sumExpenseByFund` |
| `src/modules/journal/journal.service.ts` | Modify: expose the two above |
| `src/modules/attendance/attendance.repository.ts` | Modify: `countByStatusAndDay` |
| `src/modules/attendance/attendance.service.ts` | Modify: expose it |
| `src/modules/students/students.repository.ts` | Modify: `countActiveByClass` |
| `src/modules/students/students.service.ts` | Modify: expose it |
| `src/modules/exams/exams.repository.ts` | Modify: `findLatestPublished`, `countResultsByGrade` |
| `src/modules/exams/exams.service.ts` | Modify: expose the two above |
| `src/db/schema/{attendance,fees,journal}.ts` | Modify: declare one index each on the date column |
| `drizzle/` | Generated migration adding the three indexes |

**`Schoolfrontend` (frontend)**

| File | Responsibility |
|---|---|
| `package.json`, `vitest.config.ts`, `tsconfig.app.json` | Modify/Create: Vitest + jsdom + @testing-library/react |
| `src/modules/dashboard/types.ts` | Modify: mirror the backend's `series` contract |
| `src/modules/dashboard/widgets/WidgetCard.tsx` | Create: card shell that switches on `kind` |
| `src/modules/dashboard/widgets/StatsWidget.tsx` | Create: today's `stats` branch, moved |
| `src/modules/dashboard/widgets/ListWidget.tsx` | Create: today's `list` branch, moved |
| `src/modules/dashboard/widgets/SeriesWidget.tsx` | Create: the only Recharts importer |
| `src/modules/dashboard/widgets/chartTheme.ts` | Create: palette, formatters, shared axis props, `toRechartsRows` adapter |
| `src/modules/dashboard/widgets/chartTheme.test.ts` | Create: formatter + adapter tests |
| `src/modules/dashboard/widgets/WidgetCard.test.tsx` | Create: kind dispatch + empty-state tests |
| `src/modules/dashboard/DashboardPage.tsx` | Modify: drop inline `WidgetCard`, render the extracted one |
| `src/store/store.test.ts`, `src/apiDomain/authBaseQuery.test.ts` | Create: the two session-isolation tests, migrated off the scratchpad harness |

---

### Task 1: Series contract and pure bucket helpers

**Files:**
- Modify: `Accounts/src/modules/dashboard/dashboard.types.ts`
- Create: `Accounts/src/modules/dashboard/dashboard.series.ts`
- Test: `Accounts/src/modules/dashboard/dashboard.series.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ChartForm`, `ValueFormat`, `ChartSeries`, `SeriesPoint` types; `Granularity`, `Bucket`, `MAX_MONTH_BUCKETS`, `MAX_DAY_BUCKETS`, `buildBuckets(asOfDate: string, count: number, granularity: Granularity): Bucket[]`, `bucketKey(dateLike: string, granularity: Granularity): string`, `toNumber(value: unknown): number`, `zeroFill(buckets: Bucket[], rows: BucketRow[], seriesKeys: string[], granularity: Granularity): SeriesPoint[]`, `activeFiscalPeriod<T extends PeriodLike>(periods: T[], asOfDate: string): T | undefined`.

- [ ] **Step 1: Write the failing test**

Create `Accounts/src/modules/dashboard/dashboard.series.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  buildBuckets,
  bucketKey,
  toNumber,
  zeroFill,
  activeFiscalPeriod,
  MAX_MONTH_BUCKETS,
  MAX_DAY_BUCKETS,
} from './dashboard.series.js'

describe('buildBuckets', () => {
  it('returns the requested number of months, oldest first, ending at asOfDate', () => {
    const buckets = buildBuckets('2026-09-12', 3, 'month')
    expect(buckets.map((b) => b.key)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(buckets.map((b) => b.label)).toEqual(['Jul', 'Aug', 'Sep'])
  })

  it('gives each month a full inclusive date range', () => {
    const [feb] = buildBuckets('2026-02-15', 1, 'month')
    expect(feb.start).toBe('2026-02-01')
    expect(feb.end).toBe('2026-02-28')
  })

  it('crosses a year boundary correctly', () => {
    const buckets = buildBuckets('2026-01-10', 3, 'month')
    expect(buckets.map((b) => b.key)).toEqual(['2025-11', '2025-12', '2026-01'])
  })

  it('returns days with a single-day range', () => {
    const buckets = buildBuckets('2026-09-12', 3, 'day')
    expect(buckets.map((b) => b.key)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12'])
    expect(buckets[0].start).toBe('2026-09-10')
    expect(buckets[0].end).toBe('2026-09-10')
  })

  it('clamps to the cap rather than returning an unbounded series', () => {
    expect(buildBuckets('2026-09-12', 99, 'month')).toHaveLength(MAX_MONTH_BUCKETS)
    expect(buildBuckets('2026-09-12', 99, 'day')).toHaveLength(MAX_DAY_BUCKETS)
  })

  it('returns nothing for a non-positive count', () => {
    expect(buildBuckets('2026-09-12', 0, 'month')).toEqual([])
  })
})

describe('bucketKey', () => {
  it('truncates to the month', () => {
    expect(bucketKey('2026-04-17', 'month')).toBe('2026-04')
  })

  it('keeps the day', () => {
    expect(bucketKey('2026-04-17', 'day')).toBe('2026-04-17')
  })

  it('tolerates a timestamp, which is what date_trunc returns', () => {
    expect(bucketKey('2026-04-01T00:00:00.000Z', 'month')).toBe('2026-04')
  })
})

describe('toNumber', () => {
  it('parses the strings the postgres driver returns for numeric columns', () => {
    expect(toNumber('1234.56')).toBe(1234.56)
  })

  it('treats null, undefined and unparseable input as zero', () => {
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber('not a number')).toBe(0)
  })

  it('passes numbers through', () => {
    expect(toNumber(42)).toBe(42)
  })
})

describe('zeroFill', () => {
  const buckets = buildBuckets('2026-09-12', 3, 'month')

  it('fills a month with no rows with zero rather than skipping it', () => {
    const rows = [
      { bucket: '2026-07-01', collected: '500' },
      { bucket: '2026-09-01', collected: '900' },
    ]
    const points = zeroFill(buckets, rows, ['collected'], 'month')
    expect(points).toEqual([
      { label: 'Jul', values: { collected: 500 } },
      { label: 'Aug', values: { collected: 0 } },
      { label: 'Sep', values: { collected: 900 } },
    ])
  })

  it('carries every requested series key on every point', () => {
    const rows = [{ bucket: '2026-08-01', billed: '10' }]
    const points = zeroFill(buckets, rows, ['billed', 'collected'], 'month')
    expect(points[1].values).toEqual({ billed: 10, collected: 0 })
    expect(points[0].values).toEqual({ billed: 0, collected: 0 })
  })

  it('sums multiple rows landing in the same bucket', () => {
    const rows = [
      { bucket: '2026-08-03', collected: '10' },
      { bucket: '2026-08-20', collected: '5' },
    ]
    const points = zeroFill(buckets, rows, ['collected'], 'month')
    expect(points[1].values.collected).toBe(15)
  })

  it('ignores rows outside the buckets', () => {
    const rows = [{ bucket: '2020-01-01', collected: '999' }]
    const points = zeroFill(buckets, rows, ['collected'], 'month')
    expect(points.every((p) => p.values.collected === 0)).toBe(true)
  })

  it('returns a point per bucket even with no rows at all', () => {
    expect(zeroFill(buckets, [], ['collected'], 'month')).toHaveLength(3)
  })
})

describe('activeFiscalPeriod', () => {
  const periods = [
    { id: 1, startDate: '2026-01-01', endDate: '2026-04-30' },
    { id: 2, startDate: '2026-05-01', endDate: '2026-08-31' },
    { id: 3, startDate: '2026-09-01', endDate: '2026-12-31' },
  ]

  it('picks the period containing the date', () => {
    expect(activeFiscalPeriod(periods, '2026-09-12')?.id).toBe(3)
  })

  it('includes the boundary days', () => {
    expect(activeFiscalPeriod(periods, '2026-05-01')?.id).toBe(2)
    expect(activeFiscalPeriod(periods, '2026-04-30')?.id).toBe(1)
  })

  it('falls back to the most recent period ending before the date when the calendar has a gap', () => {
    const gapped = [
      { id: 1, startDate: '2026-01-01', endDate: '2026-04-30' },
      { id: 2, startDate: '2026-10-01', endDate: '2026-12-31' },
    ]
    expect(activeFiscalPeriod(gapped, '2026-06-15')?.id).toBe(1)
  })

  it('returns undefined when there are no periods at all', () => {
    expect(activeFiscalPeriod([], '2026-09-12')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.series.test.ts`
Expected: FAIL — cannot resolve `./dashboard.series.js`.

- [ ] **Step 3: Add the contract types**

In `Accounts/src/modules/dashboard/dashboard.types.ts`, add above `DashboardWidget` and extend the union. Leave `StatItem`, `ListRow` and the two existing members exactly as they are:

```ts
export type ChartForm = 'line' | 'bar' | 'hbar'
export type ValueFormat = 'currency' | 'percent' | 'count'

export interface ChartSeries {
  /** Matches a key in SeriesPoint.values. */
  key: string
  /** Legend and tooltip text. */
  label: string
}

export interface SeriesPoint {
  /** X-axis tick. Always calendar- or category-derived, never taken from a result set. */
  label: string
  values: Record<string, number>
}
```

and add this member to `DashboardWidget`:

```ts
  | {
      id: string
      title: string
      kind: 'series'
      form: ChartForm
      valueFormat: ValueFormat
      series: ChartSeries[]
      points: SeriesPoint[]
      emptyText: string
    }
```

- [ ] **Step 4: Write the helpers**

Create `Accounts/src/modules/dashboard/dashboard.series.ts`:

```ts
import type { SeriesPoint } from './dashboard.types.js'

export const MAX_MONTH_BUCKETS = 12
export const MAX_DAY_BUCKETS = 31

export type Granularity = 'month' | 'day'

export interface Bucket {
  /** 'YYYY-MM' for months, 'YYYY-MM-DD' for days. Matched against bucketKey(). */
  key: string
  /** Axis tick text. */
  label: string
  /** Inclusive date range, 'YYYY-MM-DD'. */
  start: string
  end: string
}

export interface BucketRow {
  /** The grouped date from SQL — a date or timestamp string. */
  bucket: string
  [column: string]: unknown
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
/** Day 0 of the next month is the last day of this one. */
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/**
 * Buckets ending at asOfDate, oldest first, derived from the calendar rather
 * than from any result set — a period with no rows still gets a bucket, so a
 * chart cannot silently skip it. Count is clamped to the cap so no chart can
 * bloat the dashboard payload.
 */
export function buildBuckets(asOfDate: string, count: number, granularity: Granularity): Bucket[] {
  const cap = granularity === 'month' ? MAX_MONTH_BUCKETS : MAX_DAY_BUCKETS
  const n = Math.min(Math.max(count, 0), cap)
  if (n === 0) return []

  const anchor = new Date(`${asOfDate.slice(0, 10)}T00:00:00.000Z`)
  const buckets: Bucket[] = []

  for (let i = n - 1; i >= 0; i--) {
    if (granularity === 'month') {
      const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1))
      const y = d.getUTCFullYear()
      const m = d.getUTCMonth() + 1
      buckets.push({
        key: `${y}-${pad(m)}`,
        label: MONTH_LABELS[m - 1],
        start: iso(y, m, 1),
        end: iso(y, m, daysInMonth(y, m)),
      })
    } else {
      const d = new Date(anchor.getTime() - i * 86_400_000)
      const y = d.getUTCFullYear()
      const m = d.getUTCMonth() + 1
      const day = d.getUTCDate()
      const date = iso(y, m, day)
      buckets.push({ key: date, label: `${day} ${MONTH_LABELS[m - 1]}`, start: date, end: date })
    }
  }

  return buckets
}

/** Normalises a SQL-grouped date to the same shape as Bucket.key. */
export function bucketKey(dateLike: string, granularity: Granularity): string {
  const date = dateLike.slice(0, 10)
  return granularity === 'month' ? date.slice(0, 7) : date
}

/** `numeric` columns arrive as strings; null means "no rows", which is zero. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/** One point per bucket, every requested key present, missing data as zero. */
export function zeroFill(
  buckets: Bucket[],
  rows: BucketRow[],
  seriesKeys: string[],
  granularity: Granularity,
): SeriesPoint[] {
  const totals = new Map<string, Record<string, number>>()

  for (const row of rows) {
    const key = bucketKey(String(row.bucket), granularity)
    const acc = totals.get(key) ?? {}
    for (const seriesKey of seriesKeys) {
      acc[seriesKey] = (acc[seriesKey] ?? 0) + toNumber(row[seriesKey])
    }
    totals.set(key, acc)
  }

  return buckets.map((bucket) => {
    const found = totals.get(bucket.key)
    const values: Record<string, number> = {}
    for (const seriesKey of seriesKeys) values[seriesKey] = found?.[seriesKey] ?? 0
    return { label: bucket.label, values }
  })
}

export interface PeriodLike {
  startDate: string
  endDate: string
}

/**
 * The fiscal period covering asOfDate. Charts windowed on "the term" share this
 * one resolver so they cannot disagree about which term that is. When the
 * calendar has a gap, the most recent period that has already ended is the
 * honest answer — showing nothing would hide real spend.
 */
export function activeFiscalPeriod<T extends PeriodLike>(periods: T[], asOfDate: string): T | undefined {
  const containing = periods.find((p) => p.startDate <= asOfDate && p.endDate >= asOfDate)
  if (containing) return containing

  return periods
    .filter((p) => p.endDate < asOfDate)
    .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))[0]
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.series.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Confirm nothing else broke and it compiles**

Run: `cd Accounts && pnpm test && pnpm run build`
Expected: all suites pass, `tsc` exits 0.

- [ ] **Step 7: Commit**

```bash
cd Accounts
git add src/modules/dashboard/dashboard.types.ts src/modules/dashboard/dashboard.series.ts src/modules/dashboard/dashboard.series.test.ts
git commit -m "feat(dashboard): add series widget contract and calendar bucket helpers"
```

---

### Task 2: Indexes on the aggregated date columns

**Files:**
- Modify: `Accounts/src/db/schema/attendance.ts`, `Accounts/src/db/schema/fees.ts`, `Accounts/src/db/schema/journal.ts`
- Create: generated migration under `Accounts/drizzle/`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Every chart query in Tasks 3–7 filters on these columns.

- [ ] **Step 1: Declare the index on attendance**

`attendanceRecords` already has a composite unique whose leading column is `student_id`, which cannot serve a date-range scan. In `Accounts/src/db/schema/attendance.ts`, add `index` to the drizzle import and a second entry to the table's config array:

```ts
import { pgTable, serial, integer, date, text, pgEnum, unique, index } from 'drizzle-orm/pg-core'
```

```ts
}, (t) => [
  unique().on(t.studentId, t.attendanceDate),
  index('attendance_records_attendance_date_idx').on(t.attendanceDate),
])
```

- [ ] **Step 2: Declare the index on fee payments**

In `Accounts/src/db/schema/fees.ts`, add `index` to the drizzle import, then give `feePayments` a config array (it has none today — add it as the second argument to `pgTable`):

```ts
}, (t) => [index('fee_payments_payment_date_idx').on(t.paymentDate)])
```

- [ ] **Step 3: Declare the index on journal entries**

In `Accounts/src/db/schema/journal.ts`, add `index` to the drizzle import and a config array to `journalEntries`:

```ts
}, (t) => [index('journal_entries_entry_date_idx').on(t.entryDate)])
```

- [ ] **Step 4: Generate the migration**

Run: `cd Accounts && pnpm db:generate`
Expected: a new `drizzle/NNNN_*.sql` containing three `CREATE INDEX` statements and nothing else. Open it and confirm — if it contains table or column changes, a schema edit was wrong; revert and redo Steps 1–3.

- [ ] **Step 5: Apply it and confirm the indexes exist**

Run: `cd Accounts && pnpm db:migrate`
Expected: the migration applies without error.

Then confirm the indexes are really there. The local database runs in the
project's own compose service, so query it directly:

```bash
docker compose exec -T db psql -U accounts -d school_accounts -c "select indexname from pg_indexes where indexname like '%_date_idx' order by indexname;"
```

Expected: exactly these three rows —
`attendance_records_attendance_date_idx`, `fee_payments_payment_date_idx`,
`journal_entries_entry_date_idx`. If the compose service is not running, start it
with `docker compose up -d` first.

- [ ] **Step 6: Confirm the build still passes**

Run: `cd Accounts && pnpm run build && pnpm test`
Expected: `tsc` exits 0, all tests pass.

- [ ] **Step 7: Commit**

```bash
cd Accounts
git add src/db/schema/attendance.ts src/db/schema/fees.ts src/db/schema/journal.ts drizzle/
git commit -m "perf(db): index the date columns the dashboard charts aggregate on"
```

---

### Task 3: Fee collection chart — billed vs collected, 6 months

**Files:**
- Create: `Accounts/src/modules/dashboard/dashboard.charts.ts`
- Test: `Accounts/src/modules/dashboard/dashboard.charts.test.ts`
- Modify: `Accounts/src/modules/fees/fees.repository.ts`, `Accounts/src/modules/fees/fees.service.ts`, `Accounts/src/modules/dashboard/dashboard.widgets.ts`

**Interfaces:**
- Consumes: `buildBuckets`, `zeroFill` (Task 1).
- Produces: `feeCollectionChart(args: { buckets: Bucket[]; paymentRows: BucketRow[]; invoiceRows: BucketRow[] }): DashboardWidget` from `dashboard.charts.ts`; `feesService.sumPaymentsByMonth(from: string, to: string): Promise<Array<{ bucket: string; collected: string }>>` and `feesService.sumInvoicedByMonth(from: string, to: string): Promise<Array<{ bucket: string; billed: string }>>`.

- [ ] **Step 1: Write the failing test**

Create `Accounts/src/modules/dashboard/dashboard.charts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { feeCollectionChart } from './dashboard.charts.js'
import { buildBuckets } from './dashboard.series.js'

const buckets = buildBuckets('2026-09-12', 3, 'month')

describe('feeCollectionChart', () => {
  it('puts billed and collected on the same monthly axis', () => {
    const widget = feeCollectionChart({
      buckets,
      invoiceRows: [{ bucket: '2026-08-01', billed: '1000' }],
      paymentRows: [{ bucket: '2026-08-01', collected: '600' }],
    })

    expect(widget.kind).toBe('series')
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.form).toBe('line')
    expect(widget.valueFormat).toBe('currency')
    expect(widget.series.map((s) => s.key)).toEqual(['billed', 'collected'])
    expect(widget.points).toEqual([
      { label: 'Jul', values: { billed: 0, collected: 0 } },
      { label: 'Aug', values: { billed: 1000, collected: 600 } },
      { label: 'Sep', values: { billed: 0, collected: 0 } },
    ])
  })

  it('still returns a point per month when there is no data at all', () => {
    const widget = feeCollectionChart({ buckets, invoiceRows: [], paymentRows: [] })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points).toHaveLength(3)
    expect(widget.emptyText).toBeTruthy()
  })

  it('has a stable id so the client can key on it', () => {
    expect(feeCollectionChart({ buckets, invoiceRows: [], paymentRows: [] }).id).toBe('fee-collection-trend')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: FAIL — cannot resolve `./dashboard.charts.js`.

- [ ] **Step 3: Write the shaper**

Create `Accounts/src/modules/dashboard/dashboard.charts.ts`:

```ts
import type { DashboardWidget } from './dashboard.types.js'
import { zeroFill, type Bucket, type BucketRow } from './dashboard.series.js'

/**
 * Pure shapers: repository rows in, chart widget out. Kept separate from
 * dashboard.widgets.ts so every chart's shaping is unit-testable without a
 * database, and so widget definitions stay declarative wiring.
 */
export function feeCollectionChart(args: {
  buckets: Bucket[]
  invoiceRows: BucketRow[]
  paymentRows: BucketRow[]
}): DashboardWidget {
  const billed = zeroFill(args.buckets, args.invoiceRows, ['billed'], 'month')
  const collected = zeroFill(args.buckets, args.paymentRows, ['collected'], 'month')

  return {
    id: 'fee-collection-trend',
    title: 'Fee Collection Trend',
    kind: 'series',
    form: 'line',
    valueFormat: 'currency',
    series: [
      { key: 'billed', label: 'Billed' },
      { key: 'collected', label: 'Collected' },
    ],
    points: args.buckets.map((bucket, i) => ({
      label: bucket.label,
      values: { billed: billed[i].values.billed, collected: collected[i].values.collected },
    })),
    emptyText: 'No invoices or payments in this period.',
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the repository aggregates**

In `Accounts/src/modules/fees/fees.repository.ts`, add `and`, `gte`, `lte` to the `drizzle-orm` import, then add these two methods to `feesRepository`:

```ts
  sumPaymentsByMonth: (from: string, to: string) =>
    db
      .select({
        bucket: sql<string>`to_char(date_trunc('month', ${feePayments.paymentDate}), 'YYYY-MM-DD')`,
        collected: sql<string>`coalesce(sum(${feePayments.amount}), 0)`,
      })
      .from(feePayments)
      .where(and(gte(feePayments.paymentDate, from), lte(feePayments.paymentDate, to)))
      .groupBy(sql`date_trunc('month', ${feePayments.paymentDate})`),

  sumInvoicedByMonth: (from: string, to: string) =>
    db
      .select({
        bucket: sql<string>`to_char(date_trunc('month', ${feeInvoices.invoiceDate}), 'YYYY-MM-DD')`,
        billed: sql<string>`coalesce(sum(${feeInvoices.totalAmount}), 0)`,
      })
      .from(feeInvoices)
      .where(and(gte(feeInvoices.invoiceDate, from), lte(feeInvoices.invoiceDate, to)))
      .groupBy(sql`date_trunc('month', ${feeInvoices.invoiceDate})`),
```

- [ ] **Step 6: Expose them on the service**

In `Accounts/src/modules/fees/fees.service.ts`, add to `feesService`:

```ts
  sumPaymentsByMonth: (from: string, to: string) => feesRepository.sumPaymentsByMonth(from, to),
  sumInvoicedByMonth: (from: string, to: string) => feesRepository.sumInvoicedByMonth(from, to),
```

- [ ] **Step 7: Register the widget**

In `Accounts/src/modules/dashboard/dashboard.widgets.ts`, add the imports:

```ts
import { buildBuckets } from './dashboard.series.js'
import { feeCollectionChart } from './dashboard.charts.js'
```

and add this entry to the `WIDGETS` array, immediately after the existing `fees-overview` widget:

```ts
  {
    id: 'fee-collection-trend',
    section: 'financial',
    requiredPermission: 'fees.view',
    async build({ asOfDate }) {
      const buckets = buildBuckets(asOfDate, 6, 'month')
      const [from, to] = [buckets[0].start, buckets[buckets.length - 1].end]
      const [paymentRows, invoiceRows] = await Promise.all([
        feesService.sumPaymentsByMonth(from, to),
        feesService.sumInvoicedByMonth(from, to),
      ])
      return feeCollectionChart({ buckets, paymentRows, invoiceRows })
    },
  },
```

- [ ] **Step 8: Verify the suite and the build**

Run: `cd Accounts && pnpm test && pnpm run build`
Expected: all tests pass, `tsc` exits 0.

- [ ] **Step 9: Commit**

```bash
cd Accounts
git add src/modules/dashboard/dashboard.charts.ts src/modules/dashboard/dashboard.charts.test.ts src/modules/dashboard/dashboard.widgets.ts src/modules/fees/fees.repository.ts src/modules/fees/fees.service.ts
git commit -m "feat(dashboard): add fee collection trend chart widget"
```

---

### Task 4: Income vs expenditure chart — 6 months

**Files:**
- Modify: `Accounts/src/modules/dashboard/dashboard.charts.ts`, `Accounts/src/modules/dashboard/dashboard.charts.test.ts`, `Accounts/src/modules/journal/journal.repository.ts`, `Accounts/src/modules/journal/journal.service.ts`, `Accounts/src/modules/dashboard/dashboard.widgets.ts`

**Interfaces:**
- Consumes: `buildBuckets`, `zeroFill` (Task 1).
- Produces: `incomeVsExpenditureChart(args: { buckets: Bucket[]; rows: Array<BucketRow & { type: string }> }): DashboardWidget`; `journalService.sumPostedByTypeAndMonth(from: string, to: string): Promise<Array<{ bucket: string; type: string; total: string }>>`.

- [ ] **Step 1: Write the failing test**

Append to `Accounts/src/modules/dashboard/dashboard.charts.test.ts`:

```ts
import { incomeVsExpenditureChart } from './dashboard.charts.js'

describe('incomeVsExpenditureChart', () => {
  it('splits revenue and expense account rows into two series', () => {
    const widget = incomeVsExpenditureChart({
      buckets,
      rows: [
        { bucket: '2026-07-01', type: 'revenue', total: '5000' },
        { bucket: '2026-07-01', type: 'expense', total: '3000' },
        { bucket: '2026-09-01', type: 'expense', total: '1200' },
      ],
    })

    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.series.map((s) => s.key)).toEqual(['income', 'expenditure'])
    expect(widget.points).toEqual([
      { label: 'Jul', values: { income: 5000, expenditure: 3000 } },
      { label: 'Aug', values: { income: 0, expenditure: 0 } },
      { label: 'Sep', values: { income: 0, expenditure: 1200 } },
    ])
  })

  it('ignores account types that are neither revenue nor expense', () => {
    const widget = incomeVsExpenditureChart({
      buckets,
      rows: [{ bucket: '2026-08-01', type: 'asset', total: '9999' }],
    })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points[1].values).toEqual({ income: 0, expenditure: 0 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: FAIL — `incomeVsExpenditureChart` is not exported.

- [ ] **Step 3: Write the shaper**

Add to `Accounts/src/modules/dashboard/dashboard.charts.ts`:

```ts
/**
 * The ledger returns one row per (month, account type). Revenue and expense are
 * the only two types that describe money in and money out; asset, liability and
 * net_assets rows are balance-sheet movements and would double-count here.
 */
export function incomeVsExpenditureChart(args: {
  buckets: Bucket[]
  rows: Array<BucketRow & { type: string }>
}): DashboardWidget {
  const mapped = args.rows.map((row) => ({
    bucket: row.bucket,
    income: row.type === 'revenue' ? row.total : 0,
    expenditure: row.type === 'expense' ? row.total : 0,
  }))

  return {
    id: 'income-vs-expenditure',
    title: 'Income vs Expenditure',
    kind: 'series',
    form: 'line',
    valueFormat: 'currency',
    series: [
      { key: 'income', label: 'Income' },
      { key: 'expenditure', label: 'Expenditure' },
    ],
    points: zeroFill(args.buckets, mapped, ['income', 'expenditure'], 'month'),
    emptyText: 'No posted journal entries in this period.',
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the repository aggregate**

In `Accounts/src/modules/journal/journal.repository.ts`, add `gte` to the `drizzle-orm` import and this method to `journalRepository`. Only `posted` entries count — drafts and rejected entries are not money that moved:

```ts
  sumPostedByTypeAndMonth: (from: string, to: string) =>
    db
      .select({
        bucket: sql<string>`to_char(date_trunc('month', ${journalEntries.entryDate}), 'YYYY-MM-DD')`,
        type: accounts.type,
        total: sql<string>`coalesce(sum(${journalLines.debit} + ${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.status, 'posted'),
          gte(journalEntries.entryDate, from),
          lte(journalEntries.entryDate, to),
        ),
      )
      .groupBy(sql`date_trunc('month', ${journalEntries.entryDate})`, accounts.type),
```

Note on `debit + credit`: a revenue line carries its amount in the credit column and an expense line in the debit column, so for these two account types exactly one side is non-zero and the sum is the movement. This is why the shaper filters to those two types.

- [ ] **Step 6: Expose it on the service**

In `Accounts/src/modules/journal/journal.service.ts`, add to `journalService`:

```ts
  sumPostedByTypeAndMonth: (from: string, to: string) => journalRepository.sumPostedByTypeAndMonth(from, to),
```

- [ ] **Step 7: Register the widget**

In `Accounts/src/modules/dashboard/dashboard.widgets.ts`, add `incomeVsExpenditureChart` to the `dashboard.charts.js` import, then add after the `financial-health` widget:

```ts
  {
    id: 'income-vs-expenditure',
    section: 'financial',
    requiredPermission: 'ledger.journal.view',
    async build({ asOfDate }) {
      const buckets = buildBuckets(asOfDate, 6, 'month')
      const rows = await journalService.sumPostedByTypeAndMonth(buckets[0].start, buckets[buckets.length - 1].end)
      return incomeVsExpenditureChart({ buckets, rows })
    },
  },
```

- [ ] **Step 8: Verify the suite and the build**

Run: `cd Accounts && pnpm test && pnpm run build`
Expected: all pass, `tsc` exits 0.

- [ ] **Step 9: Commit**

```bash
cd Accounts
git add src/modules/dashboard/ src/modules/journal/
git commit -m "feat(dashboard): add income vs expenditure trend chart widget"
```

---

### Task 5: Spend by fund chart — active fiscal period, top 8

**Files:**
- Modify: `Accounts/src/modules/dashboard/dashboard.charts.ts`, `Accounts/src/modules/dashboard/dashboard.charts.test.ts`, `Accounts/src/modules/journal/journal.repository.ts`, `Accounts/src/modules/journal/journal.service.ts`, `Accounts/src/modules/dashboard/dashboard.widgets.ts`

**Interfaces:**
- Consumes: `activeFiscalPeriod` (Task 1), `periodsService.list()` (existing).
- Produces: `spendByFundChart(args: { rows: Array<{ fundName: string; total: string | number }>; periodName?: string }): DashboardWidget`; `journalService.sumExpenseByFund(from: string, to: string): Promise<Array<{ fundName: string; total: string }>>`.

- [ ] **Step 1: Write the failing test**

Append to `Accounts/src/modules/dashboard/dashboard.charts.test.ts`:

```ts
import { spendByFundChart } from './dashboard.charts.js'

describe('spendByFundChart', () => {
  it('orders funds by spend, largest first', () => {
    const widget = spendByFundChart({
      rows: [
        { fundName: 'Tuition', total: '300' },
        { fundName: 'Operations', total: '900' },
      ],
    })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.form).toBe('hbar')
    expect(widget.points.map((p) => p.label)).toEqual(['Operations', 'Tuition'])
    expect(widget.points[0].values.spend).toBe(900)
  })

  it('keeps only the top 8 funds so the axis stays readable', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ fundName: `Fund ${i}`, total: String(i + 1) }))
    const widget = spendByFundChart({ rows })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points).toHaveLength(8)
    expect(widget.points[0].label).toBe('Fund 11')
  })

  it('names the period in the title when one is given', () => {
    expect(spendByFundChart({ rows: [], periodName: '2026 Term 3' }).title).toContain('2026 Term 3')
  })

  it('returns an empty point list rather than throwing when there is no spend', () => {
    const widget = spendByFundChart({ rows: [] })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points).toEqual([])
    expect(widget.emptyText).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: FAIL — `spendByFundChart` is not exported.

- [ ] **Step 3: Write the shaper**

Add to `Accounts/src/modules/dashboard/dashboard.charts.ts` (it needs `toNumber`, so extend the import from `./dashboard.series.js`):

```ts
const TOP_FUNDS = 8

/** Categorical, not time-bucketed: one bar per fund, so no zero-filling applies. */
export function spendByFundChart(args: {
  rows: Array<{ fundName: string; total: string | number }>
  periodName?: string
}): DashboardWidget {
  const points = args.rows
    .map((row) => ({ label: row.fundName, values: { spend: toNumber(row.total) } }))
    .sort((a, b) => b.values.spend - a.values.spend)
    .slice(0, TOP_FUNDS)

  return {
    id: 'spend-by-fund',
    title: args.periodName ? `Spend by Votehead — ${args.periodName}` : 'Spend by Votehead',
    kind: 'series',
    form: 'hbar',
    valueFormat: 'currency',
    series: [{ key: 'spend', label: 'Spend' }],
    points,
    emptyText: 'No expenditure posted for this period.',
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the repository aggregate**

In `Accounts/src/modules/journal/journal.repository.ts` add `funds` to the schema import and this method. Expense debits only — this answers "what did this votehead consume":

```ts
  sumExpenseByFund: (from: string, to: string) =>
    db
      .select({
        fundName: funds.name,
        total: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .innerJoin(funds, eq(journalLines.fundId, funds.id))
      .where(
        and(
          eq(journalEntries.status, 'posted'),
          eq(accounts.type, 'expense'),
          gte(journalEntries.entryDate, from),
          lte(journalEntries.entryDate, to),
        ),
      )
      .groupBy(funds.name),
```

- [ ] **Step 6: Expose it on the service**

In `Accounts/src/modules/journal/journal.service.ts`:

```ts
  sumExpenseByFund: (from: string, to: string) => journalRepository.sumExpenseByFund(from, to),
```

- [ ] **Step 7: Register the widget**

In `Accounts/src/modules/dashboard/dashboard.widgets.ts`, add `activeFiscalPeriod` to the `dashboard.series.js` import and `spendByFundChart` to the charts import, then add:

```ts
  {
    id: 'spend-by-fund',
    section: 'financial',
    requiredPermission: 'ledger.journal.view',
    async build({ asOfDate }) {
      const period = activeFiscalPeriod(await periodsService.list(), asOfDate)
      if (!period) return spendByFundChart({ rows: [] })
      const rows = await journalService.sumExpenseByFund(period.startDate, period.endDate)
      return spendByFundChart({ rows, periodName: period.name })
    },
  },
```

- [ ] **Step 8: Verify the suite and the build**

Run: `cd Accounts && pnpm test && pnpm run build`
Expected: all pass, `tsc` exits 0.

- [ ] **Step 9: Commit**

```bash
cd Accounts
git add src/modules/dashboard/ src/modules/journal/
git commit -m "feat(dashboard): add spend-by-votehead chart for the active fiscal period"
```

---

### Task 6: Attendance rate chart — 30 days

**Files:**
- Modify: `Accounts/src/modules/dashboard/dashboard.charts.ts`, `Accounts/src/modules/dashboard/dashboard.charts.test.ts`, `Accounts/src/modules/attendance/attendance.repository.ts`, `Accounts/src/modules/attendance/attendance.service.ts`, `Accounts/src/modules/dashboard/dashboard.widgets.ts`

**Interfaces:**
- Consumes: `buildBuckets`, `zeroFill`, `toNumber` (Task 1).
- Produces: `attendanceRateChart(args: { buckets: Bucket[]; rows: Array<{ bucket: string; status: string; count: string | number }> }): DashboardWidget`; `attendanceService.countByStatusAndDay(from: string, to: string): Promise<Array<{ bucket: string; status: string; count: number }>>`.

- [ ] **Step 1: Write the failing test**

Append to `Accounts/src/modules/dashboard/dashboard.charts.test.ts`:

```ts
import { attendanceRateChart } from './dashboard.charts.js'

describe('attendanceRateChart', () => {
  const days = buildBuckets('2026-09-12', 2, 'day')

  it('reports present and late as a percentage of records taken that day', () => {
    const widget = attendanceRateChart({
      buckets: days,
      rows: [
        { bucket: '2026-09-12', status: 'present', count: '80' },
        { bucket: '2026-09-12', status: 'late', count: '10' },
        { bucket: '2026-09-12', status: 'absent', count: '10' },
      ],
    })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.valueFormat).toBe('percent')
    expect(widget.points[1].values.rate).toBe(90)
  })

  it('reports a day with no register taken as zero rather than dividing by zero', () => {
    const widget = attendanceRateChart({ buckets: days, rows: [] })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points.map((p) => p.values.rate)).toEqual([0, 0])
  })

  it('rounds to one decimal place', () => {
    const widget = attendanceRateChart({
      buckets: days,
      rows: [
        { bucket: '2026-09-12', status: 'present', count: '1' },
        { bucket: '2026-09-12', status: 'absent', count: '2' },
      ],
    })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points[1].values.rate).toBe(33.3)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: FAIL — `attendanceRateChart` is not exported.

- [ ] **Step 3: Write the shaper**

Add to `Accounts/src/modules/dashboard/dashboard.charts.ts`:

```ts
/**
 * Rate is present+late over all records for that day. A day with no register
 * taken has no denominator, and must read as 0 rather than NaN — Recharts
 * renders NaN as a gap, which would look like perfect attendance.
 */
export function attendanceRateChart(args: {
  buckets: Bucket[]
  rows: Array<{ bucket: string; status: string; count: string | number }>
}): DashboardWidget {
  const mapped = args.rows.map((row) => ({
    bucket: row.bucket,
    attending: row.status === 'present' || row.status === 'late' ? toNumber(row.count) : 0,
    total: toNumber(row.count),
  }))

  const totals = zeroFill(args.buckets, mapped, ['attending', 'total'], 'day')

  return {
    id: 'attendance-rate-trend',
    title: 'Attendance Rate',
    kind: 'series',
    form: 'line',
    valueFormat: 'percent',
    series: [{ key: 'rate', label: 'Present' }],
    points: totals.map((point) => ({
      label: point.label,
      values: {
        rate:
          point.values.total === 0
            ? 0
            : Math.round((point.values.attending / point.values.total) * 1000) / 10,
      },
    })),
    emptyText: 'No attendance registers taken in this period.',
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the repository aggregate**

In `Accounts/src/modules/attendance/attendance.repository.ts`, add `and`, `gte`, `lte`, `sql` to the `drizzle-orm` import and this method:

```ts
  async countByStatusAndDay(from: string, to: string) {
    const rows = await db
      .select({
        bucket: attendanceRecords.attendanceDate,
        status: attendanceRecords.status,
        count: sql<number>`count(*)::int`,
      })
      .from(attendanceRecords)
      .where(and(gte(attendanceRecords.attendanceDate, from), lte(attendanceRecords.attendanceDate, to)))
      .groupBy(attendanceRecords.attendanceDate, attendanceRecords.status)
    return rows
  },
```

- [ ] **Step 6: Expose it on the service**

In `Accounts/src/modules/attendance/attendance.service.ts`:

```ts
  countByStatusAndDay: (from: string, to: string) => attendanceRepository.countByStatusAndDay(from, to),
```

- [ ] **Step 7: Register the widget**

In `Accounts/src/modules/dashboard/dashboard.widgets.ts`, add `attendanceRateChart` to the charts import, then add it in the `students` section:

```ts
  {
    id: 'attendance-rate-trend',
    section: 'students',
    requiredPermission: 'attendance.view',
    async build({ asOfDate }) {
      const buckets = buildBuckets(asOfDate, 30, 'day')
      const rows = await attendanceService.countByStatusAndDay(buckets[0].start, buckets[buckets.length - 1].end)
      return attendanceRateChart({ buckets, rows })
    },
  },
```

If `attendanceService` is not already imported in this file, add `import { attendanceService } from '../attendance/attendance.service.js'`.

- [ ] **Step 8: Verify the suite and the build**

Run: `cd Accounts && pnpm test && pnpm run build`
Expected: all pass, `tsc` exits 0.

- [ ] **Step 9: Commit**

```bash
cd Accounts
git add src/modules/dashboard/ src/modules/attendance/
git commit -m "feat(dashboard): add attendance rate trend chart widget"
```

---

### Task 7: Enrolment by class and exam grade distribution

**Files:**
- Modify: `Accounts/src/modules/dashboard/dashboard.charts.ts`, `Accounts/src/modules/dashboard/dashboard.charts.test.ts`, `Accounts/src/modules/students/students.repository.ts`, `Accounts/src/modules/students/students.service.ts`, `Accounts/src/modules/exams/exams.repository.ts`, `Accounts/src/modules/exams/exams.service.ts`, `Accounts/src/modules/dashboard/dashboard.widgets.ts`

**Interfaces:**
- Consumes: `toNumber` (Task 1).
- Produces: `enrolmentByClassChart(args: { rows: Array<{ className: string; count: string | number }> }): DashboardWidget`; `gradeDistributionChart(args: { rows: Array<{ grade: string | null; count: string | number }>; examName?: string }): DashboardWidget`; `studentsService.countActiveByClass()`; `examsService.findLatestPublished()`; `examsService.countResultsByGrade(examId: number)`.

- [ ] **Step 1: Write the failing test**

Append to `Accounts/src/modules/dashboard/dashboard.charts.test.ts`:

```ts
import { enrolmentByClassChart, gradeDistributionChart } from './dashboard.charts.js'

describe('enrolmentByClassChart', () => {
  it('keeps classes in the order the query returned them', () => {
    const widget = enrolmentByClassChart({
      rows: [
        { className: 'Form 1', count: '120' },
        { className: 'Form 2', count: '98' },
      ],
    })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.form).toBe('bar')
    expect(widget.valueFormat).toBe('count')
    expect(widget.points).toEqual([
      { label: 'Form 1', values: { students: 120 } },
      { label: 'Form 2', values: { students: 98 } },
    ])
  })

  it('has an empty text for a school with no active students', () => {
    expect(enrolmentByClassChart({ rows: [] }).kind).toBe('series')
    const widget = enrolmentByClassChart({ rows: [] })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points).toEqual([])
    expect(widget.emptyText).toBeTruthy()
  })
})

describe('gradeDistributionChart', () => {
  it('counts students per grade and names the exam', () => {
    const widget = gradeDistributionChart({
      rows: [
        { grade: 'A', count: '12' },
        { grade: 'B', count: '30' },
      ],
      examName: 'Term 3 Endterm',
    })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.title).toContain('Term 3 Endterm')
    expect(widget.points.map((p) => p.label)).toEqual(['A', 'B'])
    expect(widget.points[1].values.students).toBe(30)
  })

  it('labels ungraded results rather than dropping them', () => {
    const widget = gradeDistributionChart({ rows: [{ grade: null, count: '4' }] })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points[0].label).toBe('Ungraded')
  })

  it('is empty when no exam has been published', () => {
    const widget = gradeDistributionChart({ rows: [] })
    if (widget.kind !== 'series') throw new Error('expected a series widget')
    expect(widget.points).toEqual([])
    expect(widget.emptyText).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: FAIL — neither function is exported.

- [ ] **Step 3: Write both shapers**

Add to `Accounts/src/modules/dashboard/dashboard.charts.ts`:

```ts
export function enrolmentByClassChart(args: {
  rows: Array<{ className: string; count: string | number }>
}): DashboardWidget {
  return {
    id: 'enrolment-by-class',
    title: 'Enrolment by Class',
    kind: 'series',
    form: 'bar',
    valueFormat: 'count',
    series: [{ key: 'students', label: 'Students' }],
    points: args.rows.map((row) => ({ label: row.className, values: { students: toNumber(row.count) } })),
    emptyText: 'No active students on the register.',
  }
}

export function gradeDistributionChart(args: {
  rows: Array<{ grade: string | null; count: string | number }>
  examName?: string
}): DashboardWidget {
  return {
    id: 'exam-grade-distribution',
    title: args.examName ? `Grade Distribution — ${args.examName}` : 'Grade Distribution',
    kind: 'series',
    form: 'bar',
    valueFormat: 'count',
    series: [{ key: 'students', label: 'Results' }],
    // A result with no grade means marks were entered before the grading scale
    // was applied. Dropping it would make the totals disagree with the exam.
    points: args.rows.map((row) => ({
      label: row.grade ?? 'Ungraded',
      values: { students: toNumber(row.count) },
    })),
    emptyText: 'No published exam results yet.',
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.charts.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the students aggregate**

In `Accounts/src/modules/students/students.repository.ts`, add `classes`, `students` to the schema import if absent and `eq`, `sql` to the drizzle import, then add:

```ts
  countActiveByClass: () =>
    db
      .select({ className: classes.name, count: sql<number>`count(*)::int` })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.status, 'active'))
      .groupBy(classes.name)
      .orderBy(classes.name),
```

Expose it in `Accounts/src/modules/students/students.service.ts`:

```ts
  countActiveByClass: () => studentsRepository.countActiveByClass(),
```

- [ ] **Step 6: Add the exams aggregates**

In `Accounts/src/modules/exams/exams.repository.ts`, add the two methods (importing `exams`, `examResults` from the schema and `desc`, `eq`, `sql` from `drizzle-orm` as needed):

```ts
  findLatestPublished: () =>
    db
      .select()
      .from(exams)
      .where(eq(exams.status, 'published'))
      .orderBy(desc(exams.examDate))
      .limit(1)
      .then((rows) => rows[0]),

  countResultsByGrade: (examId: number) =>
    db
      .select({ grade: examResults.grade, count: sql<number>`count(*)::int` })
      .from(examResults)
      .where(eq(examResults.examId, examId))
      .groupBy(examResults.grade)
      .orderBy(examResults.grade),
```

Expose both in `Accounts/src/modules/exams/exams.service.ts`:

```ts
  findLatestPublished: () => examsRepository.findLatestPublished(),
  countResultsByGrade: (examId: number) => examsRepository.countResultsByGrade(examId),
```

- [ ] **Step 7: Register both widgets**

In `Accounts/src/modules/dashboard/dashboard.widgets.ts`, add both shapers to the charts import, then add:

```ts
  {
    id: 'enrolment-by-class',
    section: 'students',
    requiredPermission: 'students.view',
    async build() {
      return enrolmentByClassChart({ rows: await studentsService.countActiveByClass() })
    },
  },
  {
    id: 'exam-grade-distribution',
    section: 'students',
    requiredPermission: 'exams.view',
    async build() {
      const exam = await examsService.findLatestPublished()
      if (!exam) return gradeDistributionChart({ rows: [] })
      return gradeDistributionChart({ rows: await examsService.countResultsByGrade(exam.id), examName: exam.name })
    },
  },
```

`exams.name` is a `varchar(150) not null` (e.g. "Term 1 Mid-Term"), so it is
always safe to read for the title.

- [ ] **Step 8: Verify the suite and the build**

Run: `cd Accounts && pnpm test && pnpm run build`
Expected: all pass, `tsc` exits 0.

- [ ] **Step 9: Commit**

```bash
cd Accounts
git add src/modules/dashboard/ src/modules/students/ src/modules/exams/
git commit -m "feat(dashboard): add enrolment and grade distribution chart widgets"
```

---

### Task 8: Registry invariants test

**Files:**
- Test: `Accounts/src/modules/dashboard/dashboard.widgets.test.ts`

**Interfaces:**
- Consumes: `WIDGETS` from `dashboard.widgets.ts`, `PERMISSIONS`/role catalogue from `src/modules/identity/rbac.ts`.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Create `Accounts/src/modules/dashboard/dashboard.widgets.test.ts`. `rbac.ts`
exports `PERMISSIONS: PermissionDef[]`, where `PermissionDef` is
`{ code, module, description }` — that is the authoritative catalogue, so assert
against it rather than against what roles happen to reference:

```ts
import { describe, it, expect } from 'vitest'
import { WIDGETS } from './dashboard.widgets.js'
import { PERMISSIONS } from '../identity/rbac.js'

const validPermissions = new Set(PERMISSIONS.map((p) => p.code))

describe('dashboard widget registry', () => {
  it('gates every widget on a permission that exists in the RBAC catalogue', () => {
    const unknown = WIDGETS.flatMap((widget) => {
      const gates = Array.isArray(widget.requiredPermission) ? widget.requiredPermission : [widget.requiredPermission]
      return gates.filter((gate) => !validPermissions.has(gate)).map((gate) => `${widget.id} → ${gate}`)
    })
    // A typo'd permission string hides a widget from every role, silently.
    expect(unknown).toEqual([])
  })

  it('has a unique id per widget', () => {
    const ids = WIDGETS.map((w) => w.id)
    expect(ids).toHaveLength(new Set(ids).size)
  })
})
```

- [ ] **Step 2: Run the test**

Run: `cd Accounts && pnpm vitest run src/modules/dashboard/dashboard.widgets.test.ts`
Expected: PASS if every gate is spelled correctly. **If it fails, that is a real bug from Tasks 3–7 — fix the widget's permission string, not the test.** If it fails on a widget that predates this plan, report it rather than silently changing it.

- [ ] **Step 3: Verify the whole suite**

Run: `cd Accounts && pnpm test`
Expected: all suites pass.

- [ ] **Step 4: Commit**

```bash
cd Accounts
git add src/modules/dashboard/dashboard.widgets.test.ts
git commit -m "test(dashboard): assert widget gates exist in the RBAC catalogue"
```

---

### Task 9: Vitest on the frontend, with the session-isolation tests migrated in

**Files:**
- Modify: `Schoolfrontend/package.json`, `Schoolfrontend/tsconfig.app.json`
- Create: `Schoolfrontend/vitest.config.ts`, `Schoolfrontend/src/store/store.test.ts`, `Schoolfrontend/src/apiDomain/authBaseQuery.test.ts`

**Interfaces:**
- Consumes: existing `store`, `setCredentials`, `clearCredentials`, `clearLogoutReason`, `AuthApi`, `studentApi`.
- Produces: a working `pnpm test` in `Schoolfrontend`.

- [ ] **Step 1: Install the test kit**

Run: `cd Schoolfrontend && pnpm add -D vitest jsdom @testing-library/react`
Expected: three devDependencies added. No `@testing-library/jest-dom` — plain `expect` assertions keep the dependency surface smaller.

- [ ] **Step 2: Add the config, script, and tsconfig exclusion**

Create `Schoolfrontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

Add to `scripts` in `Schoolfrontend/package.json`:

```json
    "test": "vitest run",
```

Add to `Schoolfrontend/tsconfig.app.json` so `tsc -b` does not typecheck test files (mirroring `Accounts/tsconfig.json`):

```json
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
```

- [ ] **Step 3: Write the store isolation test**

Create `Schoolfrontend/src/store/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from './store'
import { setCredentials, clearCredentials } from '../modules/auth/AuthSlice'
import { AuthApi } from '../modules/auth/AuthApi'
import { studentApi } from '../modules/students/StudentApi'
import type { AuthenticatedUser } from '../modules/auth/types'

const ALICE: AuthenticatedUser = {
  id: 1,
  email: 'alice@school.test',
  fullName: 'Alice Bursar',
  roles: ['Bursar'],
  permissions: ['payroll.process'],
}

const BOB: AuthenticatedUser = {
  id: 2,
  email: 'bob@school.test',
  fullName: 'Bob Teacher',
  roles: ['Teacher'],
  permissions: ['attendance.record'],
}

async function signInAliceWithCachedData() {
  store.dispatch(setCredentials({ user: ALICE, token: 'token-for-alice' }))
  await store.dispatch(AuthApi.util.upsertQueryData('me', undefined, ALICE))
  await store.dispatch(
    studentApi.util.upsertQueryData('getAllStudents', undefined, [
      { id: 91, fullName: 'Alice-only Student' },
    ] as never),
  )
}

describe('store session isolation', () => {
  beforeEach(() => {
    store.dispatch(clearCredentials())
  })

  it('drops every cached response when the user logs out', async () => {
    await signInAliceWithCachedData()
    store.dispatch(clearCredentials())

    const state = store.getState() as Record<string, { queries?: object }>
    for (const [slice, value] of Object.entries(state)) {
      if (slice === 'authSlice') continue
      expect(Object.keys(value.queries ?? {})).toEqual([])
    }
    expect(JSON.stringify(state)).not.toContain('Alice')
  })

  it('keeps redux-persist bookkeeping so the session still persists after a logout', async () => {
    await signInAliceWithCachedData()
    store.dispatch(clearCredentials())
    const state = store.getState() as { authSlice: { _persist?: object } }
    expect(state.authSlice._persist).toBeTruthy()
  })

  it('drops the previous cache when someone signs in without logging out first', async () => {
    await signInAliceWithCachedData()
    store.dispatch(setCredentials({ user: BOB, token: 'token-for-bob' }))

    const state = store.getState() as { authSlice: { user: AuthenticatedUser | null } }
    expect(state.authSlice.user?.fullName).toBe('Bob Teacher')
    expect(JSON.stringify(state)).not.toContain('Alice')
  })
})
```

- [ ] **Step 4: Write the 401 handling test**

Create `Schoolfrontend/src/apiDomain/authBaseQuery.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { store } from '../store/store'
import { setCredentials, clearCredentials, clearLogoutReason } from '../modules/auth/AuthSlice'
import { studentApi } from '../modules/students/StudentApi'
import type { AuthenticatedUser } from '../modules/auth/types'

const ALICE: AuthenticatedUser = {
  id: 1,
  email: 'alice@school.test',
  fullName: 'Alice Bursar',
  roles: ['Bursar'],
  permissions: ['fees.view'],
}

const realFetch = globalThis.fetch

function respondWith(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
}

const fetchStudents = () =>
  store.dispatch(studentApi.endpoints.getAllStudents.initiate(undefined, { forceRefetch: true }))

describe('authBaseQuery session handling', () => {
  beforeEach(() => {
    store.dispatch(clearCredentials())
    store.dispatch(setCredentials({ user: ALICE, token: 'token-for-alice' }))
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('ends the session on a 401 and records why', async () => {
    respondWith(401, { success: false, error: 'Not authenticated' })
    await fetchStudents()

    const { authSlice } = store.getState() as { authSlice: { isAuthenticated: boolean; token: string | null; logoutReason: string | null } }
    expect(authSlice.isAuthenticated).toBe(false)
    expect(authSlice.token).toBeNull()
    expect(authSlice.logoutReason).toBe('expired')
  })

  it('leaves the session alone on a 403 permission denial', async () => {
    respondWith(403, { success: false, error: 'Missing required permission: payroll.process' })
    await fetchStudents()

    const { authSlice } = store.getState() as { authSlice: { isAuthenticated: boolean } }
    expect(authSlice.isAuthenticated).toBe(true)
  })

  it('reports no reason after a deliberate logout', () => {
    store.dispatch(clearCredentials())
    const { authSlice } = store.getState() as { authSlice: { logoutReason: string | null } }
    expect(authSlice.logoutReason).toBeNull()
  })

  it('clears the reason once it has been shown', async () => {
    respondWith(401, { success: false, error: 'Not authenticated' })
    await fetchStudents()
    store.dispatch(clearLogoutReason())
    const { authSlice } = store.getState() as { authSlice: { logoutReason: string | null } }
    expect(authSlice.logoutReason).toBeNull()
  })
})
```

- [ ] **Step 5: Run the tests**

Run: `cd Schoolfrontend && pnpm test`
Expected: both files pass. `redux-persist failed to create sync storage` may be logged — jsdom has no real sessionStorage in every configuration and the fallback is harmless.

- [ ] **Step 6: Confirm the production build still passes**

Run: `cd Schoolfrontend && pnpm run build`
Expected: `tsc -b` exits 0 (test files excluded) and vite builds.

- [ ] **Step 7: Commit**

```bash
cd Schoolfrontend
git add package.json pnpm-lock.yaml vitest.config.ts tsconfig.app.json src/store/store.test.ts src/apiDomain/authBaseQuery.test.ts
git commit -m "test: add vitest and cover session isolation and 401 handling"
```

---

### Task 10: Split the widget renderers out of DashboardPage

**Files:**
- Modify: `Schoolfrontend/src/modules/dashboard/types.ts`, `Schoolfrontend/src/modules/dashboard/DashboardPage.tsx`
- Create: `Schoolfrontend/src/modules/dashboard/widgets/{WidgetCard,StatsWidget,ListWidget}.tsx`
- Test: `Schoolfrontend/src/modules/dashboard/widgets/WidgetCard.test.tsx`

**Interfaces:**
- Consumes: `DashboardWidget`, `WidgetTone` from `../types`.
- Produces: default exports `WidgetCard`, `StatsWidget`, `ListWidget`; `TONE_TEXT`, `TONE_DOT` exported from `StatsWidget.tsx` and `ListWidget.tsx` respectively.

- [ ] **Step 1: Mirror the backend contract**

Add to `Schoolfrontend/src/modules/dashboard/types.ts`, keeping the existing members untouched:

```ts
export type ChartForm = 'line' | 'bar' | 'hbar'
export type ValueFormat = 'currency' | 'percent' | 'count'

export interface ChartSeries {
  key: string
  label: string
}

export interface SeriesPoint {
  label: string
  values: Record<string, number>
}
```

and add to the `DashboardWidget` union:

```ts
  | {
      id: string
      title: string
      kind: 'series'
      form: ChartForm
      valueFormat: ValueFormat
      series: ChartSeries[]
      points: SeriesPoint[]
      emptyText: string
    }
```

- [ ] **Step 2: Write the failing test**

Create `Schoolfrontend/src/modules/dashboard/widgets/WidgetCard.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import WidgetCard from './WidgetCard'
import type { DashboardWidget } from '../types'

afterEach(cleanup)

describe('WidgetCard', () => {
  it('renders a stats widget', () => {
    const widget: DashboardWidget = {
      id: 'w1',
      title: 'Fees',
      kind: 'stats',
      stats: [{ label: 'Total Invoiced', value: 'KES 1,000.00' }],
    }
    render(<WidgetCard widget={widget} />)
    expect(screen.getByText('Fees')).toBeTruthy()
    expect(screen.getByText('KES 1,000.00')).toBeTruthy()
  })

  it('renders a list widget row', () => {
    const widget: DashboardWidget = {
      id: 'w2',
      title: 'Awaiting You',
      kind: 'list',
      emptyText: 'Nothing awaiting approval.',
      rows: [{ label: 'JE-2026-004', sublabel: 'Pending approval', value: 'KES 50.00' }],
    }
    render(<WidgetCard widget={widget} />)
    expect(screen.getByText('JE-2026-004')).toBeTruthy()
  })

  it('renders a list widget empty text when it has no rows', () => {
    const widget: DashboardWidget = {
      id: 'w3',
      title: 'Awaiting You',
      kind: 'list',
      emptyText: 'Nothing awaiting approval.',
      rows: [],
    }
    render(<WidgetCard widget={widget} />)
    expect(screen.getByText('Nothing awaiting approval.')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd Schoolfrontend && pnpm vitest run src/modules/dashboard/widgets/WidgetCard.test.tsx`
Expected: FAIL — cannot resolve `./WidgetCard`.

- [ ] **Step 4: Extract the two existing renderers**

Create `Schoolfrontend/src/modules/dashboard/widgets/StatsWidget.tsx` — the body is today's `stats` branch from `DashboardPage.tsx`, moved without behaviour change:

```tsx
import React from 'react'
import type { StatItem, WidgetTone } from '../types'

export const TONE_TEXT: Record<WidgetTone, string> = {
    default: 'text-gray-800',
    success: 'text-green-700',
    warning: 'text-amber-700',
    danger: 'text-red-600',
}

const StatsWidget: React.FC<{ stats: StatItem[] }> = ({ stats }) => (
    <div className="grid grid-cols-2 gap-4">
        {stats.map((s, i) => (
            <div key={i}>
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className={`text-lg font-bold ${TONE_TEXT[s.tone ?? 'default']}`}>{s.value}</div>
            </div>
        ))}
    </div>
)

export default StatsWidget
```

Create `Schoolfrontend/src/modules/dashboard/widgets/ListWidget.tsx`:

```tsx
import React from 'react'
import type { ListRow, WidgetTone } from '../types'

export const TONE_DOT: Record<WidgetTone, string> = {
    default: 'bg-gray-300',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
}

const ListWidget: React.FC<{ rows: ListRow[]; emptyText: string }> = ({ rows, emptyText }) => {
    if (rows.length === 0) return <div className="text-sm text-gray-400">{emptyText}</div>

    return (
        <div className="space-y-2">
            {rows.map((r, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-start gap-2 min-w-0">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[r.tone ?? 'default']}`} />
                        <div className="min-w-0">
                            <div className="font-medium text-gray-800 truncate">{r.label}</div>
                            {r.sublabel && <div className="text-gray-500 text-xs truncate">{r.sublabel}</div>}
                        </div>
                    </div>
                    {r.value && <div className="text-gray-600 text-xs whitespace-nowrap">{r.value}</div>}
                </div>
            ))}
        </div>
    )
}

export default ListWidget
```

Create `Schoolfrontend/src/modules/dashboard/widgets/WidgetCard.tsx`. The `series` case is added in Task 12 — for now it renders nothing so the switch stays exhaustive:

```tsx
import React from 'react'
import type { DashboardWidget } from '../types'
import StatsWidget from './StatsWidget'
import ListWidget from './ListWidget'

const WidgetBody: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
    switch (widget.kind) {
        case 'stats':
            return <StatsWidget stats={widget.stats} />
        case 'list':
            return <ListWidget rows={widget.rows} emptyText={widget.emptyText} />
        default:
            return null
    }
}

const WidgetCard: React.FC<{ widget: DashboardWidget }> = ({ widget }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-600 mb-3">{widget.title}</div>
        <WidgetBody widget={widget} />
    </div>
)

export default WidgetCard
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Schoolfrontend && pnpm vitest run src/modules/dashboard/widgets/WidgetCard.test.tsx`
Expected: PASS, three cases.

- [ ] **Step 6: Use it from DashboardPage**

In `Schoolfrontend/src/modules/dashboard/DashboardPage.tsx`, delete the inline `WidgetCard`, `TONE_TEXT` and `TONE_DOT` definitions and the now-unused `DashboardWidget`/`WidgetTone` type imports, then add:

```tsx
import WidgetCard from './widgets/WidgetCard'
```

The `section.widgets.map(...)` call already renders `<WidgetCard key={widget.id} widget={widget} />` — leave it as it is.

- [ ] **Step 7: Verify the build and the full suite**

Run: `cd Schoolfrontend && pnpm test && pnpm run build`
Expected: all tests pass, `tsc -b` exits 0, vite builds. Load the dashboard in the browser if it is running and confirm the stats and list cards look exactly as before.

- [ ] **Step 8: Commit**

```bash
cd Schoolfrontend
git add src/modules/dashboard/
git commit -m "refactor(dashboard): extract widget renderers and mirror the series contract"
```

---

### Task 11: Chart theme, formatters, and the Recharts adapter

**Files:**
- Create: `Schoolfrontend/src/modules/dashboard/widgets/chartTheme.ts`
- Test: `Schoolfrontend/src/modules/dashboard/widgets/chartTheme.test.ts`

**Interfaces:**
- Consumes: `SeriesPoint`, `ValueFormat` from `../types`.
- Produces: `CHART_COLORS: string[]`, `formatValue(value: number, format: ValueFormat): string`, `formatAxisTick(value: number, format: ValueFormat): string`, `toRechartsRows(points: SeriesPoint[]): Array<Record<string, string | number>>`, `AXIS_PROPS`, `GRID_PROPS`, `TOOLTIP_PROPS`.

- [ ] **Step 1: Write the failing test**

Create `Schoolfrontend/src/modules/dashboard/widgets/chartTheme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CHART_COLORS, formatValue, formatAxisTick, toRechartsRows } from './chartTheme'

describe('formatValue', () => {
  it('formats currency with a KES prefix and thousands separators', () => {
    expect(formatValue(1234567.5, 'currency')).toBe('KES 1,234,567.50')
  })

  it('formats a percentage to one decimal place', () => {
    expect(formatValue(90, 'percent')).toBe('90.0%')
  })

  it('formats a count with no decimals', () => {
    expect(formatValue(1200, 'count')).toBe('1,200')
  })

  it('formats zero rather than rendering it as blank', () => {
    expect(formatValue(0, 'currency')).toBe('KES 0.00')
    expect(formatValue(0, 'count')).toBe('0')
  })
})

describe('formatAxisTick', () => {
  it('abbreviates large money so axis labels do not overlap on a small card', () => {
    expect(formatAxisTick(1_500_000, 'currency')).toBe('1.5M')
    expect(formatAxisTick(12_000, 'currency')).toBe('12K')
  })

  it('leaves small numbers alone', () => {
    expect(formatAxisTick(250, 'currency')).toBe('250')
  })

  it('suffixes percentages', () => {
    expect(formatAxisTick(50, 'percent')).toBe('50%')
  })
})

describe('toRechartsRows', () => {
  it('flattens nested values into the flat rows Recharts expects', () => {
    const rows = toRechartsRows([
      { label: 'Jul', values: { billed: 1000, collected: 600 } },
      { label: 'Aug', values: { billed: 0, collected: 0 } },
    ])
    expect(rows).toEqual([
      { label: 'Jul', billed: 1000, collected: 600 },
      { label: 'Aug', billed: 0, collected: 0 },
    ])
  })

  it('preserves point order', () => {
    const rows = toRechartsRows([
      { label: 'Sep', values: { x: 1 } },
      { label: 'Jul', values: { x: 2 } },
    ])
    expect(rows.map((r) => r.label)).toEqual(['Sep', 'Jul'])
  })

  it('returns an empty array for no points', () => {
    expect(toRechartsRows([])).toEqual([])
  })
})

describe('CHART_COLORS', () => {
  it('offers enough distinct colours for the widest chart in the catalogue', () => {
    expect(CHART_COLORS.length).toBeGreaterThanOrEqual(8)
    expect(new Set(CHART_COLORS).size).toBe(CHART_COLORS.length)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Schoolfrontend && pnpm vitest run src/modules/dashboard/widgets/chartTheme.test.ts`
Expected: FAIL — cannot resolve `./chartTheme`.

- [ ] **Step 3: Write the theme**

Create `Schoolfrontend/src/modules/dashboard/widgets/chartTheme.ts`:

```ts
import type { SeriesPoint, ValueFormat } from '../types'

/**
 * One palette for every chart, so twelve cards read as one system. Ordered by
 * how well adjacent pairs separate for the most common colour-vision
 * deficiencies: the first two (deep green, amber) are the pair a two-series
 * chart uses, and no two neighbours rely on a red/green distinction alone.
 * Anchored on the app's existing green-800 primary.
 */
export const CHART_COLORS = [
    '#166534', // green-800, the app's primary
    '#b45309', // amber-700
    '#1d4ed8', // blue-700
    '#9333ea', // purple-600
    '#0f766e', // teal-700
    '#be123c', // rose-700
    '#4d7c0f', // lime-700
    '#0369a1', // sky-700
]

export function formatValue(value: number, format: ValueFormat): string {
    switch (format) {
        case 'currency':
            return `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        case 'percent':
            return `${value.toFixed(1)}%`
        case 'count':
            return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    }
}

/** Axis labels get far less room than a tooltip, so money is abbreviated. */
export function formatAxisTick(value: number, format: ValueFormat): string {
    if (format === 'percent') return `${Math.round(value)}%`

    const abs = Math.abs(value)
    if (abs >= 1_000_000) return `${trimZero(value / 1_000_000)}M`
    if (abs >= 1_000) return `${trimZero(value / 1_000)}K`
    return String(Math.round(value))
}

const trimZero = (n: number) => String(Number(n.toFixed(1)))

/**
 * Recharts wants one flat object per point; the API deliberately carries the
 * series keys nested so the contract is not shaped by this library.
 */
export function toRechartsRows(points: SeriesPoint[]): Array<Record<string, string | number>> {
    return points.map((point) => ({ label: point.label, ...point.values }))
}

export const GRID_PROPS = { stroke: '#f3f4f6', strokeDasharray: '3 3' } as const
export const AXIS_PROPS = {
    tick: { fontSize: 11, fill: '#6b7280' },
    stroke: '#e5e7eb',
    tickLine: false,
} as const
export const TOOLTIP_PROPS = {
    contentStyle: { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' },
} as const
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Schoolfrontend && pnpm vitest run src/modules/dashboard/widgets/chartTheme.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `cd Schoolfrontend && pnpm test && pnpm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd Schoolfrontend
git add src/modules/dashboard/widgets/chartTheme.ts src/modules/dashboard/widgets/chartTheme.test.ts
git commit -m "feat(dashboard): add shared chart theme, formatters and Recharts adapter"
```

---

### Task 12: SeriesWidget, lazily loaded

**Files:**
- Create: `Schoolfrontend/src/modules/dashboard/widgets/SeriesWidget.tsx`
- Modify: `Schoolfrontend/src/modules/dashboard/widgets/WidgetCard.tsx`, `Schoolfrontend/src/modules/dashboard/widgets/WidgetCard.test.tsx`

**Interfaces:**
- Consumes: `CHART_COLORS`, `formatValue`, `formatAxisTick`, `toRechartsRows`, `AXIS_PROPS`, `GRID_PROPS`, `TOOLTIP_PROPS` (Task 11).
- Produces: default export `SeriesWidget`.

- [ ] **Step 1: Install Recharts**

Run: `cd Schoolfrontend && pnpm add recharts`
Then confirm it resolves against React 19: `cd Schoolfrontend && pnpm list recharts react`
Expected: recharts 3.x or ≥2.13 (earlier majors do not declare React 19 support). If pnpm reports a peer-dependency warning about React 19, stop and report it rather than forcing the install.

- [ ] **Step 2: Write the failing test**

Add to `Schoolfrontend/src/modules/dashboard/widgets/WidgetCard.test.tsx`:

```tsx
  it('renders the empty text instead of a chart when a series has no points', async () => {
    const widget: DashboardWidget = {
      id: 'w4',
      title: 'Fee Collection Trend',
      kind: 'series',
      form: 'line',
      valueFormat: 'currency',
      series: [{ key: 'collected', label: 'Collected' }],
      points: [],
      emptyText: 'No invoices or payments in this period.',
    }
    render(<WidgetCard widget={widget} />)
    expect(await screen.findByText('No invoices or payments in this period.')).toBeTruthy()
  })

  it('renders the empty text when every point is zero, rather than a flat line at zero', async () => {
    const widget: DashboardWidget = {
      id: 'w5',
      title: 'Fee Collection Trend',
      kind: 'series',
      form: 'line',
      valueFormat: 'currency',
      series: [{ key: 'collected', label: 'Collected' }],
      points: [
        { label: 'Jul', values: { collected: 0 } },
        { label: 'Aug', values: { collected: 0 } },
      ],
      emptyText: 'No invoices or payments in this period.',
    }
    render(<WidgetCard widget={widget} />)
    expect(await screen.findByText('No invoices or payments in this period.')).toBeTruthy()
  })

  it('gives a chart an accessible label describing what it shows', async () => {
    const widget: DashboardWidget = {
      id: 'w6',
      title: 'Attendance Rate',
      kind: 'series',
      form: 'line',
      valueFormat: 'percent',
      series: [{ key: 'rate', label: 'Present' }],
      points: [
        { label: '11 Sep', values: { rate: 91 } },
        { label: '12 Sep', values: { rate: 88 } },
      ],
      emptyText: 'No attendance registers taken in this period.',
    }
    render(<WidgetCard widget={widget} />)
    const chart = await screen.findByRole('img')
    expect(chart.getAttribute('aria-label')).toContain('Attendance Rate')
    expect(chart.getAttribute('aria-label')).toContain('Present')
  })
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd Schoolfrontend && pnpm vitest run src/modules/dashboard/widgets/WidgetCard.test.tsx`
Expected: FAIL on the three new cases — `WidgetCard`'s `default: return null` renders nothing for a `series` widget.

- [ ] **Step 4: Write SeriesWidget**

Create `Schoolfrontend/src/modules/dashboard/widgets/SeriesWidget.tsx`. This is the only file that imports Recharts:

```tsx
import React from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import type { ChartForm, ChartSeries, SeriesPoint, ValueFormat } from '../types'
import { AXIS_PROPS, CHART_COLORS, GRID_PROPS, TOOLTIP_PROPS, formatAxisTick, formatValue, toRechartsRows } from './chartTheme'

interface SeriesWidgetProps {
    form: ChartForm
    valueFormat: ValueFormat
    series: ChartSeries[]
    points: SeriesPoint[]
    emptyText: string
    title: string
}

const CHART_HEIGHT = 200

const SeriesWidget: React.FC<SeriesWidgetProps> = ({ form, valueFormat, series, points, emptyText, title }) => {
    // All-zero is indistinguishable from no data to a reader, and a flat line at
    // zero looks like a broken chart rather than an empty period.
    const hasData = points.some((point) => series.some((s) => (point.values[s.key] ?? 0) !== 0))
    if (points.length === 0 || !hasData) {
        return <div className="text-sm text-gray-400">{emptyText}</div>
    }

    const rows = toRechartsRows(points)
    const tickFormatter = (value: number) => formatAxisTick(value, valueFormat)
    const tooltipFormatter = (value: number) => formatValue(value, valueFormat)
    const label = `${title}. ${series.map((s) => s.label).join(' and ')} across ${points.length} points.`

    return (
        <div role="img" aria-label={label} style={{ height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
                {form === 'line' ? (
                    <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="label" {...AXIS_PROPS} />
                        <YAxis tickFormatter={tickFormatter} width={44} {...AXIS_PROPS} />
                        <Tooltip formatter={tooltipFormatter} {...TOOLTIP_PROPS} />
                        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {series.map((s, i) => (
                            <Line
                                key={s.key}
                                dataKey={s.key}
                                name={s.label}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                            />
                        ))}
                    </LineChart>
                ) : (
                    <BarChart
                        data={rows}
                        layout={form === 'hbar' ? 'vertical' : 'horizontal'}
                        margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                    >
                        <CartesianGrid {...GRID_PROPS} />
                        {form === 'hbar' ? (
                            <>
                                <XAxis type="number" tickFormatter={tickFormatter} {...AXIS_PROPS} />
                                <YAxis type="category" dataKey="label" width={96} {...AXIS_PROPS} />
                            </>
                        ) : (
                            <>
                                <XAxis dataKey="label" {...AXIS_PROPS} />
                                <YAxis tickFormatter={tickFormatter} width={44} {...AXIS_PROPS} />
                            </>
                        )}
                        <Tooltip formatter={tooltipFormatter} {...TOOLTIP_PROPS} />
                        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {series.map((s, i) => (
                            <Bar
                                key={s.key}
                                dataKey={s.key}
                                name={s.label}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                                radius={[3, 3, 0, 0]}
                            />
                        ))}
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    )
}

export default SeriesWidget
```

- [ ] **Step 5: Wire it into WidgetCard behind lazy loading**

Replace the contents of `Schoolfrontend/src/modules/dashboard/widgets/WidgetCard.tsx`:

```tsx
import React, { Suspense, lazy } from 'react'
import type { DashboardWidget } from '../types'
import StatsWidget from './StatsWidget'
import ListWidget from './ListWidget'

// Recharts is ~100KB gzipped and only chart widgets need it, so it is split out
// of the main bundle. A role with no chart permissions never downloads it.
const SeriesWidget = lazy(() => import('./SeriesWidget'))

const ChartSkeleton: React.FC = () => (
    <div className="h-[200px] rounded bg-gray-50 animate-pulse" aria-hidden="true" />
)

const WidgetBody: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
    switch (widget.kind) {
        case 'stats':
            return <StatsWidget stats={widget.stats} />
        case 'list':
            return <ListWidget rows={widget.rows} emptyText={widget.emptyText} />
        case 'series':
            return (
                <Suspense fallback={<ChartSkeleton />}>
                    <SeriesWidget
                        title={widget.title}
                        form={widget.form}
                        valueFormat={widget.valueFormat}
                        series={widget.series}
                        points={widget.points}
                        emptyText={widget.emptyText}
                    />
                </Suspense>
            )
    }
}

const WidgetCard: React.FC<{ widget: DashboardWidget }> = ({ widget }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-600 mb-3">{widget.title}</div>
        <WidgetBody widget={widget} />
    </div>
)

export default WidgetCard
```

Note the `default` case is gone: the switch is now exhaustive over the three kinds, so adding a fourth kind later becomes a compile error rather than a blank card.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd Schoolfrontend && pnpm vitest run src/modules/dashboard/widgets/WidgetCard.test.tsx`
Expected: PASS, all six cases. The two empty-state cases and the `aria-label` case exercise `SeriesWidget` without depending on Recharts rendering an SVG — `ResponsiveContainer` has no layout in jsdom and will not draw one.

- [ ] **Step 7: Confirm the bundle is split**

Run: `cd Schoolfrontend && pnpm run build`
Expected: `tsc -b` exits 0 and the vite output lists a **separate chunk** containing recharts, not one larger main chunk. Note the main chunk size before and after this task and confirm it has not grown materially.

- [ ] **Step 8: Commit**

```bash
cd Schoolfrontend
git add package.json pnpm-lock.yaml src/modules/dashboard/widgets/
git commit -m "feat(dashboard): render series widgets with lazily-loaded Recharts"
```

---

### Task 13: End-to-end verification against seeded data

**Files:** none created or modified. This task is verification only; if it finds a defect, fix it in the task that owns the code and re-run.

- [ ] **Step 1: Seed a database with school data**

Run: `cd Accounts && docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm db:seed-school`
Expected: all commands exit 0.

- [ ] **Step 2: Start both apps**

Run in separate terminals: `cd Accounts && pnpm dev` and `cd Schoolfrontend && pnpm dev`
Expected: the API reports `Database connection OK` and a port; vite serves the frontend.

- [ ] **Step 3: Check the dashboard payload actually carries chart widgets**

Sign in as a Bursar (see `pnpm db:seed-demo-users` output for credentials), then in the browser devtools Network tab open the `dashboard/summary` response and confirm:
- at least one widget has `"kind": "series"`
- its `points` array length matches its window (6 for the monthly charts)
- `values` are **numbers**, not strings
- every month in the window is present even if its values are `0`

- [ ] **Step 4: Verify each role sees the right charts**

Sign in as each of Bursar, Dean of Studies, Principal, and a Teacher. Confirm against the spec's catalogue:
- Bursar: fee collection, income vs expenditure, spend by votehead, enrolment by class
- Dean of Studies: attendance rate, enrolment by class, grade distribution — and **no** finance charts
- Principal: all six
- Teacher: no chart widgets at all, and confirm in the Network tab that the recharts chunk is **never requested**

- [ ] **Step 5: Check the empty and narrow cases**

- Confirm a chart with no data shows its empty text rather than an empty axis frame.
- Resize the browser to 400px wide and confirm no chart overflows its card and the page does not scroll horizontally.
- Confirm the horizontal bar chart's fund names are readable rather than truncated to nothing.

- [ ] **Step 6: Run everything one more time**

Run: `cd Accounts && pnpm test && pnpm run build` then `cd Schoolfrontend && pnpm test && pnpm run build`
Expected: all four commands exit 0.

- [ ] **Step 7: Commit any fixes**

If Steps 3–5 required changes, commit them with a message naming the defect, e.g.:

```bash
git commit -m "fix(dashboard): zero-fill the month a register was never taken"
```
