# Architecture

Tavelo is a small monorepo. The Expo app calls a single Express API. The API is the only process that talks to MongoDB.

```text
Expo app  --HTTP JSON-->  Express /api/v1  -->  MongoDB Atlas
```

The phone never receives the database connection string or any other server secret. Expo only sees variables prefixed with `EXPO_PUBLIC_`.

## Mobile

`mobile/app` is the Expo Router route tree. `mobile/src` holds everything else.

| Path              | Responsibility                                     |
| ----------------- | -------------------------------------------------- |
| `app/`            | Screens and the root stack. Route files stay thin. |
| `src/features/`   | Screen composition for a product area.             |
| `src/components/` | Reusable UI such as buttons and status views.      |
| `src/hooks/`      | React state for a user action.                     |
| `src/services/`   | Feature calls built on the shared API client.      |
| `src/lib/`        | API client and environment reading.                |
| `src/theme/`      | Colors, spacing, type, and radii.                  |
| `src/types/`      | Shared response shapes.                            |
| `src/constants/`  | Fixed values such as the health path.              |

The app was created from Expo’s blank TypeScript template, then Expo Router was added with the official install set. The example tabs template was not used, so the project does not carry sample screens.

Expo Router’s navigation code loads React Native Reanimated. `react-native-reanimated` and `react-native-worklets` are therefore direct dependencies, pinned to the versions Expo SDK 57 ships in Expo Go (`4.5.1` and `0.10.1`). An unpinned install selects newer releases that Expo Go does not match. `react-dom` is pinned to `19.2.3` with an npm override for the same reason: that is the React version this SDK uses, and npm otherwise selects a newer `react-dom` that will not install beside it. The native app does not render through `react-dom`.

`src/lib/apiClient.ts` is the only place that calls `fetch`. It reads `EXPO_PUBLIC_API_URL`, times out after 10 seconds, and turns network failures into a readable `ApiError`. There is no hardcoded production host.

The health service accepts HTTP 200 and 503. Both can carry a successful report. A disconnected database is a reported status, not a failed request. Timeouts and connection failures are errors.

## Backend

| Path              | Responsibility                                                |
| ----------------- | ------------------------------------------------------------- |
| `src/server.ts`   | Load configuration, listen, connect to MongoDB, shut down.    |
| `src/app.ts`      | Build the Express app without opening a port. Tests use this. |
| `src/config/`     | Environment, database, and CORS.                              |
| `src/middleware/` | Logging, 404s, and errors.                                    |
| `src/routes/`     | Mount feature routers under the API prefix.                   |
| `src/modules/`    | Feature behavior. Health is the only module so far.           |
| `src/utils/`      | Response helpers, errors, validation, and secret redaction.   |

Business decisions sit in modules and services. Route handlers parse the request, call that code, and send the response.

The server listens on `0.0.0.0` so a phone on the same network can connect. It keeps serving if MongoDB is down, and the health check says so.

Shutdown on `SIGINT` and `SIGTERM` closes the HTTP server and disconnects Mongoose. Logs pass connection strings through a redaction step before they are printed.

## Configuration

Backend environment variables are loaded with dotenv from `backend/.env` and checked with Zod in `src/config/env.ts`. Invalid configuration stops the process before it listens. Error text does not include the rejected secret value.

| Variable       | Role                                              |
| -------------- | ------------------------------------------------- |
| `NODE_ENV`     | `development`, `test`, or `production`.           |
| `PORT`         | HTTP port. Defaults to `4000`.                    |
| `MONGODB_URI`  | MongoDB connection string. Required.              |
| `API_PREFIX`   | Mount path. Defaults to `/api/v1`.                |
| `CORS_ORIGINS` | Comma-separated browser origins. `*` is rejected. |

`EXPO_PUBLIC_API_URL` is the mobile base URL, origin only, without `/api/v1`. The health path lives in `mobile/src/constants/api.ts`. If `API_PREFIX` changes, that constant must change with it.

`APP_ENV=production` is read by `mobile/app.config.ts` on the development machine. It is not an `EXPO_PUBLIC_` variable, so it is not shipped as app configuration data. When it is `production`, the Android cleartext plugin is omitted. Local builds otherwise set `android:usesCleartextTraffic` so a development build can call `http://` on the LAN. Expo Go already allows that HTTP traffic; the plugin matters for a later prebuild.

