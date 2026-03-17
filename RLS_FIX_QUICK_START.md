# RLS Fix - Quick Start Checklist

## ✅ The Problem is Solved

The infinite recursion error happened because RLS policy functions were querying `public.users` while RLS was evaluating policies on `public.users`.

**Solution:** Use `auth.jwt()` to read role/approved from token metadata instead of the database.

---

## 🚀 How to Fix It (Run This Order)

### Step 1: Open Supabase SQL Editor

Go to: **Supabase Dashboard → SQL Editor → New Query**

### Step 2: Run Migration #1 (Sync Metadata)

Copy **all** of this into SQL Editor and execute:

File: `backend/migrations/2026-03-17_sync_auth_metadata.sql`

This creates triggers that sync `role` and `approved` to JWT metadata.

### Step 3: Run Migration #2 (Enable RLS)

Copy **all** of this into SQL Editor and execute:

File: `backend/migrations/2026-03-17_rls_all_tables.sql`

This enables RLS on all tables and creates policies using JWT claims.

### Step 4: Verify It Works

Run this quick check:

```sql
-- Check RLS is enabled
SELECT relname, relrowsecurity FROM pg_class 
WHERE relname IN ('users','clients','payments','expenses','leads');
-- Should all show: true
```

### Step 5: Test from Your App

1. **Log in as admin** → can access payments/expenses tables
2. **Log in as employee** → cannot access payments/expenses, CAN access clients/leads
3. **Check console** → should NOT see "infinite recursion" error anymore

---

## 📝 What Was Changed

| File | Purpose |
|------|---------|
| `2026-03-17_rls_all_tables.sql` | ✏️ **UPDATED** - Now uses `auth.jwt()` instead of querying users table |
| `2026-03-17_sync_auth_metadata.sql` | ✨ **NEW** - Syncs role/approved to JWT metadata |
| `2026-03-17_rls_verification_queries.sql` | ✨ **NEW** - Verification queries to test RLS |
| `RLS_IMPLEMENTATION_GUIDE.md` | ✨ **NEW** - Complete documentation |

---

## 🔑 Key Points

- **No more recursion** - Uses `auth.jwt()` to read role/approved
- **Automatic sync** - Triggers keep JWT metadata in sync with database
- **Secure by default** - Employees cannot access financial data even if they bypass frontend
- **Fast** - Uses cached JWT claims, no database queries during policy evaluation

---

## ❌ If You Still Get Errors

### Error: "infinite recursion" still appears
- Make sure you ran `2026-03-17_sync_auth_metadata.sql` BEFORE the RLS migration
- Drop and re-apply `2026-03-17_rls_all_tables.sql`

### Error: "permission denied"
- Check that metadata was synced: `SELECT raw_user_meta_data FROM auth.users LIMIT 1;`
- Should contain `role` and `approved` fields

### Error: "role field is NULL"
- Create a NEW test user (so the trigger fires)
- Or manually run metadata sync trigger

---

## 🎯 Expected Behavior After Fix

| User Type | Can Read | Cannot Read | Can Write |
|-----------|----------|------------|-----------|
| **Admin** | Everything | Nothing (has access) | Everything |
| **Employee (approved)** | clients, leads, shoots, locations, packages, portfolio, location_images | payments, expenses, payment_records | Nothing (read-only) |
| **Employee (pending)** | Nothing | Everything | Nothing (blocked until approved) |

---

## 📞 Need Help?

Check: `RLS_IMPLEMENTATION_GUIDE.md` - has full troubleshooting guide and detailed explanations.

All done! 🎉

