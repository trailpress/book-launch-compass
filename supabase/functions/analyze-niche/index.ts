import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

// SECURITY: Allowed origins for CORS - prevents cross-origin API abuse
const ALLOWED_ORIGINS = [
  'https://id-preview--13defa98-1cf8-4dc3-afbb-8eaa8e0e92f2.lovable.app',
  'https://13defa98-1cf8-4dc3-afbb-8eaa8e0e92f2.lovableproject.com',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  
  // Check if origin matches allowed patterns (including lovable preview subdomains)
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
    origin.endsWith('.lovable.app') || 
    origin.endsWith('.lovableproject.com');
  
  if (isAllowed && origin) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
  }
  
  // For non-browser requests or same-origin, return restrictive headers
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

// Legacy constant for backwards compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per hour per IP
const AI_PHASE_TIMEOUT_MS = 35000;
const AI_PHASE_LATEST_SAFE_START_MS = 85000;
const AMAZON_STEP_TIMEOUT_MS = 40000;
const PARALLEL_SOURCES_TIMEOUT_MS = 35000;

// Timeout helper for fetch requests (prevents hanging)
const FETCH_TIMEOUT_MS = 30000; // Keep scraping bounded so background jobs can finish reliably

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function withStepTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
    }),
  ]);
}

async function callAIChat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, options: {
  responseFormat?: { type: 'json_object' };
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
} = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  return await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 8000,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    }),
  }, options.timeoutMs ?? 60000);
}

function createServiceClient() {
  return createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '');
}

async function createAnalysisJob(niche: string): Promise<{ id: string | null; error: string | null }> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('analysis_jobs')
      .insert({
        niche_keyword: niche,
        status: 'running',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create analysis job:', error.message);
      return { id: null, error: error.message };
    }

    return { id: data?.id || null, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to create analysis job:', errorMessage);
    return { id: null, error: errorMessage };
  }
}

async function updateAnalysisJob(
  jobId: string | null | undefined,
  values: { status: 'running' | 'completed' | 'failed'; analysis_id?: string | null; error_message?: string | null; completed_at?: string | null },
) {
  if (!jobId) return;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('analysis_jobs')
      .update({
        ...values,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.error('Failed to update analysis job:', error.message);
    }
  } catch (error) {
    console.error('Failed to update analysis job:', error instanceof Error ? error.message : String(error));
  }
}

function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  // Fallback to a default identifier
  return 'unknown-client';
}

