# TODO - Live location tracking (consumer -> supplier)

- [x] Implement Firestore fields for live location in the conversation doc.
  - [x] Add helper(s) in `services/chatService.ts` (or a dedicated file) to update `consumerLiveLocation`.
- [ ] Update consumer order UI (`app/consumer/order.tsx`)
  - [ ] Add post-order prompt/button: “Share live location”.
  - [ ] Request permission and start `expo-location` watch when enabled.
  - [ ] On each update, write `consumerLiveLocation` (lat/lng/address) + `consumerLiveLocationUpdatedAt` to the conversation doc.
  - [ ] Stop watch when toggle is off / unmount.
- [ ] Update supplier order UI (`app/supplier/order.tsx`)
  - [ ] Subscribe to conversation doc and read `consumerLiveLocation`.
  - [ ] Render a clean tracking card showing last update time and distance/coordinates.
  - [ ] (Optional) Show map marker if SupplierMap can be reused.
- [ ] Update Privacy Policy (`app/privacy.tsx`) to mention live location sharing for active orders.
- [ ] TypeScript/build + smoke test flow.

