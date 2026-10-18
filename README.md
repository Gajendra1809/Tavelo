# Tavelo

Tavelo is a travel collaboration app. A trip organizer can create a trip and invite friends. Members will eventually plan an itinerary, store bookings, track shared expenses, share photos, and revisit the trip later.

This repository holds the React Native app and the Node.js API. Signed-in people can create trips, invite members, plan a shared itinerary, keep shared bookings and confirmation documents, share trip photos and videos (memories), and track group expenses with balances and settlements. Expense and settlement permission rules are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#group-expenses-and-settlements-business-rules). Profile, trip covers, and memories use Supabase Storage when configured ([media rules](docs/ARCHITECTURE.md#media-storage-business-rules), [setup](docs/DEVELOPMENT.md#object-storage-supabase)). The mobile app uses a lightweight in-memory TTL cache to avoid redundant fetches ([client cache](docs/ARCHITECTURE.md#client-data-cache-mobile), [cache modules](mobile/src/lib/cache/README.md)). Other roadmap items are in [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository layout

```text
mobile/     Expo app (Expo Router, TypeScript)
backend/    Express API (TypeScript, MongoDB, Zod)
docs/       Architecture, development, and roadmap
```

The app lives at the repository root rather than in a nested `travel-collab/` folder because this directory is already the project.

## Prerequisites

- Node.js **22.13 or newer** and npm. Expo SDK 57 does not run on Node.js 18.
- MongoDB Atlas, or another MongoDB server, when you want the health check to report a connected database.
- Expo Go on a phone, updated to a build that supports **SDK 57**.
- For a physical Android phone: the phone and the computer on the same Wi-Fi network.

Check the Node version before installing:

```powershell
node -v
```

## Install

From the repository root:

```powershell
npm install
npm run setup
```

`npm install` installs Prettier for the root scripts. `npm run setup` installs the backend and mobile dependencies.

## Configure

Create local env files from the examples. Do not commit the copies.

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item mobile\.env.example mobile\.env
```

Edit `backend/.env` and set `MONGODB_URI` to your Atlas connection string. In Atlas, open Network Access and allow this computer’s IP address.

Edit `mobile/.env` and set `EXPO_PUBLIC_API_URL` to a URL the phone can reach. `localhost` on a phone is the phone itself. Use the computer’s LAN address, for example `http://192.168.1.10:4000`. Find that address with `ipconfig` and read the IPv4 address of the Wi-Fi adapter.

Restart Expo after changing `mobile/.env`. The value is read when the bundle starts.

The variable lists and the phone setup are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Run

Use two terminals.

```powershell
npm run dev:backend
```

```powershell
npm run dev:mobile
```

Open the project in Expo Go and tap **Check connection**. A reachable API shows “API: Reachable”. A working database shows “Database: Connected”. If the API is up and MongoDB is not, the database line stays “Not connected”.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the app, API, and database fit together (includes [client data cache](docs/ARCHITECTURE.md#client-data-cache-mobile), trips, expenses, memories, storage)
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — commands, env vars, Supabase setup, cache verification, and troubleshooting
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploy API (Render), Atlas, Supabase, and Android tester APK (EAS)
- [mobile/src/lib/cache/README.md](mobile/src/lib/cache/README.md) — cache modules, hooks, seeding, and invalidation
- [docs/ROADMAP.md](docs/ROADMAP.md) — phased product plan

## Git

Creating the Expo app also created a Git repository inside `mobile/` that contains only the original template commit. The API, docs, and root files are outside that repository. When you want one history for the whole project, delete `mobile/.git` and run `git init` in this folder. Keep `backend/.env` and `mobile/.env` untracked.

## Current limits

Sign-in is required before a trip can be created, opened, edited, or deleted. Registration requires a unique username (Instagram-style rules). The creator finds other members by searching name, @username, or email, then sends an in-app invitation. Accepting the invitation adds that person as a member. Only the creator can change the trip, invite people, or remove members. Trips saved before accounts existed have no owner and stay hidden. Trip covers and profile photos upload to object storage (Supabase); MongoDB stores keys only. See DEVELOPMENT.md for Supabase setup. The app does not send invitation email. **Future scope:** email people who are not on Tavelo yet, prompt them to register, then show the pending invitation after sign-up (third-party mail provider).
