import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, Sparkles } from "lucide-react";

type VerdictType = "publish" | "publish-with-angle" | "avoid";

interface MarketVerdictProps {
  verdict: VerdictType;
  confidence: number;
  summary: string;
  keyInsights: string[];
}

const verdictConfig = {
  publish: {
    icon: CheckCircle2,
    title: "Strong Opportunity",
    subtitle: "Publish Now",
    gradient: "from-success via-emerald-500 to-teal-400",
    bg: "bg-success/10",
    border: "border-success/30",
    glow: "shadow-success/20",
  },
  "publish-with-angle": {
    icon: Sparkles,
    title: "Conditional Opportunity",
    subtitle: "Publish with Unique Angle",
    gradient: "from-warning via-amber-500 to-orange-400",
    bg: "bg-warning/10",
    border: "border-warning/30",
    glow: "shadow-warning/20",
  },
  avoid: {
    icon: XCircle,
    title: "High Risk Market",
    subtitle: "Avoid This Niche",
    gradient: "from-danger via-rose-500 to-red-400",
    bg: "bg-danger/10",
    border: "border-danger/30",
    glow: "shadow-danger/20",
  },
};

export function MarketVerdict({
  verdict,
  confidence,
  summary,
  keyInsights,
}: MarketVerdictProps) {
  const config = verdictConfig[verdict];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "glass-card overflow-hidden animate-slide-up",
        config.glow,
        "shadow-xl"
      )}
    >
      <div
        className={cn(
          "h-1 w-full bg-gradient-to-r",
          config.gradient
        )}
      />

      <div className="p-8">
        <div className="flex items-start gap-6">
          <div
            className={cn(
              "p-4 rounded-2xl",
              config.bg,
              config.border,
              "border"
            )}
          >
            <Icon className={cn("w-10 h-10 bg-gradient-to-br bg-clip-text", config.gradient)} style={{ color: "transparent", background: `linear-gradient(135deg, var(--tw-gradient-stops))`, WebkitBackgroundClip: "text" }} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Market Verdict
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold",
                config.bg,
                "text-foreground"
              )}>
                {confidence}% confidence
              </span>
            </div>

            <h2 className={cn(
              "text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent mb-1",
              config.gradient
            )}>
              {config.title}
            </h2>
            <p className="text-lg text-muted-foreground font-medium">
              {config.subtitle}
            </p>
          </div>
        </div>

        <div className={cn("mt-6 p-4 rounded-xl", config.bg)}>
          <p className="text-foreground leading-relaxed">{summary}</p>
        </div>

        <div className="mt-6 grid gap-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Key Insights
          </h4>
          {keyInsights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-3 text-sm text-muted-foreground"
            >
              <div className={cn("w-1.5 h-1.5 rounded-full mt-2 bg-gradient-to-r", config.gradient)} />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
