import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  DollarSign, 
  AlertTriangle, 
  BookOpen, 
  ShieldCheck 
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface KeyInsight {
  type: "opportunity" | "pricing" | "risk" | "format" | "compliance";
  text: string;
}

interface KeyInsightsBarProps {
  insights: KeyInsight[];
}

const insightConfig = {
  opportunity: {
    icon: Lightbulb,
    label: "Opportunity",
    className: "bg-success/10 text-success border-success/30",
  },
  pricing: {
    icon: DollarSign,
    label: "Pricing",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  risk: {
    icon: AlertTriangle,
    label: "Risk",
    className: "bg-danger/10 text-danger border-danger/30",
  },
  format: {
    icon: BookOpen,
    label: "Format",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  compliance: {
    icon: ShieldCheck,
    label: "Compliance",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function KeyInsightsBar({ insights }: KeyInsightsBarProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="glass-card p-4 animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-gold/20">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-lg">Insights Chiave</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, index) => {
          const config = insightConfig[insight.type];
          const Icon = config.icon;

          return (
            <div
              key={index}
              className={cn(
                "p-3 rounded-lg border flex items-start gap-3 transition-all hover:scale-[1.02]",
                config.className
              )}
            >
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <Badge variant="outline" className="text-xs mb-1">
                  {config.label}
                </Badge>
                <p className="text-sm leading-relaxed">{insight.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
