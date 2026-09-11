# Per-User Permission Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin grant or revoke a single permission for a single user, layered on top of role-derived permissions.

**Architecture:** A `user_permission_overrides` table holds one row per (user, permission) carrying a `granted` boolean; absence means the role decides. Permission resolution merges role grants with overrides on every request — `attachUser` already re-reads from the database per request, so changes take effect on the user's next click. A last-administrator guard blocks any change that would leave nobody holding `users.manage`.

**Tech Stack:** Backend — Hono, Drizzle ORM, PostgreSQL, Zod, Vitest (added here). Frontend — React 19, RTK Query, Tailwind 4 + daisyUI.

**Spec:** `docs/superpowers/specs/2026-09-11-user-permission-overrides-design.md`

## Global Constraints

- **Two repos.** Backend paths are relative to `Accounts/`, frontend paths to `Schoolfrontend/`. Both use `pnpm`.
- **Backend is ESM with `module: NodeNext`.** Every relative import in `src/` must carry a `.js` extension, e.g. `import { x } from './permissionRules.js'` — even though the file on disk is `.ts`. Follow this exactly; the build fails otherwise.
- **`rbac.ts` stays the source of truth for roles.** No task edits `role_permissions` from application code. Overrides are per-user only.
- **Permission code for the guard is `users.manage`** — exact string.
- **Merge rule, verbatim from the spec:** `effective = (role permissions ∪ granted) \ revoked`. Revoke beats a role grant.
- **`source` labelling, verbatim from the spec:** an override always wins the label. `'role'` means precisely "no override row exists" — even for a permission the user does not hold.
- **Audit actions:** `permission.grant`, `permission.revoke`, `permission.reset`. Entity type `'user'`, entity id is the affected user.
- **Frontend has no test framework** and none is added. Frontend tasks verify with `pnpm build` and `pnpm lint`.

---

### Task 1: Vitest and the pure permission rules

Pure functions with no database access, so they can be tested directly. This task also stands up Vitest, which nothing in the repo has yet.

**Files:**
- Create: `Accounts/src/common/permissionRules.ts`
- Create: `Accounts/src/common/permissionRules.test.ts`
- Create: `Accounts/vitest.config.ts`
- Modify: `Accounts/package.json` (add `vitest` devDependency and `test` script)
- Modify: `Accounts/tsconfig.json` (exclude test files from the production build)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `mergePermissions(rolePermissions: string[], overrides: { code: string; granted: boolean }[]): string[]`
  - `interface AdministratorCandidate { userId: number; status: string; hasViaRole: boolean; override: boolean | null }`
  - `administratorIds(candidates: AdministratorCandidate[]): number[]`
  - `wouldRemoveLastAdministrator(holderIds: number[], targetUserId: number): boolean`

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
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    // Source files import siblings as './x.js' because the build targets
    // NodeNext ESM. Vite would look for a literal x.js and fail, so strip the
    // extension and let it resolve x.ts.
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }],
  },
})
```

- [ ] **Step 3: Add the test script**

In `Accounts/package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
```

- [ ] **Step 4: Keep tests out of the production build**

In `Accounts/tsconfig.json`, change the `exclude` array to:

```json
  "exclude": ["node_modules", "drizzle.config.ts", "drizzle", "vitest.config.ts", "src/**/*.test.ts"]
```

Without this, `pnpm build` compiles test files into `dist/`.

- [ ] **Step 5: Write the failing tests**

Create `Accounts/src/common/permissionRules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mergePermissions, administratorIds, wouldRemoveLastAdministrator } from './permissionRules.js'

describe('mergePermissions', () => {
  it('keeps a role permission when there is no override', () => {
    expect(mergePermissions(['fees.view'], [])).toEqual(['fees.view'])
  })

  it('returns the role set unchanged for an empty override list', () => {
    const roles = ['fees.view', 'students.view']
    expect(mergePermissions(roles, []).sort()).toEqual(['fees.view', 'students.view'])
  })

  it('adds a permission no role grants', () => {
    const result = mergePermissions(['fees.view'], [{ code: 'reports.export', granted: true }])
    expect(result.sort()).toEqual(['fees.view', 'reports.export'])
  })

  it('removes a permission a role grants', () => {
    const result = mergePermissions(['fees.view', 'payroll.process'], [{ code: 'payroll.process', granted: false }])
    expect(result).toEqual(['fees.view'])
  })

  it('de-duplicates permissions granted by two roles', () => {
    expect(mergePermissions(['fees.view', 'fees.view'], [])).toEqual(['fees.view'])
  })
})

