# Trip destination weather

Tavelo shows **current conditions at the trip destination** inside the existing Trip Details info card (not a separate tab or card). Weather appears only when the destination was chosen from **place search** with **verified coordinates**. Manual text destinations do not show weather.

## Provider

- **[Open-Meteo](https://open-meteo.com/)** forecast API (no API key).
- Docs: [https://open-meteo.com/en/docs](https://open-meteo.com/en/docs)
- Terms: [https://open-meteo.com/en/terms](https://open-meteo.com/en/terms) — non-commercial use is free; **commercial use requires prior permission** from Open-Meteo. Confirm compliance before a paid/public launch.
- Attribution returned by the API and shown in the app: **“Weather data by Open-Meteo.com”**.

Provider calls run **only on the backend**. The mobile app calls Tavelo’s API.

## API

Authenticated trip members:

`GET /api/v1/trips/:tripId/weather`

Optional query: `refresh=true` for a manual refresh (throttled server-side).

Responses:

- `available: true` — current temp, condition, feels-like, daily high/low (today), hourly slice, metadata (`fetchedAt`, `observationTime`, `cacheStatus`, `isStale`).
- `available: false` — `manual_location` or `missing_coordinates` with a short message.

Coordinates come from `destinationPlace` on the trip (verified provider location), never from device GPS.

## Caching (backend)

- **In-memory** cache keyed by rounded lat/lon (shared across members and trips at the same coordinates).
- Default TTL: **15 minutes**.
- Manual refresh cooldown per trip: **30 seconds** (returns cached data if tapped too soon).
- On provider failure, serves the last cached payload when present and sets `meta.isStale: true`.
- **Limitation:** cache is per Node process and is cleared on deploy/restart; it is not shared across multiple Render instances unless you add Redis or similar later.

## Mobile

- Service: `mobile/src/services/weatherService.ts`
- UI: `mobile/src/features/weather/` (compact row + bottom sheet on Trip Details)
- No new env vars; uses `EXPO_PUBLIC_API_URL` like other API calls.

## Testing

Backend (sequential, from repo root):

```bash
npm test --prefix backend
```

Includes `weatherCodes`, `weatherEligibility`, `openMeteo.service`, and `weather.integration` (mocked Open-Meteo).

Mobile unit tests:

```bash
npx tsx --test mobile/src/features/weather/weatherFormat.test.ts mobile/src/features/weather/weatherEligibility.test.ts
```

## Manual verification (Android)

1. Restart backend after pulling weather changes; redeploy Render for production APKs.
2. Open a trip whose destination was picked from **search** (not manual entry).
3. On Trip Details, confirm temp in the destination row and the compact weather row at the bottom of the info card.
4. Tap the row for hourly detail; use refresh and confirm loading state.
5. Edit trip to a **manual** destination — weather should disappear.
6. Trips with manual-only destinations should never call the weather endpoint from the client.
