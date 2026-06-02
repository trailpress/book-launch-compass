-- Add clustered pain points column to niche_analyses
ALTER TABLE public.niche_analyses
ADD COLUMN IF NOT EXISTS clustered_pain_points jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.niche_analyses.clustered_pain_points IS 'Clustered pain points from Amazon reviews, Reddit, Quora with percentages and patterns';