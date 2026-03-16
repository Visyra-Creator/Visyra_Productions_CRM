-- Migration: Row Level Security Policies for Users Table
-- Date: 2026-03-17
-- ⚠️  SUPERSEDED by: 2026-03-17_users_auth_audit_fix.sql
--     DO NOT run this file. Run the audit fix migration instead.
--     Issues found in this file:
--       - users table never created
--       - system_create_employees policy had no auth.uid() = id check (security hole)
--       - admin role checks caused RLS recursion
--       - trigger did not read name/username/phone from metadata
-- Description: Implements RLS policies for role-based access control

-- Enable Row Level Security (RLS) on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- READ POLICIES
-- ============================================================================

-- Policy 1: Admins can read all users
CREATE POLICY "admins_read_all_users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy 2: Employees can only read their own record
CREATE POLICY "employees_read_own_record"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- Policy 3: Only admins can update the approved field
CREATE POLICY "admins_update_approved_field"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy 4: Users can update their own profile (name, phone, email only - not role or approved)
CREATE POLICY "users_update_own_profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Ensure user cannot modify role or approved status
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND approved = (SELECT approved FROM public.users WHERE id = auth.uid())
  );

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- Policy 5: Only admins can insert new users directly
CREATE POLICY "admins_create_users"
  ON public.users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy 6: New users from signup (via Supabase trigger/function)
-- This allows the system to create users with default role='employee' and approved=false
-- Note: This should be executed via a trigger or auth webhook
CREATE POLICY "system_create_employees"
  ON public.users
  FOR INSERT
  WITH CHECK (
    -- Allow creation if role is 'employee' and approved is false (signup defaults)
    role = 'employee'
    AND approved = false
    -- Can be further restricted by requiring auth.uid() = id if needed
  );

-- ============================================================================
-- DELETE POLICIES
-- ============================================================================

-- Policy 7: Only admins can delete users
CREATE POLICY "admins_delete_users"
  ON public.users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- TRIGGER FOR SIGNUP DEFAULTS
-- ============================================================================

-- Create function to set default values for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, email, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.email,
    'employee',      -- Default role for new signups
    false             -- Default: not approved until admin approval
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create user record when new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

