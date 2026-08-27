# Frontend Documentation — School Management System

A React frontend for a Kenyan secondary school management system, built against the Hono/Postgres backend in the sibling `Accounts` project. Covers finance, students, admissions, academics, and attendance, with a role-based permission system that mirrors the backend's RBAC exactly.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React 19 + Vite 8 (Rolldown-based bundler) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + DaisyUI 5, single `light` theme (no dark mode) |
| State / data fetching | Redux Toolkit + RTK Query |
| Persistence | redux-persist (auth token + user survive a refresh) |
| Routing | react-router v8 (`createBrowserRouter`) |
| Forms | react-hook-form |
| Toasts / confirm dialogs | sonner / sweetalert2 |
| Icons | lucide-react |

Run locally: `pnpm install && pnpm dev` (serves on `http://localhost:5173`, expects the backend at `http://localhost:4100`). `pnpm build` typechecks (`tsc -b`) then produces a production bundle.

## Project structure

```
src/
  apiDomain/            API base URL + a shared authBaseQuery (attaches the JWT to every request)
  components/           Cross-cutting UI: Navbar, Footer, ComingSoon, AccessDenied, auth guards
  dashboardDesign/      Sidebar, DashboardLayout, navigation.ts (the nav/permission source of truth)
  store/                Redux store wiring (one RTK Query slice per module)
  types/                Types.ts — holds only ApiEnvelope<T>, the one truly shared type
  modules/               <- one folder per feature, see below
    auth/
    dashboard/
    finance/
    students/
    admissions/
    fees/
    teachers/
    subjects/
    attendance/
  App.tsx                Router — wires every real page + auto-generates "coming soon" placeholders
  main.tsx                Provider + PersistGate root
```

### The module folder pattern

Every feature lives in its own folder under `src/modules/`, holding everything specific to that domain:

```
modules/<feature>/
  <Feature>Api.ts     RTK Query slice — one createApi call, endpoints unwrap {success, data} via transformResponse
  types.ts            Domain types + "New<X>Values" payload types matching the backend's zod schemas
  <Feature>Page.tsx    The page component(s) — list + create modal is the default shape
```

