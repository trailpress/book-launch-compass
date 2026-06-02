import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Competitor {
  rank: number;
  title: string;
  bsr: number;
  reviews: number;
  rating: number;
  price: number;
  estMonthlySales: number;
  estMonthlyRevenue: number;
  profitPerCopy: number;
  format: string;
  pages: number;
  trend: "up" | "down" | "stable";
}

interface CompetitorTableProps {
  competitors: Competitor[];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCurrency(num: number): string {
  return `$${num.toFixed(2)}`;
}

export function CompetitorTable({ competitors }: CompetitorTableProps) {
  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-border">
        <h3 className="text-xl font-bold">Top Competitor Analysis</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time data from Amazon KDP bestsellers
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead className="min-w-[250px]">Title</TableHead>
              <TableHead className="text-right">BSR</TableHead>
              <TableHead className="text-right">Reviews</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Est. Sales/mo</TableHead>
              <TableHead className="text-right">Est. Revenue</TableHead>
              <TableHead className="text-right">Profit/Copy</TableHead>
              <TableHead>Format</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {competitors.map((comp, i) => (
              <TableRow
                key={i}
                className={cn(
                  "transition-colors",
                  i === 0 && "bg-gold/5"
                )}
              >
                <TableCell>
                  <span
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                      i === 0
                        ? "bg-gradient-to-br from-gold to-amber-500 text-gold-foreground"
                        : i === 1
                        ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800"
                        : i === 2
                        ? "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {comp.rank}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground line-clamp-1">
                      {comp.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {comp.pages} pages
                      </Badge>
                      {comp.trend === "up" && (
                        <TrendingUp className="w-3 h-3 text-success" />
                      )}
                      {comp.trend === "down" && (
                        <TrendingDown className="w-3 h-3 text-danger" />
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  #{formatNumber(comp.bsr)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatNumber(comp.reviews)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-gold fill-gold" />
                    <span className="font-mono text-sm">{comp.rating}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium text-success">
                  {formatCurrency(comp.price)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatNumber(comp.estMonthlySales)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium text-primary">
                  {formatCurrency(comp.estMonthlyRevenue)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">
                  <span className={cn(
                    comp.profitPerCopy > 3 ? "text-success" : 
                    comp.profitPerCopy > 1.5 ? "text-warning" : "text-danger"
                  )}>
                    {formatCurrency(comp.profitPerCopy)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      comp.format === "Paperback" && "bg-primary/20 text-primary",
                      comp.format === "Hardcover" && "bg-gold/20 text-gold",
                      comp.format === "Low Content" && "bg-success/20 text-success"
                    )}
                  >
                    {comp.format}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
