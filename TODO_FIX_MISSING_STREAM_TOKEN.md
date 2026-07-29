# Fix "missing stream token" Error on Supplier Registration

## Steps

- [x] 1. Analyze root cause - race condition with Firestore network stream initialization
- [x] 2. Edit `services/supplierAuthService.ts` - Import `enableFirestoreNetwork` and await before `setDoc()` retry loop
- [x] 3. Edit `services/authService.ts` - Import `enableFirestoreNetwork` and await before `createUserDocument()` → `setDoc()`
- [x] 4. Verify the fix compiles and the error is resolved
