import { DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfitabilityScoreProps {
  score: number;
  dailyRoyaltyRange: {
    min: number;
    max: number;
  };
  level: "high" | "medium" | "low";
  description: string;
}

export function ProfitabilityScore({
  score,
  dailyRoyaltyRange,
  level,
  description,
}: ProfitabilityScoreProps) {
  const levelConfig = {
    high: {
      label: "ALTO",
      gradient: "from-success to-emerald-400",
      bg: "bg-success/10",
      border: "border-success/30",
      color: "text-success",
    },
    medium: {
      label: "MEDIO",
      gradient: "from-warning to-amber-400",
      bg: "bg-warning/10",
      border: "border-warning/30",
      color: "text-warning",
    },
    low: {
      label: "BASSO",
      gradient: "from-danger to-rose-400",
      bg: "bg-danger/10",
      border: "border-danger/30",
      color: "text-danger",
    },
  };

  const config = levelConfig[level];

  return (
    <div className={cn("glass-card overflow-hidden animate-slide-up")}>
      <div className={cn("h-1 w-full bg-gradient-to-r", config.gradient)} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <span className="text-sm uppercase tracking-widest text-muted-foreground font-semibold">
              Redditività
            </span>
          </div>
          <div
            className={cn(
              "px-3 py-1 rounded-full text-sm font-bold",
              config.bg,
              config.color
            )}
          >
            {score}%
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold gradient-text-gold">
            ${(dailyRoyaltyRange?.min ?? 0).toFixed(2)} - ${(dailyRoyaltyRange?.max ?? 0).toFixed(2)}
          </span>
          <span className="text-muted-foreground text-sm">/giorno</span>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-muted-foreground">Punteggio Redditività</span>
            <span className={cn("font-bold", config.color)}>{config.label}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
