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

## Trips, before accounts exist

`GET /api/v1/trips`, `POST /api/v1/trips`, and `GET /api/v1/trips/:id` store and return trips. A trip has a name, destination, start date, end date, and optional description. Dates are calendar dates (`YYYY-MM-DD`), stored at UTC midnight so the day does not shift with the server timezone.

There is still no authentication. These routes do not accept a user id, and they do not isolate trips per person. Anyone who can reach the API can list and create trips. That is temporary development behavior. Do not put private details in a trip until a later phase checks membership on the server. The create-trip screen says this in the app.

## Data and access, later

There is no authentication yet. The server must not trust a user id, trip id, or role sent by the client. Accounts and membership checks still have to land before trip data can be treated as private.

Photos and videos will go to object storage. MongoDB should store metadata and object keys, not file bytes.

## Logging

In development, each response logs the method, path, status, and duration. The query string is not logged. Test and production runs skip that line. Unexpected server errors are logged with secrets redacted.
