# Fix: Supplier Dashboard Price Update & Cached Price Bug

## Steps:

1. ✅ Fix `setPhoneNumber` error in `loadSupplierData` in `dashboard.tsx` - removed `setPhoneNumber(data.phoneNumber || "")` call
2. ✅ Add `forceRefresh` parameter to `getSupplierData()` in `supplierAuthService.ts` to bypass both in-memory and AsyncStorage caches
3. ✅ Update `loadSupplierData` in `dashboard.tsx` to accept `forceRefresh` param and pass it to `getSupplierData`
4. ✅ Update `handleUpdatePrices` to call `loadSupplierData(true)` for fresh data after save
