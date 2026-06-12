import { useCallback, useEffect, useState } from "react";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { ScoreCard } from "./ScoreCard";
import { MarketVerdict } from "./MarketVerdict";
import { CompetitorGrid } from "./CompetitorGrid";
import { OpportunityMap } from "./OpportunityMap";
import { StrategyBlueprint } from "./StrategyBlueprint";
import { TrendChart } from "./TrendChart";
import { ProfitCalculator } from "./ProfitCalculator";
import { PatternDetection } from "./PatternDetection";
import { PainDesirePieChart } from "./PainDesirePieChart";
import { SourcesCard } from "./SourcesCard";
import { SocialInsightsCard } from "./SocialInsightsCard";
import { RedditPatternClusters } from "./RedditPatternClusters";
import { TitleGenerator } from "./TitleGenerator";
import { ReviewPatternSummary } from "./ReviewPatternSummary";
import { SavedAnalyses } from "./SavedAnalyses";
import { NicheComparison } from "./NicheComparison";
import { ExportPDF } from "./ExportPDF";
import { AnalysisProgressBar } from "./AnalysisProgressBar";
import { KeyInsightsBar } from "./KeyInsightsBar";

import { CompetitionIntensity } from "./CompetitionIntensity";
import { NichePotential } from "./NichePotential";
import { DemandSupplyGap } from "./DemandSupplyGap";
import { SearchVolumeCard } from "./SearchVolumeCard";
import { StrategicAngles } from "./StrategicAngles";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  analyzeNiche,
  pollForAnalysis,
  setPollingStartTime,
  AnalysisData, 
  mapTrend, 
  mapVerdictType, 
  getScoreVariant,
  saveLastAnalysisId,
  cacheAnalysisData,
  cacheSavedAnalysisSummary,
} from "@/lib/api/kdp-analysis";

interface AnalysisResultsProps {
  niche: string;
  isLoading: boolean;
  isResuming?: boolean;
  analysisStartedAt?: number | null;
  onLoadingChange: (loading: boolean) => void;
  initialData?: AnalysisData | null;
  onLoadAnalysis?: (analysisId: string, niche: string) => void;
  onAnalysisComplete?: (analysisId: string) => void;
}

