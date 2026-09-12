# Dashboard Data Visualization — Design

**Date:** 2026-09-12
**Status:** Approved design, pending implementation plan
**Repos touched:** `Accounts` (widget kinds, aggregation, indexes) and `Schoolfrontend` (renderer, chart theme, Vitest).

## Purpose

The roles that steer the school — Principal, Bursar, Dean of Studies, System
Administrator — read the Overview as numbers and lists. A fee collection figure
tells them the total; it does not tell them collection has fallen for three
consecutive months, that one votehead is consuming the budget, or that
attendance dipped the week after the term opened.

This spec adds charts to the Overview so the data is represented over time and
by composition, not only as a point-in-time count.

## Background: what exists

**The Overview is already a permission-gated widget catalogue.**
`dashboard.widgets.ts` declares 86 widgets, each with a `section`, a
`requiredPermission`, and a `build()` that runs its own query.
`dashboard.service.ts` filters the catalogue by the caller's permissions, builds
the survivors through `Promise.allSettled`, drops and logs any that throw, and
groups the rest into ordered sections. The client renders each widget by its
`kind` — today `'stats'` or `'list'`.

**This is why charts do not need per-role work.** `rbac.ts` defines 22 roles.
Writing a Principal dashboard, a Bursar dashboard and a Dean dashboard would be
three code paths that drift; declaring a chart widget with
`requiredPermission: 'fees.view'` reaches the Bursar, the Principal, the BOM
Treasurer and the Auditor at once, and reaches nobody else.

**The schema supports real time series.** Verified columns: `feePayments`
(`paymentDate`, `amount`, `method`), `feeInvoices` (`invoiceDate`,
`totalAmount`, `status`), `journalEntries` (`entryDate`, `status`) with
`journalLines`, `attendanceRecords` (`attendanceDate`, `status`), `exams` /
`examResults` with `gradingBands`, and `admissions` (`status`). Money is
`numeric(14, 2)`, which the `postgres` driver returns as a **string**.

**"Term" is a real entity, "intake" is not.** `fiscalPeriods` carries
`fiscalYear`, a nullable `term` (1/2/3, null for a full-year period),
`startDate`, `endDate` and a `status` of `open` or `closed` — so a term-shaped
window is expressible as the period whose range contains the date. `admissions`
has no academic-year or intake column at all, only `createdAt`, so any
admissions window has to be expressed in calendar time.

**No indexes are declared anywhere in the schema.** `attendanceRecords` has
`unique(studentId, attendanceDate)`, which cannot serve a date-range scan
because `student_id` leads the composite. Every chart here filters by a date
range.

**No chart library is installed,** and `vite build` already warns that a chunk
exceeds 500 kB.

**Test frameworks.** `Accounts` now has Vitest (33 tests). `Schoolfrontend` has
none — this spec adds it.

**`DashboardPage.tsx` holds `WidgetCard` inline,** switching on kind with a
two-branch ternary.

## Decisions taken

**1. Charts are new widget kinds, not a new page.** They join the existing
catalogue and arrive through `GET /api/dashboard`. This reuses the permission
gate, the section ordering, and the per-widget failure isolation, and it means
no new route, no nav entry, and no per-role code. A dedicated Analytics page
with date-range controls remains a reasonable future step; it is not this spec.

**2. Two kinds, not one.** `kind: 'series'` covers anything with an axis (line,
bar, stacked bar, horizontal bar); `kind: 'breakdown'` covers composition
without an axis (the donuts). The axis forms all share one payload shape — axis
labels plus one or more named series — so they are variants of a single kind,
separated by a `form` field. A breakdown has a different shape (flat slices, no
axis, no multi-series) and a different render path, so folding it in under the
same `form` field would mean a kind whose required fields depend on the value of
one of its own fields.

**3. Numbers stay numbers on the wire.** `stats` widgets pre-format server-side
to `value: string`; chart widgets must not, because axis ticks, stacking and
tooltips need arithmetic. Each chart declares
`valueFormat: 'currency' | 'percent' | 'count'` and the client formats at the
edge.

**4. The API shape is not Recharts' input shape.** Recharts wants flat rows
(`{ label, billed, collected }`). The contract instead carries
`points: Array<{ label: string; values: Record<string, number> }>`, and the
renderer flattens it in one `map`. The wire format should not be hostage to one
library's constructor, and the nested form makes the series keys explicit.

**5. Buckets are generated from the calendar and zero-filled server-side.** A
month with no fee payments returns no row, and a line chart that silently skips
April is not sparse — it is wrong. Labels and order therefore come from the
calendar, not from the result set. Series are capped at 12 buckets (months) or
31 (days) so no chart can bloat the dashboard payload.

