# Supabase Auth Integration Guide for Expo Router

This guide shows you how to integrate the signup/login flow into your Expo Router app.

## Step 1: Deploy Database Schema & RLS Policies

### 1.1 Open Supabase Dashboard
1. Go to [supabase.com](https://supabase.com)
2. Navigate to your Visyra CRM project
3. Go to **SQL Editor**

### 1.2 Execute RLS Policy Migration
Copy the entire contents of:
```
backend/migrations/2026-03-17_users_rls_policies.sql
```

Paste into Supabase SQL Editor and click **Run**

**Expected Output:**
```
SUCCESS - 7 policies created
SUCCESS - trigger on_auth_user_created created
```

### 1.3 Verify Deployment
Run these queries to confirm:

```sql
-- Check RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'users';
-- Should return: users | t (true)

-- Check policies exist
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'users';
-- Should return 7 rows (policies)

-- Check trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
-- Should return 1 row
```

---

## Step 2: Add Files to Frontend

### 2.1 Copy Auth Service
Create: `frontend/src/api/services/auth.ts`

Use the complete service from:
```
frontend/src/api/services/auth.ts
```

### 2.2 Copy Auth Hook
Create: `frontend/src/hooks/useAuth.ts`

Use the complete hook from:
```
frontend/src/hooks/useAuth.ts
```

### 2.3 Copy UI Screens
Create:
- `frontend/src/screens/auth/SignupScreen.tsx`
- `frontend/src/screens/auth/LoginScreen.tsx`

---

## Step 3: Setup Expo Router

### 3.1 Create Auth Routes

Update or create `frontend/app/_layout.tsx`:

```typescript
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        // Auth Stack
        <Stack.Screen 
          name="auth" 
          options={{ animationEnabled: false }}
        />
      ) : (
        // App Stack
        <Stack.Screen 
          name="(tabs)" 
          options={{ animationEnabled: false }}
        />
      )}
    </Stack>
  );
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Loading...</Text>
    </View>
  );
}
```

### 3.2 Create Auth Folder Structure

```
frontend/app/
├── auth/
│   ├── _layout.tsx          (NEW)
│   ├── index.tsx            (NEW - Redirect to login)
│   ├── login.tsx            (NEW)
│   └── signup.tsx           (NEW)
├── (tabs)/
│   └── ... (existing)
└── _layout.tsx              (updated)
```

### 3.3 Create Auth Layout

Create `frontend/app/auth/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
```

### 3.4 Create Auth Index (Redirect)

Create `frontend/app/auth/index.tsx`:

```typescript
import { Redirect } from 'expo-router';

export default function AuthIndex() {
  return <Redirect href="/auth/login" />;
}
```

### 3.5 Create Login Route

Create `frontend/app/auth/login.tsx`:

```typescript
import LoginScreen from '@/screens/auth/LoginScreen';

export default function LoginPage() {
  return <LoginScreen />;
}
```

### 3.6 Create Signup Route

Create `frontend/app/auth/signup.tsx`:

```typescript
import SignupScreen from '@/screens/auth/SignupScreen';

export default function SignupPage() {
  return <SignupScreen />;
}
```

---

## Step 4: Environment Variables

Make sure your `.env` file has:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

To find these values:
1. Go to Supabase Dashboard
2. Project Settings → API
3. Copy the values for Project URL and anon key

---

## Step 5: Update Main App Layout

Update `frontend/app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function TabsLayout() {
  const { logout, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Tabs
      screenOptions={{
        headerRight: () => (
          <TouchableOpacity onPress={logout} style={{ marginRight: 15 }}>
            <Text style={{ color: '#007AFF' }}>Logout</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      {/* Other tabs... */}
    </Tabs>
  );
}
```

---

## Step 6: Install Dependencies (if needed)

Your `package.json` should already have:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x.x",
    "expo": "^51.x.x",
    "expo-router": "^3.x.x",
    "react-native": "^0.74.x"
  }
}
```

If `@supabase/supabase-js` is missing:

```bash
npm install @supabase/supabase-js
# or
yarn add @supabase/supabase-js
# or
expo install @supabase/supabase-js
```

---

## Step 7: Test the Flow

### 7.1 Test Signup
```bash
npm start
# or
expo start
```

1. Click "Sign Up"
2. Fill in all fields
3. Click "Create Account"
4. Should see "Account pending admin approval" message
5. Redirected to login screen

### 7.2 Test Failed Login (Not Approved)
1. Click "Log In"
2. Enter the email you just signed up with
3. Enter the password
4. Should get error: "Your account has not been approved yet"

### 7.3 Approve User
In Supabase SQL Editor:

```sql
UPDATE public.users 
SET approved = true 
WHERE email = 'john@example.com';
```

### 7.4 Test Successful Login
1. Go back to login screen
2. Enter email and password again
3. Should log in successfully
4. Redirected to main app

### 7.5 Test Logout
1. Click logout button
2. Redirected to login screen

---

## Step 8: Customize UI (Optional)

### 8.1 Change Colors

In `SignupScreen.tsx` and `LoginScreen.tsx`, update Tailwind classes:

```typescript
// Change button color
<TouchableOpacity className="bg-blue-600">
  // Change to your color:
  // bg-green-600, bg-red-600, bg-purple-600, etc.