## API responses

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [{ "path": "body.name", "message": "Required" }]
  }
}
```

`details` is optional and is used for validation field errors. Responses do not include stack traces. Production 500 responses use a generic message. Development 500 responses include the error message after connection strings are redacted.

`GET /api/v1/health` is the exception that uses HTTP status for readiness:

| Database      | HTTP | Body                                                                                      |
| ------------- | ---- | ----------------------------------------------------------------------------------------- |
| Connected     | 200  | `data.status` is `ok`, `data.database` is `connected`                                     |
| Not connected | 503  | `success` is still `true`, `data.status` is `degraded`, `data.database` is `disconnected` |

`success: true` means the API process answered with a real connectivity report. The HTTP status tells a monitor whether the dependency is ready. The body does not include host names, credentials, or server versions.

Other error codes: `VALIDATION_ERROR`, `INVALID_JSON`, `NOT_FOUND`, `FORBIDDEN`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.

Incoming JSON is limited to 1 MB. Routes that need validation should use `validate()` from `src/utils/validate.ts`. It parses `body`, `query`, and `params` with Zod and stores the result on `req.validated`. Express 5 query objects are left untouched because replacing them is unreliable.

## CORS

Browser callers must send an `Origin` that is on `CORS_ORIGINS`. In development, localhost and private LAN addresses are allowed as well, including `exp://` URLs used by Expo. Production does not add that LAN exception.

Requests with no `Origin` are allowed. Expo Go on a device usually omits it. That is not authentication. A public health check does not grant access to future trip data.

A wildcard origin is rejected at startup in every environment.

## Accounts

`POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, and `POST /api/v1/auth/logout` create and end a session. Passwords are hashed with bcrypt before they are stored. Responses never include the hash.

Access tokens are short-lived JWTs signed with `JWT_ACCESS_SECRET`. Refresh tokens are random strings. The database stores only their SHA-256 hash. Each refresh rotates the token and revokes the previous one. Presenting a revoked refresh token revokes every session for that user. Logout revokes the presented refresh token.

The phone keeps both tokens in Expo SecureStore. The laptop browser has no keychain, so the same keys are kept in `localStorage` for that one case. Passwords are never stored on the device.

Login and registration are rate limited. A failed login uses the same message whether the email exists or not.

## Visual theme

The mobile app uses one set of tokens in `mobile/src/theme`. Screens sit on a soft sky-to-ivory wash, with white cards, teal actions, and seafoam highlights. Scenic photos are used for the sign-in hero and for a trip cover when a cover address exists. Memories is still a placeholder. Shared expenses use a dedicated Expense collection and Settlement records per trip. Trip details include a shared day-by-day itinerary for accepted members.

## Trips

Trip routes require a valid access token. The creator is the user id inside that token. `creatorId`, `ownerId`, and `members` in a request body are ignored.

| Method | Path | Who |
| --- | --- | --- |
| `GET` | `/api/v1/trips` | Trips the caller owns or belongs to |
| `POST` | `/api/v1/trips` | Creates a trip and adds the caller as the owner member |
| `GET` | `/api/v1/trips/:id` | Owner or member. Missing id is 404. Someone else's trip is 403 |
| `PATCH` | `/api/v1/trips/:id` | Owner only. A member who is not the owner receives 403 |
| `DELETE` | `/api/v1/trips/:id` | Owner only. Success returns `{ deleted: true }` |
| `POST` | `/api/v1/trips/:id/invitations` | Owner invites a registered email |
| `GET` | `/api/v1/trips/:id/invitations` | Owner sees invitations sent for that trip |
| `DELETE` | `/api/v1/trips/:id/invitations/:invitationId` | Owner cancels a pending invitation |
| `DELETE` | `/api/v1/trips/:id/members/:userId` | Owner removes a member. The creator cannot be removed |
| `GET` | `/api/v1/invitations` | Pending invitations for the signed-in person |
| `POST` | `/api/v1/invitations/:id/accept` | The invited person joins the trip |
| `POST` | `/api/v1/invitations/:id/decline` | The invited person declines and gains no access |
| `GET` | `/api/v1/trips/:id/activities` | Member lists activities; optional `?date=YYYY-MM-DD` |
| `POST` | `/api/v1/trips/:id/activities` | Member adds an activity |
| `GET` | `/api/v1/trips/:id/activities/:activityId` | Member reads one activity |
| `PATCH` | `/api/v1/trips/:id/activities/:activityId` | Member updates an activity |
| `DELETE` | `/api/v1/trips/:id/activities/:activityId` | Member deletes an activity |
| `GET` | `/api/v1/trips/:id/expenses` | Member lists trip expenses |
| `POST` | `/api/v1/trips/:id/expenses` | Member adds an expense |
| `GET` | `/api/v1/trips/:id/expenses/balances` | Member net balances by currency |
| `GET` | `/api/v1/trips/:id/expenses/settlement-suggestions` | Suggested transfers from balances |
| `GET/POST` | `/api/v1/trips/:id/settlements` | List or record an off-app payment |
| `DELETE` | `/api/v1/trips/:id/settlements/:settlementId` | Cancel a recorded settlement |
| `GET/PATCH/DELETE` | `/api/v1/trips/:id/expenses/:expenseId` | Read, update, or delete one expense |

A missing or invalid token is 401. Error bodies do not include the trip. An invitation card for the recipient includes the trip name, destination, and inviter name.

Stored fields are `name` (the title), `destination`, `description`, `startDate`, `endDate`, optional `coverImageUrl`, `ownerId`, and `members` (`userId` plus `owner` or `member`). Responses also include `title` (the same value as `name`), `creatorId`, the creator's name, and member names looked up from user accounts. Names are not copied onto the trip. Older trips with no `members` array are returned with the owner as the only member. Missing description and cover are returned as an empty string and `null`.

Dates are calendar dates (`YYYY-MM-DD`), stored at UTC midnight so the day does not shift with the server timezone. The end date cannot be earlier than the start date, including when an update changes only one of the two dates.

`coverImageUrl` accepts an `http` or `https` address, or `null` to clear it. The API does not accept image bytes. Choosing a photo in the app needs object storage and an upload flow, which are not configured yet.

Trips created before accounts have no `ownerId`. They are not listed and cannot be opened. They are not assigned to anyone. To remove them, delete trip documents in MongoDB where `ownerId` does not exist.

### Group expenses and settlements (business rules)

Expenses live in an `Expense` collection with embedded share rows (`userId`, `amountMinor`). Settlements are off-app payment records (not a payment gateway). Amounts are integers in minor currency units (INR paise by default).

| Topic | Rule |
| --- | --- |
| **Who can view** | Accepted trip members only (403 for others). |
| **Add expense** | Any trip member. Payer and every participant must be a current member. Expense date must fall within the trip dates. |
| **Edit or delete expense** | The member who created the expense, or the trip owner. Blocked with 409 while any **recorded** (non-cancelled) settlement exists on that trip. |
| **Equal split** | Amount divided across participants; leftover paise assigned in stable `userId` order. |
| **Custom split** | Each share is whole minor units; shares must sum to the expense amount exactly. |
| **Balances** | Derived on the server: `netMinor = paidMinor − shareMinor`, then adjusted by recorded settlements (payer treated as paying out, recipient as receiving). |
| **Settlement suggestions** | Greedy transfers from negative net to positive net; same result for every client. |
| **Record settlement** | Only the **payer** or **recipient** of that transfer may record it (403 for other members). Amount cannot exceed the outstanding balance between those two for that currency. |
| **Cancel settlement** | The member who recorded it, or the trip owner. Cancelling unlocks expense edits again. |
| **Former members** | Removed members remain on historical expense rows; names show as “Former member” when they are no longer on the trip. |
| **Trip delete** | Deletes that trip’s expenses and settlements. |

Responses always include the trip owner in the member list even when older data stored only invitees in `members`.

Itinerary activities live in a separate `ItineraryActivity` collection keyed by `tripId`. Each activity has a calendar `date` (stored at UTC midnight, same as trip dates), optional `startTime` and `endTime` as `HH:mm`, optional location and notes, and `createdBy` from the access token. Accepted trip members can list, add, update, and delete activities. Routes are nested under `/api/v1/trips/:id/activities`. Deleting a trip deletes its activities.

Invitations are stored separately from the trip, with a status of pending, accepted, or declined. A unique index allows only one pending invitation for the same trip and person. Accepting adds that person to `members` with the member role. Declining does not. Deleting a trip also deletes its invitations. Only an existing Tavelo account can be invited, and the app does not send email.

**Future scope:** Invite by email when no user exists yet—store a pending invite for that address, send a registration message via a third-party email service, then surface the same invitation after the person registers with matching email so they can accept in the app. Not implemented in the current API.

## Data and access, later

The server does not trust a user id sent by the client. Trip access uses the verified token. Changing an id does not open a trip unless that account is the creator or a member.

Photos and videos will go to object storage. MongoDB should store metadata and object keys, not file bytes.

## Logging

In development, each response logs the method, path, status, and duration. The query string is not logged. Test and production runs skip that line. Unexpected server errors are logged with secrets redacted.