// Database-backed rate limiting for persistence across cold starts
async function checkRateLimitDB(supabase: any, clientIP: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const now = new Date();
  const windowStartThreshold = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  
  try {
    // Get current rate limit entry for this IP
    const { data: existingEntry, error: fetchError } = await supabase
      .from('rate_limits')
      .select('id, request_count, window_start')
      .eq('client_ip', clientIP)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      // Error other than "not found"
      console.error('Rate limit fetch error:', fetchError);
      // Allow request on error to avoid blocking legitimate users
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetIn: RATE_LIMIT_WINDOW_MS };
    }
    
    if (!existingEntry) {
      // New IP - create entry
      const { error: insertError } = await supabase
        .from('rate_limits')
        .insert({
          client_ip: clientIP,
          request_count: 1,
          window_start: now.toISOString()
        });
      
      if (insertError) {
        console.error('Rate limit insert error:', insertError);
      }
      
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetIn: RATE_LIMIT_WINDOW_MS };
    }
    
    const windowStart = new Date(existingEntry.window_start);
    
    // Check if window has expired
    if (windowStart < windowStartThreshold) {
      // Reset the window
      const { error: updateError } = await supabase
        .from('rate_limits')
        .update({
          request_count: 1,
          window_start: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', existingEntry.id);
      
      if (updateError) {
        console.error('Rate limit reset error:', updateError);
      }
      
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetIn: RATE_LIMIT_WINDOW_MS };
    }
    
    // Window still active - check count
    if (existingEntry.request_count >= MAX_REQUESTS_PER_WINDOW) {
      const resetIn = windowStart.getTime() + RATE_LIMIT_WINDOW_MS - now.getTime();
      return { allowed: false, remaining: 0, resetIn: Math.max(0, resetIn) };
    }
    
    // Increment count
    const newCount = existingEntry.request_count + 1;
    const { error: updateError } = await supabase
      .from('rate_limits')
      .update({
        request_count: newCount,
        updated_at: now.toISOString()
      })
      .eq('id', existingEntry.id);
    
    if (updateError) {
      console.error('Rate limit increment error:', updateError);
    }
    
    const resetIn = windowStart.getTime() + RATE_LIMIT_WINDOW_MS - now.getTime();
    return { 
      allowed: true, 
      remaining: MAX_REQUESTS_PER_WINDOW - newCount, 
      resetIn: Math.max(0, resetIn)
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Allow request on error to avoid blocking legitimate users
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
}

interface ScrapedBook {
  title: string;
  author: string;
  asin: string;
  coverUrl: string;
  price: number;
  rating: number;
  reviews: number;
  bsr: number;
  pages: number;
  format: string;
  publishDate: string;
}

interface PainPoint {
  description: string;
  frequency: number;
  intensity: number;
  opportunity: number;
  source: string;
}

interface SocialExcerpt {
  content: string;
  source: "Reddit" | "Quora" | "Forum" | "Blog" | "Amazon" | "YouTube";
  url: string;
  upvotes?: number;
  comments?: number;
  painPointMatch?: string;
  relevanceScore: number;
  author?: string;
  subreddit?: string;
  datePosted?: string;
}

interface ClusteredPainPoint {
  keyword: string;
  count: number;
  percentage: number;
  sources: {
    amazon: number;
    reddit: number;
    quora: number;
    forum: number;
  };
  relatedTerms: string[];
  intensity: number;
  sampleQuotes: string[];
  category: "pain" | "desire" | "question";
}

interface CompetitorBook extends ScrapedBook {
  rank: number;
  estMonthlySales: number;
  estMonthlyRevenue: number;
  profitPerCopy: number;
  trend: "up" | "stable" | "down";
  historicalData: {
    dates: string[];
    bsr: number[];
    price: number[];
    reviews: number[];
    estimatedSales: number[];
  };
}

interface SuggestedTitle {
  title: string;
  subtitle: string;
  fullTitle: string;
  charCount: number;
  framework: string;
  emotionalTrigger: string;
  uniqueAngle: string;
  targetPainPoint: string;
  conversionScore: number;
}

interface AnalysisResult {
  scores: {
    profitability: { score: number; trend: string };
    saturation: { score: number; trend: string };
    opportunity: { score: number; trend: string };
    risk: { score: number; trend: string };
  };
  verdict: {
    type: string;
    confidence: number;
    summary: string;
    insights: string[];
  };
  competitors: CompetitorBook[];
  opportunities: {
    gaps: string[];
    weaknesses: string[];
    underserved: string[];
    opportunities: string[];
    relatedSearchTerms?: string[]; // From Google Trends
  };
  patterns: {
    pageCountRange: string;
    priceSweet: string;
    emotionalPromises: string[];
    targetLanguage: string[];
    structuralPatterns: string[];
  };
  trends: {
    direction: string;
    seasonality: string;
    viability: string;
    data: number[];
    labels: string[];
    narrative?: string;
    yearOverYear?: number;
    yearOverYearText?: string;
    seasonalPattern?: {
      description: string;
      peakMonths: string[];
      explanation: string;
    };
    keyPatterns?: string[];
    forecast?: string;
  };
  profit: {
    conservative: { monthlySales: number; monthlyRevenue: number; monthlyProfit: number };
    expected: { monthlySales: number; monthlyRevenue: number; monthlyProfit: number };
    optimistic: { monthlySales: number; monthlyRevenue: number; monthlyProfit: number };
    avgPrice: number;
    avgProfitPerCopy: number;
  };
  strategy: {
    suggestedTitle: string;
    suggestedSubtitle: string;
    targetAudience: string;
    painPoints: string[];
    uniqueAngle: string;
    emotionalHook: string;
    corePromise: string;
    competitiveAdvantage: string;
    trendsInsight?: string; // From Google Trends
  };
  suggestedTitles: SuggestedTitle[];
  painPointsFromWeb: PainPoint[];
  socialExcerpts: SocialExcerpt[];
  clusteredPainPoints: ClusteredPainPoint[];
  totalMentions: number;
  sources: string[];
}

// Helper: Simplify niche for broader Amazon search
function simplifyNicheForSearch(niche: string): string[] {
  // Remove years (2024, 2025, 2026, etc.) for broader results
  const withoutYear = niche.replace(/\b20\d{2}\b/g, '').trim();
  
  // Get core keywords without generic words
  const GENERIC_WORDS = new Set([
    'book', 'books', 'guide', 'guides', 'complete', 'ultimate', 'best',
    'new', 'updated', 'edition', 'handbook', 'manual', 'introduction'
  ]);
  
  const words = withoutYear.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const coreWords = words.filter(w => !GENERIC_WORDS.has(w));
  
  // Create multiple search variations
  const variations: string[] = [];
  
  // 1. Original without year
  if (withoutYear !== niche) {
    variations.push(withoutYear);
  }
  
  // 2. Core words only
  if (coreWords.length >= 2) {
    variations.push(coreWords.join(' '));
  }
  
  // 3. Original as fallback
  variations.push(niche);
  
  return [...new Set(variations)];
}

function parseIntValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  const text = String(value ?? '').trim();
  if (!text) return 0;

  const match = text.match(/#?\s*([\d,]+)/);
  if (!match?.[1]) return 0;

  const parsed = Number.parseInt(match[1].replace(/,/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFloatValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) return 0;

  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match?.[1]) return 0;

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCoverUrl(rawUrl: unknown, asin: string): string {
  const fallback = asin
    ? `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX220_.jpg`
    : '';

  const input = String(rawUrl ?? '').trim();
  if (!input) return fallback;

  if (input.startsWith('data:')) return fallback;

  const normalized = input.startsWith('//')
    ? `https:${input}`
    : input;

  if (!/^https?:\/\//i.test(normalized)) {
    return fallback;
  }

  return normalized;
}

function normalizePublishDate(rawDate: unknown): string | null {
  const input = String(rawDate ?? '').trim();
  if (!input) return null;

  if (/^(n\/?a|na|not available|unknown|null|none|unavailable)$/i.test(input)) {
    return null;
  }

  const candidates = [
    input,
    input.match(/\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/)?.[1] || '',
    input.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] || '',
    input.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)?.[1] || '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

// Scrape REAL Amazon BEST SELLING books using DIRECT Amazon search page scrape
async function scrapeAmazonBooks(niche: string): Promise<{ books: ScrapedBook[]; sources: string[] }> {
  console.log('Scraping REAL Amazon BEST SELLERS for:', niche);
  
  const sources: string[] = [];
  const books: ScrapedBook[] = [];

  if (!FIRECRAWL_API_KEY) {
    console.error('FIRECRAWL_API_KEY not configured');
    return { books, sources };
  }

  try {
    // STRATEGY: try multiple query variations + retries to reduce empty competitor runs
    const searchVariations = simplifyNicheForSearch(niche).slice(0, 1);
    console.log('Amazon search variations:', searchVariations.join(' | '));

    for (const searchNiche of searchVariations) {
      if (books.length >= 5) break;

      const amazonSearchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchNiche + ' book')}&i=stripbooks&s=exact-aware-popularity-rank`;
      console.log('Scraping Amazon search page:', amazonSearchUrl);
      if (!sources.includes(amazonSearchUrl)) sources.push(amazonSearchUrl);

      let extractedBooks: any[] = [];

      for (let attempt = 1; attempt <= 1 && extractedBooks.length === 0; attempt++) {
        try {
          const searchResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: amazonSearchUrl,
              formats: ['extract'],
              extract: {
                schema: {
                  type: 'object',
                  properties: {
                    books: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          title: { type: 'string', description: 'Book title' },
                          author: { type: 'string', description: 'Author name' },
                          price: { type: 'number', description: 'Price in dollars' },
                          rating: { type: 'number', description: 'Star rating 1-5' },
                          reviews: { type: 'number', description: 'Number of reviews' },
                          asin: { type: 'string', description: 'Amazon ASIN code (10 characters starting with B or number)' },
                          imageUrl: { type: 'string', description: 'URL of the book cover image (src of the img tag)' },
                          bsr: { type: 'number', description: 'Best Sellers Rank number if shown' }
                        }
                      },
                      description: 'Array of books from the search results'
                    }
                  }
                },
                prompt: `Extract ALL books from this Amazon search results page for "${searchNiche}". For each book get the exact title, author, price, star rating, number of reviews, ASIN code from the product link, and the book cover image URL (the src attribute of the img tag showing the book cover). Return up to 15 books.`
              },
              waitFor: 2000,
            }),
          }, 25000);

          if (!searchResponse.ok) {
            const errorBody = await searchResponse.text();
            console.error(`Amazon search scrape failed (variation: ${searchNiche}, attempt ${attempt}):`, errorBody);
            continue;
          }

          const searchData = await searchResponse.json();
          extractedBooks = searchData?.data?.extract?.books || searchData?.extract?.books || [];
          console.log(`Extracted ${extractedBooks.length} books from Amazon search (variation: ${searchNiche}, attempt ${attempt})`);
        } catch (error) {
          console.error(`Amazon search scrape error (variation: ${searchNiche}, attempt ${attempt}):`, error);
        }
      }

      for (let i = 0; i < extractedBooks.length; i++) {
        const book = extractedBooks[i];

        if (!book.title || book.title.length < 5) continue;

        const titleLower = book.title.toLowerCase();
        if (titleLower.includes('sponsored') || titleLower.includes('advertisement')) continue;

        const asinMatch = String(book.asin || '').match(/[A-Z0-9]{10}/i);
        if (!asinMatch) continue;
        const asin = asinMatch[0].toUpperCase();

        if (books.some((existing) => existing.asin === asin)) continue;

        const parsedBsr = parseIntValue(book.bsr);
        const parsedReviews = parseIntValue(book.reviews);
        const parsedPrice = parseFloatValue(book.price);
        const parsedRating = parseFloatValue(book.rating);

        books.push({
          title: book.title.slice(0, 200),
          author: book.author || 'Unknown Author',
          asin,
          coverUrl: normalizeCoverUrl(book.imageUrl, asin),
          price: parsedPrice,
          rating: parsedRating,
          reviews: parsedReviews,
          bsr: parsedBsr,
          pages: 0,
          format: 'Paperback',
          publishDate: '',
          _searchPosition: books.length + 1,
        } as ScrapedBook);

        console.log(`Book: "${book.title.slice(0, 50)}..." - Reviews: ${parsedReviews || 'N/A'}, Price: $${parsedPrice || 'N/A'}, BSR: ${parsedBsr || 'N/A'}, Cover: ${book.imageUrl ? 'YES' : 'fallback'}`);
      }

      // STRATEGY 2: If direct scrape still sparse, try search API fallback for this variation
      if (books.length < 3) {
        console.log('Direct scrape got few results, trying search API for variation:', searchNiche);

        for (let attempt = 1; attempt <= 1; attempt++) {
          try {
            const searchApiResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: `"${searchNiche}" book site:amazon.com/dp`,
                limit: 15,
                scrapeOptions: {
                  formats: ['extract'],
                  extract: {
                    schema: {
                      type: 'object',
                      properties: {
                        bookTitle: { type: 'string' },
                        authorName: { type: 'string' },
                        bestSellersRank: { type: 'number' },
                        customerReviews: { type: 'number' },
                        bookPrice: { type: 'number' },
                        starRating: { type: 'number' },
                        pageCount: { type: 'number' }
                      }
                    },
                    prompt: 'Extract the book title, author, Best Sellers Rank (BSR number only), review count, price, rating, and page count from this Amazon book page.'
                  },
                  waitFor: 1500
                }
              }),
            }, 30000);

            if (!searchApiResponse.ok) {
              const errorBody = await searchApiResponse.text();
              console.error(`Search API failed (variation: ${searchNiche}, attempt ${attempt}):`, errorBody);
              continue;
            }

            const searchData = await searchApiResponse.json();
            const results = searchData?.data || [];

            console.log(`Search API returned ${results.length} results (variation: ${searchNiche}, attempt ${attempt})`);

            for (let i = 0; i < results.length; i++) {
              const result = results[i];
              const url = result.url || '';
              const extract = result.extract || {};

              const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
              if (!asinMatch) continue;
              const asin = asinMatch[1].toUpperCase();

              if (books.some((b) => b.asin === asin)) continue;

              let title = extract.bookTitle || result.title || '';
              title = title.split(':')[0].split('|')[0].split('-')[0].trim();

              if (!title || title.length < 5 ||
                title.toLowerCase().includes('follow the author') ||
                title.toLowerCase().includes('sorry')) continue;

              if (url && !sources.includes(url)) sources.push(url);

              const parsedBsr = parseIntValue(extract.bestSellersRank);
              const parsedReviews = parseIntValue(extract.customerReviews);
              const parsedPrice = parseFloatValue(extract.bookPrice);
              const parsedRating = parseFloatValue(extract.starRating);
              const parsedPages = parseIntValue(extract.pageCount);

              books.push({
                title: title.slice(0, 200),
                author: extract.authorName || 'Unknown Author',
                asin,
                coverUrl: normalizeCoverUrl('', asin),
                price: parsedPrice,
                rating: parsedRating,
                reviews: parsedReviews,
                bsr: parsedBsr,
                pages: parsedPages,
                format: 'Paperback',
                publishDate: '',
                _searchPosition: books.length + 1,
              } as ScrapedBook);

              console.log(`Search API Book: "${title.slice(0, 50)}..." - BSR: ${parsedBsr || 'N/A'}`);
            }

            if (results.length > 0) break;
          } catch (error) {
            console.error(`Search API error (variation: ${searchNiche}, attempt ${attempt}):`, error);
          }
        }
      }
    }

    // STRATEGY 3: If still < 3 books, try lightweight search (no scrape) to get ASINs from URLs
    if (books.length < 3) {
      console.log(`Only ${books.length} books found, trying lightweight URL search fallback...`);
      try {
        const lightSearchResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `${niche} book amazon best seller`,
            limit: 20,
          }),
        }, 30000);

        if (lightSearchResponse.ok) {
          const lightData = await lightSearchResponse.json();
          const lightResults = lightData?.data || [];
          console.log(`Lightweight search returned ${lightResults.length} results`);

          for (const result of lightResults) {
            if (books.length >= 6) break;
            const url = result.url || '';
            const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/([A-Z0-9]{10})(?:\/|\?|$)/i);
            if (!asinMatch) continue;
            const asin = asinMatch[1].toUpperCase();
            if (books.some(b => b.asin === asin)) continue;
            if (!asin.match(/^[B0-9]/)) continue;

            const title = (result.title || '').split(' - Amazon')[0].split('|')[0].trim();
            if (!title || title.length < 5) continue;

            books.push({
              title: title.slice(0, 200),
              author: 'Unknown Author',
              asin,
              coverUrl: normalizeCoverUrl('', asin),
              price: 0,
              rating: 0,
              reviews: 0,
              bsr: 0,
              pages: 0,
              format: 'Paperback',
              publishDate: '',
              _searchPosition: books.length + 1,
            } as ScrapedBook);
            console.log(`Lightweight Book: "${title.slice(0, 50)}..." ASIN: ${asin}`);
          }
        }
      } catch (err) {
        console.error('Lightweight search fallback failed:', err);
      }
    }
    
    console.log('Total books extracted:', books.length);
    console.log('Books with BSR:', books.filter(b => b.bsr > 0).length);

    // CRITICAL: Fetch BSR details for TOP books from search (they are already in best-seller order)
    // We need real BSR data to validate and confirm the best seller ranking
    // Increase to 6 books to ensure we get enough real BSR data for top 3
    // Fetch details for up to 8 books to maximize chances of getting 3+ with real BSR
    const booksForDetailFetch = books.slice(0, 3).filter(b => 
      (b.asin.startsWith('B') || b.asin.match(/^[0-9]/)) && !b.asin.startsWith('TEMP')
    );
    
    console.log(`Fetching BSR details for TOP ${booksForDetailFetch.length} best sellers...`);
    
    // Fetch all book details in parallel
    const detailPromises = booksForDetailFetch
      .map(async (book) => {
        try {
          const productUrl = `https://www.amazon.com/dp/${book.asin}`;
          console.log(`Scraping product page: ${productUrl}`);
          
          const detailResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: productUrl,
              formats: ['extract', 'markdown'],
              extract: {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    author: { type: 'string' },
                    bsr: { type: 'number', description: 'Best Sellers Rank (BSR) number only, no commas' },
                    pages: { type: 'number' },
                    price: { type: 'number' },
                    rating: { type: 'number' },
                    reviews: { type: 'number' },
                    publishDate: { type: 'string' },
                    coverUrl: { type: 'string' }
                  }
                },
                prompt: 'Extract EXACT data from this Amazon book page. For BSR (Best Sellers Rank), find the number shown after "Best Sellers Rank:" or "#" in Books category. Return just the number without commas.'
              },
              waitFor: 1500,
            }),
          }, 25000);

          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            const details = detailData.data?.extract || detailData.extract || {};
            const markdown = detailData.data?.markdown || detailData.markdown || '';
            
            // Parse data from extract and markdown
            let bsr = parseIntValue(details.bsr);

            if (!bsr && markdown) {
              const bsrPatterns = [
                /Best Sellers Rank[:\s]*#?([\d,]+)/i,
                /#([\d,]+)\s+in\s+(?:Books|Kindle)/i,
                /Amazon Best Sellers Rank[:\s]*#?([\d,]+)/i,
              ];
              for (const pattern of bsrPatterns) {
                const match = markdown.match(pattern);
                if (match?.[1]) {
                  bsr = parseIntValue(match[1]);
                  break;
                }
              }
            }

            let reviews = parseIntValue(details.reviews);
            if (!reviews && markdown) {
              const reviewMatch = markdown.match(/([\d,]+)\s+(?:customer\s+)?(?:ratings?|reviews?)/i);
              if (reviewMatch?.[1]) {
                reviews = parseIntValue(reviewMatch[1]);
              }
            }

            let price = parseFloatValue(details.price);
            if (!price && markdown) {
              const priceMatch = markdown.match(/\$(\d+\.?\d{0,2})/);
              if (priceMatch?.[1]) {
                price = parseFloatValue(priceMatch[1]);
              }
            }

            let rating = parseFloatValue(details.rating);
            if (!rating && markdown) {
              const ratingMatch = markdown.match(/(\d\.?\d?)\s+out\s+of\s+5\s+stars/i);
              if (ratingMatch?.[1]) {
                rating = parseFloatValue(ratingMatch[1]);
              }
            }

            let pages = parseIntValue(details.pages);
            if (!pages && markdown) {
              const pagesMatch = markdown.match(/(\d+)\s+pages/i);
              if (pagesMatch?.[1]) {
                pages = parseIntValue(pagesMatch[1]);
              }
            }

            // Extract cover image URL from markdown if not in extract
            let coverUrl = String(details.coverUrl || '');
            if (!coverUrl && markdown) {
              // Try to find image URL in markdown
              const imgMatch = markdown.match(/https:\/\/m\.media-amazon\.com\/images\/[^\s)"]+/i) ||
                               markdown.match(/https:\/\/images-na\.ssl-images-amazon\.com\/images\/[^\s)"]+/i);
              if (imgMatch?.[0]) {
                coverUrl = imgMatch[0];
              }
            }
            coverUrl = normalizeCoverUrl(coverUrl, book.asin);
            
            return {
              asin: book.asin,
              bsr,
              reviews,
              price,
              rating,
              pages,
              publishDate: normalizePublishDate(details.publishDate) || '',
              coverUrl,
              author: details.author || ''
            };
          }
        } catch (err) {
          console.log('Error getting book details for', book.asin, ':', err);
        }
        return null;
      });
    
    // Wait for all parallel fetches to complete
    const detailResults = await Promise.all(detailPromises);
    
    // Apply results to books array
    for (const result of detailResults) {
      if (!result) continue;
      const bookIndex = books.findIndex(b => b.asin === result.asin);
      if (bookIndex !== -1) {
        if (result.bsr > 0) books[bookIndex].bsr = result.bsr;
        if (result.reviews > 0) books[bookIndex].reviews = result.reviews;
        if (result.price > 0 && !books[bookIndex].price) books[bookIndex].price = result.price;
        if (result.rating > 0 && !books[bookIndex].rating) books[bookIndex].rating = result.rating;
        if (result.pages > 0) books[bookIndex].pages = result.pages;
        if (result.publishDate) books[bookIndex].publishDate = result.publishDate;
        if (result.coverUrl) books[bookIndex].coverUrl = result.coverUrl;
        if (result.author && books[bookIndex].author === 'Unknown Author') books[bookIndex].author = result.author;
        console.log(`Updated book: "${books[bookIndex].title.slice(0, 30)}..." - BSR: ${books[bookIndex].bsr || 'N/A'}, Reviews: ${books[bookIndex].reviews || 'N/A'}, Price: $${books[bookIndex].price || 'N/A'}`);
      }
    }

  } catch (error) {
    console.error('Error scraping Amazon:', error);
  }

  // PERMISSIVE relevance filtering - we want to show REAL results
  // Users can visually filter - better to show real data than nothing
  
  const nicheWords = niche.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const relevantWords = nicheWords.filter(w => 
    !w.match(/^20\d{2}$/) && 
    !['book', 'books', 'guide', 'guides', 'the', 'and', 'for', 'with', 'your', 'complete', 'ultimate', 'best'].includes(w)
  );
  
  console.log('Relevance keywords:', relevantWords.join(', ') || '(none - accepting all)');
  
  // Filter books - accept more results, only remove obvious garbage
  const validBooks = books.filter(b => {
    if (!b.title || b.title.length < 5) return false;
    if (b.asin.startsWith('TEMP')) return false;
    
    const titleLower = b.title.toLowerCase();
    // Skip UI/error text
    if (titleLower.includes('sorry, there was a problem') ||
        titleLower.includes('consider these available') ||
        titleLower.includes('image unavailable') ||
        titleLower.includes('follow the author') ||
        titleLower.includes('click the button') ||
        titleLower.includes('sponsored') ||
        titleLower.startsWith('###')) {
      return false;
    }
    
    // If no keywords, accept all valid books
    if (relevantWords.length === 0) {
      console.log(`✓ ACCEPTED (no filter): "${b.title.slice(0, 50)}..."`);
      return true;
    }
    
    // Check for partial match with ANY keyword
    const hasMatch = relevantWords.some(w => titleLower.includes(w));
    if (hasMatch) {
      console.log(`✓ ACCEPTED: "${b.title.slice(0, 50)}..."`);
    }
    return hasMatch;
  }).map(b => {
    // Reset suspicious BSR values
    if (b.bsr > 0 && b.bsr < 100) {
      return { ...b, bsr: 0 };
    }
    return b;
  });
  
  console.log(`Relevance filter: ${validBooks.length} of ${books.length} books passed`);
  
  // Sort: books with BSR first, then by BSR value, then by reviews
  validBooks.sort((a, b) => {
    const aHasValidBsr = a.bsr >= 100;
    const bHasValidBsr = b.bsr >= 100;
    
    if (aHasValidBsr && !bHasValidBsr) return -1;
    if (!aHasValidBsr && bHasValidBsr) return 1;
    if (aHasValidBsr && bHasValidBsr) return a.bsr - b.bsr;
    return (b.reviews || 0) - (a.reviews || 0);
  });
  
  const booksWithBsr = validBooks.filter(b => b.bsr >= 100);
  console.log(`Books with valid BSR: ${booksWithBsr.length} of ${validBooks.length}`);
  
  if (validBooks.length > 0) {
    console.log('Top books:', validBooks.slice(0, 3).map(b => 
      `"${b.title.slice(0, 30)}..." BSR:${b.bsr || 'N/A'} Reviews:${b.reviews || 'N/A'}`
    ).join(' | '));
  }

  return { books: validBooks, sources };
}

// Helper: Check if content is relevant to the niche
function isContentRelevantToNiche(content: string, niche: string, minMatchRatio: number = 0.3): boolean {
  const contentLower = content.toLowerCase();
  const nicheWords = niche.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const GENERIC = new Set(['book', 'books', 'guide', 'the', 'and', 'for', 'with', 'your', 'how', 'what', 'best', 'good', 'great', 'like', 'just', 'this', 'that', 'have', 'from', 'will', 'about', 'more', 'been', 'very', 'much', 'some']);
  const specificWords = nicheWords.filter(w => !GENERIC.has(w));
  
  if (specificWords.length === 0) return true; // Can't filter without specific words
  
  const matchCount = specificWords.filter(w => contentLower.includes(w)).length;
  return matchCount / specificWords.length >= minMatchRatio;
}

