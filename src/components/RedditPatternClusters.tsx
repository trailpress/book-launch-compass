import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Flame, MessageSquare, ThumbsUp } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { SocialExcerpt } from "@/lib/api/kdp-analysis";

interface RedditPatternClustersProps {
  excerpts: SocialExcerpt[];
}

type RedditPattern = {
  key: string;
  label: string;
  description: string;
  terms: RegExp;
  category: "problem" | "desire" | "question";
};

const PATTERNS: RedditPattern[] = [
  {
    key: "itinerary",
    label: "Itinerari e sequenza del viaggio",
    description: "Dubbi su ordine delle tappe, durata, priorita e cosa tagliare.",
    terms: /\b(itinerary|itinerar|day\s*\d|days?|night|route|start|where do i start|plan|planning|schedule|split your stay)\b/i,
    category: "question",
  },
  {
    key: "crowds",
    label: "Code, parcheggio e affollamento",
    description: "Ansia su parcheggi, orari di arrivo, navette, traffico e folla.",
    terms: /\b(crowd|crowds|busy|parking|park early|early morning|shuttle|traffic|reservation|permit|timed entry|pass)\b/i,
    category: "problem",
  },
  {
    key: "hikes",
    label: "Trail e hike da scegliere",
    description: "Richieste su trail migliori, difficolta, alternative e highlight.",
    terms: /\b(hike|hiking|trail|grinnell|iceberg|highline|avalanche|lake|hidden lake|many glacier|logan pass)\b/i,
    category: "desire",
  },
  {
    key: "safety",
    label: "Sicurezza, bear spray e meteo",
    description: "Preoccupazioni pratiche su animali, meteo, neve, equipaggiamento e rischio.",
    terms: /\b(bear|spray|safety|afraid|encounter|weather|snow|ice|gear|ranger|guided)\b/i,
    category: "problem",
  },
  {
    key: "lodging",
    label: "Dove dormire e base logistica",
    description: "Domande su lato est/ovest, lodge, zone migliori e spostamenti.",
    terms: /\b(stay|lodg|hotel|camp|east side|west side|many glacier|where will you be coming from|base)\b/i,
    category: "question",
  },
  {
    key: "first_time",
    label: "Prima visita e overwhelm",
    description: "Utenti che non sanno da dove iniziare o vogliono evitare errori da principiante.",
    terms: /\b(first time|1st time|first visit|where do i start|overwhelmed|advice|tips|recommendations?|mistakes?)\b/i,
    category: "problem",
  },
];

function engagementScore(excerpt: SocialExcerpt) {
  return (excerpt.relevanceScore || 0) + (excerpt.upvotes || 0) * 0.35 + (excerpt.comments || 0) * 2;
}

function splitIntoEvidence(excerpt: SocialExcerpt) {
  const content = excerpt.content.replace(/\s+/g, " ").trim();
  const commentPart = content.split(/Top visible comments?:/i)[1] || "";
  const commentSnippets = commentPart
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 45);

  const lead = content.split(/Top visible comments?:/i)[0]?.trim();
  const snippets = [lead, ...commentSnippets].filter(Boolean) as string[];

  return snippets.map((snippet) => ({
    text: snippet.slice(0, 420),
    url: excerpt.url,
    subreddit: excerpt.subreddit,
    upvotes: excerpt.upvotes || 0,
    comments: excerpt.comments || 0,
    score: engagementScore(excerpt),
  }));
}

function categoryClass(category: RedditPattern["category"]) {
  if (category === "problem") return "border-red-500/25 bg-red-500/10 text-red-200";
  if (category === "desire") return "border-green-500/25 bg-green-500/10 text-green-200";
  return "border-blue-500/25 bg-blue-500/10 text-blue-200";
}

export function RedditPatternClusters({ excerpts }: RedditPatternClustersProps) {
  const [expanded, setExpanded] = useState<string[]>([]);

  const { clusters, topThreads, totalEngagement } = useMemo(() => {
    const reddit = excerpts
      .filter((excerpt) => excerpt.source === "Reddit")
      .sort((a, b) => engagementScore(b) - engagementScore(a));

    const evidence = reddit.flatMap(splitIntoEvidence);
    const builtClusters = PATTERNS.map((pattern) => {
      const matches = evidence
        .filter((item) => pattern.terms.test(item.text))
        .sort((a, b) => b.score - a.score);
      const engagement = matches.reduce((sum, item) => sum + item.score, 0);

      return {
        ...pattern,
        count: matches.length,
        engagement,
        samples: matches.slice(0, 4),
      };
    })
      .filter((cluster) => cluster.count > 0)
      .sort((a, b) => b.engagement - a.engagement);

    return {
      clusters: builtClusters,
      topThreads: reddit.slice(0, 6),
      totalEngagement: reddit.reduce((sum, excerpt) => sum + engagementScore(excerpt), 0),
    };
  }, [excerpts]);

  if (!clusters.length && !topThreads.length) return null;

  const toggle = (key: string) => {
    setExpanded((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]);
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-orange-500/10">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Pattern Reddit ad Alto Engagement</h3>
          <p className="text-sm text-muted-foreground">
            Cluster dai thread/commenti Reddit più votati e commentati · {topThreads.length} thread analizzati
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {clusters.map((cluster, index) => {
          const isExpanded = expanded.includes(cluster.key);
          const weight = totalEngagement > 0 ? Math.round((cluster.engagement / totalEngagement) * 100) : 0;

          return (
            <div key={cluster.key} className="rounded-xl border border-border/40 bg-muted/20 p-4">
              <button className="w-full text-left" onClick={() => toggle(cluster.key)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-300">
                        {index + 1}
                      </span>
                      <h4 className="font-semibold">{cluster.label}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{cluster.description}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", categoryClass(cluster.category))}>
                    {cluster.category === "problem" ? "Pain" : cluster.category === "desire" ? "Desiderio" : "Domanda"}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-muted/40">
                    {cluster.count} evidenze
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                    Peso {weight}%
                  </Badge>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-4 space-y-3 border-t border-border/30 pt-3">
                  {cluster.samples.map((sample, sampleIndex) => (
                    <div key={`${sample.url}-${sampleIndex}`} className="rounded-lg bg-background/30 p-3">
                      <p className="text-sm italic text-foreground/90">"{sample.text}"</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          {sample.subreddit && <span>r/{sample.subreddit}</span>}
                          {sample.upvotes > 0 && (
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" />
                              {sample.upvotes.toLocaleString()}
                            </span>
                          )}
                          {sample.comments > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {sample.comments.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <a href={sample.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                          Source
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {topThreads.length > 0 && (
        <div className="mt-6 border-t border-border/30 pt-4">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Thread Reddit più pesanti nel calcolo
          </h4>
          <div className="grid md:grid-cols-2 gap-2">
            {topThreads.map((thread, index) => (
              <a
                key={`${thread.url}-${index}`}
                href={thread.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border/30 bg-muted/20 p-3 text-sm hover:border-orange-500/40 transition-colors"
              >
                <p className="line-clamp-2 font-medium">{thread.content}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {thread.subreddit && <span>r/{thread.subreddit}</span>}
                  <span>{(thread.upvotes || 0).toLocaleString()} upvotes</span>
                  <span>{(thread.comments || 0).toLocaleString()} commenti</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
