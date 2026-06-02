-- Add delete policy for niche_analyses table
CREATE POLICY "Public delete access for analyses"
ON public.niche_analyses
FOR DELETE
USING (true);