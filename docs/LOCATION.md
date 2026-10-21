# Locations and maps

Tavelo stores locations as structured **places** while keeping legacy text fields for search, older clients, and records created before this feature.

## Data model

Each place includes:

| Field | Purpose |
|-------|---------|
| `name` | Display title (city, hotel, POI) |
| `formattedAddress` | Full address when known |
| `latitude` / `longitude` | Coordinate pair (both set or both null) |
| `placeId` | Provider-specific id |
| `provider` | e.g. `nominatim` |
| `source` | `manual` or `provider` |
| `verified` | `true` when coordinates came from the provider |

**Where it lives**

- Trips: `destination` (string) + optional `destinationPlace`
- Itinerary activities: `location` (string \| null) + optional `place`
- Bookings: `location` (string) + optional `place` (hotel / activity / other)

On write, the API syncs the legacy string from `place.name` when a structured place is sent. Text-only updates clear the stored place subdocument.

## Place search (backend)

Authenticated clients call:

`GET /api/v1/places/search?q={query}&limit=8`

The API geocodes via OpenStreetMap-backed providers:

1. **[Nominatim](https://nominatim.org/)** first (identifiable `User-Agent`, override with `PLACE_SEARCH_USER_AGENT` in backend `.env`, ~1 req/s throttle per process).
2. **[Photon](https://github.com/komoot/photon)** if Nominatim fails (common on shared cloud hosts such as Render).

Results are mapped to the same Tavelo place fields (`provider` is `nominatim` or `photon`).

**Attribution:** show “© OpenStreetMap contributors” wherever search results are displayed (the API returns this in `attribution`).

Nominatim is suitable for light production use behind this proxy; heavy autocomplete load may require caching or a commercial provider later. Do not call Nominatim directly from mobile clients.

## Maps handoff (mobile)

No Google Maps API key is required for **directions**: for destinations picked from **search** (provider + coordinates), the app opens [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) via `Linking.openURL`. Manual text locations do not show Open in Maps.

**In-app map preview** uses read-only [OpenStreetMap](https://www.openstreetmap.org/) tiles (same data family as place search). Embedding an interactive **Google** map inside the app would require a Google Cloud Maps API key (Embed API or Mobile SDK), which is outside Tavelo’s zero–API-key approach. Tap the preview to open the place in the Google Maps app instead.

## Mobile UX

- **LocationField** — shared picker (search → confirm, or manual entry)
- **Directions** — on trip destination, itinerary stops, and booking locations when a label or place exists

## Tests

- Backend: `backend/src/modules/places/place.schema.test.ts`
- Mobile: `mobile/src/features/location/mapsUrls.test.ts`
