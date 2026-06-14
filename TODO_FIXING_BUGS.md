# TODO_FIXING_BUGS (Firebase only)

- [ ] Inspect and understand `config/firebase.ts` current initialization
- [ ] Update `config/firebase.ts`:
  - [ ] Remove global `console.*` overrides; replace with local suppression (no side effects)
  - [ ] Fix Expo env var access (avoid direct `process.env.*` at runtime)
  - [ ] Guard IndexedDB persistence / RN platform compatibility
  - [ ] Make auth initialization robust for hot reload (persistence consistency)
  - [ ] Remove unused emulator import or wire emulator correctly
  - [ ] Make retry logic consistent (auth vs firestore network toggles)
- [ ] Run TypeScript check / tests (if available)

