-- =====================================================================
-- MIGRACIÓN AUTH-02: RESOLVER EMAIL DE LOGIN
-- ArbitraX Pro - Supabase Auth Integration
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rpc_resolve_login_email(
    p_identifier text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT email
    FROM public.users
    WHERE
        lower(email) = lower(trim(p_identifier))
        OR lower(username) = lower(trim(p_identifier))
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.rpc_resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_resolve_login_email(text) TO anon, authenticated;
