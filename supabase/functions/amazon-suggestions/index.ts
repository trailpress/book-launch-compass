import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// SECURITY: Allowed origins for CORS - prevents cross-origin API abuse
const ALLOWED_ORIGINS = [
  'https://id-preview--13defa98-1cf8-4dc3-afbb-8eaa8e0e92f2.lovable.app',
  'https://13defa98-1cf8-4dc3-afbb-8eaa8e0e92f2.lovableproject.com',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  
  // Check if origin matches allowed patterns
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
    origin.endsWith('.lovable.app') || 
    origin.endsWith('.lovableproject.com');
  
  if (isAllowed && origin) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Amazon's autocomplete API endpoint for Books category
    // Using the US Amazon marketplace
    const amazonUrl = `https://completion.amazon.com/api/2017/suggestions?session-id=000-0000000-0000000&customer-id=&request-id=TVFPDS2T4RXQN&page-type=Gateway&lop=en_US&site-variant=desktop&client-info=amazon-search-ui&mid=ATVPDKIKX0DER&alias=stripbooks&ks=80&prefix=${encodeURIComponent(query)}&event=onKeyPress&limit=10&fb=1&suggestion-type=KEYWORD`;

    console.log('Fetching Amazon suggestions for:', query);

    const response = await fetch(amazonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.amazon.com',
        'Referer': 'https://www.amazon.com/',
      },
    });

    if (!response.ok) {
      console.error('Amazon API error:', response.status);
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Extract suggestions from Amazon's response format
    const suggestions: string[] = [];
    
    if (data.suggestions && Array.isArray(data.suggestions)) {
      for (const item of data.suggestions) {
        if (item.value) {
          suggestions.push(item.value);
        }
      }
    }

    console.log('Found', suggestions.length, 'Amazon suggestions');

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Amazon suggestions:', error);
    return new Response(
      JSON.stringify({ suggestions: [], error: 'Failed to fetch suggestions' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
