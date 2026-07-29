# Performance Fixes TODO

## ✅ Fix 1: FilterBar.tsx - Wrap with React.memo

- [x] Wrapped export with React.memo

## ✅ Fix 2: SideMenu.tsx - React.memo + useWindowDimensions

- [x] Wrapped with React.memo
- [x] Replaced `Dimensions.get("window")` with `useWindowDimensions()` hook

## ✅ Fix 3: NotificationsPanel.tsx - React.memo + useWindowDimensions + useCallback

- [x] Wrapped with React.memo
- [x] Replaced `Dimensions.get("window")` with `useWindowDimensions()` hook
- [x] Memoized `getIconForType` and `formatTime` with `useCallback`

## ✅ Fix 4: dashboard.tsx - Extract getIconForSize, useCallback optimizations

- [x] Extracted `getIconForSize` outside the component (module level)
- [x] Already had useCallback for handleOpenNotifications, handleOpenSettings

## ✅ Fix 5: chatService.ts - Fix subscription async callback

- [x] Removed `async` from `onSnapshot` callback
- [x] Added consumer phone number cache to avoid repeated Firestore reads
- [x] Phone numbers resolved in background with deferred update callback
