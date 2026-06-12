import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { AnalysisResults } from "@/components/AnalysisResults";
import { SavedAnalyses } from "@/components/SavedAnalyses";
import { getAnalysisById, AnalysisData } from "@/lib/api/kdp-analysis";
import { usePersistedSearch } from "@/hooks/usePersistedSearch";

const Index = () => {
  const { 
    searchQuery, 
    hasSearched, 
    loadedAnalysisId,
    isAnalyzing,
    analysisStartedAt,
    setSearchQuery, 
    setLoadedAnalysisId,
    setIsAnalyzing,
    resetSearch 
  } = usePersistedSearch();
  
  const [isLoading, setIsLoading] = useState(isAnalyzing);
  const [isResuming, setIsResuming] = useState(isAnalyzing); // true only on page load resume
  const [loadedData, setLoadedData] = useState<AnalysisData | null>(null);

  const isSameNiche = (analysis: AnalysisData | null, query: string) =>
    Boolean(analysis?.niche) && analysis.niche.trim().toLowerCase() === query.trim().toLowerCase();

  // Restore loaded data if we have an analysis ID
  useEffect(() => {
    if (loadedAnalysisId && hasSearched && !loadedData && !isLoading) {
      setIsLoading(true);
      getAnalysisById(loadedAnalysisId).then((result) => {
        if (result.success && result.data && isSameNiche(result.data, searchQuery)) {
          setLoadedData(result.data);
        } else {
          setLoadedAnalysisId(null);
          setLoadedData(null);
        }
        setIsAnalyzing(false);
        setIsLoading(false);
      });
    }
  }, [loadedAnalysisId, hasSearched, loadedData, isLoading, searchQuery, setIsAnalyzing, setLoadedAnalysisId]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsAnalyzing(true);
    setIsLoading(true);
    setIsResuming(false); // fresh search, not a resume
    setLoadedData(null);
    setLoadedAnalysisId(null);
  };

  const handleLoadingChange = (loading: boolean) => {
    setIsAnalyzing(loading);
    setIsLoading(loading);
  };

  const handleAnalysisComplete = (analysisId: string) => {
    setLoadedAnalysisId(analysisId);
    setIsAnalyzing(false);
  };

  const handleLoadAnalysis = async (analysisId: string, niche: string) => {
    setIsAnalyzing(false);
    setIsLoading(true);
    setSearchQuery(niche);
    setLoadedAnalysisId(analysisId);
    
    const result = await getAnalysisById(analysisId);
    
    if (result.success && result.data && isSameNiche(result.data, niche)) {
      setLoadedData(result.data);
    }
    
    setIsLoading(false);
  };

  const handleNewSearch = () => {
    resetSearch();
    setIsAnalyzing(false);
    setIsLoading(false);
    setLoadedData(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {!hasSearched ? (
        <>
          <HeroSection onSearch={handleSearch} isLoading={isLoading} />
          
          {/* Saved Analyses History Section - Always visible on home */}
          <section className="container py-12">
            <SavedAnalyses 
              onSelectAnalysis={(analysis) => {
                handleLoadAnalysis(analysis.id, analysis.niche_keyword);
              }}
            />
          </section>
        </>
      ) : (
        <>
          {/* Compact Search Header */}
          <section className="py-8 border-b border-border/50">
            <div className="container">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {loadedData ? "Analisi caricata per" : "Analizzando mercato per"}
                  </p>
                  <h1 className="text-2xl font-bold">{searchQuery}</h1>
                </div>
                <button
                  onClick={handleNewSearch}
                  className="text-sm text-primary hover:underline"
                >
                  Nuova Ricerca
                </button>
              </div>
            </div>
          </section>

          <AnalysisResults 
            niche={searchQuery} 
            isLoading={isLoading} 
            isResuming={isResuming}
            analysisStartedAt={analysisStartedAt}
            onLoadingChange={handleLoadingChange}
            initialData={loadedData}
            onLoadAnalysis={handleLoadAnalysis}
            onAnalysisComplete={handleAnalysisComplete}
          />
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 mt-16">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-blue-500">
                <svg
                  className="w-5 h-5 text-primary-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold">
                KDP<span className="gradient-text">Intel</span>
              </span>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Real data from Reddit, Quora & forums. AI-powered market intelligence for Amazon KDP.
            </p>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
