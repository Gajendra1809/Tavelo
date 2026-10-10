# Tavelo

Tavelo is a travel collaboration app. A trip organizer can create a trip and invite friends. Members will eventually plan an itinerary, store bookings, track shared expenses, share photos, and revisit the trip later.

This repository is the foundation: a React Native app and a Node.js API that can confirm the app, API, and MongoDB are connected. Trip features are planned in [docs/ROADMAP.md](docs/ROADMAP.md) and are not implemented yet.

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

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the app, API, and database fit together
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — commands, LAN IP setup, and troubleshooting
- [docs/ROADMAP.md](docs/ROADMAP.md) — phased product plan

## Git

Creating the Expo app also created a Git repository inside `mobile/` that contains only the original template commit. The API, docs, and root files are outside that repository. When you want one history for the whole project, delete `mobile/.git` and run `git init` in this folder. Keep `backend/.env` and `mobile/.env` untracked.

## Current limits

Authentication, trips, and uploads are not built. The health endpoint is public. Do not store private trip data until server-side authentication and authorization exist. Uploaded files belong in object storage later, not in MongoDB documents.
