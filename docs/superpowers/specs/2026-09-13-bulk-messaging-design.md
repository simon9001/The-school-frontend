# Bulk Messaging — Design

**Date:** 2026-09-13
**Status:** Approved design, pending implementation plan
**Repos touched:** `Accounts` (messaging module, schema, background sender) and `Schoolfrontend` (Messaging page).
**Sub-project:** A of two. Sub-project B (parent portal) gets its own spec.

## Purpose

The Principal, Dean of Studies and Bursar need to reach parents, teachers and
staff in bulk by SMS or email: a class trip notice to Form 3 North parents, a
staff meeting reminder, or a fee reminder that tells each family what they
actually owe.

Today none of that is possible. The system can record one notification at a
time and delivers nothing — its provider only logs to the console — and there
is no page to write a message on.

This spec adds audiences, personalised bulk sends, background delivery with
progress tracking, and a Messaging page. Real SMS and email providers are
deliberately deferred: the feature is built and usable now, recording every
message, and delivers for real once providers and keys are added.

## Background: what exists

**A single-message notifications module.** `notifications` holds one row per
message with a recipient phone/email snapshot, a `pending | sent | failed`
status, a failure reason, and a `created_by`. `notification_templates` holds
`{{placeholder}}` templates. `POST /notifications/send` sends to exactly one
recipient. `notifications.send` is held by the Principal and the Bursar.

**A clean provider seam.** `createNotificationsService(provider)` takes any
object implementing `send({ channel, to, subject, body })`. The only
implementation is `consoleNotificationProvider`, which logs. No provider keys
exist in `.env`. Adding a real provider is one new implementation plus
configuration — this spec relies on that seam and does not change it.

**The placeholder renderer blanks what it doesn't recognise.**
`renderTemplate` replaces `{{key}}` with `data[key] ?? ''`. A misspelled
placeholder therefore goes out as an empty string — "your balance is KES " —
to every recipient, silently. Validation has to happen before sending.

**Where contact details actually live** (production, 2026-09-13, counts only):

| Source | Records | With phone | With email |
|---|---|---|---|
| Active students' guardian fields | 56 | 56 | 0 |
| Parent login accounts | 15 | 14 | 15 |
| Active teachers | 12 | 12 | 12 |
| Active staff registry | 18 | 18 | 0 |

Only 14 parents are linked to a child through `guardian_students`. So texting
parents must use the phone on the student record, or 42 families are missed;
emailing parents can only reach account holders.

**Every stored phone number is in local `07…`/`01…` format.** None are `+254…`.
Numbers are normalised to `+254…` for matching now; providers will need that
form later anyway.

**Teachers and staff overlap.** 12 of the 18 active staff records link to a
teacher (`staff.teacher_id`). Messaging "teachers + staff" without
de-duplication texts those 12 people twice. `staff.category` distinguishes
`teaching` from `non_teaching`.

**Guardian names are complete.** All 56 active students have `guardian_name`,
so a parent without an account still has a name for `{{parentName}}`.

**Fee balances.** Payments are recorded against one invoice and allocated to its
items (`fee_payment_allocations.invoice_item_id`); `recordPayment` defines an
item's outstanding amount as its amount minus allocations. Nothing computes a
balance per student or per family school-wide. The parent portal's fee statement
counts cancelled invoices as owed — the same defect the dashboard review found.

**Notification statuses have no other consumers.** Only the notifications
repository and service read or write the status, and no frontend code does, so
new status values are safe to add.

**Live updates.** `broadcastChange(topic, action)` publishes to an SSE stream;
`EventTopic` is a string union, and `RealtimeSync.tsx` maps each topic to cache
invalidations. A new topic is one union member plus one `case`.

**Deployment.** The backend runs as a single Render instance
(`WEB_CONCURRENCY=1`), which may sleep when idle.

## Decisions taken

**1. Build now, providers later.** Everything is built against the existing
logging provider. Messages are recorded exactly as they would be sent. The page
says plainly that nothing is being delivered until a provider is configured, so
no sender believes parents have been reached.

