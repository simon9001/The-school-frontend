# Per-User Permission Overrides — Design

**Date:** 2026-09-11
**Status:** Approved design, pending implementation plan
**Repos touched:** `Accounts` (schema, resolution, API) and `Schoolfrontend` (admin UI).

## Purpose

The admin needs to decide what an individual user can do, without that decision
being all-or-nothing at role granularity.

Today the only lever is role assignment: to let one fee clerk export reports,
the admin must make them a Bursar — which also hands them the journal, payroll
and procurement. The reverse is equally coarse: to stop one Bursar from
processing payroll, the admin must remove the whole Bursar role.

This spec adds per-user exceptions layered on top of role-derived permissions,
so the admin can grant or revoke a single permission for a single person.

## Background: what exists

**Role assignment already works end to end.** `ManageUserModal` in
`UsersPage.tsx` assigns and removes roles against `POST /users/:userId/roles`
and `DELETE /users/:userId/roles/:roleId`. This spec does not change that; it
adds a second, finer lever beside it.

**Roles are code, not data.** `rbac.ts` defines 94 permissions across 18
modules and the permission set of each role. `db:sync-rbac` pushes that into
the database, so anything a UI wrote into `role_permissions` would be
overwritten on the next sync. This is why the design layers *user* exceptions
on top rather than making roles editable — the two never contend for the same
rows, and a role's powers stay reviewable in a code diff.

**Permissions resolve per request, not per token.** `attachUser` calls
`authService.me()` on every authenticated request, which re-reads roles and
permissions from the database. Permissions are **not** baked into the JWT.
This is the single fact that makes the feature cheap: an override takes effect
on the user's next request, with no re-login, no token revocation, and no cache
to invalidate.

**An audit helper exists.** `common/audit.ts` exposes `recordAudit`, already
used by `assignRole` and `removeRole`, and the Audit Log page renders whatever
it writes.

**Neither repo has a test framework.** No Vitest, no test files, in either
`Accounts` or `Schoolfrontend`.

## Decisions taken

**1. One table with a boolean, not two tables.** A single
`user_permission_overrides` row per (user, permission) carrying
`granted: boolean` — true grants, false revokes. A composite primary key makes
it structurally impossible for a permission to be both granted and revoked for
the same user. Separate grant/revoke tables would permit that contradiction and
then need code to resolve it.

**2. Absence means "the role decides".** No row is the default state for all 94
permissions. Clearing an override is a delete, not a row with a third state.
This keeps the table small — it holds only genuine exceptions — and makes
"reset to default" trivially expressible.

**3. Revoke beats a role grant.** The merge is:

```
effective = (role permissions ∪ granted) \ revoked
```

Deny wins. An admin who explicitly revokes a permission expects it gone
regardless of what any of the user's roles say.

**4. Guard the last administrator.** Any change that would leave zero *active*
users holding `users.manage` is rejected. The count must consider effective
permissions — role-derived, plus granted overrides, minus revoked ones — not
just role membership.

This is chosen over "guard yourself only" and "no guard" because the likely
admin of a school finance system is a part-time ICT teacher without database
access, and a lockout has no in-app recovery path.

**5. The same guard is extended to `removeRole`.** `identity.service.ts`
currently checks only that a user retains at least one role; nothing stops an
admin removing the admin role from the last administrator. Without this, the
new guard is bypassable through a door that is already open, and would offer
false assurance. This is a fix to existing behaviour, accepted deliberately as
part of this work.

**6. The admin sees the full effective list, not just exceptions.** The
permissions tab lists all 94 grouped by module with a search box, each row
showing its source. The admin's real question is "what can this person
actually do?", and only the effective list answers it without knowing every
role's contents by heart. Rejected: an exceptions-only view, which is smaller
but forces cross-referencing.

**7. No expiry, no reason field.** The audit log already records who changed
what and when. Time-boxed permissions are a different feature with different
questions (what happens at expiry, who is notified) and are not built here.

## Data model

Added to `Accounts/src/db/schema/identity.ts`, mirroring the shape of
`userRoles` so it reads consistently with its neighbour:

```ts
export const userPermissionOverrides = pgTable('user_permission_overrides', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  granted: boolean('granted').notNull(),
  assignedBy: integer('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.permissionId] })])
```

