import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AnalysisData {
  niche: string;
  strategy: {
    suggestedTitle: string;
    suggestedSubtitle: string;
    targetAudience: string;
    painPoints: string[];
    uniqueAngle: string;
    emotionalHook: string;
    corePromise: string;
    competitiveAdvantage: string;
  };
  clusteredPainPoints?: Array<{
    keyword: string;
    count: number;
    intensity: number;
    category: string;
    sampleQuotes: string[];
  }>;
  competitors?: Array<{
    title: string;
    author: string;
    bsr: number;
    reviews: number;
    rating: number;
    angle?: string;
    targetAudience?: string;
    uniqueSellingPoint?: string;
  }>;
  opportunities?: {
    gaps: string[];
    weaknesses: string[];
    underserved: string[];
    opportunities: string[];
  };
  patterns?: {
    pageCountRange: string;
    priceSweet: string;
    emotionalPromises: string[];
    targetLanguage: string[];
    structuralPatterns: string[];
  };
  verdict?: {
    type: string;
    summary: string;
    insights: string[];
  };
  demandSupplyGap?: {
    keyInsight: string;
    marketGaps: string[];
    topPainPoints: Array<{
      category: string;
      description: string;
      score: number;
      covered?: boolean;
    }>;
  };
  strategicAngles?: {
    reasoning: string;
    angles: Array<{
      title: string;
      subtitle: string;
      angle: string;
      targetAudience: string;
      painPointsAddressed: string[];
      competitiveAdvantage: string;
    }>;
  };
  socialExcerpts?: Array<{
    content: string;
    source: string;
    painPointMatch?: string;
  }>;
}

