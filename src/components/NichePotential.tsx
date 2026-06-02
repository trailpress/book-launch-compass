import { Target, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface NichePotentialProps {
  dailyPotential: number;
  entryDifficulty: "high" | "medium" | "low";
  entryDescription: string;
  strategies: string[];
}

export function NichePotential({
  dailyPotential,
  entryDifficulty,
  entryDescription,
  strategies,
}: NichePotentialProps) {
  const difficultyConfig = {
    high: {
      label: "ALTO",
      color: "text-danger",
      bg: "bg-danger/10",
    },
    medium: {
      label: "MEDIO",
      color: "text-warning",
      bg: "bg-warning/10",
    },
    low: {
      label: "BASSO",
      color: "text-success",
      bg: "bg-success/10",
    },
  };

  const config = difficultyConfig[entryDifficulty];

  return (
    <div className="glass-card overflow-hidden animate-slide-up">
      <div className="h-1 w-full bg-gradient-to-r from-gold via-amber-400 to-orange-400" />

      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-gold" />
          <span className="text-sm uppercase tracking-widest text-muted-foreground font-semibold">
            Potenziale di Nicchia
          </span>
        </div>

        <div className="text-center py-6 mb-4 rounded-xl bg-gradient-to-br from-gold/10 to-amber-500/10 border border-gold/20">
          <p className="text-xs text-muted-foreground mb-2">
            scenario medio-alto raggiungibile con angolo forte
          </p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold gradient-text-gold">
              ${(dailyPotential ?? 0).toFixed(2)}
            </span>
            <span className="text-muted-foreground">/ giorno</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Difficoltà di Ingresso</span>
            </div>
            <div className={cn("px-2 py-1 rounded-full text-sm font-bold w-fit", config.bg, config.color)}>
              {config.label}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{entryDescription}</p>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-sm font-semibold">Strategie Consigliate</span>
            </div>
            <ul className="space-y-1.5">
              {strategies.slice(0, 3).map((strategy, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  {strategy}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {strategies.length > 3 && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground font-semibold mb-2">Altre strategie:</p>
            <ul className="space-y-1">
              {strategies.slice(3).map((strategy, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  {strategy}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
