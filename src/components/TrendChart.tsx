import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Calendar, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";

interface TrendChartProps {
  direction: "growing" | "stable" | "declining";
  seasonality: "high" | "moderate" | "low";
  viability: "strong" | "moderate" | "weak";
  data: number[];
  labels: string[];
  niche?: string;
  narrative?: string;
  yearOverYear?: number;
  yearOverYearText?: string;
  seasonalPattern?: {
    description: string;
    peakMonths: string[];
    explanation: string;
  };
  keyPatterns?: string[];
  forecast?: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm text-foreground">{label}</p>
        <p className="text-sm text-primary">
          <span className="text-muted-foreground">Interesse: </span>
          <span className="font-bold text-primary">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
}

export function TrendChart({
  direction,
  seasonality,
  viability,
  data,
  labels,
  niche,
  narrative,
  yearOverYear,
  yearOverYearText,
  seasonalPattern,
  keyPatterns,
  forecast,
}: TrendChartProps) {
  const avgInterest = data.length > 0
    ? Math.round(data.reduce((a, b) => a + b, 0) / data.length)
    : 0;

  // Compute change from first half to second half
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
  const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
  const changeValue = yearOverYear ?? Math.round(((secondAvg - firstAvg) / (firstAvg || 1)) * 100);

  const trendConfig = {
    growing: { icon: TrendingUp, label: "CRESCITA", color: "text-success", bg: "bg-success/10 border-success/30" },
    stable: { icon: Minus, label: "STABILE", color: "text-warning", bg: "bg-warning/10 border-warning/30" },
    declining: { icon: TrendingDown, label: "IN CALO", color: "text-danger", bg: "bg-danger/10 border-danger/30" },
  };

  const trend = trendConfig[direction];
  const TrendIcon = trend.icon;

  const googleTrendsUrl = niche
    ? `https://trends.google.com/trends/explore?q=${encodeURIComponent(niche)}&geo=US&hl=en`
    : null;

  // Build chart data
  const chartData = useMemo(() => {
    return data.map((value, i) => ({
      name: labels[i] || `M${i + 1}`,
      interesse: value,
    }));
  }, [data, labels]);

  // Stroke color based on direction
  const strokeColor = direction === "growing" ? "hsl(var(--success))" : direction === "declining" ? "hsl(var(--danger))" : "hsl(var(--primary))";
  const fillColor = direction === "growing" ? "hsl(var(--success) / 0.15)" : direction === "declining" ? "hsl(var(--danger) / 0.15)" : "hsl(var(--primary) / 0.15)";

  return (
    <div className="glass-card overflow-hidden animate-fade-in col-span-full">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Analisi Tendenze</h3>
          {googleTrendsUrl && (
            <a
              href={googleTrendsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
              title="Vedi su Google Trends"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Line Chart */}
      <div className="px-6 pt-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="interesse"
                stroke={strokeColor}
                strokeWidth={2}
                fill="url(#trendGradient)"
                dot={false}
                activeDot={{ r: 5, stroke: strokeColor, strokeWidth: 2, fill: "hsl(var(--background))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1 mb-4">
          Google Trends interesse nel tempo (ultimi 2 anni)
        </p>
      </div>

      {/* Direction Badge + Change */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <TrendIcon className={cn("w-5 h-5", trend.color)} />
          <Badge variant="outline" className={cn("uppercase text-xs font-bold", trend.bg, trend.color)}>
            {trend.label}
          </Badge>
          <span className={cn("text-xl font-bold", changeValue >= 0 ? "text-success" : "text-danger")}>
            {changeValue >= 0 ? "+" : ""}{changeValue}
          </span>
        </div>

        {/* Narrative */}
        {narrative && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {narrative}
          </p>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-border" />

      {/* Year over Year */}
      {(yearOverYear !== undefined || yearOverYearText) && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-foreground">Anno su Anno</h4>
            {yearOverYear !== undefined && (
              <div className={cn("flex items-center gap-1", yearOverYear >= 0 ? "text-success" : "text-danger")}>
                {yearOverYear >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="font-bold text-sm">
                  {yearOverYear >= 0 ? "+" : ""}{yearOverYear}%
                </span>
              </div>
            )}
          </div>
          {yearOverYearText && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {yearOverYearText}
            </p>
          )}
        </div>
      )}

      {/* Seasonal Pattern */}
      {seasonalPattern && (
        <>
          <div className="border-t border-border" />
          <div className="p-6">
            <div className="rounded-xl bg-muted/50 border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-foreground" />
                <h4 className="font-bold text-foreground">Pattern Stagionale</h4>
              </div>
              <p className="font-semibold text-sm text-foreground mb-3">
                {seasonalPattern.description}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {seasonalPattern.peakMonths.map((month, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-medium">
                    {month}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {seasonalPattern.explanation}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Key Patterns */}
      {keyPatterns && keyPatterns.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="p-6">
            <h4 className="font-bold text-foreground mb-3">Pattern Chiave</h4>
            <ul className="space-y-2">
              {keyPatterns.map((pattern, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
                  <span>{pattern}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Forecast */}
      {forecast && (
        <>
          <div className="border-t border-border" />
          <div className="p-6">
            <h4 className="font-bold text-foreground mb-2">Previsione & Raccomandazioni</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {forecast}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
