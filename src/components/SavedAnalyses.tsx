import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  Trash2,
  Plus,
  GitCompare,
  RotateCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getLastAnalysisId,
  loadCachedAnalysisData,
  loadSavedAnalysesMirror,
  loadCachedAnalysisSummaries,
  mergeSavedAnalysesMirror,
  SAVED_ANALYSES_MIRROR_KEY,
} from "@/lib/api/kdp-analysis";

const SAVED_ANALYSES_CACHE_KEY = "kdp_saved_analyses_cache_v1";

interface SavedAnalysis {
  id: string;
  niche_keyword: string;
  overall_score: number;
  verdict_type: string;
  demand_score: number;
  competition_score: number;
  created_at: string;
}

interface SavedAnalysesProps {
  onSelectAnalysis?: (analysis: SavedAnalysis) => void;
  onCompareNiches?: (ids: string[]) => void;
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "";
}

function readNumber(...values: unknown[]) {
  for (const value of values) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectNestedAnalyses(value: unknown, collect: (candidate: unknown) => void, depth = 0) {
  if (depth > 3 || value == null) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectNestedAnalyses(item, collect, depth + 1));
    return;
  }

  if (isRecord(value)) {
    collect(value);
    Object.values(value).forEach((item) => collectNestedAnalyses(item, collect, depth + 1));
  }
}

