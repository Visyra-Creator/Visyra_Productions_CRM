# 🔄 Shared Team Access - Implementation Guide

## Overview
Changed from **user-scoped isolation** to **shared team access**. 

**What this means:**
- When admin adds a lead/client/shoot → ALL approved users see it immediately
- All approved users can view, edit, and delete any record
- Only approval status matters, NOT user_id ownership

---

## 📋 Implementation Checklist

### Step 1: Apply Backend Migration
**File:** `2026-03-18_shared_approved_team_access_rls.sql`

1. Open Supabase Dashboard → SQL Editor
2. Copy the entire content from the migration file
3. Execute it
4. Verify success (should see "Query successful")

**What it does:**
- Drops all existing policies on business tables
- Creates new policies: `is_approved_user()` check only (NO user_id filtering)
- Applies to: clients, leads, shoots, payments, payment_records, expenses, packages, portfolio, locations, location_images

### Step 2: Rebuild Frontend
```bash
cd frontend
npm run build
# or
yarn build
```

---

## 🔑 Key Changes Made

### Frontend Services Updated
All services now:
- ✅ Remove `user_id` filter from `getAll()` queries
- ✅ Remove `user_id` filter from realtime subscriptions
- ✅ Trust backend RLS to handle access control

**Files changed:**
- `src/api/services/leads.ts`
- `src/api/services/clients.ts`
- `src/api/services/shoots.ts`
- `src/api/services/payments.ts`
- `src/api/services/expenses.ts`
- `src/api/services/paymentRecords.ts`
- `src/api/services/portfolio.ts`

### Backend RLS Model
- **OLD:** `user_id = auth.uid()` (user-scoped isolation)
- **NEW:** `is_approved_user()` (approval-based shared access)

---

## ✨ Expected Behavior

### Before Migration (User-Scoped)
```
Admin Dashboard:
- Client ID: 5
- Lead ID: 10

User Dashboard:
- Client ID: 5  ❌ (Different from admin - can't see admin's data)
- Lead ID: 10
```

### After Migration (Shared Team)
```
Admin Dashboard:
- Client ID: 5
- Lead ID: 10

User Dashboard:
- Client ID: 5  ✅ (Same as admin - can see all data)
- Lead ID: 10   ✅ (Same as admin - can see all data)
```

---

## 🧪 Testing

### Test Case 1: Admin Creates Data
1. Login as admin
2. Create a new client/lead
3. Switch to user account (different device/browser)
4. Check dashboard - new record should appear immediately

### Test Case 2: User Updates Data
1. Login as user
2. Update a client/lead
3. Switch to admin account
4. Check - update should be visible immediately

### Test Case 3: User Adds Data
1. Login as user
2. Create a new client
3. Switch to admin account
4. Check - new client should appear

---

## 🚨 Important Notes

1. **Approval Status Required**
   - Both admin and user must have `approved = true` in users table
   - Unapproved users will see NO data

2. **Realtime Sync**
   - Changes are reflected instantly across all devices
   - Both users see the same data immediately

3. **No User Filtering**
   - Records are NOT tied to a specific user anymore
   - All approved users access the same pool of data

---

## 📊 Migration File Details

**Location:** `backend/migrations/2026-03-18_shared_approved_team_access_rls.sql`

**Size:** ~400 lines (comprehensive policy setup for all tables)

**Idempotent:** Yes (safe to run multiple times)

**Rollback:** To go back, apply the previous RLS migration if needed

---

## ✅ Verification

After migration, run these checks in Supabase SQL Editor:

```sql
-- Check that new policies exist
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('clients', 'leads', 'shoots')
ORDER BY tablename;

-- Should see policies like: clients_approved_select, leads_approved_insert, etc.
```

---

## Next Steps

1. ✅ Apply the migration to Supabase
2. ✅ Rebuild frontend
3. ✅ Test with multiple user accounts
4. ✅ Verify realtime sync works

---

**Questions?** Check the RLS migration file for detailed policy definitions.

