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

Do not store trips until a request can be tied to a real user on the server. Client-supplied user ids are not identity.

## Phase 2 — Trips, invitations, membership, and permissions

Depends on Phase 1.

- An organizer creates a trip.
- Invitations add members.
- Roles such as organizer and member are stored on the server.
- Every trip read or write checks membership in the API. A trip id in the request is only a lookup key.

This phase is the gate for every later feature that touches private trip data.

## Phase 3 — Collaborative itinerary

Depends on Phase 2.

- Days, activities, times, and notes on a trip.
- Members with permission can edit the same itinerary.
- Conflicts and edit rules stay simple: last write wins is acceptable until real usage shows a need for anything heavier.

## Phase 4 — Bookings and expense splitting

Depends on Phase 2. Itinerary display from Phase 3 is useful, but bookings and expenses only require a trip and its members.

- Store flight, hotel, train, and other booking details entered by members.
- Record shared expenses and who paid.
- Calculate a settlement suggestion from those records.
- Money math is server-side so every client sees the same result.

Booking confirmation files, if added, follow the file rule in Phase 5 rather than being embedded in MongoDB documents.

## Phase 5 — Photo and video storage and sharing

Depends on Phase 2. It is independent of the itinerary and expense work, but it should not start before membership checks exist.

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

- Redux or another global store.
- A dependency-injection framework.
- Microservices.
- Docker as a requirement for local development.
- A separate cache service.
- Fake authentication used as a stand-in for Phase 1.
