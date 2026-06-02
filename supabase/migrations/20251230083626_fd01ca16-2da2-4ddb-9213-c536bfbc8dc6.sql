-- Create table for saved niche analyses
CREATE TABLE public.niche_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  niche_keyword TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  verdict_type TEXT NOT NULL,
  verdict_title TEXT NOT NULL,
  verdict_description TEXT NOT NULL,
  demand_score INTEGER NOT NULL,
  competition_score INTEGER NOT NULL,
  profit_potential_score INTEGER NOT NULL,
  trend_direction TEXT NOT NULL,
  trend_seasonality TEXT NOT NULL,
  trend_viability TEXT NOT NULL,
  trend_data INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  trend_labels TEXT[] DEFAULT ARRAY[]::TEXT[],
  pain_points JSONB DEFAULT '[]'::JSONB,
  sources JSONB DEFAULT '[]'::JSONB,
  patterns JSONB DEFAULT '{}'::JSONB,
  opportunities JSONB DEFAULT '{}'::JSONB,
  strategy JSONB DEFAULT '{}'::JSONB,
  suggested_titles JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for competitor books with historical tracking
CREATE TABLE public.competitor_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.niche_analyses(id) ON DELETE CASCADE,
  asin TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  current_bsr INTEGER,
  current_price NUMERIC(10,2),
  current_reviews INTEGER,
  current_rating NUMERIC(3,2),
  pages INTEGER,
  format TEXT,
  publish_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for historical BSR/sales data (Helium 10 style)
CREATE TABLE public.competitor_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.competitor_books(id) ON DELETE CASCADE,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  bsr INTEGER,
  price NUMERIC(10,2),
  reviews INTEGER,
  estimated_sales INTEGER
);

-- Create table for niche comparisons
CREATE TABLE public.niche_comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  analysis_ids UUID[] NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.niche_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niche_comparisons ENABLE ROW LEVEL SECURITY;

-- Create public read/write policies (no auth required for MVP)
CREATE POLICY "Public read access for analyses" 
ON public.niche_analyses FOR SELECT USING (true);

CREATE POLICY "Public insert access for analyses" 
ON public.niche_analyses FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for analyses" 
ON public.niche_analyses FOR UPDATE USING (true);

CREATE POLICY "Public read access for books" 
ON public.competitor_books FOR SELECT USING (true);

CREATE POLICY "Public insert access for books" 
ON public.competitor_books FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read access for history" 
ON public.competitor_history FOR SELECT USING (true);

CREATE POLICY "Public insert access for history" 
ON public.competitor_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read access for comparisons" 
ON public.niche_comparisons FOR SELECT USING (true);

CREATE POLICY "Public insert access for comparisons" 
ON public.niche_comparisons FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for comparisons" 
ON public.niche_comparisons FOR UPDATE USING (true);

CREATE POLICY "Public delete access for comparisons" 
ON public.niche_comparisons FOR DELETE USING (true);

-- Create indexes for performance
CREATE INDEX idx_competitor_books_analysis ON public.competitor_books(analysis_id);
CREATE INDEX idx_competitor_history_book ON public.competitor_history(book_id);
CREATE INDEX idx_competitor_history_recorded ON public.competitor_history(recorded_at DESC);
CREATE INDEX idx_niche_analyses_keyword ON public.niche_analyses(niche_keyword);
CREATE INDEX idx_niche_analyses_created ON public.niche_analyses(created_at DESC);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_niche_analyses_updated_at
BEFORE UPDATE ON public.niche_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();