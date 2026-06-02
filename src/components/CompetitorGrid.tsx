import { CompetitorCard } from "./CompetitorCard";
import { Badge } from "@/components/ui/badge";
import { Book, TrendingUp, ShieldCheck } from "lucide-react";
import { selectTopCompetitors, isTraditionalPublisher } from "@/lib/publisher-utils";

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

interface CompetitorGridProps {
  competitors: CompetitorBook[];
}

export function CompetitorGrid({ competitors }: CompetitorGridProps) {
  // Handle empty state
  if (!competitors || competitors.length === 0) {
    return (
      <div className="glass-card overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-success/20">
              <Book className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Top Competitors</h3>
              <p className="text-sm text-muted-foreground">
                Real competitor data from Amazon
              </p>
            </div>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
            <Book className="w-8 h-8 text-muted-foreground" />
          </div>
          <h4 className="text-lg font-semibold mb-2">No Competitor Data Available</h4>
          <p className="text-muted-foreground max-w-md mx-auto">
            We couldn't scrape competitor books from Amazon for this niche. This may be due to Amazon's anti-bot protection or the niche having limited book results.
          </p>
        </div>
      </div>
    );
  }

  // Use the utility to select top competitors (ensures self-pub presence if in top 4)
  const topCompetitors = selectTopCompetitors(competitors);

  // Calculate averages from displayed competitors
  const competitorsWithPrice = topCompetitors.filter(c => c.price > 0);
  const competitorsWithBsr = topCompetitors.filter(c => c.bsr > 0);
  const competitorsWithRevenue = topCompetitors.filter(c => c.estMonthlyRevenue > 0);
  
  const avgPrice = competitorsWithPrice.length > 0 
    ? competitorsWithPrice.reduce((sum, c) => sum + c.price, 0) / competitorsWithPrice.length 
    : 0;
  const avgBsr = competitorsWithBsr.length > 0 
    ? competitorsWithBsr.reduce((sum, c) => sum + c.bsr, 0) / competitorsWithBsr.length 
    : 0;
  const totalRevenue = competitorsWithRevenue.reduce((sum, c) => sum + c.estMonthlyRevenue, 0);

  // Count how many have real data
  const competitorsWithCover = topCompetitors.filter(c => c.coverUrl && c.coverUrl.length > 0 && !c.coverUrl.includes('placeholder'));
  const dataQuality = competitorsWithBsr.length >= 2 ? 'good' : competitorsWithBsr.length >= 1 ? 'partial' : 'limited';

  const qualityPercent = Math.round(((competitorsWithBsr.length + competitorsWithCover.length) / (topCompetitors.length * 2)) * 100);
  const qualityColor = qualityPercent >= 80 ? 'text-success' : qualityPercent >= 50 ? 'text-warning' : 'text-danger';
  const qualityBg = qualityPercent >= 80 ? 'bg-success/10 border-success/30' : qualityPercent >= 50 ? 'bg-warning/10 border-warning/30' : 'bg-danger/10 border-danger/30';

  const hasSelfPub = topCompetitors.some(c => !isTraditionalPublisher(c.author));

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-success/20">
              <Book className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {hasSelfPub ? "Top Niche Sellers (Inc. Self-Publishers)" : "Top Niche Sellers"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {dataQuality === 'good' 
                  ? 'Sorted by BSR (lowest = best sellers) • Real Amazon data' 
                  : dataQuality === 'partial'
                  ? 'Sorted by BSR • Partial data available'
                  : 'Limited BSR data • Using review count as fallback'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${qualityBg}`}>
              <ShieldCheck className={`w-3.5 h-3.5 ${qualityColor}`} />
              <span className={qualityColor}>Qualità Dati: {qualityPercent}%</span>
              <span className="text-muted-foreground">
                ({competitorsWithBsr.length}/{topCompetitors.length} BSR • {competitorsWithCover.length}/{topCompetitors.length} Cover)
              </span>
            </div>
            {avgPrice > 0 && (
              <Badge variant="secondary" className="gap-1">
                Avg Price: ${avgPrice.toFixed(2)}
              </Badge>
            )}
            {avgBsr > 0 && (
              <Badge variant="secondary" className="gap-1">
                Avg BSR: #{Math.round(avgBsr).toLocaleString()}
              </Badge>
            )}
            {totalRevenue > 0 && (
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="w-3 h-3" />
                Total: ${(totalRevenue / 1000).toFixed(1)}K/mo
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className={`grid grid-cols-1 md:grid-cols-2 ${topCompetitors.length === 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
          {topCompetitors.map((competitor, index) => (
            <CompetitorCard 
              key={competitor.asin || index} 
              competitor={{...competitor, rank: index + 1}}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
