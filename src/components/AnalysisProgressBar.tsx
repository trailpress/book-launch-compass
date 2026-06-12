import { useEffect, useState } from "react";
import { Progress } from "./ui/progress";
import { 
  Search, 
  BookOpen, 
  MessageSquare, 
  Brain, 
  CheckCircle2,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Phase {
  id: string;
  label: string;
  icon: React.ReactNode;
  duration: number; // estimated duration in seconds
}

const phases: Phase[] = [
  { 
    id: "amazon", 
    label: "Scraping Amazon", 
    icon: <Search className="w-4 h-4" />,
    duration: 30
  },
  { 
    id: "reviews", 
    label: "Analisi recensioni", 
    icon: <BookOpen className="w-4 h-4" />,
    duration: 25
  },
  { 
    id: "social", 
    label: "Scraping social", 
    icon: <MessageSquare className="w-4 h-4" />,
    duration: 20
  },
  { 
    id: "ai", 
    label: "Elaborazione AI", 
    icon: <Brain className="w-4 h-4" />,
    duration: 45
  },
];

interface AnalysisProgressBarProps {
  niche: string;
  isLoading: boolean;
  startedAt?: number | null;
}

export function AnalysisProgressBar({ niche, isLoading, startedAt }: AnalysisProgressBarProps) {
  // Calculate initial elapsed time from persisted start
  const initialElapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(initialElapsed);

  // Calculate total duration
  const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0);

  useEffect(() => {
    if (!isLoading) {
      setCurrentPhaseIndex(0);
      setProgress(0);
      setElapsedTime(0);
      return;
    }

    // On resume, fast-forward progress and phase based on elapsed time
    const elapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
    if (elapsed > 0) {
      setElapsedTime(elapsed);
      // Calculate progress based on elapsed time without claiming completion.
      const progressRatio = Math.min(elapsed / totalDuration, 0.99);
      setProgress(progressRatio * 100);
      // Calculate which phase we should be in
      let cumulative = 0;
      for (let i = 0; i < phases.length; i++) {
        cumulative += phases[i].duration;
        if (elapsed < cumulative) {
          setCurrentPhaseIndex(i);
          break;
        }
        if (i === phases.length - 1) {
          setCurrentPhaseIndex(phases.length - 1);
        }
      }
    }

    // Increment elapsed time every second
    const timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        // Slow down as we approach completion. The backend decides when the
        // analysis is actually done; the bar never reaches 100% on its own.
        const increment = prev < 50 ? 1.5 : prev < 80 ? 0.8 : 0.3;
        return Math.min(prev + increment, 99);
      });
    }, 1000);

    // Phase transitions
    let phaseTime = elapsed; // Start from elapsed time on resume
    const phaseInterval = setInterval(() => {
      phaseTime += 1;
      
      // Calculate cumulative duration for current phase
      let cumulativeDuration = 0;
      for (let i = 0; i <= currentPhaseIndex; i++) {
        cumulativeDuration += phases[i].duration;
      }

      // Move to next phase when time exceeds cumulative duration
      if (phaseTime >= cumulativeDuration && currentPhaseIndex < phases.length - 1) {
        setCurrentPhaseIndex(prev => Math.min(prev + 1, phases.length - 1));
      }
    }, 1000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(progressInterval);
      clearInterval(phaseInterval);
    };
  }, [isLoading, currentPhaseIndex, startedAt, totalDuration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isFinalVerification = elapsedTime > totalDuration;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Main progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progresso analisi</span>
          <span className="font-mono text-primary">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Tempo trascorso: {formatTime(elapsedTime)}</span>
          <span>{isFinalVerification ? "Verifica risultati..." : "Tempo stimato: 2-5 min"}</span>
        </div>
      </div>

      {/* Phase indicators */}
      <div className="grid grid-cols-4 gap-2">
        {phases.map((phase, index) => {
          const isCompleted = index < currentPhaseIndex;
          const isActive = index === currentPhaseIndex;
          const isPending = index > currentPhaseIndex;

          return (
            <div
              key={phase.id}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-300",
                isCompleted && "bg-primary/10",
                isActive && "bg-primary/20 ring-2 ring-primary/50",
                isPending && "bg-muted/30 opacity-50"
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive && "bg-primary/20 text-primary",
                  isPending && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  phase.icon
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-xs text-center font-medium transition-colors",
                  isCompleted && "text-primary",
                  isActive && "text-foreground",
                  isPending && "text-muted-foreground"
                )}
              >
                {phase.label}
              </span>

              {/* Status indicator */}
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                  <div className="flex gap-1">
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current action detail */}
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold">
          {isFinalVerification ? "Controllo stato analisi..." : `${phases[currentPhaseIndex]?.label}...`}
        </p>
        <p className="text-sm text-muted-foreground">
          {isFinalVerification && "Verifico se il backend ha completato, fallito o smesso di avanzare."}
          {!isFinalVerification && currentPhaseIndex === 0 && "Raccolta dati libri, BSR, prezzi e recensioni da Amazon"}
          {!isFinalVerification && currentPhaseIndex === 1 && "Estrazione pain points e desideri dalle recensioni dei clienti"}
          {!isFinalVerification && currentPhaseIndex === 2 && "Analisi discussioni da Reddit, Quora e forum di settore"}
          {!isFinalVerification && currentPhaseIndex === 3 && "Generazione insights strategici e raccomandazioni con AI"}
        </p>
      </div>

      {/* Data source badges */}
      <div className="flex gap-2 justify-center flex-wrap">
        {[
          { name: "Amazon", active: currentPhaseIndex >= 0 },
          { name: "Recensioni", active: currentPhaseIndex >= 1 },
          { name: "Reddit", active: currentPhaseIndex >= 2 },
          { name: "Quora", active: currentPhaseIndex >= 2 },
          { name: "AI Analysis", active: currentPhaseIndex >= 3 },
        ].map((source) => (
          <div
            key={source.name}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all duration-300",
              source.active 
                ? "bg-primary/20 text-primary animate-pulse" 
                : "bg-muted text-muted-foreground"
            )}
          >
            {source.name}
          </div>
        ))}
      </div>
    </div>
  );
}
