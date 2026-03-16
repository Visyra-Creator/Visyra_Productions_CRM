# RLS Fix - Updated Quick Start (Fixes "Cannot coerce" Error)

## The New Error

```
ERROR: Cannot coerce the result to a single JSON object
```

This happened because:
1. RLS policies were applied ✅
2. But JWT metadata (role, approved) wasn't synced for existing users ❌
3. So the policies couldn't determine if user is admin/employee
4. Query returned 0 rows → `.single()` failed

## 🚀 How to Fix It NOW

### Step 1: Open Supabase SQL Editor

Go to: **Supabase Dashboard → SQL Editor → New Query**

### Step 2: Run the UPDATED RLS migration

Copy **all** of this into SQL Editor:

File: `backend/migrations/2026-03-17_rls_all_tables.sql` (UPDATED)

This version has fixed `users` table policies that allow anyone to read their own record (no JWT check needed).

Click **"Run"** and wait for success.

### Step 3: Run the metadata backfill

Copy **all** of this into SQL Editor:

File: `backend/migrations/2026-03-17_backfill_jwt_metadata.sql`

This syncs existing users' role/approved to their JWT metadata.

Click **"Run"** and wait for success.

### Step 4: Clear your Expo app and restart

```bash
cd frontend
npm start -- --clear
```

Then reload the app.

---

## ✅ Expected Result

- ✅ No more "Cannot coerce" error
- ✅ No more "infinite recursion" error
- ✅ Login works for all users
- ✅ RLS policies work correctly

---

## 📋 Run Order (CRITICAL)

1. ✅ `2026-03-17_rls_all_tables.sql` (UPDATED version)
2. ✅ `2026-03-17_backfill_jwt_metadata.sql` (NEW)

**Do NOT skip step 2** — without metadata backfill, existing users will still fail.

---

## 🔑 Why This Works

Old policies:
```sql
-- ❌ BROKEN - requires JWT metadata that doesn't exist yet
CREATE POLICY users_admin_read_all
  USING (public.is_admin());  -- JWT might not have role field
```

New policies:
```sql
-- ✅ FIXED - allows anyone to read their own record
CREATE POLICY users_read_own_always
  USING (id = auth.uid());  -- no JWT required

-- ✅ Also allows admins to read all
CREATE POLICY users_admin_read_all
  USING (public.is_admin());  -- admin JWT check still works
```

---

Done! Let me know if you hit any errors while running the migrations.

