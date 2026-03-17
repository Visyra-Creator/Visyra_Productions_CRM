-- =============================================================================
-- ADD: get_email_by_username RPC function
-- Required for username-based login — unauthenticated callers cannot query
-- public.users directly due to RLS, so we need a SECURITY DEFINER function
-- that safely returns ONLY the email for a given username.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER                  -- bypasses RLS (read-only, returns email only)
SET search_path = public
AS $$
  SELECT email
  FROM   public.users
  WHERE  lower(username) = lower(p_username)   -- case-insensitive match
  LIMIT  1;
$$;

-- Revoke direct execute from public, grant only to anon + authenticated
-- so the function is callable from the client SDK without full table access.
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;