interface BookOutline {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisData } = await req.json() as { analysisData: AnalysisData };

    if (!analysisData || !analysisData.niche) {
      return new Response(
        JSON.stringify({ success: false, error: 'Analysis data is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Generating book outline for niche:', analysisData.niche);

    // Prepare the analysis context for the AI
    const analysisContext = buildAnalysisContext(analysisData);

    const systemPrompt = `You are an expert book strategist specializing in Amazon KDP publishing. Your task is to synthesize market and audience analysis into a commercially competitive book blueprint.

CRITICAL RULES:
1. Base EVERY decision ONLY on the analysis data provided - do NOT invent insights or apply generic templates
2. The structure must EMERGE from the analysis, not from predefined templates
3. Each chapter must have strategic justification linked to specific analysis findings
4. Avoid generic "beginner to advanced" structures or encyclopedia-style organization
5. No filler chapters - every chapter must drive transformation

CHAPTER CREATION CRITERIA - Each chapter must address at least ONE of:
- A dominant reader pain or fear (from pain point analysis)
- A dominant reader desire or aspiration (from desires analysis)
- A competitive content gap (from opportunity analysis)
- A required step for understanding/applying the solution
- Reinforcement of the unique mechanism or positioning

READER PROGRESSION REQUIREMENT - Structure must flow through:
1. Orientation and expectation clarity
2. Conceptual understanding  
3. Practical implementation
4. Confidence and trust reinforcement
5. Risk, mistake, and obstacle resolution
6. Long-term success or expansion logic

OUTPUT FORMAT (JSON):
{
  "strategicHook": {
    "bigIdea": "One paragraph explaining the book's core insight that differentiates it",
    "uniqueMechanism": "One paragraph explaining the unique framework/system derived from analysis",
    "readerTransformation": {
      "before": "Clear description of reader's current state/struggles",
      "after": "Clear description of reader's transformed state after reading"
    }
  },
  "structuralStrategy": "6-10 sentences explaining: why this structure fits the market, how it differentiates from competitors, how it reduces reader disappointment risk, how it supports reader transformation",
  "tableOfContents": {
    "parts": [
      {
        "number": 1,
        "title": "Part title (commercially attractive)",
        "transformationPurpose": "Short statement of this part's strategic purpose",
        "chapters": [
          {
            "number": 1,
            "title": "Chapter title (emotionally engaging, no generic titles)",
            "strategicPurpose": "Why this chapter exists",
            "readerOutcome": "What reader will achieve/understand",
            "evidenceJustification": "Which specific analysis insight requires this chapter"
          }
        ]
      }
    ]
  },
  "marketingPreview": "A compelling 2-3 sentence preview suitable for Amazon Look Inside or marketing",
  "totalChapters": number,
  "estimatedPages": { "min": number, "max": number }
}

The output must be:
- Commercially attractive and suitable for Amazon Look Inside
- Clear and emotionally engaging
- Structured for logical reader progression
- Avoid filler or generic titles like "Introduction" or "Getting Started"
- Evidence-based with clear links to analysis data`;

    const userPrompt = `Generate a complete book blueprint based on this analysis data:

${analysisContext}

Create a strategic, market-competitive book outline that maximizes:
- Market competitiveness against identified competitors
- Reader transformation clarity
- Promise credibility based on identified pain points
- Review satisfaction probability (addressing what reviewers complain about)
- Competitive differentiation from gaps identified

Return ONLY valid JSON matching the specified format.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI generation failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'No content generated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Parse the JSON response
    let outline: BookOutline;
    try {
      // Clean potential markdown code blocks
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      outline = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse AI response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Generated outline with', outline.totalChapters, 'chapters');

    return new Response(
      JSON.stringify({ 
        success: true, 
        outline,
        niche: analysisData.niche 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Outline generation error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function buildAnalysisContext(data: AnalysisData): string {
  const sections: string[] = [];

  // 1. Niche & Strategy
  sections.push(`=== NICHE ===
"${data.niche}"`);

  if (data.strategy) {
    sections.push(`=== POSITIONING STRATEGY ===
Target Audience: ${data.strategy.targetAudience}
Unique Angle: ${data.strategy.uniqueAngle}
Emotional Hook: ${data.strategy.emotionalHook}
Core Promise: ${data.strategy.corePromise}
Competitive Advantage: ${data.strategy.competitiveAdvantage}
Suggested Title: "${data.strategy.suggestedTitle}: ${data.strategy.suggestedSubtitle}"`);
  }

  // 2. Pain Points (critical for chapter creation)
  if (data.clusteredPainPoints && data.clusteredPainPoints.length > 0) {
    const painPointsList = data.clusteredPainPoints
      .slice(0, 10)
      .map((p, i) => `${i + 1}. "${p.keyword}" (Intensity: ${p.intensity}/10, Category: ${p.category}, Mentions: ${p.count})
   Sample quotes: ${p.sampleQuotes?.slice(0, 2).join(' | ') || 'N/A'}`)
      .join('\n');
    sections.push(`=== READER PAIN POINTS & DESIRES (from community analysis) ===
${painPointsList}`);
  }

  if (data.strategy?.painPoints && data.strategy.painPoints.length > 0) {
    sections.push(`=== KEY PAIN POINTS TO ADDRESS ===
${data.strategy.painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
  }

  // 3. Competitor Analysis
  if (data.competitors && data.competitors.length > 0) {
    const competitorsList = data.competitors
      .slice(0, 5)
      .map((c, i) => `${i + 1}. "${c.title}" by ${c.author}
   BSR: ${c.bsr?.toLocaleString() || 'N/A'}, Reviews: ${c.reviews?.toLocaleString() || 'N/A'}, Rating: ${c.rating || 'N/A'}
   Angle: ${c.angle || 'Not analyzed'}
   Target: ${c.targetAudience || 'Not analyzed'}
   USP: ${c.uniqueSellingPoint || 'Not analyzed'}`)
      .join('\n\n');
    sections.push(`=== TOP COMPETITORS (differentiate from these) ===
${competitorsList}`);
  }

  // 4. Market Opportunities
  if (data.opportunities) {
    const opps: string[] = [];
    if (data.opportunities.gaps?.length) opps.push(`Content Gaps: ${data.opportunities.gaps.join(', ')}`);
    if (data.opportunities.weaknesses?.length) opps.push(`Competitor Weaknesses: ${data.opportunities.weaknesses.join(', ')}`);
    if (data.opportunities.underserved?.length) opps.push(`Underserved Audiences: ${data.opportunities.underserved.join(', ')}`);
    if (data.opportunities.opportunities?.length) opps.push(`Opportunities: ${data.opportunities.opportunities.join(', ')}`);
    
    if (opps.length > 0) {
      sections.push(`=== MARKET OPPORTUNITIES (leverage these) ===
${opps.join('\n')}`);
    }
  }

  // 5. Demand-Supply Gap
  if (data.demandSupplyGap) {
    let gapSection = `=== DEMAND-SUPPLY GAP ===
Key Insight: ${data.demandSupplyGap.keyInsight}`;
    if (data.demandSupplyGap.marketGaps?.length) {
      gapSection += `\nMarket Gaps: ${data.demandSupplyGap.marketGaps.join(', ')}`;
    }
    if (data.demandSupplyGap.topPainPoints?.length) {
      gapSection += `\nTop Uncovered Pain Points:
${data.demandSupplyGap.topPainPoints
  .filter(p => !p.covered)
  .slice(0, 5)
  .map(p => `- ${p.category}: ${p.description} (Score: ${p.score})`)
  .join('\n')}`;
    }
    sections.push(gapSection);
  }

  // 6. Strategic Angles
  if (data.strategicAngles?.angles && data.strategicAngles.angles.length > 0) {
    sections.push(`=== RECOMMENDED STRATEGIC ANGLES ===
Reasoning: ${data.strategicAngles.reasoning}

Top Angles:
${data.strategicAngles.angles.slice(0, 3).map((a, i) => 
  `${i + 1}. "${a.title}: ${a.subtitle}"
   Angle: ${a.angle}
   Target: ${a.targetAudience}
   Pain Points Addressed: ${a.painPointsAddressed?.join(', ') || 'N/A'}
   Competitive Advantage: ${a.competitiveAdvantage}`
).join('\n\n')}`);
  }

  // 7. Patterns from successful books
  if (data.patterns) {
    const patternsList: string[] = [];
    if (data.patterns.pageCountRange) patternsList.push(`Page Count Range: ${data.patterns.pageCountRange}`);
    if (data.patterns.priceSweet) patternsList.push(`Price Sweet Spot: ${data.patterns.priceSweet}`);
    if (data.patterns.emotionalPromises?.length) patternsList.push(`Emotional Promises: ${data.patterns.emotionalPromises.join(', ')}`);
    if (data.patterns.structuralPatterns?.length) patternsList.push(`Structural Patterns: ${data.patterns.structuralPatterns.join(', ')}`);
    
    if (patternsList.length > 0) {
      sections.push(`=== SUCCESS PATTERNS (from top sellers) ===
${patternsList.join('\n')}`);
    }
  }

  // 8. Verdict & Insights
  if (data.verdict) {
    sections.push(`=== MARKET VERDICT ===
Type: ${data.verdict.type}
Summary: ${data.verdict.summary}
Key Insights:
${data.verdict.insights?.map((i, idx) => `${idx + 1}. ${i}`).join('\n') || 'N/A'}`);
  }

  // 9. Real Community Voices (for emotional authenticity)
  if (data.socialExcerpts && data.socialExcerpts.length > 0) {
    const quotes = data.socialExcerpts
      .slice(0, 5)
      .map(e => `"${e.content.slice(0, 150)}..." (${e.source}${e.painPointMatch ? ` - re: ${e.painPointMatch}` : ''})`)
      .join('\n');
    sections.push(`=== REAL READER VOICES (use for emotional resonance) ===
${quotes}`);
  }

  return sections.join('\n\n');
}
