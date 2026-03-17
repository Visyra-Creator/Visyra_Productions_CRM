# Signup/Auth Quick Reference

## Files Created

### 1. RLS Policies & Database Trigger
**Path:** `backend/migrations/2026-03-17_users_rls_policies.sql`

**Deploy with:** Supabase SQL Editor

**Key Features:**
- ✅ RLS enabled on users table
- ✅ 7 security policies (READ, UPDATE, INSERT, DELETE)
- ✅ Auto-trigger for signup defaults
- ✅ Admin approval gate

---

### 2. Auth Service (Core Logic)
**Path:** `frontend/src/api/services/auth.ts`

**Functions:**
- `signup(payload)` - Register new user
- `login(payload)` - Authenticate user (with approval check)
- `logout()` - Sign out user
- `getCurrentUser()` - Fetch user data
- `updateProfile(userId, payload)` - Update profile fields
- `isAuthenticated()` - Check login status
- `onAuthStateChange(callback)` - Subscribe to auth changes

**Usage:**
```typescript
import { signup, login } from '@/api/services/auth';

const result = await signup({
  name: 'John Doe',
  username: 'johndoe',
  email: 'john@example.com',
  phone: '+1-555-0123',
  password: 'SecurePassword123'
});

if (result.error) {
  console.error(result.error);
} else {
  console.log('Signup successful!');
}
```

---

### 3. Auth React Hook
**Path:** `frontend/src/hooks/useAuth.ts`

**State & Methods:**
- `user` - Current authenticated user
- `isLoading` - Loading state
- `isAuthenticated` - Login status
- `signup(payload)` - Register
- `login(payload)` - Login
- `logout()` - Logout
- `error` - Error message

**Usage:**
```typescript
import { useAuth } from '@/hooks/useAuth';

export default function MyComponent() {
  const { user, signup, login, error } = useAuth();

  const handleSignup = async () => {
    const result = await signup({...});
    if (!result.error) {
      // Show pending approval message
    }
  };

  return (
    // Component JSX
  );
}
```

---

### 4. Signup Screen
**Path:** `frontend/src/screens/auth/SignupScreen.tsx`

**Features:**
- ✅ Form validation
- ✅ Real-time error display
- ✅ Loading state
- ✅ Pending approval message
- ✅ Link to login screen

**Fields:**
- Name
- Username
- Email
- Phone
- Password
- Confirm Password

---

### 5. Login Screen
**Path:** `frontend/src/screens/auth/LoginScreen.tsx`

**Features:**
- ✅ Email & password validation
- ✅ Approval status check
- ✅ Error messaging for unapproved accounts
- ✅ Loading state
- ✅ Link to signup screen

---

## Quick Workflow

### User Signup
```
1. User fills signup form
   ↓
2. Frontend calls signup()
   ↓
3. Create user in auth.users
   ↓
4. Trigger creates user in public.users
   (role='employee', approved=false)
   ↓
5. Auto-logout user
   ↓
6. Show "Pending Approval" message
   ↓
7. Admin approves (approved=true)
   ↓
8. User can now login
```

### User Login
```
1. User enters email & password
   ↓
2. Frontend calls login()
   ↓
3. Verify credentials in auth.users
   ↓
4. Check approved status in public.users
   ↓
5. If approved=true → Login success → Navigate to app
   If approved=false → Show error → Stay on login screen
```

---

## Signup Form Validation

```typescript
// Required Fields
- name: string (required)
- username: string (required, min 3 chars)
- email: string (required, valid email)
- phone: string (required, valid phone)
- password: string (required, min 6 chars)
- confirmPassword: string (required, must match password)
```

---

## Security Policies Summary

### READ
- ✅ Admins read all users
- ✅ Employees read own record

### UPDATE
- ✅ Admins update approved field
- ✅ Users update own profile (name, username, phone only)
- ❌ Users cannot change role or approved

### INSERT
- ✅ Admins create users
- ✅ System creates employees via signup

### DELETE
- ✅ Admins delete users

---

## Environment Variables

Make sure you have in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Error Messages

### Signup
- "Email already in use"
- "Password must be at least 6 characters"
- "Username is required"
- "Please enter a valid phone number"
- User creation fails → "Failed to create auth user"

### Login
- "Invalid email or password"
- "Your account has not been approved yet. Please contact your administrator."
- User lookup fails → "Failed to fetch user information"

---

## Admin Approval (Manual SQL)

```sql
-- Approve a user
UPDATE public.users
SET approved = true
WHERE id = '[user_id]';

-- View unapproved users
SELECT id, email, name, created_at
FROM public.users
WHERE approved = false
ORDER BY created_at DESC;

-- Reject a user (delete)
DELETE FROM public.users WHERE id = '[user_id]';
```

---

## Testing Checklist

### Signup
- [ ] Form validation works
- [ ] User can submit valid form
- [ ] User auto-logs out after signup
- [ ] Pending approval message shown
- [ ] Invalid email rejected
- [ ] Weak password rejected
- [ ] Password mismatch detected
- [ ] Database record created with defaults

### Login
- [ ] User with approved=false gets error
- [ ] User with approved=true logs in successfully
- [ ] Invalid credentials show error
- [ ] User navigates to app after login
- [ ] Logout works

### Security
- [ ] RLS policies deployed
- [ ] Employees can't read other users' data
- [ ] Employees can't update role/approved
- [ ] Admins can update approved field
- [ ] Non-admins can't create users directly

---

## Hooks Integration

Add to your main layout or auth context:

```typescript
import { useAuth } from '@/hooks/useAuth';

export default function RootLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    // Show login/signup if not authenticated
    // Show main app if authenticated
  );
}
```

---

## Next Steps

1. Deploy SQL migration to Supabase
2. Copy auth service file to frontend
3. Copy useAuth hook to frontend
4. Integrate screens in Expo Router
5. Connect to your navigation flow
6. Test complete signup → approval → login flow
7. Implement admin approval dashboard (separate work)

---

## Support

For issues:
1. Check database trigger exists: `SELECT * FROM information_schema.triggers`
2. Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'users'`
3. Check user record created: `SELECT * FROM public.users WHERE id = '[auth_id]'`
4. Review auth logs in Supabase dashboard

