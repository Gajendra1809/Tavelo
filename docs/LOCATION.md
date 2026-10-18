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

The API proxies [Nominatim](https://nominatim.org/) (OpenStreetMap data) with:

- A identifiable `User-Agent` (override with `PLACE_SEARCH_USER_AGENT` in backend `.env`)
- ~1 request per second throttling per server process
- JSON results mapped to Tavelo place fields

**Attribution:** show “© OpenStreetMap contributors” wherever search results are displayed (the API returns this in `attribution`).

Nominatim is suitable for light production use behind this proxy; heavy autocomplete load may require caching or a commercial provider later. Do not call Nominatim directly from mobile clients.

## Maps handoff (mobile)

No Google Maps API key is required for **directions**: verified coordinates or manual names/addresses open via [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) using `Linking.openURL`.

**In-app map preview** uses read-only [OpenStreetMap](https://www.openstreetmap.org/) tiles (same data family as place search). Embedding an interactive **Google** map inside the app would require a Google Cloud Maps API key (Embed API or Mobile SDK), which is outside Tavelo’s zero–API-key approach. Tap the preview to open the place in the Google Maps app instead.

## Mobile UX

- **LocationField** — shared picker (search → confirm, or manual entry)
- **Directions** — on trip destination, itinerary stops, and booking locations when a label or place exists

## Tests

- Backend: `backend/src/modules/places/place.schema.test.ts`
- Mobile: `mobile/src/features/location/mapsUrls.test.ts`
