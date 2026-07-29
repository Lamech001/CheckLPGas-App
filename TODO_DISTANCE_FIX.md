# TODO_DISTANCE_FIX.md

- [x] Identify where distance-from-consumer to supplier is computed
- [x] Inspect UI components that display `supplier.distance` (SupplierCard, SupplierDetailModal)
- [x] Inspect the distance math implementation(s) (Haversine)
- [x] Confirm the radius value path (UI -> hooks -> services) and how radius is clamped
- [x] Fix the radius clamp bug in `services/cachedSupplierService.ts` (remove/parameterize `MAX_NEARBY_RADIUS_KM = 1`)
- [x] Ensure all supplier fetching paths use the same "effective radius" logic
- [x] Updated all query functions to use geohash-bounded Firestore queries for efficiency
- [x] Added `firestore.indexes.json` composite index for geohash queries
- [ ] Typecheck/lint/build and sanity-check distances by moving ~1km vs ~5km
