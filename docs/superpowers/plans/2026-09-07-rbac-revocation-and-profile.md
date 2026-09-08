# RBAC Revocation, Profile Capabilities & Nav Hiding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip `fees.invoice.manage` from the Accounts Clerk and make the removal stick in a live database, show every user what their role actually permits, and stop the sidebar offering links to pages that do not exist.

**Architecture:** Three independent slices of the same spec. The revocation adds a pure diff function (testable without a database) that `sync-rbac.ts` drives behind a `--prune` flag, plus a segregation rule so the conflict is reported if it ever returns. The profile card surfaces `module`/`description` columns that already exist in the `permissions` table, carried to the client on `/api/auth/me` as an additive field. The nav change is a two-line filter in the two components that read `navigation.ts`.

**Tech Stack:** Backend — TypeScript ESM (NodeNext), Hono, Drizzle ORM, Postgres, vitest. Frontend — React 19, react-router, Redux Toolkit + RTK Query, Tailwind + daisyUI, lucide-react.

**Spec:** [docs/superpowers/specs/2026-09-07-bursar-clerk-completion-design.md](../specs/2026-09-07-bursar-clerk-completion-design.md) — sections 1, 2 and 5. Sections 3 (Banking) and 4 (Reports) get their own plans.

## Global Constraints

- **Two separate git repositories.** `Accounts/` (backend) and `Schoolfrontend/` (frontend) each have their own `.git`. Commit in the repo you changed; never try to commit across both.
- **ESM with NodeNext in the backend:** every relative import carries a `.js` extension even though the file on disk is `.ts`. `import { ROLES } from '../modules/identity/rbac.js'`.
- **Tests live beside the code** as `src/**/*.test.ts` (see `vitest.config.ts`). Run with `pnpm test` from `Accounts/`.
- **Only pure logic is unit-tested in this repo.** There is no database test harness and this plan does not build one. Database-touching changes are verified by the exact manual commands given in their task.
- **`permissions: string[]` on the user object is load-bearing** — `PrivateRoute`, `Sidebar`, `useCan`, `GlobalSearchBar` and every page's inline check read it. Never change or remove it; only add alongside it.
- **The frontend has no test runner.** Frontend verification is manual, using the seeded demo users.
- **`Accounts/dist/` is tracked in git and IS the deploy artifact** — `package.json` `"start"` runs `node dist/index.js`, and `dist/` is not gitignored. Any task that changes backend source must finish with `pnpm build` and commit the rebuilt `dist/` as its own commit. Skipping it means the change compiles, tests green, review passes, and the running server still executes the old code.
- Package manager is **pnpm** in both repos.

---

## Task 1: Pure diff function for pruning stale role-permission mappings

`sync-rbac.ts` is additive-only, so removing a permission from `rbac.ts` leaves every existing grant in the database. This task builds the decision logic as a pure function so it can be tested without a database; Task 2 wires it to the script.

**Files:**
- Create: `Accounts/src/db/rbac-diff.ts`
- Test: `Accounts/src/db/rbac-diff.test.ts`

**Interfaces:**
- Consumes: `RoleDef` from `Accounts/src/modules/identity/rbac.ts` (already exported: `{ code, name, description, permissions: string[] }`).
- Produces: `RolePermissionPair` (`{ roleCode: string; permissionCode: string }`) and `mappingsToPrune(dbPairs: RolePermissionPair[], sourceRoles: RoleDef[]): RolePermissionPair[]`. Task 2 imports both.

- [ ] **Step 1: Write the failing test**