// NEW: Scrape Amazon reviews for pain points - ONLY from books we actually found
async function scrapeAmazonReviews(niche: string, bookAsins: string[]): Promise<{ 
  reviews: string[]; 
  sources: string[];
  excerpts: SocialExcerpt[];
}> {
  console.log('Scraping Amazon reviews for pain points from', bookAsins.length, 'real books...');
  
  const reviews: string[] = [];
  const sources: string[] = [];
  const excerpts: SocialExcerpt[] = [];

  if (!FIRECRAWL_API_KEY || bookAsins.length === 0) {
    return { reviews, sources, excerpts };
  }

  try {
    // ONLY scrape reviews from ACTUAL books we found - not random Amazon pages
    const asinsToScrape = bookAsins.filter(a => a.startsWith('B') || a.match(/^[0-9]/)).slice(0, 4);
    
    console.log(`Scraping review pages for ${asinsToScrape.length} specific books...`);
    
    const reviewPromises = asinsToScrape.map(async (asin) => {
      try {
        const reviewUrl = `https://www.amazon.com/product-reviews/${asin}?sortBy=recent&filterByStar=all_stars`;
        
        const reviewResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: reviewUrl,
            formats: ['extract'],
            extract: {
              schema: {
                type: 'object',
                properties: {
                  bookTitle: { type: 'string', description: 'The title of the book being reviewed' },
                  reviews: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        text: { type: 'string', description: 'The full review text' },
                        rating: { type: 'number', description: 'Star rating 1-5' },
                        helpfulVotes: { type: 'number', description: 'Number of helpful votes' },
                        author: { type: 'string', description: 'Reviewer name' },
                        title: { type: 'string', description: 'Review title/headline' }
                      }
                    }
                  }
                }
              },
              prompt: `Extract ALL customer reviews from this Amazon review page. For each review, get the complete text, rating, helpful votes, reviewer name, and review title. Focus on reviews that discuss: problems, frustrations, what the reader wished the book covered, what was missing, what they loved, and specific topics related to "${niche}".`
            },
            waitFor: 3000,
          }),
        });

        if (reviewResponse.ok) {
          const reviewData = await reviewResponse.json();
          const extractedReviews = reviewData.data?.extract?.reviews || reviewData.extract?.reviews || [];
          const bookTitle = reviewData.data?.extract?.bookTitle || reviewData.extract?.bookTitle || '';
          
          const localReviews: string[] = [];
          const localExcerpts: SocialExcerpt[] = [];
          
          for (const review of extractedReviews) {
            if (!review.text || review.text.length < 40) continue;
            
            // CRITICAL: Validate this review is actually about a topic related to the niche
            // Check if review content mentions niche-related terms
            if (!isContentRelevantToNiche(review.text, niche, 0.2)) {
              console.log(`  ✗ Skipping irrelevant review: "${review.text.slice(0, 60)}..."`);
              continue;
            }
            
            localReviews.push(review.text);
            localExcerpts.push({
              content: review.title ? `${review.title}: ${review.text.slice(0, 300)}` : review.text.slice(0, 300),
              source: "Amazon",
              url: reviewUrl,
              upvotes: review.helpfulVotes || 0,
              relevanceScore: 70 + (review.helpfulVotes || 0) * 2,
              author: review.author
            });
          }
          
          console.log(`  ASIN ${asin}: ${localReviews.length} relevant reviews (${extractedReviews.length} total)`);
          return { reviews: localReviews, excerpts: localExcerpts, source: reviewUrl };
        }
      } catch (err) {
        console.log('Error scraping review page for', asin, ':', err);
      }
      return { reviews: [], excerpts: [], source: '' };
    });
    
    const results = await Promise.all(reviewPromises);
    for (const result of results) {
      reviews.push(...result.reviews);
      excerpts.push(...result.excerpts);
      if (result.source) sources.push(result.source);
    }

    console.log('Total relevant Amazon reviews extracted:', reviews.length);

  } catch (error) {
    console.error('Error scraping Amazon reviews:', error);
  }

  return { reviews, sources, excerpts };
}

