# Development

For **production deploy and sharing an Android APK with testers**, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Commands assume PowerShell and the repository root unless a step says otherwise. Node.js must be **22.13 or newer**. `node -v` on an older install will not run this Expo SDK.

## Install dependencies

```powershell
npm install
npm run setup
```

Or install each app yourself:

```powershell
npm install --prefix backend
npm install --prefix mobile
```

## Backend environment

```powershell
Copy-Item backend\.env.example backend\.env
```

Set these values in `backend/.env`:

| Name           | Example                                                                              | Required                                        |
| -------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `NODE_ENV`     | `development`                                                                        | No. Defaults to `development`.                  |
| `PORT`         | `4000`                                                                               | No. Defaults to `4000`.                         |
| `MONGODB_URI`  | `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/tavelo?retryWrites=true&w=majority` | Yes.                                            |
| `API_PREFIX`   | `/api/v1`                                                                            | No.                                             |
| `CORS_ORIGINS` | `http://localhost:8081`                                                              | No. Empty in production blocks browser origins. |
| `JWT_ACCESS_SECRET` | Random string, at least 32 characters                                           | Yes, for auth routes.                           |
| `STORAGE_ENABLED` | `false` or `true`                                                                 | No. Default `false` until Supabase is ready.    |
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co`                                              | When storage is enabled.                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase dashboard                               | When storage is enabled. Backend only.          |
| `SUPABASE_STORAGE_BUCKET` | e.g. `tavelo-media`                                                         | When storage is enabled.                        |
| `SIGNED_URL_TTL_SECONDS` | `3600`                                                                       | No. Presigned GET lifetime and sign cache TTL.  |
| `AVATAR_MAX_BYTES` | `5242880` (5 MB)                                                                | No.                                             |
| `TRIP_COVER_MAX_BYTES` | `10485760` (10 MB)                                                          | No.                                             |
| `MEMORY_IMAGE_MAX_BYTES` | `15728640` (15 MB)                                                        | No.                                             |
| `MEMORY_VIDEO_MAX_BYTES` | `104857600` (100 MB)                                                      | No.                                             |
| `BOOKING_ATTACHMENT_MAX_BYTES` | `15728640` (15 MB)                                                  | No.                                             |

Replace `USER`, `PASSWORD`, and `CLUSTER` with the Atlas database user and host. Do not put this file in Git.

In Atlas, Network Access must include your current public IP. A connection string alone is not enough if Atlas rejects the address.

## Start the API

```powershell
npm run dev:backend
```

The process listens on all interfaces, port 4000 by default. A failed database connection is logged and the process stays up.

Production-style start after a build:

```powershell
npm run build --prefix backend
npm run start --prefix backend
```

**Render / CI:** With `NODE_ENV=production`, plain `npm install` skips devDependencies (including TypeScript). Use `npm install --include=dev && npm run build` and Node **22.13.0** — see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Call the health endpoint

With the API running:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
```

Connected database:

```text
success : True
data    : @{status=ok; api=up; database=connected; timestamp=...}
```

The HTTP status is 200.

## Trips

`POST /api/v1/auth/register` and `POST /api/v1/auth/login` return an access token and a refresh token. `POST /api/v1/auth/refresh` rotates the refresh token. `POST /api/v1/auth/logout` revokes it.

