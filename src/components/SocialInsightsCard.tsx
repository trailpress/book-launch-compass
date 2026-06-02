import { useState } from "react";
import { MessageSquare, ThumbsUp, ArrowUpRight, TrendingUp, Quote, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

export interface SocialExcerpt {
  content: string;
  source: "Reddit" | "Quora" | "Forum" | "Blog" | "Amazon" | "YouTube";
  url: string;
  upvotes?: number;
  comments?: number;
  painPointMatch?: string;
  relevanceScore: number;
  author?: string;
  subreddit?: string;
  datePosted?: string;
}

interface SocialInsightsCardProps {
  excerpts: SocialExcerpt[];
}

export function SocialInsightsCard({ excerpts }: SocialInsightsCardProps) {
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  
  const toggleExpand = (index: number) => {
    setExpandedItems(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  if (!excerpts || excerpts.length === 0) {
    return null;
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case "Reddit":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "Quora":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "Forum":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "Blog":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "Amazon":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "YouTube":
        return "bg-red-600/10 text-red-500 border-red-600/20";
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "Reddit":
        return "🔴";
      case "Quora":
        return "🅠";
      case "Forum":
        return "💬";
      case "Blog":
        return "📝";
      case "Amazon":
        return "📦";
      case "YouTube":
        return "▶️";
        return "🌐";
    }
  };

  // Sort by relevance score and engagement
  const sortedExcerpts = [...excerpts].sort((a, b) => {
    const scoreA = a.relevanceScore + (a.upvotes || 0) * 0.1 + (a.comments || 0) * 0.2;
    const scoreB = b.relevanceScore + (b.upvotes || 0) * 0.1 + (b.comments || 0) * 0.2;
    return scoreB - scoreA;
  });

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-purple-500/10">
          <MessageSquare className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Real Community Insights</h3>
          <p className="text-sm text-muted-foreground">
            {excerpts.length} estratti reali da Reddit, Quora, YouTube, forum e Amazon · clicca "Source" per verificare l'origine
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sortedExcerpts.map((excerpt, index) => {
          const isExpanded = expandedItems.includes(index);
          const isLongContent = excerpt.content.length > 150;
          
          return (
            <div
              key={index}
              className="rounded-xl bg-muted/30 border border-border/30 hover:border-primary/30 transition-colors group overflow-hidden"
            >
              {/* Compact Header - always visible */}
              <button
                onClick={() => isLongContent && toggleExpand(index)}
                className="w-full p-3 sm:p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={getSourceColor(excerpt.source) + " text-xs"}>
                      <span className="mr-1">{getSourceIcon(excerpt.source)}</span>
                      {excerpt.source}
                    </Badge>
                    
                    {excerpt.subreddit && (
                      <Badge variant="outline" className="bg-muted/50 text-xs">
                        r/{excerpt.subreddit}
                      </Badge>
                    )}

                    {excerpt.painPointMatch && (
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                        {excerpt.painPointMatch}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {excerpt.upvotes !== undefined && excerpt.upvotes > 0 && (
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {excerpt.upvotes.toLocaleString()}
                        </span>
                      )}
                      {excerpt.comments !== undefined && excerpt.comments > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {excerpt.comments.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {isLongContent && (
                      isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Content - truncated or full */}
                <div className="relative">
                  <Quote className="absolute -left-1 -top-1 w-3 h-3 text-primary/20" />
                  <p className={cn(
                    "text-sm text-foreground/90 pl-4 leading-relaxed italic",
                    !isExpanded && isLongContent && "line-clamp-2"
                  )}>
                    "{excerpt.content}"
                  </p>
                </div>
              </button>

              {/* Expanded footer */}
              {(isExpanded || !isLongContent) && (
                <div className="px-3 sm:px-4 pb-3 pt-0 flex items-center justify-between border-t border-border/20 mt-0 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {excerpt.author && (
                      <span className="text-xs text-muted-foreground">
                        by {excerpt.author}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                      Relevance: {excerpt.relevanceScore}%
                    </Badge>
                  </div>
                  
                  <a
                    href={excerpt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Source
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 rounded-lg bg-orange-500/5">
            <div className="text-2xl font-bold text-orange-400">
              {excerpts.filter(e => e.source === "Reddit").length}
            </div>
            <div className="text-xs text-muted-foreground">Reddit Posts</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/5">
            <div className="text-2xl font-bold text-red-400">
              {excerpts.filter(e => e.source === "Quora").length}
            </div>
            <div className="text-xs text-muted-foreground">Quora Answers</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-600/5">
            <div className="text-2xl font-bold text-red-500">
              {excerpts.filter(e => e.source === "YouTube").length}
            </div>
            <div className="text-xs text-muted-foreground">YouTube Comments</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/5">
            <div className="text-2xl font-bold text-blue-400">
              {excerpts.filter(e => e.source === "Forum" || e.source === "Blog").length}
            </div>
            <div className="text-xs text-muted-foreground">Forum/Blog Posts</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/5">
            <div className="text-2xl font-bold text-primary">
              {excerpts.reduce((sum, e) => sum + (e.upvotes || 0), 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Total Upvotes</div>
          </div>
        </div>
      </div>
    </div>
  );
}