describe('administratorIds', () => {
  it('counts a holder whose permission comes from a role', () => {
    expect(administratorIds([
      { userId: 1, status: 'active', hasViaRole: true, override: null },
    ])).toEqual([1])
  })

  it('counts a holder whose permission comes from a granted override', () => {
    expect(administratorIds([
      { userId: 2, status: 'active', hasViaRole: false, override: true },
    ])).toEqual([2])
  })

  it('does not count a user whose permission is revoked by an override', () => {
    expect(administratorIds([
      { userId: 3, status: 'active', hasViaRole: true, override: false },
    ])).toEqual([])
  })

  it('does not count an inactive user', () => {
    expect(administratorIds([
      { userId: 4, status: 'suspended', hasViaRole: true, override: null },
    ])).toEqual([])
  })
})

describe('wouldRemoveLastAdministrator', () => {
  it('rejects taking the permission from the only holder', () => {
    expect(wouldRemoveLastAdministrator([7], 7)).toBe(true)
  })

  it('allows taking it from one of two holders', () => {
    expect(wouldRemoveLastAdministrator([7, 8], 7)).toBe(false)
  })

  it('reports true when nobody holds it at all', () => {
    expect(wouldRemoveLastAdministrator([], 7)).toBe(true)
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd Accounts && pnpm test`
Expected: FAIL — cannot resolve `./permissionRules.js`.

- [ ] **Step 7: Write the implementation**

Create `Accounts/src/common/permissionRules.ts`:

```ts
/**
 * Pure permission arithmetic, deliberately free of database access so the
 * rules can be tested directly. The queries that feed these functions live in
 * auth.repository.ts and identity.repository.ts.
 */

/**
 * Effective permission codes: role grants, plus explicit grants, minus
 * explicit revokes. A revoke beats a role grant — an admin who explicitly
 * takes a permission away expects it gone whatever the user's roles say.
 */
export function mergePermissions(
  rolePermissions: string[],
  overrides: { code: string; granted: boolean }[],
): string[] {
  const effective = new Set(rolePermissions)
  for (const override of overrides) {
    if (override.granted) effective.add(override.code)
    else effective.delete(override.code)
  }
  return [...effective]
}

export interface AdministratorCandidate {
  userId: number
  status: string
  hasViaRole: boolean
  /** null means no override row — the role decides. */
  override: boolean | null
}

/** Active users who effectively hold the administrator permission. */
export function administratorIds(candidates: AdministratorCandidate[]): number[] {
  return candidates
    .filter((c) => c.status === 'active')
    .filter((c) => (c.override === null ? c.hasViaRole : c.override))
    .map((c) => c.userId)
}

/**
 * True when taking the permission away from targetUserId would leave nobody
 * holding it — the lockout this guard exists to prevent.
 */
export function wouldRemoveLastAdministrator(holderIds: number[], targetUserId: number): boolean {
  return holderIds.filter((id) => id !== targetUserId).length === 0
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd Accounts && pnpm test`
Expected: PASS — 12 tests.

- [ ] **Step 9: Verify the build still works**

Run: `cd Accounts && pnpm build`
Expected: succeeds, and `dist/common/permissionRules.test.js` does **not** exist.

- [ ] **Step 10: Commit**

```bash
cd Accounts
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts src/common/permissionRules.ts src/common/permissionRules.test.ts
git commit -m "Add pure permission-merge rules and a Vitest harness"
```

---

### Task 2: Schema and migration

**Files:**
- Modify: `Accounts/src/db/schema/identity.ts`
- Create: `Accounts/drizzle/0010_*.sql` (generated, exact name chosen by drizzle-kit)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `userPermissionOverrides` table export, re-exported by `src/db/schema/index.ts` via its existing `export * from './identity.js'`.

- [ ] **Step 1: Add the table**

Append to `Accounts/src/db/schema/identity.ts`, after the `userRoles` definition:

```ts
// Per-user exceptions layered on top of role-derived permissions. A row's
// absence means "the role decides", which is the default for every
// permission — so this table holds only genuine exceptions and stays small.
// The composite primary key makes it structurally impossible for a permission
// to be both granted and revoked for the same user.
export const userPermissionOverrides = pgTable('user_permission_overrides', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  granted: boolean('granted').notNull(),
  assignedBy: integer('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.permissionId] })])
```

Every identifier used here (`pgTable`, `integer`, `boolean`, `timestamp`, `primaryKey`) is already imported at the top of the file. Do not add imports.

- [ ] **Step 2: Generate the migration**

Run: `cd Accounts && pnpm db:generate`
Expected: a new file `drizzle/0010_<random-name>.sql`.

- [ ] **Step 3: Read the generated SQL before applying it**

Run: `cat Accounts/drizzle/0010_*.sql`

Confirm it contains `CREATE TABLE "user_permission_overrides"` with a composite primary key on `(user_id, permission_id)` and two foreign keys with `ON DELETE cascade`. Confirm it contains **no** `DROP` or `ALTER ... DROP COLUMN` statements — this migration must be purely additive. If it does, stop and report rather than applying it.

- [ ] **Step 4: Apply the migration**

Run: `cd Accounts && pnpm db:migrate`
Expected: applies cleanly.

- [ ] **Step 5: Verify the build**

Run: `cd Accounts && pnpm build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
cd Accounts
git add src/db/schema/identity.ts drizzle/
git commit -m "Add user_permission_overrides table"
```

---

### Task 3: Apply overrides in permission resolution

This is what makes overrides real: the function every authenticated request calls.

**Files:**
- Modify: `Accounts/src/modules/auth/auth.repository.ts`

**Interfaces:**
- Consumes: `mergePermissions` from Task 1; `userPermissionOverrides` from Task 2.
- Produces: `findRolesAndPermissions(userId)` returns the same `{ roles, permissions }` shape as before, with `permissions` now the effective set.

- [ ] **Step 1: Extend the imports**

In `Accounts/src/modules/auth/auth.repository.ts`, change the schema import to include the new table and add the rules import:

```ts
import { permissions, rolePermissions, roles, userPermissionOverrides, userRoles, users } from '../../db/schema/index.js'
import { mergePermissions } from '../../common/permissionRules.js'
```

- [ ] **Step 2: Apply the merge**

Replace the body of `findRolesAndPermissions` (currently at line 12) with:

```ts
  async findRolesAndPermissions(userId: number) {
    const roleRows = await db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId))

    const permissionRows = await db
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId))

    // Per-user exceptions. This is the third query on a path that runs for
    // every authenticated request; acceptable at school scale, and caching is
    // deliberately avoided because per-request resolution is what lets a
    // permission change take effect without re-login.
    const overrideRows = await db
      .select({ code: permissions.code, granted: userPermissionOverrides.granted })
      .from(userPermissionOverrides)
      .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
      .where(eq(userPermissionOverrides.userId, userId))

    return {
      roles: roleRows.map((r) => r.code),
      permissions: mergePermissions(permissionRows.map((p) => p.code), overrideRows),
    }
  },
```

`mergePermissions` de-duplicates internally, so the previous `[...new Set(...)]` is no longer needed.

- [ ] **Step 3: Verify the build and tests**

Run: `cd Accounts && pnpm build && pnpm test`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
cd Accounts
git add src/modules/auth/auth.repository.ts
git commit -m "Apply per-user permission overrides during resolution"
```

---

### Task 4: Repository queries for overrides

**Files:**
- Modify: `Accounts/src/modules/identity/identity.repository.ts`

**Interfaces:**
- Consumes: `userPermissionOverrides` from Task 2; `AdministratorCandidate` from Task 1.
- Produces, all on the exported `identityRepository` object:
  - `findPermissionByCode(code: string): Promise<{ id: number; code: string; module: string; description: string } | undefined>`
  - `findOverridesForUser(userId: number): Promise<{ code: string; granted: boolean }[]>`
  - `upsertOverride(userId: number, permissionId: number, granted: boolean, assignedBy: number): Promise<unknown>`
  - `deleteOverride(userId: number, permissionId: number): Promise<unknown>`
  - `findAdministratorCandidates(permissionCode: string): Promise<AdministratorCandidate[]>`

- [ ] **Step 1: Extend the imports**

At the top of `Accounts/src/modules/identity/identity.repository.ts`, ensure `and` is imported from `drizzle-orm` and `userPermissionOverrides` from the schema. If the existing import lines already bring in `eq` and the other tables, add to them rather than duplicating:

```ts
import { and, eq } from 'drizzle-orm'
import { permissions, rolePermissions, userPermissionOverrides, userRoles, users } from '../../db/schema/index.js'
import type { AdministratorCandidate } from '../../common/permissionRules.js'
```

- [ ] **Step 2: Add the query methods**

Add these to the `identityRepository` object, after `findPermissionsForRole`:

```ts
  findPermissionByCode: (code: string) =>
    db.select().from(permissions).where(eq(permissions.code, code)).then((rows) => rows[0]),

  findOverridesForUser: (userId: number) =>
    db
      .select({ code: permissions.code, granted: userPermissionOverrides.granted })
      .from(userPermissionOverrides)
      .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
      .where(eq(userPermissionOverrides.userId, userId)),

  upsertOverride: (userId: number, permissionId: number, granted: boolean, assignedBy: number) =>
    db
      .insert(userPermissionOverrides)
      .values({ userId, permissionId, granted, assignedBy })
      .onConflictDoUpdate({
        target: [userPermissionOverrides.userId, userPermissionOverrides.permissionId],
        set: { granted, assignedBy, assignedAt: new Date() },
      }),

  deleteOverride: (userId: number, permissionId: number) =>
    db
      .delete(userPermissionOverrides)
      .where(and(
        eq(userPermissionOverrides.userId, userId),
        eq(userPermissionOverrides.permissionId, permissionId),
      )),

  /**
   * Every user with the raw material the guard needs: whether a role grants
   * the permission, and whether an override overrules that. Assembled in three
   * simple queries rather than one clever join — this runs only on the guard
   * path, not per request.
   */
  async findAdministratorCandidates(permissionCode: string): Promise<AdministratorCandidate[]> {
    const allUsers = await db.select({ userId: users.id, status: users.status }).from(users)

    const viaRole = await db
      .selectDistinct({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(permissions.code, permissionCode))

    const overrides = await db
      .select({ userId: userPermissionOverrides.userId, granted: userPermissionOverrides.granted })
      .from(userPermissionOverrides)
      .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
      .where(eq(permissions.code, permissionCode))

    const roleHolders = new Set(viaRole.map((r) => r.userId))
    const overrideByUser = new Map(overrides.map((o) => [o.userId, o.granted]))

    return allUsers.map((u) => ({
      userId: u.userId,
      status: u.status as string,
      hasViaRole: roleHolders.has(u.userId),
      override: overrideByUser.get(u.userId) ?? null,
    }))
  },
```

- [ ] **Step 3: Verify the build**

Run: `cd Accounts && pnpm build`
Expected: succeeds. If TypeScript reports a duplicate import, merge the new names into the existing import line rather than adding a second one.

- [ ] **Step 4: Commit**

```bash
cd Accounts
git add src/modules/identity/identity.repository.ts
git commit -m "Add repository queries for permission overrides"
```

---

### Task 5: Service layer and the last-administrator guard

**Files:**
- Modify: `Accounts/src/modules/identity/identity.service.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 and 4.
- Produces, on `identityService`:
  - `listUserPermissions(userId: number): Promise<UserPermissionView[]>` where
    `UserPermissionView = { id: number; code: string; module: string; description: string; source: 'role' | 'granted' | 'revoked'; effective: boolean }`
  - `setPermissionOverride(userId: number, code: string, granted: boolean, actorUserId: number): Promise<UserPermissionView[]>`
  - `clearPermissionOverride(userId: number, code: string, actorUserId: number): Promise<UserPermissionView[]>`

- [ ] **Step 1: Extend the imports**

At the top of `Accounts/src/modules/identity/identity.service.ts`, add to the existing error import and add the rules import:

```ts
import { NotFoundError, ValidationError } from '../../common/errors.js'
import { administratorIds, wouldRemoveLastAdministrator } from '../../common/permissionRules.js'
```

(`NotFoundError` and `ValidationError` are already imported; keep the line as one import.)

- [ ] **Step 2: Add the constant and the view type**

Above the `identityService` object:

```ts
// The permission whose disappearance locks everyone out of user administration.
const ADMIN_PERMISSION = 'users.manage'

export interface UserPermissionView {
  id: number
  code: string
  module: string
  description: string
  /** An override always wins this label; 'role' means no override row exists. */
  source: 'role' | 'granted' | 'revoked'
  /** Whether the user actually holds it right now. */
  effective: boolean
}
```

- [ ] **Step 3: Add the read method**

Add to the `identityService` object:

```ts
  async listUserPermissions(userId: number): Promise<UserPermissionView[]> {
    const user = await this.getUserById(userId)
    const catalogue = await identityRepository.findAllPermissions()

    const fromRoles = new Set<string>()
    for (const role of user.roles) {
      const rows = await identityRepository.findPermissionsForRole(role.id)
      for (const row of rows) fromRoles.add(row.code)
    }

    const overrides = await identityRepository.findOverridesForUser(userId)
    const overrideByCode = new Map(overrides.map((o) => [o.code, o.granted]))

    return catalogue.map((permission) => {
      const override = overrideByCode.get(permission.code)
      return {
        id: permission.id,
        code: permission.code,
        module: permission.module,
        description: permission.description,
        source: override === undefined ? 'role' : override ? 'granted' : 'revoked',
        effective: override === undefined ? fromRoles.has(permission.code) : override,
      }
    })
  },
```

- [ ] **Step 4: Add the guard helpers**

Add to the `identityService` object:

```ts
  /** Throws when taking ADMIN_PERMISSION from this user would leave nobody holding it. */
  async assertNotLastAdministrator(userId: number) {
    const candidates = await identityRepository.findAdministratorCandidates(ADMIN_PERMISSION)
    if (wouldRemoveLastAdministrator(administratorIds(candidates), userId)) {
      throw new ValidationError(
        'This would leave the system with no administrator - grant users.manage to someone else first',
      )
    }
  },

  /**
   * Whether the user would still hold ADMIN_PERMISSION after losing one role.
   * An override outranks every role, so it settles the question on its own.
   */
  async wouldRetainAdminAfterRoleRemoval(userId: number, roleId: number): Promise<boolean> {
    const overrides = await identityRepository.findOverridesForUser(userId)
    const override = overrides.find((o) => o.code === ADMIN_PERMISSION)
    if (override) return override.granted

    const user = await this.getUserById(userId)
    for (const role of user.roles) {
      if (role.id === roleId) continue
      const rows = await identityRepository.findPermissionsForRole(role.id)
      if (rows.some((r) => r.code === ADMIN_PERMISSION)) return true
    }
    return false
  },
```

- [ ] **Step 5: Add the write methods**

Add to the `identityService` object:

```ts
  async setPermissionOverride(userId: number, code: string, granted: boolean, actorUserId: number) {
    const permission = await identityRepository.findPermissionByCode(code)
    if (!permission) throw new NotFoundError(`Unknown permission: ${code}`)
    await this.getUserById(userId)

    if (!granted && code === ADMIN_PERMISSION) {
      await this.assertNotLastAdministrator(userId)
    }

    await identityRepository.upsertOverride(userId, permission.id, granted, actorUserId)
    await recordAudit({
      userId: actorUserId,
      action: granted ? 'permission.grant' : 'permission.revoke',
      entityType: 'user',
      entityId: userId,
      afterData: { permission: code },
    })

    return this.listUserPermissions(userId)
  },

  async clearPermissionOverride(userId: number, code: string, actorUserId: number) {
    const permission = await identityRepository.findPermissionByCode(code)
    if (!permission) throw new NotFoundError(`Unknown permission: ${code}`)
    await this.getUserById(userId)

    // Clearing a granted override can itself remove the last administrator,
    // but only if no role would give the permission back.
    if (code === ADMIN_PERMISSION) {
      const candidates = await identityRepository.findAdministratorCandidates(ADMIN_PERMISSION)
      const self = candidates.find((c) => c.userId === userId)
      if (!self?.hasViaRole) {
        await this.assertNotLastAdministrator(userId)
      }
    }

    await identityRepository.deleteOverride(userId, permission.id)
    await recordAudit({
      userId: actorUserId,
      action: 'permission.reset',
      entityType: 'user',
      entityId: userId,
      afterData: { permission: code },
    })

    return this.listUserPermissions(userId)
  },
```

- [ ] **Step 6: Extend the guard to role removal**

In the existing `removeRole` method (currently at line 113), insert the new check after the existing last-role check and before `identityRepository.removeRole`:

```ts
  async removeRole(userId: number, roleId: number, actorUserId: number) {
    const remainingCount = await identityRepository.countRolesForUser(userId)
    if (remainingCount <= 1) {
      throw new ValidationError('Cannot remove a user\'s last remaining role — assign a replacement first')
    }

    // Without this, the override guard is bypassable: an admin could strip the
    // admin role from the last administrator instead of revoking the
    // permission, and lock everyone out through the other door.
    if (!(await this.wouldRetainAdminAfterRoleRemoval(userId, roleId))) {
      await this.assertNotLastAdministrator(userId)
    }

    await identityRepository.removeRole(userId, roleId)
    await recordAudit({ userId: actorUserId, action: 'role.remove', entityType: 'user', entityId: userId, afterData: { roleId } })

    return this.getUserById(userId)
  },
```

- [ ] **Step 7: Verify the build and tests**

Run: `cd Accounts && pnpm build && pnpm test`
Expected: both succeed.

- [ ] **Step 8: Commit**

```bash
cd Accounts
git add src/modules/identity/identity.service.ts
git commit -m "Add permission override service methods and last-administrator guard"
```

---

### Task 6: Validation schema, controller and routes

**Files:**
- Modify: `Accounts/src/modules/identity/identity.schema.ts`
- Modify: `Accounts/src/modules/identity/identity.controller.ts`
- Modify: `Accounts/src/modules/identity/identity.routes.ts`

**Interfaces:**
- Consumes: the three service methods from Task 5.
- Produces three endpoints, all gated on `roles.manage`:
  - `GET /api/users/:userId/permissions`
  - `PUT /api/users/:userId/permissions/:code` with body `{ granted: boolean }`
  - `DELETE /api/users/:userId/permissions/:code`

- [ ] **Step 1: Add the request schema**

Append to `Accounts/src/modules/identity/identity.schema.ts`:

```ts
export const setPermissionOverrideSchema = z.object({
  granted: z.boolean(),
})
export type SetPermissionOverrideInput = z.infer<typeof setPermissionOverrideSchema>
```

- [ ] **Step 2: Add the controller methods**

In `Accounts/src/modules/identity/identity.controller.ts`, add `SetPermissionOverrideInput` to the existing type import from `./identity.schema.js`, then add these to the `identityController` object after `removeRole`:

```ts
  listUserPermissions: async (c: Context) =>
    ok(c, await identityService.listUserPermissions(Number(c.req.param('userId')))),
  setPermissionOverride: async (c: Context) =>
    ok(c, await identityService.setPermissionOverride(
      Number(c.req.param('userId')),
      c.req.param('code')!,
      getValidated<SetPermissionOverrideInput>(c, 'json').granted,
      actorId(c),
    )),
  clearPermissionOverride: async (c: Context) =>
    ok(c, await identityService.clearPermissionOverride(
      Number(c.req.param('userId')),
      c.req.param('code')!,
      actorId(c),
    )),
```

- [ ] **Step 3: Add the routes**

In `Accounts/src/modules/identity/identity.routes.ts`, add `setPermissionOverrideSchema` to the existing schema import, then add these lines after the two existing role routes:

```ts
usersRoutes.get('/:userId/permissions', requirePermission('roles.manage'), identityController.listUserPermissions)
usersRoutes.put('/:userId/permissions/:code', requirePermission('roles.manage'), zValidator('json', setPermissionOverrideSchema), identityController.setPermissionOverride)
usersRoutes.delete('/:userId/permissions/:code', requirePermission('roles.manage'), identityController.clearPermissionOverride)
```

- [ ] **Step 4: Verify the build**

Run: `cd Accounts && pnpm build && pnpm test`
Expected: both succeed.

- [ ] **Step 5: Verify the endpoints by hand**

Start the server (`pnpm dev`), log in as an admin to get a token, then:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4100/api/users/1/permissions | head -c 400
```

Expected: a JSON envelope whose `data` is an array of 94 entries, each with `code`, `module`, `source` and `effective`.

```bash
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"granted":true}' http://localhost:4100/api/users/1/permissions/reports.export
```

Expected: the same array, with `reports.export` now `"source": "granted"`.

Then revoke `users.manage` from the only admin and confirm it is rejected with the guard's message.

- [ ] **Step 6: Commit**

```bash
cd Accounts
git add src/modules/identity/identity.schema.ts src/modules/identity/identity.controller.ts src/modules/identity/identity.routes.ts
git commit -m "Expose permission override endpoints"
```

---

### Task 7: Frontend types and API endpoints

**Files:**
- Modify: `Schoolfrontend/src/modules/identity/types.ts`
- Modify: `Schoolfrontend/src/modules/identity/IdentityApi.ts`

**Interfaces:**
- Consumes: the three endpoints from Task 6.
- Produces: `useGetUserPermissionsQuery`, `useSetPermissionOverrideMutation`, `useClearPermissionOverrideMutation`, and the `UserPermission` / `PermissionSource` types.

- [ ] **Step 1: Add the types**

Append to `Schoolfrontend/src/modules/identity/types.ts`:

```ts
export type PermissionSource = 'role' | 'granted' | 'revoked'

/** A catalogue permission as it applies to one user. */
export interface UserPermission extends PermissionDef {
  /** An override always wins this label; 'role' means no override exists. */
  source: PermissionSource
  /** Whether the user actually holds it right now. */
  effective: boolean
}
```

- [ ] **Step 2: Add the endpoints**

In `Schoolfrontend/src/modules/identity/IdentityApi.ts`:

1. Add `UserPermission` to the existing `import type { ... } from './types'` line.
2. Change `tagTypes` to `['Users', 'Roles', 'AuditLog', 'UserPermissions']`.
3. Add these endpoints inside `endpoints: (builder) => ({ ... })`:

```ts
    getUserPermissions: builder.query<UserPermission[], number>({
      query: (userId) => `users/${userId}/permissions`,
      transformResponse: (response: ApiEnvelope<UserPermission[]>) => response.data,
      providesTags: ['UserPermissions'],
    }),

    setPermissionOverride: builder.mutation<UserPermission[], { userId: number; code: string; granted: boolean }>({
      query: ({ userId, code, granted }) => ({
        url: `users/${userId}/permissions/${code}`,
        method: 'PUT',
        body: { granted },
      }),
      transformResponse: (response: ApiEnvelope<UserPermission[]>) => response.data,
      invalidatesTags: ['UserPermissions', 'AuditLog'],
    }),

    clearPermissionOverride: builder.mutation<UserPermission[], { userId: number; code: string }>({
      query: ({ userId, code }) => ({
        url: `users/${userId}/permissions/${code}`,
        method: 'DELETE',
      }),
      transformResponse: (response: ApiEnvelope<UserPermission[]>) => response.data,
      invalidatesTags: ['UserPermissions', 'AuditLog'],
    }),
```

4. Add the three generated hooks to the existing `export const { ... } = identityApi` block:

```ts
  useGetUserPermissionsQuery,
  useSetPermissionOverrideMutation,
  useClearPermissionOverrideMutation,
```

- [ ] **Step 3: Verify**

Run: `cd Schoolfrontend && pnpm build && pnpm lint`
Expected: build succeeds; lint reports no new errors.

- [ ] **Step 4: Commit**

```bash
cd Schoolfrontend
git add src/modules/identity/types.ts src/modules/identity/IdentityApi.ts
git commit -m "Add permission override API bindings"
```

---

### Task 8: The Permissions tab component

Kept in its own file because `UsersPage.tsx` is already 356 lines and this adds roughly 120 more.

**Files:**
- Create: `Schoolfrontend/src/modules/identity/UserPermissionsTab.tsx`

**Interfaces:**
- Consumes: the hooks and types from Task 7.
- Produces: `default UserPermissionsTab: React.FC<{ userId: number }>`

- [ ] **Step 1: Write the component**

Create `Schoolfrontend/src/modules/identity/UserPermissionsTab.tsx`:

```tsx
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
    useGetUserPermissionsQuery,
    useSetPermissionOverrideMutation,
    useClearPermissionOverrideMutation,
} from './IdentityApi'
import type { UserPermission } from './types'

const SOURCE_BADGE: Record<UserPermission['source'], string> = {
    role: 'badge-ghost',
    granted: 'badge-success',
    revoked: 'badge-error',
}

/**
 * The full 94-permission catalogue as it applies to one user, grouped by
 * module with a search box. Shows the effective answer rather than only the
 * exceptions, because the admin's real question is "what can this person
 * actually do?" — which an exceptions-only view cannot answer without knowing
 * every role's contents by heart.
 */
const UserPermissionsTab: React.FC<{ userId: number }> = ({ userId }) => {
    const { data: permissions, isLoading, isError } = useGetUserPermissionsQuery(userId)
    const [setOverride] = useSetPermissionOverrideMutation()
    const [clearOverride] = useClearPermissionOverrideMutation()
    const [search, setSearch] = useState('')

    const byModule = useMemo(() => {
        const grouped = new Map<string, UserPermission[]>()
        const needle = search.trim().toLowerCase()
        for (const p of permissions ?? []) {
            if (needle && !p.code.toLowerCase().includes(needle) && !p.description.toLowerCase().includes(needle)) continue
            const bucket = grouped.get(p.module) ?? []
            bucket.push(p)
            grouped.set(p.module, bucket)
        }
        return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    }, [permissions, search])

    const apply = async (code: string, next: 'role' | 'granted' | 'revoked') => {
        const loadingToastId = toast.loading('Updating permission...')
        try {
            if (next === 'role') await clearOverride({ userId, code }).unwrap()
            else await setOverride({ userId, code, granted: next === 'granted' }).unwrap()
            toast.success('Permission updated', { id: loadingToastId })
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to update permission'
            toast.error(message, { id: loadingToastId })
        }
    }

    if (isLoading) {
        return <div className="flex justify-center py-10"><span className="loading loading-spinner text-green-800"></span></div>
    }
    if (isError) {
        return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-700">Unable to load permissions.</div>
    }

    return (
        <div>
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search permissions by code or description..."
                className="input input-bordered input-sm w-full mb-3"
            />

            <div className="max-h-96 overflow-y-auto pr-1">
                {byModule.map(([module, rows]) => (
                    <div key={module} className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{module}</h4>
                        {rows.map((p) => (
                            <div
                                key={p.code}
                                className={`flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 ${p.source !== 'role' ? 'bg-amber-50' : ''}`}
                            >
                                <div className="min-w-0">
                                    <div className="font-mono text-xs text-gray-800 truncate">{p.code}</div>
                                    <div className="text-xs text-gray-500 truncate">{p.description}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`badge badge-sm ${SOURCE_BADGE[p.source]}`}>
                                        {p.effective ? 'allowed' : 'denied'}
                                    </span>
                                    <select
                                        value={p.source}
                                        onChange={(e) => apply(p.code, e.target.value as 'role' | 'granted' | 'revoked')}
                                        className="select select-bordered select-xs"
                                    >
                                        <option value="role">Default (role)</option>
                                        <option value="granted">Grant</option>
                                        <option value="revoked">Revoke</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
                {byModule.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-6">No permissions match that search.</p>
                )}
            </div>
        </div>
    )
}

export default UserPermissionsTab
```

- [ ] **Step 2: Verify**

Run: `cd Schoolfrontend && pnpm build && pnpm lint`
Expected: build succeeds; lint reports no new errors.

- [ ] **Step 3: Commit**

```bash
cd Schoolfrontend
git add src/modules/identity/UserPermissionsTab.tsx
git commit -m "Add per-user permissions tab component"
```

---

### Task 9: Wire the tab into the Manage User modal

**Files:**
- Modify: `Schoolfrontend/src/modules/identity/UsersPage.tsx`

**Interfaces:**
- Consumes: `UserPermissionsTab` from Task 8.
- Produces: no new exports.

- [ ] **Step 1: Import the tab**

Add to the imports at the top of `Schoolfrontend/src/modules/identity/UsersPage.tsx`:

```tsx
import UserPermissionsTab from './UserPermissionsTab'
```

- [ ] **Step 2: Add tab state**

Inside `ManageUserModal`, alongside the existing `const [addRoleId, setAddRoleId] = useState('')`:

```tsx
    const [tab, setTab] = useState<'access' | 'permissions'>('access')
```

- [ ] **Step 3: Widen the modal**

The permissions list needs more room than the current `max-w-lg`. Change:

```tsx
            <div className="modal-box max-w-lg">
```

to:

```tsx
            <div className="modal-box max-w-3xl">
```

- [ ] **Step 4: Add the tab strip**

Immediately after the `<p className="text-sm text-gray-500 font-mono mb-4">{user.email}</p>` line, insert:

```tsx
                <div role="tablist" className="tabs tabs-bordered mb-4">
                    <button role="tab" className={`tab ${tab === 'access' ? 'tab-active' : ''}`} onClick={() => setTab('access')}>
                        Details &amp; Roles
                    </button>
                    <button role="tab" className={`tab ${tab === 'permissions' ? 'tab-active' : ''}`} onClick={() => setTab('permissions')}>
                        Permissions
                    </button>
                </div>
```

- [ ] **Step 5: Gate the existing sections behind the first tab**

Three consecutive existing blocks move inside a conditional. They are, in order:

1. the details form, opening `<form onSubmit={handleEditSubmit(onSaveEdit)} className="mb-6">`
2. the password form, opening `<form onSubmit={handlePwSubmit(onResetPassword)} className="mb-6 border-t pt-4">`
3. the roles block, opening `<div className="border-t pt-4">` and closing immediately before `<div className="flex justify-end mt-6">`

Insert this line immediately **before** block 1:

```tsx
                {tab === 'access' ? (<>
```

Insert this immediately **after** the closing `</div>` of block 3 (and before the `<div className="flex justify-end mt-6">` that holds the Close button):

```tsx
                </>) : (
                    <UserPermissionsTab userId={user.id} />
                )}
```

Do not otherwise alter the contents of the three blocks — only what surrounds them. The Close button stays outside the conditional so it appears on both tabs.

- [ ] **Step 6: Verify**

Run: `cd Schoolfrontend && pnpm build && pnpm lint`
Expected: build succeeds; lint reports no new errors.

- [ ] **Step 7: Verify by hand**

With both servers running, log in as an admin, open Users, click Manage on a user, and check:

1. The **Permissions** tab lists permissions grouped by module.
2. Searching `reports` narrows the list.
3. Setting a permission to **Grant** shows an amber row and a green `allowed` badge.
4. Setting it back to **Default (role)** removes the amber highlight.
5. Revoking `users.manage` from the only administrator shows the guard's error in a toast and leaves the setting unchanged.
6. The Audit Log page shows `permission.grant` / `permission.revoke` / `permission.reset` entries for the changes.

- [ ] **Step 8: Commit**

```bash
cd Schoolfrontend
git add src/modules/identity/UsersPage.tsx
git commit -m "Add Permissions tab to the Manage User modal"
```

---

## Done when

- `cd Accounts && pnpm test` passes (12 tests).
- `cd Accounts && pnpm build` and `cd Schoolfrontend && pnpm build` both succeed.
- An admin can grant `reports.export` to a user whose role lacks it, and that user sees the Download button on the Trial Balance without logging out and back in.
- Revoking `users.manage` from the last administrator is rejected, and so is removing the role that carries it.