`GET`, `POST`, `PATCH`, and `DELETE` under `/api/v1/trips` require `Authorization: Bearer <access token>`. Dates are `YYYY-MM-DD`. Creating a trip stores the signed-in user as the owner. Only that owner can edit or delete it, invite someone, or remove a member. `GET /api/v1/invitations` lists invitations waiting for the signed-in person. Invites look up an existing account by email; there is no outbound mail yet. Future scope: email unknown addresses, ask them to register, then attach the pending invite when they sign up with the same email (third-party provider). Itinerary activities are under `/api/v1/trips/:id/activities` (list, create, get, update, delete). Only accepted trip members can use them. Activity dates must fall within the trip dates. Expenses use `/api/v1/trips/:id/expenses` and settlements under `/api/v1/trips/:id/settlements`. Amounts are integer minor units (INR paise by default). Balances and settlement suggestions are computed on the server. Feature rules (who may add, edit, record, or cancel) are listed in [ARCHITECTURE.md](./ARCHITECTURE.md#group-expenses-and-settlements-business-rules).

Profile avatars and trip covers use [Supabase Storage](https://supabase.com/docs/guides/storage) when storage is enabled. See [ARCHITECTURE.md](./ARCHITECTURE.md#media-storage-business-rules) for permission rules.

### Object storage (Supabase)

1. Sign in at [supabase.com](https://supabase.com) and create a project (free tier is enough for prototyping).
2. Open **Storage** → **New bucket**. Name it (for example `tavelo-media`), leave it **private** (not public).
3. Open **Project Settings** → **API**. Copy:
   - **Project URL** → `SUPABASE_URL` (must start with `https://`)
   - **service_role** secret (under **Project API keys**) → `SUPABASE_SERVICE_ROLE_KEY`  
     Use the **service role** key on the backend only. Never put it in the mobile app or commit it.
4. Copy the storage block from [backend/.env.example](../backend/.env.example) into `backend/.env`. Set `STORAGE_ENABLED=true`, paste URL and service role key, and set `SUPABASE_STORAGE_BUCKET` to the bucket name from step 2.
5. Remove any old `S3_*` / R2 variables from `backend/.env` if they are still there.
6. Restart the backend after changing `.env`.

Optional (Expo web uploads from the browser): in the Supabase dashboard, **Storage** → your bucket → **Configuration** → **CORS**, allow your dev origin (for example `http://localhost:8081`) for `PUT`, `GET`, and `HEAD`. Native Expo Go does not send `Origin` the same way; phone testing usually works without CORS tweaks.

Manual smoke (with a valid access token):

1. `POST /api/v1/users/me/avatar/upload-intent` with `{ "contentType": "image/jpeg", "byteSize": <size> }`.
2. `PUT` the file to `uploadUrl` with header `Content-Type: image/jpeg`.
3. `POST /api/v1/users/me/avatar/complete` with `{ "objectKey": "..." }`.
4. `GET /api/v1/users/me` should return a non-null `avatarUrl`.

Trip covers follow the same pattern under `/api/v1/trips/:id/cover/upload-intent` and `.../complete` (owner only).

When `STORAGE_ENABLED=true`, the API caches Supabase **signed GET URLs** in memory keyed by `objectKey` for `SIGNED_URL_TTL_SECONDS` (minus a small skew). Repeated list/detail requests within that window reuse the same URL instead of calling Supabase sign again. Restarting the backend clears the cache.

Set `JWT_ACCESS_SECRET` in `backend/.env` to a random string of at least 32 characters. Do not commit that value.

Database not reachable:

```text
success : True
data    : @{status=degraded; api=up; database=disconnected; timestamp=...}
```

The HTTP status is 503. `Invoke-RestMethod` may raise an error for 503 even though the JSON body is valid. This still means the API process answered. To see the body when the status is 503:

```powershell
try {
  Invoke-WebRequest http://localhost:4000/api/v1/health
} catch {
  $_.Exception.Response.StatusCode.value__
  $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
  $reader.ReadToEnd()
}
```

## Mobile environment

```powershell
Copy-Item mobile\.env.example mobile\.env
```

| Name                  | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Origin of the API, with no `/api/v1` suffix. |

Examples:

| Where the app runs             | Value                      |
| ------------------------------ | -------------------------- |
| Physical phone (Expo Go)       | `http://192.168.1.10:4000` |
| Android emulator               | `http://10.0.2.2:4000`     |
| iOS simulator on this computer | `http://localhost:4000`    |
| **EAS preview APK (testers)**  | Set in [mobile/eas.json](../mobile/eas.json), not `.env` — e.g. `https://tavelo-api.onrender.com` |

For Render, EAS, and APK distribution, see [DEPLOYMENT.md](./DEPLOYMENT.md).

`192.168.1.10` is only an example. Replace it with this computer’s address.

## Find the computer’s LAN IP

```powershell
ipconfig
```

Use the **IPv4 Address** under the Wi-Fi adapter that is connected to the same network as the phone. Ignore virtual adapters such as VirtualBox, VMware, or vEthernet unless the phone is actually on that network.

Put that address in `mobile/.env`:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000
```

`localhost` and `127.0.0.1` point at the phone when the app is running on the phone. They only work for an emulator or simulator that shares the computer’s network namespace. The Android emulator is the special case `10.0.2.2`, which Android maps to the computer.

## Start Expo

Restart Expo whenever `mobile/.env` changes.

```powershell
npm run dev:mobile
```

If the app still shows an old URL, stop Expo and start it with a clean cache:

```powershell
npm run start --prefix mobile -- --clear
```

Scan the QR code with Expo Go on Android. The phone needs a Play Store Expo Go build that supports SDK 57.

## Android emulator (Windows — recommended instead of Chrome)

There is **no iOS Simulator on Windows**. For a phone-like preview on this PC, use the **Android Emulator** from Android Studio. Expo Go in the emulator behaves like a real device (date pickers, document picker, etc.). Chrome (`w` in Expo) is only useful for quick layout checks.

### One-time setup

1. Install [Android Studio](https://developer.android.com/studio) (includes the SDK and AVD Manager).
2. Open **Android Studio** → **More Actions** → **Virtual Device Manager** → **Create device** (e.g. Pixel 6) → pick a **system image** (API 34 or 35) → finish.
3. Start the virtual device (▶ on the AVD). Wait until the Android home screen appears.
4. On the emulator, open **Play Store**, sign in, and install **Expo Go** (must support **SDK 57**).
5. Point the app at the API on your computer (emulator special address):

   ```text
   EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
   ```

   Put that in `mobile/.env`, then restart Expo. `10.0.2.2` is how the emulator reaches your PC’s `localhost:4000`.

6. Optional — so Expo finds the emulator from PowerShell, add SDK tools to your user PATH (adjust if Android Studio used a different folder):

   ```powershell
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   ```

   Add `%LOCALAPPDATA%\Android\Sdk\platform-tools` and `%LOCALAPPDATA%\Android\Sdk\emulator` to **User PATH**, then open a **new** terminal.

### Daily workflow

Terminal 1 — API (already listening on `0.0.0.0:4000`):

```powershell
npm run dev:backend
```

Terminal 2 — Expo, with the emulator running:

```powershell
npm run dev:mobile
```

In the Expo terminal, press **`a`** to open the project in Expo Go on the emulator. Or scan the QR from the emulator’s camera if prompted.

If **`a`** says no device found, run `adb devices` in a new shell (after PATH setup). You should see one `emulator-5554` (or similar) as `device`.

### Emulator vs physical phone vs web

| Target | `EXPO_PUBLIC_API_URL` | How to launch |
| --- | --- | --- |
| Android emulator | `http://10.0.2.2:4000` | Expo → **`a`** |
| Physical phone (same Wi‑Fi) | `http://YOUR_LAN_IP:4000` | Expo Go → scan QR |
| Chrome (limited) | often `http://localhost:4000` | Expo → **`w`** — not recommended for full UX |

You do **not** need a firewall rule for the emulator → host API; you **do** need it for a physical phone (see below).

## Allow the phone through the firewall

Windows often blocks inbound connections to Node. Allow TCP port 4000 while you are developing. An elevated PowerShell window:

```powershell
netsh advfirewall firewall add rule name="Tavelo API" dir=in action=allow protocol=TCP localport=4000
```

The phone and the computer must use the same Wi-Fi. Guest networks that isolate clients will not work.

Then, in the app, tap **Check connection**.

- **API: Reachable** and **Database: Connected** means the phone reached this computer and Atlas answered a ping.
- **API: Reachable** and **Database: Not connected** means the phone reached the API, but MongoDB did not.
- A network error means the phone never reached the API. Check the LAN IP, the firewall rule, and that `npm run dev:backend` is still running.

## Mobile client data cache

The Expo app keeps short-lived in-memory caches so back navigation and tab switches do not refetch everything. Rules and module list:

- [ARCHITECTURE.md — Client data cache](./ARCHITECTURE.md#client-data-cache-mobile)
- [mobile/src/lib/cache/README.md](../mobile/src/lib/cache/README.md)

**Quick verification (manual):**

1. Open **Trips**, wait for the list, tap a trip — detail should appear without a long skeleton if the trip was just listed (seeded cache).
2. On **Memories**, switch All → Photos → Videos — the grid should not flash empty and should not repeat list requests for each tab.
3. Return to **Trips** within about 60 seconds — the list should stay visible; a background refresh may run without blanking the UI.
4. Pull to refresh on Trips still forces a new `GET /trips`.

Remote images use `expo-image` (`CachedImage`) with stable cache keys. Memory API responses include `objectKey` for that purpose.

**Memories download:** In **Expo Go**, saving uses the system **share sheet** (choose Save to Photos) because Expo Go does not include the SDK 57 `expo-media-library` native module. **Bulk download** in Expo Go shows a hint to save one item at a time or use a **development build** (with the `expo-media-library` config plugin) for direct gallery saves.

## Other checks

```powershell
npm run typecheck
npm run lint
npm test
```

Backend tests do not need Atlas. They cover configuration parsing, CORS decisions, request validation, trip input rules, the health report while MongoDB is disconnected, unknown routes, and malformed JSON. Memory integration tests run with `STORAGE_ENABLED=false` unless you configure storage locally.

## Android cleartext HTTP

Local development uses `http://`, not HTTPS. Expo Go permits that. A later development build gets `android:usesCleartextTraffic` from `mobile/plugins/withCleartextTraffic.js` unless `APP_ENV=production` is set when Expo evaluates `app.config.ts`. Release builds should use HTTPS and should not enable cleartext.

## Mobile file picks and storage uploads

Presigned uploads are easy to break on **native** if code assumes browser or desktop file behavior. Treat this as a checklist whenever you add or change picks, attachments, avatars, covers, or memories.

### Conventions (must follow)

1. **One pipeline** — All PUTs to Supabase go through `mobile/src/services/storageUpload.ts`. Do not add parallel upload helpers that read local URIs with `fetch().blob()` on iOS/Android.
2. **Stage early** — After the user picks a file, copy it to app cache (`stageLocalFileForUpload`) before any network call. Picker temp paths (especially `DocumentPicker/` on Android Expo Go) may become unreadable within milliseconds.
3. **Right picker**
   - **Photos/videos from gallery** → `expo-image-picker` (memories, avatar, trip cover, booking **Photo library**).
   - **PDFs and files** → `expo-document-picker`. On Android use `copyToCacheDirectory: false` and stage from the returned URI; offer gallery separately for images (`promptBookingAttachmentSource`).
4. **MIME** — Normalize on the client (`mobile/src/lib/mimeTypes.ts`). On **complete**, the backend resolves `application/octet-stream` using the object key extension (`resolveStoredContentType` in `backend/src/modules/storage/policy.ts`).
5. **Logging** — Use `logAppError(context, err)` for handled failures so Metro and LogBox show a `[Tavelo]` block with context (e.g. `booking attachment upload`).

### Manual test before merge (upload features)

| Step | Pass criteria |
| --- | --- |
| Android Expo Go, physical phone | Pick file → upload succeeds; attachment appears or memory/cover updates. |
| Backend terminal | `upload-intent` **201**, then `complete` **201** (not 400 validation on JPEG). |
| Metro terminal | No `[Tavelo]` error for the flow you changed. |
| Optional regression | Avatar, trip cover, memory upload if you touched shared `storageUpload.ts`. |

Chrome (`w`) is **not** sufficient for sign-off on pickers or uploads.

Cursor agents load `.cursor/rules/mobile-native-uploads.mdc` when editing mobile features and services.

## Errors and uploads in Expo Go

Upload and API failures are logged with **`console.error`** in development under the prefix **`[Tavelo]`**. Expo surfaces these the same way as other console warnings:

1. **On the phone (LogBox)** — A yellow/red banner may appear after a failed upload. Tap it to expand the message. Lines start with `[Tavelo] booking attachment upload:` (or similar) plus a full text block (API URL, HTTP code, message).
2. **On your PC (best for sharing)** — Keep the terminal running `npm run dev:mobile` open. When the phone hits an error, the **same `[Tavelo]` block** is printed there. Copy from that terminal into Cursor chat.
3. **Dev menu** — Shake the device (or press `m` in the Metro terminal) → **Open JS debugger** / **Toggle element inspector**. JS logs still primarily stream to the Metro terminal unless you attach Chrome DevTools.

The in-app **Copy error details** button duplicates that report for paste into chat when you are not at the computer.

Uncaught crashes show a red screen; handled upload errors only appear via LogBox/`console.error` and the red error panel in the app.

## Troubleshooting

**`node -v` is below 22.13.** Install the current Node.js 22 or 24 LTS from [https://nodejs.org](https://nodejs.org) and open a new terminal. Expo SDK 57 will not start on Node.js 18.

**The API exits immediately.** Read the environment error. The usual cause is a missing `backend/.env` or an `MONGODB_URI` that does not start with `mongodb://` or `mongodb+srv://`.

**The database stays disconnected.** Confirm the Atlas user, password, database name, and Network Access IP list. The API log redacts the connection string. The health response will not include it either.

**The phone times out.** Confirm the API log shows it is listening on `0.0.0.0`. From the phone’s browser, open `http://YOUR_LAN_IP:4000/api/v1/health`. If the browser cannot open it, Expo cannot either. Check Wi-Fi and the firewall before changing app code.

**Expo asks for a development build.** This foundation only uses libraries included with Expo Go for SDK 57. Update Expo Go. Do not add native modules that Expo Go does not ship.
