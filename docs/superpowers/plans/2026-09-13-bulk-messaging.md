# Bulk Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Principal, Dean of Studies and Bursar send personalised bulk SMS and email to parents, teachers and staff, with a background sender, progress tracking and a Messaging page.

**Architecture:** A new `messaging` module in `Accounts` sits on top of the existing `notifications` table and provider seam. Pure, database-free units (phone normalisation, balances, families, audience resolution, placeholders, row building, the sender loop) carry all the logic and the unit tests; a thin repository, store, service and routes connect them to Postgres and HTTP. `Schoolfrontend` gains an RTK Query API, pure helpers (SMS segments, placeholders, audience summary) and a Messaging page with compose and history tabs.

**Tech Stack:** Backend — Hono, Drizzle ORM, postgres.js, zod 4, Vitest, pnpm. Frontend — React 19, Redux Toolkit / RTK Query, Tailwind 4 + daisyUI 5, sonner, sweetalert2, lucide-react, Vitest + Testing Library.

**Spec:** `Schoolfrontend/docs/superpowers/specs/2026-09-13-bulk-messaging-design.md`

## Global Constraints

- Every messaging route requires `notifications.send`. The sender is always the logged-in user (`actorId(c)`), never a request-body value.
- The Dean of Studies gains `notifications.send` (additive; `db:sync-rbac` applies it).
- New table `message_batches`: `id`, `created_by` (not null → `users.id`), `channel` enum `sms | email | both`, `audiences` jsonb not null, `subject` varchar(150) nullable, `body` text not null, `status` enum `queued | sending | completed`, `created_at` timestamptz default now, `completed_at` timestamptz nullable.
- `notifications` changes are additive only: `batch_id` nullable → `message_batches.id`; `recipient_name` varchar(150) nullable; `claimed_at` timestamptz nullable; `notification_status` gains `sending` and `skipped`; index on `(batch_id, status)`.
- Batch counts are computed from `notifications` grouped by status, never stored.
- Phone normalisation: strip spaces and dashes; `07XXXXXXXX` / `01XXXXXXXX` → `+2547XXXXXXXX` / `+2541XXXXXXXX`; `254XXXXXXXXX` gains a `+`; a valid `+254XXXXXXXXX` is kept; anything else is not a usable phone.
- Recipients are the same person when they share a normalised phone number or a lower-cased email. The merged recipient keeps the name from the first audience that produced it.
- Skip reasons, verbatim: `No phone number`, `Invalid phone number`, `No email address`.
- Placeholders: `{{name}}` (everyone); `{{parentName}}`, `{{studentName}}`, `{{className}}`, `{{balance}}` (parents only). Names join as "Jane", "Jane and John", "Jane, John and Mary". Balance formats as `12,500.00`. The valid set is the intersection across the recipient kinds the audiences can produce; any other `{{…}}` token in body or subject is rejected with 400 and the valid list.
- Fee balance per student: non-cancelled invoices only, Σ(item amount − payments allocated to that item), an over-allocated item contributes 0 (overpayment is not netted). Family balance = sum over its children. `fee_balance_parents` includes families whose merged balance is **greater than** `minimumBalance` (default 0).
- Sender: claim ≤ 20 rows with `FOR UPDATE SKIP LOCKED`, send 5 at a time, broadcast one `messages` update per chunk, complete the batch only when no row is `pending` or `sending`. On boot, `sending` rows claimed more than 5 minutes ago return to `pending` and every non-completed batch restarts.
- Audit: one entry per batch, action `message.send`, entity type `message_batch`, after-data `{ channel, audiences, subject, body, recipients, skipped }`.
- Delivery banner copy, verbatim: *Messages are recorded but not delivered — no SMS or email provider is configured.*
- SMS counter: GSM-7 160 per single part, 153 per part beyond; any non-GSM-7 character switches to UCS-2 at 70 / 67; GSM extended characters count as two.
- Nav entry becomes **Messaging** at `/dashboard/communication/messaging`, gated on `notifications.send`.
- **Never run a database-writing command (`db:migrate`, `db:push`, seeds, `db:sync-rbac`, the built server) from the `Accounts` directory during this work** — `Accounts/.env` points at production and `config({ override: true })` makes it win over shell variables. Local-database work runs from a scratch directory holding its own `.env` (Task 9).

## Plan rulings (decisions the spec leaves open)

- **Branching.** The backend `feat/student-teacher-delete-and-audit` branch was cut from `main` and does not contain `feat/dashboard-data-visualization`, which owns migrations `0012`/`0013`. A migration generated on the students branch would also be numbered `0012` and collide. Task 1 therefore creates `feat/bulk-messaging` from the students branch and merges the dashboard branch into it (two trivial "keep both sides" conflicts), so the messaging migration is `0014` on a correct snapshot chain. The frontend `feat/bulk-messaging` already contains both branches.
- **Teacher who is also a staff record.** The seed gives a teacher and its linked staff record different phone numbers, and staff have no email, so contact matching alone would message those people twice. Besides phone/email, a staff record with `teacher_id` is the same person as that teacher. This enforces the spec's "one message per person" rule and its "teacher who is also a staff record" test.
- **Siblings with the same unusable phone** (no account) are grouped by the cleaned raw string so the family gets one skipped row, not one per child.
- **Picked people who are not active** (or unknown ids) → 400 `ValidationError`.
- **A send that resolves to zero recipients** → 400 `These audiences have no recipients`.
- **Rendered subject and recipient name** are cut to 150 characters to fit their columns.
- **Body** max 1600 characters; at most 20 audiences and 200 hand-picked people per message.

## File Structure

### Accounts (backend)

| File | Responsibility |
|---|---|
| `src/db/schema/messaging.ts` (create) | `message_batches` table and its two enums |
| `src/db/schema/notifications.ts` (modify) | new statuses, `batch_id`, `recipient_name`, `claimed_at`, index |
| `src/db/schema/index.ts` (modify) | export the messaging schema |
| `drizzle/0014_*.sql` + `drizzle/meta/*` (generate) | migration |
| `src/modules/messaging/messaging.types.ts` (create) | shared TS types for the pure units |
| `src/modules/messaging/phone.ts` (+test) | `normalisePhone`, `phoneProblem` |
| `src/modules/messaging/grouping.ts` (+test) | `groupByKeys` union-find used by families and recipients |
| `src/modules/messaging/balance.ts` (+test) | `studentBalances` |
| `src/modules/messaging/families.ts` (+test) | `buildFamilies` |
| `src/modules/messaging/recipients.ts` (+test) | `resolveRecipients` |
| `src/modules/messaging/placeholders.ts` (+test) | valid sets, validation, values, name joining, balance formatting |
| `src/modules/messaging/compose.ts` (+test) | `assertPlaceholders`, `channelsOf`, `buildMessageRows`, `summarise` |
| `src/modules/messaging/sender.ts` (+test) | `createMessageSender` loop over an injected `SenderStore` |
| `src/modules/messaging/messaging.repository.ts` | directory loading, batch create/list/detail, people search |
| `src/modules/messaging/messaging.store.ts` | Postgres `SenderStore` (atomic claim etc.) |
| `src/modules/messaging/messaging.sender.ts` | the process-wide sender instance and provider |
| `src/modules/messaging/messaging.schema.ts` (+test) | zod request schemas |
| `src/modules/messaging/messaging.service.ts` | preview, send, list, detail, search, config |
| `src/modules/messaging/messaging.controller.ts` | HTTP adapters |
| `src/modules/messaging/messaging.routes.ts` | routes under `/api/messages` |
| `src/common/events.ts` (modify) | `'messages'` topic |
| `src/modules/identity/rbac.ts` (+ `rbac.test.ts`) (modify) | Dean gains `notifications.send` |
| `src/index.ts` (modify) | mount routes, resume batches on boot |

### Schoolfrontend

| File | Responsibility |
|---|---|
| `src/modules/messaging/types.ts` (create) | API types |
| `src/modules/messaging/smsSegments.ts` (+test) | `countSms` |
| `src/modules/messaging/placeholders.ts` (+test) | `validPlaceholders`, `describeAudience`, `audienceSummary`, help text |
| `src/modules/messaging/MessagingApi.ts` (+test) | RTK Query endpoints |
| `src/store/store.ts` (modify) | register `messagingApi` |
| `src/components/auth/RealtimeSync.tsx` (modify) | `messages` case |
| `src/modules/messaging/PlaceholderChips.tsx` (+test) | clickable placeholder chips |
| `src/modules/messaging/AudiencePicker.tsx` | audience selection UI |
| `src/modules/messaging/ComposeMessage.tsx` | compose, counter, preview, send |
| `src/modules/messaging/MessageHistory.tsx` | batch list and recipient detail |
| `src/modules/messaging/MessagingPage.tsx` | page shell, banner, tabs |
| `src/dashboardDesign/navigation.ts`, `src/App.tsx` (modify) | nav entry and route |

---

## Backend

All backend commands run in `c:\Users\ADMIN001\Secschoolproject\Accounts`.

### Task 1: Branch, schema and migration

**Files:**
- Create: `src/db/schema/messaging.ts`
- Modify: `src/db/schema/notifications.ts`, `src/db/schema/index.ts`
- Generate: `drizzle/0014_<random_name>.sql`, `drizzle/meta/0014_snapshot.json`, `drizzle/meta/_journal.json`

**Interfaces:**
- Produces: `messageBatches`, `messageChannelEnum`, `messageBatchStatusEnum` (from `src/db/schema/index.js`); `notifications.batchId`, `notifications.recipientName`, `notifications.claimedAt`; status values `'sending' | 'skipped'`.

- [ ] **Step 1: Create the branch and merge the dashboard branch**

```bash
git checkout feat/student-teacher-delete-and-audit
git status --short   # must print nothing
git checkout -b feat/bulk-messaging
git merge --no-ff feat/dashboard-data-visualization -m "Merge feat/dashboard-data-visualization into feat/bulk-messaging"
```

Expected: conflicts in `src/modules/students/students.repository.ts` and `src/modules/students/students.service.ts` only.

Resolve both by keeping **both** sides:
- In `students.service.ts`, the conflict is the students branch's `async remove(id, actorUserId) { … }` method against the dashboard branch's `countActiveByClass: () => studentsRepository.countActiveByClass(),`. Keep the full `remove` method, then the `countActiveByClass` line after it.
- In `students.repository.ts`, the conflict is `removeWithAdmissionUnlink: (id: number) => db.transaction(…)` against `countActiveByClass: () => db.select(…)…orderBy(classes.name),`. Keep `removeWithAdmissionUnlink` (with its comment), then `countActiveByClass`.
- Make sure the repository's drizzle import includes everything both sides use (`eq`, `sql`) and its schema import includes `admissions`, `classes`, `students`.

```bash
grep -n "<<<<<<<\|>>>>>>>" src/modules/students/students.repository.ts src/modules/students/students.service.ts   # prints nothing
pnpm test
pnpm build
git add src/modules/students/students.repository.ts src/modules/students/students.service.ts
git commit --no-edit
```

Expected: all tests pass, `tsc` exits 0, merge commit created.

- [ ] **Step 2: Create `src/db/schema/messaging.ts`**

```ts
import { pgTable, serial, integer, varchar, text, jsonb, pgEnum, timestamp } from 'drizzle-orm/pg-core'
import { users } from './identity.js'

export const messageChannelEnum = pgEnum('message_channel', ['sms', 'email', 'both'])
export const messageBatchStatusEnum = pgEnum('message_batch_status', ['queued', 'sending', 'completed'])

// One bulk send. The individual messages are ordinary `notifications` rows
// pointing back here; counts are computed from them, never stored.
export const messageBatches = pgTable('message_batches', {
  id: serial('id').primaryKey(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  channel: messageChannelEnum('channel').notNull(),
  audiences: jsonb('audiences').notNull(), // the selections as submitted
  subject: varchar('subject', { length: 150 }),
  body: text('body').notNull(), // the template as written, placeholders unrendered
  status: messageBatchStatusEnum('status').notNull().default('queued'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})
```

- [ ] **Step 3: Extend `src/db/schema/notifications.ts`**

Replace the first import line with:

```ts
import { pgTable, serial, varchar, integer, text, boolean, pgEnum, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './identity.js'
import { messageBatches } from './messaging.js'
```

Replace the status enum line with:

```ts
// 'sending' = claimed by the background sender; 'skipped' = never attempted
// because the recipient has no usable destination for this channel.
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed', 'sending', 'skipped'])
```

Replace the whole `notifications` table with:

```ts
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id').references(() => notificationTemplates.id),
  recipientUserId: integer('recipient_user_id').references(() => users.id),
  recipientName: varchar('recipient_name', { length: 150 }), // snapshot: many parents have no user row
  recipientPhone: varchar('recipient_phone', { length: 30 }), // snapshot at send time
  recipientEmail: varchar('recipient_email', { length: 150 }),
  channel: notificationChannelEnum('channel').notNull(),
  subject: varchar('subject', { length: 150 }),
  body: text('body').notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  relatedEntityType: varchar('related_entity_type', { length: 60 }), // e.g. 'fee_invoice', 'exam'
  relatedEntityId: varchar('related_entity_id', { length: 60 }),
  batchId: integer('batch_id').references(() => messageBatches.id),
  claimedAt: timestamp('claimed_at', { withTimezone: true }), // when the background sender took the row
  sentAt: timestamp('sent_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  createdBy: integer('created_by').references(() => users.id), // null = system-generated
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notifications_batch_id_status_idx').on(t.batchId, t.status)])
```

- [ ] **Step 4: Export the schema**

In `src/db/schema/index.ts`, add this line immediately **before** `export * from './notifications.js'`:

```ts
export * from './messaging.js'
```

- [ ] **Step 5: Typecheck**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 6: Generate the migration**

Run: `pnpm db:generate --name bulk_messaging`
(`drizzle-kit generate` only diffs the schema against `drizzle/meta` snapshots; it does not connect to a database.)

Expected: `drizzle/0014_bulk_messaging.sql` containing exactly these statements (order and `--> statement-breakpoint` separators may differ):

```sql
CREATE TYPE "public"."message_batch_status" AS ENUM('queued', 'sending', 'completed');
CREATE TYPE "public"."message_channel" AS ENUM('sms', 'email', 'both');
ALTER TYPE "public"."notification_status" ADD VALUE 'sending';
ALTER TYPE "public"."notification_status" ADD VALUE 'skipped';
CREATE TABLE "message_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by" integer NOT NULL,
	"channel" "message_channel" NOT NULL,
	"audiences" jsonb NOT NULL,
	"subject" varchar(150),
	"body" text NOT NULL,
	"status" "message_batch_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
ALTER TABLE "notifications" ADD COLUMN "recipient_name" varchar(150);
ALTER TABLE "notifications" ADD COLUMN "batch_id" integer;
ALTER TABLE "notifications" ADD COLUMN "claimed_at" timestamp with time zone;
ALTER TABLE "message_batches" ADD CONSTRAINT "message_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_batch_id_message_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."message_batches"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "notifications_batch_id_status_idx" ON "notifications" USING btree ("batch_id","status");
```

If the file contains any statement not about `message_batches`, the two new enums, `notification_status`, or the three new `notifications` columns/constraint/index, delete that statement from the `.sql` file (keep the snapshot as generated) and list what you removed in your report.

- [ ] **Step 7: Apply it to the LOCAL Docker database**

```bash
docker compose up -d db
docker compose exec -T db psql -U accounts -d school_accounts -v ON_ERROR_STOP=1 -f /dev/stdin < drizzle/0014_bulk_messaging.sql
docker compose exec -T db psql -U accounts -d school_accounts -c "\d message_batches" -c "select unnest(enum_range(null::notification_status))"
```

Expected: the table description, and the five statuses `pending, sent, failed, sending, skipped`. (Never use `pnpm db:migrate` or `db:push` — the migration journal is unusable and `.env` points at production.)

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/messaging.ts src/db/schema/notifications.ts src/db/schema/index.ts drizzle/
git commit -m "feat(messaging): message_batches table and batch columns on notifications"
```

### Task 2: Types, phone normalisation and grouping

**Files:**
- Create: `src/modules/messaging/messaging.types.ts`, `src/modules/messaging/phone.ts`, `src/modules/messaging/grouping.ts`
- Test: `src/modules/messaging/phone.test.ts`, `src/modules/messaging/grouping.test.ts`

**Interfaces:**
- Produces: every type in `messaging.types.ts` (used by Tasks 3–10); `normalisePhone(raw: string | null | undefined): string | null`; `phoneProblem(raw: string | null | undefined): 'No phone number' | 'Invalid phone number'`; `groupByKeys<T>(items: T[], keysOf: (item: T) => Array<string | null | undefined>): T[][]`.

- [ ] **Step 1: Create `src/modules/messaging/messaging.types.ts`**

```ts
// Types shared by the database-free messaging units. Nothing here imports the
// database, so every unit that uses them can be tested in isolation.

export type Channel = 'sms' | 'email' | 'both'
export type DeliveryChannel = 'sms' | 'email'
export type StaffCategory = 'teaching' | 'non_teaching'
export type RecipientKind = 'parent' | 'teacher' | 'staff'

/** A hand-picked person. A family is identified by any one of its children's student ids. */
export interface PickedPerson {
  kind: 'family' | 'teacher' | 'staff'
  id: number
}

export type Audience =
  | { type: 'all_parents' }
  | { type: 'class_parents'; classId: number; streamId?: number }
  | { type: 'fee_balance_parents'; minimumBalance?: number }
  | { type: 'all_teachers' }
  | { type: 'all_staff'; category?: StaffCategory }
  | { type: 'individuals'; people: PickedPerson[] }

export interface ComposeInput {
  channel: Channel
  audiences: Audience[]
  subject?: string
  body: string
}

/** One active student with their guardian fields and, if linked, their parent account. */
export interface StudentContactRow {
  studentId: number
  firstName: string
  lastName: string
  classId: number
  className: string
  streamId: number | null
  guardianName: string | null
  guardianPhone: string | null
  guardianEmail: string | null
  parentUserId: number | null
  parentName: string | null
  parentPhone: string | null
  parentEmail: string | null
}

/** One fee invoice item with the total allocated against it. Numerics arrive as strings. */
export interface InvoiceItemLine {
  studentId: number
  invoiceStatus: string
  amount: string | number
  allocated: string | number
}

export interface FamilyChild {
  studentId: number
  firstName: string
  classId: number
  className: string
  streamId: number | null
}

export interface Family {
  key: string
  name: string
  /** Normalised phone, or null when there is no usable phone. */
  phone: string | null
  /** The phone as stored, kept so a skipped row can say "Invalid" rather than "No". */
  rawPhone: string | null
  /** Lower-cased email, or null. */
  email: string | null
  children: FamilyChild[]
  balance: number
}

export interface PersonRow {
  id: number
  fullName: string
  phone: string | null
  email: string | null
}

export interface StaffRow extends PersonRow {
  category: StaffCategory
  teacherId: number | null
}

export interface Directory {
  families: Family[]
  teachers: PersonRow[]
  staff: StaffRow[]
}

export interface Recipient {
  kind: RecipientKind
  name: string
  phone: string | null
  rawPhone: string | null
  email: string | null
  /** For parents: the children in scope for this message. Empty for teachers and staff. */
  children: FamilyChild[]
  /** For parents: the whole family's balance. 0 for teachers and staff. */
  balance: number
}

/** A notifications row as built for a batch, before the batch id is known. */
export interface MessageRow {
  channel: DeliveryChannel
  recipientName: string
  recipientPhone: string | null
  recipientEmail: string | null
  subject: string | null
  body: string
  status: 'pending' | 'skipped'
  failureReason: string | null
}

export interface PreviewSummary {
  recipients: number
  channels: Array<{ channel: DeliveryChannel; queued: number; skipped: number }>
  skipped: number
  samples: Array<{ name: string; subject: string | null; body: string }>
}

export interface PersonHit {
  kind: PickedPerson['kind']
  id: number
  label: string
  detail: string
}
```

- [ ] **Step 2: Write the failing phone test `src/modules/messaging/phone.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { normalisePhone, phoneProblem } from './phone.js'

describe('normalisePhone', () => {
  it('turns local 07 and 01 numbers into +254 form', () => {
    expect(normalisePhone('0712345678')).toBe('+254712345678')
    expect(normalisePhone('0112345678')).toBe('+254112345678')
  })

  it('strips spaces and dashes first', () => {
    expect(normalisePhone(' 0712 345-678 ')).toBe('+254712345678')
  })

  it('adds a plus to 254 numbers and keeps valid +254 numbers', () => {
    expect(normalisePhone('254712345678')).toBe('+254712345678')
    expect(normalisePhone('+254712345678')).toBe('+254712345678')
  })

  it('rejects anything else', () => {
    expect(normalisePhone('0812345678')).toBeNull() // not an 07/01 prefix
    expect(normalisePhone('071234567')).toBeNull() // too short
    expect(normalisePhone('07123456789')).toBeNull() // too long
    expect(normalisePhone('+25471234567')).toBeNull()
    expect(normalisePhone('+44 7700 900123')).toBeNull()
    expect(normalisePhone('call me')).toBeNull()
  })

  it('treats missing values as no phone', () => {
    expect(normalisePhone(null)).toBeNull()
    expect(normalisePhone(undefined)).toBeNull()
    expect(normalisePhone('   ')).toBeNull()
  })
})

