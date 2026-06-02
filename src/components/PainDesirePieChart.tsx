import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Target, Flame, Heart, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClusterData {
  keyword: string;
  count: number;
  percentage: number;
  intensity: number;
  category: "pain" | "desire" | "question";
  sampleQuotes?: string[];
}

interface PainDesirePieChartProps {
  clusters: ClusterData[];
  totalMentions: number;
}

const COLORS = {
  pain: "#ef4444",
  desire: "#22c55e",
  question: "#3b82f6",
};

export function PainDesirePieChart({ clusters, totalMentions }: PainDesirePieChartProps) {
  // Separate and sort clusters by category
  const { painData, desireData, questionData, categoryTotals, overviewData } = useMemo(() => {
    const pains = clusters
      .filter(c => c.category === "pain")
      .sort((a, b) => (b.intensity || 0) - (a.intensity || 0))
      .slice(0, 5);
    const desires = clusters
      .filter(c => c.category === "desire")
      .sort((a, b) => (b.intensity || 0) - (a.intensity || 0))
      .slice(0, 5);
    const questions = clusters
      .filter(c => c.category === "question")
      .sort((a, b) => (b.intensity || 0) - (a.intensity || 0))
      .slice(0, 3);
    
    const painTotal = pains.reduce((sum, p) => sum + (p.percentage || 0), 0);
    const desireTotal = desires.reduce((sum, p) => sum + (p.percentage || 0), 0);
    const questionTotal = questions.reduce((sum, p) => sum + (p.percentage || 0), 0);
    
    return {
      painData: pains,
      desireData: desires,
      questionData: questions,
      categoryTotals: { pain: painTotal, desire: desireTotal, question: questionTotal },
      overviewData: [
        { name: "Pain Points", value: painTotal, fill: COLORS.pain },
        { name: "Desideri", value: desireTotal, fill: COLORS.desire },
        { name: "Domande", value: questionTotal, fill: COLORS.question },
      ].filter(d => d.value > 0),
    };
  }, [clusters]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value?.toFixed(1)}% delle menzioni
          </p>
        </div>
      );
    }
    return null;
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 8) return "text-red-400";
    if (intensity >= 6) return "text-yellow-400";
    return "text-muted-foreground";
  };

  const renderTopItems = (
    items: ClusterData[], 
    icon: React.ReactNode, 
    label: string, 
    colorClass: string,
    bgClass: string
  ) => {
    if (items.length === 0) return null;
    
    return (
      <div className={cn("p-4 rounded-xl border", bgClass)}>
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className="text-sm font-semibold uppercase tracking-wider">{label}</span>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-lg font-bold", colorClass)}>{item.intensity}/10</span>
                  <span className="text-sm font-medium truncate">{item.keyword}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(item.intensity / 10) * 100}%`,
                      backgroundColor: COLORS[item.category],
                    }}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 via-green-500/20 to-blue-500/20">
          <Target className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Analisi Pain Points & Desideri</h3>
          <p className="text-sm text-muted-foreground">
            Intensità su scala 1-10 • {totalMentions} menzioni totali
          </p>
        </div>
      </div>

      {/* Main Layout: Pie Chart + Top Items */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="flex flex-col items-center">
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overviewData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {overviewData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Summary Stats */}
          <div className="flex gap-3 mt-2">
            {categoryTotals.pain > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">{categoryTotals.pain.toFixed(0)}%</span>
              </div>
            )}
            {categoryTotals.desire > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">{categoryTotals.desire.toFixed(0)}%</span>
              </div>
            )}
            {categoryTotals.question > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-muted-foreground">{categoryTotals.question.toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Pain Points Column */}
        {renderTopItems(
          painData,
          <Flame className="w-4 h-4 text-red-400" />,
          "Pain Points",
          "text-red-400",
          "bg-red-500/5 border-red-500/20"
        )}

        {/* Desires Column */}
        {renderTopItems(
          desireData,
          <Heart className="w-4 h-4 text-green-400" />,
          "Desideri",
          "text-green-400",
          "bg-green-500/5 border-green-500/20"
        )}
      </div>

      {/* Questions Row (if any) */}
      {questionData.length > 0 && (
        <div className="mt-4">
          {renderTopItems(
            questionData,
            <HelpCircle className="w-4 h-4 text-blue-400" />,
            "Domande Frequenti",
            "text-blue-400",
            "bg-blue-500/5 border-blue-500/20"
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Flame className="w-3 h-3 text-red-400" />
            <span>Pain Points (problemi da risolvere)</span>
          </div>
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3 text-green-400" />
            <span>Desideri (risultati voluti)</span>
          </div>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-3 h-3 text-blue-400" />
            <span>Domande (gap informativi)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
