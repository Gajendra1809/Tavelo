# Development

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

`GET`, `POST`, `PATCH`, and `DELETE` under `/api/v1/trips` require `Authorization: Bearer <access token>`. Dates are `YYYY-MM-DD`. Creating a trip stores the signed-in user as the owner. Only that owner can edit or delete it, invite someone, or remove a member. `GET /api/v1/invitations` lists invitations waiting for the signed-in person. Invites look up an existing account by email; there is no outbound mail yet. Future scope: email unknown addresses, ask them to register, then attach the pending invite when they sign up with the same email (third-party provider). Itinerary activities are under `/api/v1/trips/:id/activities` (list, create, get, update, delete). Only accepted trip members can use them. Activity dates must fall within the trip dates. Expenses use `/api/v1/trips/:id/expenses` and settlements under `/api/v1/trips/:id/settlements`. Amounts are integer minor units (INR paise by default). Balances and settlement suggestions are computed on the server. Feature rules (who may add, edit, record, or cancel) are listed in [ARCHITECTURE.md](./ARCHITECTURE.md#group-expenses-and-settlements-business-rules). A cover image, when present, is an `http` or `https` address. The app does not upload photo files yet; that needs object storage.

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
| Physical phone                 | `http://192.168.1.10:4000` |
| Android emulator               | `http://10.0.2.2:4000`     |
| iOS simulator on this computer | `http://localhost:4000`    |

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

## Other checks

```powershell
npm run typecheck
npm run lint
npm test
```

Backend tests do not need Atlas. They cover configuration parsing, CORS decisions, request validation, trip input rules, the health report while MongoDB is disconnected, unknown routes, and malformed JSON.

## Android cleartext HTTP

Local development uses `http://`, not HTTPS. Expo Go permits that. A later development build gets `android:usesCleartextTraffic` from `mobile/plugins/withCleartextTraffic.js` unless `APP_ENV=production` is set when Expo evaluates `app.config.ts`. Release builds should use HTTPS and should not enable cleartext.

## Troubleshooting

**`node -v` is below 22.13.** Install the current Node.js 22 or 24 LTS from [https://nodejs.org](https://nodejs.org) and open a new terminal. Expo SDK 57 will not start on Node.js 18.

**The API exits immediately.** Read the environment error. The usual cause is a missing `backend/.env` or an `MONGODB_URI` that does not start with `mongodb://` or `mongodb+srv://`.

**The database stays disconnected.** Confirm the Atlas user, password, database name, and Network Access IP list. The API log redacts the connection string. The health response will not include it either.

**The phone times out.** Confirm the API log shows it is listening on `0.0.0.0`. From the phone’s browser, open `http://YOUR_LAN_IP:4000/api/v1/health`. If the browser cannot open it, Expo cannot either. Check Wi-Fi and the firewall before changing app code.

**Expo asks for a development build.** This foundation only uses libraries included with Expo Go for SDK 57. Update Expo Go. Do not add native modules that Expo Go does not ship.
