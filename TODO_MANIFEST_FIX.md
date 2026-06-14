# Manifest merger fix (GOOGLE_MAPS_API_KEY)

## Problem
Android build fails at `:app:processDebugMainManifest` with:
- `Attribute meta-data#com.google.android.geo.API_KEY@value requires a placeholder substitution but no value for <GOOGLE_MAPS_API_KEY> is provided.`

## Fix options
1) Provide GOOGLE_MAPS_API_KEY via Gradle/Env/Expo config.
2) Ensure `GOOGLE_MAPS_API_KEY` placeholder is defined for Android builds.

## Recommended implementation
- Set the key in `.env.local` as `GOOGLE_MAPS_API_KEY=...` (or in environment variables) so Expo’s config plugin resolves `${GOOGLE_MAPS_API_KEY}` for Android manifest meta-data.

## Steps to finish
- [ ] Create/update `CheckGas/.env.local` with `GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE`.
- [ ] Rebuild Android debug.
- [ ] If still failing, verify the key also exists during Gradle run (same terminal session) and that Expo config generates Android manifest correctly.