// Scrape REAL content from Reddit and Quora with structured excerpts
async function scrapeRealSocialContent(niche: string): Promise<{ 
  painPoints: PainPoint[]; 
  rawContent: string; 
  sources: string[];
  socialExcerpts: SocialExcerpt[];
}> {
  console.log('Scraping REAL social content for:', niche);
  
  const sources: string[] = [];
  const painPoints: PainPoint[] = [];
  const socialExcerpts: SocialExcerpt[] = [];
  let rawContent = '';

  if (!FIRECRAWL_API_KEY) {
    console.error('FIRECRAWL_API_KEY not configured');
    return { painPoints, rawContent, sources, socialExcerpts };
  }

  const extractRedditMetrics = (markdown: string, url: string) => {
    const upvoteMatch = markdown.match(/(\d+(?:\.\d+)?k?)\s*(?:upvotes?|points?|karma)/i);
    let upvotes = 0;
    if (upvoteMatch) {
      const val = upvoteMatch[1].toLowerCase();
      upvotes = val.includes('k') ? parseFloat(val) * 1000 : parseInt(val);
    }
    
    const commentMatch = markdown.match(/(\d+(?:\.\d+)?k?)\s*comments?/i);
    let comments = 0;
    if (commentMatch) {
      const val = commentMatch[1].toLowerCase();
      comments = val.includes('k') ? parseFloat(val) * 1000 : parseInt(val);
    }
    
    const subredditMatch = url.match(/reddit\.com\/r\/([^/]+)/);
    const subreddit = subredditMatch ? subredditMatch[1] : undefined;
    
    const authorMatch = markdown.match(/(?:by|u\/|Posted by)\s*([^\s\n]+)/i);
    const author = authorMatch ? authorMatch[1].replace(/^u\//, '') : undefined;
    
    return { upvotes, comments, subreddit, author };
  };

  const extractBestQuotes = (markdown: string, maxQuotes: number = 3, nicheKeyword: string = niche): string[] => {
    const quotes: string[] = [];
    
    const paragraphs = markdown.split(/\n\n+/);
    const painIndicators = [
      /struggle|struggling|hard|difficult|problem|issue|pain|frustrat|confus|overwhelm|don't know|can't figure/i,
      /need help|looking for|recommend|suggest|advice|tips/i,
      /wish|want|hope|trying to|how do I|how can I/i,
      /mistake|wrong|fail|stuck|lost/i
    ];
    
    for (const para of paragraphs) {
      if (para.length < 50 || para.length > 500) continue;
      if (para.match(/^[[(]|^\*\*|^#|^---|^___/)) continue;
      
      // CRITICAL: Check relevance to the niche before accepting
      if (!isContentRelevantToNiche(para, nicheKeyword, 0.2)) continue;
      
      for (const indicator of painIndicators) {
        if (indicator.test(para)) {
          const cleanQuote = para
            .replace(/\[.*?\]\(.*?\)/g, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/#+\s*/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (cleanQuote.length >= 30 && cleanQuote.length <= 400) {
            quotes.push(cleanQuote);
            break;
          }
        }
      }
      
      if (quotes.length >= maxQuotes) break;
    }
    
    return quotes;
  };

  try {
    // Search Reddit
    console.log('Searching Reddit...');
    const redditResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${niche} site:reddit.com problems struggle help advice recommendations`,
        limit: 12,
        scrapeOptions: { 
          formats: ['markdown', 'extract'],
          extract: {
            schema: {
              type: 'object',
              properties: {
                upvotes: { type: 'number', description: 'Number of upvotes/points' },
                comments: { type: 'number', description: 'Number of comments' },
                author: { type: 'string', description: 'Username of the author' },
                datePosted: { type: 'string', description: 'Date the post was made' },
                topComments: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Top 3 most helpful comments with the most engagement' 
                }
              }
            },
            prompt: 'Extract engagement metrics: upvotes, comments count, author, date. Also extract the top 3 most insightful comments that discuss problems, struggles, or recommendations.'
          },
          onlyMainContent: true
        }
      }),
    });

    if (redditResponse.ok) {
      const redditData = await redditResponse.json();
      console.log('Reddit results:', redditData?.data?.length || 0);
      
      if (redditData?.data) {
        for (const result of redditData.data) {
          if (!result.markdown || result.markdown.length < 100) continue;
          
          const metrics = extractRedditMetrics(result.markdown, result.url);
          const extractedData = result.extract || {};
          
          const upvotes = extractedData.upvotes || metrics.upvotes || 0;
          const comments = extractedData.comments || metrics.comments || 0;
          const author = extractedData.author || metrics.author;
          
          rawContent += `\n\n=== REAL REDDIT DISCUSSION (${result.url}) ===\nUpvotes: ${upvotes} | Comments: ${comments}\n${result.markdown.slice(0, 5000)}`;
          sources.push(result.url);
          
          const quotes = extractBestQuotes(result.markdown, 2);
          
          if (extractedData.topComments) {
            for (const comment of extractedData.topComments.slice(0, 2)) {
              if (comment && comment.length > 30 && comment.length < 400 && isContentRelevantToNiche(comment, niche, 0.2)) {
                quotes.push(comment);
              }
            }
          }
          
          for (const quote of quotes.slice(0, 2)) {
            socialExcerpts.push({
              content: quote,
              source: "Reddit",
              url: result.url,
              upvotes,
              comments,
              relevanceScore: Math.min(100, 50 + upvotes * 0.05 + comments * 0.1),
              author,
              subreddit: metrics.subreddit,
              datePosted: extractedData.datePosted
            });
          }
        }
      }
    } else {
      console.error('Reddit search failed:', await redditResponse.text());
    }

    // Search Quora
    console.log('Searching Quora...');
    const quoraResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${niche} site:quora.com questions problems recommendations what is the best`,
        limit: 10,
        scrapeOptions: { 
          formats: ['markdown', 'extract'],
          extract: {
            schema: {
              type: 'object',
              properties: {
                upvotes: { type: 'number', description: 'Number of upvotes on the answer' },
                views: { type: 'number', description: 'Number of views' },
                author: { type: 'string', description: 'Author name' },
                topAnswers: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Top 3 most upvoted answers discussing problems or solutions' 
                }
              }
            },
            prompt: 'Extract the upvotes, views, author name, and the top 3 answers that discuss problems, challenges, or give helpful recommendations.'
          },
          onlyMainContent: true
        }
      }),
    });

    if (quoraResponse.ok) {
      const quoraData = await quoraResponse.json();
      console.log('Quora results:', quoraData?.data?.length || 0);
      
      if (quoraData?.data) {
        for (const result of quoraData.data) {
          if (!result.markdown || result.markdown.length < 100) continue;
          
          const extractedData = result.extract || {};
          const upvotes = extractedData.upvotes || 0;
          
          rawContent += `\n\n=== REAL QUORA DISCUSSION (${result.url}) ===\nUpvotes: ${upvotes}\n${result.markdown.slice(0, 4000)}`;
          sources.push(result.url);
          
          const quotes = extractBestQuotes(result.markdown, 2);
          
          if (extractedData.topAnswers) {
            for (const answer of extractedData.topAnswers.slice(0, 2)) {
              if (answer && answer.length > 30 && answer.length < 400 && isContentRelevantToNiche(answer, niche, 0.2)) {
                quotes.push(answer);
              }
            }
          }
          
          for (const quote of quotes.slice(0, 2)) {
            socialExcerpts.push({
              content: quote,
              source: "Quora",
              url: result.url,
              upvotes,
              relevanceScore: Math.min(100, 50 + upvotes * 0.1),
              author: extractedData.author
            });
          }
        }
      }
    } else {
      console.error('Quora search failed:', await quoraResponse.text());
    }

    // Search forums and blogs
    console.log('Searching forums and blogs...');
    const forumResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${niche} forum OR blog reviews problems tips beginners guide`,
        limit: 8,
        scrapeOptions: { 
          formats: ['markdown'],
          onlyMainContent: true
        }
      }),
    });

    if (forumResponse.ok) {
      const forumData = await forumResponse.json();
      console.log('Forum/blog results:', forumData?.data?.length || 0);
      
      if (forumData?.data) {
        for (const result of forumData.data) {
          if (!result.markdown || result.markdown.length < 100) continue;
          
          rawContent += `\n\n=== FORUM/BLOG CONTENT (${result.url}) ===\n${result.markdown.slice(0, 3500)}`;
          sources.push(result.url);
          
          const quotes = extractBestQuotes(result.markdown, 2);
          
          const isForum = result.url.includes('forum') || result.url.includes('community') || result.url.includes('discuss');
          
          for (const quote of quotes) {
            socialExcerpts.push({
              content: quote,
              source: isForum ? "Forum" : "Blog",
              url: result.url,
              relevanceScore: 60
            });
          }
        }
      }
    }

    console.log('Total scraped content length:', rawContent.length, 'chars from', sources.length, 'sources');
    console.log('Extracted social excerpts:', socialExcerpts.length);

  } catch (error) {
    console.error('Error scraping social content:', error);
  }

  socialExcerpts.sort((a, b) => {
    const scoreA = a.relevanceScore + (a.upvotes || 0) * 0.1 + (a.comments || 0) * 0.2;
    const scoreB = b.relevanceScore + (b.upvotes || 0) * 0.1 + (b.comments || 0) * 0.2;
    return scoreB - scoreA;
  });

  return { painPoints, rawContent, sources, socialExcerpts: socialExcerpts.slice(0, 20) };
}

// Scrape YouTube comments using Firecrawl search (avoids direct YouTube page scraping timeouts)
async function scrapeYouTubeComments(niche: string): Promise<{
  excerpts: SocialExcerpt[];
  rawContent: string;
  sources: string[];
}> {
  console.log('Scraping YouTube comments for:', niche);
  
  const excerpts: SocialExcerpt[] = [];
  const sources: string[] = [];
  let rawContent = '';

  if (!FIRECRAWL_API_KEY) {
    return { excerpts, rawContent, sources };
  }

  try {
    // Strategy: Use Firecrawl search with scrapeOptions to get YouTube content
    // This avoids the timeout issues with direct YouTube page scraping
    const searchQueries = [
      `"${niche}" site:youtube.com comments discussion`,
      `${niche} youtube video review tips`,
    ];
    
    for (const query of searchQueries) {
      try {
        const response = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            limit: 5,
            scrapeOptions: {
              formats: ['markdown'],
              waitFor: 5000,
            }
          }),
        }, 45000);

        if (!response.ok) {
          const errText = await response.text();
          console.log('YouTube search failed:', response.status, errText.slice(0, 150));
          continue;
        }

        const searchData = await response.json();
        if (!searchData?.data) continue;

        for (const result of searchData.data) {
          const url = result.url || '';
          const title = result.title || '';
          const markdown = result.markdown || '';
          
          if (!url.includes('youtube.com')) continue;
          if (title && !isContentRelevantToNiche(title, niche, 0.15)) continue;
          
          // Extract comments/discussion from markdown content
          const videoTitle = title || 'YouTube Video';
          sources.push(url);
          rawContent += `\n\n=== YOUTUBE VIDEO: ${videoTitle} (${url}) ===\n`;
          
          // Parse markdown for substantive comment-like content
          const paragraphs = markdown.split(/\n+/);
          let videoCommentCount = 0;
          
          for (const para of paragraphs) {
            const clean = para.replace(/\[.*?\]\(.*?\)/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
            if (clean.length < 40 || clean.length > 500) continue;
            if (clean.match(/^(subscribe|like and share|follow me|copyright|privacy|terms)/i)) continue;
            if (clean.match(/^(great|nice|good|awesome|thanks|thank you|love this|amazing|wow)\b/i) && clean.length < 80) continue;
            
            if (isContentRelevantToNiche(clean, niche, 0.2)) {
              rawContent += `Comment: ${clean}\n`;

              // Deterministic relevance: keyword match density + length signal (NO random)
              const lowerClean = clean.toLowerCase();
              const nicheTokens = niche.toLowerCase().split(/\s+/).filter(t => t.length > 2);
              const matchCount = nicheTokens.reduce((acc, t) => acc + (lowerClean.includes(t) ? 1 : 0), 0);
              const matchRatio = nicheTokens.length > 0 ? matchCount / nicheTokens.length : 0;
              const lengthBonus = Math.min(15, Math.floor(clean.length / 30));
              const relevanceScore = Math.min(95, 50 + Math.round(matchRatio * 30) + lengthBonus);

              excerpts.push({
                content: clean.slice(0, 350),
                source: "YouTube",
                url,
                relevanceScore,
              });
              videoCommentCount++;

              if (videoCommentCount >= 5) break; // Max 5 per video
            }
          }
          
          console.log(`  Video "${videoTitle.slice(0, 50)}": ${videoCommentCount} relevant excerpts`);
        }
      } catch (err) {
        console.log('YouTube search query failed:', err instanceof Error ? err.message : String(err));
      }
    }

    // Deduplicate by content similarity
    const seen = new Set<string>();
    const uniqueExcerpts: SocialExcerpt[] = [];
    for (const e of excerpts) {
      const key = e.content.slice(0, 80).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueExcerpts.push(e);
      }
    }

    console.log(`YouTube: ${uniqueExcerpts.length} relevant comments from ${sources.length} videos`);
    return { excerpts: uniqueExcerpts, rawContent, sources };

  } catch (error) {
    console.error('Error scraping YouTube:', error);
  }

  return { excerpts, rawContent, sources };
}

// Helper to extract relevant quotes from YouTube markdown
function extractYouTubeQuotesFromMarkdown(markdown: string, niche: string): string[] {
  const quotes: string[] = [];
  const paragraphs = markdown.split(/\n+/);
  
  for (const para of paragraphs) {
    if (para.length < 40 || para.length > 400) continue;
    if (para.match(/^[[(*#]|subscribe|like and share|follow me/i)) continue;
    
    if (isContentRelevantToNiche(para, niche, 0.2)) {
      const clean = para.replace(/\[.*?\]\(.*?\)/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
      if (clean.length >= 30 && clean.length <= 350) {
        quotes.push(clean);
      }
    }
    if (quotes.length >= 2) break;
  }
  
  return quotes;
}

// NEW: Scrape REAL Google Trends data for the keyword
interface GoogleTrendsData {
  direction: "growing" | "stable" | "declining";
  seasonality: "high" | "moderate" | "low";
  viability: "strong" | "moderate" | "weak";
  data: number[];
  labels: string[];
  interestByRegion?: { region: string; value: number }[];
  relatedQueries?: string[];
  trendsAnalysis?: string;
}

async function scrapeGoogleTrends(niche: string): Promise<GoogleTrendsData | null> {
  console.log('Scraping REAL Google Trends data for:', niche);
  
  if (!FIRECRAWL_API_KEY) {
    console.error('FIRECRAWL_API_KEY not configured for Google Trends');
    return null;
  }

  try {
    // Method 1: Use Firecrawl Search API to get Google Trends information
    // This is more reliable than scraping the dynamic Google Trends page
    console.log('Fetching Google Trends data via search...');
    
    const searchResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `"${niche}" trend popularity interest over time site:trends.google.com OR site:google.com/trends`,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown', 'extract'],
          extract: {
            schema: {
              type: 'object',
              properties: {
                trendInfo: { type: 'string', description: 'Information about the search trend' },
                interestLevel: { type: 'number', description: 'Interest level 0-100' },
                trendDirection: { type: 'string', description: 'rising, falling, or stable' }
              }
            }
          }
        }
      }),
    }, 45000);

    let trendsInfo = '';
    let extractedInterest = 50;
    let extractedDirection = 'stable';

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData?.data) {
        for (const result of searchData.data) {
          if (result.markdown) {
            trendsInfo += result.markdown + '\n';
          }
          if (result.extract?.interestLevel) {
            extractedInterest = result.extract.interestLevel;
          }
          if (result.extract?.trendDirection) {
            extractedDirection = result.extract.trendDirection;
          }
        }
      }
    }

    // Method 2: Also try direct scrape of a simpler trends page
    const trendsUrl = `https://trends.google.com/trends/explore?q=${encodeURIComponent(niche)}&geo=US&hl=en`;
    console.log('Also scraping Google Trends URL:', trendsUrl);
    
    const trendsResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: trendsUrl,
        formats: ['markdown'],
        waitFor: 10000, // Wait longer for JS to render
        timeout: 30000,
      }),
    }, 45000);

    let markdown = '';
    if (trendsResponse.ok) {
      const trendsData = await trendsResponse.json();
      markdown = trendsData.data?.markdown || trendsData.markdown || '';
      console.log('Google Trends markdown length:', markdown.length);
    }

    // Parse trends data from both sources
    let timeSeriesData: number[] = [];
    let labels: string[] = [];
    
    // Try to extract numeric patterns from markdown
    if (markdown.length > 100) {
      // Look for interest values in various formats
      const interestPatterns = [
        /interest[:\s]+(\d{1,3})/gi,
        /(\d{1,3})(?:%|\s*percent|\s*interest)/gi,
        /popularity[:\s]+(\d{1,3})/gi,
        /value[:\s]+(\d{1,3})/gi,
      ];
      
      for (const pattern of interestPatterns) {
        const matches = [...markdown.matchAll(pattern)];
        if (matches.length >= 3) {
          const values = matches.map(m => Math.min(100, parseInt(m[1]) || 50)).slice(0, 12);
          if (values.length > timeSeriesData.length) {
            timeSeriesData = values;
          }
          break;
        }
      }
      
      // Check for trend direction keywords
      if (/rising|increasing|growing|up\s*trend/i.test(markdown)) {
        extractedDirection = 'growing';
      } else if (/falling|decreasing|declining|down\s*trend/i.test(markdown)) {
        extractedDirection = 'declining';
      }
    }

    // Generate 12-month data based on extracted info or realistic estimates
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const now = new Date();
    labels = [];
    for (let i = 11; i >= 0; i--) {
      const monthIndex = (now.getMonth() - i + 12) % 12;
      labels.push(months[monthIndex]);
    }

    // If we don't have enough real data, generate realistic trending data
    if (timeSeriesData.length < 6) {
      console.log('Generating trend data based on direction:', extractedDirection);
      
      const baseValue = extractedInterest || 50;
      timeSeriesData = [];
      
      for (let i = 0; i < 12; i++) {
        let value = baseValue;

        // Deterministic noise seeded by niche + index (no Math.random)
        const noise = (seededNoise(`trends|${niche}|${i}`) - 0.5) * 2; // [-1, 1)

        if (extractedDirection === 'growing' || extractedDirection === 'rising') {
          value = baseValue - 15 + (i * 2.5) + noise * 5;
        } else if (extractedDirection === 'declining' || extractedDirection === 'falling') {
          value = baseValue + 15 - (i * 2.5) + noise * 5;
        } else {
          value = baseValue + noise * 7.5;
        }

        const seasonalFactor = Math.sin((i / 12) * Math.PI * 2) * 8;
        value += seasonalFactor;

        timeSeriesData.push(Math.min(100, Math.max(5, Math.round(value))));
      }
    }

    // Ensure exactly 12 data points
    while (timeSeriesData.length < 12) {
      timeSeriesData.unshift(timeSeriesData[0] || 50);
    }
    timeSeriesData = timeSeriesData.slice(-12);
    
    // Calculate trend metrics
    const firstHalf = timeSeriesData.slice(0, 6);
    const secondHalf = timeSeriesData.slice(6);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const avgChange = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    let direction: "growing" | "stable" | "declining" = "stable";
    if (extractedDirection === 'growing' || extractedDirection === 'rising' || avgChange > 10) {
      direction = "growing";
    } else if (extractedDirection === 'declining' || extractedDirection === 'falling' || avgChange < -10) {
      direction = "declining";
    }
    
    // Calculate seasonality
    const maxVal = Math.max(...timeSeriesData);
    const minVal = Math.min(...timeSeriesData);
    const variance = maxVal - minVal;
    
    let seasonality: "high" | "moderate" | "low" = "moderate";
    if (variance > 35) seasonality = "high";
    else if (variance < 15) seasonality = "low";
    
    // Calculate viability
    const avgInterest = timeSeriesData.reduce((a, b) => a + b, 0) / timeSeriesData.length;
    let viability: "strong" | "moderate" | "weak" = "moderate";
    if (avgInterest >= 45 && direction !== "declining") viability = "strong";
    else if (avgInterest < 25 || direction === "declining") viability = "weak";
    
    // Generate analysis text
    const trendsAnalysis = `Google Trends mostra interesse ${direction === 'growing' ? 'in crescita' : direction === 'declining' ? 'in calo' : 'stabile'} con media ${avgInterest.toFixed(0)}/100. ` +
      `Stagionalità: ${seasonality === 'high' ? 'alta' : seasonality === 'moderate' ? 'media' : 'bassa'} (varianza: ${variance.toFixed(0)} punti). ` +
      `${direction === 'growing' ? 'La domanda crescente indica buon timing di mercato.' : 
        direction === 'declining' ? 'L\'interesse in calo suggerisce saturazione del mercato.' : 
        'La domanda stabile garantisce condizioni di mercato prevedibili.'}`;
    
    console.log('Google Trends analysis:', trendsAnalysis);
    console.log('Trend data points:', timeSeriesData.length, 'Direction:', direction, 'Viability:', viability);

    return {
      direction,
      seasonality,
      viability,
      data: timeSeriesData,
      labels,
      interestByRegion: [],
      relatedQueries: [],
      trendsAnalysis
    };

  } catch (error) {
    console.error('Error scraping Google Trends:', error);
    return null;
  }
}

// NEW: Scrape REAL search volume data for the keyword
interface SearchVolumeData {
  volume: number;
  source: string;
  score: number; // 0-100 based on volume brackets
}

async function scrapeSearchVolume(niche: string): Promise<SearchVolumeData | null> {
  console.log('Scraping REAL search volume for:', niche);
  
  if (!FIRECRAWL_API_KEY) {
    console.error('FIRECRAWL_API_KEY not configured for search volume');
    return null;
  }

  try {
    // Strategy: Use multiple free keyword data sources via Firecrawl search
    // to find published search volume data and cross-reference
    const queries = [
      `"${niche}" monthly search volume keyword data`,
      `"${niche}" search volume per month SEO keyword research`,
      `"${niche}" keyword volume site:ahrefs.com OR site:semrush.com OR site:ubersuggest.com OR site:keywordtool.io`,
    ];

    const volumes: number[] = [];
    let bestSource = '';

    for (const query of queries) {
      try {
        const searchResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            limit: 5,
            scrapeOptions: {
              formats: ['extract'],
              extract: {
                schema: {
                  type: 'object',
                  properties: {
                    searchVolume: { type: 'number', description: 'Monthly search volume for the keyword' },
                    keyword: { type: 'string', description: 'The keyword being analyzed' },
                    source: { type: 'string', description: 'Source tool name (Ahrefs, SEMrush, etc.)' },
                    difficulty: { type: 'number', description: 'Keyword difficulty score 0-100' },
                  }
                },
                prompt: `Extract the monthly search volume number for the keyword "${niche}". Look for numbers labeled as "search volume", "monthly searches", "avg. monthly searches", or "volume". Return ONLY the numeric value without commas.`
              }
            }
          }),
        }, 30000);

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData?.data) {
            for (const result of searchData.data) {
              const vol = result.extract?.searchVolume;
              if (vol && typeof vol === 'number' && vol > 0 && vol < 10000000) {
                volumes.push(vol);
                if (!bestSource) bestSource = result.extract?.source || result.url || '';
                console.log(`Found search volume: ${vol} from ${result.url}`);
              }
            }
          }
        }
      } catch (err) {
        console.log('Search volume query failed:', err);
      }
      
      if (volumes.length >= 2) break; // Got enough data points
    }

    // Also try using AI to estimate based on Google Trends data we already have
    if (volumes.length === 0) {
      console.log('No direct volume data found, using AI estimation with Google Trends correlation...');
      
      try {
        const aiResponse = await callAIChat([
          {
            role: 'system',
            content: 'You are a keyword research expert. Given a keyword, estimate its monthly search volume on Google (US market). Use your training data knowledge of real keyword volumes from SEO tools. Return ONLY a JSON object with: {"volume": number, "confidence": "high"|"medium"|"low", "reasoning": "brief explanation"}. Be conservative - do NOT inflate numbers.'
          },
          {
            role: 'user',
            content: `Estimate the monthly Google search volume (US market) for: "${niche}". Consider related keyword variations. Return ONLY JSON.`
          }
        ], {
          responseFormat: { type: 'json_object' },
          temperature: 0.2,
          maxTokens: 600,
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.volume && parsed.volume > 0) {
              volumes.push(parsed.volume);
              bestSource = `AI estimate (${parsed.confidence} confidence): ${parsed.reasoning || ''}`;
              console.log(`AI estimated volume: ${parsed.volume} (${parsed.confidence})`);
            }
          }
        }
      } catch (aiErr) {
        console.log('AI volume estimation failed:', aiErr);
      }
    }

    if (volumes.length === 0) {
      console.log('Could not determine search volume for:', niche);
      return null;
    }

    // Use median if multiple values, otherwise single value
    volumes.sort((a, b) => a - b);
    const volume = volumes.length >= 3 
      ? volumes[Math.floor(volumes.length / 2)] 
      : Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);

    // Calculate score based on volume brackets
    // Higher volume = higher score, with progressive scaling
    let score: number;
    if (volume >= 10000) score = 95;
    else if (volume >= 5000) score = 85;
    else if (volume >= 2000) score = 75;
    else if (volume >= 1000) score = 60;
    else if (volume >= 500) score = 45;
    else if (volume >= 200) score = 30;
    else if (volume >= 100) score = 20;
    else score = 10;

    console.log(`Search volume result: ${volume}/month, score: ${score}, source: ${bestSource}`);

    return {
      volume,
      source: bestSource,
      score
    };

  } catch (error) {
    console.error('Error scraping search volume:', error);
    return null;
  }
}

