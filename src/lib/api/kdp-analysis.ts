import { supabase } from "@/integrations/supabase/client";
import { 
  calculateRoyalty, 
  calculateDailyEarnings, 
  estimateDailySalesFromBSR, 
  isLikelyColorBook, 
  estimatePageCount 
} from "@/lib/kdp-royalty-calculator";

export interface PainPoint {
  description: string;
  frequency: number;
  intensity: number;
  opportunity: number;
  source: string;
}

export interface SocialExcerpt {
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

export interface ClusteredPainPoint {
  keyword: string;
  count: number;
  percentage: number;
  sources: {
    amazon: number;
    reddit: number;
    quora: number;
    forum: number;
    youtube?: number;
  };
  relatedTerms: string[];
  intensity: number;
  sampleQuotes: string[];
  category: "pain" | "desire" | "question";
}

export interface SuggestedTitle {
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

export interface CompetitorBook {
  rank: number;
  title: string;
  author: string;
  asin: string;
  coverUrl: string;
  bsr: number;
  reviews: number;
  rating: number;
  price: number;
  estMonthlySales: number;
  estMonthlyRevenue: number;
  profitPerCopy: number;
  format: string;
  pages: number;
  trend: "up" | "stable" | "down";
  publishDate: string;
  historicalData: {
    dates: string[];
    bsr: number[];
    price: number[];
    reviews: number[];
    estimatedSales: number[];
    isProjection?: boolean;
  };
  // Enhanced strategic analysis fields
  angle?: string;
  targetAudience?: string;
  uniqueSellingPoint?: string;
}

export interface KeyInsight {
  type: "opportunity" | "pricing" | "risk" | "format" | "compliance";
  text: string;
}

export interface StrategicAngle {
  rank: number;
  title: string;
  subtitle: string;
  angle: string;
  targetAudience: string;
  painPointsAddressed: string[];
  competitiveAdvantage: string;
}

export interface TopPainPointAnalysis {
  rank: number;
  category: string;
  description: string;
  score: number;
  frequency: number;
  intensity: number;
  solvability: number;
  covered?: boolean;
}

export interface AnalysisData {
  scores: {
    profitability: { score: number; trend: "up" | "stable" | "down" };
    saturation: { score: number; trend: "up" | "stable" | "down" };
    opportunity: { score: number; trend: "up" | "stable" | "down" };
    risk: { score: number; trend: "up" | "stable" | "down" };
  };
  verdict: {
    type: "publish" | "publish-with-angle" | "avoid";
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
  };
  patterns: {
    pageCountRange: string;
    priceSweet: string;
    emotionalPromises: string[];
    targetLanguage: string[];
    structuralPatterns: string[];
  };
  trends: {
    direction: "growing" | "stable" | "declining";
    seasonality: "high" | "moderate" | "low";
    viability: "strong" | "moderate" | "weak";
    data: number[];
    labels: string[];
    yearOverYear?: number;
    yearOverYearText?: string;
    narrative?: string;
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
    dailyRoyaltyRange?: { min: number; max: number };
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
  };
  suggestedTitles: SuggestedTitle[];
  painPointsFromWeb: PainPoint[];
  socialExcerpts: SocialExcerpt[];
  clusteredPainPoints?: ClusteredPainPoint[];
  totalMentions?: number;
  sources: string[];
  analysisId?: string;
  niche?: string;
  // Review pattern analysis
  reviewPatterns?: {
    positivePatterns: { theme: string; description: string; frequency: number; sampleQuotes: string[] }[];
    negativePatterns: { theme: string; description: string; frequency: number; sampleQuotes: string[] }[];
    summary: string;
    totalReviewsAnalyzed: number;
    averageRating: number;
  } | null;
  // Search volume data
  searchVolume?: number | null;
  searchVolumeScore?: number | null;
  searchVolumeSource?: string | null;
  // Enhanced report fields
  keyInsights?: KeyInsight[];
  profitabilityLevel?: "high" | "medium" | "low";
  profitabilityDescription?: string;
  competitionLevel?: "high" | "medium" | "low";
  competitionDescription?: string;
  selfPublishedCount?: number;
  totalAnalyzed?: number;
  bsrReviewCorrelation?: string;
  competitionVulnerabilities?: string[];
  nichePotential?: {
    dailyPotential: number;
    entryDifficulty: "high" | "medium" | "low";
    entryDescription: string;
    strategies: string[];
  };
  demandSupplyGap?: {
    keyInsight: string;
    marketGaps: string[];
    topPainPoints: TopPainPointAnalysis[];
  };
  strategicAngles?: {
    reasoning: string;
    angles: StrategicAngle[];
  };
}

export interface AnalysisResponse {
  success: boolean;
  data?: AnalysisData;
  error?: string;
}

interface AnalysisJobStatus {
  id: string;
  niche_keyword: string;
  status: "queued" | "running" | "completed" | "failed" | string;
  analysis_id: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface SavedAnalysisCacheEntry {
  id: string;
  niche_keyword: string;
  overall_score: number;
  verdict_type: string;
  demand_score: number;
  competition_score: number;
  created_at: string;
}

const STORAGE_KEY = "kdp_last_analysis_id_v2";
export const SAVED_ANALYSES_MIRROR_KEY = "kdp_saved_analyses_mirror_v2";
const ANALYSIS_DATA_CACHE_KEY = "kdp_analysis_data_cache_v2";

interface CachedAnalysisRecord {
  data: AnalysisData;
  cachedAt: string;
  summary: SavedAnalysisCacheEntry;
}

function isCachedAnalysisRecord(
  value: CachedAnalysisRecord | AnalysisData,
): value is CachedAnalysisRecord {
  return typeof value === "object" && value !== null && "data" in value && "summary" in value;
}

export function saveLastAnalysisId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (e) {
    console.error("Failed to save analysis ID to localStorage:", e);
  }
}

export function getLastAnalysisId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to get analysis ID from localStorage:", e);
    return null;
  }
}