</TouchableOpacity>
```

### 8.2 Add Logo

```typescript
import { Image } from 'react-native';

<Image
  source={require('@/assets/images/logo.png')}
  style={{ width: 100, height: 100, marginBottom: 20 }}
/>
```

### 8.3 Add Terms of Service

Add before signup button:

```typescript
<View className="mb-4">
  <Text className="text-gray-600 text-xs text-center">
    By signing up, you agree to our{' '}
    <Text className="text-blue-600 font-semibold">Terms of Service</Text>
    {' '}and{' '}
    <Text className="text-blue-600 font-semibold">Privacy Policy</Text>
  </Text>
</View>
```

---

## Step 9: Admin Approval Dashboard (Optional Next Step)

Create admin panel to approve users:

Create `frontend/app/(tabs)/admin.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function AdminScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadUnapprovedUsers();
  }, []);

  const loadUnapprovedUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('approved', false)
      .order('created_at', { ascending: false });
    
    setUsers(data || []);
  };

  const approveUser = async (userId: string) => {
    const { error } = await supabase
      .from('users')
      .update({ approved: true })
      .eq('id', userId);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'User approved!');
      loadUnapprovedUsers();
    }
  };

  if (user?.role !== 'admin') {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Access Denied</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-4 bg-white">
      <Text className="text-2xl font-bold mb-4">
        Unapproved Users ({users.length})
      </Text>
      
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="border border-gray-200 rounded-lg p-4 mb-2">
            <Text className="font-bold">{item.name}</Text>
            <Text className="text-gray-600">{item.email}</Text>
            
            <TouchableOpacity
              onPress={() => approveUser(item.id)}
              className="bg-green-600 rounded-lg py-2 mt-3"
            >
              <Text className="text-white text-center font-semibold">
                Approve
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}
```

---

## Troubleshooting

### Issue: "AuthSessionMissing" Error
**Solution:**
- Make sure Supabase environment variables are correct
- Restart the app with `npm start`

### Issue: User Creates Auth Account But No DB Record
**Solution:**
1. Check if trigger exists:
```sql
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
```
2. If not, rerun the SQL migration
3. Check RLS policies aren't blocking inserts

### Issue: User Can't Login Even After Approval
**Solution:**
```sql
-- Verify approved status
SELECT id, email, approved FROM public.users 
WHERE email = 'test@example.com';

-- Manually fix if needed
UPDATE public.users SET approved = true 
WHERE email = 'test@example.com';
```

### Issue: RLS Policies Blocking Queries
**Solution:**
Check the specific policy error in Supabase logs:
1. Go to Supabase Dashboard
2. API → Logs
3. Look for policy violations
4. Adjust policy conditions

### Issue: "User not found" During Login
**Solution:**
```sql
-- Check if user record exists
SELECT * FROM public.users WHERE email = 'test@example.com';

-- If not, create it manually
INSERT INTO public.users (id, email, name, username, phone, role, approved)
VALUES ('[auth_id]', 'test@example.com', 'Test User', 'testuser', '555-0123', 'employee', false);
```

---

## File Checklist

- [x] `backend/migrations/2026-03-17_users_rls_policies.sql` - Database schema
- [x] `frontend/src/api/services/auth.ts` - Auth service
- [x] `frontend/src/hooks/useAuth.ts` - React hook
- [x] `frontend/src/screens/auth/SignupScreen.tsx` - Signup UI
- [x] `frontend/src/screens/auth/LoginScreen.tsx` - Login UI
- [ ] `frontend/app/auth/_layout.tsx` - Auth routes layout
- [ ] `frontend/app/auth/index.tsx` - Auth redirect
- [ ] `frontend/app/auth/login.tsx` - Login route
- [ ] `frontend/app/auth/signup.tsx` - Signup route
- [ ] `frontend/app/_layout.tsx` - Update root layout
- [ ] `frontend/.env` - Environment variables

---

## Success Indicators

✅ User can sign up
✅ New user has `role='employee'` and `approved=false`
✅ User auto-logs out after signup
✅ Unapproved user gets error on login
✅ Admin can approve user
✅ Approved user can log in
✅ User can logout
✅ RLS policies prevent unauthorized access

---

## Next: Admin Approval System

Once users can sign up and login:

1. Create admin approval dashboard (see Step 9)
2. Add email notifications for approvals
3. Add email verification step (optional)
4. Implement password reset (optional)
5. Add 2FA (optional)

---

## Support & Debugging

**Common Commands:**

```bash
# Run app in development
npm start

# Run on iOS simulator
npm start -- --ios

# Run on Android emulator
npm start -- --android

# Check environment variables
echo $EXPO_PUBLIC_SUPABASE_URL
echo $EXPO_PUBLIC_SUPABASE_ANON_KEY

# View Supabase logs
# Dashboard → Logs → Auth, Database, API
```

**Helpful Resources:**
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Expo Router Docs](https://docs.expo.dev/routing/introduction/)
- [React Native Docs](https://reactnative.dev/)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

