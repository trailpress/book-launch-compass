import { cn } from "@/lib/utils";
import { BookOpen, DollarSign, FileText, Megaphone, Users } from "lucide-react";

interface PatternDetectionProps {
  pageCountRange: string;
  priceSweet: string;
  emotionalPromises: string[];
  targetLanguage: string[];
  structuralPatterns: string[];
}

export function PatternDetection({
  pageCountRange,
  priceSweet,
  emotionalPromises,
  targetLanguage,
  structuralPatterns,
}: PatternDetectionProps) {
  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="mb-6">
        <h3 className="text-xl font-bold">Success DNA Analysis</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Common traits among top performers
        </p>
      </div>

      <div className="grid gap-4">
        {/* Page Count & Price */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Page Count
              </span>
            </div>
            <p className="text-xl font-bold text-foreground">{pageCountRange}</p>
          </div>

          <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-success" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Price Sweet Spot
              </span>
            </div>
            <p className="text-xl font-bold text-success">{priceSweet}</p>
          </div>
        </div>

        {/* Emotional Promises */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="w-4 h-4 text-warning" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Emotional Promises That Sell
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {emotionalPromises.map((promise, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20 text-sm text-warning"
              >
                {promise}
              </span>
            ))}
          </div>
        </div>

        {/* Target Audience Language */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Target Audience Keywords
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {targetLanguage.map((keyword, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        {/* Structural Patterns */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-success" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Title/Subtitle Patterns
            </span>
          </div>
          <ul className="space-y-2">
            {structuralPatterns.map((pattern, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
                <span>{pattern}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
