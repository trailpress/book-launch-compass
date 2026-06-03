CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  niche_keyword TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  analysis_id UUID REFERENCES public.niche_analyses(id) ON DELETE SET NULL,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for analysis jobs"
ON public.analysis_jobs
FOR SELECT
USING (true);

CREATE POLICY "Service role manages analysis jobs"
ON public.analysis_jobs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON TABLE public.analysis_jobs TO anon, authenticated;
GRANT ALL ON TABLE public.analysis_jobs TO service_role;

CREATE TRIGGER update_analysis_jobs_updated_at
BEFORE UPDATE ON public.analysis_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
