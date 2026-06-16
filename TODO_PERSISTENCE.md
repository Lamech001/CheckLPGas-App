# TODO_PERSISTENCE.md

## Auth + persistence (consumer/supplier)
- [ ] Add a persistent “consumer session” marker in local cache after successful email verification.
- [ ] Add auth gating in the welcome/index route so that if consumer session exists, it navigates to /(tabs) without login.
- [ ] Ensure unverified users cannot enter authenticated routes: consumer/supplier should be routed to verify-email if emailVerified is false.

## Supplier data + supplier lists permanent cache
- [ ] Verify supplier caching uses Infinity TTL with persistent storage keys for supplier list + supplier detail.
- [ ] Ensure supplier dashboard can render from cached supplier data immediately, then refresh in background.

## Registration behavior
- [ ] Confirm signup flow does not treat “registration success” as “authenticated”.
- [ ] Ensure verify-email deep link application sets the local session marker.

## Testing checklist
- [ ] New consumer signup → click email link → app opens to consumer tabs; restarting app keeps user logged in.
- [ ] New supplier signup → click email link → app opens supplier dashboard; restarting app keeps user logged in.
- [ ] Try app launch before verifying email → must not open authenticated routes.

