# TODO: Fix RN crash from React Native maps (ReadableNativeMap -> Double)

## Cause

Android crash: `ReadableNativeMap cannot be cast to java.lang.Double`.

## Fix applied

- Hardened `components/supplier/ConsumerLiveLocationMapModal.tsx` by validating/coercing `consumerLiveLocation.latitude/longitude` into finite numbers before passing to `react-native-maps` props:
  - `initialRegion`
  - `animateToRegion`
  - `Marker.coordinate`

- Hardened `components/consumer/SupplierMap.tsx` by:
  - computing a `safeRegion` / `safe coordinate` from `userLocation`
  - only rendering the map when coordinates are valid
  - (intended) coercing user coordinate values before passing into native map props

## Remaining

- `SupplierMap.tsx` must be re-checked for syntax/type errors introduced during edits.
- Re-run `expo run:android` / build to verify crash is gone.
