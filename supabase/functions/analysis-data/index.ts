import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const ALLOWED_ORIGINS = [
  "https://id-preview--13defa98-1cf8-4dc3-afbb-8eaa8e0e92f2.lovable.app",
  "https://13defa98-1cf8-4dc3-afbb-8eaa8e0e92f2.lovableproject.com",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com");

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

function mapTrend(trend: string): "up" | "stable" | "down" {
  if (trend === "up" || trend === "growing") return "up";
  if (trend === "down" || trend === "declining") return "down";
  return "stable";
}

function mapVerdictType(type: string): "publish" | "publish-with-angle" | "avoid" {
  if (type === "publish") return "publish";
  if (type === "avoid") return "avoid";
  return "publish-with-angle";
}

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

function isLikelyColorBook(title: string, category?: string): boolean {
  const colorKeywords = [
    "coloring", "activity", "workbook", "puzzle", "sudoku",
    "crossword", "children", "kids", "pictures", "illustrated",
    "photo", "photography", "cookbook", "recipe", "art",
    "design", "graphic", "comic", "manga", "journal",
  ];

  const lowerTitle = title.toLowerCase();
  const lowerCategory = (category || "").toLowerCase();
  return colorKeywords.some((kw) => lowerTitle.includes(kw) || lowerCategory.includes(kw));
}

function estimatePageCount(title: string, format?: string): number {
  const lowerTitle = title.toLowerCase();
  const lowerFormat = (format || "").toLowerCase();

  if (/journal|notebook|planner|log|tracker|diary/i.test(lowerTitle)) return 120;
  if (/workbook|activity|puzzle|coloring/i.test(lowerTitle)) return 100;
  if (/guide|travel|handbook/i.test(lowerTitle)) return 200;
  if (lowerFormat.includes("hard")) return 180;
  return 150;
}

function calculateRoyalty(
  listPrice: number,
  pageCount: number,
  format: "paperback" | "hardcover" = "paperback",
  isColor: boolean = false,
): { netRoyalty: number } {
  const fixedCost = format === "hardcover" ? 6.8 : 0.85;
  const perPageCost = isColor ? 0.07 : 0.012;
  const printingCost = fixedCost + pageCount * perPageCost;
  const prePrintingRoyalty = listPrice * 0.6;
  return {
    netRoyalty: Math.max(0, prePrintingRoyalty - printingCost),
  };
}

async function checkFirecrawl(apiKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com",
        formats: ["markdown"],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      message: typeof parsed?.error === "string" ? parsed.error : null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message: error instanceof Error ? error.message : "Firecrawl check failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Backend configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "health") {
      const { count, error: dbError } = await supabase
        .from("niche_analyses")
        .select("id", { count: "exact", head: true });

      const shouldCheckFirecrawl = body?.checkFirecrawl === true;
      const firecrawl = shouldCheckFirecrawl && FIRECRAWL_API_KEY
        ? await checkFirecrawl(FIRECRAWL_API_KEY)
        : null;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            checkedAt: new Date().toISOString(),
            supabase: {
              ok: !dbError,
              status: dbError ? "error" : "ok",
              analysisCount: count ?? null,
              error: dbError?.message || null,
            },
            secrets: {
              openaiApiKey: OPENAI_API_KEY ? "present" : "missing",
              openaiModel: OPENAI_MODEL,
              firecrawlApiKey: FIRECRAWL_API_KEY ? "present" : "missing",
              supabaseUrl: SUPABASE_URL ? "present" : "missing",
              supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing",
            },
            firecrawl: shouldCheckFirecrawl
              ? firecrawl ?? { ok: false, status: null, message: "FIRECRAWL_API_KEY missing" }
              : { ok: null, status: null, message: "Skipped. Send checkFirecrawl: true to test the API key." },
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "listRecent") {
      const requestedLimit = Number(body?.limit ?? 20);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(100, Math.floor(requestedLimit)))
        : 20;

      const { data, error } = await supabase
        .from("niche_analyses")
        .select("id, niche_keyword, overall_score, verdict_type, demand_score, competition_score, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "latestByNiche") {
      const niche = String(body?.niche || "").trim();
      if (!niche) {
        return new Response(JSON.stringify({ success: false, error: "Niche is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const since = String(body?.since || new Date(Date.now() - 10 * 60 * 1000).toISOString());

      const { data: analysis, error: analysisError } = await supabase
        .from("niche_analyses")
        .select("id, created_at")
        .eq("niche_keyword", niche)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (analysisError) throw analysisError;

      if (!analysis?.id) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { analysisId: null, createdAt: null, competitorCount: 0 },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { count } = await supabase
        .from("competitor_books")
        .select("id", { count: "exact", head: true })
        .eq("analysis_id", analysis.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            analysisId: analysis.id,
            createdAt: analysis.created_at,
            competitorCount: count || 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "getById") {
      const analysisId = String(body?.analysisId || "").trim();
      if (!analysisId) {
        return new Response(JSON.stringify({ success: false, error: "analysisId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: analysisRow, error: analysisError } = await supabase
        .from("niche_analyses")
        .select("*")
        .eq("id", analysisId)
        .single();

      if (analysisError || !analysisRow) {
        return new Response(JSON.stringify({ success: false, error: "Analysis not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: competitorRows, error: competitorError } = await supabase
        .from("competitor_books")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("current_bsr", { ascending: true, nullsFirst: false });

      if (competitorError) throw competitorError;

      const competitorList = competitorRows || [];
      const competitorIds = competitorList.map((comp) => comp.id).filter(Boolean);

      const historyByBookId = new Map<string, any[]>();
      if (competitorIds.length > 0) {
        const { data: historyRows, error: historyError } = await supabase
          .from("competitor_history")
          .select("*")
          .in("book_id", competitorIds)
          .order("recorded_at", { ascending: true });

        if (historyError) throw historyError;

        for (const row of historyRows || []) {
          const existing = historyByBookId.get(row.book_id) || [];
          existing.push(row);
          historyByBookId.set(row.book_id, existing);
        }
      }

      const competitors = competitorList.map((comp, index) => {
        const historyRows = historyByBookId.get(comp.id) || [];
        const historicalData = {
          dates: historyRows.map((h) => h.recorded_at?.split("T")[0].slice(0, 7)),
          bsr: historyRows.map((h) => h.bsr || 0),
          price: historyRows.map((h) => Number(h.price) || 0),
          reviews: historyRows.map((h) => h.reviews || 0),
          estimatedSales: historyRows.map((h) => h.estimated_sales || 0),
        };

        const currentPrice = Number(comp.current_price) || 0;
        const pageCount = comp.pages || estimatePageCount(comp.title, comp.format || "Paperback");
        const bookFormat: "paperback" | "hardcover" = (comp.format || "").toLowerCase().includes("hard")
          ? "hardcover"
          : "paperback";
        const hasRealBsr = Number(comp.current_bsr) > 0;
        const salesEstimate = hasRealBsr ? estimateDailySalesFromBSR(Number(comp.current_bsr)) : null;
        const royaltyCalc = currentPrice > 0
          ? calculateRoyalty(currentPrice, pageCount, bookFormat, isLikelyColorBook(comp.title))
          : null;
        const estMonthlySales = salesEstimate ? Math.round(salesEstimate.avg * 30) : 0;

        return {
          rank: index + 1,
          title: comp.title,
          author: comp.author || "Unknown",
          asin: comp.asin,
          coverUrl: comp.cover_url || "",
          bsr: comp.current_bsr || 0,
          reviews: comp.current_reviews || 0,
          rating: Number(comp.current_rating) || 4.0,
          price: currentPrice,
          estMonthlySales,
          estMonthlyRevenue: estMonthlySales * currentPrice,
          profitPerCopy: royaltyCalc?.netRoyalty || 0,
          format: comp.format || "Paperback",
          pages: pageCount,
          trend: historicalData.bsr[0] > historicalData.bsr[historicalData.bsr.length - 1] ? "up" : "stable",
          publishDate: comp.publish_date || "",
          historicalData,
        };
      });

      const competitorsWithData = competitors.filter((comp) => comp.price > 0 && comp.bsr > 0);
      const priceSource = competitors.filter((comp) => comp.price > 0);
      const avgPriceFallback = priceSource.length > 0
        ? priceSource.reduce((sum, comp) => sum + comp.price, 0) / priceSource.length
        : 0;

      type PerBookProfit = {
        monthlySales: number;
        monthlyRevenue: number;
        monthlyProfit: number;
        price: number;
        royaltyPerCopy: number;
      };

      const perBook: PerBookProfit[] = competitorsWithData.map((comp) => {
        const dailySales = estimateDailySalesFromBSR(comp.bsr).avg;
        return {
          monthlySales: Math.round(dailySales * 30),
          monthlyRevenue: Math.round(dailySales * 30 * comp.price),
          monthlyProfit: Math.round(dailySales * 30 * comp.profitPerCopy),
          price: comp.price,
          royaltyPerCopy: comp.profitPerCopy,
        };
      });

      const avgPrice = perBook.length > 0
        ? perBook.reduce((sum, book) => sum + book.price, 0) / perBook.length
        : avgPriceFallback;
      const avgProfitPerCopy = perBook.length > 0
        ? perBook.reduce((sum, book) => sum + book.royaltyPerCopy, 0) / perBook.length
        : 0;

      const profit = perBook.length === 0
        ? {
            conservative: { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
            expected: { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
            optimistic: { monthlySales: 0, monthlyRevenue: 0, monthlyProfit: 0 },
            avgPrice: Math.round(avgPrice * 100) / 100,
            avgProfitPerCopy: Math.round(avgProfitPerCopy * 100) / 100,
            dailyRoyaltyRange: { min: 0, max: 0 },
          }
        : (() => {
            const sorted = [...perBook].sort((a, b) => a.monthlyProfit - b.monthlyProfit);
            const worst = sorted[0];
            const best = sorted[sorted.length - 1];
            const expected = sorted.length % 2 === 1
              ? sorted[(sorted.length - 1) / 2]
              : {
                  monthlySales: Math.round((sorted[sorted.length / 2 - 1].monthlySales + sorted[sorted.length / 2].monthlySales) / 2),
                  monthlyRevenue: Math.round((sorted[sorted.length / 2 - 1].monthlyRevenue + sorted[sorted.length / 2].monthlyRevenue) / 2),
                  monthlyProfit: Math.round((sorted[sorted.length / 2 - 1].monthlyProfit + sorted[sorted.length / 2].monthlyProfit) / 2),
                  price: (sorted[sorted.length / 2 - 1].price + sorted[sorted.length / 2].price) / 2,
                  royaltyPerCopy: (sorted[sorted.length / 2 - 1].royaltyPerCopy + sorted[sorted.length / 2].royaltyPerCopy) / 2,
                };

            return {
              conservative: {
                monthlySales: worst.monthlySales,
                monthlyRevenue: worst.monthlyRevenue,
                monthlyProfit: worst.monthlyProfit,
              },
              expected: {
                monthlySales: expected.monthlySales,
                monthlyRevenue: expected.monthlyRevenue,
                monthlyProfit: expected.monthlyProfit,
              },
              optimistic: {
                monthlySales: best.monthlySales,
                monthlyRevenue: best.monthlyRevenue,
                monthlyProfit: best.monthlyProfit,
              },
              avgPrice: Math.round(avgPrice * 100) / 100,
              avgProfitPerCopy: Math.round(avgProfitPerCopy * 100) / 100,
              dailyRoyaltyRange: {
                min: Math.round((worst.monthlyProfit / 30) * 100) / 100,
                max: Math.round((best.monthlyProfit / 30) * 100) / 100,
              },
            };
          })();

      const responseData = {
        scores: {
          profitability: { score: analysisRow.profit_potential_score, trend: "stable" },
          saturation: { score: analysisRow.competition_score, trend: "stable" },
          opportunity: {
            score: analysisRow.demand_score,
            trend: mapTrend(analysisRow.trend_direction),
          },
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
          insights: analysisRow.strategy?.painPoints || [],
        },
        competitors,
        opportunities:
          analysisRow.opportunities || {
            gaps: [],
            weaknesses: [],
            underserved: [],
            opportunities: [],
          },
        patterns:
          analysisRow.patterns || {
            pageCountRange: "",
            priceSweet: "",
            emotionalPromises: [],
            targetLanguage: [],
            structuralPatterns: [],
          },
        trends: {
          direction: analysisRow.trend_direction,
          seasonality: analysisRow.trend_seasonality,
          viability: analysisRow.trend_viability,
          data: analysisRow.trend_data || [],
          labels: analysisRow.trend_labels || [],
        },
        profit,
        strategy: analysisRow.strategy || {},
        suggestedTitles: analysisRow.suggested_titles || [],
        painPointsFromWeb: analysisRow.pain_points || [],
        socialExcerpts: analysisRow.social_excerpts || [],
        clusteredPainPoints: analysisRow.clustered_pain_points || [],
        totalMentions:
          analysisRow.clustered_pain_points?.reduce((sum: number, item: any) => sum + (item.count || 0), 0) || 0,
        sources: analysisRow.sources || [],
        analysisId: analysisRow.id,
        niche: analysisRow.niche_keyword,
        searchVolume: analysisRow.search_volume || null,
        searchVolumeScore: analysisRow.search_volume_score || null,
        searchVolumeSource: analysisRow.search_volume_source || null,
        reviewPatterns: analysisRow.review_patterns || null,
      };

      return new Response(JSON.stringify({ success: true, data: responseData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Unsupported action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analysis-data error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
