# Supabase Authentication & Signup Setup for Visyra CRM

## Overview

This document describes the complete authentication flow for the Visyra CRM mobile app, including signup, login, and admin approval workflow.

## Architecture

### Components

1. **RLS Policies** (`2026-03-17_users_rls_policies.sql`)
   - Enable row-level security on the users table
   - Define role-based access control
   - Implement signup trigger with default values

2. **Auth Service** (`src/api/services/auth.ts`)
   - Core authentication functions
   - User registration and login logic
   - Profile management
   - Auth state management

3. **Auth Hook** (`src/hooks/useAuth.ts`)
   - React hook wrapper for auth service
   - State management for user, loading, and errors
   - Easy integration with components

4. **UI Screens**
   - `SignupScreen.tsx` - User registration form
   - `LoginScreen.tsx` - User login form

## Signup Flow

### Step 1: User Registration

**User Input:**
```json
{
  "name": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "phone": "+1-555-0123",
  "password": "SecurePassword123"
}
```

### Step 2: Auth User Creation

```typescript
supabase.auth.signUp({
  email: payload.email,
  password: payload.password,
  options: {
    data: { name, username, phone }
  }
})
```

**Result:**
- User created in Supabase Auth (`auth.users`)
- Auth UID assigned

### Step 3: Database Record Creation

Two methods (one is redundant but provides safety):

**Method A (Automatic via Trigger):**
The `handle_new_user()` trigger automatically creates a record in `public.users`:

```sql
INSERT INTO public.users (id, username, email, role, approved)
VALUES (
  auth_user.id,
  auth_user.email,
  auth_user.email,
  'employee',    -- Default role
  false          -- Not approved yet
)
```

**Method B (Backup Manual Insert):**
If the trigger doesn't fire, the signup function manually inserts the record.

### Step 4: Default Values

New users are created with:
```json
{
  "role": "employee",
  "approved": false
}
```

### Step 5: Auto-Logout

After successful signup, the user is automatically logged out:

```typescript
await supabase.auth.signOut();
```

This prevents access until the admin approves the account.

### Step 6: Pending Approval Message

User sees:
> "Your account has been created! Your account is pending admin approval. You will receive a notification once it is approved."

## Login Flow

### Step 1: Credentials

```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

### Step 2: Authentication

```typescript
supabase.auth.signInWithPassword({ email, password })
```

### Step 3: Approval Check

Query the `public.users` table for the user's `approved` status:

```sql
SELECT approved FROM public.users WHERE id = auth.uid()
```

### Step 4: Access Control

- **If `approved = true`**: User is logged in and can access the app
- **If `approved = false`**: User is signed out with error message:
  > "Your account has not been approved yet. Please contact your administrator."

## RLS Policies

### Read Policies

#### Policy 1: Admins Can Read All Users
```sql
CREATE POLICY "admins_read_all_users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Policy 2: Employees Can Read Own Record
```sql
CREATE POLICY "employees_read_own_record"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);
```

### Update Policies

#### Policy 3: Only Admins Can Update Approved Field
```sql
CREATE POLICY "admins_update_approved_field"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Policy 4: Users Can Update Own Profile (Protected Fields)
```sql
CREATE POLICY "users_update_own_profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND approved = (SELECT approved FROM public.users WHERE id = auth.uid())
  );
```

**Protected fields that cannot be modified:**
- `role` - Can only be changed by admins
- `approved` - Can only be changed by admins

**Allowed editable fields:**
- `name`
- `username`
- `phone`

### Insert Policies

#### Policy 5: Admins Can Create Users
```sql
CREATE POLICY "admins_create_users"
  ON public.users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Policy 6: System Can Create New Employees
```sql
CREATE POLICY "system_create_employees"
  ON public.users
  FOR INSERT
  WITH CHECK (
    role = 'employee' AND approved = false
  );
```

This allows the signup trigger to create new employee records with default values.

### Delete Policies

#### Policy 7: Only Admins Can Delete Users
```sql
CREATE POLICY "admins_delete_users"
  ON public.users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## Admin Approval Workflow

### As Admin

1. Go to Admin Dashboard
2. View list of unapproved users
3. Review user details
4. Click "Approve" button
5. User record updated: `approved = true`

### SQL Command (for manual approval)

```sql
UPDATE public.users
SET approved = true
WHERE id = '[user_id]'
AND role = 'employee';
```

### As User (After Approval)

1. User receives notification (if notification system is implemented)
2. User attempts login again
3. `approved` check passes
4. User granted access to the app

## Error Handling

### Signup Errors

| Error | Cause | User Message |
|-------|-------|--------------|
| `AuthSessionMissing` | Auth user not created | "Failed to create auth user" |
| `ValidationError` | Invalid input | Field-specific validation message |
| `Duplicate key error (23505)` | User already exists | User data fetched and returned |
| `DatabaseError` | Insert failed | "Failed to insert user record" |

### Login Errors

| Error | Cause | User Message |
|-------|-------|--------------|
| `InvalidLoginCredentials` | Wrong email/password | "Invalid email or password" |
| `UserNotFound` | User doesn't exist | "Invalid email or password" |
| `AccountNotApproved` | Approved = false | "Your account has not been approved yet..." |
| `DatabaseError` | User lookup failed | "Failed to fetch user information" |

## Usage Examples

### Using the Auth Service Directly

```typescript
import { signup } from '@/api/services/auth';

const handleSignup = async () => {
  const result = await signup({
    name: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
    phone: '+1-555-0123',
    password: 'SecurePassword123',
  });

  if (result.error) {
    console.error('Signup failed:', result.error);
  } else {
    console.log('Signup successful:', result.user);
  }
};
```

### Using the useAuth Hook

```typescript
import { useAuth } from '@/hooks/useAuth';

