# Shared packing

Packing lives on a trip. There are two lists:

- **Group packing** — shared items the whole trip can see (adapter, first-aid kit). Any accepted member can add, edit, tick packed, assign an owner, or delete.
- **My packing** — the signed-in member’s private checklist for that trip. Only that member can read or change it. The API never returns anyone else’s personal items.

There is no realtime channel. Other members see group changes when they open or return to the Packing tab (the client shows cache immediately, then refetches).

## Privacy

Personal items are scoped in MongoDB to `{ tripId, kind: 'personal', userId: <auth user> }`. Looking up a personal item by id still requires that same `userId`. A member who guesses another person’s item id receives `404 Item not found.` — the same response as a missing id — so existence is not leaked.

`userId` and `createdBy` on create/update are ignored (stripped by Zod) and set from the access token. Clients cannot reassign a personal item.

## API

All routes require a valid access token and trip membership (`401` without a token, `403` if the caller is not on the trip).

| Method | Path | Who |
| --- | --- | --- |
| `GET` | `/api/v1/trips/:id/packing/group` | Member. Returns `{ items, packedCount, total }` |
| `POST` | `/api/v1/trips/:id/packing/group` | Member. Body `{ name, ownerId? }` |
| `PATCH` | `/api/v1/trips/:id/packing/group/:itemId` | Member. Body `{ name?, packed?, ownerId? }` |
| `DELETE` | `/api/v1/trips/:id/packing/group/:itemId` | Member |
| `GET` | `/api/v1/trips/:id/packing/mine` | Member; **only that member’s** personal items |
| `POST` | `/api/v1/trips/:id/packing/mine` | Member. Body `{ name }` |
| `PATCH` | `/api/v1/trips/:id/packing/mine/:itemId` | Owner of that item only |
| `DELETE` | `/api/v1/trips/:id/packing/mine/:itemId` | Owner of that item only |

On the wire the packed flag is `packed` (not `isPacked`). `ownerId` must be a current trip member, or empty/null for unassigned. A non-member owner is `400`. Blank names are `400`. Names are trimmed and capped at 120 characters. Each list (group for the trip, or one member’s personal list) may hold at most 100 items.

A group item id used on `/mine`, or a personal id used on `/group`, is `404`.

## Data model

Collection `PackingItem`:

| Field | Group | Personal |
| --- | --- | --- |
| `kind` | `'group'` | `'personal'` |
| `name` | required, trimmed, max 120 | same |
| `packed` | boolean, default false | same |
| `createdBy` | auth user | auth user |
| `ownerId` | assigned bringer, or null | always null |
| `userId` | null | auth user (list owner) |
| `tripId` | trip | trip |
| `createdAt` / `updatedAt` | mongoose timestamps | same |

Indexes: `{ tripId, kind, createdAt }` and `{ tripId, kind, userId, createdAt }`.

If a group item still points at a former member, list responses treat `owner` as unassigned.

## Trip lifecycle

- **Delete trip** — all packing rows for that `tripId` are deleted with activities, bookings, expenses, memories, and invitations.
- **Remove member** — that member’s **personal** packing for the trip is deleted (not left as orphans). Group items they were assigned to become **unassigned**. They can no longer call packing routes (`403`).

## Mobile

Trip details include a **Packing** tab (`TripPackingSection`) at the same level as Itinerary and Bookings.

- Lists load when the tab is focused. Cached rows paint immediately, then the tab refetches so shared group changes from other members show up on revisit.
- `packingCache` (60s TTL) holds group and personal lists separately. Successful mutations patch the cache and ignore in-flight fetches so a slower list response cannot overwrite a newer save.
- Owner chips are the current trip’s members only.

## Tests

From `backend/`:

```powershell
npx tsx --test --test-concurrency=1 src/modules/packing/packing.schema.test.ts src/modules/packing/packing.integration.test.ts
```

Progress-label unit tests (from `mobile/`):

```powershell
npx tsx --test src/types/packing.test.ts
```

`npm test` in `backend/` includes the packing schema and integration files.
