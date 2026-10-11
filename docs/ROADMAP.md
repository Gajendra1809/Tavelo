# Roadmap

Each phase depends on the one before it. The foundation does not include accounts or trip data, because those need server-side identity and membership checks first.

## Phase 0 — Foundation and local connectivity

Status: this repository.

- Expo app and Express API in one repo.
- Typed configuration, health check, and error shape.
- The phone can reach the API on the LAN and see database connectivity.

Exit criteria: the API starts, connects to MongoDB when credentials are present, and the Expo app reports both results.

## Phase 1 — Authentication and user profiles

Depends on Phase 0.

- Account registration and sign-in.
- Password hashing and server-issued sessions or tokens.
- A profile the signed-in user can read and update.
- The mobile API client sends the credential. It does not decide who the user is.

Registration, login, refresh-token rotation, and logout are in place. The client stores tokens in SecureStore on a device. Trip routes use the user id from the access token.

## Phase 2 — Trips, invitations, membership, and permissions

Depends on Phase 1.

- An organizer creates a trip.
- Invitations add members.
- Roles such as organizer and member are stored on the server.
- Every trip read or write checks membership in the API. A trip id in the request is only a lookup key.

A signed-in person can create a trip, open its details, and edit or delete it. The creator can invite another registered account by email. Accepting adds that person as a member. The creator remains the only person who can edit, delete, invite, or remove members. Cover photos need object storage; a trip may store an image address, not the file.

**Future scope — invitation email (not built yet):** When the owner enters an email that has no Tavelo account, the API will create a pending invitation tied to that address (or an equivalent token), send a message through a third-party email provider, and ask the person to register. After sign-up with the same email, the invitation appears in the app (Invitations screen) so they can accept and join the trip. That flow needs outbound email, templates, deep links or sign-up handoff, and provider configuration. Today only registered users can be invited, and nothing is sent to their inbox.

## Phase 3 — Collaborative itinerary

Depends on Phase 2.

Status: shared itinerary on trip details is implemented.

- Day tabs follow the trip’s start and end dates.
- Activities store title, optional location, date, optional times, and notes.
- Accepted members can add, edit, and delete activities on the server.
- Maps, drag-and-drop scheduling, and offline sync are still ahead.

## Phase 4 — Bookings and expense splitting

Depends on Phase 2. Itinerary display from Phase 3 is useful, but bookings and expenses only require a trip and its members.

Status: shared trip expenses and settlements are implemented (integer minor units, equal/custom splits, balance ledger, suggested transfers, recorded payments). Profile avatars and trip covers upload to Supabase Storage (signed upload URL, keys in MongoDB). **Shared bookings with PDF/image attachments** are implemented (Phase 7). Payment gateways are still ahead.

- Store flight, hotel, train, and other booking details entered by members. *(Done: trip bookings list, CRUD, attachments via Supabase.)*
- Record shared expenses and who paid.
- Calculate a settlement suggestion from those records.
- Money math is server-side so every client sees the same result.
- Permission rules (documented in [ARCHITECTURE.md](./ARCHITECTURE.md#group-expenses-and-settlements-business-rules)): any member adds expenses; only expense creator or trip owner edits/deletes; only payer or recipient records a settlement; recorder or trip owner cancels a settlement; expense edits lock while recorded settlements exist.

Booking confirmation files, if added, follow the file rule in Phase 5 rather than being embedded in MongoDB documents.

## Phase 5 — Photo and video storage and sharing

Depends on Phase 2. It is independent of the itinerary and expense work, but it should not start before membership checks exist.

Status: storage foundation, profile/trip cover uploads, and trip **memories** gallery (photos/videos, member uploads, captions) are in place. Client-side fetch caching (TTL stores, stale-while-revalidate, memory filter without refetch) and backend signed-URL caching are documented in [ARCHITECTURE.md](./ARCHITECTURE.md#client-data-cache-mobile). Video transcoding at upload time is still ahead; the app generates video thumbnails on device where needed.

- Upload media to object storage.
- Store only metadata and object keys in MongoDB.
- Members of the trip can view that trip’s media.
- Access control is checked on the server before a file URL is issued.

## Phase 6 — AI photo discovery and trip summaries

Depends on Phase 5 for photo features, and on Phase 3 if a summary needs the itinerary.

- Optional identification of photos that include a particular traveler.
- Requires an explicit privacy choice. Default is off. People who appear in photos are not enrolled silently.
- Generated summaries and recommendations are assistive. They do not overwrite the itinerary or expenses.

## Phase 7 — Maps, notifications, offline, testing, and release

Depends on the features that need them. Maps need places from the itinerary or bookings. Notifications need membership and a device token model. Offline needs a defined set of trip data that is safe to cache.

- Maps for the itinerary.
- Push notifications for invitations and trip changes.
- Offline reading of recently opened trips, with a clear sync rule.
- Automated tests around auth and permissions, then store builds.

A freemium plan can be evaluated after the core trip loop works. It is not part of the foundation, and it should not block Phases 1 through 3.

## Explicitly later

These stay out until a phase needs them:

- Outbound invitation email for people who do not have an account yet (register-then-accept flow; third-party mail provider).
- Redux or another global store.
- A dependency-injection framework.
- Microservices.
- Docker as a requirement for local development.
- A separate cache service.
- Fake authentication used as a stand-in for Phase 1.
