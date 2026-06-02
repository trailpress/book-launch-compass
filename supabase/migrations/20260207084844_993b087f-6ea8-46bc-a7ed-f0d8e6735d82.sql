
-- Add search volume data to niche_analyses
ALTER TABLE public.niche_analyses
ADD COLUMN search_volume integer DEFAULT NULL,
ADD COLUMN search_volume_score integer DEFAULT NULL,
ADD COLUMN search_volume_source text DEFAULT NULL;