export function SavedAnalyses({ onSelectAnalysis, onCompareNiches }: SavedAnalysesProps) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();

  const normalizeAnalysis = useCallback((value: unknown): SavedAnalysis | null => {
    if (!isRecord(value)) return null;

    const record = value as Record<string, unknown>;
    const nestedData = isRecord(record.data) ? record.data : null;
    const nestedScores = nestedData && isRecord(nestedData.scores) ? nestedData.scores : null;
    const nestedVerdict = nestedData && isRecord(nestedData.verdict) ? nestedData.verdict : null;
    const nestedOpportunity = nestedScores && isRecord(nestedScores.opportunity) ? nestedScores.opportunity : null;
    const nestedSaturation = nestedScores && isRecord(nestedScores.saturation) ? nestedScores.saturation : null;
    const summary = isRecord(record.summary) ? record.summary : null;

    const id = readString(summary?.id, record.id, nestedData?.analysisId, nestedData?.id);
    if (!id) return null;

    return {
      id,
      niche_keyword: readString(
        summary?.niche_keyword,
        record.niche_keyword,
        nestedData?.niche,
        nestedData?.niche_keyword,
      ) || "Analisi salvata",
      overall_score: readNumber(summary?.overall_score, record.overall_score, nestedVerdict?.confidence),
      verdict_type: readString(summary?.verdict_type, record.verdict_type, nestedVerdict?.type) || "publish-with-angle",
      demand_score: readNumber(summary?.demand_score, record.demand_score, nestedOpportunity?.score),
      competition_score: readNumber(summary?.competition_score, record.competition_score, nestedSaturation?.score),
      created_at: readString(summary?.created_at, record.created_at, nestedData?.created_at, record.cachedAt) || new Date().toISOString(),
    };
  }, []);

  const loadCachedAnalyses = useCallback((): SavedAnalysis[] => {
    const merged = new Map<string, SavedAnalysis>();
    const collect = (candidate: unknown) => {
      const normalized = normalizeAnalysis(candidate);
      if (!normalized) return;
      merged.set(normalized.id, normalized);
    };

    try {
      const primaryRaw = localStorage.getItem(SAVED_ANALYSES_CACHE_KEY);
      const primaryParsed = primaryRaw ? JSON.parse(primaryRaw) : [];

      if (Array.isArray(primaryParsed)) {
        primaryParsed.forEach(collect);
      } else {
        collect(primaryParsed);
      }

      loadSavedAnalysesMirror().forEach(collect);
      loadCachedAnalysisSummaries().forEach(collect);

      const lastAnalysisId = getLastAnalysisId();
      if (lastAnalysisId) {
        collect(loadCachedAnalysisData(lastAnalysisId));
      }

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || (!key.startsWith("kdp_") && !key.includes("analysis"))) continue;

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw) as unknown;

          collectNestedAnalyses(parsed, collect);
        } catch {
          // Ignore malformed legacy cache entries
        }
      }
    } catch {
      // Ignore cache read errors and return what we already collected
    }

    return Array.from(merged.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
  }, [normalizeAnalysis]);

  const fetchAnalyses = useCallback(async () => {
    const maxRetries = 3;
    const cachedSnapshot = loadCachedAnalyses();

    if (cachedSnapshot.length > 0) {
      setAnalyses(cachedSnapshot);
      setFetchError("Sto mostrando lo storico salvato localmente mentre provo a sincronizzare.");
      setLoading(false);
    } else {
      setLoading(true);
    }

    const fetchFromBackend = async (): Promise<SavedAnalysis[]> => {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("analysis-data", {
        body: { action: "listRecent", limit: 20 },
      });

      if (!fnError && fnData?.success && Array.isArray(fnData.data)) {
        return fnData.data as SavedAnalysis[];
      }

      const { data, error } = await supabase
        .from("niche_analyses")
        .select("id, niche_keyword, overall_score, verdict_type, demand_score, competition_score, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const safeData = await fetchFromBackend();

        const merged = new Map<string, SavedAnalysis>();
        [...cachedSnapshot, ...safeData]
          .map((entry) => normalizeAnalysis(entry))
          .filter((entry): entry is SavedAnalysis => Boolean(entry))
          .forEach((entry) => merged.set(entry.id, entry));

        const nextAnalyses = Array.from(merged.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 20);

        setAnalyses(nextAnalyses);
        setFetchError(null);

        try {
          const serialized = JSON.stringify(nextAnalyses);
          localStorage.setItem(SAVED_ANALYSES_CACHE_KEY, serialized);
          mergeSavedAnalysesMirror(safeData);
        } catch {
          // Ignore cache write errors
        }

        setLoading(false);
        return;
      } catch (err) {
        console.error(`Error fetching analyses (attempt ${attempt}/${maxRetries}):`, err);

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 800));
          continue;
        }

        const cached = loadCachedAnalyses();
        if (cached.length > 0) {
          setAnalyses(cached);
          setFetchError("Backend momentaneamente non raggiungibile: sto mostrando lo storico salvato localmente.");
        } else {
          setFetchError("Backend momentaneamente non raggiungibile e nessuna analisi locale trovata.");
        }

        setLoading(false);
      }
    }
  }, [loadCachedAnalyses]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('niche_analyses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAnalyses(prev => prev.filter(a => a.id !== id));
      setSelectedForCompare(prev => prev.filter(i => i !== id));

      try {
        [SAVED_ANALYSES_CACHE_KEY, SAVED_ANALYSES_MIRROR_KEY].forEach((key) => {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const parsed = JSON.parse(raw) as SavedAnalysis[];
          if (!Array.isArray(parsed)) return;
          const filtered = parsed.filter((item) => item.id !== id);
          localStorage.setItem(key, JSON.stringify(filtered));
        });
      } catch {
        // Ignore cache cleanup errors
      }
      
      toast({
        title: "Analysis Deleted",
        description: "The analysis has been removed.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete analysis.",
        variant: "destructive",
      });
    }
  };

  const toggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForCompare(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 3) {
        toast({
          title: "Limit Reached",
          description: "You can compare up to 3 niches at once.",
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selectedForCompare.length < 2) {
      toast({
        title: "Select More Niches",
        description: "Select at least 2 niches to compare.",
      });
      return;
    }
    onCompareNiches?.(selectedForCompare);
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "publish": return "bg-success/20 text-success";
      case "avoid": return "bg-danger/20 text-danger";
      default: return "bg-warning/20 text-warning";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <Card className="p-8 text-center space-y-4">
        <History className="w-12 h-12 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-bold">No Saved Analyses</h3>
        <p className="text-muted-foreground">
          {fetchError ?? "Your analyzed niches will appear here for comparison."}
        </p>
        <Button variant="outline" onClick={fetchAnalyses} className="gap-2">
          <RotateCw className="w-4 h-4" />
          Riprova
        </Button>
      </Card>
    );
  }

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Research History</h3>
              <p className="text-sm text-muted-foreground">
                {analyses.length} saved analyses • Select to compare
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAnalyses} className="gap-2">
              <RotateCw className="w-4 h-4" />
              Aggiorna
            </Button>
            {selectedForCompare.length >= 2 && (
              <Button onClick={handleCompare} className="gap-2">
                <GitCompare className="w-4 h-4" />
                Compare ({selectedForCompare.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="px-6 py-3 border-b border-border bg-muted/40">
          <p className="text-sm text-muted-foreground">{fetchError}</p>
        </div>
      )}

      <div className="divide-y divide-border">
        {analyses.map((analysis) => {
          const isSelected = selectedForCompare.includes(analysis.id);
          const date = new Date(analysis.created_at);
          
          return (
            <div
              key={analysis.id}
              onClick={() => onSelectAnalysis?.(analysis)}
              className={cn(
                "p-4 flex items-center gap-4 cursor-pointer transition-all hover:bg-muted/50",
                isSelected && "bg-primary/5"
              )}
            >
              {/* Checkbox for compare */}
              <button
                onClick={(e) => toggleCompare(analysis.id, e)}
                className={cn(
                  "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 hover:border-primary"
                )}
              >
                {isSelected && <Plus className="w-4 h-4 rotate-45" />}
              </button>

              {/* Analysis Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold truncate">{analysis.niche_keyword}</h4>
                  <Badge 
                    variant="secondary" 
                    className={cn("text-xs shrink-0", getVerdictColor(analysis.verdict_type))}
                  >
                    {analysis.verdict_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Score: <strong className="text-foreground">{analysis.overall_score}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    Demand: 
                    {analysis.demand_score >= 70 ? (
                      <TrendingUp className="w-3 h-3 text-success" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-danger" />
                    )}
                  </span>
                  <span className="hidden md:inline">
                    {date.toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(analysis.id, e)}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
