import { useMemo } from "react";
import { Cloud, Target, TrendingUp, MessageSquare, Star, ShoppingCart } from "lucide-react";

export interface ClusteredPainPoint {
  keyword: string;
  count: number;
  percentage: number;
  sources: {
    amazon: number;
    reddit: number;
    quora: number;
    forum: number;
  };
  relatedTerms: string[];
  intensity: number;
  sampleQuotes: string[];
  category: "pain" | "desire" | "question";
}

interface PainPointClusterProps {
  clusters: ClusteredPainPoint[];
  totalMentions: number;
}

export function PainPointCluster({ clusters, totalMentions }: PainPointClusterProps) {
  // Sort by percentage for importance ranking, filtering out invalid data
  const sortedClusters = useMemo(() => 
    [...clusters]
      .filter(c => c && typeof c.percentage === 'number' && typeof c.count === 'number')
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)),
    [clusters]
  );

  const topClusters = sortedClusters.slice(0, 8);
  const restClusters = sortedClusters.slice(8, 20);

  // Calculate max percentage for scaling
  const maxPercentage = topClusters[0]?.percentage || 1;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "pain": return "text-red-400 bg-red-500/10 border-red-500/30";
      case "desire": return "text-green-400 bg-green-500/10 border-green-500/30";
      case "question": return "text-blue-400 bg-blue-500/10 border-blue-500/30";
      default: return "text-muted-foreground bg-muted/30 border-border/30";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "pain": return "Problem";
      case "desire": return "Desire";
      case "question": return "Question";
      default: return category;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "amazon": return <ShoppingCart className="w-3 h-3" />;
      case "reddit": return <span className="text-orange-500 text-xs">●</span>;
      case "quora": return <span className="text-red-500 text-xs">●</span>;
      case "forum": return <span className="text-blue-500 text-xs">●</span>;
      default: return null;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
          <Cloud className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Pain Point & Desire Cluster</h3>
          <p className="text-sm text-muted-foreground">
            Cross-referenced from Amazon Reviews, Reddit, Quora & Forums • {totalMentions} total mentions
          </p>
        </div>
      </div>

      {/* Word Cloud Visualization */}
      <div className="mb-8 p-6 rounded-xl bg-muted/20 border border-border/30">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {topClusters.map((cluster, index) => {
            const scale = 0.7 + (cluster.percentage / maxPercentage) * 0.8;
            const opacity = 0.6 + (cluster.percentage / maxPercentage) * 0.4;
            
            return (
              <div
                key={cluster.keyword}
                className={`px-3 py-1.5 rounded-full border transition-all hover:scale-110 cursor-pointer ${getCategoryColor(cluster.category)}`}
                style={{ 
                  fontSize: `${scale}rem`,
                  opacity,
                }}
                title={`${(cluster.percentage ?? 0).toFixed(1)}% of mentions`}
              >
                <span className="font-semibold">{cluster.keyword}</span>
                <span className="ml-2 text-xs opacity-75">{(cluster.percentage ?? 0).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
        
        {/* Secondary terms - smaller */}
        {restClusters.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-4 border-t border-border/30">
            {restClusters.map((cluster) => (
              <span
                key={cluster.keyword}
                className="px-2 py-1 text-xs rounded-full bg-muted/40 text-muted-foreground"
              >
                {cluster.keyword} ({cluster.percentage.toFixed(0)}%)
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Breakdown */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Top Pain Points & Desires by Importance
        </h4>

        {topClusters.slice(0, 5).map((cluster, index) => (
          <div
            key={cluster.keyword}
            className="p-4 rounded-xl bg-muted/30 border border-border/30 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{cluster.keyword}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(cluster.category)}`}>
                      {getCategoryLabel(cluster.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span>{cluster.count ?? 0} mentions</span>
                    <span>•</span>
                    <span className="font-semibold text-primary">{(cluster.percentage ?? 0).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span>Intensity</span>
                </div>
                <div className="font-bold text-lg">{cluster.intensity ?? 0}/10</div>
              </div>
            </div>

            {/* Source Breakdown */}
            {cluster.sources && (
              <div className="flex items-center gap-4 mb-3 text-xs">
                {(cluster.sources.amazon ?? 0) > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400">
                    {getSourceIcon("amazon")}
                    <span>Amazon: {cluster.sources.amazon}</span>
                  </div>
                )}
                {(cluster.sources.reddit ?? 0) > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-400">
                    {getSourceIcon("reddit")}
                    <span>Reddit: {cluster.sources.reddit}</span>
                  </div>
                )}
                {(cluster.sources.quora ?? 0) > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-400">
                    {getSourceIcon("quora")}
                    <span>Quora: {cluster.sources.quora}</span>
                  </div>
                )}
                {(cluster.sources.forum ?? 0) > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
                    {getSourceIcon("forum")}
                    <span>Forums: {cluster.sources.forum}</span>
                  </div>
                )}
              </div>
            )}

            {/* Related Terms */}
            {cluster.relatedTerms.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {cluster.relatedTerms.slice(0, 5).map((term, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                    {term}
                  </span>
                ))}
              </div>
            )}

            {/* Sample Quotes */}
            {cluster.sampleQuotes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <MessageSquare className="w-3 h-3" />
                  <span>Real quotes:</span>
                </div>
                <div className="space-y-2">
                  {cluster.sampleQuotes.slice(0, 2).map((quote, i) => (
                    <p key={i} className="text-sm italic text-muted-foreground pl-3 border-l-2 border-primary/30">
                      "{quote}"
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/30"></span>
            <span>Pain Points (problems to solve)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500/30"></span>
            <span>Desires (outcomes wanted)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500/30"></span>
            <span>Questions (information gaps)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
