# TODO - Supplier persistence + offline caching

## Step 1 - Add AsyncStorage persistence for supplier dashboard

- [x] Update `services/supplierAuthService.ts` to cache `SupplierData` per supplierId in AsyncStorage with TTL.
- [x] Add helpers to read/write cached supplier dashboard data.
- [x] Update `getSupplierData` to return cached data immediately when offline/unavailable.

## Step 2 - Prime cache on supplier login

- [x] Update `app/supplier/login.tsx` to prefetch supplier dashboard data after login (so dashboard is instant on next launch).

## Step 3 - Logout clears supplier cache

- [x] Update `services/authService.ts` logout flow to remove cached supplier dashboard data + supplier session marker.

## Step 4 - Dashboard UI offline behavior

- [x] Update `app/supplier/dashboard.tsx` loading flow to show cached data immediately (no long spinner).

## Step 5 - Verification

- [ ] Manual test matrix:
  - [ ] Login once as supplier -> next app open goes directly to dashboard.
  - [ ] Offline open -> dashboard renders cached supplier data.
  - [ ] Logout -> next app open shows role selection/login.
