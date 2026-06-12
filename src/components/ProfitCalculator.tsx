import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, Calculator, BookOpen, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProfitCalculatorProps {
  conservative: {
    monthlySales: number;
    monthlyRevenue: number;
    monthlyProfit: number;
  };
  expected: {
    monthlySales: number;
    monthlyRevenue: number;
    monthlyProfit: number;
  };
  optimistic: {
    monthlySales: number;
    monthlyRevenue: number;
    monthlyProfit: number;
  };
  avgPrice: number;
  avgProfitPerCopy: number;
  dailyRoyaltyRange?: { min: number; max: number };
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatCurrencyDecimal(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function ProfitCalculator({
  conservative,
  expected,
  optimistic,
  avgPrice,
  avgProfitPerCopy,
  dailyRoyaltyRange,
}: ProfitCalculatorProps) {
  const scenarios = [
    {
      name: "Conservativo",
      data: conservative,
      color: "text-muted-foreground",
      bg: "bg-muted/50",
      border: "border-border",
    },
    {
      name: "Media Top Bestseller",
      data: expected,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/30",
    },
    {
      name: "Ottimistico",
      data: optimistic,
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/30",
    },
  ];

  const averageTopDailyProfit = expected.monthlyProfit / 30;
  const averageTopMonthlyProfit = averageTopDailyProfit * 30;
  const averageTopAnnualProfit = averageTopMonthlyProfit * 12;

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-success to-emerald-400">
          <Calculator className="w-5 h-5 text-success-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Scenari di Profitto Reali</h3>
          <p className="text-sm text-muted-foreground">
            Media dei top bestseller comparabili della nicchia, ordinati per BSR
          </p>
        </div>
      </div>

      {/* Key Metrics from real data */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-4 rounded-xl bg-muted/50 text-center cursor-help">
                <DollarSign className="w-5 h-5 text-success mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrencyDecimal(avgPrice)}
                </p>
                <p className="text-xs text-muted-foreground">Prezzo Medio</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Media reale dei prezzi dei top competitor Amazon</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-4 rounded-xl bg-muted/50 text-center cursor-help">
                <BookOpen className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrencyDecimal(avgProfitPerCopy)}
                </p>
                <p className="text-xs text-muted-foreground">Royalty Netta/Copia</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <p className="font-semibold">Formula KDP:</p>
                <p>(Prezzo × 60%) − Costo Stampa</p>
                <p className="text-muted-foreground">Calcolato su prezzo e pagine reali</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-4 rounded-xl bg-gradient-to-br from-gold/10 to-amber-500/10 border border-gold/20 text-center cursor-help">
                <TrendingUp className="w-5 h-5 text-gold mx-auto mb-2" />
                <p className="text-2xl font-bold text-gold">
                  {formatCurrencyDecimal(averageTopDailyProfit)}
                </p>
                <p className="text-xs text-muted-foreground">Royalty/Giorno</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <p className="font-semibold">Stima giornaliera basata su BSR reali:</p>
                {dailyRoyaltyRange && (
                  <p>Range: {formatCurrencyDecimal(dailyRoyaltyRange.min)} – {formatCurrencyDecimal(dailyRoyaltyRange.max)}/giorno</p>
                )}
                <p className="text-muted-foreground">= Vendite stimate × Royalty netta per copia</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Scenarios */}
      <div className="space-y-4">
        {scenarios.map((scenario, i) => (
          <div
            key={i}
            className={cn(
              "p-4 rounded-xl border transition-all duration-300 hover:scale-[1.01]",
              scenario.bg,
              scenario.border
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className={cn("font-semibold", scenario.color)}>
                {scenario.name}
              </h4>
              <span
                className={cn(
                  "text-2xl font-bold",
                  scenario.name === "Ottimistico"
                    ? "text-success"
                    : scenario.name === "Media Top Bestseller"
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {formatCurrency(scenario.data.monthlyProfit)}
                <span className="text-sm font-normal text-muted-foreground">
                  /mese
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Vendite/Mese</p>
                <p className="font-medium text-foreground">
                  {scenario.data.monthlySales} copie
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Fatturato</p>
                <p className="font-medium text-foreground">
                  {formatCurrency(scenario.data.monthlyRevenue)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Royalty/Giorno</p>
                <p className="font-medium text-foreground">
                  {formatCurrencyDecimal(scenario.data.monthlyProfit / 30)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Annual Projection */}
      <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-gold/10 to-amber-500/10 border border-gold/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Media Annuale Top Bestseller
            </p>
            {expected.monthlyProfit > 0 ? (
              <div>
                <p className="text-3xl font-bold gradient-text-gold">
                  {formatCurrency(averageTopAnnualProfit)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {formatCurrencyDecimal(averageTopDailyProfit)}/giorno x 30 giorni x 12 mesi.
                  Mese medio: {formatCurrency(averageTopMonthlyProfit)}.
                </p>
              </div>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">
                Dati BSR insufficienti per una stima reale
              </p>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  {expected.monthlyProfit > 0
                    ? "Calcolo meccanico dalla media dei top bestseller comparabili: royalty netta stimata al giorno x 30 x 12. Il dato giornaliero deriva da BSR Amazon visibile e royalty KDP stimata da prezzo e pagine."
                    : "Nessun BSR reale disponibile per i competitor: non mostriamo stime fittizie. Riprova con una nicchia con dati Amazon più completi."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