**2. A new `messaging` module on top of notifications.** Notifications stays
the single-message primitive and the provider seam. Messaging owns audiences,
batches, personalisation and progress, and writes ordinary `notifications` rows.

**3. Audiences are combinable.** One message can target any mix of: all
parents; parents of a class or stream; parents with a fee balance above an
optional minimum; all teachers; all staff (optionally teaching or non-teaching
only); and hand-picked people.

**4. One message per person.** A family with several children gets one
message, and anyone reached through two audiences gets one message. Recipients
are the same person when they share a normalised phone number or a
lower-cased email.

**5. Personalised placeholders, validated before sending.** Each recipient's
text is rendered with their own values. Any placeholder that is unknown, or not
valid for every selected audience, is rejected with the list of valid ones.

**6. Save the batch, send in the background.** Sending saves everything and
returns immediately; a background sender works through the queue, survives
restarts, and cannot double-send even if a second instance ever runs.

**7. The sender is the logged-in user.** Never a value from the request body.

**8. The Dean gains `notifications.send`.** Additive, so `db:sync-rbac` applies it.

## Data model

New table **`message_batches`**:

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `created_by` | integer, not null → `users.id` | the logged-in sender |
| `channel` | enum `sms \| email \| both` | |
| `audiences` | jsonb, not null | the selections as submitted, for history and audit |
| `subject` | varchar(150), nullable | required when the channel includes email |
| `body` | text, not null | the template as written, placeholders unrendered |
| `status` | enum `queued \| sending \| completed` | |
| `created_at` | timestamptz, default now | |
| `completed_at` | timestamptz, nullable | |

Changes to **`notifications`** (all additive; existing single sends are unaffected):

- `batch_id` integer, nullable → `message_batches.id`
- `recipient_name` varchar(150), nullable — a snapshot for the history view,
  since a parent without an account has no user row to join
- `claimed_at` timestamptz, nullable — when the background sender took the row
- `notification_status` gains `sending` and `skipped`
- index on `(batch_id, status)` for the claim query

Batch counts (recipients, sent, failed, skipped, pending) are **computed** from
`notifications` grouped by status, never stored, so they cannot drift.

## Audiences and recipients

Audience selections, validated with zod:

```ts
type Audience =
  | { type: 'all_parents' }
  | { type: 'class_parents'; classId: number; streamId?: number }
  | { type: 'fee_balance_parents'; minimumBalance?: number } // default 0
  | { type: 'all_teachers' }
  | { type: 'all_staff'; category?: 'teaching' | 'non_teaching' }
  | { type: 'individuals'; people: Array<{ kind: 'family' | 'teacher' | 'staff'; id: number }> }
```

A `family` is identified by any one of its children's student ids. At least one
audience is required.

**Families.** For each active student in scope:

- If the student has a linked parent account, the family is that account. Name
  and email come from the account; phone comes from the account, falling back
  to the student's `guardian_phone`.
- Otherwise the family is identified by the student's normalised
  `guardian_phone`, named by `guardian_name`, with `guardian_email` if present.
- A student with neither an account nor a usable phone becomes a family with no
  contact details; it still produces rows, as `skipped`.

**Teachers and staff.** Active `teachers` rows and active `staff` rows, each
with its own name, phone and email.

**Resolution order.**

1. Build every family school-wide from the rules above. Families sharing a
   normalised phone or a lower-cased email are the same family and merge,
   combining their children and balances.
2. Each parent audience selects families: `all_parents` takes every family;
   `class_parents` takes families with a child in that class (and stream);
   `fee_balance_parents` takes families whose merged total balance exceeds the
   minimum; `individuals` takes the families of the picked students.
3. Teacher and staff audiences add their people.
4. Across all audiences, recipients sharing a normalised phone or a lower-cased
   email collapse into one. The merged recipient keeps the name from the first
   audience that produced it.

