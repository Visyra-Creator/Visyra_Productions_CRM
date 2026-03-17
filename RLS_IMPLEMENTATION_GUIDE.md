# RLS Implementation Guide - Complete

## Problem Fixed

**Error:** `infinite recursion detected in policy for relation "users"`

**Root cause:** RLS policy evaluation functions were querying `public.users` while RLS policies on `public.users` were being evaluated, creating a loop.

**Solution:** Use `auth.jwt()` to read role/approved directly from JWT token metadata instead of querying the users table.

---

## Migration Order

Run these migrations in **exact order** in Supabase SQL Editor:

### 1) Create users table (if not exists)
```bash
backend/migrations/2026-03-17_users_auth_audit_fix.sql
```

### 2) Backfill existing auth.users into public.users
```bash
backend/migrations/2026-03-17_backfill_users_from_auth.sql
```

### 3) Sync auth metadata (MUST RUN BEFORE RLS)
```bash
backend/migrations/2026-03-17_sync_auth_metadata.sql
```
This creates triggers that sync `role` and `approved` to JWT metadata when users are created or their role/approval status changes.

### 4) Enable RLS and create policies
```bash
backend/migrations/2026-03-17_rls_all_tables.sql
```
Uses `auth.jwt()` to read from JWT claims (no recursion).

### 5) Verify RLS is working
```bash
backend/migrations/2026-03-17_rls_verification_queries.sql
```
Run all queries and confirm expected results.

---

## What Each Migration Does

### `2026-03-17_sync_auth_metadata.sql`

**Trigger 1: `handle_new_user()`**
- Fires when a new auth user is created
- Inserts into `public.users` with default role='employee', approved=false
- Syncs role + approved to `auth.users.raw_user_meta_data` (JSON)

**Trigger 2: `sync_user_metadata_on_update()`**
- Fires when `public.users.role` or `public.users.approved` changes
- Updates `auth.users.raw_user_meta_data` to match
- This ensures JWT always has current role/approval status

### `2026-03-17_rls_all_tables.sql`

**Helper Functions (use `auth.jwt()`):**
- `get_my_role()` → reads role from JWT claims
- `get_my_approved()` → reads approved status from JWT claims
- `is_admin()` → true if role='admin'
- `is_employee_approved()` → true if role='employee' AND approved=true

**Policies Created:**

| Table | Admin Access | Employee Access |
|-------|---|---|
| `users` | Full CRUD | Read own profile only |
| `clients` | Full CRUD | Read only |
| `leads` | Full CRUD | Read only |
| `packages` | Full CRUD | Read only |
| `portfolio` | Full CRUD | Read only |
| `shoots` | Full CRUD | Read only |
| `locations` | Full CRUD | Read only |
| `location_images` | Full CRUD | Read only |
| `payments` | Full CRUD | **BLOCKED** |
| `payment_records` | Full CRUD | **BLOCKED** |
| `expenses` | Full CRUD | **BLOCKED** |
| `app_options` | Full CRUD | **BLOCKED** |

---

## Testing the Setup

### 1) Verify RLS is enabled
```sql
-- Should show all tables with rls_enabled = true
SELECT relname, relrowsecurity FROM pg_class 
WHERE relname IN ('users','clients','payments','expenses','leads');
```

### 2) Verify metadata sync is working
```sql
-- Create a test user via Supabase Dashboard
-- Then check if metadata is synced:

SELECT 
  email,
  (raw_user_meta_data->>'role') AS role,
  (raw_user_meta_data->>'approved') AS approved
FROM auth.users
WHERE email = 'your-test-user@example.com';
```

### 3) Test employee access restriction
From your Expo app:
1. Log in as an **employee** user
2. Try to query `payments` table
3. Expected: `error: new row violates row-level security policy` or empty result
4. Try to query `clients` table
5. Expected: data is returned (read-only)

### 4) Test admin full access
From your Expo app:
1. Log in as an **admin** user
2. Try to INSERT/UPDATE/DELETE on any table
3. Expected: all operations succeed

---

## Troubleshooting

### Issue: "infinite recursion detected"
**Cause:** RLS policy functions are still querying `public.users` table
**Fix:** 
1. Drop all policies: `DROP POLICY IF EXISTS ... ON public.users`
2. Ensure `auth.jwt()` functions are in place
3. Re-apply `2026-03-17_rls_all_tables.sql`

### Issue: "ERROR: permission denied for schema public"
**Cause:** JWT metadata was never set for the user
**Fix:**
1. Ensure `2026-03-17_sync_auth_metadata.sql` was run
2. Create a new test user and check: `SELECT raw_user_meta_data FROM auth.users WHERE email='...'`
3. Should show `{"role": "employee", "approved": "false", ...}`

### Issue: "role field is NULL"
**Cause:** `get_my_role()` returns null because JWT doesn't have metadata
**Fix:**
1. Re-run `2026-03-17_sync_auth_metadata.sql` to create/recreate triggers
2. Create a new auth user (the trigger will fire on insert)
3. Existing users may need manual metadata update

### Issue: Employee can still access payments table
**Cause:** RLS policy not being enforced (RLS still disabled)
**Fix:**
1. Check: `SELECT relrowsecurity FROM pg_class WHERE relname='payments'`
2. Should be `true`
3. If false, run: `ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;`

---

## JWT Metadata Format

After migrations run, each user's JWT will contain:

```json
{
  "role": "admin" | "employee",
  "approved": "true" | "false",
  "name": "...",
  "username": "...",
  "phone": "..."
}
```

The RLS policies read this directly from the JWT token, avoiding any database queries during policy evaluation.

---

## Security Guarantees

✅ **Employees cannot:**
- Read payments, payment_records, expenses tables
- Insert/update/delete on any financial data
- Change their own role or approved status
- Access another employee's profile
- Modify app_options

✅ **Only admins can:**
- Approve employees
- View/modify financial records
- Change user roles
- Modify app configuration

✅ **No privilege escalation:**
- Even if employee bypasses frontend, RLS blocks all unauthorized access
- JWT claims cannot be tampered with (signed by Supabase)
- Employees cannot self-promote to admin

---

## Performance Notes

- Helper functions use `SECURITY DEFINER` and `STABLE` → cached and fast
- No recursive queries → no N+1 problems
- Policies use simple JWT comparisons → minimal overhead
- Indexes on `users(role)` and `users(approved)` for quick filtering

---

## Next Steps

1. **Run migrations in order** (see Migration Order section)
2. **Test with verification queries** (see Testing section)
3. **Test from your Expo app** with real auth users
4. **Monitor logs** for RLS-related errors
5. **Celebrate** 🎉 — your CRM is now secure!

