Firebase Functions for GasAround push notifications.

- Trigger: onCreate of `notifications/{notificationId}`
- Filter: only `data.type === 'new_order'` and `type === 'order'`
- Sends Expo push to the supplier using `users/{supplierId}.pushToken`

