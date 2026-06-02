import { cn } from "@/lib/utils";
import { Lightbulb, AlertCircle, Target, Zap } from "lucide-react";

interface OpportunityMapProps {
  gaps: string[];
  weaknesses: string[];
  underserved: string[];
  opportunities: string[];
}

export function OpportunityMap({
  gaps,
  weaknesses,
  underserved,
  opportunities,
}: OpportunityMapProps) {
  const sections = [
    {
      title: "Market Gaps",
      subtitle: "What's missing in the market",
      items: gaps,
      icon: Target,
      gradient: "from-primary to-blue-400",
      bg: "bg-primary/10",
    },
    {
      title: "Competitor Weaknesses",
      subtitle: "Pain points from reviews",
      items: weaknesses,
      icon: AlertCircle,
      gradient: "from-warning to-amber-400",
      bg: "bg-warning/10",
    },
    {
      title: "Underserved Audiences",
      subtitle: "Neglected buyer segments",
      items: underserved,
      icon: Zap,
      gradient: "from-danger to-rose-400",
      bg: "bg-danger/10",
    },
    {
      title: "Actionable Opportunities",
      subtitle: "Your competitive edge",
      items: opportunities,
      icon: Lightbulb,
      gradient: "from-success to-emerald-400",
      bg: "bg-success/10",
    },
  ];

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="mb-6">
        <h3 className="text-xl font-bold">Opportunity Mapping</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Strategic gaps and weaknesses to exploit
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <div
              key={i}
              className={cn(
                "p-5 rounded-xl border border-border/50 transition-all duration-300 hover:border-border",
                section.bg
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    "p-2 rounded-lg bg-gradient-to-br",
                    section.gradient
                  )}
                >
                  <Icon className="w-4 h-4 text-background" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">
                    {section.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {section.subtitle}
                  </p>
                </div>
              </div>

              <ul className="space-y-2">
                {section.items.map((item, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full mt-2 bg-gradient-to-r flex-shrink-0",
                        section.gradient
                      )}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
