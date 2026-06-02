import { useState } from "react";
import { cn } from "@/lib/utils";
import { BookOpen, Users, Heart, Sparkles, Target, BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { BookOutlineModal, BookOutline } from "./BookOutlineModal";
import { generateBookOutline } from "@/lib/api/generate-outline";
import { AnalysisData } from "@/lib/api/kdp-analysis";
import { useToast } from "@/hooks/use-toast";

interface StrategyBlueprintProps {
  suggestedTitle: string;
  suggestedSubtitle: string;
  targetAudience: string;
  painPoints: string[];
  uniqueAngle: string;
  emotionalHook: string;
  corePromise: string;
  competitiveAdvantage: string;
  analysisData?: AnalysisData;
}

export function StrategyBlueprint({
  suggestedTitle,
  suggestedSubtitle,
  targetAudience,
  painPoints,
  uniqueAngle,
  emotionalHook,
  corePromise,
  competitiveAdvantage,
  analysisData,
}: StrategyBlueprintProps) {
  const [isOutlineModalOpen, setIsOutlineModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outline, setOutline] = useState<BookOutline | null>(null);
  const { toast } = useToast();

  const handleGenerateOutline = async () => {
    if (!analysisData) {
      toast({
        title: "Dati mancanti",
        description: "Esegui prima un'analisi completa per generare l'outline",
        variant: "destructive"
      });
      return;
    }

    setIsOutlineModalOpen(true);
    setIsGenerating(true);

    try {
      const result = await generateBookOutline(analysisData);
      
      if (result.success && result.outline) {
        setOutline(result.outline);
        toast({
          title: "Blueprint generato!",
          description: `${result.outline.totalChapters} capitoli creati`
        });
      } else {
        toast({
          title: "Generazione fallita",
          description: result.error || "Errore durante la generazione",
          variant: "destructive"
        });
        setIsOutlineModalOpen(false);
      }
    } catch (error) {
      console.error('Outline generation error:', error);
      toast({
        title: "Errore",
        description: "Impossibile generare l'outline",
        variant: "destructive"
      });
      setIsOutlineModalOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="glass-card overflow-hidden animate-slide-up">
        <div className="h-1 w-full bg-gradient-to-r from-gold via-amber-400 to-orange-400" />

        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-gradient-to-br from-gold to-amber-500">
              <Sparkles className="w-6 h-6 text-gold-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Strategic Publishing Blueprint</h3>
              <p className="text-sm text-muted-foreground">
                AI-generated positioning strategy
              </p>
            </div>
          </div>

          {/* Title Suggestion */}
          <div className="mb-8 p-6 rounded-xl bg-gradient-to-br from-muted to-muted/50 border border-border/50">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Suggested Title
            </p>
            <h4 className="text-2xl font-bold text-foreground mb-1">
              {suggestedTitle}
            </h4>
            <p className="text-lg text-muted-foreground">{suggestedSubtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Target Audience */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h5 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Target Audience
                </h5>
              </div>
              <p className="text-foreground">{targetAudience}</p>
            </div>

            {/* Pain Points */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-destructive" />
                <h5 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Pain Points Addressed
                </h5>
              </div>
              <ul className="space-y-1">
                {painPoints.map((point, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <div className="w-1 h-1 rounded-full bg-destructive" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Unique Angle */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-warning" />
                <h5 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Unique Angle
                </h5>
              </div>
              <p className="text-foreground">{uniqueAngle}</p>
            </div>

            {/* Emotional Hook */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-success" />
                <h5 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Emotional Hook
                </h5>
              </div>
              <p className="text-foreground italic">"{emotionalHook}"</p>
            </div>
          </div>

          {/* Core Promise & Advantage */}
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-success/10 border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <BadgeCheck className="w-4 h-4 text-success" />
                <h5 className="font-semibold text-success text-sm">Core Promise</h5>
              </div>
              <p className="text-sm text-foreground">{corePromise}</p>
            </div>

            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h5 className="font-semibold text-primary text-sm">
                  Competitive Advantage
                </h5>
              </div>
              <p className="text-sm text-foreground">{competitiveAdvantage}</p>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <Button 
              variant="premium" 
              size="lg" 
              className="flex-1"
              onClick={handleGenerateOutline}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                "Genera Outline Completo"
              )}
            </Button>
            <Button variant="outline" size="lg">
              Esporta Strategia
            </Button>
          </div>
        </div>
      </div>

      <BookOutlineModal
        isOpen={isOutlineModalOpen}
        onClose={() => setIsOutlineModalOpen(false)}
        outline={outline}
        niche={analysisData?.niche || ""}
        isLoading={isGenerating}
      />
    </>
  );
}