**6. Recharts is lazy-loaded.** It is imported *only* by the two chart
components, which `DashboardPage` pulls in via `React.lazy` behind a
`<Suspense>` skeleton. It stays out of the main chunk, and a role with no chart
permissions — Teacher, Librarian, Parent — never downloads it.

**7. One chart theme, not twelve defaults.** A single `chartTheme.ts` owns the
categorical palette, the axis/grid/tooltip props and the value formatters. Twelve
charts each styled at their call site would read as twelve unrelated charts.

**8. Failure and emptiness are distinct.** A failed query keeps today's
behaviour: the widget is logged server-side and dropped from the response,
because a missing card beats a broken one. Empty or all-zero data renders the
widget's `emptyText`, never an empty axis frame.

**9. Three indexes ship with this work.** One migration adding
`attendance_records(attendance_date)`, `fee_payments(payment_date)` and
`journal_entries(entry_date)`. Date-bucketed aggregates are the whole feature;
these are the supporting indexes for it.

**10. No date-range picker and no drill-down.** Each chart carries the window
that suits it (six months, thirty days, latest published exam), anchored to the
`asOfDate` the endpoint already accepts. The module pages already handle detail,
so a chart click has nowhere better to go.

## The chart catalogue

Phase 1 is the first six rows — they cover all four roles named in the request.
Phase 2 is the remainder, once the pattern is proven against real data.

| # | Chart | Form | Gate | Window |
|---|-------|------|------|--------|
| 1 | Fee collection: billed vs collected | line, 2 series | `fees.view` | 6 months |
| 2 | Income vs expenditure | line, 2 series | `ledger.journal.view` | 6 months |
| 3 | Spend by fund / votehead (top 8) | hbar | `ledger.journal.view` | active fiscal period |
| 4 | Attendance rate | line | `attendance.view` | 30 days |
| 5 | Enrolment by class / stream | bar | `students.view` | current |
| 6 | Exam grade distribution | bar | `exams.view` | latest published exam |
| 7 | Invoice status mix | stacked-bar | `fees.view` | active fiscal period |
| 8 | Fee payment methods | breakdown | `fees.view` | 6 months |
| 9 | Budget vs actual per fund | bar, 2 series | `budget.view` | active fiscal period |
| 10 | Attendance status mix | breakdown | `attendance.view` | 30 days |
| 11 | Admissions funnel by status | hbar | `admissions.view` | created in last 12 months |
| 12 | Payroll cost | line | `payroll.view` | 6 months |

Role coverage follows from the gates: Bursar gets 1, 2, 3, 5, 7, 8, 9 (they hold
`students.view` as well as the finance permissions); Dean of Studies gets 4, 5,
6, 10; Principal gets all twelve; System Administrator sees whatever their
permissions carry. Registrar, Payroll Officer, BOM Treasurer and Auditor are
covered without being named anywhere in the code.

## Widget contract

Added to `dashboard.types.ts` and mirrored in `Schoolfrontend/src/modules/dashboard/types.ts`:

```ts
export type ChartForm = 'line' | 'bar' | 'stacked-bar' | 'hbar'
export type ValueFormat = 'currency' | 'percent' | 'count'

export interface ChartSeries {
  key: string    // matches a key in SeriesPoint.values
  label: string  // legend and tooltip text
}

export interface SeriesPoint {
  label: string                    // x-axis tick, calendar-derived
  values: Record<string, number>   // keyed by ChartSeries.key
}

export interface BreakdownSlice {
  label: string
  value: number
  tone?: WidgetTone
}

export type DashboardWidget =
  | { id: string; title: string; kind: 'stats'; stats: StatItem[] }
  | { id: string; title: string; kind: 'list'; emptyText: string; rows: ListRow[] }
  | { id: string; title: string; kind: 'series'; form: ChartForm; valueFormat: ValueFormat
      series: ChartSeries[]; points: SeriesPoint[]; emptyText: string }
  | { id: string; title: string; kind: 'breakdown'; valueFormat: ValueFormat
      slices: BreakdownSlice[]; emptyText: string }
```

The two existing members are unchanged, so every current widget and the client's
existing branches keep working.

## Aggregation

A new `dashboard.series.ts` holds the pure helpers, separate from the widget
definitions so they can be tested without a database:

- `monthBuckets(asOfDate, count)` → chronological `['Apr', 'May', …]` labels with
  their date ranges, derived from the calendar.
