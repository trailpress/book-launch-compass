import { Target, Users, Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface StrategicAngle {
  rank: number;
  title: string;
  subtitle: string;
  angle: string;
  targetAudience: string;
  painPointsAddressed: string[];
  competitiveAdvantage: string;
}

interface StrategicAnglesProps {
  reasoning: string;
  angles: StrategicAngle[];
}

export function StrategicAngles({ reasoning, angles }: StrategicAnglesProps) {
  const rankColors = [
    "from-gold via-amber-400 to-orange-400",
    "from-primary via-blue-400 to-cyan-400",
    "from-success via-emerald-400 to-teal-400",
  ];

  return (
    <div className="glass-card overflow-hidden animate-slide-up">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-gold to-success" />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-gold/20">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Raccomandazioni Strategiche</h3>
            <p className="text-sm text-muted-foreground">
              Strategie di posizionamento basate sull'analisi di mercato
            </p>
          </div>
        </div>

        {/* Strategic Reasoning */}
        <div className="mb-8 p-4 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ragionamento Strategico
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{reasoning}</p>
        </div>

        {/* Top 3 Angles */}
        <div className="space-y-6">
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-gold" />
            Top Tre Angolazioni Consigliate
          </h4>

          {angles.slice(0, 3).map((angle, index) => (
            <div
              key={index}
              className="p-5 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all"
            >
              {/* Title Header */}
              <div className="flex items-start gap-4 mb-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-gradient-to-br text-background shrink-0",
                    rankColors[index] || rankColors[2]
                  )}
                >
                  {angle.rank}
                </div>
                <div className="flex-1">
                  <h5 className="text-lg font-bold mb-1">{angle.title}</h5>
                  <p className="text-sm text-muted-foreground italic">
                    {angle.subtitle}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Target className="w-3 h-3" />
                    <span className="font-semibold">Angolazione</span>
                  </div>
                  <p className="text-sm">{angle.angle}</p>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Users className="w-3 h-3" />
                    <span className="font-semibold">Pubblico Target</span>
                  </div>
                  <p className="text-sm">{angle.targetAudience}</p>
                </div>
              </div>

              {/* Pain Points */}
              <div className="mb-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="font-semibold">Pain Point Affrontati:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {angle.painPointsAddressed.map((pp, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {pp}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Competitive Advantage */}
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-1 text-xs text-success mb-1">
                  <CheckCircle className="w-3 h-3" />
                  <span className="font-semibold">Vantaggio Competitivo:</span>
                </div>
                <p className="text-sm text-foreground">{angle.competitiveAdvantage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