export function clearLastAnalysisId() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear analysis ID from localStorage:", e);
  }
}

export function loadSavedAnalysesMirror(): SavedAnalysisCacheEntry[] {
  try {
    const raw = localStorage.getItem(SAVED_ANALYSES_MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAnalysisCacheEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mergeSavedAnalysesMirror(entries: SavedAnalysisCacheEntry[]) {
  try {
    const current = loadSavedAnalysesMirror();
    const merged = new Map<string, SavedAnalysisCacheEntry>();

    [...current, ...entries].forEach((item) => {
      if (!item?.id) return;
      merged.set(item.id, item);
    });

    const next = Array.from(merged.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);

    localStorage.setItem(SAVED_ANALYSES_MIRROR_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("Failed to merge saved analyses mirror:", e);
  }
}

export function cacheSavedAnalysisSummary(entry: SavedAnalysisCacheEntry) {
  mergeSavedAnalysesMirror([entry]);
}

export function cacheAnalysisData(data: AnalysisData) {
  if (!data.analysisId) return;

  try {
    const raw = localStorage.getItem(ANALYSIS_DATA_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, CachedAnalysisRecord | AnalysisData>) : {};
    const summary: SavedAnalysisCacheEntry = {
      id: data.analysisId,
      niche_keyword: data.niche || "",
      overall_score: data.verdict?.confidence || 0,
      verdict_type: data.verdict?.type || "publish-with-angle",
      demand_score: data.scores?.opportunity?.score || 0,
      competition_score: data.scores?.saturation?.score || 0,
      created_at: new Date().toISOString(),
    };
    const next = {
      ...parsed,
      [data.analysisId]: {
        data,
        cachedAt: new Date().toISOString(),
        summary,
      },
    };

    const entries = Object.entries(next)
      .sort(([, a], [, b]) => {
        const aTime = new Date("cachedAt" in a ? a.cachedAt : new Date().toISOString()).getTime();
        const bTime = new Date("cachedAt" in b ? b.cachedAt : new Date().toISOString()).getTime();
        return bTime - aTime;
      })
      .slice(0, 50);

    localStorage.setItem(ANALYSIS_DATA_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    mergeSavedAnalysesMirror([summary]);
  } catch (e) {
    console.error("Failed to cache analysis data:", e);
  }
}

export function loadCachedAnalysisData(analysisId: string): AnalysisData | null {
  try {
    const raw = localStorage.getItem(ANALYSIS_DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, CachedAnalysisRecord | AnalysisData>;
    const record = parsed?.[analysisId];
    if (!record) return null;

    return isCachedAnalysisRecord(record) ? record.data : record;
  } catch {
    return null;
  }
}

export function loadCachedAnalysisSummaries(): SavedAnalysisCacheEntry[] {
  try {
    const raw = localStorage.getItem(ANALYSIS_DATA_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, CachedAnalysisRecord | AnalysisData>;

    return Object.values(parsed)
      .map((record) => {
        if (isCachedAnalysisRecord(record)) return record.summary;
        const data: AnalysisData = record;

        if (data?.analysisId) {
          return {
            id: data.analysisId,
            niche_keyword: data.niche || "",
            overall_score: data.verdict?.confidence || 0,
            verdict_type: data.verdict?.type || "publish-with-angle",
            demand_score: data.scores?.opportunity?.score || 0,
            competition_score: data.scores?.saturation?.score || 0,
            created_at: new Date().toISOString(),
          } satisfies SavedAnalysisCacheEntry;
        }

        return null;
      })
      .filter((item): item is SavedAnalysisCacheEntry => Boolean(item))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

async function invokeAnalysisData<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("analysis-data", { body });

  if (error) {
    throw new Error(error.message || "analysis-data function error");
  }

  if (!data?.success) {
    throw new Error(data?.error || "analysis-data request failed");
  }

  return data.data as T;
}

function describeAnalysisStep(step?: string | null) {
  switch (step) {
    case "scraping_amazon":
      return "raccolta dati Amazon";
    case "scraping_parallel_sources":
      return "raccolta fonti esterne";
    case "ai_analysis":
      return "analisi AI";
    case "saving_to_database":
      return "salvataggio risultati";
    default:
      return step || "fase sconosciuta";
  }
}

async function getLatestAnalysisJob(niche: string, since: string) {
  return await invokeAnalysisData<AnalysisJobStatus | null>({
    action: "latestJobByNiche",
    niche,
    since,
  });
}

// Store the start time for polling reference
let pollingStartTime: Date | null = null;

function calculateRiskScore({
  profitabilityScore,
  saturationScore,
  opportunityScore,
}: {
  profitabilityScore: number;
  saturationScore: number;
  opportunityScore: number;
}) {
  const normalizedRisk =
    saturationScore * 0.45 +
    (100 - profitabilityScore) * 0.35 +
    (100 - opportunityScore) * 0.2;

  return Math.max(0, Math.min(100, Math.round(normalizedRisk)));
}

export function setPollingStartTime(startedAt?: number | null) {
  pollingStartTime = startedAt ? new Date(startedAt) : null;
}

// Poll for analysis completion by checking database
export async function pollForAnalysis(niche: string, maxAttempts: number = 180): Promise<AnalysisResponse> {
  const startTime = Date.now();
  const staleJobAfterMs = 3 * 60 * 1000;
  const staleJobMinimumElapsedMs = 4 * 60 * 1000;
  
  // Use the stored start time or fall back to 10 minutes ago
  const referenceTime = pollingStartTime || new Date(Date.now() - 10 * 60 * 1000);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait 5 seconds between polls
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Check if analysis exists for this niche (created after we started)
    const sinceTime = referenceTime.toISOString();

    try {
      const job = await getLatestAnalysisJob(niche, sinceTime);

      if (job?.status === "completed" && job.analysis_id) {
        saveLastAnalysisId(job.analysis_id);
        return await getAnalysisById(job.analysis_id);
      }

      if (job?.status === "failed") {
        return {
          success: false,
          error: `Analisi interrotta durante ${describeAnalysisStep(job.error_message)}. Riprova con una nuova ricerca.`,
        };
      }

      if (job?.status === "running") {
        const lastUpdate = new Date(job.updated_at || job.started_at).getTime();
        const jobStartedAt = new Date(job.started_at).getTime();
        const elapsed = Math.max(
          Date.now() - startTime,
          Date.now() - referenceTime.getTime(),
          Number.isFinite(jobStartedAt) ? Date.now() - jobStartedAt : 0,
        );
        const isStale = Number.isFinite(lastUpdate) && Date.now() - lastUpdate > staleJobAfterMs;

        if (isStale && elapsed > staleJobMinimumElapsedMs) {
          return {
            success: false,
            error: `Analisi ferma su ${describeAnalysisStep(job.error_message)} da diversi minuti. Riprova: il vecchio processo non sta piu avanzando.`,
          };
        }
      }
    } catch (jobError) {
      console.warn("analysis job status unavailable:", jobError);
    }

    try {
      const status = await invokeAnalysisData<{
        analysisId: string | null;
        createdAt: string | null;
        competitorCount: number;
      }>({
        action: "latestByNiche",
        niche,
        since: sinceTime,
      });

      if (status?.analysisId) {
        console.log(`Analysis found via function after ${attempt + 1} attempts, ${(Date.now() - startTime) / 1000}s`);

        if (!status.competitorCount || status.competitorCount === 0) {
          console.log("No competitors yet, waiting longer...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        saveLastAnalysisId(status.analysisId);
        return await getAnalysisById(status.analysisId);
      }
    } catch (functionError) {
      console.warn("analysis-data polling fallback to direct query:", functionError);
    }

    const { data: analysis, error } = await supabase
      .from("niche_analyses")
      .select("id, created_at")
      .eq("niche_keyword", niche)
      .gte("created_at", sinceTime)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Polling error:", error);
      continue;
    }

    if (analysis) {
      console.log(`Analysis found after ${attempt + 1} attempts, ${(Date.now() - startTime) / 1000}s`);

      // Wait a bit more to ensure competitor books are saved
      // (they're saved after the main analysis)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if competitors are available
      const { count } = await supabase
        .from("competitor_books")
        .select("id", { count: "exact", head: true })
        .eq("analysis_id", analysis.id);

      console.log(`Found ${count || 0} competitor books for analysis`);

      // If no competitors yet, wait a bit more
      if (!count || count === 0) {
        console.log("No competitors yet, waiting longer...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      saveLastAnalysisId(analysis.id);
      return await getAnalysisById(analysis.id);
    }

    console.log(`Polling attempt ${attempt + 1}/${maxAttempts}...`);
  }
  
  return {
    success: false,
    error: "Analysis timed out after about 15 minutes. The data source may still be slow or unavailable; please retry in a few minutes.",
  };
}

export async function analyzeNiche(niche: string): Promise<AnalysisResponse> {
  try {
    // Store the start time for polling reference
    pollingStartTime = new Date();
    
    console.log('Starting analysis for:', niche);
    
    // Start the edge function - it returns immediately with "processing" status
    const { data, error } = await supabase.functions.invoke('analyze-niche', {
      body: { niche }
    });
    
    if (error) {
      console.log('Function returned error:', error.message);
      // Still try polling - the background task might be running
    } else {
      console.log('Function response:', data);
    }
    
    // Check if we got a "processing" response (background mode)
    if (data?.success && data?.data?.status === 'processing') {
      console.log('Background processing started, polling for results...');
    }
    
    // Check if we got a complete analysis (unlikely but possible)
    if (data?.success && data?.data?.analysisId && data?.data?.scores) {
      console.log('Got immediate result with analysisId:', data.data.analysisId);
      saveLastAnalysisId(data.data.analysisId);
      return data as AnalysisResponse;
    }
    
    // Poll for results in database - this is the expected path
    console.log('Starting database polling...');
    return await pollForAnalysis(niche);
    
  } catch (err) {
    console.error('Error calling analyze-niche:', err);
    
    // Even on error, try polling as the background task might have started
    console.log('Function call failed, attempting to poll for results...');
    return await pollForAnalysis(niche);
  }
}

export async function getAnalysisById(analysisId: string): Promise<AnalysisResponse> {
  try {
    try {
      const functionData = await invokeAnalysisData<AnalysisData>({
        action: "getById",
        analysisId,
      });

      if (functionData?.analysisId) {
        cacheSavedAnalysisSummary({
          id: functionData.analysisId,
          niche_keyword: functionData.niche || "",
          overall_score: functionData.verdict?.confidence || 0,
          verdict_type: functionData.verdict?.type || "publish-with-angle",
          demand_score: functionData.scores?.opportunity?.score || 0,
          competition_score: functionData.scores?.saturation?.score || 0,
          created_at: new Date().toISOString(),
        });
        cacheAnalysisData(functionData);
      }

      return { success: true, data: functionData };
    } catch (functionError) {
      console.warn("analysis-data getById fallback to direct query:", functionError);
    }

    // Fetch main analysis
    const { data: analysisRow, error: analysisError } = await supabase
      .from("niche_analyses")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (analysisError || !analysisRow) {
      console.error("Error fetching analysis:", analysisError);
      return { success: false, error: "Analysis not found" };
    }

    cacheSavedAnalysisSummary({
      id: analysisRow.id,
      niche_keyword: analysisRow.niche_keyword,
      overall_score: analysisRow.overall_score,
      verdict_type: analysisRow.verdict_type,
      demand_score: analysisRow.demand_score,
      competition_score: analysisRow.competition_score,
      created_at: analysisRow.created_at,
    });

    // Fetch competitor books - order by BSR ascending (lowest BSR = best seller)
    // Use nullsLast to put books without BSR at the end
    const { data: competitorRows, error: competitorError } = await supabase
      .from("competitor_books")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("current_bsr", { ascending: true, nullsFirst: false });

    if (competitorError) {
      console.error("Error fetching competitors:", competitorError);
    }
    
    console.log("Fetched competitors:", competitorRows?.map(c => ({
      title: c.title.slice(0, 30),
      bsr: c.current_bsr
    })));

    // Fetch historical data for each competitor
    const competitors: CompetitorBook[] = [];
    for (const comp of competitorRows || []) {
      const { data: historyRows } = await supabase
        .from("competitor_history")
        .select("*")
        .eq("book_id", comp.id)
        .order("recorded_at", { ascending: true });

      const historicalData = {
        dates: historyRows?.map((h) => h.recorded_at?.split("T")[0]) || [],
        bsr: historyRows?.map((h) => h.bsr || 0) || [],
        price: historyRows?.map((h) => Number(h.price) || 0) || [],
        reviews: historyRows?.map((h) => h.reviews || 0) || [],
        estimatedSales: historyRows?.map((h) => h.estimated_sales || 0) || [],
      };

      // Calculate real KDP royalty for this competitor
      const bookPages = comp.pages || estimatePageCount(comp.title, comp.format || 'Paperback');
      const bookPrice = Number(comp.current_price) || 0;
      const bookFormat: 'paperback' | 'hardcover' = (comp.format || '').toLowerCase().includes('hard') ? 'hardcover' : 'paperback';
      const bookIsColor = isLikelyColorBook(comp.title);
      const bookBsr = comp.current_bsr || 0;

      const royaltyCalc = bookPrice > 0 
        ? calculateRoyalty(bookPrice, bookPages, bookFormat, bookIsColor) 
        : null;
      const dailyEarningsCalc = bookBsr > 0 && bookPrice > 0
        ? calculateDailyEarnings(bookBsr, bookPrice, bookPages, bookFormat, bookIsColor)
        : null;
      const dailySalesEst = bookBsr > 0 ? estimateDailySalesFromBSR(bookBsr) : null;

      competitors.push({
        rank: competitors.length + 1,
        title: comp.title,
        author: comp.author || "Unknown",
        asin: comp.asin,
        coverUrl: comp.cover_url || "",
        bsr: bookBsr,
        reviews: comp.current_reviews || 0,
        rating: Number(comp.current_rating) || 4.0,
        price: bookPrice,
        estMonthlySales: dailySalesEst ? Math.round(dailySalesEst.avg * 30) : 0,
        estMonthlyRevenue: dailySalesEst && bookPrice > 0 ? Math.round(dailySalesEst.avg * 30 * bookPrice) : 0,
        profitPerCopy: royaltyCalc?.netRoyalty || 0,
        format: comp.format || "Paperback",
        pages: bookPages,
        trend: historicalData.bsr[0] > historicalData.bsr[historicalData.bsr.length - 1] ? "up" : "stable",
        publishDate: comp.publish_date || "",
        historicalData,
      });
    }

    // ====================================================================
    // REAL profit scenarios — anchored to ACTUAL competitor books.
    // Per-competitor royalty (own price/pages/format), then pick worst/median/best
    // from the top sellers in the niche so the Optimistic scenario matches the
    // best-seller's monthly royalty shown on its card.
    // ====================================================================
    const competitorsWithData = competitors.filter(c => c.price > 0 && c.bsr > 0);

    // Compute per-competitor monthly profit using THEIR own data
    type PerBookProfit = {
      dailySales: number;
      monthlySales: number;
      monthlyRevenue: number;
      monthlyProfit: number;
      price: number;
      royaltyPerCopy: number;
    };

    const perBook: PerBookProfit[] = competitorsWithData.map(c => {
      const pages = c.pages || 150;
      const format: 'paperback' | 'hardcover' =
        (c.format || '').toLowerCase().includes('hard') ? 'hardcover' : 'paperback';
      const isColor = isLikelyColorBook(c.title);
      const royaltyCalc = calculateRoyalty(c.price, pages, format, isColor);
      const royaltyPerCopy = royaltyCalc.netRoyalty;
      const dailySales = estimateDailySalesFromBSR(c.bsr).avg;
      return {
        dailySales,
        monthlySales: Math.round(dailySales * 30),
        monthlyRevenue: Math.round(dailySales * 30 * c.price),
        monthlyProfit: Math.round(dailySales * 30 * royaltyPerCopy),
        price: c.price,
        royaltyPerCopy,
      };
    });

    // Real avg price/royalty for the headline metrics
    const realAvgPrice = perBook.length > 0
      ? perBook.reduce((s, b) => s + b.price, 0) / perBook.length
      : (competitors.filter(c => c.price > 0).reduce((s, c) => s + c.price, 0) /
         (competitors.filter(c => c.price > 0).length || 1));

    const realRoyaltyPerCopy = perBook.length > 0
      ? perBook.reduce((s, b) => s + b.royaltyPerCopy, 0) / perBook.length
      : 0;

    let realProfit;
    if (perBook.length === 0) {
      // No real BSR+price data → do NOT fabricate scenarios.
      realProfit = {
        conservative: { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
        expected:     { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
        optimistic:   { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
        avgPrice: Math.round(realAvgPrice * 100) / 100,
        avgProfitPerCopy: Math.round(realRoyaltyPerCopy * 100) / 100,
        dailyRoyaltyRange: { min: 0, max: 0 },
      };
    } else {
      // Sort by monthly profit ascending — anchor scenarios to REAL books
      const sorted = [...perBook].sort((a, b) => a.monthlyProfit - b.monthlyProfit);
      const worst = sorted[0];
      const best = sorted[sorted.length - 1];
      // Median (true middle) — represents a realistic position for a new entrant
      const mid = sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : (() => {
            const a = sorted[sorted.length / 2 - 1];
            const b = sorted[sorted.length / 2];
            return {
              dailySales: (a.dailySales + b.dailySales) / 2,
              monthlySales: Math.round((a.monthlySales + b.monthlySales) / 2),
              monthlyRevenue: Math.round((a.monthlyRevenue + b.monthlyRevenue) / 2),
              monthlyProfit: Math.round((a.monthlyProfit + b.monthlyProfit) / 2),
              price: (a.price + b.price) / 2,
              royaltyPerCopy: (a.royaltyPerCopy + b.royaltyPerCopy) / 2,
            } as PerBookProfit;
          })();

      realProfit = {
        conservative: {
          monthlySales: worst.monthlySales,
          monthlyRevenue: worst.monthlyRevenue,
          monthlyProfit: worst.monthlyProfit,
        },
        expected: {
          monthlySales: mid.monthlySales,
          monthlyRevenue: mid.monthlyRevenue,
          monthlyProfit: mid.monthlyProfit,
        },
        optimistic: {
          monthlySales: best.monthlySales,
          monthlyRevenue: best.monthlyRevenue,
          monthlyProfit: best.monthlyProfit,
        },
        avgPrice: Math.round(realAvgPrice * 100) / 100,
        avgProfitPerCopy: Math.round(realRoyaltyPerCopy * 100) / 100,
        dailyRoyaltyRange: {
          min: Math.round((worst.monthlyProfit / 30) * 100) / 100,
          max: Math.round((best.monthlyProfit / 30) * 100) / 100,
        },
      };
    }

    const data: AnalysisData = {
      scores: {
        profitability: { score: analysisRow.profit_potential_score, trend: "stable" },
        saturation: { score: analysisRow.competition_score, trend: "stable" },
        opportunity: { score: analysisRow.demand_score, trend: mapTrend(analysisRow.trend_direction) },
        risk: {
          score: calculateRiskScore({
            profitabilityScore: analysisRow.profit_potential_score,
            saturationScore: analysisRow.competition_score,
            opportunityScore: analysisRow.demand_score,
          }),
          trend: "stable",
        },
      },
      verdict: {
        type: mapVerdictType(analysisRow.verdict_type),
        confidence: analysisRow.overall_score,
        summary: analysisRow.verdict_description,
        insights: (analysisRow.strategy as any)?.painPoints || [],
      },
      competitors,
      opportunities: (analysisRow.opportunities as any) || { gaps: [], weaknesses: [], underserved: [], opportunities: [] },
      patterns: (analysisRow.patterns as any) || { pageCountRange: "", priceSweet: "", emotionalPromises: [], targetLanguage: [], structuralPatterns: [] },
      trends: {
        direction: analysisRow.trend_direction as "growing" | "stable" | "declining",
        seasonality: analysisRow.trend_seasonality as "high" | "moderate" | "low",
        viability: analysisRow.trend_viability as "strong" | "moderate" | "weak",
        data: analysisRow.trend_data || [],
        labels: analysisRow.trend_labels || [],
      },
      profit: realProfit,
      strategy: (analysisRow.strategy as any) || {},
      suggestedTitles: (analysisRow.suggested_titles as any) || [],
      painPointsFromWeb: (analysisRow.pain_points as any) || [],
      socialExcerpts: (analysisRow as any).social_excerpts || [],
      clusteredPainPoints: (analysisRow as any).clustered_pain_points || [],
      totalMentions: (analysisRow as any).clustered_pain_points?.reduce((sum: number, c: any) => sum + (c.count || 0), 0) || 0,
      sources: (analysisRow.sources as any) || [],
      analysisId: analysisRow.id,
      niche: analysisRow.niche_keyword,
      // Review patterns
      reviewPatterns: (analysisRow as any).review_patterns || null,
      // Search volume data
      searchVolume: (analysisRow as any).search_volume || null,
      searchVolumeScore: (analysisRow as any).search_volume_score || null,
      searchVolumeSource: (analysisRow as any).search_volume_source || null,
    };

    cacheAnalysisData(data);

    return { success: true, data };
  } catch (err) {
    const cached = loadCachedAnalysisData(analysisId);
    if (cached) {
      return { success: true, data: cached };
    }

    console.error("Error loading analysis:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to load analysis" };
  }
}

export function getPollingStartTime() {
  return pollingStartTime;
}

export function mapTrend(trend: string): "up" | "stable" | "down" {
  if (trend === "up" || trend === "growing") return "up";
  if (trend === "down" || trend === "declining") return "down";
  return "stable";
}

export function mapVerdictType(type: string): "publish" | "publish-with-angle" | "avoid" {
  if (type === "publish") return "publish";
  if (type === "avoid") return "avoid";
  return "publish-with-angle";
}

export function getScoreVariant(score: number, isRisk: boolean = false): "success" | "warning" | "danger" | "primary" {
  if (isRisk) {
    if (score < 30) return "success";
    if (score < 60) return "warning";
    return "danger";
  }
  if (score >= 70) return "success";
  if (score >= 40) return "warning";
  return "danger";
}
