# Trip chat and decision polls

Each trip has one conversation and a set of decision polls. Members discuss an idea in chat, create a poll, and vote. Adding the result to the itinerary or bookings is a separate manual step.

Only accepted trip members can read or write chat and polls. A removed member loses access immediately (`403`). Messages from other trips are never returned.

## User flow

1. Open a trip. Use the **Chat** tab, or the chat icon in the trip header. The conversation stays on the trip, under a compact cover, title, and member strip. The same compact strip is used on every tab except Overview.
2. Send text messages. Links that start with `https://` are tappable.
3. **New poll** to ask a question (hotel, activity, dates, and other presets).
4. Vote on the compact poll card in chat, or open the full poll.
5. The creator can close the poll early. Deadlines are enforced on the server.
6. Ties never pick a winner automatically. Nobody can push a poll result into the itinerary or bookings from chat. Add those on the Itinerary or Bookings tab if the group decides to.

There is **no** Socket.IO or paid realtime service. While chat is open, the app refreshes messages and polls about every 4 seconds. Closing the screen stops that polling. Data is always persisted in MongoDB first.

There is **no** message encryption.

## Chat

| Method | Path | Who |
| --- | --- | --- |
| `GET` | `/api/v1/trips/:id/chat/messages` | Member. Cursor page: `limit` (1–50, default 30), `before`, `after` |
| `POST` | `/api/v1/trips/:id/chat/messages` | Member. Body `{ body, clientNonce? }` |
| `DELETE` | `/api/v1/trips/:id/chat/messages/:messageId` | Sender of that **text** message |
| `POST` | `/api/v1/trips/:id/chat/read` | Member. Body `{ messageId }` |
| `POST` | `/api/v1/trips/:id/chat/typing` | Member. Marks typing for ~5 seconds (in-memory) |

Message body is trimmed, required, and capped at 2000 characters. `clientNonce` (8–64 chars) is unique per sender per trip so retries do not create duplicates. Listing the newest page also stores a read receipt for the caller.

Response shape:

```json
{
  "messages": [],
  "olderCursor": "…",
  "newerCursor": "…",
  "reads": [{ "userId": "…", "name": "…", "lastReadMessageId": "…", "lastReadAt": "…" }],
  "typing": [{ "id": "…", "name": "…", "avatarUrl": null }]
}
```

Text messages can be soft-deleted by their sender (`deleted: true`, empty body). Poll cards are removed by deleting the poll. A trip may hold at most 5000 messages.

## Polls

| Method | Path | Who |
| --- | --- | --- |
| `GET` | `/api/v1/trips/:id/polls` | Member |
| `POST` | `/api/v1/trips/:id/polls` | Member |
| `GET` | `/api/v1/trips/:id/polls/:pollId` | Member of **that** trip |
| `PATCH` | `/api/v1/trips/:id/polls/:pollId` | Creator, while open |
| `DELETE` | `/api/v1/trips/:id/polls/:pollId` | Creator (blocked only if an older document was already written to the trip) |
| `POST` | `/api/v1/trips/:id/polls/:pollId/options` | Member, if `allowAddOptions` and open |
| `POST` | `/api/v1/trips/:id/polls/:pollId/vote` | Member, while open |
| `DELETE` | `/api/v1/trips/:id/polls/:pollId/vote` | Member, while open |
| `POST` | `/api/v1/trips/:id/polls/:pollId/close` | Creator |

Create body: `question`, `options` (2–10 unique labels), optional `description`, `category`, `voteType` (`single` default or `multiple`), `maxChoices`, `anonymous`, `allowAddOptions`, `deadlineAt`.

Rules:

- Vote counts come from the `PollVote` collection. Unique index `{ pollId, userId }` keeps one ballot per member. Changing a vote replaces that row.
- Closed or expired polls reject new votes (`409`). Expiry uses `deadlineAt` on the server.
- Anonymous polls return `voters: null`. Members still see totals and their own `ownOptionIds`.
- A tied poll has `result.kind = "tie"` and does not declare a winner.
- There is no API that writes a poll result into the itinerary or bookings.
- A trip may hold at most 50 polls.

Categories: `destination`, `hotel`, `restaurant`, `activity`, `transport`, `dates`, `other`.

## Data

**ChatMessage** — `tripId`, `senderId`, `kind` (`text` \| `poll`), `body`, `pollId`, `clientNonce`, `deletedAt`.

Indexes: `{ tripId, createdAt, _id }`, `{ tripId, pollId }`, unique partial `{ tripId, senderId, clientNonce }`.

**ChatRead** — unique `{ tripId, userId }` with `lastReadMessageId`, `lastReadAt`.

**TripPoll** — question, options (embedded), vote settings, deadline, status, `messageId`. Unused leftover fields (`finalizedAt` and related) may exist on older documents; the API does not write them or expose an add-to-itinerary action.

**PollVote** — unique `{ pollId, userId }` with `optionIds`.

Deleting a trip deletes its messages, read receipts, polls, and votes. Removing a member does not rewrite history; they simply cannot call the routes.

## Notifications (in-app only)

These rows are stored in MongoDB. A new row is also sent as a phone push when that person has a registered device. See [PUSH.md](./PUSH.md).

| Type | When |
| --- | --- |
| `chat_message` | Another member sent a text message. At most one per recipient per trip per hour (`idempotencyKey`). |
| `poll_created` | A new poll was created. |
| `poll_closed` | The creator closed a poll. |

Individual votes do not notify. Deadline reminders are not sent (there is no job runner). Opening one of these notifications goes to `/trip/:id?tab=chat` (the old `/trip/:id/chat` path redirects there).

## Tests

From `backend/`:

```powershell
npx tsx --test --test-concurrency=1 src/modules/chat/chat.schema.test.ts src/modules/chat/poll.schema.test.ts src/modules/chat/chat.integration.test.ts src/modules/chat/poll.integration.test.ts
```

From `mobile/` (link and label helpers):

```powershell
npx tsx --test --test-concurrency=1 src/features/chat/messageLinks.test.ts src/types/poll.test.ts
```

## Known limits

- No media attachments in chat. Option image URLs must already be `https` links.
- Typing indicators live in process memory and reset if the API restarts.
- Read receipts are last-message watermarks, not per-message ticks for every line.
- No scheduled “poll closing soon” notifications.
- No end-to-end encryption.
