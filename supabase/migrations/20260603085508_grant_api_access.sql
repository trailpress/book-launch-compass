GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE
  public.niche_analyses,
  public.competitor_books,
  public.competitor_history,
  public.niche_comparisons
TO anon, authenticated;

GRANT ALL
ON TABLE
  public.niche_analyses,
  public.competitor_books,
  public.competitor_history,
  public.niche_comparisons,
  public.rate_limits
TO service_role;
