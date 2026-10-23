# Mobile client data cache

In-memory TTL caches reduce duplicate API calls when navigating between trip screens. There is **no** TanStack Query and **no** disk persistence: restarting the app clears all entries.

Product-level rules and backend signing behavior are in [docs/ARCHITECTURE.md](../../../../docs/ARCHITECTURE.md#client-data-cache-mobile).

## Modules

| File | Export | TTL constant | Scope |
| --- | --- | --- | --- |
| `createTTLStore.ts` | `createTTLStore`, `createKeyedTTLStore` | (per caller) | Generic store with `get`, `set`, `isFresh`, `invalidate`, `subscribe` |
| `tripCache.ts` | `tripCache`, `useCachedTrip`, `useCachedTripList` | `TRIP_LIST_TTL_MS`, `TRIP_DETAIL_TTL_MS` (60s) | Trip list + per-trip detail |
| `memoryCache.ts` | `memoryCache`, `filterMemoryItems` | `MEMORY_LIST_TTL_MS` (5 min) | Paginated memory list snapshot per trip |
| `expenseCache.ts` | `expenseCache` | `EXPENSE_BUNDLE_TTL_MS` (60s) | Trip + expenses + balances + settlements bundle |
| `invitationCache.ts` | `invitationCache` | `INVITATION_LIST_TTL_MS` (60s) | Received invitations list |
| `profileCache.ts` | `profileCache` | `PROFILE_TTL_MS` (120s) | Last successful `GET /users/me` timestamp |
| `avatarDisplay.ts` | `bumpAvatarDisplayGeneration`, `avatarImageCacheKey` | (in-memory generation) | Busts `expo-image` cache after avatar upload/delete when signed URLs repeat |
| `activityCache.ts` | `activityCache` | `ACTIVITY_DAY_TTL_MS` (60s) | Itinerary activities for `tripId` + calendar day |
| `packingCache.ts` | `packingCache` | `PACKING_TTL_MS` (60s) | Group and personal packing lists per trip |

## Hooks

| Hook | Role |
| --- | --- |
| `useTrips` (`src/hooks/useTrips.ts`) | Trip list with focus policy: show cache when fresh, background `listTrips` when fresh, full load when stale or empty. Export `seedTripForNavigation(trip)`. |
| `useTripFromCache` (`src/hooks/useTripFromCache.ts`) | Single trip stale-while-revalidate: render cached trip immediately, `getTrip` only when missing or TTL expired. |

## Navigation seeding

Before `router.push` to a trip route when the `Trip` object is already loaded (list cards), call:

```typescript
import { seedTripForNavigation } from '@/hooks/useTrips';

seedTripForNavigation(trip);
router.push(`/trip/${trip.id}`);
```

Used from Trips tab, Home upcoming cards, and Expenses tab trip list.

## Invalidation (mutations)

After a successful write, invalidate the smallest set of keys so the next focus or forced refresh sees new data.

| Event | Typical invalidation |
| --- | --- |
| Create trip | `tripCache.setTrip(created)`, `tripCache.invalidateList()` |
| Update / cover change / delete trip | `tripCache.invalidateTrip(id)`, `tripCache.invalidateList()`; delete also `memoryCache.invalidate(id)` |
| Remove member | `tripCache.setTrip(updated)`, `expenseCache.invalidate(tripId)` |
| Accept invitation | `tripCache.invalidateList()`, `invitationCache` updated locally |
| Expense / settlement change | `expenseCache.invalidate(tripId)` then forced reload |
| Memory upload / caption / delete | `memoryCache` patched or invalidated in `TripMemoriesScreen` |
| Itinerary CRUD | `activityCache.invalidateDay(tripId, day)` |
| Packing CRUD | `packingCache` patched in `TripPackingSection` (in-flight list fetches are ignored after a local write); `packingCache.invalidate(tripId)` on trip delete or member remove. The Packing tab refetches on focus so shared group changes from other members appear on revisit. |
| Avatar change | `profileCache.invalidate()` |

## Memories filter

The grid always loads with `filter=all` on the API. UI tabs (All / Photos / Videos) use `filterMemoryItems(items, filter)` only—no refetch on tab change.

## Images

Remote images use `expo-image` via `src/components/CachedImage.tsx`. Pass a stable `cacheKey` (memory `objectKey`, `avatar:{userId}`, `trip-cover:{tripId}`) so new signed URLs still hit disk/memory cache.

Memory list JSON includes `objectKey` and `thumbnailObjectKey` from the API for this purpose.