describe('phoneProblem', () => {
  it('says "No phone number" when nothing is stored', () => {
    expect(phoneProblem(null)).toBe('No phone number')
    expect(phoneProblem('  ')).toBe('No phone number')
  })

  it('says "Invalid phone number" when something unusable is stored', () => {
    expect(phoneProblem('12345')).toBe('Invalid phone number')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/phone.test.ts`
Expected: FAIL — cannot resolve `./phone.js`.

- [ ] **Step 4: Create `src/modules/messaging/phone.ts`**

```ts
// Every stored number today is in local 07…/01… form. Normalising to +254…
// lets two spellings of the same number match, and is the form SMS providers need.
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.replace(/[\s-]/g, '')
  if (/^0[17]\d{8}$/.test(s)) return `+254${s.slice(1)}`
  if (/^254\d{9}$/.test(s)) return `+${s}`
  if (/^\+254\d{9}$/.test(s)) return s
  return null
}

/** Why a recipient cannot be texted: nothing stored, or something unusable stored. */
export function phoneProblem(raw: string | null | undefined): 'No phone number' | 'Invalid phone number' {
  return raw && raw.trim() ? 'Invalid phone number' : 'No phone number'
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run src/modules/messaging/phone.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing grouping test `src/modules/messaging/grouping.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { groupByKeys } from './grouping.js'

type Item = { id: string; keys: Array<string | null> }
const keysOf = (item: Item) => item.keys
const ids = (groups: Item[][]) => groups.map((g) => g.map((i) => i.id))

describe('groupByKeys', () => {
  it('keeps items with no shared key apart, in input order', () => {
    const items: Item[] = [
      { id: 'a', keys: ['p1'] },
      { id: 'b', keys: ['p2'] },
    ]
    expect(ids(groupByKeys(items, keysOf))).toEqual([['a'], ['b']])
  })

  it('groups items sharing any key, transitively', () => {
    const items: Item[] = [
      { id: 'a', keys: ['phone:1', null] },
      { id: 'b', keys: ['phone:2', 'email:x'] },
      { id: 'c', keys: ['phone:1', 'email:x'] }, // links a and b
      { id: 'd', keys: [null, null] },
    ]
    expect(ids(groupByKeys(items, keysOf))).toEqual([['a', 'b', 'c'], ['d']])
  })

  it('orders groups by their first member and members by input order', () => {
    const items: Item[] = [
      { id: 'a', keys: ['k2'] },
      { id: 'b', keys: ['k1'] },
      { id: 'c', keys: ['k1'] },
      { id: 'd', keys: ['k2'] },
    ]
    expect(ids(groupByKeys(items, keysOf))).toEqual([['a', 'd'], ['b', 'c']])
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/grouping.test.ts`
Expected: FAIL — cannot resolve `./grouping.js`.

- [ ] **Step 8: Create `src/modules/messaging/grouping.ts`**

```ts
/**
 * Groups items that share any key, transitively (A shares a phone with B, B
 * shares an email with C → one group). Groups come out ordered by their first
 * member; members keep input order, so "first" always means "seen first".
 * Null, undefined and empty keys never link anything.
 */
export function groupByKeys<T>(items: T[], keysOf: (item: T) => Array<string | null | undefined>): T[][] {
  const parent = items.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  const owner = new Map<string, number>()
  items.forEach((item, i) => {
    for (const key of keysOf(item)) {
      if (!key) continue
      const first = owner.get(key)
      if (first === undefined) owner.set(key, i)
      else union(first, i)
    }
  })

  const groups = new Map<number, T[]>()
  items.forEach((item, i) => {
    const root = find(i)
    const group = groups.get(root)
    if (group) group.push(item)
    else groups.set(root, [item])
  })
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group)
}
```

- [ ] **Step 9: Run both tests to verify they pass**

Run: `pnpm vitest run src/modules/messaging`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/modules/messaging
git commit -m "feat(messaging): shared types, phone normalisation and key grouping"
```

### Task 3: Fee balances and families

**Files:**
- Create: `src/modules/messaging/balance.ts`, `src/modules/messaging/families.ts`
- Test: `src/modules/messaging/balance.test.ts`, `src/modules/messaging/families.test.ts`

**Interfaces:**
- Consumes: `InvoiceItemLine`, `StudentContactRow`, `Family`, `FamilyChild` (Task 2 `messaging.types.ts`); `normalisePhone` (Task 2 `phone.ts`); `groupByKeys` (Task 2 `grouping.ts`).
- Produces: `studentBalances(lines: InvoiceItemLine[]): Map<number, number>`; `buildFamilies(rows: StudentContactRow[], balances: Map<number, number>): Family[]`.

- [ ] **Step 1: Write the failing balance test `src/modules/messaging/balance.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { studentBalances } from './balance.js'
import type { InvoiceItemLine } from './messaging.types.js'

const line = (studentId: number, amount: string, allocated: string, invoiceStatus = 'open'): InvoiceItemLine => ({
  studentId,
  amount,
  allocated,
  invoiceStatus,
})

describe('studentBalances', () => {
  it("sums each item's amount minus what was allocated to it, per student", () => {
    const balances = studentBalances([
      line(1, '10000.00', '4000.00'),
      line(1, '2500.50', '0'),
      line(2, '5000.00', '5000.00', 'paid'),
    ])
    expect(balances.get(1)).toBe(8500.5)
    expect(balances.get(2)).toBe(0)
  })

  it('ignores cancelled invoices', () => {
    const balances = studentBalances([line(1, '9000.00', '0', 'cancelled'), line(1, '1000.00', '0', 'partially_paid')])
    expect(balances.get(1)).toBe(1000)
    expect(studentBalances([line(3, '9000.00', '0', 'cancelled')]).get(3)).toBeUndefined()
  })

  it('does not net an over-allocated item against other items', () => {
    const balances = studentBalances([line(1, '1000.00', '1500.00'), line(1, '2000.00', '0')])
    expect(balances.get(1)).toBe(2000)
  })

  it('adds money in whole cents, without floating-point drift', () => {
    expect(studentBalances([line(1, '0.10', '0'), line(1, '0.20', '0')]).get(1)).toBe(0.3)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/balance.test.ts`
Expected: FAIL — cannot resolve `./balance.js`.

- [ ] **Step 3: Create `src/modules/messaging/balance.ts`**

```ts
import type { InvoiceItemLine } from './messaging.types.js'

/**
 * Outstanding fees per student. Mirrors recordPayment's rule: an item owes its
 * amount minus the payments allocated to it, and an item can never owe less
 * than nothing — so an over-allocation is not netted against other items.
 * Cancelled invoices owe nothing. Summed in whole cents.
 */
export function studentBalances(lines: InvoiceItemLine[]): Map<number, number> {
  const cents = new Map<number, number>()
  for (const line of lines) {
    if (line.invoiceStatus === 'cancelled') continue
    const outstanding = Math.max(0, Math.round(Number(line.amount) * 100) - Math.round(Number(line.allocated) * 100))
    cents.set(line.studentId, (cents.get(line.studentId) ?? 0) + outstanding)
  }
  return new Map([...cents].map(([studentId, total]) => [studentId, total / 100]))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/modules/messaging/balance.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing families test `src/modules/messaging/families.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildFamilies } from './families.js'
import type { StudentContactRow } from './messaging.types.js'

const row = (over: Partial<StudentContactRow> & { studentId: number }): StudentContactRow => ({
  firstName: `Child${over.studentId}`,
  lastName: 'Doe',
  classId: 1,
  className: 'Form 1',
  streamId: null,
  guardianName: 'Guardian',
  guardianPhone: null,
  guardianEmail: null,
  parentUserId: null,
  parentName: null,
  parentPhone: null,
  parentEmail: null,
  ...over,
})

describe('buildFamilies', () => {
  it('merges siblings whose guardian phone is written differently, summing their balances', () => {
    const families = buildFamilies(
      [
        row({ studentId: 1, guardianName: 'Mary Wanjiru', guardianPhone: '0712345678' }),
        row({ studentId: 2, guardianName: 'Mary Wanjiru', guardianPhone: '0712 345 678' }),
      ],
      new Map([[1, 1000], [2, 2500.5]]),
    )
    expect(families).toHaveLength(1)
    expect(families[0]).toMatchObject({ name: 'Mary Wanjiru', phone: '+254712345678', balance: 3500.5 })
    expect(families[0].children.map((c) => c.studentId)).toEqual([1, 2])
  })

  it("uses a linked parent account's name, phone and lower-cased email over the guardian fields", () => {
    const [family] = buildFamilies(
      [
        row({
          studentId: 1,
          guardianName: 'Guardian Name',
          guardianPhone: '0733000111',
          parentUserId: 7,
          parentName: 'Account Name',
          parentPhone: '0722000111',
          parentEmail: 'Parent@Mail.com',
        }),
      ],
      new Map(),
    )
    expect(family).toMatchObject({ name: 'Account Name', phone: '+254722000111', email: 'parent@mail.com', balance: 0 })
  })

  it("falls back to the student's guardian phone when the account has none", () => {
    const [family] = buildFamilies(
      [row({ studentId: 1, guardianPhone: '0733000111', parentUserId: 7, parentName: 'Account Name', parentEmail: 'a@b.c' })],
      new Map(),
    )
    expect(family.phone).toBe('+254733000111')
  })

  it('merges an account family with a guardian-phone family sharing its phone, named after the account', () => {
    const families = buildFamilies(
      [
        row({ studentId: 1, guardianName: 'Guardian', guardianPhone: '0744000111' }),
        row({ studentId: 2, parentUserId: 9, parentName: 'Account', parentPhone: '0744000111', parentEmail: 'acc@mail.com' }),
      ],
      new Map([[1, 3000], [2, 4000]]),
    )
    expect(families).toHaveLength(1)
    expect(families[0]).toMatchObject({ name: 'Account', balance: 7000, email: 'acc@mail.com' })
    expect(families[0].children.map((c) => c.studentId)).toEqual([1, 2])
  })

  it('keeps students with no contact details as separate families with no phone', () => {
    const families = buildFamilies([row({ studentId: 1 }), row({ studentId: 2 })], new Map())
    expect(families).toHaveLength(2)
    expect(families.every((f) => f.phone === null && f.rawPhone === null && f.email === null)).toBe(true)
  })

  it('groups siblings sharing the same unusable phone once, keeping what was stored', () => {
    const families = buildFamilies(
      [row({ studentId: 1, guardianPhone: '12345' }), row({ studentId: 2, guardianPhone: '12345' })],
      new Map(),
    )
    expect(families).toHaveLength(1)
    expect(families[0]).toMatchObject({ phone: null, rawPhone: '12345' })
  })

  it("uses only a child's first parent link (the repository orders the primary link first)", () => {
    const families = buildFamilies(
      [
        row({ studentId: 1, parentUserId: 7, parentName: 'Primary', parentEmail: 'p@mail.com' }),
        row({ studentId: 1, parentUserId: 8, parentName: 'Second', parentEmail: 's@mail.com' }),
      ],
      new Map(),
    )
    expect(families).toHaveLength(1)
    expect(families[0].name).toBe('Primary')
  })

  it('names a family without a guardian name after the child', () => {
    const [family] = buildFamilies([row({ studentId: 1, firstName: 'Jane', guardianName: null, guardianPhone: '0712345678' })], new Map())
    expect(family.name).toBe('Parent of Jane Doe')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/families.test.ts`
Expected: FAIL — cannot resolve `./families.js`.

- [ ] **Step 7: Create `src/modules/messaging/families.ts`**

```ts
import { groupByKeys } from './grouping.js'
import { normalisePhone } from './phone.js'
import type { Family, FamilyChild, StudentContactRow } from './messaging.types.js'

interface Seed {
  key: string
  fromAccount: boolean
  name: string
  phone: string | null
  rawPhone: string | null
  email: string | null
  children: FamilyChild[]
}

const clean = (value: string | null) => (value && value.trim() ? value.trim() : null)
const round2 = (n: number) => Math.round(n * 100) / 100

function seedFor(row: StudentContactRow): Omit<Seed, 'children'> {
  if (row.parentUserId !== null) {
    return {
      key: `user:${row.parentUserId}`,
      fromAccount: true,
      name: clean(row.parentName) ?? clean(row.guardianName) ?? `Parent of ${row.firstName} ${row.lastName}`,
      phone: normalisePhone(row.parentPhone) ?? normalisePhone(row.guardianPhone),
      rawPhone: clean(row.parentPhone) ?? clean(row.guardianPhone),
      email: clean(row.parentEmail)?.toLowerCase() ?? null,
    }
  }
  const phone = normalisePhone(row.guardianPhone)
  const rawPhone = clean(row.guardianPhone)
  return {
    key: phone ? `phone:${phone}` : rawPhone ? `raw:${rawPhone.replace(/[\s-]/g, '')}` : `student:${row.studentId}`,
    fromAccount: false,
    name: clean(row.guardianName) ?? `Parent of ${row.firstName} ${row.lastName}`,
    phone,
    rawPhone,
    email: clean(row.guardianEmail)?.toLowerCase() ?? null,
  }
}

/**
 * Every family school-wide. A child with a linked parent account belongs to
 * that account; otherwise to their guardian phone. Families that share a
 * normalised phone or an email are then one family, so balances and children
 * combine before any audience filters them.
 */
export function buildFamilies(rows: StudentContactRow[], balances: Map<number, number>): Family[] {
  const seen = new Set<number>()
  const seeds = new Map<string, Seed>()
  for (const row of rows) {
    if (seen.has(row.studentId)) continue // a further parent link for the same child
    seen.add(row.studentId)
    const child: FamilyChild = {
      studentId: row.studentId,
      firstName: row.firstName,
      classId: row.classId,
      className: row.className,
      streamId: row.streamId,
    }
    const seed = seedFor(row)
    const existing = seeds.get(seed.key)
    if (existing) {
      existing.children.push(child)
      existing.phone ??= seed.phone
      existing.rawPhone ??= seed.rawPhone
      existing.email ??= seed.email
    } else {
      seeds.set(seed.key, { ...seed, children: [child] })
    }
  }

  // Account families first, so a merged family is named after the account.
  const ordered = [...seeds.values()].sort((a, b) => Number(b.fromAccount) - Number(a.fromAccount))
  return groupByKeys(ordered, (s) => [s.phone && `phone:${s.phone}`, s.email && `email:${s.email}`]).map((group) => {
    const children = group.flatMap((s) => s.children).sort((a, b) => a.studentId - b.studentId)
    return {
      key: group[0].key,
      name: group[0].name,
      phone: group.find((s) => s.phone)?.phone ?? null,
      rawPhone: group.find((s) => s.rawPhone)?.rawPhone ?? null,
      email: group.find((s) => s.email)?.email ?? null,
      children,
      balance: round2(children.reduce((sum, c) => sum + (balances.get(c.studentId) ?? 0), 0)),
    }
  })
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm vitest run src/modules/messaging`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/messaging
git commit -m "feat(messaging): per-student fee balances and school-wide families"
```

### Task 4: Resolving audiences into recipients

**Files:**
- Create: `src/modules/messaging/recipients.ts`
- Test: `src/modules/messaging/recipients.test.ts`

**Interfaces:**
- Consumes: `Audience`, `Directory`, `Family`, `FamilyChild`, `PersonRow`, `StaffRow`, `Recipient` (Task 2); `normalisePhone`, `groupByKeys` (Task 2); `buildFamilies` (Task 3, test only); `ValidationError` from `src/common/errors.ts`.
- Produces: `resolveRecipients(audiences: Audience[], directory: Directory): Recipient[]` — throws `ValidationError` for picked people who are not active.

- [ ] **Step 1: Write the failing test `src/modules/messaging/recipients.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { resolveRecipients } from './recipients.js'
import { buildFamilies } from './families.js'
import { ValidationError } from '../../common/errors.js'
import type { Directory, Family, FamilyChild, PersonRow, StaffRow, StudentContactRow } from './messaging.types.js'

const child = (studentId: number, firstName: string, classId: number, className: string, streamId: number | null = null): FamilyChild => ({
  studentId,
  firstName,
  classId,
  className,
  streamId,
})
const family = (key: string, over: Partial<Family>): Family => ({
  key,
  name: `Family ${key}`,
  phone: null,
  rawPhone: null,
  email: null,
  children: [],
  balance: 0,
  ...over,
})
const teacher = (id: number, fullName: string, phone: string | null, email: string | null = null): PersonRow => ({ id, fullName, phone, email })
const staffMember = (
  id: number,
  fullName: string,
  phone: string | null,
  category: StaffRow['category'],
  teacherId: number | null = null,
  email: string | null = null,
): StaffRow => ({ id, fullName, phone, email, category, teacherId })

const directory: Directory = {
  families: [
    family('phone:+254711000001', {
      name: 'Mary Wanjiru',
      phone: '+254711000001',
      rawPhone: '0711000001',
      children: [child(1, 'Jane', 3, 'Form 3', 31), child(2, 'John', 1, 'Form 1', 11)],
      balance: 12500,
    }),
    family('phone:+254711000002', {
      name: 'Paul Otieno',
      phone: '+254711000002',
      rawPhone: '0711000002',
      children: [child(3, 'Amos', 3, 'Form 3', 32)],
      balance: 0,
    }),
  ],
  teachers: [teacher(1, 'Faith Nyambura', '0722000001', 'faith@school.local'), teacher(2, 'Peter Kamau', '0722000002', 'peter@school.local')],
  staff: [
    staffMember(1, 'Faith Nyambura (HR record)', '0799000001', 'teaching', 1), // same person as teacher 1, different phone
    staffMember(2, 'Grace Cook', '0733000003', 'non_teaching'),
    staffMember(3, 'Peter K.', null, 'teaching', null, 'Peter@School.local'), // same person as teacher 2 by email only
  ],
}

const names = (audiences: Parameters<typeof resolveRecipients>[0], dir: Directory = directory) =>
  resolveRecipients(audiences, dir).map((r) => r.name)

describe('resolveRecipients — parents', () => {
  it('gives every family one message naming all active children for all_parents', () => {
    const recipients = resolveRecipients([{ type: 'all_parents' }], directory)
    expect(recipients.map((r) => r.name)).toEqual(['Mary Wanjiru', 'Paul Otieno'])
    expect(recipients[0].children.map((c) => c.firstName)).toEqual(['Jane', 'John'])
    expect(recipients[0]).toMatchObject({ kind: 'parent', phone: '+254711000001', balance: 12500 })
  })

  it('names only the in-class child for class_parents while keeping the family balance', () => {
    const [wanjiru, otieno] = resolveRecipients([{ type: 'class_parents', classId: 3 }], directory)
    expect(wanjiru.children.map((c) => c.firstName)).toEqual(['Jane'])
    expect(wanjiru.balance).toBe(12500)
    expect(otieno.children.map((c) => c.firstName)).toEqual(['Amos'])
  })

  it('narrows class_parents to a stream when one is given', () => {
    expect(names([{ type: 'class_parents', classId: 3, streamId: 31 }])).toEqual(['Mary Wanjiru'])
  })

  it('combines the children in scope when a family enters through several audiences', () => {
    const recipients = resolveRecipients(
      [{ type: 'class_parents', classId: 3 }, { type: 'individuals', people: [{ kind: 'family', id: 2 }] }],
      directory,
    )
    expect(recipients).toHaveLength(2)
    expect(recipients[0].children.map((c) => c.firstName)).toEqual(['Jane', 'John'])
  })

  it('includes families whose balance is greater than the minimum (default 0)', () => {
    expect(names([{ type: 'fee_balance_parents' }])).toEqual(['Mary Wanjiru'])
    expect(names([{ type: 'fee_balance_parents', minimumBalance: 12000 }])).toEqual(['Mary Wanjiru'])
    expect(names([{ type: 'fee_balance_parents', minimumBalance: 12500 }])).toEqual([])
  })

  it('judges the fee filter on the merged family, not its separate halves', () => {
    const rows: StudentContactRow[] = [
      { studentId: 10, firstName: 'Ann', lastName: 'Mwangi', classId: 1, className: 'Form 1', streamId: null, guardianName: 'Guardian', guardianPhone: '0744000111', guardianEmail: null, parentUserId: null, parentName: null, parentPhone: null, parentEmail: null },
      { studentId: 11, firstName: 'Ben', lastName: 'Mwangi', classId: 2, className: 'Form 2', streamId: null, guardianName: 'Guardian', guardianPhone: null, guardianEmail: null, parentUserId: 9, parentName: 'Account', parentPhone: '0744000111', parentEmail: 'acc@mail.com' },
    ]
    const dir: Directory = { families: buildFamilies(rows, new Map([[10, 3000], [11, 4000]])), teachers: [], staff: [] }
    const recipients = resolveRecipients([{ type: 'fee_balance_parents', minimumBalance: 5000 }], dir)
    expect(recipients).toHaveLength(1)
    expect(recipients[0]).toMatchObject({ name: 'Account', balance: 7000 })
  })
})

describe('resolveRecipients — teachers, staff and de-duplication', () => {
  it('sends once to a teacher who is also a staff record, even with a different phone', () => {
    const recipients = resolveRecipients([{ type: 'all_teachers' }, { type: 'all_staff' }], directory)
    expect(recipients.map((r) => r.name)).toEqual(['Faith Nyambura', 'Peter Kamau', 'Grace Cook'])
    expect(recipients[0]).toMatchObject({ kind: 'teacher', phone: '+254722000001', email: 'faith@school.local' })
  })

  it('treats a matching email alone as the same person', () => {
    const recipients = resolveRecipients([{ type: 'all_teachers' }, { type: 'all_staff', category: 'teaching' }], directory)
    expect(recipients.map((r) => r.name)).toEqual(['Faith Nyambura', 'Peter Kamau'])
  })

  it('keeps the name from the first audience that produced the person', () => {
    expect(names([{ type: 'all_staff' }, { type: 'all_teachers' }])).toEqual(['Faith Nyambura (HR record)', 'Grace Cook', 'Peter K.'])
  })

  it('collapses a parent and a teacher who share a phone number', () => {
    const dir: Directory = { ...directory, teachers: [...directory.teachers, teacher(3, 'Paul Otieno (teacher)', '0711 000 002')] }
    expect(names([{ type: 'all_parents' }, { type: 'individuals', people: [{ kind: 'teacher', id: 3 }] }], dir)).toEqual([
      'Mary Wanjiru',
      'Paul Otieno',
    ])
  })

  it('filters staff by category', () => {
    expect(names([{ type: 'all_staff', category: 'non_teaching' }])).toEqual(['Grace Cook'])
  })

  it('counts a person picked twice once, even with no contact details', () => {
    const dir: Directory = { families: [], teachers: [teacher(5, 'No Contact', null)], staff: [] }
    const people = [{ kind: 'teacher' as const, id: 5 }, { kind: 'teacher' as const, id: 5 }]
    expect(names([{ type: 'individuals', people }, { type: 'all_teachers' }], dir)).toEqual(['No Contact'])
  })

  it('refuses picked people who are not active', () => {
    expect(() => resolveRecipients([{ type: 'individuals', people: [{ kind: 'family', id: 99 }] }], directory)).toThrow(ValidationError)
    expect(() => resolveRecipients([{ type: 'individuals', people: [{ kind: 'teacher', id: 99 }] }], directory)).toThrow(ValidationError)
    expect(() => resolveRecipients([{ type: 'individuals', people: [{ kind: 'staff', id: 99 }] }], directory)).toThrow(ValidationError)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/recipients.test.ts`
Expected: FAIL — cannot resolve `./recipients.js`.

- [ ] **Step 3: Create `src/modules/messaging/recipients.ts`**

```ts
import { ValidationError } from '../../common/errors.js'
import { groupByKeys } from './grouping.js'
import { normalisePhone } from './phone.js'
import type { Audience, Directory, Family, FamilyChild, PersonRow, Recipient, StaffRow } from './messaging.types.js'

interface Candidate extends Recipient {
  familyKey: string | null
  /** Record identities: a staff record linked to a teacher carries that teacher's identity too. */
  identities: string[]
}

const clean = (value: string | null) => (value && value.trim() ? value.trim() : null)
const round2 = (n: number) => Math.round(n * 100) / 100
const byStudentId = (a: FamilyChild, b: FamilyChild) => a.studentId - b.studentId

/**
 * Turns audience selections into one recipient per person. Audiences are
 * processed in order, so "first" is well defined: a person reached twice keeps
 * the name from the first audience that produced them. People are the same
 * when they share a normalised phone, a lower-cased email, or a record link
 * (a staff record's teacher_id).
 */
export function resolveRecipients(audiences: Audience[], directory: Directory): Recipient[] {
  const familyByStudent = new Map<number, Family>()
  for (const family of directory.families) for (const c of family.children) familyByStudent.set(c.studentId, family)

  const candidates: Candidate[] = []
  const scopes = new Map<string, Map<number, FamilyChild>>()
  const peopleSeen = new Set<string>()

  const addFamily = (family: Family, children: FamilyChild[]) => {
    let scope = scopes.get(family.key)
    if (!scope) {
      scope = new Map()
      scopes.set(family.key, scope)
      candidates.push({
        kind: 'parent',
        name: family.name,
        phone: family.phone,
        rawPhone: family.rawPhone,
        email: family.email,
        children: [],
        balance: family.balance,
        familyKey: family.key,
        identities: [`family:${family.key}`],
      })
    }
    for (const c of children) scope.set(c.studentId, c)
  }

  const addPerson = (kind: 'teacher' | 'staff', person: PersonRow | StaffRow) => {
    const identity = `${kind}:${person.id}`
    if (peopleSeen.has(identity)) return
    peopleSeen.add(identity)
    const identities = [identity]
    if ('teacherId' in person && person.teacherId !== null) identities.push(`teacher:${person.teacherId}`)
    candidates.push({
      kind,
      name: person.fullName,
      phone: normalisePhone(person.phone),
      rawPhone: clean(person.phone),
      email: clean(person.email)?.toLowerCase() ?? null,
      children: [],
      balance: 0,
      familyKey: null,
      identities,
    })
  }

  for (const audience of audiences) {
    switch (audience.type) {
      case 'all_parents':
        for (const family of directory.families) addFamily(family, family.children)
        break
      case 'fee_balance_parents': {
        const minimum = audience.minimumBalance ?? 0
        for (const family of directory.families) if (family.balance > minimum) addFamily(family, family.children)
        break
      }
      case 'class_parents':
        for (const family of directory.families) {
          const inClass = family.children.filter(
            (c) => c.classId === audience.classId && (audience.streamId === undefined || c.streamId === audience.streamId),
          )
          if (inClass.length > 0) addFamily(family, inClass)
        }
        break
      case 'all_teachers':
        for (const t of directory.teachers) addPerson('teacher', t)
        break
      case 'all_staff':
        for (const s of directory.staff) if (!audience.category || s.category === audience.category) addPerson('staff', s)
        break
      case 'individuals':
        for (const picked of audience.people) {
          if (picked.kind === 'family') {
            const family = familyByStudent.get(picked.id)
            if (!family) throw new ValidationError(`Student #${picked.id} is not an active student`)
            addFamily(family, family.children.filter((c) => c.studentId === picked.id))
          } else if (picked.kind === 'teacher') {
            const t = directory.teachers.find((x) => x.id === picked.id)
            if (!t) throw new ValidationError(`Teacher #${picked.id} is not an active teacher`)
            addPerson('teacher', t)
          } else {
            const s = directory.staff.find((x) => x.id === picked.id)
            if (!s) throw new ValidationError(`Staff member #${picked.id} is not active`)
            addPerson('staff', s)
          }
        }
        break
    }
  }

  for (const candidate of candidates) {
    if (candidate.familyKey) candidate.children = [...(scopes.get(candidate.familyKey)?.values() ?? [])].sort(byStudentId)
  }

  const groups = groupByKeys(candidates, (c) => [c.phone && `phone:${c.phone}`, c.email && `email:${c.email}`, ...c.identities])
  return groups.map((group) => {
    const [first] = group
    const children = new Map<number, FamilyChild>()
    for (const c of group) for (const ch of c.children) children.set(ch.studentId, ch)
    return {
      kind: first.kind,
      name: first.name,
      phone: group.find((c) => c.phone)?.phone ?? null,
      rawPhone: group.find((c) => c.rawPhone)?.rawPhone ?? null,
      email: group.find((c) => c.email)?.email ?? null,
      children: [...children.values()].sort(byStudentId),
      balance: round2(group.reduce((sum, c) => sum + c.balance, 0)),
    }
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/modules/messaging`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/messaging
git commit -m "feat(messaging): resolve audiences into de-duplicated recipients"
```

### Task 5: Placeholders and message rows

**Files:**
- Create: `src/modules/messaging/placeholders.ts`, `src/modules/messaging/compose.ts`
- Test: `src/modules/messaging/placeholders.test.ts`, `src/modules/messaging/compose.test.ts`

**Interfaces:**
- Consumes: `Audience`, `Channel`, `ComposeInput`, `DeliveryChannel`, `MessageRow`, `PreviewSummary`, `Recipient`, `RecipientKind` (Task 2); `phoneProblem` (Task 2); `renderTemplate(template, data)` from `src/common/template.ts` (existing: replaces `{{word}}` with `data[word] ?? ''`); `ValidationError`.
- Produces:
  - `PLACEHOLDERS: readonly string[]` = `['name', 'parentName', 'studentName', 'className', 'balance']`
  - `audienceKinds(audiences: Audience[]): Set<RecipientKind>`
  - `validPlaceholders(audiences: Audience[]): string[]`
  - `invalidPlaceholders(texts: string[], valid: string[]): string[]`
  - `joinNames(names: string[]): string`, `formatBalance(amount: number): string`
  - `placeholderValues(recipient: Recipient): Record<string, string>`
  - `channelsOf(channel: Channel): DeliveryChannel[]`
  - `assertPlaceholders(input: ComposeInput): void` (throws `ValidationError`)
  - `buildMessageRows(input: ComposeInput, recipients: Recipient[]): MessageRow[]`
  - `summarise(input: ComposeInput, recipients: Recipient[], rows: MessageRow[]): PreviewSummary`

- [ ] **Step 1: Write the failing test `src/modules/messaging/placeholders.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { formatBalance, invalidPlaceholders, joinNames, placeholderValues, validPlaceholders } from './placeholders.js'
import type { Recipient } from './messaging.types.js'

const PARENT_SET = ['name', 'parentName', 'studentName', 'className', 'balance']

describe('validPlaceholders', () => {
  it('offers every placeholder for parent audiences', () => {
    expect(validPlaceholders([{ type: 'all_parents' }])).toEqual(PARENT_SET)
    expect(validPlaceholders([{ type: 'class_parents', classId: 1 }, { type: 'fee_balance_parents' }])).toEqual(PARENT_SET)
    expect(validPlaceholders([{ type: 'individuals', people: [{ kind: 'family', id: 4 }] }])).toEqual(PARENT_SET)
  })

  it('offers only {{name}} to teachers or staff', () => {
    expect(validPlaceholders([{ type: 'all_teachers' }])).toEqual(['name'])
    expect(validPlaceholders([{ type: 'all_staff', category: 'non_teaching' }])).toEqual(['name'])
  })

  it('offers only what every recipient kind supports when audiences are mixed', () => {
    expect(validPlaceholders([{ type: 'all_parents' }, { type: 'all_teachers' }])).toEqual(['name'])
    expect(
      validPlaceholders([{ type: 'individuals', people: [{ kind: 'family', id: 4 }, { kind: 'staff', id: 2 }] }]),
    ).toEqual(['name'])
  })
})

describe('invalidPlaceholders', () => {
  it('finds unknown and misspelled tokens across body and subject', () => {
    expect(invalidPlaceholders(['Dear {{parentName}}, please pay {{balanse}}', 'About {{studnetName}}'], PARENT_SET)).toEqual([
      'balanse',
      'studnetName',
    ])
  })

  it('flags a real placeholder the audience cannot fill', () => {
    expect(invalidPlaceholders(['Balance: {{balance}}'], ['name'])).toEqual(['balance'])
  })

  it('flags tokens with spaces, which the renderer would leave in the text', () => {
    expect(invalidPlaceholders(['Hi {{ name }}'], ['name'])).toEqual([' name '])
  })

  it('reports each bad token once and accepts clean text', () => {
    expect(invalidPlaceholders(['{{x}} {{x}}'], ['name'])).toEqual(['x'])
    expect(invalidPlaceholders(['Hello {{name}}, no tokens here', ''], ['name'])).toEqual([])
  })
})

describe('joinNames and formatBalance', () => {
  it('joins names the way a person would write them', () => {
    expect(joinNames([])).toBe('')
    expect(joinNames(['Jane'])).toBe('Jane')
    expect(joinNames(['Jane', 'John'])).toBe('Jane and John')
    expect(joinNames(['Jane', 'John', 'Mary'])).toBe('Jane, John and Mary')
  })

  it('formats balances with thousands separators and two decimals', () => {
    expect(formatBalance(12500)).toBe('12,500.00')
    expect(formatBalance(0)).toBe('0.00')
    expect(formatBalance(1234567.5)).toBe('1,234,567.50')
  })
})

describe('placeholderValues', () => {
  const parent = (classNames: string[]): Recipient => ({
    kind: 'parent',
    name: 'Mary Wanjiru',
    phone: '+254711000001',
    rawPhone: '0711000001',
    email: null,
    children: classNames.map((className, i) => ({ studentId: i + 1, firstName: ['Jane', 'John', 'Mary'][i], classId: i, className, streamId: null })),
    balance: 12500,
  })

  it('fills every placeholder for a parent', () => {
    expect(placeholderValues(parent(['Form 1', 'Form 3']))).toEqual({
      name: 'Mary Wanjiru',
      parentName: 'Mary Wanjiru',
      studentName: 'Jane and John',
      className: 'Form 1 and Form 3',
      balance: '12,500.00',
    })
  })

  it('lists a shared class once', () => {
    expect(placeholderValues(parent(['Form 2', 'Form 2', 'Form 4'])).className).toBe('Form 2 and Form 4')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/placeholders.test.ts`
Expected: FAIL — cannot resolve `./placeholders.js`.

- [ ] **Step 3: Create `src/modules/messaging/placeholders.ts`**

```ts
import type { Audience, Recipient, RecipientKind } from './messaging.types.js'

const SUPPORTED_BY: Record<string, RecipientKind[]> = {
  name: ['parent', 'teacher', 'staff'],
  parentName: ['parent'],
  studentName: ['parent'],
  className: ['parent'],
  balance: ['parent'],
}

export const PLACEHOLDERS: readonly string[] = Object.keys(SUPPORTED_BY)

export function audienceKinds(audiences: Audience[]): Set<RecipientKind> {
  const kinds = new Set<RecipientKind>()
  for (const audience of audiences) {
    if (audience.type === 'all_teachers') kinds.add('teacher')
    else if (audience.type === 'all_staff') kinds.add('staff')
    else if (audience.type === 'individuals') for (const p of audience.people) kinds.add(p.kind === 'family' ? 'parent' : p.kind)
    else kinds.add('parent')
  }
  return kinds
}

/** Placeholders every recipient these audiences can produce is able to fill. */
export function validPlaceholders(audiences: Audience[]): string[] {
  const kinds = [...audienceKinds(audiences)]
  return PLACEHOLDERS.filter((p) => kinds.every((kind) => SUPPORTED_BY[p].includes(kind)))
}

/**
 * Every {{…}} token that is not exactly a valid placeholder. The renderer
 * blanks unknown names and ignores tokens with spaces, so anything flagged
 * here would otherwise reach recipients as a gap or as literal braces.
 */
export function invalidPlaceholders(texts: string[], valid: string[]): string[] {
  const invalid = new Set<string>()
  for (const text of texts) {
    for (const match of text.matchAll(/\{\{(.*?)\}\}/g)) if (!valid.includes(match[1])) invalid.add(match[1])
  }
  return [...invalid]
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function formatBalance(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function placeholderValues(recipient: Recipient): Record<string, string> {
  return {
    name: recipient.name,
    parentName: recipient.name,
    studentName: joinNames(recipient.children.map((c) => c.firstName)),
    className: joinNames([...new Set(recipient.children.map((c) => c.className))]),
    balance: formatBalance(recipient.balance),
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/modules/messaging/placeholders.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test `src/modules/messaging/compose.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { assertPlaceholders, buildMessageRows, channelsOf, summarise } from './compose.js'
import { ValidationError } from '../../common/errors.js'
import type { ComposeInput, Recipient } from './messaging.types.js'

const kid = (studentId: number, firstName: string, className: string) => ({ studentId, firstName, classId: studentId, className, streamId: null })
const recipient = (over: Partial<Recipient>): Recipient => ({
  kind: 'parent',
  name: 'Mary Wanjiru',
  phone: '+254711000001',
  rawPhone: '0711000001',
  email: 'mary@mail.com',
  children: [kid(1, 'Jane', 'Form 3')],
  balance: 12500,
  ...over,
})
const parents = (over: Partial<ComposeInput> = {}): ComposeInput => ({ channel: 'sms', audiences: [{ type: 'all_parents' }], body: 'Hello {{name}}', ...over })

describe('assertPlaceholders', () => {
  it('accepts placeholders valid for the audience', () => {
    expect(() => assertPlaceholders(parents({ body: 'Dear {{parentName}}, {{studentName}} owes {{balance}}' }))).not.toThrow()
  })

  it('refuses unknown tokens in the body or subject, naming them and the valid list', () => {
    expect(() => assertPlaceholders(parents({ body: 'Pay {{balanse}}' }))).toThrow(ValidationError)
    expect(() => assertPlaceholders(parents({ body: 'Pay {{balanse}}' }))).toThrow(
      'Unknown or unavailable placeholders: {{balanse}}. Valid placeholders for these audiences: {{name}}, {{parentName}}, {{studentName}}, {{className}}, {{balance}}',
    )
    expect(() => assertPlaceholders(parents({ channel: 'email', subject: 'Re {{clas}}', body: 'Hi' }))).toThrow('{{clas}}')
  })

  it('refuses parent placeholders when teachers are included', () => {
    expect(() => assertPlaceholders(parents({ audiences: [{ type: 'all_parents' }, { type: 'all_teachers' }], body: 'Balance {{balance}}' }))).toThrow(
      'Valid placeholders for these audiences: {{name}}',
    )
  })
})

describe('buildMessageRows', () => {
  it('renders each recipient their own text', () => {
    const input = parents({ body: 'Dear {{parentName}}, {{studentName}} ({{className}}) owes KES {{balance}}.' })
    const rows = buildMessageRows(input, [
      recipient({ children: [kid(1, 'Jane', 'Form 1'), kid(2, 'John', 'Form 3')] }),
      recipient({ name: 'Paul Otieno', phone: '+254711000002', children: [kid(3, 'Amos', 'Form 2'), kid(4, 'Ben', 'Form 2'), kid(5, 'Cy', 'Form 4')], balance: 800 }),
    ])
    expect(rows.map((r) => r.body)).toEqual([
      'Dear Mary Wanjiru, Jane and John (Form 1 and Form 3) owes KES 12,500.00.',
      'Dear Paul Otieno, Amos, Ben and Cy (Form 2 and Form 4) owes KES 800.00.',
    ])
    expect(rows[0]).toMatchObject({ channel: 'sms', recipientName: 'Mary Wanjiru', recipientPhone: '+254711000001', recipientEmail: null, subject: null, status: 'pending', failureReason: null })
  })

  it('makes one row per channel when sending both, with the subject only on email', () => {
    const rows = buildMessageRows(parents({ channel: 'both', subject: 'Fees for {{studentName}}' }), [recipient({})])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ channel: 'sms', subject: null, recipientPhone: '+254711000001', recipientEmail: null })
    expect(rows[1]).toMatchObject({ channel: 'email', subject: 'Fees for Jane', recipientPhone: null, recipientEmail: 'mary@mail.com' })
  })

  it('skips rows with no usable destination, saying why', () => {
    const rows = buildMessageRows(parents({ channel: 'both', subject: 'S' }), [
      recipient({ phone: null, rawPhone: null, email: null }),
      recipient({ phone: null, rawPhone: '12345' }),
    ])
    expect(rows.map((r) => [r.channel, r.status, r.failureReason])).toEqual([
      ['sms', 'skipped', 'No phone number'],
      ['email', 'skipped', 'No email address'],
      ['sms', 'skipped', 'Invalid phone number'],
      ['email', 'pending', null],
    ])
    expect(rows[2].recipientPhone).toBe('12345') // what was stored, for the history view
  })

  it('cuts the rendered subject and the name to their 150-character columns', () => {
    const long = 'x'.repeat(200)
    const [row] = buildMessageRows(parents({ channel: 'email', subject: `{{name}}` }), [recipient({ name: long })])
    expect(row.subject).toHaveLength(150)
    expect(row.recipientName).toHaveLength(150)
  })
})

describe('channelsOf and summarise', () => {
  it('expands both into sms and email', () => {
    expect(channelsOf('both')).toEqual(['sms', 'email'])
    expect(channelsOf('email')).toEqual(['email'])
  })

  it('counts queued and skipped rows per channel and renders three samples', () => {
    const input = parents({ channel: 'both', subject: 'For {{name}}' })
    const recipients = [
      recipient({ name: 'A' }),
      recipient({ name: 'B', email: null }),
      recipient({ name: 'C', phone: null, rawPhone: null }),
      recipient({ name: 'D' }),
    ]
    const summary = summarise(input, recipients, buildMessageRows(input, recipients))
    expect(summary.recipients).toBe(4)
    expect(summary.channels).toEqual([
      { channel: 'sms', queued: 3, skipped: 1 },
      { channel: 'email', queued: 3, skipped: 1 },
    ])
    expect(summary.skipped).toBe(2)
    expect(summary.samples).toEqual([
      { name: 'A', subject: 'For A', body: 'Hello A' },
      { name: 'B', subject: 'For B', body: 'Hello B' },
      { name: 'C', subject: 'For C', body: 'Hello C' },
    ])
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/compose.test.ts`
Expected: FAIL — cannot resolve `./compose.js`.

- [ ] **Step 7: Create `src/modules/messaging/compose.ts`**

```ts
import { ValidationError } from '../../common/errors.js'
import { renderTemplate } from '../../common/template.js'
import { phoneProblem } from './phone.js'
import { invalidPlaceholders, placeholderValues, validPlaceholders } from './placeholders.js'
import type { Channel, ComposeInput, DeliveryChannel, MessageRow, PreviewSummary, Recipient } from './messaging.types.js'

export const channelsOf = (channel: Channel): DeliveryChannel[] => (channel === 'both' ? ['sms', 'email'] : [channel])

const fit = (text: string) => text.slice(0, 150)
const tokens = (names: string[]) => names.map((n) => `{{${n}}}`).join(', ')

/** Refuses the message before anything is written if any placeholder cannot be filled for every recipient. */
export function assertPlaceholders(input: ComposeInput): void {
  const valid = validPlaceholders(input.audiences)
  const invalid = invalidPlaceholders([input.body, input.subject ?? ''], valid)
  if (invalid.length > 0) {
    throw new ValidationError(
      `Unknown or unavailable placeholders: ${tokens(invalid)}. Valid placeholders for these audiences: ${tokens(valid)}`,
    )
  }
}

/** One notifications row per recipient per channel, rendered, with skipped rows explaining why. */
export function buildMessageRows(input: ComposeInput, recipients: Recipient[]): MessageRow[] {
  const rows: MessageRow[] = []
  for (const recipient of recipients) {
    const values = placeholderValues(recipient)
    const body = renderTemplate(input.body, values)
    const subject = input.subject ? fit(renderTemplate(input.subject, values)) : null
    for (const channel of channelsOf(input.channel)) {
      const destination = channel === 'sms' ? recipient.phone : recipient.email
      rows.push({
        channel,
        recipientName: fit(recipient.name),
        recipientPhone: channel === 'sms' ? (recipient.phone ?? recipient.rawPhone) : null,
        recipientEmail: channel === 'email' ? recipient.email : null,
        subject: channel === 'email' ? subject : null,
        body,
        status: destination ? 'pending' : 'skipped',
        failureReason: destination ? null : channel === 'sms' ? phoneProblem(recipient.rawPhone) : 'No email address',
      })
    }
  }
  return rows
}

export function summarise(input: ComposeInput, recipients: Recipient[], rows: MessageRow[]): PreviewSummary {
  return {
    recipients: recipients.length,
    channels: channelsOf(input.channel).map((channel) => ({
      channel,
      queued: rows.filter((r) => r.channel === channel && r.status === 'pending').length,
      skipped: rows.filter((r) => r.channel === channel && r.status === 'skipped').length,
    })),
    skipped: rows.filter((r) => r.status === 'skipped').length,
    samples: recipients.slice(0, 3).map((recipient) => {
      const values = placeholderValues(recipient)
      return {
        name: recipient.name,
        subject: input.subject ? fit(renderTemplate(input.subject, values)) : null,
        body: renderTemplate(input.body, values),
      }
    }),
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm vitest run src/modules/messaging`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/messaging
git commit -m "feat(messaging): validate placeholders and build personalised message rows"
```

### Task 6: The background sender

**Files:**
- Create: `src/modules/messaging/sender.ts`
- Test: `src/modules/messaging/sender.test.ts`

**Interfaces:**
- Consumes: `NotificationProvider`, `SendResult` from `src/modules/notifications/notifications.provider.ts` (existing: `send({ channel, to, subject?, body }): Promise<{ success: boolean; failureReason?: string }>`).
- Produces:
  - `interface ClaimedMessage { id: number; channel: 'sms' | 'email'; recipientPhone: string | null; recipientEmail: string | null; subject: string | null; body: string }`
  - `interface SenderStore { markBatchSending(batchId: number): Promise<void>; claim(batchId: number, limit: number): Promise<ClaimedMessage[]>; markSent(id: number): Promise<void>; markFailed(id: number, reason: string): Promise<void>; countUnfinished(batchId: number): Promise<number>; completeBatch(batchId: number): Promise<void>; releaseStale(olderThanMs: number): Promise<number>; unfinishedBatchIds(): Promise<number[]> }`
  - `createMessageSender(options: SenderOptions): MessageSender` where `SenderOptions = { store: SenderStore; provider: NotificationProvider; onProgress?: (batchId: number) => void; onError?: (batchId: number, err: unknown) => void; claimSize?: number /* 20 */; concurrency?: number /* 5 */; staleAfterMs?: number /* 300000 */ }` and `MessageSender = { start(batchId: number): Promise<void>; resume(): Promise<void>; isRunning(batchId: number): boolean }`. `start` never rejects.

- [ ] **Step 1: Write the failing test `src/modules/messaging/sender.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { createMessageSender, type SenderStore } from './sender.js'
import type { NotificationProvider, SendResult } from '../notifications/notifications.provider.js'

type Status = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'
type BatchStatus = 'queued' | 'sending' | 'completed'
interface MemRow {
  id: number
  batchId: number
  status: Status
  claimedAt: number | null
  channel: 'sms' | 'email'
  recipientPhone: string | null
  recipientEmail: string | null
  subject: string | null
  body: string
  failureReason: string | null
}

const pendingRows = (batchId: number, count: number, startId = 1): MemRow[] =>
  Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    batchId,
    status: 'pending' as Status,
    claimedAt: null,
    channel: 'sms' as const,
    recipientPhone: `+254700000${String(startId + i).padStart(3, '0')}`,
    recipientEmail: null,
    subject: null,
    body: 'Hello',
    failureReason: null,
  }))

// An in-memory stand-in for the Postgres store with the same claiming rules.
function memoryStore(rows: MemRow[], batches: Record<number, BatchStatus>) {
  const claims: number[] = []
  const row = (id: number) => rows.find((r) => r.id === id)!
  const store: SenderStore = {
    async markBatchSending(batchId) {
      if (batches[batchId] === 'queued') batches[batchId] = 'sending'
    },
    async claim(batchId, limit) {
      const picked = rows.filter((r) => r.batchId === batchId && r.status === 'pending').slice(0, limit)
      for (const r of picked) {
        r.status = 'sending'
        r.claimedAt = Date.now()
      }
      claims.push(picked.length)
      return picked.map(({ id, channel, recipientPhone, recipientEmail, subject, body }) => ({ id, channel, recipientPhone, recipientEmail, subject, body }))
    },
    async markSent(id) {
      if (row(id).status === 'sending') row(id).status = 'sent'
    },
    async markFailed(id, reason) {
      row(id).status = 'failed'
      row(id).failureReason = reason
    },
    async countUnfinished(batchId) {
      return rows.filter((r) => r.batchId === batchId && (r.status === 'pending' || r.status === 'sending')).length
    },
    async completeBatch(batchId) {
      batches[batchId] = 'completed'
    },
    async releaseStale(olderThanMs) {
      let released = 0
      for (const r of rows) {
        if (r.status === 'sending' && r.claimedAt !== null && Date.now() - r.claimedAt > olderThanMs) {
          r.status = 'pending'
          r.claimedAt = null
          released++
        }
      }
      return released
    },
    async unfinishedBatchIds() {
      return Object.entries(batches).filter(([, s]) => s !== 'completed').map(([id]) => Number(id))
    },
  }
  return { store, claims }
}

function recordingProvider(outcome: (to: string) => SendResult | Error = () => ({ success: true })) {
  const sentTo: string[] = []
  const provider: NotificationProvider = {
    async send({ to }) {
      sentTo.push(to)
      const result = outcome(to)
      if (result instanceof Error) throw result
      return result
    },
  }
  return { provider, sentTo }
}

describe('createMessageSender', () => {
  it('claims in chunks of 20, sends every row exactly once and completes the batch', async () => {
    const rows = pendingRows(1, 45)
    const batches: Record<number, BatchStatus> = { 1: 'queued' }
    const { store, claims } = memoryStore(rows, batches)
    const { provider, sentTo } = recordingProvider()

    await createMessageSender({ store, provider }).start(1)

    expect(claims).toEqual([20, 20, 5, 0])
    expect(sentTo).toHaveLength(45)
    expect(new Set(sentTo).size).toBe(45)
    expect(rows.every((r) => r.status === 'sent')).toBe(true)
    expect(batches[1]).toBe('completed')
  })

  it("marks rows failed with the provider's reason or the thrown error", async () => {
    const rows = pendingRows(1, 3)
    const batches: Record<number, BatchStatus> = { 1: 'queued' }
    const { store } = memoryStore(rows, batches)
    const { provider } = recordingProvider((to) =>
      to.endsWith('002') ? { success: false, failureReason: 'Rejected by carrier' } : to.endsWith('003') ? new Error('timeout') : { success: true },
    )

    await createMessageSender({ store, provider }).start(1)

    expect(rows.map((r) => [r.status, r.failureReason])).toEqual([
      ['sent', null],
      ['failed', 'Rejected by carrier'],
      ['failed', 'timeout'],
    ])
    expect(batches[1]).toBe('completed')
  })

  it('does not complete a batch while another instance still has rows sending', async () => {
    const rows = [...pendingRows(1, 2), { ...pendingRows(1, 1, 3)[0], status: 'sending' as Status, claimedAt: Date.now() }]
    const batches: Record<number, BatchStatus> = { 1: 'sending' }
    const { store } = memoryStore(rows, batches)
    const { provider, sentTo } = recordingProvider()

    await createMessageSender({ store, provider }).start(1)

    expect(sentTo).toHaveLength(2)
    expect(batches[1]).toBe('sending')
  })

  it('runs one loop per batch even when started twice', async () => {
    const rows = pendingRows(1, 5)
    const { store } = memoryStore(rows, { 1: 'queued' })
    const { provider, sentTo } = recordingProvider()
    const sender = createMessageSender({ store, provider })

    const first = sender.start(1)
    const second = sender.start(1)
    expect(second).toBe(first)
    expect(sender.isRunning(1)).toBe(true)
    await first

    expect(sentTo).toHaveLength(5)
    expect(sender.isRunning(1)).toBe(false)
  })

  it('reports progress once per chunk of five and once on completion', async () => {
    const { store } = memoryStore(pendingRows(1, 12), { 1: 'queued' })
    const onProgress = vi.fn()

    await createMessageSender({ store, provider: recordingProvider().provider, onProgress }).start(1)

    expect(onProgress).toHaveBeenCalledTimes(4) // chunks of 5, 5, 2 + completion
    expect(onProgress).toHaveBeenCalledWith(1)
  })

  it('on resume, returns stale sending rows to pending and finishes interrupted batches without resending', async () => {
    const tenMinutesAgo = Date.now() - 10 * 60_000
    const rows = pendingRows(1, 4)
    rows[0].status = 'sending'
    rows[0].claimedAt = tenMinutesAgo
    rows[1].status = 'sending'
    rows[1].claimedAt = tenMinutesAgo
    rows[3].status = 'sent'
    const batches: Record<number, BatchStatus> = { 1: 'sending' }
    const { store } = memoryStore(rows, batches)
    const { provider, sentTo } = recordingProvider()

    await createMessageSender({ store, provider }).resume()

    expect(sentTo).toEqual(['+254700000001', '+254700000002', '+254700000003'])
    expect(rows.every((r) => r.status === 'sent')).toBe(true)
    expect(batches[1]).toBe('completed')
  })

  it('on resume, leaves recently claimed rows to the instance that claimed them', async () => {
    const rows = pendingRows(1, 1)
    rows[0].status = 'sending'
    rows[0].claimedAt = Date.now()
    const batches: Record<number, BatchStatus> = { 1: 'sending' }
    const { store } = memoryStore(rows, batches)
    const { provider, sentTo } = recordingProvider()

    await createMessageSender({ store, provider }).resume()

    expect(sentTo).toEqual([])
    expect(rows[0].status).toBe('sending')
    expect(batches[1]).toBe('sending')
  })

  it('reports an error inside the loop instead of rejecting', async () => {
    const { store } = memoryStore(pendingRows(1, 1), { 1: 'queued' })
    store.claim = async () => {
      throw new Error('connection lost')
    }
    const onError = vi.fn()
    const sender = createMessageSender({ store, provider: recordingProvider().provider, onError })

    await expect(sender.start(1)).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(1, expect.objectContaining({ message: 'connection lost' }))
    expect(sender.isRunning(1)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/sender.test.ts`
Expected: FAIL — cannot resolve `./sender.js`.

- [ ] **Step 3: Create `src/modules/messaging/sender.ts`**

```ts
import type { NotificationProvider } from '../notifications/notifications.provider.js'

export interface ClaimedMessage {
  id: number
  channel: 'sms' | 'email'
  recipientPhone: string | null
  recipientEmail: string | null
  subject: string | null
  body: string
}

/** Persistence the sender needs. `claim` must be atomic across processes. */
export interface SenderStore {
  markBatchSending(batchId: number): Promise<void>
  claim(batchId: number, limit: number): Promise<ClaimedMessage[]>
  markSent(id: number): Promise<void>
  markFailed(id: number, reason: string): Promise<void>
  /** Rows still pending or sending. */
  countUnfinished(batchId: number): Promise<number>
  completeBatch(batchId: number): Promise<void>
  /** Returns rows claimed more than `olderThanMs` ago to pending; resolves to how many. */
  releaseStale(olderThanMs: number): Promise<number>
  unfinishedBatchIds(): Promise<number[]>
}

export interface SenderOptions {
  store: SenderStore
  provider: NotificationProvider
  onProgress?: (batchId: number) => void
  onError?: (batchId: number, err: unknown) => void
  claimSize?: number
  concurrency?: number
  staleAfterMs?: number
}

export interface MessageSender {
  start(batchId: number): Promise<void>
  resume(): Promise<void>
  isRunning(batchId: number): boolean
}

export function createMessageSender({
  store,
  provider,
  onProgress,
  onError,
  claimSize = 20,
  concurrency = 5,
  staleAfterMs = 5 * 60_000,
}: SenderOptions): MessageSender {
  const running = new Map<number, Promise<void>>()

  async function deliver(message: ClaimedMessage) {
    const to = message.channel === 'sms' ? message.recipientPhone : message.recipientEmail
    if (!to) return store.markFailed(message.id, 'No destination')
    try {
      const result = await provider.send({ channel: message.channel, to, subject: message.subject ?? undefined, body: message.body })
      if (result.success) await store.markSent(message.id)
      else await store.markFailed(message.id, result.failureReason ?? 'Unknown error')
    } catch (err) {
      await store.markFailed(message.id, err instanceof Error ? err.message : String(err))
    }
  }

  async function run(batchId: number) {
    await store.markBatchSending(batchId)
    for (;;) {
      const claimed = await store.claim(batchId, claimSize)
      if (claimed.length === 0) break
      for (let i = 0; i < claimed.length; i += concurrency) {
        await Promise.all(claimed.slice(i, i + concurrency).map(deliver))
        onProgress?.(batchId)
      }
    }
    // Rows another instance is still sending keep the batch open; that
    // instance, or the next resume, finishes it.
    if ((await store.countUnfinished(batchId)) === 0) {
      await store.completeBatch(batchId)
      onProgress?.(batchId)
    }
  }

  function start(batchId: number): Promise<void> {
    const existing = running.get(batchId)
    if (existing) return existing
    const job = run(batchId)
      .catch((err) => onError?.(batchId, err))
      .finally(() => running.delete(batchId))
    running.set(batchId, job)
    return job
  }

  async function resume() {
    await store.releaseStale(staleAfterMs)
    const batchIds = await store.unfinishedBatchIds()
    await Promise.all(batchIds.map(start))
  }

  return { start, resume, isRunning: (batchId) => running.has(batchId) }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/modules/messaging`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/messaging
git commit -m "feat(messaging): background sender with atomic claiming and resume"
```

### Task 7: Persistence — repository, sender store and sender instance

Database adapters have no unit tests here (the project has no database test harness); Task 9 exercises every query against the local database end to end. This task is verified by the compiler.

**Files:**
- Create: `src/modules/messaging/messaging.repository.ts`, `src/modules/messaging/messaging.store.ts`, `src/modules/messaging/messaging.sender.ts`
- Modify: `src/common/events.ts`

**Interfaces:**
- Consumes: schema tables from Task 1; `StudentContactRow`, `InvoiceItemLine`, `PersonRow`, `StaffRow`, `MessageRow`, `PersonHit` (Task 2); `SenderStore`, `ClaimedMessage`, `createMessageSender` (Task 6); `consoleNotificationProvider`, `NotificationProvider`; `broadcastChange`.
- Produces:
  - `messagingRepository` with `studentContacts(): Promise<StudentContactRow[]>`, `invoiceItemLines(): Promise<InvoiceItemLine[]>`, `activeTeachers(): Promise<PersonRow[]>`, `activeStaff(): Promise<StaffRow[]>`, `createBatch(batch: NewMessageBatch, rows: MessageRow[]): Promise<MessageBatch>`, `listBatches(): Promise<BatchSummary[]>`, `findBatch(id: number): Promise<BatchSummary | undefined>`, `batchRecipients(batchId: number)`, `searchPeople(q: string): Promise<PersonHit[]>`
  - types `MessageBatch`, `NewMessageBatch`, `BatchSummary` (exported from the repository file)
  - `messageSenderStore: SenderStore`
  - `messageSender: MessageSender`, `messageProvider: NotificationProvider`, `deliveryMode(): 'log_only' | 'live'`
  - `EventTopic` gains `'messages'`

- [ ] **Step 1: Add the `messages` topic**

In `src/common/events.ts`, change the last member of the `EventTopic` union from

```ts
  | 'compliance'
```

to

```ts
  | 'compliance'
  | 'messages'
```

- [ ] **Step 2: Create `src/modules/messaging/messaging.repository.ts`**

```ts
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  classes,
  feeInvoiceItems,
  feeInvoices,
  feePaymentAllocations,
  guardianStudents,
  messageBatches,
  notifications,
  staff,
  students,
  teachers,
  users,
} from '../../db/schema/index.js'
import type { InvoiceItemLine, MessageRow, PersonHit, PersonRow, StaffRow, StudentContactRow } from './messaging.types.js'

export type MessageBatch = typeof messageBatches.$inferSelect
export type NewMessageBatch = typeof messageBatches.$inferInsert

// Counts are computed from the batch's notifications, never stored.
const summaryColumns = {
  id: messageBatches.id,
  channel: messageBatches.channel,
  audiences: messageBatches.audiences,
  subject: messageBatches.subject,
  body: messageBatches.body,
  status: messageBatches.status,
  createdAt: messageBatches.createdAt,
  completedAt: messageBatches.completedAt,
  createdBy: messageBatches.createdBy,
  senderName: users.fullName,
  total: sql<number>`count(${notifications.id})::int`,
  sent: sql<number>`count(*) filter (where ${notifications.status} = 'sent')::int`,
  failed: sql<number>`count(*) filter (where ${notifications.status} = 'failed')::int`,
  skipped: sql<number>`count(*) filter (where ${notifications.status} = 'skipped')::int`,
  pending: sql<number>`count(*) filter (where ${notifications.status} in ('pending', 'sending'))::int`,
}

const summaries = (where?: SQL) =>
  db
    .select(summaryColumns)
    .from(messageBatches)
    .innerJoin(users, eq(users.id, messageBatches.createdBy))
    .leftJoin(notifications, eq(notifications.batchId, messageBatches.id))
    .where(where)
    .groupBy(messageBatches.id, users.fullName)
    .orderBy(desc(messageBatches.id))

export type BatchSummary = Awaited<ReturnType<typeof summaries>>[number]

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`

export const messagingRepository = {
  /** Active students with guardian fields and any linked parent account, primary link first. */
  studentContacts: (): Promise<StudentContactRow[]> =>
    db
      .select({
        studentId: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        classId: students.classId,
        className: classes.name,
        streamId: students.streamId,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        guardianEmail: students.guardianEmail,
        parentUserId: users.id,
        parentName: users.fullName,
        parentPhone: users.phone,
        parentEmail: users.email,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .leftJoin(guardianStudents, eq(guardianStudents.studentId, students.id))
      .leftJoin(users, eq(users.id, guardianStudents.userId))
      .where(eq(students.status, 'active'))
      .orderBy(asc(students.id), desc(guardianStudents.isPrimary), asc(guardianStudents.id)),

  /** Every invoice item of an active student with what has been allocated to it. */
  invoiceItemLines: (): Promise<InvoiceItemLine[]> =>
    db
      .select({
        studentId: feeInvoices.studentId,
        invoiceStatus: feeInvoices.status,
        amount: feeInvoiceItems.amount,
        allocated: sql<string>`coalesce(sum(${feePaymentAllocations.amountAllocated}), 0)`,
      })
      .from(feeInvoiceItems)
      .innerJoin(feeInvoices, eq(feeInvoices.id, feeInvoiceItems.invoiceId))
      .innerJoin(students, eq(students.id, feeInvoices.studentId))
      .leftJoin(feePaymentAllocations, eq(feePaymentAllocations.invoiceItemId, feeInvoiceItems.id))
      .where(eq(students.status, 'active'))
      .groupBy(feeInvoiceItems.id, feeInvoices.studentId, feeInvoices.status),

  activeTeachers: (): Promise<PersonRow[]> =>
    db
      .select({ id: teachers.id, fullName: teachers.fullName, phone: teachers.phone, email: teachers.email })
      .from(teachers)
      .where(eq(teachers.status, 'active'))
      .orderBy(asc(teachers.id)),

  activeStaff: (): Promise<StaffRow[]> =>
    db
      .select({ id: staff.id, fullName: staff.fullName, phone: staff.phone, email: staff.email, category: staff.category, teacherId: staff.teacherId })
      .from(staff)
      .where(eq(staff.status, 'active'))
      .orderBy(asc(staff.id)),

  /** The batch and all its rows in one transaction, so a batch never exists half-written. */
  createBatch: (batch: NewMessageBatch, rows: MessageRow[]): Promise<MessageBatch> =>
    db.transaction(async (tx) => {
      const [created] = await tx.insert(messageBatches).values(batch).returning()
      for (let i = 0; i < rows.length; i += 500) {
        await tx
          .insert(notifications)
          .values(rows.slice(i, i + 500).map((row) => ({ ...row, batchId: created.id, createdBy: batch.createdBy })))
      }
      return created
    }),

  listBatches: (): Promise<BatchSummary[]> => summaries().limit(100),

  findBatch: (id: number): Promise<BatchSummary | undefined> => summaries(eq(messageBatches.id, id)).then((rows) => rows[0]),

  batchRecipients: (batchId: number) =>
    db
      .select({
        id: notifications.id,
        recipientName: notifications.recipientName,
        channel: notifications.channel,
        recipientPhone: notifications.recipientPhone,
        recipientEmail: notifications.recipientEmail,
        status: notifications.status,
        failureReason: notifications.failureReason,
        sentAt: notifications.sentAt,
      })
      .from(notifications)
      .where(eq(notifications.batchId, batchId))
      .orderBy(asc(notifications.id)),

  /** Hand-picked search: families by a child's name or admission number, teachers, staff. */
  async searchPeople(q: string): Promise<PersonHit[]> {
    const pattern = likePattern(q)
    const [kids, teacherRows, staffRows] = await Promise.all([
      db
        .select({
          id: students.id,
          firstName: students.firstName,
          lastName: students.lastName,
          admissionNo: students.admissionNo,
          className: classes.name,
          guardianName: students.guardianName,
        })
        .from(students)
        .innerJoin(classes, eq(classes.id, students.classId))
        .where(
          and(
            eq(students.status, 'active'),
            or(ilike(students.firstName, pattern), ilike(students.lastName, pattern), ilike(students.admissionNo, pattern)),
          ),
        )
        .orderBy(asc(students.firstName), asc(students.lastName))
        .limit(10),
      db
        .select({ id: teachers.id, fullName: teachers.fullName, staffNo: teachers.staffNo })
        .from(teachers)
        .where(and(eq(teachers.status, 'active'), or(ilike(teachers.fullName, pattern), ilike(teachers.staffNo, pattern))))
        .orderBy(asc(teachers.fullName))
        .limit(10),
      db
        .select({ id: staff.id, fullName: staff.fullName, staffNo: staff.staffNo, category: staff.category })
        .from(staff)
        .where(and(eq(staff.status, 'active'), or(ilike(staff.fullName, pattern), ilike(staff.staffNo, pattern))))
        .orderBy(asc(staff.fullName))
        .limit(10),
    ])
    return [
      ...kids.map((k) => ({
        kind: 'family' as const,
        id: k.id,
        label: `Family of ${k.firstName} ${k.lastName}`,
        detail: `${k.admissionNo} · ${k.className}${k.guardianName ? ` · ${k.guardianName}` : ''}`,
      })),
      ...teacherRows.map((t) => ({ kind: 'teacher' as const, id: t.id, label: t.fullName, detail: `Teacher · ${t.staffNo}` })),
      ...staffRows.map((s) => ({
        kind: 'staff' as const,
        id: s.id,
        label: s.fullName,
        detail: `${s.category === 'teaching' ? 'Teaching' : 'Non-teaching'} staff · ${s.staffNo}`,
      })),
    ]
  },
}
```

- [ ] **Step 3: Create `src/modules/messaging/messaging.store.ts`**

```ts
import { and, asc, eq, inArray, lt, ne, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { messageBatches, notifications } from '../../db/schema/index.js'
import type { ClaimedMessage, SenderStore } from './sender.js'

interface ClaimedRow extends Record<string, unknown> {
  id: number
  channel: 'sms' | 'email'
  recipient_phone: string | null
  recipient_email: string | null
  subject: string | null
  body: string
}

export const messageSenderStore: SenderStore = {
  async markBatchSending(batchId) {
    await db
      .update(messageBatches)
      .set({ status: 'sending' })
      .where(and(eq(messageBatches.id, batchId), eq(messageBatches.status, 'queued')))
  },

  // SKIP LOCKED: two processes can never claim the same row.
  async claim(batchId, limit): Promise<ClaimedMessage[]> {
    const rows = await db.execute<ClaimedRow>(sql`
      UPDATE notifications SET status = 'sending', claimed_at = now()
      WHERE id IN (
        SELECT id FROM notifications
        WHERE batch_id = ${batchId} AND status = 'pending'
        ORDER BY id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, channel, recipient_phone, recipient_email, subject, body`)
    return Array.from(rows)
      .map((r) => ({
        id: r.id,
        channel: r.channel,
        recipientPhone: r.recipient_phone,
        recipientEmail: r.recipient_email,
        subject: r.subject,
        body: r.body,
      }))
      .sort((a, b) => a.id - b.id)
  },

  async markSent(id) {
    await db
      .update(notifications)
      .set({ status: 'sent', sentAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.status, 'sending')))
  },

  async markFailed(id, reason) {
    await db
      .update(notifications)
      .set({ status: 'failed', failureReason: reason })
      .where(and(eq(notifications.id, id), eq(notifications.status, 'sending')))
  },

  async countUnfinished(batchId) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.batchId, batchId), inArray(notifications.status, ['pending', 'sending'])))
    return row?.n ?? 0
  },

  async completeBatch(batchId) {
    await db.update(messageBatches).set({ status: 'completed', completedAt: new Date() }).where(eq(messageBatches.id, batchId))
  },

  async releaseStale(olderThanMs) {
    const released = await db
      .update(notifications)
      .set({ status: 'pending', claimedAt: null })
      .where(and(eq(notifications.status, 'sending'), lt(notifications.claimedAt, new Date(Date.now() - olderThanMs))))
      .returning({ id: notifications.id })
    return released.length
  },

  async unfinishedBatchIds() {
    const rows = await db
      .select({ id: messageBatches.id })
      .from(messageBatches)
      .where(ne(messageBatches.status, 'completed'))
      .orderBy(asc(messageBatches.id))
    return rows.map((r) => r.id)
  },
}
```

- [ ] **Step 4: Create `src/modules/messaging/messaging.sender.ts`**

```ts
import { broadcastChange } from '../../common/events.js'
import { consoleNotificationProvider, type NotificationProvider } from '../notifications/notifications.provider.js'
import { messageSenderStore } from './messaging.store.js'
import { createMessageSender } from './sender.js'

// The provider bulk messages go out through. Replacing the console provider
// with a real SMS/email implementation here switches delivery on.
export const messageProvider: NotificationProvider = consoleNotificationProvider

export const deliveryMode = (): 'log_only' | 'live' => (messageProvider === consoleNotificationProvider ? 'log_only' : 'live')

export const messageSender = createMessageSender({
  store: messageSenderStore,
  provider: messageProvider,
  onProgress: () => broadcastChange('messages', 'progress'),
  onError: (batchId, err) => console.error(`Message batch ${batchId} stopped:`, err instanceof Error ? err.message : err),
})
```

- [ ] **Step 5: Typecheck and run the tests**

Run: `pnpm build && pnpm test`
Expected: `tsc` exits 0; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/common/events.ts src/modules/messaging
git commit -m "feat(messaging): repository, Postgres sender store and sender instance"
```

### Task 8: API — schema, service, routes, permission and boot resume

**Files:**
- Create: `src/modules/messaging/messaging.schema.ts`, `src/modules/messaging/messaging.service.ts`, `src/modules/messaging/messaging.controller.ts`, `src/modules/messaging/messaging.routes.ts`
- Test: `src/modules/messaging/messaging.schema.test.ts`, `src/modules/identity/rbac.test.ts` (modify)
- Modify: `src/modules/identity/rbac.ts`, `src/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7; `recordAudit`, `broadcastChange`, `actorId`, `ok`, `created`, `zValidator`, `getValidated`, `requirePermission`, `NotFoundError`, `ValidationError`.
- Produces (HTTP, all behind `notifications.send`, envelope `{ success, data }`):
  - `GET /api/messages/config` → `{ deliveryMode: 'log_only' | 'live' }`
  - `GET /api/messages/recipients/search?q=` → `PersonHit[]`
  - `POST /api/messages/preview` (body `ComposeInput`) → `PreviewSummary`
  - `POST /api/messages` (body `ComposeInput`) → 201 `MessageBatch & { recipients: number; skipped: number }`
  - `GET /api/messages` → `BatchSummary[]` newest first
  - `GET /api/messages/:id` → `BatchSummary & { recipients: Array<{ id, recipientName, channel, recipientPhone, recipientEmail, status, failureReason, sentAt }> }`
  - Validation and placeholder errors → 400 `{ success: false, error }`.

- [ ] **Step 1: Write the failing schema test `src/modules/messaging/messaging.schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { composeSchema, searchSchema } from './messaging.schema.js'

const base = { channel: 'sms', audiences: [{ type: 'all_parents' }], body: 'Hello {{name}}' }

describe('composeSchema', () => {
  it('accepts an SMS to mixed audiences without a subject', () => {
    const parsed = composeSchema.safeParse({
      ...base,
      audiences: [
        { type: 'class_parents', classId: 3, streamId: 7 },
        { type: 'fee_balance_parents', minimumBalance: 5000 },
        { type: 'all_teachers' },
        { type: 'all_staff', category: 'non_teaching' },
        { type: 'individuals', people: [{ kind: 'family', id: 12 }] },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('requires a subject whenever email is included', () => {
    expect(composeSchema.safeParse({ ...base, channel: 'email' }).success).toBe(false)
    expect(composeSchema.safeParse({ ...base, channel: 'both', subject: '   ' }).success).toBe(false)
    expect(composeSchema.safeParse({ ...base, channel: 'both', subject: 'Fees' }).success).toBe(true)
  })

  it('refuses a message with no audience, an unknown audience, or no one picked', () => {
    expect(composeSchema.safeParse({ ...base, audiences: [] }).success).toBe(false)
    expect(composeSchema.safeParse({ ...base, audiences: [{ type: 'everyone' }] }).success).toBe(false)
    expect(composeSchema.safeParse({ ...base, audiences: [{ type: 'individuals', people: [] }] }).success).toBe(false)
  })

  it('refuses a negative minimum balance and an empty body', () => {
    expect(composeSchema.safeParse({ ...base, audiences: [{ type: 'fee_balance_parents', minimumBalance: -1 }] }).success).toBe(false)
    expect(composeSchema.safeParse({ ...base, body: '   ' }).success).toBe(false)
  })

  it('keeps only kind and id for picked people', () => {
    const parsed = composeSchema.parse({ ...base, audiences: [{ type: 'individuals', people: [{ kind: 'teacher', id: 4, label: 'Faith' }] }] })
    expect(parsed.audiences[0]).toEqual({ type: 'individuals', people: [{ kind: 'teacher', id: 4 }] })
  })
})

describe('searchSchema', () => {
  it('needs at least two characters after trimming', () => {
    expect(searchSchema.safeParse({ q: ' a ' }).success).toBe(false)
    expect(searchSchema.parse({ q: ' ja ' }).q).toBe('ja')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/messaging.schema.test.ts`
Expected: FAIL — cannot resolve `./messaging.schema.js`.

- [ ] **Step 3: Create `src/modules/messaging/messaging.schema.ts`**

```ts
import { z } from 'zod'
import type { ComposeInput } from './messaging.types.js'

const id = z.number().int().positive()

export const audienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all_parents') }),
  z.object({ type: z.literal('class_parents'), classId: id, streamId: id.optional() }),
  z.object({ type: z.literal('fee_balance_parents'), minimumBalance: z.number().min(0).optional() }),
  z.object({ type: z.literal('all_teachers') }),
  z.object({ type: z.literal('all_staff'), category: z.enum(['teaching', 'non_teaching']).optional() }),
  z.object({
    type: z.literal('individuals'),
    people: z.array(z.object({ kind: z.enum(['family', 'teacher', 'staff']), id })).min(1).max(200),
  }),
])

export const composeSchema = z
  .object({
    channel: z.enum(['sms', 'email', 'both']),
    audiences: z.array(audienceSchema).min(1).max(20),
    subject: z.string().trim().max(150).optional(),
    body: z.string().trim().min(1).max(1600),
  })
  .refine((v) => v.channel === 'sms' || Boolean(v.subject), {
    message: 'A subject is required when sending email',
    path: ['subject'],
  })

export const searchSchema = z.object({ q: z.string().trim().min(2).max(60) })

export type ComposeBody = z.infer<typeof composeSchema>
export type SearchQuery = z.infer<typeof searchSchema>

// Compile-time guard: the validated body is usable wherever ComposeInput is expected.
export const asComposeInput = (body: ComposeBody): ComposeInput => body
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/modules/messaging/messaging.schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the failing permission test**

Append to `src/modules/identity/rbac.test.ts`:

```ts
describe('bulk messaging permission', () => {
  it('lets the Dean of Studies send messages alongside the Principal and Bursar', () => {
    expect(permsOf('Dean of Studies')).toContain('notifications.send')
    expect(holdersOf('notifications.send')).toEqual(expect.arrayContaining(['Principal', 'Dean of Studies', 'Bursar / School Accountant']))
  })
})
```

Run: `pnpm vitest run src/modules/identity/rbac.test.ts`
Expected: FAIL — `Dean of Studies` permissions do not contain `notifications.send`.

- [ ] **Step 6: Grant it**

In `src/modules/identity/rbac.ts`, in the `dean_of_studies` role, change

```ts
      'attendance.view', 'promotions.manage', 'promotions.view',
    ],
```

to

```ts
      'attendance.view', 'promotions.manage', 'promotions.view',
      'notifications.send',
    ],
```

Run: `pnpm vitest run src/modules/identity/rbac.test.ts`
Expected: PASS.

- [ ] **Step 7: Create `src/modules/messaging/messaging.service.ts`**

```ts
import { recordAudit } from '../../common/audit.js'
import { NotFoundError, ValidationError } from '../../common/errors.js'
import { broadcastChange } from '../../common/events.js'
import { studentBalances } from './balance.js'
import { assertPlaceholders, buildMessageRows, summarise } from './compose.js'
import { buildFamilies } from './families.js'
import { messagingRepository } from './messaging.repository.js'
import { deliveryMode, messageSender } from './messaging.sender.js'
import { resolveRecipients } from './recipients.js'
import type { Audience, ComposeInput } from './messaging.types.js'

async function loadRecipients(audiences: Audience[]) {
  const [contacts, lines, teacherRows, staffRows] = await Promise.all([
    messagingRepository.studentContacts(),
    messagingRepository.invoiceItemLines(),
    messagingRepository.activeTeachers(),
    messagingRepository.activeStaff(),
  ])
  const families = buildFamilies(contacts, studentBalances(lines))
  return resolveRecipients(audiences, { families, teachers: teacherRows, staff: staffRows })
}

export const messagingService = {
  config: () => ({ deliveryMode: deliveryMode() }),

  async preview(input: ComposeInput) {
    assertPlaceholders(input)
    const recipients = await loadRecipients(input.audiences)
    return summarise(input, recipients, buildMessageRows(input, recipients))
  },

  /** Saves the batch and every row, audits it, then hands it to the background sender. */
  async send(input: ComposeInput, actorUserId: number) {
    assertPlaceholders(input)
    const recipients = await loadRecipients(input.audiences)
    if (recipients.length === 0) throw new ValidationError('These audiences have no recipients')

    const rows = buildMessageRows(input, recipients)
    const skipped = rows.filter((r) => r.status === 'skipped').length
    const batch = await messagingRepository.createBatch(
      {
        createdBy: actorUserId,
        channel: input.channel,
        audiences: input.audiences,
        subject: input.subject || null,
        body: input.body,
        status: 'queued',
      },
      rows,
    )

    await recordAudit({
      userId: actorUserId,
      action: 'message.send',
      entityType: 'message_batch',
      entityId: batch.id,
      afterData: {
        channel: input.channel,
        audiences: input.audiences,
        subject: input.subject || null,
        body: input.body,
        recipients: recipients.length,
        skipped,
      },
    })
    broadcastChange('messages', 'created')
    void messageSender.start(batch.id)
    return { ...batch, recipients: recipients.length, skipped }
  },

  list: () => messagingRepository.listBatches(),

  async getById(id: number) {
    const batch = await messagingRepository.findBatch(id)
    if (!batch) throw new NotFoundError(`Message batch #${id} not found`)
    return { ...batch, recipients: await messagingRepository.batchRecipients(id) }
  },

  search: (q: string) => messagingRepository.searchPeople(q),
}
```

- [ ] **Step 8: Create `src/modules/messaging/messaging.controller.ts`**

```ts
import type { Context } from 'hono'
import { actorId } from '../../common/actor.js'
import { created, ok } from '../../common/response.js'
import { getValidated } from '../../common/validate.js'
import { asComposeInput, type ComposeBody, type SearchQuery } from './messaging.schema.js'
import { messagingService } from './messaging.service.js'

export const messagingController = {
  config: (c: Context) => ok(c, messagingService.config()),
  search: async (c: Context) => ok(c, await messagingService.search(getValidated<SearchQuery>(c, 'query').q)),
  preview: async (c: Context) => ok(c, await messagingService.preview(asComposeInput(getValidated<ComposeBody>(c, 'json')))),
  // The sender is the logged-in user, never a value from the body.
  send: async (c: Context) => created(c, await messagingService.send(asComposeInput(getValidated<ComposeBody>(c, 'json')), actorId(c))),
  list: async (c: Context) => ok(c, await messagingService.list()),
  getById: async (c: Context) => ok(c, await messagingService.getById(Number(c.req.param('id')))),
}
```

- [ ] **Step 9: Create `src/modules/messaging/messaging.routes.ts`**

```ts
import { Hono } from 'hono'
import { requirePermission } from '../../common/auth.js'
import { zValidator } from '../../common/validate.js'
import { messagingController } from './messaging.controller.js'
import { composeSchema, searchSchema } from './messaging.schema.js'

export const messagingRoutes = new Hono()

const canSend = requirePermission('notifications.send')

messagingRoutes.get('/config', canSend, messagingController.config)
messagingRoutes.get('/recipients/search', canSend, zValidator('query', searchSchema), messagingController.search)
messagingRoutes.post('/preview', canSend, zValidator('json', composeSchema), messagingController.preview)
messagingRoutes.get('/', canSend, messagingController.list)
messagingRoutes.post('/', canSend, zValidator('json', composeSchema), messagingController.send)
messagingRoutes.get('/:id{[0-9]+}', canSend, messagingController.getById)
```

- [ ] **Step 10: Mount the routes and resume on boot in `src/index.ts`**

After the line `import { notificationsRoutes } from './modules/notifications/notifications.routes.js'`, add:

```ts
import { messagingRoutes } from './modules/messaging/messaging.routes.js'
import { messageSender } from './modules/messaging/messaging.sender.js'
```

After the line `app.route('/api/notifications', notificationsRoutes)`, add:

```ts
app.route('/api/messages', messagingRoutes)
```

Between the database-check `try { … } catch { … }` block and `serve({`, add:

```ts
// Finish message batches a restart or crash interrupted. Runs in the
// background — startup never waits on it and a failure here is only logged.
messageSender.resume().catch((err) => {
  console.error('Could not resume message batches:', err instanceof Error ? err.message : err)
})
```

- [ ] **Step 11: Typecheck and run every test**

Run: `pnpm build && pnpm test`
Expected: `tsc` exits 0; all tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/modules/messaging src/modules/identity/rbac.ts src/modules/identity/rbac.test.ts src/index.ts
git commit -m "feat(messaging): messaging API, Dean may send, resume batches on boot"
```

### Task 9: End-to-end verification against the LOCAL database

Proves the queries, the transaction, the claim SQL, the audit actor and restart-resume against real Postgres. **Never point any of this at production.** `Accounts/.env` holds the production `DATABASE_URL` and wins over shell variables, so every process here runs from a scratch directory with its own `.env`.

**Files:**
- Create (outside the repo, not committed): `$E2E_DIR/.env`, `$E2E_DIR/messaging-e2e.mjs`, `$E2E_DIR/server.log`, `$E2E_DIR/server-restart.log`

**Interfaces:**
- Consumes: the HTTP API from Task 8; demo users `dean@school.local`, `bursar@school.local`, `principal@school.local`, `teacher@school.local`; `GET /api/teachers`, `GET /api/staff`, `GET /api/students`, `GET /api/students/classes`, `GET /api/auth/me`.
- Produces: a pass/fail report (in the task report file) — nothing in git.

- [ ] **Step 1: Prepare the scratch environment**

Use the session scratchpad (or any directory outside both repos) as `E2E_DIR`.

```bash
export ACCOUNTS="c:/Users/ADMIN001/Secschoolproject/Accounts"
export E2E_DIR="<scratch directory>/e2e-messaging"
mkdir -p "$E2E_DIR"
sed -e 's#^DATABASE_URL=.*#DATABASE_URL=postgres://accounts:accounts_dev_password@localhost:5432/school_accounts#' -e '/^PORT=/d' "$ACCOUNTS/.env" > "$E2E_DIR/.env"
echo 'PORT=4199' >> "$E2E_DIR/.env"
grep -o '^DATABASE_URL=[^:]*://[^:]*:[^@]*@[^/]*' "$E2E_DIR/.env" | sed 's#//.*@#//***@#'   # must end in @localhost:5432
```

Expected: `DATABASE_URL=postgres://***@localhost:5432`. Never print the file itself.

- [ ] **Step 2: Make sure the local database has the migration, the data and the permissions**

```bash
cd "$ACCOUNTS"
docker compose up -d db
docker compose exec -T db psql -U accounts -d school_accounts -tAc "select to_regclass('public.message_batches') is not null, (select count(*) from students where status = 'active'), (select count(*) from users where email in ('dean@school.local','bursar@school.local','principal@school.local','teacher@school.local'))"
```

Expected: `t|<n > 0>|4`.
- If the first value is `f`, apply the migration as in Task 1 Step 7.
- If there are no students or fewer than 4 demo users, seed **from the scratch directory** (so the local `.env` is used): `cd "$E2E_DIR" && "$ACCOUNTS/node_modules/.bin/tsx" "$ACCOUNTS/src/db/seed.ts" && "$ACCOUNTS/node_modules/.bin/tsx" "$ACCOUNTS/src/db/seed-demo-users.ts" && "$ACCOUNTS/node_modules/.bin/tsx" "$ACCOUNTS/src/db/seed-school-data.ts"`.

Then sync permissions so the Dean holds `notifications.send` locally:

```bash
cd "$E2E_DIR" && "$ACCOUNTS/node_modules/.bin/tsx" "$ACCOUNTS/src/db/sync-rbac.ts"
```

- [ ] **Step 3: Build and start the server from the scratch directory**

```bash
cd "$ACCOUNTS" && pnpm build
cd "$E2E_DIR" && node "$ACCOUNTS/dist/index.js" > server.log 2>&1 &
```

(With the Bash tool, run the `node` line with `run_in_background: true`.) Wait until `server.log` contains `Server is running on port:4199`.

- [ ] **Step 4: Write `$E2E_DIR/messaging-e2e.mjs`**

```js
// End-to-end checks for bulk messaging against the LOCAL database through the
// real built server on port 4199. Reads the demo password from the scratch
// .env and never prints it.
import { readFileSync } from 'node:fs'

const env = readFileSync(new URL('./.env', import.meta.url), 'utf8')
const password = (env.match(/^SEED_ADMIN_PASSWORD=(.*)$/m)?.[1] ?? '').trim() || 'ChangeMe123!'
const BASE = 'http://localhost:4199/api'
const results = []
const check = (name, cond, detail = '') => results.push({ name, ok: Boolean(cond), detail })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, json }
}

async function login(email) {
  const r = await api(null, 'POST', '/auth/login', { email, password })
  if (r.status !== 200) throw new Error(`login failed for ${email}: HTTP ${r.status} ${r.json?.error ?? ''}`)
  return r.json.data.token
}

// Same rules as the backend, re-implemented so the expected count is independent.
const normalisePhone = (raw) => {
  if (!raw) return null
  const s = raw.replace(/[\s-]/g, '')
  if (/^0[17]\d{8}$/.test(s)) return `+254${s.slice(1)}`
  if (/^254\d{9}$/.test(s)) return `+${s}`
  if (/^\+254\d{9}$/.test(s)) return s
  return null
}
function distinctPeople(teachers, staff) {
  const owner = new Map()
  const parent = []
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const people = [
    ...teachers.map((t) => ({ keys: [`teacher:${t.id}`, normalisePhone(t.phone) && `p:${normalisePhone(t.phone)}`, t.email && `e:${t.email.toLowerCase()}`] })),
    ...staff.map((s) => ({ keys: [`staff:${s.id}`, s.teacherId && `teacher:${s.teacherId}`, normalisePhone(s.phone) && `p:${normalisePhone(s.phone)}`, s.email && `e:${s.email.toLowerCase()}`] })),
  ]
  people.forEach((p, i) => {
    parent[i] = i
    for (const key of p.keys.filter(Boolean)) {
      if (owner.has(key)) parent[find(i)] = find(owner.get(key))
      else owner.set(key, i)
    }
  })
  return new Set(people.map((_, i) => find(i))).size
}

async function waitForCompletion(token, id) {
  for (let i = 0; i < 30; i++) {
    const r = await api(token, 'GET', `/messages/${id}`)
    if (r.json?.data?.status === 'completed') return r.json.data
    await sleep(500)
  }
  return (await api(token, 'GET', `/messages/${id}`)).json?.data
}

const dean = await login('dean@school.local')
const bursar = await login('bursar@school.local')
const principal = await login('principal@school.local')
const teacher = await login('teacher@school.local')
const deanMe = (await api(dean, 'GET', '/auth/me')).json.data
let r

// A. Who may use messaging
r = await api(teacher, 'GET', '/messages/config')
check('A teacher is refused (no notifications.send)', r.status === 403, r.status)
r = await api(dean, 'GET', '/messages/config')
check('The Dean may use messaging', r.status === 200, r.status)
check('...and delivery mode is log_only', r.json?.data?.deliveryMode === 'log_only', JSON.stringify(r.json?.data))
check('The Principal may use messaging', (await api(principal, 'GET', '/messages/config')).status === 200)
check('The Bursar may use messaging', (await api(bursar, 'GET', '/messages/config')).status === 200)

// B. Teachers + staff: one message per person
const teachers = (await api(dean, 'GET', '/teachers')).json.data.filter((t) => t.status === 'active')
const staff = (await api(dean, 'GET', '/staff')).json.data.filter((s) => s.status === 'active')
const expectedPeople = distinctPeople(teachers, staff)
r = await api(dean, 'POST', '/messages/preview', { channel: 'sms', audiences: [{ type: 'all_teachers' }, { type: 'all_staff' }], body: 'Hello {{name}}' })
check('Teachers + staff preview succeeds', r.status === 200, `${r.status} ${r.json?.error ?? ''}`)
check(
  `...and counts each person once (${teachers.length} teachers + ${staff.length} staff records -> ${expectedPeople} people)`,
  r.json?.data?.recipients === expectedPeople && expectedPeople < teachers.length + staff.length,
  JSON.stringify({ got: r.json?.data?.recipients, expectedPeople }),
)
const teachersAndStaff = r.json?.data?.recipients

// C. A class's parents plus teachers and staff
const classId = (await api(dean, 'GET', '/students/classes')).json.data[0].id
r = await api(dean, 'POST', '/messages/preview', { channel: 'sms', audiences: [{ type: 'class_parents', classId }], body: 'Hello {{name}}' })
const classOnly = r.json?.data?.recipients
check('A class-parents preview finds families', classOnly > 0, JSON.stringify(r.json))
r = await api(dean, 'POST', '/messages/preview', {
  channel: 'sms',
  audiences: [{ type: 'class_parents', classId }, { type: 'all_teachers' }, { type: 'all_staff' }],
  body: 'Hello {{name}}',
})
check('Class parents + teachers + staff add up without double counting', r.json?.data?.recipients === classOnly + teachersAndStaff, JSON.stringify({ got: r.json?.data?.recipients, classOnly, teachersAndStaff }))
check('...and returns three rendered samples with no braces left', r.json?.data?.samples?.length === 3 && r.json.data.samples.every((s) => !s.body.includes('{{')), JSON.stringify(r.json?.data?.samples))

// D. Refusals write nothing
const before = (await api(dean, 'GET', '/messages')).json.data.length
r = await api(dean, 'POST', '/messages', { channel: 'sms', audiences: [{ type: 'all_parents' }], body: 'Please pay {{balanse}}' })
check('A misspelled placeholder is refused with 400', r.status === 400, r.status)
check('...naming the bad token and the valid list', /\{\{balanse\}\}/.test(r.json?.error ?? '') && /\{\{balance\}\}/.test(r.json?.error ?? ''), r.json?.error)
r = await api(dean, 'POST', '/messages', { channel: 'sms', audiences: [{ type: 'all_teachers' }], body: 'Your balance is {{balance}}' })
check('A parent placeholder sent to teachers is refused with 400', r.status === 400, `${r.status} ${r.json?.error ?? ''}`)
r = await api(dean, 'POST', '/messages', { channel: 'email', audiences: [{ type: 'all_teachers' }], body: 'Hi' })
check('Email without a subject is refused with 400', r.status === 400, r.status)
check('...and none of the refusals created a batch', (await api(dean, 'GET', '/messages')).json.data.length === before)

// E. Bursar emails staff: skipped rows say why and counts add up
r = await api(bursar, 'POST', '/messages', { channel: 'email', audiences: [{ type: 'all_staff' }], subject: 'Staff meeting', body: 'Dear {{name}}, staff meeting at 4pm.' })
check('The Bursar can send an email batch (201)', r.status === 201, `${r.status} ${r.json?.error ?? ''}`)
const bursarBatchId = r.json?.data?.id
const emailRecipients = r.json?.data?.recipients
let batch = await waitForCompletion(bursar, bursarBatchId)
check('...which completes in the background', batch?.status === 'completed', batch?.status)
check('...with one email row per recipient', batch?.total === emailRecipients && batch?.recipients?.length === emailRecipients, JSON.stringify({ total: batch?.total, emailRecipients }))
check('...every skipped row has no email and the reason "No email address"', batch?.recipients?.filter((x) => x.status === 'skipped').every((x) => x.recipientEmail === null && x.failureReason === 'No email address'))
check('...and sent + failed + skipped = total with nothing pending', batch && batch.sent + batch.failed + batch.skipped === batch.total && batch.pending === 0, JSON.stringify(batch && { sent: batch.sent, failed: batch.failed, skipped: batch.skipped, total: batch.total }))

// F. Dean sends a personalised fee reminder by SMS
r = await api(dean, 'POST', '/messages', {
  channel: 'sms',
  audiences: [{ type: 'fee_balance_parents' }],
  body: 'Dear {{parentName}}, the fee balance for {{studentName}} ({{className}}) is KES {{balance}}.',
})
check('The Dean can send a personalised SMS batch (201)', r.status === 201, `${r.status} ${r.json?.error ?? ''}`)
const deanBatchId = r.json?.data?.id
batch = await waitForCompletion(dean, deanBatchId)
check('...which completes', batch?.status === 'completed', batch?.status)
check('...sending only to +254 numbers', batch?.recipients?.filter((x) => x.status === 'sent').every((x) => /^\+254\d{9}$/.test(x.recipientPhone)))
check('...with skip reasons only from the allowed set', batch?.recipients?.filter((x) => x.status === 'skipped').every((x) => ['No phone number', 'Invalid phone number'].includes(x.failureReason)))
check('...and at least five rows sent (needed for the restart check)', batch?.sent >= 5, batch?.sent)

// G. History and search
r = await api(dean, 'GET', '/messages')
check('History lists newest first with the real sender name', r.json?.data?.[0]?.id === deanBatchId && r.json.data[0].senderName === deanMe.fullName, JSON.stringify(r.json?.data?.[0] && { id: r.json.data[0].id, senderName: r.json.data[0].senderName }))
const aStudent = (await api(dean, 'GET', '/students')).json.data.find((s) => s.status === 'active')
r = await api(dean, 'GET', `/messages/recipients/search?q=${encodeURIComponent(aStudent.firstName.slice(0, 3))}`)
check("Search finds a student's family", r.json?.data?.some((h) => h.kind === 'family' && h.id === aStudent.id), JSON.stringify(r.json?.data?.slice(0, 3)))
check('A one-character search is refused with 400', (await api(dean, 'GET', '/messages/recipients/search?q=a')).status === 400)

console.log('ids:', JSON.stringify({ bursarBatchId, deanBatchId, deanSent: batch?.sent }))
for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.ok ? '' : `  -> ${x.detail}`}`)
console.log(`${results.filter((x) => x.ok).length}/${results.length} checks passed`)
```

- [ ] **Step 5: Run it**

Run: `node "$E2E_DIR/messaging-e2e.mjs"`
Expected: every line `PASS`, final line `N/N checks passed`, and an `ids:` line. Keep `bursarBatchId`, `deanBatchId` and `deanSent` for the next steps. Any `FAIL` is a defect: fix it (with a unit test where the logic is pure), rebuild, restart the server and re-run.

- [ ] **Step 6: Check the audit trail names the real senders**

```bash
cd "$ACCOUNTS"
docker compose exec -T db psql -U accounts -d school_accounts -tAc "select a.entity_id, u.email, a.user_id = b.created_by, a.after_data->>'recipients' is not null from audit_log a join message_batches b on b.id::text = a.entity_id join users u on u.id = a.user_id where a.action = 'message.send' and a.entity_type = 'message_batch' and a.entity_id in ('<bursarBatchId>', '<deanBatchId>') order by a.entity_id::int"
```

Expected: `<bursarBatchId>|bursar@school.local|t|t` and `<deanBatchId>|dean@school.local|t|t`.

- [ ] **Step 7: Interrupt a batch and prove restart finishes it without resending**

Stop the server (kill the background `node` process). Then put five of the Dean batch's sent rows back into the states a crash leaves behind — three claimed ten minutes ago, two never claimed — and reopen the batch:

```bash
docker compose exec -T db psql -U accounts -d school_accounts -v ON_ERROR_STOP=1 <<'SQL'
update notifications set status = 'sending', claimed_at = now() - interval '10 minutes', sent_at = null
 where id in (select id from notifications where batch_id = <deanBatchId> and status = 'sent' order by id limit 3);
update notifications set status = 'pending', claimed_at = null, sent_at = null
 where id in (select id from notifications where batch_id = <deanBatchId> and status = 'sent' order by id desc limit 2);
update message_batches set status = 'sending', completed_at = null where id = <deanBatchId>;
select status, count(*) from notifications where batch_id = <deanBatchId> group by status order by status;
SQL
```

Expected: the final select shows `pending|2` and `sending|3` alongside the remaining `sent` (and any `skipped`).

Start the server again with a fresh log: `cd "$E2E_DIR" && node "$ACCOUNTS/dist/index.js" > server-restart.log 2>&1 &` (background). Wait for `Server is running on port:4199`, then 5 seconds more, and check:

```bash
grep -c '\[notification:sms\]' "$E2E_DIR/server-restart.log"
docker compose exec -T db psql -U accounts -d school_accounts -tAc "select b.status, count(*) filter (where n.status = 'sent'), count(*) filter (where n.status in ('pending','sending')) from message_batches b join notifications n on n.batch_id = b.id where b.id = <deanBatchId> group by b.status"
```

Expected: the grep prints exactly `5` (each interrupted row delivered once, nothing else resent), and psql prints `completed|<deanSent>|0`.

- [ ] **Step 8: Clean up**

Stop the server. Delete `$E2E_DIR/.env` (it holds copied secrets). Record in the task report: the check list output, the audit rows, the restart counts. Nothing is committed in this task.

## Frontend

All frontend commands run in `c:\Users\ADMIN001\Secschoolproject\Schoolfrontend` on branch `feat/bulk-messaging` (it already contains the dashboard and students/teachers work).

### Task 10: SMS counter and placeholder helpers

**Files:**
- Create: `src/modules/messaging/types.ts`, `src/modules/messaging/smsSegments.ts`, `src/modules/messaging/placeholders.ts`
- Test: `src/modules/messaging/smsSegments.test.ts`, `src/modules/messaging/placeholders.test.ts`

**Interfaces:**
- Produces:
  - all types in `types.ts` (used by Tasks 11–12)
  - `countSms(text: string): SmsCount` with `SmsCount = { encoding: 'GSM-7' | 'UCS-2'; units: number; segments: number; perSegment: number }`
  - `PLACEHOLDER_HELP: Record<string, string>`, `validPlaceholders(audiences: Audience[]): string[]`
  - `AudienceLookup = { className: (id: number) => string | undefined; streamName: (id: number) => string | undefined }`
  - `describeAudience(audience: Audience, lookup: AudienceLookup): string`, `audienceSummary(audiences: Audience[], lookup: AudienceLookup): string`

- [ ] **Step 1: Create `src/modules/messaging/types.ts`**

```ts
export type Channel = 'sms' | 'email' | 'both'
export type DeliveryChannel = 'sms' | 'email'
export type StaffCategory = 'teaching' | 'non_teaching'

/** A hand-picked person. `label` is for display only; stored batches do not keep it. */
export interface PickedPerson {
  kind: 'family' | 'teacher' | 'staff'
  id: number
  label?: string
}

export type Audience =
  | { type: 'all_parents' }
  | { type: 'class_parents'; classId: number; streamId?: number }
  | { type: 'fee_balance_parents'; minimumBalance?: number }
  | { type: 'all_teachers' }
  | { type: 'all_staff'; category?: StaffCategory }
  | { type: 'individuals'; people: PickedPerson[] }

export interface ComposeRequest {
  channel: Channel
  audiences: Audience[]
  subject?: string
  body: string
}

export interface PreviewResult {
  recipients: number
  channels: Array<{ channel: DeliveryChannel; queued: number; skipped: number }>
  skipped: number
  samples: Array<{ name: string; subject: string | null; body: string }>
}

export type BatchStatus = 'queued' | 'sending' | 'completed'
export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'

export interface BatchSummary {
  id: number
  channel: Channel
  audiences: Audience[]
  subject: string | null
  body: string
  status: BatchStatus
  createdAt: string
  completedAt: string | null
  createdBy: number
  senderName: string
  total: number
  sent: number
  failed: number
  skipped: number
  pending: number
}

export interface BatchRecipient {
  id: number
  recipientName: string | null
  channel: DeliveryChannel
  recipientPhone: string | null
  recipientEmail: string | null
  status: MessageStatus
  failureReason: string | null
  sentAt: string | null
}

export interface BatchDetail extends BatchSummary {
  recipients: BatchRecipient[]
}

export interface SentBatch {
  id: number
  recipients: number
  skipped: number
}

export interface PersonHit {
  kind: PickedPerson['kind']
  id: number
  label: string
  detail: string
}

export interface MessagingConfig {
  deliveryMode: 'log_only' | 'live'
}
```

- [ ] **Step 2: Write the failing test `src/modules/messaging/smsSegments.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { countSms } from './smsSegments'

describe('countSms', () => {
  it('counts nothing for an empty message', () => {
    expect(countSms('')).toEqual({ encoding: 'GSM-7', units: 0, segments: 0, perSegment: 160 })
  })

  it('fits 160 GSM-7 characters in one part and uses 153 per part beyond that', () => {
    expect(countSms('a'.repeat(160))).toEqual({ encoding: 'GSM-7', units: 160, segments: 1, perSegment: 160 })
    expect(countSms('a'.repeat(161))).toEqual({ encoding: 'GSM-7', units: 161, segments: 2, perSegment: 153 })
    expect(countSms('a'.repeat(306)).segments).toBe(2)
    expect(countSms('a'.repeat(307)).segments).toBe(3)
  })

  it('counts extended GSM characters as two', () => {
    expect(countSms('€[]')).toMatchObject({ encoding: 'GSM-7', units: 6 })
    expect(countSms(`${'a'.repeat(159)}€`)).toMatchObject({ units: 161, segments: 2 })
  })

  it('keeps letters that GSM-7 includes, such as é and Ñ, in GSM-7', () => {
    expect(countSms('Café Ñ').encoding).toBe('GSM-7')
  })

  it('switches to UCS-2 (70, then 67 per part) when any character is outside GSM-7', () => {
    expect(countSms('ł'.repeat(70))).toEqual({ encoding: 'UCS-2', units: 70, segments: 1, perSegment: 70 })
    expect(countSms('ł'.repeat(71))).toEqual({ encoding: 'UCS-2', units: 71, segments: 2, perSegment: 67 })
    expect(countSms('ł'.repeat(134)).segments).toBe(2)
    expect(countSms('ł'.repeat(135)).segments).toBe(3)
  })

  it('counts an emoji as two UCS-2 units', () => {
    expect(countSms('Hi 😀')).toMatchObject({ encoding: 'UCS-2', units: 5, segments: 1 })
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/smsSegments.test.ts`
Expected: FAIL — cannot resolve `./smsSegments`.

- [ ] **Step 4: Create `src/modules/messaging/smsSegments.ts`**

```ts
// GSM 03.38 basic character set (escape excluded) and its extension table,
// whose characters take two septets each.
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXTENDED = '^{}\\[~]|€\f'

export interface SmsCount {
  encoding: 'GSM-7' | 'UCS-2'
  /** Septets for GSM-7; UTF-16 code units for UCS-2 (an emoji is two). */
  units: number
  segments: number
  perSegment: number
}

export function countSms(text: string): SmsCount {
  let units = 0
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) units += 1
    else if (GSM_EXTENDED.includes(ch)) units += 2
    else {
      const length = text.length
      const single = length <= 70
      return { encoding: 'UCS-2', units: length, segments: length === 0 ? 0 : single ? 1 : Math.ceil(length / 67), perSegment: single ? 70 : 67 }
    }
  }
  const single = units <= 160
  return { encoding: 'GSM-7', units, segments: units === 0 ? 0 : single ? 1 : Math.ceil(units / 153), perSegment: single ? 160 : 153 }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run src/modules/messaging/smsSegments.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test `src/modules/messaging/placeholders.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { audienceSummary, describeAudience, validPlaceholders, type AudienceLookup } from './placeholders'

const PARENT_SET = ['name', 'parentName', 'studentName', 'className', 'balance']
const lookup: AudienceLookup = {
  className: (id) => new Map([[3, 'Form 3']]).get(id),
  streamName: (id) => new Map([[7, 'North']]).get(id),
}

describe('validPlaceholders', () => {
  it('offers only {{name}} before any audience is chosen', () => {
    expect(validPlaceholders([])).toEqual(['name'])
  })

  it('offers every placeholder for parents, including hand-picked families', () => {
    expect(validPlaceholders([{ type: 'all_parents' }])).toEqual(PARENT_SET)
    expect(validPlaceholders([{ type: 'class_parents', classId: 3 }, { type: 'fee_balance_parents' }])).toEqual(PARENT_SET)
    expect(validPlaceholders([{ type: 'individuals', people: [{ kind: 'family', id: 4 }] }])).toEqual(PARENT_SET)
  })

  it('offers only {{name}} to teachers, staff, or any mix with them', () => {
    expect(validPlaceholders([{ type: 'all_teachers' }])).toEqual(['name'])
    expect(validPlaceholders([{ type: 'all_staff' }])).toEqual(['name'])
    expect(validPlaceholders([{ type: 'all_parents' }, { type: 'all_teachers' }])).toEqual(['name'])
    expect(validPlaceholders([{ type: 'individuals', people: [{ kind: 'family', id: 4 }, { kind: 'teacher', id: 1 }] }])).toEqual(['name'])
  })
})

describe('describeAudience', () => {
  it('describes each audience in plain words', () => {
    expect(describeAudience({ type: 'all_parents' }, lookup)).toBe('All parents')
    expect(describeAudience({ type: 'class_parents', classId: 3 }, lookup)).toBe('Parents of Form 3')
    expect(describeAudience({ type: 'class_parents', classId: 3, streamId: 7 }, lookup)).toBe('Parents of Form 3 North')
    expect(describeAudience({ type: 'class_parents', classId: 3, streamId: 9 }, lookup)).toBe('Parents of Form 3 (one stream)')
    expect(describeAudience({ type: 'class_parents', classId: 5 }, lookup)).toBe('Parents of class #5')
    expect(describeAudience({ type: 'fee_balance_parents' }, lookup)).toBe('Parents with a fee balance')
    expect(describeAudience({ type: 'fee_balance_parents', minimumBalance: 5000 }, lookup)).toBe('Parents with a fee balance over KES 5,000')
    expect(describeAudience({ type: 'all_teachers' }, lookup)).toBe('All teachers')
    expect(describeAudience({ type: 'all_staff' }, lookup)).toBe('All staff')
    expect(describeAudience({ type: 'all_staff', category: 'teaching' }, lookup)).toBe('Teaching staff')
    expect(describeAudience({ type: 'all_staff', category: 'non_teaching' }, lookup)).toBe('Non-teaching staff')
  })

  it('names one picked person when the label is known, and counts otherwise', () => {
    expect(describeAudience({ type: 'individuals', people: [{ kind: 'teacher', id: 1, label: 'Faith Nyambura' }] }, lookup)).toBe('Faith Nyambura')
    expect(describeAudience({ type: 'individuals', people: [{ kind: 'teacher', id: 1 }] }, lookup)).toBe('1 person picked by hand')
    expect(
      describeAudience({ type: 'individuals', people: [{ kind: 'teacher', id: 1 }, { kind: 'staff', id: 2 }, { kind: 'family', id: 3 }] }, lookup),
    ).toBe('3 people picked by hand')
  })
})

describe('audienceSummary', () => {
  it('joins the audiences, or says none is selected', () => {
    expect(audienceSummary([{ type: 'class_parents', classId: 3, streamId: 7 }, { type: 'all_teachers' }], lookup)).toBe(
      'Parents of Form 3 North · All teachers',
    )
    expect(audienceSummary([], lookup)).toBe('No audience selected')
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/placeholders.test.ts`
Expected: FAIL — cannot resolve `./placeholders`.

- [ ] **Step 8: Create `src/modules/messaging/placeholders.ts`**

```ts
import type { Audience } from './types'

type RecipientKind = 'parent' | 'teacher' | 'staff'

// Mirrors the backend's rules (Accounts src/modules/messaging/placeholders.ts);
// the backend still validates every send.
const SUPPORTED_BY: Record<string, RecipientKind[]> = {
  name: ['parent', 'teacher', 'staff'],
  parentName: ['parent'],
  studentName: ['parent'],
  className: ['parent'],
  balance: ['parent'],
}

export const PLACEHOLDER_HELP: Record<string, string> = {
  name: "The recipient's own name",
  parentName: "The parent's name",
  studentName: "First names of the parent's children in this message",
  className: "Their children's classes",
  balance: "The family's total fee balance",
}

export function validPlaceholders(audiences: Audience[]): string[] {
  if (audiences.length === 0) return ['name']
  const kinds = new Set<RecipientKind>()
  for (const audience of audiences) {
    if (audience.type === 'all_teachers') kinds.add('teacher')
    else if (audience.type === 'all_staff') kinds.add('staff')
    else if (audience.type === 'individuals') for (const p of audience.people) kinds.add(p.kind === 'family' ? 'parent' : p.kind)
    else kinds.add('parent')
  }
  return Object.keys(SUPPORTED_BY).filter((p) => [...kinds].every((kind) => SUPPORTED_BY[p].includes(kind)))
}

export interface AudienceLookup {
  className: (id: number) => string | undefined
  streamName: (id: number) => string | undefined
}

export function describeAudience(audience: Audience, lookup: AudienceLookup): string {
  switch (audience.type) {
    case 'all_parents':
      return 'All parents'
    case 'class_parents': {
      const className = lookup.className(audience.classId) ?? `class #${audience.classId}`
      if (audience.streamId === undefined) return `Parents of ${className}`
      const streamName = lookup.streamName(audience.streamId)
      return streamName ? `Parents of ${className} ${streamName}` : `Parents of ${className} (one stream)`
    }
    case 'fee_balance_parents':
      return audience.minimumBalance
        ? `Parents with a fee balance over KES ${audience.minimumBalance.toLocaleString('en-US')}`
        : 'Parents with a fee balance'
    case 'all_teachers':
      return 'All teachers'
    case 'all_staff':
      return audience.category === 'teaching' ? 'Teaching staff' : audience.category === 'non_teaching' ? 'Non-teaching staff' : 'All staff'
    case 'individuals':
      if (audience.people.length === 1) return audience.people[0].label ?? '1 person picked by hand'
      return `${audience.people.length} people picked by hand`
  }
}

export function audienceSummary(audiences: Audience[], lookup: AudienceLookup): string {
  return audiences.length === 0 ? 'No audience selected' : audiences.map((a) => describeAudience(a, lookup)).join(' · ')
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm vitest run src/modules/messaging`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/modules/messaging
git commit -m "feat(messaging): SMS segment counter, placeholder and audience helpers"
```

### Task 11: Messaging API, store and live updates

**Files:**
- Create: `src/modules/messaging/MessagingApi.ts`
- Test: `src/modules/messaging/MessagingApi.test.ts`
- Modify: `src/store/store.ts`, `src/components/auth/RealtimeSync.tsx`

**Interfaces:**
- Consumes: types from Task 10; `authBaseQuery` (`src/apiDomain/authBaseQuery`); `ApiEnvelope<T>` (`src/types/Types`); the backend routes from Task 8.
- Produces: `messagingApi` (reducerPath `'messagingApi'`, tags `'MessageBatches' | 'MessagingConfig'`) and hooks `useGetMessagingConfigQuery()`, `useSearchRecipientsQuery(q: string, { skip })`, `usePreviewMessageMutation()`, `useSendMessageMutation()`, `useGetMessageBatchesQuery()`, `useGetMessageBatchQuery(id: number)`.

- [ ] **Step 1: Write the failing test `src/modules/messaging/MessagingApi.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { store } from '../../store/store'
import { messagingApi } from './MessagingApi'

describe('messagingApi', () => {
  it('is registered in the store, so signing out clears its cache with the rest', () => {
    expect(store.getState()).toHaveProperty(messagingApi.reducerPath)
  })

  it('exposes the endpoints the Messaging page uses', () => {
    expect(Object.keys(messagingApi.endpoints).sort()).toEqual([
      'getMessageBatch',
      'getMessageBatches',
      'getMessagingConfig',
      'previewMessage',
      'searchRecipients',
      'sendMessage',
    ])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/MessagingApi.test.ts`
Expected: FAIL — cannot resolve `./MessagingApi`.

- [ ] **Step 3: Create `src/modules/messaging/MessagingApi.ts`**

```ts
import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { BatchDetail, BatchSummary, ComposeRequest, MessagingConfig, PersonHit, PreviewResult, SentBatch } from './types'

export const messagingApi = createApi({
  reducerPath: 'messagingApi',
  baseQuery: authBaseQuery,
  tagTypes: ['MessageBatches', 'MessagingConfig'],
  endpoints: (builder) => ({
    getMessagingConfig: builder.query<MessagingConfig, void>({
      query: () => 'messages/config',
      transformResponse: (response: ApiEnvelope<MessagingConfig>) => response.data,
      providesTags: ['MessagingConfig'],
    }),

    searchRecipients: builder.query<PersonHit[], string>({
      query: (q) => `messages/recipients/search?q=${encodeURIComponent(q)}`,
      transformResponse: (response: ApiEnvelope<PersonHit[]>) => response.data,
    }),

    // A mutation, not a query: previews are explicit, never cached or refetched.
    previewMessage: builder.mutation<PreviewResult, ComposeRequest>({
      query: (body) => ({ url: 'messages/preview', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<PreviewResult>) => response.data,
    }),

    sendMessage: builder.mutation<SentBatch, ComposeRequest>({
      query: (body) => ({ url: 'messages', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<SentBatch>) => response.data,
      invalidatesTags: ['MessageBatches'],
    }),

    getMessageBatches: builder.query<BatchSummary[], void>({
      query: () => 'messages',
      transformResponse: (response: ApiEnvelope<BatchSummary[]>) => response.data,
      providesTags: ['MessageBatches'],
    }),

    getMessageBatch: builder.query<BatchDetail, number>({
      query: (id) => `messages/${id}`,
      transformResponse: (response: ApiEnvelope<BatchDetail>) => response.data,
      providesTags: ['MessageBatches'],
    }),
  }),
})

export const {
  useGetMessagingConfigQuery,
  useSearchRecipientsQuery,
  usePreviewMessageMutation,
  useSendMessageMutation,
  useGetMessageBatchesQuery,
  useGetMessageBatchQuery,
} = messagingApi
```

- [ ] **Step 4: Register it in `src/store/store.ts`**

After the line `import { searchApi } from '../modules/search/SearchApi'`, add:

```ts
import { messagingApi } from '../modules/messaging/MessagingApi'
```

After the line `  [searchApi.reducerPath]: searchApi.reducer,`, add:

```ts
  [messagingApi.reducerPath]: messagingApi.reducer,
```

In the middleware line, change `searchApi.middleware),` to `searchApi.middleware, messagingApi.middleware),`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/modules/messaging/MessagingApi.test.ts src/store/store.test.ts`
Expected: PASS.

- [ ] **Step 6: Refresh history on live updates in `src/components/auth/RealtimeSync.tsx`**

After the line `import { attendanceApi } from '../../modules/attendance/AttendanceApi'`, add:

```tsx
import { messagingApi } from '../../modules/messaging/MessagingApi'
```

Immediately before the line `            case 'dashboard':`, add:

```tsx
            case 'messages':
              dispatch(messagingApi.util.invalidateTags(['MessageBatches']))
              break

```

- [ ] **Step 7: Typecheck, lint and run all tests**

Run: `pnpm build && pnpm lint && pnpm test`
Expected: build succeeds, lint reports no errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/modules/messaging src/store/store.ts src/components/auth/RealtimeSync.tsx
git commit -m "feat(messaging): messaging API slice, store wiring and live refresh"
```

### Task 12: The Messaging page

**Files:**
- Create: `src/modules/messaging/PlaceholderChips.tsx`, `src/modules/messaging/AudiencePicker.tsx`, `src/modules/messaging/ComposeMessage.tsx`, `src/modules/messaging/MessageHistory.tsx`, `src/modules/messaging/MessagingPage.tsx`
- Test: `src/modules/messaging/PlaceholderChips.test.tsx`
- Modify: `src/dashboardDesign/navigation.ts`, `src/App.tsx`

**Interfaces:**
- Consumes: hooks from Task 11; `countSms`, `validPlaceholders`, `PLACEHOLDER_HELP`, `describeAudience`, `audienceSummary`, `AudienceLookup` and all types from Task 10; `useGetAllClassesQuery()` and `useGetStreamsByClassQuery(classId: number, { skip })` from `src/modules/students/StudentApi` (existing; `Class = { id, name, level }`, `Stream = { id, classId, name }`); `DashboardLayout` (`src/dashboardDesign/DashboardLayout`); `PrivateRoute` (`src/components/auth/PrivateRoute`, prop `requiredPermission`).
- Produces: default exports `PlaceholderChips` (`{ placeholders: string[]; onInsert: (token: string) => void }`), `AudiencePicker` (`{ audiences: Audience[]; onChange: (next: Audience[]) => void }`), `ComposeMessage` (`{ onSent: () => void }`), `MessageHistory`, `MessagingPage`; route `/dashboard/communication/messaging`.

- [ ] **Step 1: Write the failing test `src/modules/messaging/PlaceholderChips.test.tsx`**

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import PlaceholderChips from './PlaceholderChips'
import { validPlaceholders } from './placeholders'

afterEach(cleanup)

describe('PlaceholderChips', () => {
  it('offers every parent placeholder for a parent audience', () => {
    render(<PlaceholderChips placeholders={validPlaceholders([{ type: 'all_parents' }])} onInsert={() => {}} />)
    for (const token of ['name', 'parentName', 'studentName', 'className', 'balance']) {
      expect(screen.getByRole('button', { name: `{{${token}}}` })).toBeTruthy()
    }
  })

  it('offers only {{name}} once teachers are included', () => {
    render(<PlaceholderChips placeholders={validPlaceholders([{ type: 'all_parents' }, { type: 'all_teachers' }])} onInsert={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '{{name}}' })).toBeTruthy()
  })

  it('inserts the placeholder that was clicked', () => {
    const onInsert = vi.fn()
    render(<PlaceholderChips placeholders={['name', 'balance']} onInsert={onInsert} />)
    fireEvent.click(screen.getByRole('button', { name: '{{balance}}' }))
    expect(onInsert).toHaveBeenCalledWith('balance')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/messaging/PlaceholderChips.test.tsx`
Expected: FAIL — cannot resolve `./PlaceholderChips`.

- [ ] **Step 3: Create `src/modules/messaging/PlaceholderChips.tsx`**

```tsx
import React from 'react'
import { PLACEHOLDER_HELP } from './placeholders'

type Props = {
  placeholders: string[]
  onInsert: (token: string) => void
}

const PlaceholderChips: React.FC<Props> = ({ placeholders, onInsert }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs text-gray-500">Insert:</span>
    {placeholders.map((token) => (
      <button
        key={token}
        type="button"
        className="badge badge-outline cursor-pointer hover:bg-green-50"
        title={PLACEHOLDER_HELP[token]}
        onClick={() => onInsert(token)}
      >
        {`{{${token}}}`}
      </button>
    ))}
  </div>
)

export default PlaceholderChips
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/modules/messaging/PlaceholderChips.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create `src/modules/messaging/AudiencePicker.tsx`**

```tsx
import React, { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useGetAllClassesQuery, useGetStreamsByClassQuery } from '../students/StudentApi'
import { useSearchRecipientsQuery } from './MessagingApi'
import { describeAudience, type AudienceLookup } from './placeholders'
import type { Audience, PickedPerson, StaffCategory } from './types'

type Props = {
  audiences: Audience[]
  onChange: (next: Audience[]) => void
}

type Of<T extends Audience['type']> = Extract<Audience, { type: T }>

const samePerson = (a: PickedPerson, b: PickedPerson) => a.kind === b.kind && a.id === b.id

const AudiencePicker: React.FC<Props> = ({ audiences, onChange }) => {
  const { data: classes = [] } = useGetAllClassesQuery()
  const [classId, setClassId] = useState<number | ''>('')
  const [streamId, setStreamId] = useState<number | ''>('')
  const { data: streams = [] } = useGetStreamsByClassQuery(classId === '' ? 0 : classId, { skip: classId === '' })
  const [streamNames, setStreamNames] = useState<Record<number, string>>({})
  const [minimumBalance, setMinimumBalance] = useState('')
  const [query, setQuery] = useState('')
  const term = query.trim()
  const { data: hits = [], isFetching } = useSearchRecipientsQuery(term, { skip: term.length < 2 })

  const lookup: AudienceLookup = {
    className: (id) => classes.find((c) => c.id === id)?.name,
    streamName: (id) => streamNames[id],
  }

  const find = <T extends Audience['type']>(type: T) => audiences.find((a): a is Of<T> => a.type === type)
  const without = (type: Audience['type']) => audiences.filter((a) => a.type !== type)
  // Replaces the audience of the same type in place, so the order audiences were chosen in is kept.
  const upsert = (audience: Audience) =>
    onChange(find(audience.type) ? audiences.map((a) => (a.type === audience.type ? audience : a)) : [...audiences, audience])
  const toggle = (audience: Audience) => (find(audience.type) ? onChange(without(audience.type)) : upsert(audience))

  const staffAudience = find('all_staff')
  const feeAudience = find('fee_balance_parents')
  const picked = find('individuals')?.people ?? []

  const addClass = () => {
    if (classId === '') return
    const stream = streamId === '' ? undefined : streamId
    if (stream !== undefined) {
      const name = streams.find((s) => s.id === stream)?.name
      if (name) setStreamNames((names) => ({ ...names, [stream]: name }))
    }
    const exists = audiences.some((a) => a.type === 'class_parents' && a.classId === classId && a.streamId === stream)
    if (!exists) {
      onChange([...audiences, stream === undefined ? { type: 'class_parents', classId } : { type: 'class_parents', classId, streamId: stream }])
    }
    setClassId('')
    setStreamId('')
  }

  const setFees = (enabled: boolean, minimum: string) => {
    if (!enabled) {
      onChange(without('fee_balance_parents'))
      return
    }
    const amount = Number(minimum)
    upsert(minimum.trim() && amount > 0 ? { type: 'fee_balance_parents', minimumBalance: amount } : { type: 'fee_balance_parents' })
  }

  const addPerson = (person: PickedPerson) => {
    if (!picked.some((p) => samePerson(p, person))) upsert({ type: 'individuals', people: [...picked, person] })
    setQuery('')
  }

  const removePerson = (person: PickedPerson) => {
    const people = picked.filter((p) => !samePerson(p, person))
    if (people.length === 0) onChange(without('individuals'))
    else upsert({ type: 'individuals', people })
  }

  const groupButton = (label: string, audience: Audience) => {
    const active = Boolean(find(audience.type))
    return (
      <button
        type="button"
        aria-pressed={active}
        className={`btn btn-sm ${active ? 'btn-success text-white' : 'btn-outline'}`}
        onClick={() => toggle(audience)}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {groupButton('All parents', { type: 'all_parents' })}
        {groupButton('All teachers', { type: 'all_teachers' })}
        {groupButton('All staff', { type: 'all_staff' })}
        {staffAudience && (
          <select
            aria-label="Staff category"
            className="select select-sm w-auto"
            value={staffAudience.category ?? ''}
            onChange={(e) => {
              const category = e.target.value as StaffCategory | ''
              upsert(category ? { type: 'all_staff', category } : { type: 'all_staff' })
            }}
          >
            <option value="">Teaching and non-teaching</option>
            <option value="teaching">Teaching only</option>
            <option value="non_teaching">Non-teaching only</option>
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Parents of a class</span>
          <select
            aria-label="Class"
            className="select select-sm w-auto"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value ? Number(e.target.value) : '')
              setStreamId('')
            }}
          >
            <option value="">Choose a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <select
          aria-label="Stream"
          className="select select-sm w-auto"
          value={streamId}
          disabled={classId === '' || streams.length === 0}
          onChange={(e) => setStreamId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">All streams</option>
          {streams.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-outline" disabled={classId === ''} onClick={addClass}>
          <Plus className="w-4 h-4" /> Add class
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={Boolean(feeAudience)}
            onChange={(e) => setFees(e.target.checked, minimumBalance)}
          />
          Parents with a fee balance
        </label>
        {feeAudience && (
          <input
            type="number"
            min={0}
            step={100}
            aria-label="Minimum balance in KES"
            placeholder="Over KES (optional)"
            className="input input-sm w-48"
            value={minimumBalance}
            onChange={(e) => {
              setMinimumBalance(e.target.value)
              setFees(true, e.target.value)
            }}
          />
        )}
      </div>

      <div className="relative max-w-md">
        <label className="input input-sm flex items-center gap-2 w-full">
          <Search className="w-4 h-4 opacity-60" />
          <input
            type="search"
            aria-label="Find a family, teacher or staff member"
            placeholder="Find a student's family, a teacher or staff member"
            className="grow"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {term.length >= 2 && (
          <ul className="absolute z-10 mt-1 w-full rounded-box bg-base-100 shadow-lg border border-base-200 max-h-72 overflow-y-auto">
            {isFetching && <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>}
            {!isFetching && hits.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No matches</li>}
            {!isFetching &&
              hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-base-200 flex flex-col"
                    onClick={() => addPerson({ kind: hit.kind, id: hit.id, label: hit.label })}
                  >
                    <span className="text-sm font-medium">{hit.label}</span>
                    <span className="text-xs text-gray-500">{hit.detail}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Selected audiences">
        {audiences.length === 0 && <span className="text-sm text-gray-500">No audience selected yet</span>}
        {audiences.map((audience, index) =>
          audience.type === 'individuals' ? (
            <React.Fragment key="individuals">
              {audience.people.map((person) => {
                const label = person.label ?? `${person.kind} #${person.id}`
                return (
                  <span key={`${person.kind}-${person.id}`} className="badge badge-lg badge-outline gap-1">
                    {label}
                    <button type="button" aria-label={`Remove ${label}`} onClick={() => removePerson(person)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </React.Fragment>
          ) : (
            <span key={`${audience.type}-${index}`} className="badge badge-lg badge-success text-white gap-1">
              {describeAudience(audience, lookup)}
              <button
                type="button"
                aria-label={`Remove ${describeAudience(audience, lookup)}`}
                onClick={() => onChange(audiences.filter((_, i) => i !== index))}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ),
        )}
      </div>
    </div>
  )
}

export default AudiencePicker
```

- [ ] **Step 6: Create `src/modules/messaging/ComposeMessage.tsx`**

```tsx
import React, { useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { toast } from 'sonner'
import { Eye, Send } from 'lucide-react'
import AudiencePicker from './AudiencePicker'
import PlaceholderChips from './PlaceholderChips'
import { usePreviewMessageMutation, useSendMessageMutation } from './MessagingApi'
import { validPlaceholders } from './placeholders'
import { countSms } from './smsSegments'
import type { Audience, Channel, ComposeRequest, PreviewResult } from './types'

const CHANNELS: Array<{ value: Channel; label: string }> = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'SMS and email' },
]

const errorMessage = (err: unknown, fallback: string) => (err as { data?: { error?: string } })?.data?.error ?? fallback

const ComposeMessage: React.FC<{ onSent: () => void }> = ({ onSent }) => {
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [channel, setChannel] = useState<Channel>('sms')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [previewMessage, { isLoading: previewing }] = usePreviewMessageMutation()
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation()

  const includesEmail = channel !== 'sms'
  const includesSms = channel !== 'email'
  const sms = countSms(body)
  const placeholders = validPlaceholders(audiences)
  const ready = audiences.length > 0 && body.trim().length > 0 && (!includesEmail || subject.trim().length > 0)
  const request = (): ComposeRequest => ({ channel, audiences, body, ...(includesEmail ? { subject } : {}) })

  // Any edit makes the last preview stale.
  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPreview(null)
  }

  const insertPlaceholder = (token: string) => {
    const el = bodyRef.current
    const text = `{{${token}}}`
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    edit(setBody)(body.slice(0, start) + text + body.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    })
  }

  const runPreview = async () => {
    try {
      setPreview(await previewMessage(request()).unwrap())
    } catch (err) {
      toast.error(errorMessage(err, 'Could not preview this message'))
    }
  }

  const send = async () => {
    let summary = preview
    if (!summary) {
      try {
        summary = await previewMessage(request()).unwrap()
        setPreview(summary)
      } catch (err) {
        toast.error(errorMessage(err, 'Could not prepare this message'))
        return
      }
    }
    if (summary.recipients === 0) {
      toast.error('These audiences have no recipients')
      return
    }
    const confirmation = await Swal.fire({
      title: `Send to ${summary.recipients} ${summary.recipients === 1 ? 'recipient' : 'recipients'}?`,
      text: summary.skipped
        ? `${summary.skipped} message${summary.skipped === 1 ? '' : 's'} will be skipped because contact details are missing or invalid.`
        : 'Every recipient has the contact details this channel needs.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Send',
      confirmButtonColor: '#166534',
    })
    if (!confirmation.isConfirmed) return
    try {
      const batch = await sendMessage(request()).unwrap()
      toast.success(`Message queued for ${batch.recipients} ${batch.recipients === 1 ? 'recipient' : 'recipients'}`)
      setAudiences([])
      setSubject('')
      setBody('')
      setPreview(null)
      onSent()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send this message'))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card bg-base-100 shadow lg:col-span-2">
        <div className="card-body space-y-6">
          <section>
            <h2 className="font-semibold text-gray-800 mb-3">1. Who should receive it?</h2>
            <AudiencePicker audiences={audiences} onChange={edit(setAudiences)} />
          </section>

          <section>
            <h2 className="font-semibold text-gray-800 mb-3">2. How?</h2>
            <div role="radiogroup" aria-label="Channel" className="join">
              {CHANNELS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={channel === value}
                  className={`btn btn-sm join-item ${channel === value ? 'btn-success text-white' : 'btn-outline'}`}
                  onClick={() => edit(setChannel)(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-gray-800">3. Message</h2>
            {includesEmail && (
              <input
                aria-label="Email subject"
                className="input input-sm w-full"
                maxLength={150}
                placeholder="Email subject"
                value={subject}
                onChange={(e) => edit(setSubject)(e.target.value)}
              />
            )}
            <PlaceholderChips placeholders={placeholders} onInsert={insertPlaceholder} />
            <textarea
              ref={bodyRef}
              aria-label="Message"
              className="textarea w-full h-40"
              maxLength={1600}
              placeholder="Dear {{name}}, …"
              value={body}
              onChange={(e) => edit(setBody)(e.target.value)}
            />
            {includesSms && (
              <p className="text-xs text-gray-500" aria-live="polite">
                {sms.units} {sms.encoding === 'GSM-7' ? 'characters' : 'units'} · {sms.segments} SMS {sms.segments === 1 ? 'part' : 'parts'} (
                {sms.perSegment} per part)
                {sms.encoding === 'UCS-2' && ' — a special character or emoji is making each part shorter'}
              </p>
            )}
            <p className="text-xs text-gray-500">Placeholders are filled in for each recipient, so real messages may be longer.</p>
          </section>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm btn-outline" disabled={!ready || previewing} onClick={runPreview}>
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button type="button" className="btn btn-sm btn-success text-white" disabled={!ready || previewing || sending} onClick={send}>
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      </div>

      <aside className="card bg-base-100 shadow h-fit">
        <div className="card-body space-y-4">
          <h2 className="font-semibold text-gray-800">Preview</h2>
          {!preview ? (
            <p className="text-sm text-gray-500">Choose who receives it, write the message and press Preview to see the recipients and sample messages.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <p>
                <span className="text-3xl font-bold text-gray-800">{preview.recipients}</span>{' '}
                {preview.recipients === 1 ? 'recipient' : 'recipients'}
              </p>
              <ul className="space-y-1">
                {preview.channels.map((c) => (
                  <li key={c.channel}>
                    {c.channel === 'sms' ? 'SMS' : 'Email'}: {c.queued} to send
                    {c.skipped > 0 && `, ${c.skipped} skipped`}
                  </li>
                ))}
              </ul>
              {preview.skipped > 0 && <p className="text-amber-700">{preview.skipped} skipped — missing or invalid contact details.</p>}
              <div className="space-y-2">
                {preview.samples.map((sample, i) => (
                  <div key={i} className="rounded-lg bg-base-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">To {sample.name}</p>
                    {sample.subject && <p className="font-medium">{sample.subject}</p>}
                    <p className="whitespace-pre-wrap">{sample.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

export default ComposeMessage
```

- [ ] **Step 7: Create `src/modules/messaging/MessageHistory.tsx`**

```tsx
import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useGetAllClassesQuery } from '../students/StudentApi'
import { useGetMessageBatchQuery, useGetMessageBatchesQuery } from './MessagingApi'
import { audienceSummary, type AudienceLookup } from './placeholders'
import type { BatchSummary, Channel, MessageStatus } from './types'

const STATUS_BADGE: Record<MessageStatus, string> = {
  pending: 'badge-ghost',
  sending: 'badge-info',
  sent: 'badge-success',
  failed: 'badge-error',
  skipped: 'badge-warning',
}

const CHANNEL_LABEL: Record<Channel, string> = { sms: 'SMS', email: 'Email', both: 'SMS and email' }

const when = (iso: string) => new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })

function Progress({ batch }: { batch: BatchSummary }) {
  const done = batch.sent + batch.failed + batch.skipped
  return (
    <div className="min-w-44">
      <progress
        className="progress progress-success w-full"
        value={done}
        max={Math.max(batch.total, 1)}
        aria-label={`${done} of ${batch.total} messages processed`}
      />
      <p className="text-xs text-gray-500">
        {batch.sent} sent · {batch.failed} failed · {batch.skipped} skipped
        {batch.pending > 0 && ` · ${batch.pending} waiting`}
      </p>
    </div>
  )
}

function BatchDetailView({ id, lookup, onBack }: { id: number; lookup: AudienceLookup; onBack: () => void }) {
  const { data: batch, isLoading, isError } = useGetMessageBatchQuery(id)

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-4">
        <button type="button" className="btn btn-sm btn-ghost w-fit" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> All messages
        </button>
        {isLoading && <span className="loading loading-spinner" />}
        {isError && <p className="text-red-600">Could not load this message.</p>}
        {batch && (
          <>
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-800">{audienceSummary(batch.audiences, lookup)}</h2>
                <p className="text-xs text-gray-500">
                  {CHANNEL_LABEL[batch.channel]} · {when(batch.createdAt)} · by {batch.senderName}
                </p>
              </div>
              <Progress batch={batch} />
            </div>
            {batch.subject && <p className="font-medium">{batch.subject}</p>}
            <p className="whitespace-pre-wrap rounded-lg bg-base-200 p-3 text-sm">{batch.body}</p>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Channel</th>
                    <th>Sent to</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.recipients.map((r) => (
                    <tr key={r.id}>
                      <td>{r.recipientName ?? '—'}</td>
                      <td>{r.channel === 'sms' ? 'SMS' : 'Email'}</td>
                      <td>{(r.channel === 'sms' ? r.recipientPhone : r.recipientEmail) ?? '—'}</td>
                      <td>
                        <span className={`badge badge-sm ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                      </td>
                      <td className="text-xs text-gray-500">{r.failureReason ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const MessageHistory: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { data: batches = [], isLoading, isError } = useGetMessageBatchesQuery()
  const { data: classes = [] } = useGetAllClassesQuery()
  // Stored batches keep ids, not names; streams fall back to "(one stream)".
  const lookup: AudienceLookup = {
    className: (id) => classes.find((c) => c.id === id)?.name,
    streamName: () => undefined,
  }

  if (selectedId !== null) return <BatchDetailView id={selectedId} lookup={lookup} onBack={() => setSelectedId(null)} />
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg text-green-700" />
      </div>
    )
  }
  if (isError) return <p className="text-red-600">Could not load message history.</p>
  if (batches.length === 0) return <p className="text-gray-500">No messages have been sent yet.</p>

  return (
    <div className="card bg-base-100 shadow overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Sent</th>
            <th>Audience</th>
            <th>Channel</th>
            <th>Message</th>
            <th>Progress</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id} className="hover:bg-base-200">
              <td className="whitespace-nowrap">
                <div>{when(batch.createdAt)}</div>
                <div className="text-xs text-gray-500">by {batch.senderName}</div>
              </td>
              <td className="max-w-56">{audienceSummary(batch.audiences, lookup)}</td>
              <td>{CHANNEL_LABEL[batch.channel]}</td>
              <td className="max-w-72 truncate" title={batch.body}>
                {batch.subject && <span className="font-medium">{batch.subject}: </span>}
                {batch.body}
              </td>
              <td>
                <Progress batch={batch} />
              </td>
              <td>
                <button type="button" className="btn btn-xs btn-outline" onClick={() => setSelectedId(batch.id)}>
                  Recipients
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default MessageHistory
```

- [ ] **Step 8: Create `src/modules/messaging/MessagingPage.tsx`**

```tsx
import React, { useState } from 'react'
import { AlertTriangle, History, Send } from 'lucide-react'
import { Toaster } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import ComposeMessage from './ComposeMessage'
import MessageHistory from './MessageHistory'
import { useGetMessagingConfigQuery } from './MessagingApi'

const MessagingPage: React.FC = () => {
  const [tab, setTab] = useState<'compose' | 'history'>('compose')
  const { data: config } = useGetMessagingConfigQuery()

  return (
    <DashboardLayout>
      <Toaster position="top-right" richColors />

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <Send className="w-6 h-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Messaging</h1>
          <p className="text-sm text-gray-500">Send SMS and email to parents, teachers and staff</p>
        </div>
      </div>

      {config?.deliveryMode === 'log_only' && (
        <div role="alert" className="alert alert-warning mb-6">
          <AlertTriangle className="w-5 h-5" />
          <span>Messages are recorded but not delivered — no SMS or email provider is configured.</span>
        </div>
      )}

      <div role="tablist" className="tabs tabs-box mb-6 w-fit">
        <button type="button" role="tab" aria-selected={tab === 'compose'} className={`tab gap-2 ${tab === 'compose' ? 'tab-active' : ''}`} onClick={() => setTab('compose')}>
          <Send className="w-4 h-4" /> Compose
        </button>
        <button type="button" role="tab" aria-selected={tab === 'history'} className={`tab gap-2 ${tab === 'history' ? 'tab-active' : ''}`} onClick={() => setTab('history')}>
          <History className="w-4 h-4" /> History
        </button>
      </div>

      {tab === 'compose' ? <ComposeMessage onSent={() => setTab('history')} /> : <MessageHistory />}
    </DashboardLayout>
  )
}

export default MessagingPage
```

- [ ] **Step 9: Point the nav entry at the page**

In `src/dashboardDesign/navigation.ts`:
- In the `lucide-react` import, replace `Bell, UserSquare2` with `Send, UserSquare2` (`Bell` is used only by the entry being replaced — confirm with `grep -n Bell src/dashboardDesign/navigation.ts` showing just the import and that entry).
- Replace

```ts
            { name: 'Notifications', path: '/dashboard/communication/notifications', icon: Bell, permission: 'notifications.send' },
```

with

```ts
            { name: 'Messaging', path: '/dashboard/communication/messaging', icon: Send, permission: 'notifications.send', built: true },
```

- [ ] **Step 10: Add the route in `src/App.tsx`**

After `import InventoryPage from './modules/inventory/InventoryPage'`, add:

```tsx
import MessagingPage from './modules/messaging/MessagingPage'
```

After the line `    { path: '/dashboard/finance/inventory', element: <PrivateRoute requiredPermission="inventory.view"><InventoryPage /></PrivateRoute> },`, add:

```tsx
    { path: '/dashboard/communication/messaging', element: <PrivateRoute requiredPermission="notifications.send"><MessagingPage /></PrivateRoute> },
```

- [ ] **Step 11: Build, lint and run all tests**

Run: `pnpm build && pnpm lint && pnpm test`
Expected: build succeeds, lint reports no errors, all tests pass. If `WidgetCard.test.tsx` times out in its setup hook straight after a build, re-run `pnpm test` once — that flake predates this work.

- [ ] **Step 12: Commit**

```bash
git add src/modules/messaging src/dashboardDesign/navigation.ts src/App.tsx
git commit -m "feat(messaging): Messaging page with compose, preview, history and delivery banner"
```

### Task 13: Walk through the page against the local backend

Nothing here is committed unless a defect is fixed. It needs a browser; if the executor has none, it records the walkthrough as **not performed** and hands this checklist to the human.

- [ ] **Step 1: Start both halves locally**

- Backend: Task 9 Steps 1–3 (local database, scratch `.env`, server on port 4199). The server only accepts browser calls from origins in `CORS_ORIGIN`, so before starting it add the Vite dev origin to the **scratch** copy: `sed -i 's#^CORS_ORIGIN=\(.*\)#CORS_ORIGIN=\1,http://localhost:5173#' "$E2E_DIR/.env"` (never edit `Accounts/.env`).
- Frontend (in `Schoolfrontend`): `VITE_API_DOMAIN=http://localhost:4199/api/ pnpm dev`, then open `http://localhost:5173`.

- [ ] **Step 2: Check, signed in as `dean@school.local`**

1. The sidebar's Communication section shows **Messaging**; it opens `/dashboard/communication/messaging`.
2. The yellow banner reads exactly: *Messages are recorded but not delivered — no SMS or email provider is configured.*
3. Choose **All parents**: five placeholder chips. Add **All teachers**: only `{{name}}` remains. Remove teachers: five again.
4. Add a class with a stream: the chip reads "Parents of Form N Stream".
5. Search two letters of a student's name, pick the family: a chip with "Family of …" appears.
6. Type 161 plain characters: counter shows 2 parts at 153. Add an emoji: it switches to 67/70 wording.
7. Choose **Email**: the subject field appears and Send stays disabled until it is filled.
8. **Preview** shows the recipient count, per-channel counts and three samples with names filled in.
9. **Send** asks "Send to N recipients?" with the same N; confirming switches to **History**, where the new row's progress reaches completion without a page reload.
10. **Recipients** lists each row with status and, for skipped rows, the reason.
11. Type `{{balanse}}` in the body and Preview: an error toast names `{{balanse}}` and the valid placeholders.

- [ ] **Step 3: Check, signed in as `teacher@school.local`**

The sidebar has no Messaging entry, and visiting `/dashboard/communication/messaging` directly shows the access-denied page.

- [ ] **Step 4: Clean up**

Stop both servers and delete the scratch `.env` (Task 9 Step 8). Report each check as pass/fail.

---

## Rollout (for the human, after review)

1. Merge order: `feat/dashboard-data-visualization` → `feat/student-teacher-delete-and-audit` → `feat/bulk-messaging`, in both repos. The backend messaging branch already contains the dashboard merge, including the resolved `students.repository.ts` / `students.service.ts` conflicts.
2. Apply `drizzle/0014_bulk_messaging.sql` to production by hand (after the dashboard indexes `0012`/`0013`). Run it outside a transaction — `ALTER TYPE … ADD VALUE` cannot be used inside the transaction that adds it.
3. Run `pnpm db:sync-rbac` against production so the Dean holds `notifications.send`.
4. Deploy the backend, then the frontend.