export default function MyComponent() {
  const { user, isLoading, error, signup, login, logout } = useAuth();

  const handleSignup = async () => {
    const result = await signup({
      name: 'John Doe',
      username: 'johndoe',
      email: 'john@example.com',
      phone: '+1-555-0123',
      password: 'SecurePassword123',
    });

    if (!result.error) {
      // Navigate to approval pending screen
    }
  };

  const handleLogin = async () => {
    const result = await login({
      email: 'john@example.com',
      password: 'SecurePassword123',
    });

    if (!result.error && result.user?.approved) {
      // Navigate to main app
    }
  };

  return (
    // Your JSX here
  );
}
```

### Protecting Routes

In your Expo Router configuration (`app/_layout.tsx`):

```typescript
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export default function RootLayout() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      // Navigate to login
    }
  }, [isAuthenticated]);

  return (
    // Your layout here
  );
}
```

## Database Trigger

The `handle_new_user()` function and `on_auth_user_created` trigger:

1. **Trigger:** Fires after a new user is inserted into `auth.users`
2. **Function:** Creates a corresponding record in `public.users`
3. **Defaults:** Sets `role='employee'` and `approved=false`
4. **Conflict:** Handled with `ON CONFLICT (id) DO NOTHING`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, email, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.email,
    'employee',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## Security Considerations

### ✅ Implemented

1. **Row Level Security (RLS)** - All policies enabled on users table
2. **Role-Based Access Control** - Admin vs Employee permissions
3. **Password Hashing** - Handled by Supabase Auth
4. **Field Protection** - Users cannot modify `role` or `approved`
5. **Approval Gate** - Login blocked until admin approval
6. **Auth State** - JWT tokens managed by Supabase

### ⚠️ To Implement (Outside this scope)

1. **Email Verification** - Optional: Require email confirmation
2. **Password Reset** - Email-based password recovery
3. **Rate Limiting** - Prevent brute force login attempts
4. **Audit Logging** - Track all auth events
5. **2FA/MFA** - Two-factor authentication
6. **Session Management** - Timeout inactive sessions
7. **Device Trust** - Remember trusted devices

## Troubleshooting

### User Signup Succeeds But User Records Not Created

**Possible Causes:**
1. Trigger not deployed
2. RLS policy blocking trigger inserts
3. Default values issue

**Solution:**
```sql
-- Check if trigger exists
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check trigger SQL
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';

-- Manually create user if trigger fails
INSERT INTO public.users (id, username, email, role, approved)
VALUES ('[auth_id]', '[email]', '[email]', 'employee', false);
```

### Login Fails for Newly Approved Users

**Possible Causes:**
1. Session token still cached
2. Token expiration
3. RLS policy not recognizing admin

**Solution:**
1. User should restart the app
2. Force token refresh:
   ```typescript
   await supabase.auth.refreshSession();
   ```

### Admin Cannot Update Approved Field

**Possible Causes:**
1. Admin user record doesn't have `role='admin'`
2. RLS policy too restrictive
3. Permission denied by database

**Solution:**
```sql
-- Verify admin user
SELECT id, role FROM public.users WHERE id = '[admin_id]';

-- Update if needed
UPDATE public.users SET role = 'admin' WHERE id = '[admin_id]';
```

## File Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── supabase.ts (existing)
│   │   └── services/
│   │       ├── auth.ts (NEW - Core auth functions)
│   │       └── ... (existing services)
│   ├── hooks/
│   │   └── useAuth.ts (NEW - React hook)
│   └── screens/
│       └── auth/
│           ├── SignupScreen.tsx (NEW)
│           └── LoginScreen.tsx (NEW)
└── ...

backend/
└── migrations/
    ├── 2026-03-17_users_rls_policies.sql (NEW - RLS policies & trigger)
    └── ... (existing migrations)
```

## Next Steps

1. ✅ Deploy RLS policies SQL migration
2. ✅ Copy auth service files to frontend
3. ✅ Integrate screens in Expo Router
4. ✅ Test signup flow
5. ✅ Test login flow
6. ⬜ Implement admin approval interface
7. ⬜ Add email notifications for approvals
8. ⬜ Implement password reset
9. ⬜ Add user avatar/profile images
10. ⬜ Implement 2FA (optional)

## API Reference

### Auth Service Functions

#### `signup(payload: SignupPayload): Promise<SignupResponse>`

Creates a new user account.

**Parameters:**
```typescript
interface SignupPayload {
  email: string;
  password: string;
  name: string;
  username: string;
  phone: string;
}
```

**Returns:**
```typescript
interface SignupResponse {
  user: AuthUser | null;
  error: string | null;
}
```

---

#### `login(payload: LoginPayload): Promise<SignupResponse>`

Authenticates a user and checks approval status.

**Parameters:**
```typescript
interface LoginPayload {
  email: string;
  password: string;
}
```

**Returns:**
```typescript
interface SignupResponse {
  user: AuthUser | null;
  error: string | null;
}
```

---

#### `logout(): Promise<{ error: string | null }>`

Signs out the current user.

---

#### `getCurrentUser(): Promise<AuthUser | null>`

Fetches the current authenticated user's data.

---

#### `updateProfile(userId: string, payload: Partial<{ name, username, phone }>): Promise<...>`

Updates user profile (protected fields cannot be modified).

---

#### `isAuthenticated(): Promise<boolean>`

Checks if a user is currently logged in.

---

#### `onAuthStateChange(callback): () => void`

Subscribes to auth state changes (login/logout).

Returns an unsubscribe function.

