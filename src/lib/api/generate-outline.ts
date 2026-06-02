import { supabase } from "@/integrations/supabase/client";
import { AnalysisData } from "./kdp-analysis";
import { BookOutline } from "@/components/BookOutlineModal";

export interface OutlineResponse {
  success: boolean;
  outline?: BookOutline;
  niche?: string;
  error?: string;
}

export async function generateBookOutline(analysisData: AnalysisData): Promise<OutlineResponse> {
  try {
    console.log('Generating book outline for:', analysisData.niche);

    const { data, error } = await supabase.functions.invoke('generate-outline', {
      body: { analysisData }
    });

    if (error) {
      console.error('Edge function error:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to generate outline' };
    }

    return {
      success: true,
      outline: data.outline,
      niche: data.niche
    };

  } catch (err) {
    console.error('Outline generation error:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to generate outline' 
    };
  }
}
