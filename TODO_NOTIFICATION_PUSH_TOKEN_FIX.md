# TODO: Fix push token error (No Firebase App '[DEFAULT]' has been created)

## Plan

1. Update `services/notificationService.ts` to stop calling `@react-native-firebase/messaging`.
   - Keep Expo Notifications flow: `Notifications.getExpoPushTokenAsync`.
2. Ensure foreground/background listeners do not use `messaging()` methods.
3. Save token to Firestore as before.
4. Run app / rebuild to confirm the error is gone.

## Notes

- Current error indicates `@react-native-firebase/messaging` is used without initializing `@react-native-firebase/app`.
- Recommended approach for this Expo project: rely only on `expo-notifications` push tokens.
