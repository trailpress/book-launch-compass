import { ExternalLink, Globe } from "lucide-react";

interface SourcesCardProps {
  sources: string[];
}

export function SourcesCard({ sources }: SourcesCardProps) {
  const getSourceType = (url: string) => {
    if (url.includes('reddit.com')) return { name: 'Reddit', color: 'text-orange-400' };
    if (url.includes('quora.com')) return { name: 'Quora', color: 'text-red-400' };
    return { name: 'Web', color: 'text-blue-400' };
  };

  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-blue-500/10">
          <Globe className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Data Sources</h3>
          <p className="text-sm text-muted-foreground">
            {sources.length} real sources analyzed
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sources.map((source, index) => {
          const sourceType = getSourceType(source);
          return (
            <a
              key={index}
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 hover:border-primary/30 hover:bg-muted/50 transition-colors group"
            >
              <span className={`text-xs font-medium ${sourceType.color}`}>
                {sourceType.name}
              </span>
              <span className="text-sm text-muted-foreground truncate flex-1">
                {getDomain(source)}
              </span>
              <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