export function AnalysisResults({ 
  niche, 
  isLoading, 
  isResuming = false,
  analysisStartedAt,
  onLoadingChange, 
  initialData,
  onLoadAnalysis,
  onAnalysisComplete 
}: AnalysisResultsProps) {
  const [data, setData] = useState<AnalysisData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<string>("");
  const [slowAnalysisNotice, setSlowAnalysisNotice] = useState(false);
  const [compareIds, setCompareIds] = useState<string[] | null>(null);
  const [autoRecoveryCount, setAutoRecoveryCount] = useState(0);
  const { toast } = useToast();
  const { playNotification, requestNotificationPermission } = useNotificationSound();

  const normalizedNiche = niche.trim().toLowerCase();
  const isResultForCurrentNiche = useCallback(
    (candidate?: AnalysisData | null) => {
      const candidateNiche = (candidate?.niche || "").trim().toLowerCase();
      return Boolean(candidateNiche) && candidateNiche === normalizedNiche;
    },
    [normalizedNiche],
  );

  // Request browser notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Update data when initialData changes (for loaded analyses)
  useEffect(() => {
    if (initialData && isResultForCurrentNiche(initialData)) {
      setData(initialData);
      setError(null);
      return;
    }

    if (!initialData) {
      setData(null);
      setError(null);
    }
  }, [initialData, isResultForCurrentNiche]);

  useEffect(() => {
    setData((current) => (current && !isResultForCurrentNiche(current) ? null : current));
  }, [isResultForCurrentNiche, niche]);

  const runAnalysis = useCallback(async () => {
    setError(null);
    setData(null);
    setSlowAnalysisNotice(false);
    onLoadingChange(true);
    setPollingStartTime(analysisStartedAt ?? Date.now());
    
    // Loading phases for user feedback
    const phases = [
      "Connecting to data sources...",
      "Scraping Amazon book data...",
      "Analyzing Amazon reviews...",
      "Scraping Reddit discussions...",
      "Analyzing Quora questions...",
      "Gathering forum insights...",
      "Running AI market analysis...",
      "Calculating profit projections...",
      "Generating strategic recommendations...",
      "Finalizing analysis...",
      "Almost done, saving results..."
    ];
    
    let phaseIndex = 0;
    const phaseInterval = setInterval(() => {
      if (phaseIndex < phases.length) {
        setLoadingPhase(phases[phaseIndex]);
        phaseIndex++;
      } else {
        // Loop back with polling messages
        setLoadingPhase("Processing data... This may take a few minutes");
      }
    }, 8000);

    const slowNoticeTimeout = setTimeout(() => {
      setSlowAnalysisNotice(true);
    }, 150_000);

    try {
      const result = await analyzeNiche(niche);
      
      clearInterval(phaseInterval);
      clearTimeout(slowNoticeTimeout);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Analysis failed');
      }

      if (!isResultForCurrentNiche(result.data)) {
        throw new Error(`Risultato scartato: la risposta era per "${result.data.niche || "un'altra nicchia"}", non per "${niche}".`);
      }
      
      setData(result.data);
      cacheAnalysisData(result.data);
      
      // Save to localStorage for persistence and notify parent
      if (result.data.analysisId) {
        saveLastAnalysisId(result.data.analysisId);
        cacheSavedAnalysisSummary({
          id: result.data.analysisId,
          niche_keyword: result.data.niche || niche,
          overall_score: result.data.verdict?.confidence || 0,
          verdict_type: result.data.verdict?.type || "publish-with-angle",
          demand_score: result.data.scores?.opportunity?.score || 0,
          competition_score: result.data.scores?.saturation?.score || 0,
          created_at: new Date().toISOString(),
        });
        onAnalysisComplete?.(result.data.analysisId);
      }
      
      // Play charm sound + browser notification
      playNotification(niche);
      
      toast({
        title: "Analisi Completata",
        description: `Trovate ${result.data.sources?.length || 0} fonti reali`,
      });
      
    } catch (err) {
      clearInterval(phaseInterval);
      clearTimeout(slowNoticeTimeout);
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      const canAutoRecover =
        autoRecoveryCount < 1 &&
        /raccolta|raccoglitore|supabase|rete|ssl|timeout|502|504/i.test(errorMessage);

      if (canAutoRecover) {
        setAutoRecoveryCount((count) => count + 1);
        setLoadingPhase("Recupero automatico: ritento la raccolta verificata...");
        setSlowAnalysisNotice(false);
        setTimeout(() => {
          runAnalysis();
        }, 4000);
        return;
      }

      setError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      onLoadingChange(false);
      setLoadingPhase("");
      setSlowAnalysisNotice(false);
    }
  }, [analysisStartedAt, autoRecoveryCount, isResultForCurrentNiche, niche, onAnalysisComplete, onLoadingChange, playNotification, toast]);

  // Track if analysis has been triggered for current niche to prevent duplicates
  const [analysisTriggered, setAnalysisTriggered] = useState(false);

  useEffect(() => {
    // Reset trigger when niche changes
    setAnalysisTriggered(false);
    setAutoRecoveryCount(0);
  }, [niche]);

  // Resume polling only (no new edge function call) when returning to page
  const resumeAnalysis = useCallback(async () => {
    setError(null);
    setData(null);
    setSlowAnalysisNotice(false);
    onLoadingChange(true);
    setLoadingPhase("Ripresa analisi in corso...");
    setPollingStartTime(analysisStartedAt);

    try {
      const result = await pollForAnalysis(niche, 60);
      
      if (!result.success || !result.data) {
        // If polling finds nothing, the background task may have failed — re-run
        console.log('Resume polling found nothing, starting fresh analysis');
        runAnalysis();
        return;
      }

      if (!isResultForCurrentNiche(result.data)) {
        console.warn("Resume returned analysis for a different niche, starting fresh analysis", result.data.niche, niche);
        runAnalysis();
        return;
      }
      
      setData(result.data);
      cacheAnalysisData(result.data);
      if (result.data.analysisId) {
        saveLastAnalysisId(result.data.analysisId);
        cacheSavedAnalysisSummary({
          id: result.data.analysisId,
          niche_keyword: result.data.niche || niche,
          overall_score: result.data.verdict?.confidence || 0,
          verdict_type: result.data.verdict?.type || "publish-with-angle",
          demand_score: result.data.scores?.opportunity?.score || 0,
          competition_score: result.data.scores?.saturation?.score || 0,
          created_at: new Date().toISOString(),
        });
        onAnalysisComplete?.(result.data.analysisId);
      }
      playNotification(niche);
      toast({ title: "Analisi Completata", description: `Trovate ${result.data.sources?.length || 0} fonti reali` });
    } catch {
      // Fallback to fresh analysis
      runAnalysis();
      return;
    } finally {
      onLoadingChange(false);
      setLoadingPhase("");
    }
  }, [analysisStartedAt, isResultForCurrentNiche, niche, onAnalysisComplete, onLoadingChange, playNotification, toast, runAnalysis]);

  useEffect(() => {
    // Only run analysis if no initialData, isLoading, and not already triggered
    if (niche && isLoading && !initialData && !analysisTriggered) {
      setAnalysisTriggered(true);
      if (isResuming) {
        resumeAnalysis();
      } else {
        runAnalysis();
      }
    }
  }, [initialData, isLoading, niche, runAnalysis, resumeAnalysis, analysisTriggered, isResuming]);

  const handleSelectAnalysis = (analysis: { id: string; niche_keyword: string }) => {
    if (onLoadAnalysis && analysis.id) {
      onLoadAnalysis(analysis.id, analysis.niche_keyword);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-16">
        <div className="flex flex-col items-center justify-center gap-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">Analizzando "{niche}"</h3>
            <p className="text-muted-foreground">
              Raccolta dati reali da Amazon, Reddit, Quora e forum...
            </p>
            {loadingPhase && (
              <p className="mt-3 text-sm text-primary">
                {loadingPhase}
              </p>
            )}
            {slowAnalysisNotice && (
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                L'analisi sta richiedendo piu tempo del previsto. Continuo a controllare i risultati in background: puoi lasciare aperta questa schermata.
              </p>
            )}
          </div>
          
          <AnalysisProgressBar niche={niche} isLoading={isLoading} startedAt={analysisStartedAt} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-24">
        <div className="flex flex-col items-center justify-center gap-6 max-w-md mx-auto text-center">
          <div className="p-4 rounded-full bg-destructive/10">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2">Analisi Fallita</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
          </div>
          <Button onClick={runAnalysis} variant="default" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const qualitativeCount = data.socialExcerpts?.length || 0;
  const qualitativeSources = new Set((data.socialExcerpts || []).map((excerpt) => excerpt.source));
  const amazonTextReviewCount = (data.socialExcerpts || []).filter((excerpt) => excerpt.source === "Amazon").length;
  const nonAmazonQualitativeSources = new Set(
    (data.socialExcerpts || [])
      .filter((excerpt) => excerpt.source !== "Amazon")
      .map((excerpt) => excerpt.source)
  );
  const hasTrendSeries = Array.isArray(data.trends?.data) && data.trends.data.some((value) => Number(value) > 0);
  const hasThinQualitativeData = qualitativeCount < 6 || qualitativeSources.size < 2;
  const hasEnoughAmazonReviewEvidence = amazonTextReviewCount >= 6;
  const hasEnoughExternalEvidence = nonAmazonQualitativeSources.size >= 2;
  const isDecisionGrade =
    hasEnoughAmazonReviewEvidence &&
    hasEnoughExternalEvidence;
  const hasTrendGap = !hasTrendSeries;

  return (
    <div className="container py-16 space-y-8" id="analysis-results">
      {/* Section Header with Export */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-12">
        <div className="text-center md:text-left flex-1">
          <p className="text-sm uppercase tracking-widest text-primary mb-2">
            {hasThinQualitativeData ? "Analisi Amazon verificata" : "Analisi con fonti qualitative"} • {data.sources?.length || 0} fonti
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Intelligence di Mercato per "{niche}"
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            Dati Amazon verificati con fonti qualitative solo quando sono state realmente raccolte.
          </p>
        </div>
        
        {/* Export PDF Button */}
        <ExportPDF data={data} niche={niche} />
      </div>

      {hasThinQualitativeData && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold text-amber-200">Copertura qualitativa limitata</p>
          <p className="mt-1 text-muted-foreground">
            Sono stati trovati {qualitativeCount} estratti verificabili da {qualitativeSources.size} canali.
            Le sezioni su pain point, Reddit, Quora, forum e recensioni devono quindi pesare poco:
            l'analisi è soprattutto basata su competitor Amazon, BSR, prezzo e pagine.
          </p>
        </div>
      )}

      {!isDecisionGrade && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          <p className="font-semibold text-red-200">Analisi non sufficiente per una decisione</p>
          <p className="mt-1 text-muted-foreground">
            Copertura attuale: {amazonTextReviewCount} review Amazon testuali, {nonAmazonQualitativeSources.size} canali esterni
            verificabili. Il verdict, i pain point e la stima di mercato non vanno trattati come affidabili finche mancano
            almeno 6 review Amazon testuali e 2 canali esterni verificabili.
          </p>
        </div>
      )}

      {isDecisionGrade && hasTrendGap && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-200">Trend non verificato</p>
          <p className="mt-1 text-muted-foreground">
            La copertura qualitativa è utilizzabile ({amazonTextReviewCount} review Amazon e {nonAmazonQualitativeSources.size} canali esterni),
            ma Google Trends non ha restituito una serie verificabile. Tratta stagionalità e volume di ricerca come dati mancanti,
            non come segnali negativi.
          </p>
        </div>
      )}

      {/* Key Insights Bar - NEW */}
      {data.keyInsights && data.keyInsights.length > 0 && (
        <KeyInsightsBar insights={data.keyInsights} />
      )}

      {/* Score Cards + Search Volume */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreCard
          title="Redditività"
          score={data.scores.profitability.score}
          description="Potenziale di guadagno basato su margini e velocità di vendita"
          trend={mapTrend(data.scores.profitability.trend)}
          variant={getScoreVariant(data.scores.profitability.score)}
          delay={0}
        />
        <ScoreCard
          title="Saturazione"
          score={data.scores.saturation.score}
          description="Livello di competizione - più basso è meglio"
          trend={mapTrend(data.scores.saturation.trend)}
          variant={getScoreVariant(100 - data.scores.saturation.score)}
          delay={100}
        />
        <ScoreCard
          title="Opportunità"
          score={data.scores.opportunity.score}
          description="Potenziale per nuovi entranti con posizionamento unico"
          trend={mapTrend(data.scores.opportunity.trend)}
          variant={getScoreVariant(data.scores.opportunity.score)}
          delay={200}
        />
        <ScoreCard
          title="Rischio"
          score={data.scores.risk.score}
          description="Valutazione rischio - più basso è meglio"
          trend={mapTrend(data.scores.risk.trend)}
          variant={getScoreVariant(data.scores.risk.score, true)}
          delay={300}
        />
      </div>

      {/* Search Volume Card - NEW */}
      {data.searchVolume && data.searchVolumeScore && (
        <SearchVolumeCard
          volume={data.searchVolume}
          score={data.searchVolumeScore}
          source={data.searchVolumeSource}
        />
      )}

      {/* Competition Details */}
      {data.competitionLevel && (
        <CompetitionIntensity
          level={data.competitionLevel}
          selfPublishedCount={data.selfPublishedCount || 0}
          totalAnalyzed={data.totalAnalyzed || 0}
          description={data.competitionDescription || ""}
          bsrReviewCorrelation={data.bsrReviewCorrelation}
          vulnerabilities={data.competitionVulnerabilities}
        />
      )}

      {/* Niche Potential - NEW */}
      {data.nichePotential && (
        <NichePotential {...data.nichePotential} />
      )}

      {/* Top 3 Best Selling Competitors */}
      <CompetitorGrid competitors={data.competitors} />

      {/* Market Verdict */}
      <MarketVerdict
        verdict={mapVerdictType(data.verdict.type)}
        confidence={data.verdict.confidence}
        summary={data.verdict.summary}
        keyInsights={data.verdict.insights}
      />

      {/* Pain Points & Desires Analysis - SIMPLIFIED: Only Pie Chart with 1-10 scale */}
      {data.clusteredPainPoints && data.clusteredPainPoints.length > 0 && (
        <PainDesirePieChart 
          clusters={data.clusteredPainPoints} 
          totalMentions={data.totalMentions || 0} 
        />
      )}

      {/* Social Insights - Real Community Discussions */}
      {data.socialExcerpts && data.socialExcerpts.length > 0 && (
        <>
          <RedditPatternClusters excerpts={data.socialExcerpts} />
          <SocialInsightsCard excerpts={data.socialExcerpts} />
        </>
      )}

      {/* Review Pattern Summary - Positive & Negative Trends */}
      {data.reviewPatterns && amazonTextReviewCount >= 2 && (
        <ReviewPatternSummary patterns={data.reviewPatterns} />
      )}

      {/* Profit Calculator */}
      <ProfitCalculator {...data.profit} />

      {/* Google Trends Analysis - Full Width */}
      <TrendChart {...data.trends} niche={niche} />

      {/* AI Title Generator */}
      {data.suggestedTitles && data.suggestedTitles.length > 0 && (
        <TitleGenerator titles={data.suggestedTitles} niche={niche} />
      )}

      {/* Demand Supply Gap Analysis - NEW */}
      {data.demandSupplyGap && (
        <DemandSupplyGap {...data.demandSupplyGap} />
      )}

      {/* Strategic Angles - NEW */}
      {data.strategicAngles && data.strategicAngles.angles.length > 0 && (
        <StrategicAngles {...data.strategicAngles} />
      )}

      {/* Pattern Detection */}
      <PatternDetection {...data.patterns} />

      {/* Opportunity Mapping */}
      <OpportunityMap {...data.opportunities} />

      {/* Strategy Blueprint */}
      <StrategyBlueprint {...data.strategy} analysisData={data} />

      {/* Sources */}
      {data.sources && data.sources.length > 0 && (
        <SourcesCard sources={data.sources} />
      )}

      {/* Saved Analyses & Comparison */}
      <SavedAnalyses 
        onCompareNiches={(ids) => setCompareIds(ids)}
        onSelectAnalysis={handleSelectAnalysis}
      />

      {/* Niche Comparison Modal */}
      {compareIds && compareIds.length >= 2 && (
        <NicheComparison 
          nicheIds={compareIds} 
          onClose={() => setCompareIds(null)} 
        />
      )}
    </div>
  );
}
