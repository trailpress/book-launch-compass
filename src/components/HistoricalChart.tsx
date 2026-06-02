import { useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Star, ShoppingCart, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoricalData {
  dates: string[];
  bsr: number[];
  price: number[];
  reviews: number[];
  estimatedSales: number[];
  isProjection?: boolean;
}

interface HistoricalChartProps {
  bookTitle: string;
  data: HistoricalData;
  currentBsr: number;
  currentPrice: number;
  currentReviews: number;
}

type TimeRange = "30d" | "90d" | "6m" | "1y" | "all";

export function HistoricalChart({
  bookTitle,
  data,
  currentBsr,
  currentPrice,
  currentReviews,
}: HistoricalChartProps) {
  const [activeMetric, setActiveMetric] = useState<"bsr" | "sales" | "reviews" | "price">("bsr");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  // Transform data for recharts
  const allChartData = data.dates.map((date, i) => {
    // Handle both YYYY-MM-DD and YYYY-MM formats
    const dateObj = date.length === 10 ? new Date(date) : new Date(date + "-15");
    const label = date.length === 10 
      ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : dateObj.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return {
      date: label,
      fullDate: date,
      bsr: data.bsr[i],
      sales: data.estimatedSales[i],
      reviews: data.reviews[i],
      price: data.price[i],
    };
  });

  // Filter data based on time range
  const filterDataByRange = (range: TimeRange) => {
    const now = new Date();
    const dataLength = allChartData.length;
    
    switch (range) {
      case "30d":
        return allChartData.slice(-4); // Last 4 weeks
      case "90d":
        return allChartData.slice(-13); // Last ~13 weeks
      case "6m":
        return allChartData.slice(-26); // Last ~26 weeks
      case "1y":
        return allChartData; // All 52 weeks
      case "all":
      default:
        return allChartData;
    }
  };

  const chartData = filterDataByRange(timeRange);

  // Calculate trends
  const bsrTrend = data.bsr[0] > data.bsr[data.bsr.length - 1] ? "improving" : "declining";
  const salesTrend = data.estimatedSales[0] < data.estimatedSales[data.estimatedSales.length - 1] ? "growing" : "declining";
  const reviewsTrend = data.reviews[0] < data.reviews[data.reviews.length - 1] ? "growing" : "stable";

  // Calculate moving average
  const calculateMovingAverage = (values: number[], window: number = 3) => {
    return values.map((_, i, arr) => {
      const start = Math.max(0, i - window + 1);
      const subset = arr.slice(start, i + 1);
      return subset.reduce((a, b) => a + b, 0) / subset.length;
    });
  };

  const movingAverages = {
    bsr: calculateMovingAverage(chartData.map(d => d.bsr)),
    sales: calculateMovingAverage(chartData.map(d => d.sales)),
    reviews: calculateMovingAverage(chartData.map(d => d.reviews)),
    price: calculateMovingAverage(chartData.map(d => d.price)),
  };

  // Add moving average to chart data
  const enrichedChartData = chartData.map((d, i) => ({
    ...d,
    movingAvg: movingAverages[activeMetric][i],
  }));

  const metrics = [
    { 
      key: "bsr" as const, 
      label: "BSR Rank", 
      color: "hsl(var(--primary))",
      icon: BarChart3,
      trend: bsrTrend,
      current: `#${currentBsr.toLocaleString()}`,
      description: "Best Seller Rank (lower is better)"
    },
    { 
      key: "sales" as const, 
      label: "Est. Sales", 
      color: "hsl(var(--success))",
      icon: ShoppingCart,
      trend: salesTrend,
      current: `${data.estimatedSales[data.estimatedSales.length - 1]}/mo`,
      description: "Estimated monthly sales"
    },
    { 
      key: "reviews" as const, 
      label: "Reviews", 
      color: "hsl(var(--gold))",
      icon: Star,
      trend: reviewsTrend,
      current: currentReviews.toLocaleString(),
      description: "Total review count"
    },
    { 
      key: "price" as const, 
      label: "Price", 
      color: "hsl(var(--secondary))",
      icon: DollarSign,
      trend: "stable",
      current: `$${(currentPrice ?? 0).toFixed(2)}`,
      description: "Current list price"
    },
  ];

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: "30d", label: "30D" },
    { key: "90d", label: "90D" },
    { key: "6m", label: "6M" },
    { key: "1y", label: "1Y" },
    { key: "all", label: "All" },
  ];

  const activeMetricData = metrics.find(m => m.key === activeMetric)!;

  // Calculate stats
  const currentValues = chartData.map(d => d[activeMetric] as number);
  const minValue = Math.min(...currentValues);
  const maxValue = Math.max(...currentValues);
  const avgValue = currentValues.reduce((a, b) => a + b, 0) / currentValues.length;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 border border-border shadow-lg">
          <p className="font-medium text-sm mb-2">{label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} className="text-sm flex items-center gap-2" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}: {entry.name === "BSR" ? "#" : entry.name === "Price" ? "$" : ""}
              {typeof entry.value === "number" 
                ? entry.name === "Price" || entry.name === "Moving Avg"
                  ? entry.value.toFixed(2)
                  : entry.value.toLocaleString()
                : entry.value
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold line-clamp-1">{bookTitle}</h3>
          <p className="text-sm text-muted-foreground">
            {data.isProjection !== false ? "Proiezione storica (stima deterministica dal BSR attuale)" : "Andamento storico"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1",
              bsrTrend === "improving" ? "border-success text-success" : "border-danger text-danger"
            )}
          >
            {bsrTrend === "improving" ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            BSR {bsrTrend}
          </Badge>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-1">
          {timeRanges.map((range) => (
            <Button
              key={range.key}
              size="sm"
              variant={timeRange === range.key ? "default" : "ghost"}
              className={cn(
                "h-7 px-3 text-xs",
                timeRange === range.key && "bg-primary text-primary-foreground"
              )}
              onClick={() => setTimeRange(range.key)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {metrics.map((metric) => (
          <button
            key={metric.key}
            onClick={() => setActiveMetric(metric.key)}
            className={cn(
              "flex flex-col items-start p-3 rounded-lg border transition-all",
              activeMetric === metric.key
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <metric.icon 
                className="w-4 h-4" 
                style={{ color: metric.color }}
              />
              <span className="text-xs text-muted-foreground">{metric.label}</span>
            </div>
            <span className="font-bold text-lg">{metric.current}</span>
          </button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="font-medium">Min:</span>
          <span>{activeMetric === "bsr" ? "#" : activeMetric === "price" ? "$" : ""}{minValue.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">Max:</span>
          <span>{activeMetric === "bsr" ? "#" : activeMetric === "price" ? "$" : ""}{maxValue.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">Avg:</span>
          <span>{activeMetric === "bsr" ? "#" : activeMetric === "price" ? "$" : ""}{Math.round(avgValue).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="w-3 h-0.5 bg-muted-foreground/50" style={{ borderStyle: "dashed" }} />
          <span>Moving Avg (3mo)</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enrichedChartData}>
            <defs>
              <linearGradient id={`gradient-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={activeMetricData.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={activeMetricData.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => 
                activeMetric === "bsr" 
                  ? `${(value / 1000).toFixed(0)}k`
                  : activeMetric === "price"
                  ? `$${value}`
                  : value.toLocaleString()
              }
              reversed={activeMetric === "bsr"}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Average line */}
            <ReferenceLine 
              y={avgValue} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
            
            <Area
              type="monotone"
              dataKey={activeMetric}
              stroke={activeMetricData.color}
              fill={`url(#gradient-${activeMetric})`}
              strokeWidth={2}
              name={activeMetricData.label}
            />
            
            {/* Moving average line */}
            <Line
              type="monotone"
              dataKey="movingAvg"
              stroke={activeMetricData.color}
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="Moving Avg"
              opacity={0.7}
            />
            
            <Line
              type="monotone"
              dataKey={activeMetric}
              stroke={activeMetricData.color}
              strokeWidth={2}
              dot={{ fill: activeMetricData.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              name={activeMetricData.label}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        {activeMetricData.description} • Showing {chartData.length} data points
      </p>
    </div>
  );
}