- `dayBuckets(asOfDate, count)` → the same for days.
- `zeroFill(buckets, rows, key)` → one `SeriesPoint` per bucket, missing buckets
  contributing `0`.
- `toNumber(value)` → explicit coercion for `numeric` columns arriving as
  strings, treating `null` as `0`.

Three windows recur, and each resolves to a concrete date range before any query
runs:

- **Rolling calendar** (6 months, 30 days, 12 months) — counted back from
  `asOfDate`.
- **Active fiscal period** — the `fiscalPeriods` row whose `startDate`/`endDate`
  contains `asOfDate`, falling back to the most recent period that ends before it
  when the calendar has a gap. Charts 3, 7 and 9 share this one resolver rather
  than each inventing a notion of "current term".
- **Latest published exam** — the `exams` row with `status = 'published'` and the
  greatest `examDate`. Chart 6 renders its `emptyText` when no exam is published
  yet, which is the normal state early in a term.

Each chart widget then runs a single grouped query, anchored to `asOfDate`, for
example fee collection:

```sql
select date_trunc('month', payment_date) as bucket, sum(amount) as total
from fee_payments
where payment_date >= $1 and payment_date <= $2
group by 1
order by 1
```

and hands the rows to `zeroFill`. Widgets stay declarative; no widget formats
money, invents a label, or sorts by anything but the calendar.

## Indexes

One drizzle migration, generated with `pnpm db:generate`:

```
attendance_records (attendance_date)
fee_payments       (payment_date)
journal_entries    (entry_date)
```

## Frontend renderer

`DashboardPage.tsx` currently holds `WidgetCard` inline. Four kinds in that
ternary would be unreadable, so it splits into
`src/modules/dashboard/widgets/`:

- `WidgetCard.tsx` — the card shell, switching on `kind` and nothing else
- `StatsWidget.tsx`, `ListWidget.tsx` — today's two branches, moved verbatim
- `SeriesWidget.tsx`, `BreakdownWidget.tsx` — the only Recharts importers
- `chartTheme.ts` — palette, axis/grid/tooltip props, value formatters

`DashboardPage` keeps the page shell, the query and the section loop. This is a
targeted split of the file being changed, not a general refactor.

The chart components load through `React.lazy` with a skeleton fallback sized to
the card, so a slow chunk cannot shift the layout. `chartTheme.ts` provides a
colour-blind-safe categorical palette anchored to the existing `green-800`
primary, checked for contrast in light and dark. Charts get explicit responsive
heights and no fixed pixel widths, since the grid collapses to one column at
phone width. Each chart card carries `role="img"` and an `aria-label`
summarising its trend, because the SVG alone tells a screen reader nothing.

## Verification

**Backend (Vitest, already present).**

- `dashboard.series.test.ts` — buckets are chronological and calendar-derived;
  a missing month yields `0` rather than being skipped; caps are enforced at 12
  and 31; `numeric` strings and `null` coerce correctly; empty input yields an
  empty series rather than throwing.
- `dashboard.widgets.test.ts` — every chart widget's `requiredPermission` exists
  in the `rbac.ts` catalogue, and widget ids are unique. A typo'd permission
  string would otherwise hide a chart from every role, silently, with nothing
  else to catch it.

**Frontend (Vitest, added by this work).** Add `vitest`, `jsdom`,
`@testing-library/react` and a `test` script, with a config mirroring the
backend's.

- The payload→Recharts adapter: `points` with `values` flattens to the flat rows
  Recharts expects, series keys preserved, order preserved.
- The `chartTheme` formatters: currency, percent and count, including zero and
  large values.
- `WidgetCard` dispatch: each `kind` renders its corresponding component, and an
  empty `series`/`breakdown` renders `emptyText` instead of a chart.

Deliberately **not** asserted: Recharts' own SVG output. It renders through
`ResponsiveContainer`, which has no layout in jsdom, and its internals are the
library's contract, not ours.

**Migrated in with the new runner.** The two session-isolation tests currently
living as throwaway rolldown harness scripts — cross-account cache leak on
logout/login, and 401 ending the session while 403 does not — become permanent
Vitest tests, since the runner they were waiting for now exists.

## Out of scope

- A dedicated Analytics page, and any date-range picker or drill-down.
- Exporting a chart as an image, and realtime chart updates over the existing SSE
  channel.
- Charts on the individual module pages (Fees, Attendance, and so on).
- The `formatMoney` helper duplicated across six page components. Noted while
  reading; unrelated to this work, and `chartTheme` deliberately does not try to
  become its home.
- Phase 2 charts (rows 7–12) until phase 1 is proven on real data.
