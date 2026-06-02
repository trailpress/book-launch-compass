-- SECURITY FIX: Restrict rate_limits table to service role only
-- This prevents public access to IP addresses stored in rate limits

-- Drop the existing public policy that allows all operations
DROP POLICY IF EXISTS "Edge function can manage rate limits" ON public.rate_limits;

-- Create a new policy that only allows service role access
-- The service role is used by edge functions with SUPABASE_SERVICE_ROLE_KEY
CREATE POLICY "Service role manages rate limits"
  ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Explicitly deny anonymous access (belt and suspenders)
-- This ensures even if the above policy is somehow bypassed, anon role has no access
CREATE POLICY "Deny anon access to rate limits"
  ON public.rate_limits
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Also deny authenticated users who are not service role
CREATE POLICY "Deny authenticated access to rate limits"
  ON public.rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Revoke function execution from public to prevent cleanup_old_rate_limits abuse
REVOKE ALL ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_rate_limits() FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;