**Phone normalisation** (pure): strip spaces and dashes; `07XXXXXXXX` and
`01XXXXXXXX` become `+2547XXXXXXXX` and `+2541XXXXXXXX`; `254XXXXXXXXX` gains a
`+`; a valid `+254XXXXXXXXX` is kept. Anything else is not a usable phone.

**Fee balance** (per student): across that student's invoices whose status is
not `cancelled`, the sum of each item's amount minus the payments allocated to
that item. A family's balance is the sum across its children. The
`fee_balance_parents` audience includes families whose balance is greater than
`minimumBalance`. A payment larger than what it could be allocated against is
not netted against other invoices — the same rule `recordPayment` applies.

## Placeholders

| Placeholder | Valid for | Value |
|---|---|---|
| `{{name}}` | everyone | the recipient's own name |
| `{{parentName}}` | parents | the parent's name |
| `{{studentName}}` | parents | first names of the children in scope: "Jane", "Jane and John", "Jane, John and Mary" |
| `{{className}}` | parents | distinct class names of the children in scope, joined the same way |
| `{{balance}}` | parents | the whole family's balance, formatted `12,500.00` |

**Children in scope** are the children that brought the family into the
message: every active child for `all_parents` and `fee_balance_parents`; the
children in that class or stream for `class_parents`; the picked children for
`individuals`. A family entering through several audiences combines them. A
Form 3 North trip notice therefore names only the Form 3 North child even when
a sibling is in Form 1, while `{{balance}}` is always the family total.

The valid set for a message is the intersection across the kinds of recipient
its audiences can produce. Selecting parents and teachers together allows only
`{{name}}`. Validation finds every `{{word}}` token in the body and subject and
rejects any outside the valid set, returning the valid list.

## Sending

**Creating a batch**, in one transaction: insert the batch as `queued`; resolve
recipients; for each recipient and each chosen channel insert a `notifications`
row with the rendered subject and body, the recipient's name and destination,
and the batch id. A row whose channel has no usable destination is inserted as
`skipped` with a reason (`No phone number`, `Invalid phone number`,
`No email address`). After commit, write one audit entry and start the sender.
The request returns the batch immediately.

**The background sender**, in-process:

1. Mark the batch `sending`.
2. Claim up to 20 pending rows atomically, recording `claimed_at`:
   `UPDATE notifications SET status = 'sending', claimed_at = now() WHERE id IN
   (SELECT id FROM notifications WHERE batch_id = $1 AND status = 'pending'
   ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING *`.
   `SKIP LOCKED` means two instances can never claim the same row.
3. Send the claimed rows through the provider, five at a time; mark each `sent`
   or `failed`.
4. Broadcast one `messages` live update per chunk.
5. Repeat until a claim returns nothing. When no row is `pending` or `sending`,
   mark the batch `completed` with `completed_at`, and broadcast.

A per-process set of running batch ids stops one instance starting two loops for
the same batch.

**Resuming after a restart.** On startup, after the database connection check:
rows in `sending` whose `claimed_at` is more than five minutes old return to
`pending`, and every batch not `completed` is started. This covers crashes,
redeploys, and Render sleeping an idle instance mid-send.

**Delivery mode.** `GET /messages/config` reports `log_only` while the console
provider is in use and `live` once a real one is configured.

## API

Every route requires `notifications.send`. The sender is always the logged-in
user.

| Route | Purpose |
|---|---|
| `POST /messages/preview` | recipient counts per channel, skipped count, 3 rendered samples, or placeholder errors |
| `POST /messages` | validate, create the batch, start sending; returns the batch |
| `GET /messages` | batch history, newest first, with computed counts |
| `GET /messages/:id` | one batch with every recipient row: name, channel, destination, status, failure reason |
| `GET /messages/recipients/search?q=` | hand-picked search: families by child's name or admission number, teachers, staff |
| `GET /messages/config` | delivery mode |

Validation failures return 400; placeholder errors return 400 with the valid
placeholder list.

## Audit

One entry per batch: action `message.send`, entity `message_batch#id`, after-data
holding the channel, audiences, subject, body template, recipient count and
skipped count. Per-recipient delivery is already recorded in `notifications`.

