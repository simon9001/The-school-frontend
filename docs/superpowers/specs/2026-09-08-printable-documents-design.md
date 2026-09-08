# Printable & Downloadable Documents — Design

**Date:** 2026-09-08
**Status:** Approved design, pending implementation plan
**Repos touched:** `Schoolfrontend` only. No backend changes.

## Purpose

Staff need to put school records on paper and into files: the Bursar prints the
trial balance for the BOM Finance Committee and the OAG audit, the registrar
prints student records, the head prints a staff list, and class teachers hand
report forms to parents. Today the app can print exactly two things — a fee
receipt and a fee statement — and can download nothing at all.

This spec adds a shared document layer and applies it to four documents.

## Background: what exists

**A printable-modal pattern.** `PrintableReceipt.tsx` and
`PrintableStatement.tsx` render a document inside a modal marked
`.print-region`, with a Print button calling `window.print()`.

**A print stylesheet with a flaw that matters here.** `index.css` hides
everything with `body * { visibility: hidden }`, brings back `.print-region`,
and positions it `absolute` at the top-left. That works for a one-page receipt.
It does **not** work for the documents this spec adds: absolutely-positioned
content is clipped at the first page boundary in most browsers, so a trial
balance or an 800-row student list would print page one and silently lose the
rest. Silently is the problem — nothing warns you.

**A letterhead config worth reusing.** `config/school.ts` reads
`VITE_SCHOOL_NAME` from the environment and falls back to the deliberately
obvious `SCHOOL NAME NOT CONFIGURED`, on the reasoning that an obviously broken
letterhead gets fixed immediately where a plausible wrong one gets printed for a
term. This spec reuses it unchanged.

## Decisions taken

**1. Generate real PDFs with `jspdf` + `jspdf-autotable`.** `autoTable`
paginates long tables, repeats the column header on every page, and exposes a
per-page hook for letterhead and footers — precisely the failure mode the CSS
approach has. The alternatives were rejected: `pdfmake` and
`@react-pdf/renderer` are each around a megabyte (they embed fonts or ship their
own layout engine) and would mean laying out every document twice, once as HTML
for the screen and once in their DSL.

**2. Load the library lazily.** A dynamic `import()` inside the button handler
keeps it out of the main bundle. jsPDF plus autoTable is the largest dependency
in this app by some margin — the exact gzipped cost has not been measured here
and the implementation should report it — so a teacher who never exports should
never download it.

**3. Every document offers Print and Download, from one code path.** This is the
correction that shaped the design. A download-only button makes printing a
five-step chore — download, find the file, open it, Ctrl+P, print — for a
document the Bursar prints every month. jsPDF's `autoPrint()` plus a blob URL
opens the generated PDF with the browser's print dialog already up, so printing
is one click. Both buttons call the same `build…Pdf()` function; only the final
line differs.

**4. No new permission.** If you can see the data on screen you can print or
export it — a PDF is the same data in another shape. Each document is gated by
the permission its page already requires. Gating exports separately would stop a
teacher printing a class list and a registrar printing student records, since
neither holds `reports.export`. That permission stays reserved for the formal
Reports module (see the 2026-09-07 spec, section 4).

**5. Every document states the filters that produced it.** Not decoration. The
trial balance page filters by as-at date and fund; a printed copy that omits them
cannot be reconciled later, and someone will file it anyway. Same for a student
list filtered to one class.

**6. Every document names its author and time.** The page footer carries
`Page N of M · Generated <timestamp> by <full name>`. When the Bursar hands a
trial balance to the OAG auditor, that line is the difference between a report
and a printout.

**7. The fee receipt keeps its existing print modal; the fee statement moves to
PDF.** The receipt is one page and is printed at a counter with a parent
waiting — speed beats file management, and the current modal already works. The
statement is different: a student with a term of transactions can genuinely
exceed one page, which means it is silently losing rows today. The broken print
CSS is routed around rather than repaired, and gains a comment recording that it
is only safe for single-page content.

**8. Add vitest to the frontend.** The repo has no test runner. This spec adds
document generation over financial data, and the mapping and formatting
functions are pure and trivially testable. Vitest is near-zero configuration in
a Vite project. This is an addition beyond the original request, taken
deliberately.

---

## 1. The shared document layer — `src/lib/pdf/`

Four small modules so no page reinvents letterhead, pagination or filenames.

### `schoolDocument.ts`

```ts
createDocument({ title, meta, orientation }): SchoolDocument
```

Returns the jsPDF instance with the letterhead already drawn — school name,
document title, and the `meta` line — plus:

- `finalize()` — stamps `Page N of M · Generated <timestamp> by <name>` on every
  page. Called once, after all content is added, because the total page count is
  not known until then.

  The name is the signed-in user's `fullName` from the auth slice, passed in by
  the caller rather than read from the store inside `src/lib/pdf/` — the module
  stays a pure document builder with no Redux dependency, which is also what
  makes it testable.
- `print()` — `autoPrint()` then open the blob URL.
- `save(filename)` — download.

`orientation` defaults to portrait; documents declare landscape when their
column count needs it.

### `table.ts`

```ts
addTable(doc, { columns, rows, columnStyles? })
```

A thin wrapper fixing autoTable styling once — header fill, zebra rows, numeric
columns right-aligned, font sizes — so eight documents do not each carry a
styling blob.

