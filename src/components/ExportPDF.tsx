import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AnalysisData } from "@/lib/api/kdp-analysis";
import jsPDF from "jspdf";

interface ExportPDFProps {
  data: AnalysisData;
  niche: string;
}

export function ExportPDF({ data, niche }: ExportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const generatePDF = async () => {
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // Helper functions
      const addNewPageIfNeeded = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      const addText = (text: string, x: number, y: number, options?: any) => {
        pdf.text(text, x, y, options);
      };

      // Header
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 35, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      addText("KDP Intel", margin, 20);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      addText(`Market Analysis Report`, margin, 28);
      
      pdf.setFontSize(10);
      addText(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, 28);
      
      yPos = 50;
      pdf.setTextColor(0, 0, 0);

      // Niche Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      addText(`Niche: "${niche}"`, margin, yPos);
      yPos += 15;

      // Overall Verdict
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      const verdictColor = data.verdict.type === "publish" 
        ? [34, 197, 94] 
        : data.verdict.type === "avoid" 
        ? [239, 68, 68] 
        : [234, 179, 8];
      pdf.setTextColor(verdictColor[0], verdictColor[1], verdictColor[2]);
      addText(`Verdict: ${data.verdict.type.toUpperCase()}`, margin, yPos);
      yPos += 8;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const summaryLines = pdf.splitTextToSize(data.verdict.summary, pageWidth - margin * 2);
      pdf.text(summaryLines, margin, yPos);
      yPos += summaryLines.length * 5 + 10;

      // Score Cards Section
      addNewPageIfNeeded(40);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      addText("Market Scores", margin, yPos);
      yPos += 10;

      const scores = [
        { name: "Profitability", score: data.scores.profitability.score },
        { name: "Saturation", score: data.scores.saturation.score },
        { name: "Opportunity", score: data.scores.opportunity.score },
        { name: "Risk Level", score: data.scores.risk.score },
      ];

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const scoreBoxWidth = (pageWidth - margin * 2 - 15) / 4;
      
      scores.forEach((score, i) => {
        const x = margin + i * (scoreBoxWidth + 5);
        
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, yPos, scoreBoxWidth, 25, 2, 2, "FD");
        
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        addText(score.name, x + 5, yPos + 8);
        
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        const scoreColor = score.score >= 70 
          ? [34, 197, 94] 
          : score.score >= 40 
          ? [234, 179, 8] 
          : [239, 68, 68];
        pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        addText(`${score.score}%`, x + 5, yPos + 20);
        pdf.setFont("helvetica", "normal");
      });
      
      yPos += 35;
      pdf.setTextColor(0, 0, 0);

      // Key Insights
      if (data.verdict.insights && data.verdict.insights.length > 0) {
        addNewPageIfNeeded(40);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        addText("Key Insights", margin, yPos);
        yPos += 8;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        data.verdict.insights.forEach((insight, i) => {
          addNewPageIfNeeded(10);
          const bullet = `${i + 1}. ${insight}`;
          const lines = pdf.splitTextToSize(bullet, pageWidth - margin * 2);
          pdf.text(lines, margin, yPos);
          yPos += lines.length * 5 + 3;
        });
        yPos += 5;
      }

      // Pain Points
      if (data.painPointsFromWeb && data.painPointsFromWeb.length > 0) {
        addNewPageIfNeeded(50);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        addText("Pain Points from Real Sources", margin, yPos);
        yPos += 10;

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        data.painPointsFromWeb.slice(0, 5).forEach((pp, i) => {
          addNewPageIfNeeded(15);
          const text = `• ${pp.description} (Frequency: ${pp.frequency}/10, Intensity: ${pp.intensity}/10)`;
          const lines = pdf.splitTextToSize(text, pageWidth - margin * 2);
          pdf.text(lines, margin, yPos);
          yPos += lines.length * 4 + 3;
        });
        yPos += 5;
      }

      // Suggested Titles
      if (data.suggestedTitles && data.suggestedTitles.length > 0) {
        addNewPageIfNeeded(60);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        addText("AI-Generated Title Suggestions", margin, yPos);
        yPos += 10;

        data.suggestedTitles.slice(0, 5).forEach((title, i) => {
          addNewPageIfNeeded(25);
          
          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(200, 200, 200);
          pdf.roundedRect(margin, yPos - 3, pageWidth - margin * 2, 20, 2, 2, "FD");
          
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          const titleLines = pdf.splitTextToSize(`${i + 1}. ${title.fullTitle}`, pageWidth - margin * 2 - 10);
          pdf.text(titleLines, margin + 5, yPos + 4);
          
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 100, 100);
          addText(`Framework: ${title.framework} | Score: ${title.conversionScore}% | ${title.charCount} chars`, margin + 5, yPos + 14);
          
          yPos += 25;
        });
        yPos += 5;
        pdf.setTextColor(0, 0, 0);
      }

      // Competitors Table
      if (data.competitors && data.competitors.length > 0) {
        addNewPageIfNeeded(80);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        addText("Top Competitors", margin, yPos);
        yPos += 10;

        // Table header
        pdf.setFillColor(59, 130, 246);
        pdf.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
        
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        addText("Title", margin + 3, yPos + 5);
        addText("BSR", margin + 80, yPos + 5);
        addText("Price", margin + 100, yPos + 5);
        addText("Reviews", margin + 120, yPos + 5);
        addText("Est. Sales", margin + 145, yPos + 5);
        
        yPos += 10;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");

        data.competitors.slice(0, 5).forEach((comp, i) => {
          addNewPageIfNeeded(10);
          
          if (i % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, yPos - 3, pageWidth - margin * 2, 8, "F");
          }
          
          const shortTitle = comp.title.length > 40 ? comp.title.substring(0, 37) + "..." : comp.title;
          addText(shortTitle, margin + 3, yPos + 2);
          addText(`#${comp.bsr.toLocaleString()}`, margin + 80, yPos + 2);
          addText(`$${comp.price.toFixed(2)}`, margin + 100, yPos + 2);
          addText(comp.reviews.toLocaleString(), margin + 120, yPos + 2);
          addText(`${comp.estMonthlySales}/mo`, margin + 145, yPos + 2);
          
          yPos += 8;
        });
        yPos += 10;
      }

      // Profit Projections
      addNewPageIfNeeded(50);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      addText("Profit Projections", margin, yPos);
      yPos += 10;

      const projections = [
        { name: "Conservative", ...data.profit.conservative },
        { name: "Expected", ...data.profit.expected },
        { name: "Optimistic", ...data.profit.optimistic },
      ];

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      projections.forEach((proj) => {
        addText(`${proj.name}: ${proj.monthlySales} sales/mo → $${proj.monthlyProfit.toLocaleString()} profit/mo`, margin, yPos);
        yPos += 6;
      });
      yPos += 10;

      // Strategy
      if (data.strategy) {
        addNewPageIfNeeded(60);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        addText("Recommended Strategy", margin, yPos);
        yPos += 10;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        
        const strategyItems = [
          { label: "Target Audience", value: data.strategy.targetAudience },
          { label: "Unique Angle", value: data.strategy.uniqueAngle },
          { label: "Emotional Hook", value: data.strategy.emotionalHook },
          { label: "Core Promise", value: data.strategy.corePromise },
          { label: "Competitive Advantage", value: data.strategy.competitiveAdvantage },
        ];

        strategyItems.forEach((item) => {
          if (item.value) {
            addNewPageIfNeeded(15);
            pdf.setFont("helvetica", "bold");
            addText(`${item.label}:`, margin, yPos);
            pdf.setFont("helvetica", "normal");
            const lines = pdf.splitTextToSize(item.value, pageWidth - margin * 2 - 30);
            pdf.text(lines, margin + 45, yPos);
            yPos += lines.length * 5 + 3;
          }
        });
      }

      // Footer on each page
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Page ${i} of ${pageCount} | KDP Intel Market Analysis | ${new Date().toLocaleDateString()}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      // Save PDF
      pdf.save(`KDP-Intel-${niche.replace(/\s+/g, "-")}-Analysis.pdf`);

      toast({
        title: "PDF Exported",
        description: "Your analysis report has been downloaded",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      onClick={generatePDF} 
      disabled={isExporting}
      variant="outline"
      className="gap-2"
    >
      {isExporting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4" />
          Export PDF
        </>
      )}
    </Button>
  );
}