## Messaging page

The existing unbuilt nav entry becomes **Messaging** at
`/dashboard/communication/messaging`, gated on `notifications.send`.

**Compose.**
- Audience picker: chips for all parents / teachers / staff (with the
  teaching / non-teaching option); class and optional stream selectors; a fee
  balance toggle with a minimum amount; a people search that adds chips.
- Channel: SMS, Email, or Both. A subject field appears when email is included.
- Message box with clickable placeholder chips, showing only those valid for the
  current audiences.
- A live character and segment counter: GSM-7 text is 160 characters for one
  SMS and 153 per part beyond that; any character outside GSM-7 (an emoji, for
  example) drops that to 70 and 67. Extended GSM characters count as two.
- **Preview** shows counts per channel, the skipped count and three samples.
- **Send** asks for confirmation stating the exact recipient count.

**History.** Batches with live counts and progress; selecting one lists its
recipients with statuses and failure reasons.

**Delivery banner.** While `GET /messages/config` reports `log_only`, the page
shows: *"Messages are recorded but not delivered — no SMS or email provider is
configured."*

`RealtimeSync.tsx` gains a `messages` case invalidating the messaging cache.

## Verification

**Backend unit tests (no database).**
- Phone normalisation, including invalid inputs.
- Family grouping: siblings merge; a linked account wins over guardian fields;
  a missing account phone falls back to `guardian_phone`.
- De-duplication across audiences, including a teacher who is also a staff
  record and a person matching on email only.
- Placeholder validation for parents only, teachers only, and mixed audiences;
  unknown and misspelled tokens.
- Rendering for one child, two and three children, and balance formatting.
- Children in scope: a class-scoped message names only the in-class child when a
  sibling is in another class, while `{{balance}}` stays the family total.
- Families merge before the fee-balance filter, so a family split across an
  account and a guardian phone is judged on its combined balance.
- The family balance calculation: cancelled invoices excluded, partial
  allocations, overpayment not netted.
- The background sender, driven by a fake provider and an in-memory store:
  chunked claiming, `sent` and `failed` marking, completion only when nothing is
  pending or sending, and stale `sending` rows returning to `pending`.
- The permission catalogue: the Dean holds `notifications.send`.

**Frontend unit tests.** The SMS segment counter at the GSM-7 and UCS-2
boundaries; which placeholder chips appear for each audience mix; the audience
summary.

**End to end, against the local database** (the scratch-environment approach,
never production):
- Message a class's parents plus all teachers and all staff; the recipient count
  reflects de-duplication of the teachers who are also staff.
- Email to recipients without an email address produces `skipped` rows with the
  right reason; counts add up to the recipient total.
- A placeholder error is refused before anything is written.
- The audit entry names the real sender.
- Stopping the server mid-send and restarting it completes the batch without
  sending any row twice.

## Rollout

1. **Branching.** Recommended: merge the pending dashboard and students/teachers
   branches first, then start this work from the updated `main`, since it
   touches `rbac.ts` and needs the frontend test setup those branches add. If
   they stay unmerged, this work stacks on `feat/student-teacher-delete-and-audit`
   and the merge order is dashboard → students/teachers → messaging.
2. **Migration.** Generated with `pnpm db:generate` and committed. The
   production migration journal is not usable, so the statements are applied to
   production by hand, as with the chart indexes.
3. **Permissions.** Run `pnpm db:sync-rbac` against production before deploying
   the backend.
4. Deploy the backend, then the frontend.

## Out of scope

- Real SMS and email providers — later, as one `NotificationProvider`
  implementation plus keys.
- Scheduled sends, approval before sending, retrying failed recipients, and
  opt-out handling (which providers will require for some message types).
- A page for managing `notification_templates`.
- The parent's in-app inbox and the parent login landing page — both belong to
  sub-project B, the parent portal.
- `POST /notifications/send` taking `createdBy` from the request body — a
  pre-existing issue noted while reading, left unchanged.
