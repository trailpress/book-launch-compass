import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { 
  X, 
  Trophy,
  Target,
  AlertTriangle,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NicheData {
  id: string;
  niche_keyword: string;
  overall_score: number;
  verdict_type: string;
  demand_score: number;
  competition_score: number;
  profit_potential_score: number;
  trend_direction: string;
}

interface NicheComparisonProps {
  nicheIds: string[];
  onClose: () => void;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--gold))",
];

export function NicheComparison({ nicheIds, onClose }: NicheComparisonProps) {
  const [niches, setNiches] = useState<NicheData[]>([]);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    const fetchNiches = async () => {
      try {
        const { data, error } = await supabase
          .from('niche_analyses')
          .select('id, niche_keyword, overall_score, verdict_type, demand_score, competition_score, profit_potential_score, trend_direction')
          .in('id', nicheIds);

        if (error) throw error;
        
        const sortedData = (data || []).sort((a, b) => 
          nicheIds.indexOf(a.id) - nicheIds.indexOf(b.id)
        );
        
        setNiches(sortedData);

        // Determine winner based on overall score
        if (sortedData.length > 0) {
          const best = sortedData.reduce((a, b) => 
            a.overall_score > b.overall_score ? a : b
          );
          setWinner(best.niche_keyword);
        }
      } catch (err) {
        console.error('Error fetching niches:', err);
      } finally {
        setLoading(false);
      }
    };

    if (nicheIds.length > 0) {
      fetchNiches();
    }
  }, [nicheIds]);

  if (loading) {
    return (
      <div className="glass-card p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Prepare radar chart data
  const radarData = [
    { metric: "Demand", fullMark: 100 },
    { metric: "Profitability", fullMark: 100 },
    { metric: "Low Competition", fullMark: 100 },
    { metric: "Overall", fullMark: 100 },
  ].map((item) => {
    const result: any = { ...item };
    niches.forEach((niche, i) => {
      switch (item.metric) {
        case "Demand":
          result[niche.niche_keyword] = niche.demand_score;
          break;
        case "Profitability":
          result[niche.niche_keyword] = niche.profit_potential_score;
          break;
        case "Low Competition":
          result[niche.niche_keyword] = 100 - niche.competition_score;
          break;
        case "Overall":
          result[niche.niche_keyword] = niche.overall_score;
          break;
      }
    });
    return result;
  });

  // Prepare bar chart data
  const barData = niches.map((niche, i) => ({
    name: niche.niche_keyword,
    score: niche.overall_score,
    fill: COLORS[i % COLORS.length],
  }));

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case "publish": return <Trophy className="w-4 h-4" />;
      case "avoid": return <AlertTriangle className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">Niche Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Comparing {niches.length} niches side by side
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Winner Banner */}
        {winner && (
          <Card className="p-4 bg-gradient-to-r from-gold/20 to-success/20 border-gold/30">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-gold" />
              <div>
                <p className="text-sm text-muted-foreground">Recommended Winner</p>
                <p className="text-lg font-bold">{winner}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Niche Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {niches.map((niche, i) => (
            <Card 
              key={niche.id}
              className={cn(
                "p-4 border-2",
                niche.niche_keyword === winner && "border-gold"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <h4 className="font-bold truncate">{niche.niche_keyword}</h4>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Overall Score</span>
                  <span className="font-bold">{niche.overall_score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Demand</span>
                  <span className="font-medium">{niche.demand_score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Competition</span>
                  <span className="font-medium">{niche.competition_score}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Verdict</span>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "gap-1",
                      niche.verdict_type === "publish" && "bg-success/20 text-success",
                      niche.verdict_type === "avoid" && "bg-danger/20 text-danger",
                      niche.verdict_type === "publish-with-angle" && "bg-warning/20 text-warning"
                    )}
                  >
                    {getVerdictIcon(niche.verdict_type)}
                    {niche.verdict_type}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Trend</span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className={cn(
                      "w-4 h-4",
                      niche.trend_direction === "growing" ? "text-success" : "text-muted-foreground"
                    )} />
                    {niche.trend_direction}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <Card className="p-4">
            <h4 className="font-bold mb-4">Multi-Factor Comparison</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  />
                  {niches.map((niche, i) => (
                    <Radar
                      key={niche.id}
                      name={niche.niche_keyword}
                      dataKey={niche.niche_keyword}
                      stroke={COLORS[i % COLORS.length]}
                      fill={COLORS[i % COLORS.length]}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Bar Chart */}
          <Card className="p-4">
            <h4 className="font-bold mb-4">Overall Score Ranking</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar 
                    dataKey="score" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
