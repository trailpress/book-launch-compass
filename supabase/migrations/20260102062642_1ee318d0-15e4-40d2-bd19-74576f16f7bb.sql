-- Add social_excerpts column to niche_analyses table to store extracted social content
ALTER TABLE public.niche_analyses 
ADD COLUMN IF NOT EXISTS social_excerpts JSONB DEFAULT '[]'::jsonb;