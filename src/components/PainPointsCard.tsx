import { MessageSquare, TrendingUp, Flame, Lightbulb } from "lucide-react";
import type { PainPoint } from "@/lib/api/kdp-analysis";

interface PainPointsCardProps {
  painPoints: PainPoint[];
}

export function PainPointsCard({ painPoints }: PainPointsCardProps) {
  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'reddit':
        return <span className="text-orange-500">●</span>;
      case 'quora':
        return <span className="text-red-500">●</span>;
      default:
        return <span className="text-blue-500">●</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-400";
    if (score >= 5) return "text-yellow-400";
    return "text-muted-foreground";
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-purple-500/10">
          <MessageSquare className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Real Pain Points</h3>
          <p className="text-sm text-muted-foreground">
            Extracted from Reddit, Quora & forums
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {painPoints.map((point, index) => (
          <div
            key={index}
            className="p-4 rounded-xl bg-muted/30 border border-border/30 hover:border-purple-500/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getSourceIcon(point.source)}
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {point.source}
                  </span>
                </div>
                <p className="text-foreground">{point.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Frequency</span>
                <span className={`font-bold ${getScoreColor(point.frequency)}`}>
                  {point.frequency}/10
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Intensity</span>
                <span className={`font-bold ${getScoreColor(point.intensity)}`}>
                  {point.intensity}/10
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Opportunity</span>
                <span className={`font-bold ${getScoreColor(point.opportunity)}`}>
                  {point.opportunity}/10
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