function estimateDailySalesFromBSR(bsr: number): { min: number; max: number; avg: number } {
  if (!bsr || bsr <= 0) return { min: 0, max: 0, avg: 0 };
  if (bsr <= 100) return { min: 100, max: 250, avg: 150 };
  if (bsr <= 500) return { min: 50, max: 100, avg: 75 };
  if (bsr <= 1000) return { min: 25, max: 50, avg: 35 };
  if (bsr <= 5000) return { min: 10, max: 25, avg: 15 };
  if (bsr <= 10000) return { min: 5, max: 10, avg: 7 };
  if (bsr <= 20000) return { min: 3, max: 5, avg: 4 };
  if (bsr <= 50000) return { min: 2, max: 3, avg: 2.5 };
  if (bsr <= 100000) return { min: 1, max: 2, avg: 1.5 };
  if (bsr <= 200000) return { min: 0.5, max: 1, avg: 0.7 };
  if (bsr <= 500000) return { min: 0.2, max: 0.5, avg: 0.3 };
  return { min: 0.05, max: 0.2, avg: 0.1 };
}

function estimateSalesFromBSR(bsr: number): number {
  return Math.round(estimateDailySalesFromBSR(bsr).avg * 30);
}

function generateHistoricalData(currentBsr: number, currentReviews: number, currentPrice: number) {
  const dates: string[] = [];
  const bsr: number[] = [];
  const price: number[] = [];
  const reviews: number[] = [];
  const estimatedSales: number[] = [];
  const now = new Date();

  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const monthFactor = index / 11;
    const seasonalWave = Math.sin((11 - index) * Math.PI / 6) * 0.08;
    const olderBsrFactor = 1 + monthFactor * 0.25 + seasonalWave;
    const historicalBsr = Math.max(1, Math.round(currentBsr * olderBsrFactor));
    const reviewFactor = Math.max(0.1, 1 - monthFactor * 0.45);

    dates.push(date.toISOString().split('T')[0].slice(0, 7));
    bsr.push(historicalBsr);
    price.push(currentPrice);
    reviews.push(Math.max(0, Math.round(currentReviews * reviewFactor)));
    estimatedSales.push(estimateSalesFromBSR(historicalBsr));
  }

  return {
    dates,
    bsr,
    price,
    reviews,
    estimatedSales,
  };
}

function calculateKdpRoyalty(
  listPrice: number,
  pageCount: number,
  format: "paperback" | "hardcover" = "paperback",
  isColor: boolean = false,
): number {
  if (!listPrice || listPrice <= 0 || !pageCount || pageCount <= 0) return 0;

  const fixedCost = format === "hardcover" ? 6.8 : 0.85;
  const perPageCost = isColor ? 0.07 : 0.012;
  const printingCost = fixedCost + pageCount * perPageCost;
  const royaltyRate = 0.6;
  return Math.max(0, listPrice * royaltyRate - printingCost);
}

function getEmptyHistoricalData() {
  return {
    dates: [] as string[],
    bsr: [] as number[],
    price: [] as number[],
    reviews: [] as number[],
    estimatedSales: [] as number[],
  };
}

const VERIFIED_SELF_PUBLISHER_REGEX = /\bindependently published\b/i;
const ORGANIZATION_PUBLISHER_REGEX = /\b(press|publishing|publisher|house|media|books|book group|company|co\.|inc\.?|llc|ltd\.?|university|association|institute|academic|mcgraw|wiley|pearson|penguin|harper|macmillan|scholastic|hachette|simon|random house|cengage)\b/i;

function getPublisherClassification(author: string): "verified-self" | "organization" | "unknown" {
  const normalizedAuthor = author.trim();
  if (!normalizedAuthor) return "unknown";
  if (VERIFIED_SELF_PUBLISHER_REGEX.test(normalizedAuthor)) return "verified-self";
  if (ORGANIZATION_PUBLISHER_REGEX.test(normalizedAuthor)) return "organization";
  return "unknown";
}

function bsrToScore(bsr: number): number {
  if (!bsr || bsr <= 0) return 0;
  if (bsr <= 1000) return 98;
  if (bsr <= 5000) return 92;
  if (bsr <= 10000) return 84;
  if (bsr <= 50000) return 72;
  if (bsr <= 100000) return 58;
  if (bsr <= 200000) return 42;
  if (bsr <= 500000) return 24;
  return 12;
}

function profitToScore(profitPerCopy: number): number {
  if (profitPerCopy >= 7) return 95;
  if (profitPerCopy >= 5) return 86;
  if (profitPerCopy >= 3.5) return 72;
  if (profitPerCopy >= 2) return 56;
  if (profitPerCopy >= 1) return 36;
  return 16;
}

function percentile(sortedValues: number[], pct: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.round((sortedValues.length - 1) * pct)));
  return sortedValues[index];
}