### `filename.ts`

```ts
pdfFilename('trial-balance', { asOf: '2026-09-08' })  // trial-balance-2026-09-08.pdf
```

Date-suffixed so a folder of downloads sorts chronologically.

### `format.ts`

Shared money, date and "blank instead of zero" formatting, so a printed figure
matches what the screen showed. Pure; this is the module the tests target
hardest.

### Error handling

`print()` opens a blob URL in a new tab. If a popup blocker returns `null` from
`window.open`, fall back to `save()` and raise a toast explaining that the
document was downloaded instead — never fail silently, and never leave the user
looking at a button that did nothing.

PDF generation is synchronous and fast at these row counts, but the dynamic
import is not: buttons show a pending state while the library loads, and a
failed import raises a toast rather than an unhandled rejection.

---

## 2. The four documents

Each page gains Print and Download buttons plus one pure function mapping its
**current, filtered** rows to columns. Exporting what is on screen is what users
expect: filter to Form 2, export, get Form 2. None of these refetches unfiltered
data.

| Document | Page | Meta line | Orientation |
|---|---|---|---|
| Trial Balance | existing `TrialBalancePage` | `As at <date> · <fund or All funds>` | Portrait |
| Student Records | existing `StudentsPage` | active filters (class, stream, status, search) | Portrait |
| Teachers | existing `TeachersPage` | active filters (status) | Portrait |
| Report Card | **new page** | `<exam name> · <term/year>` | Portrait |

**Trial Balance** carries the `Code / Account / Type / Debit / Credit` table, a
totals row, and the balanced / out-of-balance statement. That last one must reach
paper: the screen shows it, and a printed out-of-balance trial balance without it
looks authoritative. Five columns fit A4 portrait.

**Student Records** and **Teachers** are straight list exports of the filtered
table.

---

## 3. Report Cards — the one that needs building

`GET /api/exams/:examId/report-cards/:studentId` exists and is gated on
`exams.view`, but there is no exams module in the frontend at all — no exam
list, no results entry, no way to choose an exam. So unlike the other three,
this is not "add a button to a page".

**Scope for this spec:** the minimum that makes report forms printable, and
nothing more.

- New `src/modules/exams/` with `ExamsApi.ts` — `GET /api/exams` (list) and
  `GET /api/exams/:examId/report-cards/:studentId`.
- New page at `/dashboard/academic/report-cards`, gated on `exams.view`: choose
  an exam, choose a student, see the report card on screen, Print or Download.
- New nav entry **Report Cards** under Academic, `built: true`, permission
  `exams.view`.

The existing unbuilt **Exams & Grading** nav entry is left alone. It belongs to
the larger exams module — grading scales, results entry, exam timetables — which
is not in scope here.

**The PDF is a real report form:** letterhead; student name, admission number
and class; a subject / marks / grade / remarks table; totals and mean grade; then
class teacher and principal comment lines and signature lines. It is handed to a
parent, so it has to look like a document a school issues, not a table dump.

**Who can use it:** `exams.view` is held by the Principal, Dean of Studies and
teachers, and swept into the view-only roles. The Bursar does not hold it and so
cannot print report cards — correct, it is not their job.

**Cross-reference:** the 2026-09-07 spec's section 8 item A narrows the
`VIEW_ONLY` sweep so auditors and BOM members stop receiving student data
automatically. If that lands first, `exams.view` may leave the sweep and this
page's audience narrows accordingly. Neither spec blocks the other; whichever
lands second inherits the other's decision.

---

## 4. Testing

Vitest is added to `Schoolfrontend` with the standard Vite integration and a
`test` script. Tests cover the pure layer only — there is no component testing
harness here and this spec does not add one:

- `format.ts` — money formatting matches what the screen renders (a printed
  figure disagreeing with the screen is the worst failure this feature can
  produce), zero rendered as blank in ledger columns, date formatting.
- `filename.ts` — expected shape, and that a filter value containing a slash or
  space cannot produce a broken filename.
- Each document's row-mapping function — given a known input row set, the
  expected columns and ordering, including the empty case.

Not covered, and deliberately so: the visual layout of the generated PDF. No
assertion can tell you a report card looks like a report card. That is a manual
check, and it is the one thing a human must do before this ships — print one
trial balance and one report card on paper.

---

## 5. Out of scope

- Server-side PDF generation, and any scheduled or emailed document.
- The broader exams module (grading scales, results entry, exam timetables).
- Export on the other ~16 built pages. The shared layer makes each a small
  addition later; this spec proves the pattern on four.
- Repairing the multi-page print stylesheet. It is routed around, not fixed.
- Bulk report cards (a whole class in one PDF). Worth doing later; `autoTable`
  page breaks make it straightforward once one card is right.

## 6. Sequencing

1. **The shared layer** (`src/lib/pdf/`) plus vitest and its tests. Nothing else
   can be built first, and everything after it is an application of it.
2. **Trial Balance.** Simplest integration and the highest-value document —
   proves Print and Download against a real filtered page.
3. **Student Records and Teachers.** The same shape twice; one task.
4. **Fee Statement** migrated to the shared layer, and the print-CSS comment
   added.
5. **Report Cards.** New module, new page, new nav entry. Largest piece, last.

Steps 2, 3 and 4 are independent of each other once step 1 exists.
