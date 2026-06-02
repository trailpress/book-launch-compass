import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ScoreCardProps {
  title: string;
  score: number;
  maxScore?: number;
  description: string;
  trend?: "up" | "down" | "stable";
  variant?: "success" | "warning" | "danger" | "primary";
  delay?: number;
}

const variantStyles = {
  success: {
    ring: "from-success to-emerald-400",
    glow: "shadow-success/20",
    text: "text-success",
    bg: "bg-success/10",
  },
  warning: {
    ring: "from-warning to-amber-400",
    glow: "shadow-warning/20",
    text: "text-warning",
    bg: "bg-warning/10",
  },
  danger: {
    ring: "from-danger to-rose-400",
    glow: "shadow-danger/20",
    text: "text-danger",
    bg: "bg-danger/10",
  },
  primary: {
    ring: "from-primary to-blue-400",
    glow: "shadow-primary/20",
    text: "text-primary",
    bg: "bg-primary/10",
  },
};

export function ScoreCard({
  title,
  score,
  maxScore = 100,
  description,
  trend,
  variant = "primary",
  delay = 0,
}: ScoreCardProps) {
  const percentage = (score / maxScore) * 100;
  const styles = variantStyles[variant];
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={cn(
        "glass-card p-6 animate-scale-in hover:scale-[1.02] transition-transform duration-300",
        styles.glow
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trend === "up" && "bg-success/20 text-success",
              trend === "down" && "bg-danger/20 text-danger",
              trend === "stable" && "bg-muted text-muted-foreground"
            )}
          >
            {trend === "up" && <TrendingUp className="w-3 h-3" />}
            {trend === "down" && <TrendingDown className="w-3 h-3" />}
            {trend === "stable" && <Minus className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
              style={{
                filter: `drop-shadow(0 0 8px hsl(var(--${variant})))`,
              }}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" className={cn("stop-color-current", styles.text)} />
                <stop offset="100%" className={cn("stop-color-current", styles.text)} style={{ opacity: 0.6 }} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-2xl font-bold", styles.text)}>{score}</span>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
