-- =============================================================================
-- Auto-confirm auth.users email when admin approves user in public.users
-- =============================================================================

-- Backfill existing approved users so they can login immediately
UPDATE auth.users au
SET
  email_confirmed_at = COALESCE(au.email_confirmed_at, NOW()),
  confirmed_at = COALESCE(au.confirmed_at, NOW())
FROM public.users pu
WHERE pu.id = au.id
  AND pu.approved = true
  AND au.email_confirmed_at IS NULL;

-- Trigger function: when public.users.approved flips to true, confirm auth email
CREATE OR REPLACE FUNCTION public.confirm_auth_email_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved = true AND COALESCE(OLD.approved, false) = false THEN
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmed_at = COALESCE(confirmed_at, NOW())
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_confirm_auth_email_on_approval ON public.users;

CREATE TRIGGER trg_confirm_auth_email_on_approval
AFTER UPDATE OF approved ON public.users
FOR EACH ROW
WHEN (NEW.approved = true AND COALESCE(OLD.approved, false) = false)
EXECUTE FUNCTION public.confirm_auth_email_on_approval();

