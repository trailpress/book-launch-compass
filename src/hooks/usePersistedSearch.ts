import { useState, useEffect, useCallback } from "react";

const SEARCH_STATE_KEY = "kdp_search_state_v2";
const STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ANALYSIS_RESUME_TTL_MS = 20 * 60 * 1000; // avoid reviving stale in-progress runs

interface SearchState {
  query: string;
  hasSearched: boolean;
  loadedAnalysisId: string | null;
  isAnalyzing: boolean;
  analysisStartedAt: number | null;
  timestamp: number;
}

const defaultState: SearchState = {
  query: "",
  hasSearched: false,
  loadedAnalysisId: null,
  isAnalyzing: false,
  analysisStartedAt: null,
  timestamp: 0,
};

function loadState(): SearchState {
  try {
    const saved = localStorage.getItem(SEARCH_STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<SearchState>;
      const hydrated: SearchState = {
        ...defaultState,
        ...parsed,
      };

      // Only restore if less than 24 hours old
      if (Date.now() - hydrated.timestamp < STATE_TTL_MS) {
        if (hydrated.isAnalyzing && !hydrated.analysisStartedAt) {
          return {
            ...hydrated,
            isAnalyzing: false,
            analysisStartedAt: null,
          };
        }

        if (
          hydrated.isAnalyzing &&
          hydrated.analysisStartedAt &&
          Date.now() - hydrated.analysisStartedAt > ANALYSIS_RESUME_TTL_MS
        ) {
          return {
            ...hydrated,
            isAnalyzing: false,
            analysisStartedAt: null,
          };
        }

        return hydrated;
      }
    }
  } catch (e) {
    console.error("Failed to restore search state:", e);
  }
  return defaultState;
}

// Persists search state across page reloads, orientation changes, and browser sessions
export function usePersistedSearch() {
  const [state, setStateInternal] = useState<SearchState>(loadState);

  // Persist state to localStorage whenever it changes
  const setState = useCallback((newState: Partial<SearchState>) => {
    setStateInternal((prev) => {
      const updated = {
        ...prev,
        ...newState,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to persist search state:", e);
      }
      return updated;
    });
  }, []);

  // Sync state across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SEARCH_STATE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Partial<SearchState>;
          const hydrated: SearchState = {
            ...defaultState,
            ...parsed,
          };

          if (Date.now() - hydrated.timestamp < STATE_TTL_MS) {
            if (
              hydrated.isAnalyzing &&
              (!hydrated.analysisStartedAt || Date.now() - hydrated.analysisStartedAt > ANALYSIS_RESUME_TTL_MS)
            ) {
              setStateInternal({
                ...hydrated,
                isAnalyzing: false,
                analysisStartedAt: null,
              });
              return;
            }

            setStateInternal(hydrated);
          }
        } catch (err) {
          console.error("Failed to sync state:", err);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState({ query, hasSearched: true });
  }, [setState]);

  const setLoadedAnalysisId = useCallback((id: string | null) => {
    setState({ loadedAnalysisId: id });
  }, [setState]);

  const setIsAnalyzing = useCallback((isAnalyzing: boolean) => {
    setStateInternal((prev) => {
      const updated = {
        ...prev,
        isAnalyzing,
        analysisStartedAt: isAnalyzing ? prev.analysisStartedAt ?? Date.now() : null,
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to persist search state:", e);
      }

      return updated;
    });
  }, []);

  const resetSearch = useCallback(() => {
    setStateInternal(defaultState);
    try {
      localStorage.removeItem(SEARCH_STATE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    searchQuery: state.query,
    hasSearched: state.hasSearched,
    loadedAnalysisId: state.loadedAnalysisId,
    isAnalyzing: state.isAnalyzing,
    analysisStartedAt: state.analysisStartedAt,
    setSearchQuery,
    setLoadedAnalysisId,
    setIsAnalyzing,
    resetSearch,
  };
}