Nothing domain-specific lives outside its module folder — `apiDomain/`, `components/`, `dashboardDesign/`, and `store/` are the only shared infrastructure, and they stay generic (no module ever imports another module's internals except where genuinely needed, e.g. Fees pulling class/student dropdowns from `students/StudentApi`).

## Routing & the "coming soon" mechanism

`dashboardDesign/navigation.ts` is the single source of truth for every nav item the system will ever have — all 42 backend modules have an entry, each with `{ name, path, icon, permission?, built? }`. `App.tsx` reads that list at startup:

- Items with `built: true` get routed to their real page component (hand-wired in `App.tsx`).
- Everything else is auto-generated into a `ComingSoon` placeholder route, permission-gated identically to how the real page eventually will be.

This means flipping a module from placeholder to real page is a two-line change: point the nav entry's path at the real component in `App.tsx`, and set `built: true` — no route-wiring rework.

**Routes built so far:**

| Path | Page | Required permission |
|---|---|---|
| `/login` | LoginPage | — (public) |
| `/dashboard` | DashboardPage | `dashboard.view` |
| `/dashboard/finance/accounts` | AccountsPage | `ledger.journal.view` |
| `/dashboard/finance/funds` | FundsPage | `ledger.journal.view` |
| `/dashboard/finance/trial-balance` | TrialBalancePage | `ledger.journal.view` |
| `/dashboard/finance/fees` | FeesPage | `fees.view` |
| `/dashboard/students` | StudentsPage | `students.view` |
| `/dashboard/admissions` | AdmissionsPage | `admissions.view` |
| `/dashboard/academic/teachers` | TeachersPage | `teachers.view` |
| `/dashboard/academic/subjects` | SubjectsPage | `subjects.view` |
| `/dashboard/academic/attendance` | AttendancePage | `attendance.view` |
| `/access-denied` | AccessDenied | — (any authenticated user) |

Everything else in `navigation.ts` (Budgets, Payroll, Boarding, Health, HR, Compliance, etc. — ~33 items) is a live `ComingSoon` placeholder today, already permission-gated and ready for a real page to be dropped in.

## Auth & permission enforcement

- **Login**: `POST /api/auth/login` returns a JWT + the user's `permissions: string[]`. Stored in Redux (`authSlice`) and persisted via `redux-persist`.
- **Every API call** goes through `authBaseQuery` (`apiDomain/authBaseQuery.ts`), which attaches `Authorization: Bearer <token>` automatically — no module has to think about this.
- **`PrivateRoute`** (`components/auth/PrivateRoute.tsx`) wraps every authenticated route. Two checks:
  1. Not logged in → redirect to `/login`.
  2. Logged in but missing the route's `requiredPermission` → redirect to **`/access-denied`**, not `/dashboard`. (Earlier this redirected to `/dashboard`, which itself requires `dashboard.view` — any role without that permission would infinite-loop. Fixed by giving denied access its own dead-end page.)
- **`PublicRoute`** wraps `/login` — an already-authenticated user gets bounced to `/dashboard` instead of seeing the login form again.
- **Sidebar** (`dashboardDesign/Sidebar.tsx`) filters `navigation.ts` by the current user's `permissions` — items with no `permission` set are always visible; everything else only appears if the user actually holds that permission. Unbuilt items get a "soon" badge.
- **Button-level gating**: every page with create/edit actions computes `const canManage = user?.permissions.includes('<module>.manage')` and conditionally renders the action (button, inline edit control) — matches the backend's own `.manage` vs `.view` split exactly, so what a user can *click* always matches what the backend will actually *allow*.

This mirrors the backend's RBAC catalog (94 permissions, 22 roles) 1:1 — see the backend documentation for the full permission list and role matrix.

## State management

One RTK Query slice per module (`<Feature>Api.ts`), each registered in `store/store.ts` with its own `reducerPath` and middleware. Pattern for every endpoint:

```ts
getAllStudents: builder.query<Student[], void>({
  query: () => 'students',
  transformResponse: (response: ApiEnvelope<Student[]>) => response.data,
  providesTags: ['Students'],
}),
```

`transformResponse` unwraps the backend's `{success, data}` envelope once, at the edge — every component downstream just sees the real data shape. Mutations `invalidatesTags` to trigger an automatic refetch of whatever query provided that tag; no manual cache-busting anywhere in the codebase.

`authSlice` (in `modules/auth/`) is the only plain (non-RTK-Query) slice — it just holds `{ isAuthenticated, token, user }`, and only its `token`/`isAuthenticated`/`user` fields are persisted.

## Design conventions

- **Page shape**: header (icon + title + primary action button) → filter/search row → data table or tabbed panels → modal(s) for create/edit. Established by the Finance pages and repeated everywhere since.
- **Status pills**: use plain Tailwind color utilities (`bg-green-600 text-white`), **not** DaisyUI `badge-*` classes, on any element that isn't a `<span class="badge">` — `badge-warning` etc. only take effect inside a real `.badge` element. Applying it to a `<select>` (tried once on the Teachers status dropdown) renders with no visible color at all. Static status displays (table cells, detail views) can use `badge badge-success` etc. safely.
- **Optional form fields → blank-to-undefined**: react-hook-form gives you `''` for an empty optional field, but the backend's zod schemas reject `''` for `.date()` and `.email()` (only `undefined` satisfies `.optional()`). Every page with optional date/email fields runs them through a small `blank = (v) => v ? v : undefined` helper before submitting.
- **Tabs** (Admissions' pathway picker, Fees' Structures/Invoices, Subjects' Subjects/Offerings/Assignments, Attendance's Register/History) use DaisyUI's `tabs tabs-boxed` with local `useState`, not routing — cheaper than real sub-routes for content that's really one page with two views.
- **Multi-step workflows** (Admissions' pending → interview → decide → enroll) render only the one action valid for the record's *current* status, computed inline from the record — never a fixed set of always-visible buttons.

## Modules built

- **auth** — login form, JWT + permission storage.
- **dashboard** — combined financial/enrollment/academic snapshot (stat cards, live data).
- **finance** — Chart of Accounts, Funds/Voteheads, Trial Balance (all read/write against the real double-entry ledger).
- **students** — student registry + class/stream management, class filter, search.
- **admissions** — all three intake pathways (government placement, inter-school transfer, direct application), full pending→interview→decision→enrollment lifecycle.
- **fees** — fee structures (dynamic votehead line items), invoices, payments; every invoice/payment write posts a real journal entry, verified against the Trial Balance.
- **teachers** — teacher registry with inline status changes (active/on leave/left).
- **subjects** — subjects + CBC competency strands (optional, per subject), class offerings, teacher assignments.
- **attendance** — daily class register (bulk mark, defaults to Present) + per-student history.

## Known gaps / next steps

- ~33 backend modules (Budgets, Payroll, Procurement, Boarding, Health, HR suite, Compliance, Timetable, Exams & Grading, Library, Clubs, etc.) have no frontend page yet — they render as permission-gated `ComingSoon` placeholders.
- No dedicated parent-portal UI exists yet (the `parent` role and its `portal.access` permission exist on the backend, but nothing in this frontend serves that experience).
- Large chunk-size warning on build (`vite` flags the single JS bundle >500KB) — not yet addressed with code-splitting; fine for current scope, worth revisiting once more modules are built.