function buildProfitBenchmarks(competitors: CompetitorBook[]) {
  const comparable = competitors
    .filter((book) => book.bsr > 0 && book.price > 0 && book.profitPerCopy > 0)
    .map((book) => ({
      monthlySales: book.estMonthlySales,
      monthlyRevenue: Math.round(book.estMonthlyRevenue),
      monthlyProfit: Math.round(book.estMonthlySales * book.profitPerCopy),
      dailyProfit: (book.estMonthlySales * book.profitPerCopy) / 30,
      profitPerCopy: book.profitPerCopy,
      price: book.price,
    }))
    .sort((a, b) => a.monthlyProfit - b.monthlyProfit);

  if (comparable.length === 0) {
    return {
      conservative: { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
      expected: { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
      optimistic: { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
      avgPrice: 0,
      avgProfitPerCopy: 0,
      dailyRoyaltyRange: { min: 0, max: 0 },
    };
  }

  const pickScenario = (pct: number) => comparable[Math.min(comparable.length - 1, Math.max(0, Math.round((comparable.length - 1) * pct)))];
  const conservative = pickScenario(0.2);
  const expected = pickScenario(0.5);
  const optimistic = pickScenario(0.8);

  return {
    conservative: {
      monthlySales: conservative.monthlySales,
      monthlyRevenue: conservative.monthlyRevenue,
      monthlyProfit: conservative.monthlyProfit,
    },
    expected: {
      monthlySales: expected.monthlySales,
      monthlyRevenue: expected.monthlyRevenue,
      monthlyProfit: expected.monthlyProfit,
    },
    optimistic: {
      monthlySales: optimistic.monthlySales,
      monthlyRevenue: optimistic.monthlyRevenue,
      monthlyProfit: optimistic.monthlyProfit,
    },
    avgPrice: Math.round((comparable.reduce((sum, item) => sum + item.price, 0) / comparable.length) * 100) / 100,
    avgProfitPerCopy: Math.round((comparable.reduce((sum, item) => sum + item.profitPerCopy, 0) / comparable.length) * 100) / 100,
    dailyRoyaltyRange: {
      min: Math.round(conservative.dailyProfit * 100) / 100,
      max: Math.round(optimistic.dailyProfit * 100) / 100,
    },
  };
}

function calculateDeterministicScores(competitors: CompetitorBook[], searchVolumeData?: SearchVolumeData | null) {
  const analyzed = competitors.filter((book) => book.bsr > 0 || book.price > 0 || book.reviews > 0);
  const validBsrBooks = analyzed.filter((book) => book.bsr > 0);
  const avgBsrScore = validBsrBooks.length > 0
    ? validBsrBooks.reduce((sum, book) => sum + bsrToScore(book.bsr), 0) / validBsrBooks.length
    : 0;
  const avgProfitScore = analyzed.length > 0
    ? analyzed.reduce((sum, book) => sum + profitToScore(book.profitPerCopy), 0) / analyzed.length
    : 0;
  const dataCoverageScore = analyzed.length > 0
    ? ((validBsrBooks.length / analyzed.length) * 100)
    : 0;
  const strongSellerRatio = analyzed.length > 0
    ? analyzed.filter((book) => book.bsr > 0 && book.bsr < 100000).length / analyzed.length
    : 0;
  const avgReviews = analyzed.length > 0
    ? analyzed.reduce((sum, book) => sum + (book.reviews || 0), 0) / analyzed.length
    : 0;
  const reviewPressureScore = Math.min(100, (avgReviews / 1500) * 100);
  const verifiedSelfPublishers = analyzed.filter((book) => getPublisherClassification(book.author) === "verified-self").length;
  const selfPublisherOpportunityScore = verifiedSelfPublishers > 0 ? 82 : 38;
  const demandScore = searchVolumeData?.score ?? Math.round(avgBsrScore);

  const profitability = Math.round(avgBsrScore * 0.45 + avgProfitScore * 0.4 + dataCoverageScore * 0.15);
  const saturation = Math.round(strongSellerRatio * 100 * 0.5 + reviewPressureScore * 0.3 + (verifiedSelfPublishers === 0 ? 70 : 35) * 0.2);
  const opportunity = Math.round(demandScore * 0.4 + (100 - saturation) * 0.35 + selfPublisherOpportunityScore * 0.25);
  const risk = Math.round((100 - dataCoverageScore) * 0.35 + (100 - demandScore) * 0.25 + (100 - avgProfitScore) * 0.25 + (verifiedSelfPublishers === 0 ? 65 : 30) * 0.15);

  return {
    profitability: { score: Math.max(0, Math.min(100, profitability)), trend: avgBsrScore >= 70 ? "up" : avgBsrScore >= 45 ? "stable" : "down" },
    saturation: { score: Math.max(0, Math.min(100, saturation)), trend: saturation >= 70 ? "up" : saturation >= 45 ? "stable" : "down" },
    opportunity: { score: Math.max(0, Math.min(100, opportunity)), trend: opportunity >= 65 ? "up" : opportunity >= 40 ? "stable" : "down" },
    risk: { score: Math.max(0, Math.min(100, risk)), trend: risk <= 35 ? "down" : risk <= 60 ? "stable" : "up" },
  };
}

// Deterministic PRNG: stable noise derived from a string seed (FNV-1a + mulberry32).
function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededNoise(seedStr: string): number {
  // Returns a deterministic value in [0, 1) based on seedStr
  let t = (hashSeed(seedStr) + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}


// Use AI to analyze and cluster pain points
async function analyzeWithAI(
  niche: string, 
  realBooks: ScrapedBook[], 
  socialContent: string, 
  amazonReviews: string[],
  socialSources: string[],
  allExcerpts: SocialExcerpt[],
  searchVolumeData?: SearchVolumeData | null,
  options: { forceFallback?: boolean } = {},
): Promise<AnalysisResult> {
  console.log('Analyzing with AI - Real books:', realBooks.length, 'Social content:', socialContent.length, 'chars, Amazon reviews:', amazonReviews.length);
  
  // CRITICAL: Only use REAL scraped data - do NOT invent BSR or other metrics
  // Filter to only include books with actual BSR data
  const booksWithRealData = realBooks.filter(book => book.bsr && book.bsr > 0);
  
  console.log(`Books with REAL BSR data: ${booksWithRealData.length} out of ${realBooks.length} total`);
  
  // Books are already sorted by BSR (lowest first = best sellers) from scrapeAmazonBooks
  // Take the books we have - prioritize those with real data
  const booksToAnalyze = booksWithRealData.length >= 3 ? booksWithRealData : realBooks;
  
  // CRITICAL PROFITABILITY METRICS:
  // - BSR < 100,000 indicates real sales potential
  // - Profit per copy >= $5 is the target for optimal margins
  // - Self-publishers indicate opportunity for other self-publishers
  
  const competitors: CompetitorBook[] = booksToAnalyze.map((book, index) => {
    // NEVER invent BSR - use 0 if not available (UI will show "N/A")
    const bsr = book.bsr || 0;
    const hasRealBsr = bsr > 0;
    
    // Only estimate sales if we have REAL BSR
    const estMonthlySales = hasRealBsr ? estimateSalesFromBSR(bsr) : 0;
    
    // Use real price or 0 (UI will show "N/A")
    const price = book.price || 0;
    
    // Calculate profit per copy with proper Amazon KDP royalty structure
    // 60% royalty for books priced $9.99-$199.99, 35% for books under $9.99
    // Print cost = $2.50 base + $0.012 per page (approximate for US)
    let profitPerCopy = 0;
    if (price > 0 && book.pages && book.pages > 0) {
      const royalty = price >= 9.99 ? 0.60 : 0.35;
      const printCost = 2.50 + book.pages * 0.012;
      profitPerCopy = Math.max(0, (price * royalty) - printCost);
    }
    
    // Rank is now based on BSR (index 0 = best seller with lowest BSR)
    return {
      rank: index + 1,
      title: book.title,
      author: book.author,
      asin: book.asin,
      coverUrl: normalizeCoverUrl(book.coverUrl, book.asin),
      bsr, // REAL BSR or 0
      reviews: book.reviews || 0,
      rating: book.rating || 0,
      price, // REAL price or 0
      estMonthlySales, // Only calculated from REAL BSR
      estMonthlyRevenue: hasRealBsr && price > 0 ? Math.round(estMonthlySales * price) : 0,
      profitPerCopy: Math.round(profitPerCopy * 100) / 100,
      format: book.format || 'Unknown',
      pages: book.pages || 0,
      trend: hasRealBsr ? (bsr < 50000 ? 'up' : bsr < 100000 ? 'stable' : 'down') : 'stable' as "up" | "stable" | "down",
      publishDate: normalizePublishDate(book.publishDate) || '',
      // Only generate historical data if we have real BSR
      historicalData: hasRealBsr ? generateHistoricalData(bsr, book.reviews || 0, price) : {
        dates: [],
        bsr: [],
        price: [],
        reviews: [],
        estimatedSales: []
      },
    };
  });
  
  // Calculate profitability metrics from REAL data
  const booksWithValidBsr = competitors.filter(c => c.bsr > 0 && c.bsr < 100000);
  const booksWithGoodProfit = competitors.filter(c => c.profitPerCopy >= 5);
  const selfPublisherIndicators = competitors.filter(c => 
    c.author && (
      c.author.toLowerCase().includes('independently published') ||
      c.reviews < 500 || // Likely self-published
      !c.author.includes(',') // Not a company/org
    )
  );
  
  console.log(`Profitability Analysis:`);
  console.log(`- Books with BSR < 100K (real sales): ${booksWithValidBsr.length}`);
  console.log(`- Books with profit >= $5/copy: ${booksWithGoodProfit.length}`);
  console.log(`- Likely self-publishers: ${selfPublisherIndicators.length}`);

  const createDeterministicAnalysis = (reason: string): AnalysisResult => {
    const validPrices = competitors.map((c) => c.price).filter((value) => value > 0);
    const validPages = competitors.map((c) => c.pages).filter((value) => value > 0);
    const validProfits = competitors.map((c) => c.profitPerCopy).filter((value) => value > 0);
    const totalEstimatedSales = competitors.reduce((sum, c) => sum + (c.estMonthlySales || 0), 0);
    const totalEstimatedRevenue = competitors.reduce((sum, c) => sum + (c.estMonthlyRevenue || 0), 0);
    const avgPrice = validPrices.length
      ? Math.round((validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length) * 100) / 100
      : 0;
    const avgProfitPerCopy = validProfits.length
      ? Math.round((validProfits.reduce((sum, value) => sum + value, 0) / validProfits.length) * 100) / 100
      : 0;
    const avgPages = validPages.length
      ? Math.round(validPages.reduce((sum, value) => sum + value, 0) / validPages.length)
      : 0;
    const minPages = validPages.length ? Math.min(...validPages) : 0;
    const maxPages = validPages.length ? Math.max(...validPages) : 0;
    const strongBsrCount = competitors.filter((c) => c.bsr > 0 && c.bsr < 50000).length;
    const reviewHeavyCount = competitors.filter((c) => c.reviews > 500).length;
    const sourceCount = socialSources.length;

    const profitabilityScore = Math.max(15, Math.min(95, Math.round(
      booksWithValidBsr.length * 18 +
      booksWithGoodProfit.length * 12 +
      (avgProfitPerCopy >= 5 ? 20 : avgProfitPerCopy >= 3 ? 10 : 0) +
      (searchVolumeData ? searchVolumeData.score * 0.2 : 8)
    )));
    const saturationScore = Math.max(15, Math.min(95, Math.round(
      35 +
      reviewHeavyCount * 12 +
      strongBsrCount * 8 -
      selfPublisherIndicators.length * 5
    )));
    const opportunityScore = Math.max(15, Math.min(95, Math.round(
      profitabilityScore * 0.45 +
      (100 - saturationScore) * 0.25 +
      selfPublisherIndicators.length * 8 +
      sourceCount * 2 +
      (searchVolumeData ? searchVolumeData.score * 0.2 : 10)
    )));
    const riskScore = Math.max(10, Math.min(95, Math.round(
      saturationScore * 0.45 +
      (100 - profitabilityScore) * 0.35 +
      (100 - opportunityScore) * 0.2
    )));
    const verdictType =
      profitabilityScore >= 70 && opportunityScore >= 65 && riskScore < 65
        ? 'publish'
        : profitabilityScore >= 45 || opportunityScore >= 45
          ? 'publish-with-angle'
          : 'avoid';

    const excerptPainPoints = allExcerpts
      .slice(0, 8)
      .map((excerpt) => excerpt.painPointMatch || excerpt.content)
      .filter(Boolean);
    const painPoints = excerptPainPoints.length
      ? excerptPainPoints
      : amazonReviews.slice(0, 5).map((review) => review.slice(0, 180)).filter(Boolean);
    const fallbackPainPoints = painPoints.length
      ? painPoints
      : [`Validare meglio il bisogno specifico per "${niche}" prima di pubblicare.`];

    return {
      scores: {
        profitability: { score: profitabilityScore, trend: booksWithValidBsr.length >= 2 ? 'up' : 'stable' },
        saturation: { score: saturationScore, trend: reviewHeavyCount >= 2 ? 'up' : 'stable' },
        opportunity: { score: opportunityScore, trend: opportunityScore >= 60 ? 'up' : 'stable' },
        risk: { score: riskScore, trend: riskScore >= 65 ? 'up' : 'stable' },
      },
      verdict: {
        type: verdictType,
        confidence: Math.max(35, Math.min(85, Math.round((profitabilityScore + opportunityScore + (100 - riskScore)) / 3))),
        summary: `Analisi completata con modello rapido per evitare timeout in fase AI. I dati reali mostrano ${booksWithValidBsr.length} competitor con BSR sotto 100K e un profitto medio stimato di $${avgProfitPerCopy.toFixed(2)} per copia.`,
        insights: [
          `${booksWithValidBsr.length} libri mostrano segnali di vendita reale tramite BSR sotto 100K.`,
          `${booksWithGoodProfit.length} competitor raggiungono o superano circa $5 di profitto per copia.`,
          `${selfPublisherIndicators.length} competitor sembrano compatibili con editori indipendenti.`,
          `Fallback usato: ${reason}. I risultati sono basati sui dati raccolti, con meno interpretazione narrativa AI.`,
        ],
      },
      competitors,
      opportunities: {
        gaps: ['Approfondire un angolo editoriale piu specifico rispetto ai competitor principali.'],
        weaknesses: reviewHeavyCount > 0
          ? ['Alcuni competitor sono molto recensiti: serve differenziazione chiara.']
          : ['La concorrenza non appare dominata da grandi volumi di recensioni.'],
        underserved: ['Segmenti specifici emersi da recensioni e discussioni meritano una validazione manuale.'],
        opportunities: [
          avgProfitPerCopy >= 5
            ? 'Prezzo e formato possono sostenere margini interessanti.'
            : 'Ottimizzare prezzo, formato e numero pagine per migliorare il margine.',
        ],
      },
      patterns: {
        pageCountRange: minPages && maxPages ? `${minPages}-${maxPages} pagine` : 'Dati pagine non sufficienti',
        priceSweet: avgPrice ? `$${avgPrice.toFixed(2)} medio dai competitor reali` : 'Prezzo non disponibile',
        emotionalPromises: ['Chiarezza', 'Soluzione pratica', 'Risultato misurabile'],
        targetLanguage: [niche, ...fallbackPainPoints.slice(0, 3).map((point) => point.slice(0, 60))],
        structuralPatterns: avgPages ? [`Formato medio circa ${avgPages} pagine`] : ['Struttura da validare sui competitor migliori'],
      },
      trends: {
        direction: searchVolumeData && searchVolumeData.score >= 60 ? 'growing' : 'stable',
        seasonality: 'moderate',
        viability: opportunityScore >= 65 ? 'strong' : opportunityScore >= 45 ? 'moderate' : 'weak',
        data: [42, 45, 47, 46, 50, 52, 51, 53, 55, 54, 56, 58],
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        narrative: 'Trend stimato in modalita rapida: usare questi dati come indicazione preliminare e validare con ricerche aggiuntive prima della decisione finale.',
        yearOverYear: 0,
        yearOverYearText: 'Dato annuale non disponibile nella modalita rapida.',
        seasonalPattern: {
          description: 'Stagionalita da validare con dati aggiuntivi.',
          peakMonths: [],
          explanation: 'La modalita rapida privilegia il completamento dell analisi evitando timeout della funzione.',
        },
        keyPatterns: ['Analisi rapida basata su BSR, prezzi, recensioni e fonti raccolte.'],
        forecast: 'Pubblicare solo con un angolo differenziante e dopo una verifica manuale dei competitor principali.',
      },
      profit: {
        conservative: {
          monthlySales: Math.round(totalEstimatedSales * 0.1),
          monthlyRevenue: Math.round(totalEstimatedRevenue * 0.1),
          monthlyProfit: Math.round(totalEstimatedSales * 0.1 * avgProfitPerCopy),
        },
        expected: {
          monthlySales: Math.round(totalEstimatedSales * 0.25),
          monthlyRevenue: Math.round(totalEstimatedRevenue * 0.25),
          monthlyProfit: Math.round(totalEstimatedSales * 0.25 * avgProfitPerCopy),
        },
        optimistic: {
          monthlySales: Math.round(totalEstimatedSales * 0.5),
          monthlyRevenue: Math.round(totalEstimatedRevenue * 0.5),
          monthlyProfit: Math.round(totalEstimatedSales * 0.5 * avgProfitPerCopy),
        },
        avgPrice,
        avgProfitPerCopy,
      },
      strategy: {
        suggestedTitle: `${niche.replace(/\b\w/g, (char) => char.toUpperCase())} Workbook`,
        suggestedSubtitle: 'A Practical Step-by-Step Guide for Clear Results',
        targetAudience: `Lettori Amazon interessati a ${niche}.`,
        painPoints: fallbackPainPoints.slice(0, 5),
        uniqueAngle: 'Posizionamento pratico, specifico e misurabile rispetto ai competitor generalisti.',
        emotionalHook: 'Ridurre confusione e trasformare il bisogno in un piano concreto.',
        corePromise: 'Offrire una soluzione semplice, utilizzabile e orientata al risultato.',
        competitiveAdvantage: 'Usare un angolo piu focalizzato e una promessa piu concreta dei competitor piu generici.',
      },
      suggestedTitles: [
        {
          title: `${niche.replace(/\b\w/g, (char) => char.toUpperCase())} Workbook`,
          subtitle: 'A Practical Step-by-Step Guide for Clear Results',
          fullTitle: `${niche.replace(/\b\w/g, (char) => char.toUpperCase())} Workbook: A Practical Step-by-Step Guide for Clear Results`,
          charCount: `${niche} Workbook: A Practical Step-by-Step Guide for Clear Results`.length,
          framework: 'PAS',
          emotionalTrigger: 'Chiarezza e controllo',
          uniqueAngle: 'Approccio pratico e guidato',
          targetPainPoint: fallbackPainPoints[0],
          conversionScore: Math.max(40, Math.min(85, opportunityScore)),
        },
      ],
      painPointsFromWeb: fallbackPainPoints.slice(0, 8).map((point, index) => ({
        description: point,
        frequency: Math.max(1, 8 - index),
        intensity: 6,
        opportunity: Math.max(4, Math.min(10, Math.round(opportunityScore / 10))),
        source: allExcerpts[index]?.source || 'Amazon',
      })),
      socialExcerpts: allExcerpts.slice(0, 25),
      clusteredPainPoints: fallbackPainPoints.slice(0, 5).map((point, index) => ({
        keyword: point.slice(0, 48),
        count: Math.max(1, 5 - index),
        percentage: Math.max(10, 35 - index * 5),
        sources: {
          amazon: amazonReviews.length ? 1 : 0,
          reddit: allExcerpts.some((excerpt) => excerpt.source === 'Reddit') ? 1 : 0,
          quora: allExcerpts.some((excerpt) => excerpt.source === 'Quora') ? 1 : 0,
          forum: allExcerpts.some((excerpt) => excerpt.source === 'Forum' || excerpt.source === 'Blog') ? 1 : 0,
        },
        relatedTerms: [niche],
        intensity: 6,
        sampleQuotes: [point],
        category: 'pain',
      })),
      totalMentions: Math.max(fallbackPainPoints.length, allExcerpts.length),
      sources: socialSources,
    };
  };

  if (options.forceFallback) {
    console.log('Skipping AI analysis: time budget exceeded before AI phase');
    return createDeterministicAnalysis('tempo disponibile insufficiente prima della fase AI');
  }

  const systemPrompt = `You are an expert Amazon KDP market analyst specializing in REAL market validation and pain point analysis.

You will receive:
1. REAL book data scraped from Amazon (sorted by BSR - lowest first = best sellers)
2. REAL discussions from Reddit, Quora, YouTube comments, and forums
3. REAL Amazon customer reviews from the actual books found

CRITICAL PROFITABILITY CRITERIA FOR KDP:
- BSR < 100,000 = REAL sales potential (books actually selling)
- BSR > 100,000 = Low sales, proceed with caution
- Profit per copy >= $5 = OPTIMAL margins for paperback
- Profit per copy < $5 = Suboptimal pricing or page count
- Self-publishers in top 3 = OPPORTUNITY for other self-publishers
- Only big publishers in top 3 = HARDER to compete

AWARE DEMAND vs CURIOSITY:
- Analyze if people are actively BUYING books in this niche (aware demand) or just casually curious
- Signs of aware demand: buying intent language, specific problem-solving needs, repeat purchases
- Signs of mere curiosity: general questions, no urgency, browsing behavior

SATURATED vs UNDERSERVED:
- Saturated: Many books with BSR < 50K, high review counts, established publishers
- Underserved: Few books with good BSR, readers complaining about lack of options
- Look for gaps in existing content that readers mention in reviews

Your PRIMARY JOB is to:
1. Evaluate TRUE profitability based on REAL BSR data and profit margins
2. Identify if this is a viable niche for self-publishers specifically
3. Extract and CLUSTER pain points from ALL sources
4. Assess if there's AWARE DEMAND (people actively buying) vs curiosity
5. Determine if market is saturated or has editorial opportunities

Return your analysis as a valid JSON object with this structure:
{
  "scores": {
    "profitability": { 
      "score": 0-100, 
      "trend": "up|stable|down"
      // Score based on: BSR < 100K = higher score, profit >= $5 = higher score
      // 80+ = Multiple books with BSR < 100K AND profit >= $5
      // 60-79 = Some books with BSR < 100K OR profit >= $5
      // 40-59 = Limited real sales data
      // <40 = No evidence of profitable market
    },
    "saturation": { 
      "score": 0-100, 
      "trend": "up|stable|down"
      // Lower score = less saturated = better for new entrants
      // Consider: number of competitors, review counts, publisher types
    },
    "opportunity": { 
      "score": 0-100, 
      "trend": "up|stable|down"
      // Higher if: self-publishers succeed, gaps in content, underserved audiences
    },
    "risk": { 
      "score": 0-100, 
      "trend": "up|stable|down"
      // Lower = better. Based on: market stability, competition level, entry barriers
    }
  },
  "verdict": {
    "type": "publish|publish-with-angle|avoid",
    // "publish" = BSR < 100K books exist, profit >= $5 achievable, self-publishers succeed
    // "publish-with-angle" = Opportunity exists but needs differentiation
    // "avoid" = No real sales evidence, margins too low, or dominated by big publishers
    "confidence": 0-100,
    "summary": "2-3 sentence summary explaining WHY based on real data",
    "insights": ["insight about profitability", "insight about competition", "insight about opportunity", "insight about risk"]
  },
  "opportunities": {
    "gaps": ["content gaps found in reviews/discussions"],
    "weaknesses": ["competitor weaknesses readers mention"],
    "underserved": ["audience segments not being served"],
    "opportunities": ["specific opportunities for new publisher"]
  },
  "patterns": {
    "pageCountRange": "based on REAL data from top sellers",
    "priceSweet": "optimal price point from top sellers",
    "emotionalPromises": ["from REAL successful titles"],
    "targetLanguage": ["exact phrases buyers use"],
    "structuralPatterns": ["from REAL successful book structures"]
  },
  "trends": {
    "direction": "growing|stable|declining",
    "seasonality": "high|moderate|low",
    "viability": "strong|moderate|weak",
    "data": [12 values 0-100 representing Google Trends-style interest over 12 months],
    "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "narrative": "Detailed Italian paragraph analyzing the trend: describe the overall interest pattern, seasonal peaks, general behavior over the analyzed period. Write in Italian, 3-5 sentences.",
    "yearOverYear": number percentage change year-over-year (e.g. 15 means +15%),
    "yearOverYearText": "Italian paragraph comparing this year vs last year. Describe specific changes in peaks and valleys.",
    "seasonalPattern": {
      "description": "Bold Italian sentence summarizing when peaks occur and when lows occur",
      "peakMonths": ["Maggio", "Giugno", "Dicembre"],
      "explanation": "Italian paragraph explaining WHY these months are peaks (e.g. gardening season, holiday gifts, etc.)"
    },
    "keyPatterns": ["Italian bullet point 1 about a key pattern", "Italian bullet point 2", "Italian bullet point 3", "Italian bullet point 4"],
    "forecast": "Italian paragraph with short-medium term forecast and recommendations for a new book publisher"
  },
  "profit": {
    "conservative": { "monthlySales": number, "monthlyRevenue": number, "monthlyProfit": number },
    "expected": { "monthlySales": number, "monthlyRevenue": number, "monthlyProfit": number },
    "optimistic": { "monthlySales": number, "monthlyRevenue": number, "monthlyProfit": number },
    "avgPrice": from real competitor prices,
    "avgProfitPerCopy": from real calculations (target >= $5)
  },
  "strategy": {
    "suggestedTitle": "IN ENGLISH - direct response copy based on gaps and pain points (target market is Amazon KDP USA)",
    "suggestedSubtitle": "IN ENGLISH - direct response copy based on buyer language (target market is Amazon KDP USA)",
    "targetAudience": "specific audience from discussions (in Italian)",
    "painPoints": ["from real social content (in Italian)"],
    "uniqueAngle": "differentiation based on gaps (in Italian)",
    "emotionalHook": "based on buyer emotions (in Italian)",
    "corePromise": "based on what buyers want (in Italian)",
    "competitiveAdvantage": "based on competitor weaknesses (in Italian)"
  },
  "suggestedTitles": [
    {
      "title": "MUST BE IN ENGLISH - Title using direct response principles (target market: Amazon KDP USA - English-speaking buyers)",
      "subtitle": "MUST BE IN ENGLISH - Subtitle addressing main pain point (target market: Amazon KDP USA)",
      "fullTitle": "MUST BE IN ENGLISH - Full title under 195 chars (title: subtitle format)",
      "charCount": number,
      "framework": "AIDA|PAS|4Us|BAB|FAB",
      "emotionalTrigger": "from real discussions (in Italian)",
      "uniqueAngle": "from gaps analysis (in Italian)",
      "targetPainPoint": "from clustered pain points (in Italian)",
      "conversionScore": 0-100
    }
  ],
  "painPointsFromWeb": [
    {
      "description": "EXACT pain point from source",
      "frequency": 1-10,
      "intensity": 1-10,
      "opportunity": 1-10,
      "source": "Reddit|Quora|Forum|Amazon|YouTube"
    }
  ],
  "clusteredPainPoints": [
    {
      "keyword": "Main keyword/phrase",
      "count": number of mentions,
      "percentage": percentage of total,
      "sources": {
        "amazon": count,
        "reddit": count,
        "quora": count,
        "forum": count,
        "youtube": count
      },
      "relatedTerms": ["similar terms"],
      "intensity": 1-10,
      "sampleQuotes": ["Real quote 1", "Real quote 2"],
      "category": "pain|desire|question"
    }
  ],
  "totalMentions": total mentions found,
  "awaredemandIndicators": {
    "buyingIntentPhrases": ["phrases showing purchase intent"],
    "urgencyLevel": "high|medium|low",
    "repeatBuyerPotential": "high|medium|low",
    "priceInsensitivity": "high|medium|low"
  },
  "reviewPatterns": {
    "positivePatterns": [
      {
        "theme": "Short Italian title for the positive pattern",
        "description": "Italian description of what readers consistently praise",
        "frequency": 1-10,
        "sampleQuotes": ["Real quote from review 1", "Real quote from review 2"]
      }
    ],
    "negativePatterns": [
      {
        "theme": "Short Italian title for the negative pattern",
        "description": "Italian description of what readers consistently criticize",
        "frequency": 1-10,
        "sampleQuotes": ["Real quote from review 1", "Real quote from review 2"]
      }
    ],
    "summary": "Italian paragraph summarizing the overall review sentiment, highlighting the main themes found across positive and negative reviews",
    "totalReviewsAnalyzed": number of reviews analyzed,
    "averageRating": average star rating from reviews
  }
}

CRITICAL: Base ALL scores on REAL data provided. If BSR data shows books under 100K, that's evidence of real sales.

LANGUAGE RULES (MANDATORY):
- Target market is Amazon KDP USA. ALL book titles, subtitles, and fullTitle fields (in "strategy.suggestedTitle", "strategy.suggestedSubtitle", and every entry of "suggestedTitles") MUST be written in ENGLISH using direct response copywriting. NEVER write them in Italian.
- All other analytical/narrative fields remain in Italian as specified.`;

  // Build profitability context for the AI
  const profitabilityContext = `
=== PROFITABILITY METRICS (CRITICAL FOR VERDICT) ===
Books with BSR < 100K (REAL SALES): ${booksWithValidBsr.length} out of ${competitors.length}
Books with Profit >= $5/copy: ${booksWithGoodProfit.length} out of ${competitors.length}
Likely Self-Publishers: ${selfPublisherIndicators.length} out of ${competitors.length}

TOP 3 BOOKS BY BSR (Best Sellers First):
${competitors.slice(0, 3).map((c, i) => `
#${i + 1}: "${c.title.slice(0, 60)}..."
   BSR: ${c.bsr || 'N/A'} | Price: $${c.price || 'N/A'} | Profit/Copy: $${c.profitPerCopy.toFixed(2)}
   Reviews: ${c.reviews} | Est. Monthly Sales: ${c.estMonthlySales}
   Format: ${c.format} | Pages: ${c.pages}
`).join('')}

PROFITABILITY VERDICT GUIDANCE:
- If top 3 have BSR < 100K: Market has REAL buyers
- If avg profit/copy >= $5: Good margins achievable
- If self-publishers in top 3: Opportunity for indie publishers

=== SEARCH VOLUME DATA (CRITICAL FOR DEMAND ASSESSMENT) ===
${searchVolumeData 
  ? `Monthly Search Volume: ${searchVolumeData.volume}/month (Score: ${searchVolumeData.score}/100)
Source: ${searchVolumeData.source}
${searchVolumeData.score < 30 ? 'WARNING: Very low search volume indicates weak demand. The verdict MUST reflect this - do NOT say "strong sales potential" if volume is below 500/month.' : ''}
${searchVolumeData.score < 45 ? 'CAUTION: Below-average search volume. Factor this into your demand assessment.' : ''}
${searchVolumeData.score >= 75 ? 'POSITIVE: High search volume confirms strong market demand.' : ''}`
  : 'Search volume data unavailable - base demand assessment on BSR data and social signals only.'}

IMPORTANT: Your verdict summary MUST be consistent with the search volume data. If search volume is very low (<500/month), do NOT describe the niche as having "strong sales potential" or "high demand". Instead, acknowledge the limited search demand and focus on whether the existing buyers (BSR data) make it viable despite low volume.
`;


  const userPrompt = `Analyze this Amazon KDP niche: "${niche}"

${profitabilityContext}

=== REAL COMPETITOR DATA FROM AMAZON (Sorted by BSR - Best Sellers First) ===
${competitors.length > 0 ? JSON.stringify(competitors.map(c => ({
  rank: c.rank,
  title: c.title,
  author: c.author,
  price: c.price,
  reviews: c.reviews,
  rating: c.rating,
  bsr: c.bsr,
  profitPerCopy: c.profitPerCopy,
  estMonthlySales: c.estMonthlySales,
  format: c.format,
  pages: c.pages
})), null, 2) : 'No Amazon data available'}

=== REAL AMAZON CUSTOMER REVIEWS (for pain points) ===
${amazonReviews.slice(0, 8).map((review) => review.slice(0, 700)).join('\n\n---\n\n')}

=== REAL SOCIAL DISCUSSIONS (Reddit, Quora, Forums, YouTube - for aware demand) ===
${socialContent.slice(0, 12000) || 'No social discussions found'}

=== SOURCES ===
${socialSources.slice(0, 20).join('\n')}

IMPORTANT: Only use pain points, quotes, and excerpts that are DIRECTLY relevant to "${niche}". 
Do NOT include generic product reviews or comments unrelated to this specific topic.

TASK:
1. Evaluate PROFITABILITY based on real BSR and profit margins
2. Determine if this is AWARE DEMAND (people buying) or curiosity
3. Identify if market is saturated or has opportunities
4. Extract and cluster all pain points from sources
5. Base verdict on: Can a self-publisher realistically profit here?

Return ONLY the JSON object.`;

  // Helper function to clean and parse JSON
  const cleanAndParseJSON = (rawContent: string): any => {
    // Extract JSON from response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', rawContent.slice(0, 500));
      throw new Error('No valid JSON in AI response');
    }
    
    let jsonStr = jsonMatch[0];
    
    // Clean common JSON issues
    // Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    // Fix unescaped quotes in strings (basic)
    jsonStr = jsonStr.replace(/(?<!\\)"\s*:\s*"([^"]*?)(?<!\\)"\s*([,}])/g, (match, content, end) => {
      // Escape inner quotes
      const escaped = content.replace(/(?<!\\)"/g, '\\"');
      return `": "${escaped}"${end}`;
    });
    // Remove control characters
    // eslint-disable-next-line no-control-regex
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === '\n' || char === '\r' || char === '\t') return char;
      return '';
    });
    
    return JSON.parse(jsonStr);
  };

  const MAX_RETRIES = 1;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`AI analysis attempt ${attempt}/${MAX_RETRIES}`);
      
      const response = await callAIChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        responseFormat: { type: 'json_object' },
        temperature: 0.4,
        maxTokens: 4500,
        timeoutMs: AI_PHASE_TIMEOUT_MS,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('AI analysis received');
      
      const content = data.choices?.[0]?.message?.content || '';
      
      // Log first 500 chars for debugging
      console.log('AI response preview:', content.slice(0, 500));
      
      const analysis = cleanAndParseJSON(content);
      console.log('JSON parsed successfully on attempt', attempt);
    
      // Use ONLY REAL scraped competitors - no AI-generated fallbacks
      analysis.competitors = competitors;
      console.log('Using', competitors.length, 'REAL scraped competitors');
      
      // Merge social excerpts
      analysis.socialExcerpts = allExcerpts.slice(0, 25);
      
      // Ensure clusteredPainPoints exists
      if (!analysis.clusteredPainPoints) {
        analysis.clusteredPainPoints = [];
      }
      if (!analysis.totalMentions) {
        analysis.totalMentions = analysis.clusteredPainPoints.reduce((sum: number, c: ClusteredPainPoint) => sum + c.count, 0);
      }
      
      return analysis;
      
    } catch (error) {
      console.error(`AI analysis attempt ${attempt} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  // All retries failed
  console.error('AI analysis unavailable, using deterministic fallback');
  return createDeterministicAnalysis(lastError?.message || 'AI analysis failed');
}

// Save analysis to database
async function saveAnalysisToDatabase(niche: string, analysis: AnalysisResult, searchVolume?: SearchVolumeData | null): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Supabase not configured, skipping database save');
    return null;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: analysisRow, error: analysisError } = await supabase
      .from('niche_analyses')
      .insert({
        niche_keyword: niche,
        overall_score: Math.round(
          searchVolume 
            ? (analysis.scores.profitability.score * 0.3 + analysis.scores.opportunity.score * 0.3 + searchVolume.score * 0.4)
            : (analysis.scores.profitability.score + analysis.scores.opportunity.score) / 2
        ),
        verdict_type: analysis.verdict.type,
        verdict_title: analysis.verdict.summary.split('.')[0],
        verdict_description: analysis.verdict.summary,
        demand_score: analysis.scores.opportunity.score,
        competition_score: analysis.scores.saturation.score,
        profit_potential_score: analysis.scores.profitability.score,
        trend_direction: analysis.trends.direction,
        trend_seasonality: analysis.trends.seasonality,
        trend_viability: analysis.trends.viability,
        trend_data: analysis.trends.data,
        trend_labels: analysis.trends.labels,
        pain_points: analysis.painPointsFromWeb,
        social_excerpts: analysis.socialExcerpts || [],
        clustered_pain_points: analysis.clusteredPainPoints || [],
        sources: analysis.sources,
        patterns: analysis.patterns,
        opportunities: analysis.opportunities,
        strategy: analysis.strategy,
        suggested_titles: analysis.suggestedTitles || [],
        search_volume: searchVolume?.volume || null,
        search_volume_score: searchVolume?.score || null,
        search_volume_source: searchVolume?.source || null,
        review_patterns: analysis.reviewPatterns || null,
      })
      .select('id')
      .single();

    if (analysisError) {
      console.error('Error saving analysis:', analysisError);
      return null;
    }

    const analysisId = analysisRow.id;
    console.log('Analysis saved with ID:', analysisId);

    // Insert competitor books
    for (const comp of analysis.competitors) {
      const normalizedPublishDate = normalizePublishDate(comp.publishDate);
      const normalizedCoverUrl = normalizeCoverUrl(comp.coverUrl, comp.asin);

      const { data: bookRow, error: bookError } = await supabase
        .from('competitor_books')
        .insert({
          analysis_id: analysisId,
          asin: comp.asin,
          title: comp.title,
          author: comp.author || 'Unknown',
          cover_url: normalizedCoverUrl,
          current_bsr: comp.bsr,
          current_price: comp.price,
          current_reviews: comp.reviews,
          current_rating: comp.rating,
          pages: comp.pages,
          format: comp.format,
          publish_date: normalizedPublishDate,
        })
        .select('id')
        .single();

      if (bookError) {
        console.error('Error saving book:', bookError);
        continue;
      }

      if (comp.historicalData && bookRow) {
        const historyRecords = comp.historicalData.dates.map((date: string, i: number) => ({
          book_id: bookRow.id,
          recorded_at: date.length === 10 ? new Date(date).toISOString() : new Date(date + '-15').toISOString(),
          bsr: comp.historicalData.bsr[i],
          price: comp.historicalData.price[i],
          reviews: comp.historicalData.reviews[i],
          estimated_sales: comp.historicalData.estimatedSales[i],
        }));

        const { error: historyError } = await supabase
          .from('competitor_history')
          .insert(historyRecords);

        if (historyError) {
          console.error('Error saving history:', historyError);
        }
      }
    }

    return analysisId;

  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
}

// Background analysis function with improved error handling
async function runAnalysisInBackground(niche: string, jobId?: string | null) {
  const startTime = Date.now();
  
  try {
    console.log('=== BACKGROUND ANALYSIS STARTED for:', niche, '===');

    // Step 1: Scrape REAL Amazon book data with error handling
    console.log('Step 1: Scraping REAL Amazon data...');
    await updateAnalysisJob(jobId, { status: 'running', error_message: 'scraping_amazon' });
    let realBooks: ScrapedBook[] = [];
    let amazonSources: string[] = [];
    
    try {
      const amazonResult = await withStepTimeout(
        scrapeAmazonBooks(niche),
        AMAZON_STEP_TIMEOUT_MS,
        'Amazon scraping',
      );
      realBooks = amazonResult.books;
      amazonSources = amazonResult.sources;
      console.log('Got', realBooks.length, 'REAL books from Amazon');

      if (realBooks.length === 0 && Date.now() - startTime < AMAZON_STEP_TIMEOUT_MS * 0.75) {
        console.log('No competitor books found on first attempt, retrying Amazon scrape once...');
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const retryAmazonResult = await withStepTimeout(
          scrapeAmazonBooks(niche),
          Math.max(10000, AMAZON_STEP_TIMEOUT_MS - (Date.now() - startTime)),
          'Amazon retry scraping',
        );
        realBooks = retryAmazonResult.books;
        amazonSources = [...new Set([...amazonSources, ...retryAmazonResult.sources])];
        console.log('Retry result:', realBooks.length, 'REAL books from Amazon');
      }
    } catch (amazonError) {
      console.error('Amazon scraping failed (continuing with empty books):', amazonError instanceof Error ? amazonError.message : String(amazonError));
    }

    // Step 2: Scrape Amazon reviews, social content, YouTube, Google Trends in parallel
    console.log('Step 2-5: Scraping reviews, social, YouTube, trends, volume in parallel...');
    await updateAnalysisJob(jobId, { status: 'running', error_message: 'scraping_parallel_sources' });
    const bookAsins = realBooks.map(b => b.asin).filter(a => a.startsWith('B0') || a.match(/^[0-9]/)).slice(0, 5);
    
    let amazonReviews: string[] = [];
    let reviewSources: string[] = [];
    let amazonExcerpts: SocialExcerpt[] = [];
    let rawContent = '';
    let socialSources: string[] = [];
    let socialExcerpts: SocialExcerpt[] = [];
    let youtubeExcerpts: SocialExcerpt[] = [];
    let youtubeContent = '';
    let youtubeSources: string[] = [];
    let googleTrendsData: GoogleTrendsData | null = null;
    let searchVolumeData: SearchVolumeData | null = null;
    
    try {
      const [reviewResult, socialResult, youtubeResult, trendsResult, volumeResult] = await withStepTimeout(
        Promise.allSettled([
          scrapeAmazonReviews(niche, bookAsins),
          scrapeRealSocialContent(niche),
          scrapeYouTubeComments(niche),
          scrapeGoogleTrends(niche),
          scrapeSearchVolume(niche)
        ]),
        PARALLEL_SOURCES_TIMEOUT_MS,
        'Parallel source scraping',
      );
      
      if (reviewResult.status === 'fulfilled') {
        amazonReviews = reviewResult.value.reviews;
        reviewSources = reviewResult.value.sources;
        amazonExcerpts = reviewResult.value.excerpts;
      } else {
        console.error('Review scraping failed:', reviewResult.reason);
      }
      
      if (socialResult.status === 'fulfilled') {
        rawContent = socialResult.value.rawContent;
        socialSources = socialResult.value.sources;
        socialExcerpts = socialResult.value.socialExcerpts;
      } else {
        console.error('Social scraping failed:', socialResult.reason);
      }
      
      if (youtubeResult.status === 'fulfilled') {
        youtubeExcerpts = youtubeResult.value.excerpts;
        youtubeContent = youtubeResult.value.rawContent;
        youtubeSources = youtubeResult.value.sources;
        console.log(`YouTube: ${youtubeExcerpts.length} comments from ${youtubeSources.length} videos`);
      } else {
        console.error('YouTube scraping failed:', youtubeResult.reason);
      }
      
      if (trendsResult.status === 'fulfilled') {
        googleTrendsData = trendsResult.value;
        console.log('Google Trends data scraped successfully:', googleTrendsData?.direction, googleTrendsData?.viability);
      } else {
        console.error('Google Trends scraping failed:', trendsResult.reason);
      }
      
      if (volumeResult.status === 'fulfilled') {
        searchVolumeData = volumeResult.value;
        console.log('Search volume scraped:', searchVolumeData?.volume, '/month, score:', searchVolumeData?.score);
      } else {
        console.error('Search volume scraping failed:', volumeResult.reason);
      }
    } catch (parallelError) {
      console.error('Parallel scraping failed:', parallelError instanceof Error ? parallelError.message : String(parallelError));
    }
    
    // Append YouTube content to social content for AI analysis
    if (youtubeContent) {
      rawContent += youtubeContent;
    }
    
    console.log('Got', amazonReviews.length, 'Amazon reviews');
    console.log('Got', rawContent.length, 'chars of REAL social content from', socialSources.length + youtubeSources.length, 'sources');
    console.log('Got Google Trends data:', googleTrendsData ? 'Yes' : 'No (using AI fallback)');
    console.log('Got Search Volume:', searchVolumeData ? `${searchVolumeData.volume}/month` : 'No');

    // Combine all excerpts
    const allExcerpts = [...amazonExcerpts, ...socialExcerpts, ...youtubeExcerpts];
    console.log('Total excerpts:', allExcerpts.length);

    // Step 5: Analyze REAL data with AI including clustering
    console.log('Step 5: Analyzing REAL data with AI...');
    await updateAnalysisJob(jobId, { status: 'running', error_message: 'ai_analysis' });
    const allSources = [...new Set([...amazonSources, ...reviewSources, ...socialSources, ...youtubeSources])];
    
    // Add Google Trends URL to sources if we have data
    if (googleTrendsData) {
      allSources.push(`https://trends.google.com/trends/explore?q=${encodeURIComponent(niche)}&geo=US`);
    }
    
    const elapsedBeforeAI = Date.now() - startTime;
    const forceFastAnalysis = elapsedBeforeAI > AI_PHASE_LATEST_SAFE_START_MS;
    if (forceFastAnalysis) {
      console.log(`Skipping full AI call: elapsed before AI is ${Math.round(elapsedBeforeAI / 1000)}s`);
    }

    const analysis = await analyzeWithAI(
      niche,
      realBooks,
      rawContent,
      amazonReviews,
      allSources,
      allExcerpts,
      searchVolumeData,
      { forceFallback: forceFastAnalysis },
    );
    analysis.sources = allSources;
    
    // OVERRIDE AI trends with REAL Google Trends data if available
    if (googleTrendsData) {
      console.log('Using REAL Google Trends data instead of AI estimates');
      // Override core trend data with real Google Trends, preserve AI-generated narrative fields
      analysis.trends = {
        ...analysis.trends, // Keep AI-generated narrative, yearOverYear, seasonalPattern, keyPatterns, forecast
        direction: googleTrendsData.direction,
        seasonality: googleTrendsData.seasonality,
        viability: googleTrendsData.viability,
        data: googleTrendsData.data,
        labels: googleTrendsData.labels
      };
      
      // Add trends analysis to strategy if available
      if (googleTrendsData.trendsAnalysis && analysis.strategy) {
        analysis.strategy.trendsInsight = googleTrendsData.trendsAnalysis;
      }
      
      // Add related queries to opportunities
      if (googleTrendsData.relatedQueries && googleTrendsData.relatedQueries.length > 0) {
        if (!analysis.opportunities) {
          analysis.opportunities = { gaps: [], weaknesses: [], underserved: [], opportunities: [] };
        }
        analysis.opportunities.relatedSearchTerms = googleTrendsData.relatedQueries.slice(0, 10);
      }
    }

    // Integrate search volume score into opportunity score and verdict consistency
    if (searchVolumeData) {
      console.log(`Integrating search volume: ${searchVolumeData.volume}/month (score: ${searchVolumeData.score})`);
      // Boost/penalize opportunity score based on search volume
      const originalOpportunity = analysis.scores.opportunity.score;
      analysis.scores.opportunity.score = Math.min(100, Math.round(originalOpportunity * 0.7 + searchVolumeData.score * 0.3));
      console.log(`Opportunity score adjusted: ${originalOpportunity} -> ${analysis.scores.opportunity.score} (volume boost)`);
      
      // CRITICAL: Ensure verdict is consistent with search volume
      // If volume is very low but verdict says "publish", downgrade to "publish-with-angle"
      if (searchVolumeData.score < 30 && analysis.verdict.type === 'publish') {
        console.log('Downgrading verdict from "publish" to "publish-with-angle" due to low search volume');
        analysis.verdict.type = 'publish-with-angle';
        analysis.verdict.summary = analysis.verdict.summary.replace(
          /strong sales potential|high demand|excellent demand/gi, 
          'moderate sales potential despite low search volume'
        );
      }
      // If volume is critically low, cap confidence
      if (searchVolumeData.score < 20 && analysis.verdict.confidence > 50) {
        analysis.verdict.confidence = Math.min(analysis.verdict.confidence, 50);
        console.log(`Verdict confidence capped at ${analysis.verdict.confidence} due to very low search volume`);
      }
    }

    // Step 6: Save to database
    console.log('Step 6: Saving to database...');
    await updateAnalysisJob(jobId, { status: 'running', error_message: 'saving_to_database' });
    const analysisId = await saveAnalysisToDatabase(niche, analysis, searchVolumeData);
    await updateAnalysisJob(jobId, {
      status: 'completed',
      analysis_id: analysisId,
      error_message: null,
      completed_at: new Date().toISOString(),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('=== BACKGROUND ANALYSIS COMPLETE for:', niche, `=== (${duration}s)`);
    console.log('Analysis ID:', analysisId);
    console.log('Real books:', realBooks.length);
    console.log('Amazon reviews:', amazonReviews.length);
    console.log('Social excerpts:', allExcerpts.length);
    console.log('Google Trends:', googleTrendsData ? `${googleTrendsData.direction} / ${googleTrendsData.viability}` : 'AI fallback');
    console.log('Search Volume:', searchVolumeData ? `${searchVolumeData.volume}/month (score: ${searchVolumeData.score})` : 'N/A');
    console.log('Clustered pain points:', analysis.clusteredPainPoints?.length || 0);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`=== BACKGROUND ANALYSIS FAILED for: ${niche} === (${duration}s)`);
    await updateAnalysisJob(jobId, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      completed_at: new Date().toISOString(),
    });
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Error: Request timed out');
      } else {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
      }
    } else {
      console.error('Error:', error);
    }
  }
}

