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
  Target,
  Users,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoricalChart } from "./HistoricalChart";
import { calculateRoyalty, estimateDailySalesFromBSR, isLikelyColorBook, estimatePageCount } from "@/lib/kdp-royalty-calculator";
import { isTraditionalPublisher, cleanAuthorName } from "@/lib/publisher-utils";

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
  // Enhanced fields for strategic analysis
  angle?: string;
  targetAudience?: string;
  uniqueSellingPoint?: string;
}

interface EnhancedCompetitorCardProps {
  competitor: CompetitorBook;
  showStrategicAnalysis?: boolean;
}

function formatNumber(num: number): string {
  if (!num || num <= 0) return "N/A";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPrice(price: number): string {
  if (!price || price <= 0) return "N/A";
  return `$${price.toFixed(2)}`;
}

function formatRating(rating: number): string {
  if (!rating || rating <= 0) return "N/A";
  return rating.toFixed(1);
}

// Estimate daily royalty based on BSR using proper KDP formula
function estimateDailyRoyalty(bsr: number, price: number, pages: number, title: string, format: string): number {
  if (!bsr || !price) return 0;
  
  const bookFormat: 'paperback' | 'hardcover' = format?.toLowerCase().includes('hard') ? 'hardcover' : 'paperback';
  const bookIsColor = isLikelyColorBook(title);
  const bookPages = pages || estimatePageCount(title, format);
  
  const royaltyCalc = calculateRoyalty(price, bookPages, bookFormat, bookIsColor);
  const salesEst = estimateDailySalesFromBSR(bsr);
  
  return salesEst.avg * royaltyCalc.netRoyalty;
}

export function EnhancedCompetitorCard({
  competitor,
  showStrategicAnalysis = true,
}: EnhancedCompetitorCardProps) {
  const [showChart, setShowChart] = useState(false);

  const rankBadgeClass = cn(
    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg",
    competitor.rank === 1
      ? "bg-gradient-to-br from-gold to-amber-500 text-gold-foreground"
      : competitor.rank === 2
      ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800"
      : competitor.rank === 3
      ? "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100"
      : "bg-muted text-muted-foreground"
  );

  const coverUrl =
    competitor.coverUrl ||
    `https://via.placeholder.com/180x280/1a1a2e/eaeaea?text=${encodeURIComponent(
      competitor.title.slice(0, 15)
    )}`;

  const isSelfPublisher = !isTraditionalPublisher(competitor.author);

  const amazonUrl = `https://www.amazon.com/dp/${competitor.asin}`;
  const dailyRoyalty = estimateDailyRoyalty(competitor.bsr, competitor.price, competitor.pages, competitor.title, competitor.format);

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        competitor.rank === 1 && "ring-2 ring-gold/30"
      )}
    >
      {/* Header with BSR badge */}
      <div className="p-2 bg-muted/50 border-b border-border/50 flex items-center justify-between">
        <Badge variant="outline" className="gap-1 text-xs">
          <BarChart3 className="w-3 h-3" />
          BSR {competitor.bsr ? `#${formatNumber(competitor.bsr)}` : "N/A"}
        </Badge>
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

      <div className="p-4">
        <div className="flex gap-4">
          {/* Cover Image with Rank Badge */}
          <div className="relative shrink-0">
            <div className={rankBadgeClass + " absolute -top-3 -left-3 z-10"}>
              {competitor.rank}
            </div>
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:opacity-90 transition-opacity"
            >
              <div className="w-28 h-40 rounded-lg overflow-hidden bg-muted shadow-xl">
                <img
                  src={coverUrl}
                  alt={competitor.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      `https://via.placeholder.com/180x280/1a1a2e/eaeaea?text=Cover`;
                  }}
                />
              </div>
            </a>
          </div>

          {/* Book Info */}
          <div className="flex-1 min-w-0">
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              <h4 className="font-bold text-base line-clamp-3 mb-1">
                {competitor.title}
              </h4>
            </a>
            <p className="text-sm text-muted-foreground mb-2">
              {cleanAuthorName(competitor.author || "Non indicato")}
            </p>

            {/* Publisher Badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-xs mb-3",
                isSelfPublisher
                  ? "border-success/50 text-success"
                  : "border-warning/50 text-warning"
              )}
            >
              {isSelfPublisher ? "Self Publisher" : "Publisher/Org"}
            </Badge>

            {/* Key Financial Metrics */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Prezzo</p>
                <p
                  className={cn(
                    "font-bold",
                    competitor.price ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatPrice(competitor.price)}
                </p>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Royalty/unità</p>
                <p
                  className={cn(
                    "font-bold",
                    competitor.profitPerCopy
                      ? "text-success"
                      : "text-muted-foreground"
                  )}
                >
                  {competitor.profitPerCopy
                    ? `$${competitor.profitPerCopy.toFixed(2)}`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Estimate Row */}
        <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-gold/10 to-amber-500/10 border border-gold/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stima Giornaliera</span>
            <span className="text-lg font-bold gradient-text-gold">
              ${(dailyRoyalty ?? 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Rating & Reviews */}
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Star
              className={cn(
                "w-4 h-4",
                competitor.rating && "text-gold fill-gold"
              )}
            />
            <span className="font-medium">{formatRating(competitor.rating)}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            ({competitor.reviews ? formatNumber(competitor.reviews) : "0"} recensioni)
          </span>
        </div>

        {/* Strategic Analysis Section */}
        {showStrategicAnalysis && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            {competitor.angle && (
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Target className="w-3 h-3" />
                  <span className="font-semibold">Angolazione:</span>
                </div>
                <p className="text-sm">{competitor.angle}</p>
              </div>
            )}

            {competitor.targetAudience && (
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Users className="w-3 h-3" />
                  <span className="font-semibold">Target:</span>
                </div>
                <p className="text-sm">{competitor.targetAudience}</p>
              </div>
            )}

            {competitor.uniqueSellingPoint && (
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span className="font-semibold">Proposta Unica di Vendita:</span>
                </div>
                <p className="text-sm">{competitor.uniqueSellingPoint}</p>
              </div>
            )}
          </div>
        )}

        {/* Historical Data Toggle */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="w-full gap-1"
          >
            {showChart ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Nascondi Grafico
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Dati Storici
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Historical Chart: current BSR snapshot first, real history as repeated scans accumulate */}
      {showChart &&
        competitor.bsr > 0 && (
          <div className="border-t border-border p-4 bg-muted/20">
            <HistoricalChart
              bookTitle={competitor.title}
              data={competitor.historicalData || { dates: [], bsr: [], price: [], reviews: [], estimatedSales: [] }}
              currentBsr={competitor.bsr}
              currentPrice={competitor.price}
              currentReviews={competitor.reviews}
            />
          </div>
        )}
      {showChart &&
        !competitor.bsr && (
          <div className="border-t border-border p-4 bg-muted/20 text-center">
            <p className="text-muted-foreground text-sm">
              BSR corrente non disponibile: serve almeno un BSR reale per iniziare il tracciamento.
            </p>
          </div>
        )}
    </Card>
  );
}
