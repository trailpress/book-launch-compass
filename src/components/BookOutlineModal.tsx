import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  Download, 
  Copy, 
  Check,
  Sparkles,
  Target,
  Users,
  Lightbulb,
  FileText,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface BookOutline {
  strategicHook: {
    bigIdea: string;
    uniqueMechanism: string;
    readerTransformation: {
      before: string;
      after: string;
    };
  };
  structuralStrategy: string;
  tableOfContents: {
    parts: Array<{
      number: number;
      title: string;
      transformationPurpose: string;
      chapters: Array<{
        number: number;
        title: string;
        strategicPurpose: string;
        readerOutcome: string;
        evidenceJustification: string;
      }>;
    }>;
  };
  marketingPreview: string;
  totalChapters: number;
  estimatedPages: {
    min: number;
    max: number;
  };
}

interface BookOutlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  outline: BookOutline | null;
  niche: string;
  isLoading?: boolean;
}

export function BookOutlineModal({ 
  isOpen, 
  onClose, 
  outline, 
  niche,
  isLoading = false 
}: BookOutlineModalProps) {
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]));
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const togglePart = (partNumber: number) => {
    setExpandedParts(prev => {
      const next = new Set(prev);
      if (next.has(partNumber)) {
        next.delete(partNumber);
      } else {
        next.add(partNumber);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (outline) {
      setExpandedParts(new Set(outline.tableOfContents.parts.map(p => p.number)));
    }
  };

  const collapseAll = () => {
    setExpandedParts(new Set());
  };

  const copyToClipboard = async () => {
    if (!outline) return;
    
    const text = formatOutlineAsText(outline, niche);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiato!", description: "Outline copiato negli appunti" });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsMarkdown = () => {
    if (!outline) return;
    
    const markdown = formatOutlineAsMarkdown(outline, niche);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `book-outline-${niche.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Download completato!", description: "Outline salvato come Markdown" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-gold to-amber-500">
                <BookOpen className="w-5 h-5 text-gold-foreground" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Book Blueprint
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {niche}
                </p>
              </div>
            </div>
            
            {outline && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiato" : "Copia"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAsMarkdown}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Esporta
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold text-lg">Generazione Blueprint in corso...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Analisi dei dati e creazione della struttura ottimale
                </p>
              </div>
            </div>
          ) : outline ? (
            <div className="p-6 space-y-8">
              {/* Strategic Hook Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gold" />
                  <h3 className="text-lg font-bold">Strategic Book Hook</h3>
                </div>
                
                <div className="grid gap-4">
                  {/* Big Idea */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-primary text-sm">Big Idea</h4>
                    </div>
                    <p className="text-foreground">{outline.strategicHook.bigIdea}</p>
                  </div>
                  
                  {/* Unique Mechanism */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-warning" />
                      <h4 className="font-semibold text-warning text-sm">Meccanismo Unico</h4>
                    </div>
                    <p className="text-foreground">{outline.strategicHook.uniqueMechanism}</p>
                  </div>
                  
                  {/* Reader Transformation */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-success" />
                      <h4 className="font-semibold text-success text-sm">Trasformazione del Lettore</h4>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-xs uppercase tracking-wider text-destructive font-medium mb-1">Prima</p>
                        <p className="text-sm">{outline.strategicHook.readerTransformation.before}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-success/20 border border-success/30">
                        <p className="text-xs uppercase tracking-wider text-success font-medium mb-1">Dopo</p>
                        <p className="text-sm">{outline.strategicHook.readerTransformation.after}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Structural Strategy */}
              <section className="space-y-3">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  Strategia Strutturale
                </h3>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <p className="text-foreground leading-relaxed">{outline.structuralStrategy}</p>
                </div>
              </section>

              {/* Stats Bar */}
              <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-gradient-to-r from-muted to-muted/50 border border-border/50">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    <strong>{outline.totalChapters}</strong> Capitoli
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    <strong>{outline.tableOfContents.parts.length}</strong> Parti
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    Pagine stimate: <strong>{outline.estimatedPages.min}-{outline.estimatedPages.max}</strong>
                  </span>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll}>
                    Espandi tutto
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll}>
                    Comprimi tutto
                  </Button>
                </div>
              </div>

              {/* Table of Contents */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-gold" />
                  Indice Completo
                </h3>
                
                <div className="space-y-3">
                  {outline.tableOfContents.parts.map((part) => (
                    <Collapsible
                      key={part.number}
                      open={expandedParts.has(part.number)}
                      onOpenChange={() => togglePart(part.number)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border transition-all",
                          "hover:bg-muted/50",
                          expandedParts.has(part.number) 
                            ? "bg-primary/5 border-primary/30" 
                            : "bg-card border-border/50"
                        )}>
                          <div className="p-2 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                            {part.number}
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className="font-bold text-foreground">{part.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {part.transformationPurpose}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {part.chapters.length} capitoli
                            </p>
                          </div>
                          {expandedParts.has(part.number) ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="pl-8 pr-4 py-2 space-y-2">
                          {part.chapters.map((chapter) => (
                            <div 
                              key={chapter.number}
                              className="p-4 rounded-lg bg-muted/30 border border-border/30 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                                  Cap. {chapter.number}
                                </span>
                                <h5 className="font-semibold text-foreground">{chapter.title}</h5>
                              </div>
                              
                              <div className="grid md:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-primary font-medium mb-1">
                                    Scopo Strategico
                                  </p>
                                  <p className="text-muted-foreground">{chapter.strategicPurpose}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-success font-medium mb-1">
                                    Risultato per il Lettore
                                  </p>
                                  <p className="text-muted-foreground">{chapter.readerOutcome}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-warning font-medium mb-1">
                                    Giustificazione
                                  </p>
                                  <p className="text-muted-foreground">{chapter.evidenceJustification}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </section>

              {/* Marketing Preview */}
              <section className="space-y-3">
                <h3 className="text-lg font-bold">Anteprima Marketing</h3>
                <div className="p-4 rounded-xl bg-gradient-to-br from-gold/10 to-amber-500/5 border border-gold/20">
                  <p className="text-foreground italic">"{outline.marketingPreview}"</p>
                </div>
              </section>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <BookOpen className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">Nessun outline generato</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function formatOutlineAsText(outline: BookOutline, niche: string): string {
  let text = `BOOK BLUEPRINT: ${niche}\n\n`;
  text += `=== STRATEGIC HOOK ===\n\n`;
  text += `BIG IDEA:\n${outline.strategicHook.bigIdea}\n\n`;
  text += `UNIQUE MECHANISM:\n${outline.strategicHook.uniqueMechanism}\n\n`;
  text += `READER TRANSFORMATION:\nBefore: ${outline.strategicHook.readerTransformation.before}\nAfter: ${outline.strategicHook.readerTransformation.after}\n\n`;
  text += `=== STRUCTURAL STRATEGY ===\n${outline.structuralStrategy}\n\n`;
  text += `=== TABLE OF CONTENTS ===\n`;
  text += `Total Chapters: ${outline.totalChapters} | Estimated Pages: ${outline.estimatedPages.min}-${outline.estimatedPages.max}\n\n`;
  
  for (const part of outline.tableOfContents.parts) {
    text += `PART ${part.number}: ${part.title}\n`;
    text += `Purpose: ${part.transformationPurpose}\n\n`;
    for (const chapter of part.chapters) {
      text += `  Chapter ${chapter.number}: ${chapter.title}\n`;
      text += `    Strategic Purpose: ${chapter.strategicPurpose}\n`;
      text += `    Reader Outcome: ${chapter.readerOutcome}\n`;
      text += `    Evidence: ${chapter.evidenceJustification}\n\n`;
    }
  }
  
  text += `\n=== MARKETING PREVIEW ===\n${outline.marketingPreview}`;
  
  return text;
}

function formatOutlineAsMarkdown(outline: BookOutline, niche: string): string {
  let md = `# Book Blueprint: ${niche}\n\n`;
  
  md += `## Strategic Hook\n\n`;
  md += `### Big Idea\n${outline.strategicHook.bigIdea}\n\n`;
  md += `### Unique Mechanism\n${outline.strategicHook.uniqueMechanism}\n\n`;
  md += `### Reader Transformation\n`;
  md += `- **Before:** ${outline.strategicHook.readerTransformation.before}\n`;
  md += `- **After:** ${outline.strategicHook.readerTransformation.after}\n\n`;
  
  md += `## Structural Strategy\n${outline.structuralStrategy}\n\n`;
  
  md += `## Table of Contents\n`;
  md += `> **${outline.totalChapters} Chapters** | **${outline.estimatedPages.min}-${outline.estimatedPages.max} Pages**\n\n`;
  
  for (const part of outline.tableOfContents.parts) {
    md += `### Part ${part.number}: ${part.title}\n`;
    md += `*${part.transformationPurpose}*\n\n`;
    
    for (const chapter of part.chapters) {
      md += `#### Chapter ${chapter.number}: ${chapter.title}\n`;
      md += `| Aspect | Description |\n|--------|-------------|\n`;
      md += `| Strategic Purpose | ${chapter.strategicPurpose} |\n`;
      md += `| Reader Outcome | ${chapter.readerOutcome} |\n`;
      md += `| Evidence | ${chapter.evidenceJustification} |\n\n`;
    }
  }
  
  md += `## Marketing Preview\n> *"${outline.marketingPreview}"*\n`;
  
  return md;
}
