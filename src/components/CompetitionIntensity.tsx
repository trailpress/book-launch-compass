import { Users, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompetitionIntensityProps {
  level: "high" | "medium" | "low";
  selfPublishedCount: number;
  totalAnalyzed: number;
  description: string;
  bsrReviewCorrelation?: string;
  vulnerabilities?: string[];
}

export function CompetitionIntensity({
  level,
  selfPublishedCount,
  totalAnalyzed,
  description,
  bsrReviewCorrelation,
  vulnerabilities = [],
}: CompetitionIntensityProps) {
  const levelConfig = {
    high: {
      label: "ALTA",
      gradient: "from-danger to-rose-400",
      bg: "bg-danger/10",
      border: "border-danger/30",
      color: "text-danger",
    },
    medium: {
      label: "MEDIA",
      gradient: "from-warning to-amber-400",
      bg: "bg-warning/10",
      border: "border-warning/30",
      color: "text-warning",
    },
    low: {
      label: "BASSA",
      gradient: "from-success to-emerald-400",
      bg: "bg-success/10",
      border: "border-success/30",
      color: "text-success",
    },
  };

  const config = levelConfig[level];

  return (
    <div className={cn("glass-card overflow-hidden animate-slide-up")}>
      <div className={cn("h-1 w-full bg-gradient-to-r", config.gradient)} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm uppercase tracking-widest text-muted-foreground font-semibold">
              Intensità Competizione
            </span>
          </div>
          <div
            className={cn(
              "px-3 py-1 rounded-full text-sm font-bold",
              config.bg,
              config.color
            )}
          >
            {config.label}
          </div>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <p className="text-sm">
            <span className="font-bold text-foreground">Self-published identificati: </span>
            <span className="text-muted-foreground">
              {selfPublishedCount} su {totalAnalyzed} risultati
            </span>
          </p>
        </div>

        {bsrReviewCorrelation && (
          <p className="text-sm text-muted-foreground mb-3">
            <span className="font-semibold text-foreground">Correlazione BSR/recensioni: </span>
            {bsrReviewCorrelation}
          </p>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>

        {vulnerabilities.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2 font-semibold">Vulnerabilità identificate:</p>
            <ul className="space-y-1">
              {vulnerabilities.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3 h-3 mt-0.5 text-warning shrink-0" />
                  {v}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