Create `Accounts/src/db/rbac-diff.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mappingsToPrune } from './rbac-diff.js'
import type { RoleDef } from '../modules/identity/rbac.js'

const role = (code: string, permissions: string[]): RoleDef => ({
  code,
  name: code,
  description: code,
  permissions,
})

describe('mappingsToPrune', () => {
  it('returns nothing when the database matches the source', () => {
    const db = [{ roleCode: 'accounts_clerk', permissionCode: 'fees.view' }]
    expect(mappingsToPrune(db, [role('accounts_clerk', ['fees.view'])])).toEqual([])
  })

  it('flags a mapping the source no longer declares', () => {
    const db = [
      { roleCode: 'accounts_clerk', permissionCode: 'fees.view' },
      { roleCode: 'accounts_clerk', permissionCode: 'fees.invoice.manage' },
    ]
    expect(mappingsToPrune(db, [role('accounts_clerk', ['fees.view'])])).toEqual([
      { roleCode: 'accounts_clerk', permissionCode: 'fees.invoice.manage' },
    ])
  })

  it('keeps a permission that another role still declares', () => {
    const db = [
      { roleCode: 'accounts_clerk', permissionCode: 'fees.invoice.manage' },
      { roleCode: 'bursar', permissionCode: 'fees.invoice.manage' },
    ]
    expect(
      mappingsToPrune(db, [role('accounts_clerk', ['fees.view']), role('bursar', ['fees.invoice.manage'])]),
    ).toEqual([{ roleCode: 'accounts_clerk', permissionCode: 'fees.invoice.manage' }])
  })

  it('flags every mapping of a role dropped from the source entirely', () => {
    const db = [{ roleCode: 'old_role', permissionCode: 'fees.view' }]
    expect(mappingsToPrune(db, [role('accounts_clerk', ['fees.view'])])).toEqual([
      { roleCode: 'old_role', permissionCode: 'fees.view' },
    ])
  })

  it('tolerates a permission listed twice in one role', () => {
    const db = [{ roleCode: 'bursar', permissionCode: 'fees.view' }]
    expect(mappingsToPrune(db, [role('bursar', ['fees.view', 'fees.view'])])).toEqual([])
  })

  it('returns nothing for an empty database', () => {
    expect(mappingsToPrune([], [role('bursar', ['fees.view'])])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd Accounts && pnpm test src/db/rbac-diff.test.ts
```

Expected: FAIL — `Failed to resolve import "./rbac-diff.js"`.

- [ ] **Step 3: Write the implementation**

Create `Accounts/src/db/rbac-diff.ts`:

```ts
import type { RoleDef } from '../modules/identity/rbac.js'

export interface RolePermissionPair {
  roleCode: string
  permissionCode: string
}

/**
 * Role-permission mappings present in the database but no longer declared in
 * rbac.ts. `db:sync-rbac` is additive-only, so removing a permission from a
 * role in source leaves the grant behind in every existing database — this is
 * what `--prune` deletes.
 *
 * Pure on purpose: the decision about what to delete is the part worth
 * testing, and keeping it out of the script means it needs no database.
 */
export function mappingsToPrune(
  dbPairs: RolePermissionPair[],
  sourceRoles: RoleDef[],
): RolePermissionPair[] {
  const declared = new Set<string>()
  for (const role of sourceRoles) {
    for (const permissionCode of role.permissions) {
      declared.add(`${role.code}|${permissionCode}`)
    }
  }

  return dbPairs.filter((pair) => !declared.has(`${pair.roleCode}|${pair.permissionCode}`))
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd Accounts && pnpm test src/db/rbac-diff.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd Accounts
git add src/db/rbac-diff.ts src/db/rbac-diff.test.ts
git commit -m "Add pure diff for stale role-permission mappings"
```

---

## Task 2: Wire `--prune` and `--dry-run` into `db:sync-rbac`

**Files:**
- Modify: `Accounts/src/db/sync-rbac.ts`

**Interfaces:**
- Consumes: `mappingsToPrune`, `RolePermissionPair` from Task 1.
- Produces: `pnpm db:sync-rbac --prune` and `pnpm db:sync-rbac --dry-run` as operator commands. Task 3 runs them.

