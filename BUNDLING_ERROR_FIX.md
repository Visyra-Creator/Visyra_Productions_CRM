# Android Bundling Error - FIXED

## Problem
```
Unable to resolve "@/store/authStore" from "app/(admin)/_layout.tsx"
```

## Root Cause
The TypeScript path alias `@/*` in `tsconfig.json` was incorrectly configured to point to `./*` (root directory) instead of `./src/*` (src directory).

When the bundler tried to resolve `@/store/authStore`, it was looking for:
- **Actual path**: `/frontend/src/store/authStore.ts`
- **Expected path**: `/frontend/store/authStore.ts` ❌

## Solution
Updated `tsconfig.json` to correctly map the path alias:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@/*": [
        "./src/*"        // ← FIXED: Now points to src directory
      ]
    }
  }
}
```

### What Changed
```diff
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": [
-       "./*"
+       "./src/*"
      ]
    }
  }
}
```

## Files Affected
The following imports now resolve correctly:

| File | Import | Status |
|------|--------|--------|
| `app/(admin)/_layout.tsx` | `@/store/authStore` | ✅ Fixed |
| `app/auth/login.tsx` | `@/store/authStore` | ✅ Fixed |
| `app/auth/signup.tsx` | `@/store/authStore` | ✅ Fixed |
| `app/waiting-for-approval.tsx` | `@/store/authStore` | ✅ Fixed |
| `src/components/RoleGuard.tsx` | `@/store/authStore` | ✅ Fixed |
| `src/hooks/useRolePermission.ts` | `@/store/authStore` | ✅ Fixed |
| `app/(admin)/employees.tsx` | `@/api/services/users` | ✅ Fixed |

## Additional Fix
Fixed incorrect import in `app/wedding-packages.tsx`:
```diff
- import { colors } from '@/src/theme/colors';
+ import { colors } from '@/theme/colors';
```

## Cache Cleared
Removed Metro bundler cache to force re-compilation:
- `.metro-cache/` ✅
- `node_modules/.cache/` ✅

## Next Steps

### To rebuild and test:

**For Android:**
```bash
cd frontend
npx expo start --android --clear
```

**For iOS:**
```bash
cd frontend
npx expo start --ios --clear
```

**For Web:**
```bash
cd frontend
npx expo start --web --clear
```

## Why This Works

The `@/` alias is now correctly configured to resolve to `./src/`:
- `@/store/authStore` → `./src/store/authStore.ts` ✅
- `@/api/services/users` → `./src/api/services/users.ts` ✅
- `@/theme/colors` → `./src/theme/colors.ts` ✅
- `@/hooks/useAuth` → `./src/hooks/useAuth.ts` ✅

This allows consistent import paths throughout the app without needing relative imports like `../src/store/authStore`.

## Verification
If the build still fails, check:
1. ✅ `tsconfig.json` has `"./src/*"` in paths
2. ✅ Metro cache cleared (`.metro-cache/` removed)
3. ✅ `node_modules` cache cleared
4. ✅ Run with `--clear` flag to force clean build

The bundling error should now be resolved!

