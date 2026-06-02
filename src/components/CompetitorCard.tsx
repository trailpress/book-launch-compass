import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  BarChart3,
  BookOpen,
  DollarSign,
  MessageSquare,
  Calculator,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoricalChart } from "./HistoricalChart";
import { isTraditionalPublisher, cleanAuthorName } from "@/lib/publisher-utils";
import { 
  calculateRoyalty, 
  calculateDailyEarnings, 
  formatRoyalty,
  isLikelyColorBook,
  estimatePageCount 
} from "@/lib/kdp-royalty-calculator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CompetitorBook {
  rank: number;
  title: string;
  author: string;
  asin: string;
  coverUrl: string;
  bsr: number;
  reviews: number;
  rating: number;
  price: number;
  estMonthlySales: number;
  estMonthlyRevenue: number;
  profitPerCopy: number;
  format: string;
  pages: number;
  trend: "up" | "stable" | "down";
  publishDate: string;
  historicalData: {
    dates: string[];
    bsr: number[];
    price: number[];
    reviews: number[];
    estimatedSales: number[];
  };
}

interface CompetitorCardProps {
  competitor: CompetitorBook;
}

function formatNumber(num: number): string {
  if (!num || num <= 0) return 'N/A';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatPrice(price: number): string {
  if (!price || price <= 0) return 'N/A';
  return `$${price.toFixed(2)}`;
}

function formatRating(rating: number): string {
  if (!rating || rating <= 0) return 'N/A';
  return rating.toFixed(1);
}

export function CompetitorCard({ competitor }: CompetitorCardProps) {
  const [showChart, setShowChart] = useState(false);

  // Calculate accurate KDP royalties
  const pageCount = competitor.pages || estimatePageCount(competitor.title, competitor.format);
  const isColor = isLikelyColorBook(competitor.title);
  const format = competitor.format?.toLowerCase().includes('hard') ? 'hardcover' : 'paperback';
  
  const royaltyCalc = competitor.price > 0 
    ? calculateRoyalty(competitor.price, pageCount, format, isColor)
    : null;
  
  const dailyEarnings = competitor.bsr > 0 && competitor.price > 0
    ? calculateDailyEarnings(competitor.bsr, competitor.price, pageCount, format, isColor)
    : null;

  const rankBadgeClass = cn(
    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
    competitor.rank === 1
      ? "bg-gradient-to-br from-gold to-amber-500 text-gold-foreground"
      : competitor.rank === 2
      ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800"
      : competitor.rank === 3
      ? "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100"
      : "bg-muted text-muted-foreground"
  );

  // Robust cover fallback: ASIN CDN first, local placeholder last
  const coverUrl = competitor.coverUrl ||
    (competitor.asin
      ? `https://images-na.ssl-images-amazon.com/images/P/${competitor.asin}.01._SCLZZZZZZZ_SX220_.jpg`
      : '/placeholder.svg');

  // Detect publisher type based on author name patterns
  const isTraditional = isTraditionalPublisher(competitor.author);
  const isSelfPublisher = !isTraditional;

  // Amazon product URL
  const amazonUrl = `https://www.amazon.com/dp/${competitor.asin}`;

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      competitor.rank === 1 && "ring-2 ring-gold/30"
    )}>
      <div className="p-4">
        <div className="flex gap-4">
          {/* Cover Image */}
          <div className="relative shrink-0">
            <div className={rankBadgeClass + " absolute -top-2 -left-2 z-10"}>
              {competitor.rank}
            </div>
            <a 
              href={amazonUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:opacity-90 transition-opacity"
            >
              <div className="w-28 h-40 sm:w-32 sm:h-44 rounded-lg overflow-hidden bg-muted shadow-lg">
                <img
                  src={coverUrl}
                  alt={competitor.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              </div>
            </a>
          </div>

          {/* Book Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <a 
                  href={amazonUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  <h4 className="font-bold text-base line-clamp-2 mb-1">
                    {competitor.title}
                  </h4>
                </a>
                <p className="text-sm text-muted-foreground">
                  by {cleanAuthorName(competitor.author)}
                </p>
                {/* Publisher Type Badge */}
                <Badge 
                  variant="outline" 
                  className={cn(
                    "mt-1 text-xs",
                    isSelfPublisher 
                      ? "border-success/50 text-success" 
                      : "border-warning/50 text-warning"
                  )}
                >
                  {isSelfPublisher ? "Self Publisher" : "Publisher/Org"}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-1">
                {competitor.trend === "up" && (
                  <TrendingUp className="w-4 h-4 text-success shrink-0" />
                )}
                {competitor.trend === "down" && (
                  <TrendingDown className="w-4 h-4 text-danger shrink-0" />
                )}
                <a 
                  href={amazonUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="View on Amazon"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline" className={cn("gap-1 text-xs", !competitor.bsr && "opacity-50")}>
                <BarChart3 className="w-3 h-3" />
                BSR {competitor.bsr ? `#${formatNumber(competitor.bsr)}` : 'N/A'}
              </Badge>
              <Badge variant="outline" className={cn("gap-1 text-xs", !competitor.rating && "opacity-50")}>
                <Star className={cn("w-3 h-3", competitor.rating && "text-gold fill-gold")} />
                {formatRating(competitor.rating)}
              </Badge>
              <Badge variant="outline" className={cn("gap-1 text-xs", !competitor.reviews && "opacity-50")}>
                <MessageSquare className="w-3 h-3" />
                {competitor.reviews ? `${formatNumber(competitor.reviews)} reviews` : 'N/A'}
              </Badge>
              <Badge variant="outline" className={cn("gap-1 text-xs", !competitor.pages && "opacity-50")}>
                <BookOpen className="w-3 h-3" />
                {competitor.pages ? `${competitor.pages}p` : 'N/A'}
              </Badge>
            </div>

            {/* Financial Metrics - Accurate KDP Calculations */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Prezzo</p>
                <p className={cn("font-bold", competitor.price ? "text-foreground" : "text-muted-foreground")}>
                  {formatPrice(competitor.price)}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-2 rounded bg-muted/50 cursor-help">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        Royalty Netta <Info className="w-3 h-3" />
                      </p>
                      <p className={cn("font-bold", royaltyCalc?.netRoyalty ? "text-success" : "text-muted-foreground")}>
                        {royaltyCalc ? formatRoyalty(royaltyCalc.netRoyalty) : 'N/A'}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {royaltyCalc ? (
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">Calcolo KDP Preciso:</p>
                        <p>Prezzo: ${(royaltyCalc.listPrice ?? 0).toFixed(2)}</p>
                        <p>Royalty 60%: ${(royaltyCalc.grossRoyalty ?? 0).toFixed(2)}</p>
                        <p>- Costo Stampa: ${(royaltyCalc.printingCost ?? 0).toFixed(2)}</p>
                        <p className="text-muted-foreground ml-2">
                          (Fisso ${(royaltyCalc.fixedCost ?? 0).toFixed(2)} + {pageCount}pag × ${((royaltyCalc.variableCost ?? 0)/(pageCount || 1)).toFixed(3)})
                        </p>
                        <p className="font-bold text-success">
                          = Royalty Netta: ${(royaltyCalc.netRoyalty ?? 0).toFixed(2)}
                        </p>
                      </div>
                    ) : (
                      <p>Prezzo non disponibile</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Daily & Monthly Earnings from real BSR data */}
            {dailyEarnings && dailyEarnings.expected > 0 && (
              <div className="mt-2 p-3 rounded-lg bg-gradient-to-r from-gold/10 to-amber-500/10 border border-gold/20 space-y-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between cursor-help">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calculator className="w-3 h-3" />
                          Stima Giornaliera
                        </span>
                        <span className="font-bold text-gold">
                          ${(dailyEarnings.expected ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">Stima Guadagni Giornalieri:</p>
                        <p>BSR #{formatNumber(competitor.bsr)} ≈ {(dailyEarnings.dailySalesEstimate ?? 0).toFixed(1)} vendite/giorno</p>
                        <p>Royalty: ${(dailyEarnings.royaltyPerCopy ?? 0).toFixed(2)}/copia</p>
                        <div className="pt-1 border-t border-border/50">
                          <p>Conservativo: ${(dailyEarnings.conservative ?? 0).toFixed(2)}/giorno</p>
                          <p className="font-bold">Previsto: ${(dailyEarnings.expected ?? 0).toFixed(2)}/giorno</p>
                          <p>Ottimistico: ${(dailyEarnings.optimistic ?? 0).toFixed(2)}/giorno</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Monthly Royalties */}
                <div className="border-t border-gold/20 pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-between cursor-help">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Royalty Mensile
                          </span>
                          <span className="font-bold text-success text-sm">
                            ${((dailyEarnings.expected ?? 0) * 30).toFixed(0)}/mese
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="text-xs space-y-1">
                          <p className="font-semibold">Royalty Mensili (basate su BSR reale):</p>
                          <p>BSR #{formatNumber(competitor.bsr)} → ~{(dailyEarnings.dailySalesEstimate ?? 0).toFixed(1)} vendite/giorno</p>
                          <p>× Royalty netta ${(dailyEarnings.royaltyPerCopy ?? 0).toFixed(2)}/copia</p>
                          <p>× 30 giorni</p>
                          <div className="pt-1 border-t border-border/50">
                            <p>Conservativo: ${((dailyEarnings.conservative ?? 0) * 30).toFixed(0)}/mese</p>
                            <p className="font-bold text-success">Previsto: ${((dailyEarnings.expected ?? 0) * 30).toFixed(0)}/mese</p>
                            <p>Ottimistico: ${((dailyEarnings.optimistic ?? 0) * 30).toFixed(0)}/mese</p>
                          </div>
                          <p className="text-muted-foreground pt-1">= ~${((dailyEarnings.expected ?? 0) * 30 * 12).toFixed(0)}/anno (mensile × 12)</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Format Badge & Historical Toggle */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                format === "paperback" && "bg-primary/20 text-primary",
                format === "hardcover" && "bg-gold/20 text-gold"
              )}
            >
              {competitor.format || 'Paperback'}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              <BookOpen className="w-3 h-3" />
              {pageCount}pag
            </Badge>
            {isColor && (
              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
                Colore
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="gap-1"
          >
            {showChart ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Chart
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Historical Data
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Historical Chart (Helium 10 Style) - only show if we have real data */}
      {showChart && competitor.historicalData && competitor.historicalData.dates?.length > 0 && competitor.bsr > 0 && (
        <div className="border-t border-border p-4 bg-muted/20">
          <HistoricalChart
            bookTitle={competitor.title}
            data={competitor.historicalData}
            currentBsr={competitor.bsr}
            currentPrice={competitor.price}
            currentReviews={competitor.reviews}
          />
        </div>
      )}
      {showChart && (!competitor.historicalData?.dates?.length || !competitor.bsr) && (
        <div className="border-t border-border p-4 bg-muted/20 text-center">
          <p className="text-muted-foreground text-sm">
            Historical data not available - BSR data required for chart
          </p>
        </div>
      )}
    </Card>
  );
}