**Scope limit — do not exceed it.** `--prune` deletes rows from `role_permissions` **only**. It must never delete from `permissions` or `roles`. Deleting a permission row cascades into `role_permissions` (see the schema's `onDelete: 'cascade'`), so a typo in `rbac.ts` would silently strip that permission from every role holding it. Orphan permission and role rows stay reported-but-not-deleted, exactly as `system.service.ts` already comments.

- [ ] **Step 1: Add the flag parsing and imports**

At the top of `Accounts/src/db/sync-rbac.ts`, after the existing imports, add:

```ts
import { and, eq } from 'drizzle-orm'
import { mappingsToPrune } from './rbac-diff.js'
```

The file already imports `eq, inArray` from `drizzle-orm` — merge rather than duplicate the import, so the line reads `import { and, eq, inArray } from 'drizzle-orm'`.

Then immediately before `async function sync() {`:

```ts
const args = process.argv.slice(2)
const PRUNE = args.includes('--prune')
const DRY_RUN = args.includes('--dry-run')
```

- [ ] **Step 2: Add the prune block**

In `sync-rbac.ts`, replace the final summary line and `process.exit(0)`:

```ts
  console.log(`\nDone. ${newPerms.length} new permissions, ${newRoles.length} new roles, ${addedMappings} new role-permission mappings.`)
  process.exit(0)
```

with:

```ts
  console.log(`\nAdditive pass done. ${newPerms.length} new permissions, ${newRoles.length} new roles, ${addedMappings} new role-permission mappings.`)

  if (PRUNE || DRY_RUN) {
    const dbPairs = await db
      .select({ roleCode: roles.code, permissionCode: permissions.code })
      .from(rolePermissions)
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))

    const stale = mappingsToPrune(dbPairs, ROLES)

    if (stale.length === 0) {
      console.log('\nNothing to prune — every mapping in the database is declared in rbac.ts.')
    } else {
      console.log(`\n${stale.length} stale role-permission mapping(s):`)
      for (const pair of stale) console.log(`  ${pair.roleCode} -> ${pair.permissionCode}`)

      if (DRY_RUN) {
        console.log('\n--dry-run: nothing deleted. Re-run with --prune to apply.')
      } else {
        for (const pair of stale) {
          const roleId = roleIdByCode.get(pair.roleCode)
          const permissionId = permIdByCode.get(pair.permissionCode)
          // A mapping whose role or permission is itself absent from rbac.ts
          // has no id to match on here; it stays behind and keeps showing up
          // in the System Health drift report, which is the intended
          // treatment for orphan roles/permissions.
          if (roleId === undefined || permissionId === undefined) continue
          await db
            .delete(rolePermissions)
            .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)))
        }
        console.log(`\nPruned ${stale.length} mapping(s).`)
      }
    }
  }

  process.exit(0)
```

Note `roleIdByCode` and `permIdByCode` already exist earlier in `sync()` and are in scope. `permissions`, `roles` and `rolePermissions` are already imported at the top of the file.

- [ ] **Step 3: Update the file's header comment**

Replace the existing comment block at the top of `sync-rbac.ts`:

```ts
// Additive-only sync: inserts any permission/role/role-permission-mapping
// defined in rbac.ts that isn't already in the database. Never removes or
// modifies an existing row, so it's always safe to re-run after editing
// rbac.ts — it only ever catches the DB up to what the source of truth says.
```

with:

```ts
// Syncs the database to the RBAC catalogue in rbac.ts.
//
// Default: additive only. Inserts any permission/role/role-permission-mapping
// defined in rbac.ts that isn't already in the database, and never removes or
// modifies an existing row — always safe to re-run.
//
//   --dry-run  Report stale role-permission mappings without deleting them.
//   --prune    Delete them. Revoking a permission means removing it from
//              rbac.ts AND running this, or every user who already holds it
//              keeps it.
//
// --prune touches `role_permissions` only. It never deletes `permissions` or
// `roles` rows: those cascade into role_permissions, so a typo in rbac.ts
// would silently strip a permission from every role holding it. Orphan
// permissions and roles stay reported-but-not-deleted by the System Health
// drift report.
```

- [ ] **Step 4: Verify it compiles**

```bash
cd Accounts && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Verify the default path is unchanged**

```bash
cd Accounts && pnpm db:sync-rbac
```

Expected: runs as before and ends with `Additive pass done. …`. No prune section printed.

- [ ] **Step 6: Commit**

```bash
cd Accounts
git add src/db/sync-rbac.ts
git commit -m "Add --prune and --dry-run to db:sync-rbac"
```

---

## Task 3: Revoke `fees.invoice.manage` from the Accounts Clerk

**Files:**
- Modify: `Accounts/src/modules/identity/rbac.ts` (the `accounts_clerk` role, around line 220)
- Modify: `Accounts/src/modules/system/system.service.ts` (`SEGREGATION_RULES`, line 19)
- Test: `Accounts/src/modules/identity/rbac.test.ts` (create)

**Interfaces:**
- Consumes: `pnpm db:sync-rbac --dry-run` / `--prune` from Task 2.
- Produces: nothing other tasks import.

**A consequence to be explicit about.** The Bursar holds both `fees.receipt.create` and `fees.invoice.manage` deliberately — they cover the counter when the clerk is away. Adding the new segregation rule therefore flags the **Bursar** as a segregation conflict on the System Health page, and the Bursar currently trips none of the five existing rules. That flag is factually correct: one person who can both raise an invoice and receipt against it can conceal a shortfall, which is precisely what an auditor would note. The test below locks in that exact outcome — clerk clean, bursar flagged — so it is a recorded decision rather than a surprise.

- [ ] **Step 1: Write the failing test**

Create `Accounts/src/modules/identity/rbac.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ROLES } from './rbac.js'

