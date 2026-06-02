import { Lightbulb, TrendingUp, AlertCircle, Target, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopPainPoint {
  rank: number;
  category: string;
  description: string;
  score: number;
  frequency: number;
  intensity: number;
  solvability: number;
  covered?: boolean;
}

interface DemandSupplyGapProps {
  keyInsight: string;
  marketGaps: string[];
  topPainPoints: TopPainPoint[];
}

export function DemandSupplyGap({
  keyInsight,
  marketGaps,
  topPainPoints,
}: DemandSupplyGapProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-success";
    if (score >= 6) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="glass-card overflow-hidden animate-slide-up">
      <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Lightbulb className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Analisi del Gap Domanda-Offerta</h3>
            <p className="text-sm text-muted-foreground">
              Principali takeaway dall'analisi dei pain point e della competizione
            </p>
          </div>
        </div>

        {/* Key Insight */}
        <div className="mb-6 p-4 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Insight chiave</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{keyInsight}</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Market Gaps */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Lacune di Mercato Chiave
              </h4>
            </div>
            <ul className="space-y-2">
              {marketGaps.map((gap, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  {gap}
                </li>
              ))}
            </ul>
          </div>

          {/* Top Pain Points */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-danger" />
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Top Pain Point da Reddit
              </h4>
            </div>
            <div className="space-y-4">
              {topPainPoints.slice(0, 3).map((pp) => (
                <div
                  key={pp.rank}
                  className={cn(
                    "p-4 rounded-lg border",
                    pp.covered
                      ? "bg-success/5 border-success/20"
                      : "bg-muted/50 border-border/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{pp.rank}</span>
                      <span className="text-xs font-semibold uppercase text-primary">
                        {pp.category}
                      </span>
                      {pp.covered && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">
                          Coperto
                        </span>
                      )}
                    </div>
                    <span className={cn("text-lg font-bold", getScoreColor(pp.score))}>
                      {pp.score.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mb-3">{pp.description}</p>

                  {/* Scores */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-background/50">
                      <p className="text-muted-foreground">Frequenza</p>
                      <p className={cn("font-bold", getScoreColor(pp.frequency))}>
                        {pp.frequency.toFixed(1)}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-background/50">
                      <p className="text-muted-foreground">Intensità</p>
                      <p className={cn("font-bold", getScoreColor(pp.intensity))}>
                        {pp.intensity.toFixed(1)}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-background/50">
                      <p className="text-muted-foreground">Risolvibilità</p>
                      <p className={cn("font-bold", getScoreColor(pp.solvability))}>
                        {pp.solvability.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