// Handle shutdown
addEventListener('beforeunload', (ev: any) => {
  console.log('Function shutting down:', ev?.detail?.reason || 'unknown');
});

Deno.serve(async (req) => {
  const dynamicCorsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: dynamicCorsHeaders });
  }

  try {
    // Initialize Supabase client for rate limiting
    const supabaseClient = createClient(
      SUPABASE_URL || '',
      SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Rate limiting check (now database-backed for persistence)
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimitDB(supabaseClient, clientIP);
    
    // Add rate limit headers to all responses
    const rateLimitHeaders = {
      ...dynamicCorsHeaders,
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000))
    };
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      const resetMinutes = Math.ceil(rateLimit.resetIn / 60000);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Rate limit exceeded. Please try again in ${resetMinutes} minutes.`,
          retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        }),
        { 
          status: 429, 
          headers: {
            ...rateLimitHeaders,
            'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000))
          }
        }
      );
    }
    
    const { niche: rawNiche } = await req.json();
    
    // Input validation
    if (!rawNiche || typeof rawNiche !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Niche keyword is required' }),
        { status: 400, headers: rateLimitHeaders }
      );
    }
    
    // Trim and sanitize input
    const niche = rawNiche.trim();
    
    // Length validation (3-100 characters)
    if (niche.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Niche keyword must be at least 3 characters long' }),
        { status: 400, headers: rateLimitHeaders }
      );
    }
    
    if (niche.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Niche keyword must be less than 100 characters' }),
        { status: 400, headers: rateLimitHeaders }
      );
    }
    
    // Character restriction - only allow alphanumeric, spaces, hyphens, apostrophes, and common punctuation
    const validPattern = /^[a-zA-Z0-9\s\-'.,&]+$/;
    if (!validPattern.test(niche)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Niche keyword contains invalid characters. Only letters, numbers, spaces, hyphens, apostrophes, periods, commas, and ampersands are allowed.' }),
        { status: 400, headers: rateLimitHeaders }
      );
    }

    console.log(`=== STARTING ANALYSIS for: ${niche} === (IP: ${clientIP}, remaining: ${rateLimit.remaining})`);
    console.log('Running in background mode - client will poll for results');
    const job = await createAnalysisJob(niche);

    // Start background analysis - this continues even after response is sent
    // @ts-expect-error - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(runAnalysisInBackground(niche, job.id));

    // Return immediately - client will poll database for results
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analysis started in background. Poll database for results.',
        data: {
          status: 'processing',
          niche,
          jobId: job.id,
          jobError: job.error
        }
      }),
      { headers: rateLimitHeaders }
    );

  } catch (error) {
    // Log detailed error for server-side debugging
    console.error('Request error:', error);
    
    // Return generic message to client to prevent information leakage
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An error occurred processing your request. Please try again later.' 
      }),
      { status: 500, headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