const permissionsOf = (code: string) => {
  const role = ROLES.find((r) => r.code === code)
  if (!role) throw new Error(`No such role: ${code}`)
  return role.permissions
}

describe('accounts_clerk', () => {
  // The clerk takes the cash. If they can also raise or adjust the invoice it
  // is receipted against, they can write the invoice down to match what they
  // banked — the standard way school fee fraud is concealed.
  it('cannot raise or adjust invoices', () => {
    expect(permissionsOf('accounts_clerk')).not.toContain('fees.invoice.manage')
  })

  it('can still receipt payments and read the invoices to receipt against', () => {
    expect(permissionsOf('accounts_clerk')).toContain('fees.receipt.create')
    expect(permissionsOf('accounts_clerk')).toContain('fees.view')
  })

  it('is limited to the counter', () => {
    expect(permissionsOf('accounts_clerk').sort()).toEqual(
      ['dashboard.view', 'fees.receipt.create', 'fees.view', 'students.view'].sort(),
    )
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd Accounts && pnpm test src/modules/identity/rbac.test.ts
```

Expected: FAIL — the first test reports the array **does** contain `fees.invoice.manage`.

- [ ] **Step 3: Remove the permission**

In `Accounts/src/modules/identity/rbac.ts`, find the `accounts_clerk` role and change:

```ts
    permissions: ['fees.receipt.create', 'fees.view', 'fees.invoice.manage', 'students.view', 'dashboard.view'],
```

to:

```ts
    // Receipting only. `fees.invoice.manage` is deliberately absent: whoever
    // takes the cash must not also be able to write the invoice down to match
    // it. The Bursar raises all invoices.
    permissions: ['fees.receipt.create', 'fees.view', 'students.view', 'dashboard.view'],
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd Accounts && pnpm test src/modules/identity/rbac.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Add the segregation rule**

In `Accounts/src/modules/system/system.service.ts`, append to `SEGREGATION_RULES` (currently five entries ending with the payroll rule):

```ts
  { rule: 'Receipts payments and raises the invoices they are receipted against', permissions: ['fees.receipt.create', 'fees.invoice.manage'] },
```

- [ ] **Step 6: Add the test that locks in who this flags**

Append to `Accounts/src/modules/identity/rbac.test.ts`:

```ts
describe('fees segregation of duties', () => {
  const holdsBoth = (code: string) => {
    const p = permissionsOf(code)
    return p.includes('fees.receipt.create') && p.includes('fees.invoice.manage')
  }

  it('does not flag the clerk', () => {
    expect(holdsBoth('accounts_clerk')).toBe(false)
  })

  // Accepted and deliberate: the Bursar covers the counter when the clerk is
  // away, so they hold both halves. System Health reports it because it is a
  // real control weakness a school should be able to see, not because it is a
  // mistake to fix by narrowing the Bursar.
  it('flags the bursar, who legitimately holds both', () => {
    expect(holdsBoth('bursar')).toBe(true)
  })
})
```

- [ ] **Step 7: Run the whole backend suite**

```bash
cd Accounts && pnpm test
```

Expected: PASS. `rbac-diff.test.ts`, `rbac.test.ts` and the pre-existing `fees.calculations.test.ts` all green.

- [ ] **Step 8: Preview the revocation against the real database**

```bash
cd Accounts && pnpm db:sync-rbac --dry-run
```

Expected output includes:

```
1 stale role-permission mapping(s):
  accounts_clerk -> fees.invoice.manage

--dry-run: nothing deleted. Re-run with --prune to apply.
```

If more mappings than that are listed, **stop and read them** before pruning — anything beyond this one line is pre-existing drift that was not part of this change, and deleting it is a separate decision.

- [ ] **Step 9: Apply it**

```bash
cd Accounts && pnpm db:sync-rbac --prune
```

Expected: `Pruned 1 mapping(s).`

- [ ] **Step 10: Confirm the clerk actually lost it**

```bash
cd Accounts && pnpm db:sync-rbac --dry-run
```

Expected: `Nothing to prune — every mapping in the database is declared in rbac.ts.`

- [ ] **Step 11: Commit**

```bash
cd Accounts
git add src/modules/identity/rbac.ts src/modules/identity/rbac.test.ts src/modules/system/system.service.ts
git commit -m "Revoke fees.invoice.manage from the Accounts Clerk"
```

---

## Task 4: Carry permission descriptions to the client on `/api/auth/me`

The `permissions` table already stores `module` and `description` for every code, seeded from `PERMISSIONS` in `rbac.ts`. This task surfaces them; Task 5 renders them.

**Files:**
- Modify: `Accounts/src/modules/auth/auth.repository.ts` (`findRolesAndPermissions`, lines 12-30)
- Modify: `Accounts/src/modules/auth/auth.types.ts` (`AuthenticatedUser`, lines 1-12)

**Interfaces:**
- Produces: `AuthenticatedUser.permissionDetails: { code: string; module: string; description: string }[]`, returned by both `login` and `me`. Task 5 consumes it.

**Do not touch `permissions: string[]`.** It is read by `PrivateRoute`, `Sidebar`, `useCan`, `GlobalSearchBar` and every page's inline gate. This change is purely additive.

- [ ] **Step 1: Widen the repository query**

In `Accounts/src/modules/auth/auth.repository.ts`, change the `permissionRows` select from:

```ts
    const permissionRows = await db
      .select({ code: permissions.code })
      .from(userRoles)
```

to:

```ts
    const permissionRows = await db
      .select({ code: permissions.code, module: permissions.module, description: permissions.description })
      .from(userRoles)
```

- [ ] **Step 2: Return the detail array alongside the codes**

In the same function, change the return from:

```ts
    return {
      roles: roleRows.map((r) => r.code),
      permissions: [...new Set(permissionRows.map((p) => p.code))],
    }
```

to:

```ts
    // A user holding two roles that share a permission gets the row twice;
    // dedupe on code so both the string list and the detail list carry one
    // entry per permission.
    const byCode = new Map(permissionRows.map((p) => [p.code, p]))

    return {
      roles: roleRows.map((r) => r.code),
      permissions: [...byCode.keys()],
      permissionDetails: [...byCode.values()],
    }
```

- [ ] **Step 3: Extend the type**

In `Accounts/src/modules/auth/auth.types.ts`, add to `AuthenticatedUser` after `permissions: string[]`:

```ts
  permissionDetails: { code: string; module: string; description: string }[]
```

- [ ] **Step 4: Verify it compiles and fix any fallout**

```bash
cd Accounts && pnpm build
```

Expected: no errors. `auth.service.ts` spreads the repository result into both the login response and `me()`, so no change should be needed there — if the compiler says otherwise, add `permissionDetails` wherever it names the fields explicitly.

- [ ] **Step 5: Verify the live response**

Start the server (`cd Accounts && pnpm dev`), then in another terminal log in as the clerk and read the payload:

```bash
curl -s -X POST http://localhost:4100/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"accounts.clerk@school.local","password":"ChangeMe123!"}'
```

All demo accounts share that password unless `SEED_ADMIN_PASSWORD` was set when
`pnpm db:seed-demo-users` last ran (see `seed-demo-users.ts:33`); the script
prints the password it used on its final line.

Expected: `user.permissionDetails` is present with exactly four entries, and `user.permissions` still lists the same four codes as plain strings. Confirm `fees.invoice.manage` appears in neither — this is the end-to-end proof that Task 3 landed.

- [ ] **Step 6: Commit**

```bash
cd Accounts
git add src/modules/auth/auth.repository.ts src/modules/auth/auth.types.ts
git commit -m "Return permission descriptions from /api/auth/me"
```

---

## Task 5: "What you can do" card on the Profile page

**Files:**
- Modify: `Schoolfrontend/src/modules/auth/types.ts` (`AuthenticatedUser`, lines 6-18)
- Create: `Schoolfrontend/src/modules/profile/CapabilityCard.tsx`
- Modify: `Schoolfrontend/src/modules/profile/ProfilePage.tsx`

**Interfaces:**
- Consumes: `permissionDetails` from Task 4.
- Produces: `CapabilityCard`, default export, props `{ permissions: PermissionDetail[] }`.

- [ ] **Step 1: Extend the frontend type**

In `Schoolfrontend/src/modules/auth/types.ts`, add above `AuthenticatedUser`:

```ts
export interface PermissionDetail {
  code: string
  module: string
  description: string
}
```

and add to `AuthenticatedUser` after `permissions: string[]`:

```ts
  /** Same grants as `permissions`, with the module and human-readable
   *  description each code carries in the backend's RBAC catalogue.
   *  Optional because a token issued before this field existed will not
   *  have it. */
  permissionDetails?: PermissionDetail[]
```

- [ ] **Step 2: Create the card**

Create `Schoolfrontend/src/modules/profile/CapabilityCard.tsx`:

```tsx
import React from 'react'
import { ShieldCheck } from 'lucide-react'
import type { PermissionDetail } from '../auth/types'

// Module codes are the backend's RBAC grouping (see rbac.ts). Anything not
// listed falls back to a title-cased version of the code itself, so a new
// backend module shows up sensibly here without a frontend change.
const MODULE_LABELS: Record<string, string> = {
  identity: 'Users & Roles',
  ledger: 'Ledger',
  budget: 'Budgets',
  fees: 'Fees',
  grants: 'Grants & Capitation',
  procurement: 'Procurement',
  payroll: 'Payroll',
  assets: 'Fixed Assets',
  inventory: 'Inventory',
  banking: 'Banking',
  reports: 'Reports',
  audit: 'Audit',
  communication: 'Communication',
  hr: 'HR',
  admissions: 'Admissions',
  academic_records: 'Student Records',
  exams: 'Exams',
  student_discipline: 'Student Conduct',
  welfare: 'Welfare & Facilities',
  academic_ops: 'Academic Operations',
  compliance: 'Compliance',
}

const labelFor = (module: string) =>
  MODULE_LABELS[module] ??
  module.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const CapabilityCard: React.FC<{ permissions: PermissionDetail[] }> = ({ permissions }) => {
  const grouped = permissions.reduce<Record<string, PermissionDetail[]>>((acc, p) => {
    ;(acc[p.module] ??= []).push(p)
    return acc
  }, {})

  const modules = Object.keys(grouped).sort((a, b) => labelFor(a).localeCompare(labelFor(b)))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
        <ShieldCheck className="text-green-800" size={20} />
        <h2 className="text-lg font-bold text-gray-800">What You Can Do</h2>
        <span className="ml-auto text-xs text-gray-400">
          {permissions.length} {permissions.length === 1 ? 'capability' : 'capabilities'}
        </span>
      </div>

      {permissions.length === 0 ? (
        <p className="text-sm text-gray-500">
          No permissions are assigned to your account yet. Ask an administrator to assign you a role.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {modules.map((module) => (
            <div key={module}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {labelFor(module)}
              </h3>
              <ul className="space-y-1.5">
                {grouped[module].map((p) => (
                  <li key={p.code} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-green-700 mt-0.5 shrink-0">&bull;</span>
                    <span>{p.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CapabilityCard
```

- [ ] **Step 3: Render it on the profile page**

In `Schoolfrontend/src/modules/profile/ProfilePage.tsx`, add the import beside the other local imports:

```tsx
import CapabilityCard from './CapabilityCard'
```

Then find the left column's closing tags — the `Personal Details Form` card is the only child of `<div className="lg:col-span-2 space-y-6">`. Immediately after that form card's closing `</div>` and before the closing `</div>` of the column, insert:

```tsx
            <CapabilityCard permissions={activeUser?.permissionDetails ?? []} />
```

`activeUser` is already defined above the `return` as `profile || currentUser`.

- [ ] **Step 4: Verify as the clerk**

```bash
cd Schoolfrontend && pnpm dev
```

Log in as `accounts.clerk@school.local` and open `/dashboard/profile`.

Expected: a "What You Can Do" card reading 4 capabilities, grouped as Fees ("Receipt fee payments from parents", "View student fee ledgers/statements"), Student Records ("View student records") and Compliance ("View the combined financial/enrollment/academic dashboard"). **"Raise/adjust student fee invoices" must not appear.**

- [ ] **Step 5: Verify as the Bursar**

Log out, log in as `bursar@school.local`, open `/dashboard/profile`.

Expected: roughly 30 capabilities across Ledger, Budgets, Fees, Grants, Procurement, Payroll, Fixed Assets, Inventory, Banking, Reports, Communication, Student Records and Compliance.

- [ ] **Step 6: Commit**

```bash
cd Schoolfrontend
git add src/modules/auth/types.ts src/modules/profile/CapabilityCard.tsx src/modules/profile/ProfilePage.tsx
git commit -m "Show what a user's role permits on their profile"
```

---

## Task 6: Stop offering links to pages that do not exist

22 nav entries have no page and route to a `ComingSoon` placeholder. Both components that read `navigation.ts` must filter, or the search bar keeps surfacing what the sidebar now hides.

**Files:**
- Modify: `Schoolfrontend/src/dashboardDesign/Sidebar.tsx` (line 32)
- Modify: `Schoolfrontend/src/components/GlobalSearchBar.tsx` (line 83)
- Modify: `Schoolfrontend/src/dashboardDesign/navigation.ts` (the comment at line 27-29)

**Leave `App.tsx` alone.** It generates placeholder routes from `!item.built`, and it has **no catch-all route**. Removing those routes would render a blank white page for any bookmarked or typed URL under an unbuilt module. They become unreachable from the UI and stay as the fallback that explains itself.

**Leave the unbuilt entries in `navigation.ts`.** They are the map of the RBAC catalogue to the UI, and flipping `built: true` stays the single action that ships a page — that is how Notifications comes back when bulk messaging is built.

- [ ] **Step 1: Filter the sidebar**

In `Schoolfrontend/src/dashboardDesign/Sidebar.tsx`, change:

```tsx
                    const visibleItems = section.items.filter((item) => canSee(item.permission))
```

to:

```tsx
                    // `built` gates alongside the permission: an item whose page
                    // does not exist yet is not a link worth offering. Its route
                    // still resolves to a placeholder if someone has the URL.
                    const visibleItems = section.items.filter((item) => item.built && canSee(item.permission))
```

- [ ] **Step 2: Filter global search**

In `Schoolfrontend/src/components/GlobalSearchBar.tsx`, change:

```tsx
        // User must have permission for this page
        if (!item.permission || permissions.includes(item.permission)) {
```

to:

```tsx
        // Same rule as the sidebar: the user needs the permission, and the
        // page has to exist. Without the `built` check, search would keep
        // offering pages the sidebar no longer lists.
        if (item.built && (!item.permission || permissions.includes(item.permission))) {
```

- [ ] **Step 3: Correct the now-false comment**

In `Schoolfrontend/src/dashboardDesign/navigation.ts`, replace:

```ts
// Mirrors the backend's module grouping 1:1 (see project-documentation/09-rbac.md)
// so every permission the RBAC system defines has a home in the UI, even
// before the page behind it is built.
```

with:

```ts
// Mirrors the backend's module grouping 1:1 (see project-documentation/09-rbac.md),
// so this file is the map of the RBAC catalogue onto the UI — including entries
// whose page does not exist yet.
//
// Only entries with `built: true` are rendered, by the sidebar and by global
// search alike. An unbuilt entry is a placeholder for work not yet done, not a
// link: shipping its page means writing the page and flipping that one flag.
```

- [ ] **Step 4: Verify as the Bursar**

```bash
cd Schoolfrontend && pnpm dev
```

Log in as `bursar@school.local`.

Expected: the Communication section is gone from the sidebar entirely (its only two entries, Notices and Notifications, are unbuilt or not permitted). Banking disappears too for now, and returns when the Banking plan builds its page and flips `built: true`. Every remaining link opens a real page; none reaches the "Coming Soon" screen. Typing "notif" in the global search returns no page result.

- [ ] **Step 5: Verify the placeholder fallback still works**

With the Bursar still logged in, navigate directly to `http://localhost:5173/dashboard/communication/notifications`.

Expected: the "Coming Soon" placeholder renders — **not** a blank white page. This is the behaviour that justifies keeping the generated routes.

- [ ] **Step 6: Commit**

```bash
cd Schoolfrontend
git add src/dashboardDesign/Sidebar.tsx src/components/GlobalSearchBar.tsx src/dashboardDesign/navigation.ts
git commit -m "Render only nav entries whose page exists"
```

---

## Done when

- `pnpm test` in `Accounts/` passes, including the new `rbac-diff.test.ts` and `rbac.test.ts`.
- `pnpm db:sync-rbac --dry-run` reports nothing to prune.
- The Accounts Clerk has no New Invoice control anywhere in the UI, and can still receipt from the Fee Counter.
- Both demo users see an accurate "What You Can Do" card.
- No sidebar or search result leads to a "Coming Soon" screen, but a directly typed URL still reaches one.
- System Health reports the fees segregation conflict for the Bursar and not for the Clerk.
