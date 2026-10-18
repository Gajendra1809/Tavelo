# Deployment and tester builds

This guide deploys **Tavelo from one GitHub monorepo**:

| Part | Where it runs | Purpose |
| --- | --- | --- |
| **API** (`backend/`) | [Render](https://render.com) Web Service | REST API for the mobile app |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) | Trip and user data (already used locally) |
| **Media** (optional) | [Supabase Storage](https://supabase.com) | Avatars, covers, memories, booking files |
| **Mobile** (`mobile/`) | [Expo EAS Build](https://docs.expo.dev/build/introduction/) | Installable **Android APK** for testers |

**Vercel** is not used for the API (Express needs a long-running Node process). You may later host an Expo **web** export on Vercel; this doc focuses on **native Android testing**.

---

## Before you start

- [ ] Code is pushed to **GitHub** (one repo with `backend/`, `mobile/`, `docs/`).
- [ ] Node **22.13+** on your machine for local checks.
- [ ] A [Render](https://render.com) account (GitHub login is fine).
- [ ] An [Expo](https://expo.dev) account (free tier includes limited cloud builds).
- [ ] **Do not commit** `backend/.env` or `mobile/.env`. Production secrets live only in Render and EAS.

**Production API URL shape:** `https://YOUR-SERVICE.onrender.com` — no trailing slash. The app adds `/api/v1` paths internally via `EXPO_PUBLIC_API_URL` + client code.

---

## Part 1 — MongoDB Atlas (production)

You can reuse the same Atlas cluster as development or create a separate database user for production.

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Open your **Project** → **Database** → your cluster → **Connect**.
3. Choose **Drivers** → copy the connection string. It looks like:
   ```text
   mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/tavelo?retryWrites=true&w=majority
   ```
4. Replace `USER` / `PASSWORD` with a dedicated production user (recommended), not your personal password.
5. **Network Access** (left sidebar):
   - For early testing: **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   - Render’s outbound IPs change on some plans; open access is common for prototypes. Tighten later if you use static egress.
6. Save the final `MONGODB_URI` in a password manager. You will paste it into Render in Part 3.

**Verify locally (optional):** Put the URI in `backend/.env`, run `npm run dev:backend`, open `http://localhost:4000/api/v1/health` — `database` should be `connected`.

---

## Part 2 — Supabase Storage (optional but recommended)

Without storage, auth and trips work; avatars, covers, memories, and booking attachments need `STORAGE_ENABLED=true`.

Follow the same steps as [DEVELOPMENT.md — Object storage (Supabase)](./DEVELOPMENT.md#object-storage-supabase):

1. Create a Supabase project.
2. Create a **private** bucket (e.g. `tavelo-media`).
3. Copy **Project URL** and **service_role** key (backend only — never in the mobile app).
4. You will set these on Render:
   - `STORAGE_ENABLED=true`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`

---

## Part 3 — Deploy the API on Render

### 3.1 Create the Web Service

1. Go to [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**.
2. **Connect repository** → select your **Tavelo** GitHub repo.
3. Configure:

   | Field | Value |
   | --- | --- |
   | **Name** | `tavelo-api` (or any name; URL becomes `https://tavelo-api.onrender.com`) |
   | **Region** | Closest to your testers |
   | **Branch** | `main` |
   | **Root Directory** | `backend` |
   | **Runtime** | **Node** |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance type** | Free for demos (sleeps when idle); paid avoids cold starts |

4. Set **Node version** to **22.13.0** (Render **Environment** → `NODE_VERSION=22.13.0`, or rely on [backend/.node-version](../backend/.node-version)). Avoid Node 26 until the backend TypeScript toolchain is on TS 6 with updated `moduleResolution`.

### 3.2 Environment variables on Render

In the service → **Environment** → add:

| Key | Value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | |
| `PORT` | `10000` | Render often injects `PORT`; if set automatically, **do not override** — use Render’s `PORT` env if present |
| `MONGODB_URI` | `mongodb+srv://...` | From Part 1 |
| `JWT_ACCESS_SECRET` | Random 32+ chars | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `API_PREFIX` | `/api/v1` | Default; set explicitly if you changed it locally |
| `CORS_ORIGINS` | *(empty or omit)* | Native Android app does not need browser CORS. Set only if you ship **Expo web** to a domain |
| `STORAGE_ENABLED` | `true` or `false` | Match Part 2 |
| `SUPABASE_URL` | `https://....supabase.co` | If storage enabled |
| `SUPABASE_SERVICE_ROLE_KEY` | *(secret)* | If storage enabled |
| `SUPABASE_STORAGE_BUCKET` | `tavelo-media` | If storage enabled |

Copy any other limits from [backend/.env.example](../backend/.env.example) if you changed defaults.

**Important:** Use a **new** `JWT_ACCESS_SECRET` for production, not your dev `.env` value.

### 3.3 Deploy

1. Click **Create Web Service** (or **Save Changes**).
2. Wait for **Build** then **Deploy** to succeed (logs in the Render dashboard).
3. Note the public URL, e.g. `https://tavelo-api.onrender.com`.

### 3.4 Verify the API

In PowerShell:

```powershell
Invoke-RestMethod https://tavelo-api.onrender.com/api/v1/health
```

Expect `success: True` and `data.database: connected` (HTTP 200).

If the service was sleeping (free tier), the first request may take 30–60 seconds.

**Optional — register a test user:**

```powershell
$body = @{ name = "Test"; email = "test@example.com"; username = "testuser"; password = "TestPass123!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://tavelo-api.onrender.com/api/v1/auth/register" -Body $body -ContentType "application/json"
```

(Use a unique email/username; adjust fields to match your register schema.)

### 3.5 Optional: `render.yaml` in the repo

The repo includes [render.yaml](../render.yaml) as a template. You can use **New → Blueprint** on Render to sync from Git, then set **secret** env vars in the dashboard (Blueprint will not contain secrets).

---

## Part 4 — Configure the mobile app for production

Installable builds must talk to **HTTPS**, not `http://192.168.x.x`.

| Variable | Where set | Example |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | EAS build env (below) | `https://tavelo-api.onrender.com` |
| `APP_ENV` | EAS build env | `production` (disables Android cleartext HTTP plugin) |

Local `mobile/.env` can stay on LAN IP for Expo Go; **testers use the EAS APK**, which bakes in the EAS env at build time.

---

## Part 5 — Expo EAS: build an Android APK

### 5.1 One-time setup

1. Create / sign in at [expo.dev](https://expo.dev).
2. Install EAS CLI (PowerShell):

   ```powershell
   npm install -g eas-cli
   eas login
   ```

3. From the repo:

   ```powershell
   cd mobile
   eas init
   ```

   Link the project to your Expo account when prompted. This updates `app.config.ts` / project ID as needed.

4. The repo already includes [mobile/eas.json](../mobile/eas.json). Open it and replace the placeholder API URL:

   ```json
   "EXPO_PUBLIC_API_URL": "https://YOUR-SERVICE.onrender.com"
   ```

### 5.2 Build a preview APK (internal testing)

```powershell
cd mobile
eas build -p android --profile preview
```

- First build may ask you to create an **Android keystore** — let EAS manage it (recommended).
- Wait for the build on [expo.dev](https://expo.dev) → your project → **Builds**.

When it finishes:

- Open the build page → **Download** or scan the **QR code** on an Android phone.
- Install the APK. Android may prompt **Allow from this source** for Chrome or Files.

### 5.3 Share with testers

Send testers:

1. The **Expo build page link** (they download the APK), or  
2. Download the APK yourself and upload to **Google Drive**, **Dropbox**, or **GitHub Releases**, and share that link.

Include short instructions:

- Install the APK (unknown sources if needed).
- Register a new account or use a test account you created.
- If the app shows network errors, confirm the API health URL in a browser on the same phone.

### 5.4 Rebuild after API or app changes

- **App code or UI:** run `eas build` again with the same profile.
- **Only API URL change:** update `eas.json` env → new build (URL is compiled into the bundle).
- **Backend-only fix:** push to GitHub → Render auto-redeploys; no new APK unless the app must change.

### 5.5 iOS (optional, later)

- Requires Apple Developer Program (**$99/year**).
- `eas build -p ios --profile preview` then **TestFlight** for testers.
- Same `EXPO_PUBLIC_API_URL` and `APP_ENV=production` in the iOS profile.

---

## Part 6 — End-to-end checklist

| Step | Done |
| --- | --- |
| Atlas `MONGODB_URI` works; Network Access allows Render | ☐ |
| Render service **Live**; health returns `database: connected` | ☐ |
| Supabase env set if using media | ☐ |
| `eas.json` has correct `EXPO_PUBLIC_API_URL` | ☐ |
| `eas build -p android --profile preview` succeeded | ☐ |
| APK: register, login, create trip, one feature (e.g. itinerary) | ☐ |

---

## Troubleshooting

### Build fails: `moduleResolution=node10` has been removed

Render installed **Node 26** and **TypeScript 6**, which rejects legacy `moduleResolution: "node"`. Fix:

- Set **`NODE_VERSION=22.13.0`** on the Render service (and redeploy), and
- Pull the latest repo (backend pins TypeScript **5.8** and includes `backend/.node-version`).

### API 503 / database disconnected on Render

- Check `MONGODB_URI` in Render env (no typos; user has read/write on `tavelo` DB).
- Atlas **Network Access** must allow Render (often `0.0.0.0/0` for testing).
- Read **Logs** tab on Render for Mongoose connection errors.

### App “Network request failed” on APK

- `EXPO_PUBLIC_API_URL` must be **`https://...`** matching Render URL, **no** `/api/v1` suffix.
- Rebuild APK after changing the URL.
- On phone browser, open `https://YOUR-SERVICE.onrender.com/api/v1/health`.

### Render free tier slow first load

- Service **spins down** after inactivity. First request wakes it; warn testers or upgrade instance.

### Uploads fail in production

- Confirm `STORAGE_ENABLED=true` and Supabase keys on Render.
- Service role key must be **service_role**, not anon key.

### JWT / auth works locally but not production

- Ensure production uses its own `JWT_ACCESS_SECRET`; tokens from dev API are invalid on prod.

---

## What not to deploy from this repo

| Path | Reason |
| --- | --- |
| `backend/.env` | Secrets — Render env only |
| `mobile/.env` | Local dev; production URL via EAS |
| `node_modules/` | Installed on Render / EAS during build |

---

## Quick reference commands

```powershell
# Local sanity before deploy
npm run build --prefix backend
npm test --prefix backend

# EAS Android APK
cd mobile
eas build -p android --profile preview

# Production API health (replace host)
Invoke-RestMethod https://tavelo-api.onrender.com/api/v1/health
```

For day-to-day development, see [DEVELOPMENT.md](./DEVELOPMENT.md).
