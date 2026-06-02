import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy,
  Check,
  Sparkles,
  Target,
  Zap,
  Heart,
  AlertTriangle,
  TrendingUp,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SuggestedTitle {
  title: string;
  subtitle: string;
  fullTitle: string;
  charCount: number;
  framework: string;
  emotionalTrigger: string;
  uniqueAngle: string;
  targetPainPoint: string;
  conversionScore: number;
}

interface TitleGeneratorProps {
  titles: SuggestedTitle[];
  niche: string;
}

const frameworkInfo: Record<string, { name: string; description: string; icon: React.ComponentType<any> }> = {
  "AIDA": { 
    name: "AIDA", 
    description: "Attention, Interest, Desire, Action - Classic advertising formula",
    icon: Target
  },
  "PAS": { 
    name: "PAS", 
    description: "Problem, Agitation, Solution - Emphasizes pain before relief",
    icon: AlertTriangle
  },
  "4Us": { 
    name: "4U's", 
    description: "Useful, Urgent, Unique, Ultra-specific",
    icon: Zap
  },
  "BAB": { 
    name: "BAB", 
    description: "Before, After, Bridge - Shows transformation",
    icon: TrendingUp
  },
  "FAB": { 
    name: "FAB", 
    description: "Features, Advantages, Benefits - Logical progression",
    icon: Sparkles
  },
};

const emotionColors: Record<string, string> = {
  "fear": "bg-danger/20 text-danger",
  "greed": "bg-success/20 text-success",
  "curiosity": "bg-primary/20 text-primary",
  "urgency": "bg-warning/20 text-warning",
  "exclusivity": "bg-gold/20 text-gold",
};

export function TitleGenerator({ titles, niche }: TitleGeneratorProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const { toast } = useToast();

  const handleCopy = async (fullTitle: string, index: number) => {
    await navigator.clipboard.writeText(fullTitle);
    setCopiedIndex(index);
    toast({
      title: "Title Copied!",
      description: "The title has been copied to your clipboard.",
    });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!titles || titles.length === 0) {
    return null;
  }

  const selectedTitle = titles[selectedIndex];

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-gold/20">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold">AI Title Generator</h3>
            <p className="text-sm text-muted-foreground">
              Direct response marketing optimized • Max 195 characters
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Title Cards Grid */}
        <div className="grid gap-4 mb-6">
          {titles.map((title, index) => {
            const framework = frameworkInfo[title.framework] || frameworkInfo["AIDA"];
            const FrameworkIcon = framework.icon;
            const isSelected = index === selectedIndex;
            const isValidLength = title.charCount <= 195;

            return (
              <Card
                key={index}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "p-4 cursor-pointer transition-all border-2",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:border-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="secondary" className="gap-1">
                        <FrameworkIcon className="w-3 h-3" />
                        {title.framework}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={emotionColors[title.emotionalTrigger] || ""}
                      >
                        <Heart className="w-3 h-3 mr-1" />
                        {title.emotionalTrigger}
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={cn(
                          isValidLength ? "border-success text-success" : "border-danger text-danger"
                        )}
                      >
                        {title.charCount}/195 chars
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "gap-1",
                          title.conversionScore >= 80 
                            ? "border-success text-success" 
                            : title.conversionScore >= 60 
                            ? "border-warning text-warning"
                            : "border-danger text-danger"
                        )}
                      >
                        <TrendingUp className="w-3 h-3" />
                        {title.conversionScore}% conversion
                      </Badge>
                    </div>

                    <h4 className="font-bold text-lg mb-1">{title.title}</h4>
                    <p className="text-muted-foreground">{title.subtitle}</p>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(title.fullTitle, index);
                    }}
                    className="shrink-0"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Selected Title Details */}
        {selectedTitle && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              <span className="font-medium">Why This Title Works</span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <TooltipProvider>
                <div className="space-y-3">
                  <div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted">
                          Framework Used
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          {frameworkInfo[selectedTitle.framework]?.description || "Marketing framework"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    <p className="font-medium">{selectedTitle.framework}</p>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground">
                      Emotional Trigger
                    </span>
                    <p className="font-medium capitalize">{selectedTitle.emotionalTrigger}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Target Pain Point
                    </span>
                    <p className="font-medium">{selectedTitle.targetPainPoint}</p>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground">
                      Unique Angle
                    </span>
                    <p className="font-medium">{selectedTitle.uniqueAngle}</p>
                  </div>
                </div>
              </TooltipProvider>
            </div>

            <div className="pt-3 border-t border-border">
              <Button 
                onClick={() => handleCopy(selectedTitle.fullTitle, selectedIndex)}
                className="w-full gap-2"
              >
                {copiedIndex === selectedIndex ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Full Title ({selectedTitle.charCount} chars)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