Both foreign keys cascade on delete: removing a user or retiring a permission
should not strand override rows.

Migration is generated with `pnpm db:generate` (next file: `0010_*.sql`) and
applied with `pnpm db:migrate`. The migration is additive — a new table only,
no change to existing columns — so it carries no data-loss risk.

## Permission resolution

`authRepository.findRolesAndPermissions` gains a third query, selecting
override rows joined to `permissions` for the user, and applies the merge from
decision 3 before returning.

The merge itself is extracted as a pure function so it can be tested without a
database:

```ts
mergePermissions(rolePermissions: string[], overrides: {code, granted}[]): string[]
```

**Performance note.** This function runs on every authenticated request and
already issues two queries; this makes three. At school scale (tens of
concurrent users) that is acceptable, and it is called out here so the cost is
a known quantity rather than a surprise. Caching is explicitly not introduced:
it would reintroduce the staleness problem that per-request resolution avoids.

## API

All three endpoints gated on `roles.manage`, consistent with the existing role
assignment endpoints.

| Method | Path | Body | Purpose |
|---|---|---|---|
| `GET` | `/api/users/:userId/permissions` | — | All 94 permissions with `source: 'role' \| 'granted' \| 'revoked'` |
| `PUT` | `/api/users/:userId/permissions/:code` | `{ granted: boolean }` | Upsert an override |
| `DELETE` | `/api/users/:userId/permissions/:code` | — | Clear the override, returning to role default |

`GET` returns the full catalogue rather than only the user's permissions, so
the UI can render the grouped list without a second request.

`source` describes **why the user holds (or lacks) the permission now**, and an
override always wins the label: a permission the Bursar role grants *and* an
override also grants reports as `'granted'`, not `'role'`. The UI needs to
distinguish "this is an exception someone set" from "this came with the role",
and the override is the answer to that question even when it agrees with the
role. `'role'` therefore means precisely "no override row exists".

`PUT` with `granted: false` and `DELETE` both invoke the last-administrator
guard when the permission is `users.manage`.

Errors use the existing `ValidationError` / `ForbiddenError` types so they
surface through the established error handler.

## UI

`ManageUserModal` in `Schoolfrontend/src/modules/identity/UsersPage.tsx` gains
a tab strip: **Roles** (unchanged) and **Permissions**.

The permissions tab reuses the `useMemo` module-grouping and search filter
already written in `RolesPage.tsx`, so the interaction is familiar and the code
is not invented twice. Each row shows the permission code, its description, a
source badge, and a three-way control:

- **Default (role)** — no override row
- **Grant** — override with `granted: true`
- **Revoke** — override with `granted: false`

Rows whose effective state differs from the role default are visually marked,
so exceptions are scannable in a list of 94.

A rejected last-administrator guard surfaces as an inline error on the row,
not a toast — the message explains a rule about *that* permission and should
stay next to it.

## Audit

Every change calls `recordAudit` with the shape already used by
`role.assign` / `role.remove`:

| Action | When |
|---|---|
| `permission.grant` | `PUT` with `granted: true` |
| `permission.revoke` | `PUT` with `granted: false` |
| `permission.reset` | `DELETE` |

`entityType: 'user'`, `entityId: <the affected user>`, `afterData` carrying the
permission code. The actor is the admin making the change. These appear in the
existing Audit Log page with no work.

## Verification

Vitest is added to the `Accounts` repo as part of this work, covering the two
pieces where a plausible-looking bug would be invisible:

**`mergePermissions`** — a role grant survives with no override; a grant adds a
permission no role gives; a revoke removes one a role gives; an empty override
list returns the role set unchanged; duplicate role permissions de-duplicate.

**The last-administrator guard** — revoking `users.manage` from the only holder
is rejected; from one of two holders is allowed; a holder whose permission
comes from a *granted override* counts toward the total; a *revoked* user does
not; an inactive user does not count as a holder.

Frontend changes are verified with `pnpm build`, `pnpm lint`, and a manual
checklist. Standing up a frontend test framework is out of scope here.

## Out of scope

- Editing which permissions a role carries (`rbac.ts` remains the source of truth)
- Expiring or time-boxed overrides
- A reason/justification field per override
- Bulk-applying overrides across several users
- A frontend test framework
