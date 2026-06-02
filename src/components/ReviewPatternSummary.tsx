import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, TrendingUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReviewPattern {
  theme: string;
  description: string;
  frequency: number;
  sampleQuotes: string[];
}

export interface ReviewPatterns {
  positivePatterns: ReviewPattern[];
  negativePatterns: ReviewPattern[];
  summary: string;
  totalReviewsAnalyzed: number;
  averageRating: number;
}

interface ReviewPatternSummaryProps {
  patterns: ReviewPatterns;
}

function PatternItem({ pattern, maxFreq, variant }: { pattern: ReviewPattern; maxFreq: number; variant: "positive" | "negative" }) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = variant === "positive";
  const colorClass = isPositive ? "success" : "destructive";

  return (
    <div
      className={cn(
        "p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md",
        isPositive ? "bg-success/5 border-success/10 hover:border-success/30" : "bg-destructive/5 border-destructive/10 hover:border-destructive/30"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{pattern.theme}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <TrendingUp className={cn("w-3 h-3", `text-${colorClass}`)} />
            <span className="text-xs text-muted-foreground">{pattern.frequency}/10</span>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")} />
        </div>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full mb-2">
        <div
          className={cn("h-full rounded-full transition-all", isPositive ? "bg-success" : "bg-destructive")}
          style={{ width: `${(pattern.frequency / maxFreq) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pattern.description}</p>

      {expanded && pattern.sampleQuotes?.length > 0 && (
        <div className="mt-3 space-y-2 animate-fade-in">
          <p className="text-xs font-medium text-foreground/70">Citazioni ({pattern.sampleQuotes.length})</p>
          {pattern.sampleQuotes.map((q, qi) => (
            <p key={qi} className={cn("text-xs italic text-foreground/60 pl-3 border-l-2", isPositive ? "border-success/30" : "border-destructive/30")}>
              "{q}"
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewPatternSummary({ patterns }: ReviewPatternSummaryProps) {
  if (!patterns || (!patterns.positivePatterns?.length && !patterns.negativePatterns?.length)) {
    return null;
  }

  const maxFreq = Math.max(
    ...patterns.positivePatterns.map(p => p.frequency),
    ...patterns.negativePatterns.map(p => p.frequency),
    1
  );

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-amber-500/10">
          <MessageSquare className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Pattern dalle Recensioni Amazon</h3>
          <p className="text-sm text-muted-foreground">
            {patterns.totalReviewsAnalyzed} recensioni analizzate • Rating medio: {patterns.averageRating?.toFixed(1) || "N/A"}/5
          </p>
        </div>
      </div>

      {patterns.summary && (
        <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border/30">
          <p className="text-sm text-foreground/90 leading-relaxed">{patterns.summary}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {patterns.positivePatterns?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ThumbsUp className="w-4 h-4 text-success" />
              <h4 className="font-semibold text-success">Pattern Positivi Ricorrenti</h4>
            </div>
            <div className="space-y-3">
              {patterns.positivePatterns.map((pattern, i) => (
                <PatternItem key={i} pattern={pattern} maxFreq={maxFreq} variant="positive" />
              ))}
            </div>
          </div>
        )}

        {patterns.negativePatterns?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ThumbsDown className="w-4 h-4 text-destructive" />
              <h4 className="font-semibold text-destructive">Pattern Negativi Ricorrenti</h4>
            </div>
            <div className="space-y-3">
              {patterns.negativePatterns.map((pattern, i) => (
                <PatternItem key={i} pattern={pattern} maxFreq={maxFreq} variant="negative" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
