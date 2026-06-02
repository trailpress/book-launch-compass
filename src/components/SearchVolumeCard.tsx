import { Search, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SearchVolumeCardProps {
  volume: number;
  score: number;
  source?: string | null;
}

function getVolumeLabel(volume: number): { label: string; color: string; emoji: string } {
  if (volume >= 10000) return { label: "Volume Altissimo", color: "text-success", emoji: "🔥" };
  if (volume >= 5000) return { label: "Volume Alto", color: "text-success", emoji: "📈" };
  if (volume >= 2000) return { label: "Volume Buono", color: "text-primary", emoji: "✅" };
  if (volume >= 1000) return { label: "Volume Medio", color: "text-primary", emoji: "📊" };
  if (volume >= 500) return { label: "Volume Discreto", color: "text-warning", emoji: "⚠️" };
  if (volume >= 200) return { label: "Volume Basso", color: "text-warning", emoji: "📉" };
  return { label: "Volume Molto Basso", color: "text-danger", emoji: "🔻" };
}

function getScoreBracket(score: number): string {
  if (score >= 85) return "Domanda eccellente - mercato con forte interesse attivo";
  if (score >= 75) return "Domanda alta - buon potenziale di vendita";
  if (score >= 60) return "Domanda moderata-alta - mercato promettente";
  if (score >= 45) return "Domanda moderata - valutare con attenzione il posizionamento";
  if (score >= 30) return "Domanda bassa - nicchia molto specifica";
  return "Domanda insufficiente - rischio di vendite limitate";
}

function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return volume.toLocaleString();
}

export function SearchVolumeCard({ volume, score, source }: SearchVolumeCardProps) {
  const { label, color, emoji } = getVolumeLabel(volume);
  const bracketDescription = getScoreBracket(score);
  
  // Determine ring color variant based on score
  const getVariant = () => {
    if (score >= 75) return "success";
    if (score >= 45) return "warning";
    return "danger";
  };
  
  const variant = getVariant();
  const circumference = 2 * Math.PI * 35;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const variantColors = {
    success: { ring: "stroke-success", glow: "shadow-success/20", text: "text-success", bg: "bg-success/10" },
    warning: { ring: "stroke-warning", glow: "shadow-warning/20", text: "text-warning", bg: "bg-warning/10" },
    danger: { ring: "stroke-danger", glow: "shadow-danger/20", text: "text-danger", bg: "bg-danger/10" },
  };
  
  const styles = variantColors[variant];

  return (
    <div className={cn("glass-card p-6 animate-scale-in", styles.glow)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Volume di Ricerca
          </h3>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Volume mensile di ricerche Google (mercato USA). 
                Punteggio crescente: 500-1K = 45pts, 1K-2K = 60pts, 2K-5K = 75pts, 5K-10K = 85pts, 10K+ = 95pts.
                Questo punteggio incide sul giudizio globale della nicchia.
              </p>
              {source && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Fonte: {source.slice(0, 100)}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-6">
        {/* Score Ring */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r="35"
              fill="none" stroke="currentColor" strokeWidth="6"
              className="text-muted"
            />
            <circle
              cx="40" cy="40" r="35"
              fill="none" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn("transition-all duration-1000 ease-out", styles.ring)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-lg font-bold", styles.text)}>{score}</span>
          </div>
        </div>

        {/* Volume Details */}
        <div className="flex-1 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{formatVolume(volume)}</span>
            <span className="text-sm text-muted-foreground">/mese</span>
          </div>
          
          <div className={cn("flex items-center gap-1.5", color)}>
            <span className="text-sm">{emoji}</span>
            <span className="text-sm font-medium">{label}</span>
          </div>
          
          <p className="text-xs text-muted-foreground leading-relaxed">
            {bracketDescription}
          </p>
        </div>
      </div>

      {/* Volume Scale Bar */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>0</span>
          <span>500</span>
          <span>1K</span>
          <span>2K</span>
          <span>5K</span>
          <span>10K+</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              score >= 75 ? "bg-success" : score >= 45 ? "bg-warning" : "bg-danger"
            )}
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
