import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const RECENT_SEARCHES_KEY = "kdp_recent_search_terms_v1";
const SEARCH_STATE_KEY = "kdp_search_state";
const OFFLINE_SUGGESTIONS_COOLDOWN_MS = 60_000;
const FALLBACK_SUGGESTIONS = [
  "anxiety workbooks",
  "low content journals",
  "truck driver logbooks",
  "self-care planners",
  "budget trackers",
];

interface SearchInputProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export function SearchInput({ onSearch, isLoading = false }: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [amazonSuggestions, setAmazonSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [usingFallbackSuggestions, setUsingFallbackSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const activeRequestIdRef = useRef(0);
  const offlineSuggestionsUntilRef = useRef(0);
  const hasOpenSuggestions = showSuggestions && amazonSuggestions.length > 0;
  const suggestionsReservedSpace = hasOpenSuggestions
    ? Math.min(amazonSuggestions.length, 10) * 44 + 56
    : 0;

  const loadHistorySuggestions = useCallback(() => {
    try {
      const collected = new Set<string>();
      const addSuggestion = (value: unknown) => {
        if (typeof value === "string" && value.trim().length > 1) {
          collected.add(value.trim());
        }
      };

      const keys = [
        "kdp_saved_analyses_mirror_v1",
        "kdp_saved_analyses_cache_v1",
        "kdp_analysis_data_cache_v1",
        RECENT_SEARCHES_KEY,
        SEARCH_STATE_KEY,
      ];

      keys.forEach((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return;

        const parsed = JSON.parse(raw) as unknown;

        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (typeof item === "string") {
              addSuggestion(item);
              return;
            }

            if (typeof item === "object" && item !== null) {
              const record = item as Record<string, unknown>;
              addSuggestion(record.niche_keyword);
              addSuggestion(record.query);
            }
          });
          return;
        }

        if (typeof parsed === "object" && parsed !== null) {
          const record = parsed as Record<string, unknown>;
          addSuggestion(record.query);

          Object.values(record).forEach((item) => {
            if (typeof item !== "object" || item === null) return;
            const nested = item as Record<string, unknown>;
            addSuggestion(nested.niche_keyword);
            addSuggestion(nested.query);

            if (typeof nested.summary === "object" && nested.summary !== null) {
              addSuggestion((nested.summary as Record<string, unknown>).niche_keyword);
            }

            if (typeof nested.data === "object" && nested.data !== null) {
              addSuggestion((nested.data as Record<string, unknown>).niche);
              addSuggestion((nested.data as Record<string, unknown>).niche_keyword);
            }
          });
        }
      });

      return Array.from(collected).slice(0, 20);
    } catch {
      return [];
    }
  }, []);

  const buildGeneratedSuggestions = useCallback((searchQuery: string) => {
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < 2) return [];

    return Array.from(new Set([
      normalizedQuery,
      `${normalizedQuery} workbook`,
      `${normalizedQuery} journal`,
      `${normalizedQuery} planner`,
      `${normalizedQuery} logbook`,
      `${normalizedQuery} for adults`,
      `${normalizedQuery} for beginners`,
      `${normalizedQuery} gift`,
    ]));
  }, []);

  const persistRecentSearch = useCallback((value: string) => {
    const normalizedValue = value.trim();
    if (normalizedValue.length < 2) return;

    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [normalizedValue, ...(Array.isArray(parsed) ? parsed : []).filter((item) => item !== normalizedValue)].slice(0, 20);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // Ignore local write failures
    }
  }, []);

  const buildLocalSuggestions = useCallback((searchQuery: string) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length < 2) return [];

    const generated = buildGeneratedSuggestions(searchQuery);
    const suggestionPool = Array.from(new Set([...loadHistorySuggestions(), ...generated, ...FALLBACK_SUGGESTIONS]));

    const startsWithMatches = suggestionPool.filter((item) => item.toLowerCase().startsWith(normalizedQuery));
    const includesMatches = suggestionPool.filter(
      (item) => !item.toLowerCase().startsWith(normalizedQuery) && item.toLowerCase().includes(normalizedQuery)
    );
    const generatedMatches = generated.filter(
      (item) => !startsWithMatches.includes(item) && !includesMatches.includes(item)
    );

    return [...startsWithMatches, ...includesMatches, ...generatedMatches].slice(0, 8);
  }, [buildGeneratedSuggestions, loadHistorySuggestions]);

  // Fetch Amazon suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 2) {
      activeRequestIdRef.current += 1;
      setAmazonSuggestions([]);
      setLoadingSuggestions(false);
      setUsingFallbackSuggestions(false);
      return;
    }

    const requestId = ++activeRequestIdRef.current;
    if (Date.now() < offlineSuggestionsUntilRef.current) {
      setAmazonSuggestions(buildLocalSuggestions(normalizedQuery));
      setUsingFallbackSuggestions(true);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);

    try {
      const { data, error } = await supabase.functions.invoke('amazon-suggestions', {
        body: { query: normalizedQuery }
      });

      if (requestId !== activeRequestIdRef.current) return;

      if (error) {
        console.error('Error fetching suggestions:', error);
        offlineSuggestionsUntilRef.current = Date.now() + OFFLINE_SUGGESTIONS_COOLDOWN_MS;
        setAmazonSuggestions(buildLocalSuggestions(normalizedQuery));
        setUsingFallbackSuggestions(true);
      } else if (Array.isArray(data?.suggestions)) {
        const uniqueSuggestions = Array.from(
          new Set(
            (data.suggestions as unknown[])
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
          )
        );
        const nextSuggestions = uniqueSuggestions.length > 0
          ? uniqueSuggestions
          : buildLocalSuggestions(normalizedQuery);
        setAmazonSuggestions(nextSuggestions);
        setUsingFallbackSuggestions(uniqueSuggestions.length === 0);
      } else {
        setAmazonSuggestions(buildLocalSuggestions(normalizedQuery));
        setUsingFallbackSuggestions(true);
      }
    } catch (err) {
      if (requestId !== activeRequestIdRef.current) return;
      console.error('Failed to fetch Amazon suggestions:', err);
      offlineSuggestionsUntilRef.current = Date.now() + OFFLINE_SUGGESTIONS_COOLDOWN_MS;
      setAmazonSuggestions(buildLocalSuggestions(normalizedQuery));
      setUsingFallbackSuggestions(true);
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoadingSuggestions(false);
      }
    }
  }, [buildLocalSuggestions]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setAmazonSuggestions([]);
      setLoadingSuggestions(false);
      setUsingFallbackSuggestions(false);
      return;
    }

    const immediateSuggestions = buildLocalSuggestions(normalizedQuery);
    if (immediateSuggestions.length > 0) {
      setAmazonSuggestions(immediateSuggestions);
      setUsingFallbackSuggestions(true);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(normalizedQuery);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, fetchSuggestions, buildLocalSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside as unknown as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as unknown as EventListener);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      persistRecentSearch(query);
      activeRequestIdRef.current += 1;
      setShowSuggestions(false);
      onSearch(query.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    persistRecentSearch(suggestion);
    activeRequestIdRef.current += 1;
    setQuery(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    // Fill textbox only — do NOT auto-trigger analysis. User confirms with "Analyze Market".
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleSuggestionPointerSelect = (
    event: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>,
    suggestion: string,
    runNow = false,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (runNow) {
      handleSuggestionRunNow(suggestion);
      return;
    }
    handleSuggestionClick(suggestion);
  };

  const handleSuggestionRunNow = (suggestion: string) => {
    persistRecentSearch(suggestion);
    activeRequestIdRef.current += 1;
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || amazonSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < amazonSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : amazonSuggestions.length - 1
        );
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < amazonSuggestions.length) {
          e.preventDefault();
          handleSuggestionClick(amazonSuggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div
      className="w-full max-w-3xl mx-auto relative z-30 isolate"
      style={{ paddingBottom: suggestionsReservedSpace }}
    >
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={cn(
            "relative group transition-all duration-300",
            "before:absolute before:-inset-1 before:rounded-2xl before:bg-gradient-to-r before:from-primary/50 before:via-gold/50 before:to-success/50 before:opacity-0 before:blur-xl before:transition-opacity before:pointer-events-none",
            "hover:before:opacity-100 focus-within:before:opacity-100"
          )}
        >
          <div className="relative flex items-center bg-card border border-border rounded-xl overflow-hidden shadow-lg">
            <div className="pl-5">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                const nextQuery = e.target.value;
                setQuery(nextQuery);
                const shouldShowSuggestions = nextQuery.trim().length >= 2;
                setShowSuggestions(shouldShowSuggestions);
                if (!shouldShowSuggestions) {
                  activeRequestIdRef.current += 1;
                  setAmazonSuggestions([]);
                  setUsingFallbackSuggestions(false);
                }
                setSelectedIndex(-1);
              }}
              onFocus={() => setShowSuggestions(query.trim().length >= 2)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a niche or keyword (e.g., anxiety workbooks, truck driver logbooks)"
              className="flex-1 py-5 px-4 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-lg"
              disabled={isLoading}
              autoComplete="off"
            />
            <div className="pr-3">
              <Button
                type="submit"
                variant="hero"
                size="lg"
                disabled={!query.trim() || isLoading}
                className="rounded-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze Market
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Amazon Autocomplete Suggestions Dropdown */}
          {hasOpenSuggestions && (
            <div
              ref={suggestionsRef}
              className="absolute z-[80] w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            >
              <div className="py-2">
                <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-muted-foreground border-b border-border mb-1">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" 
                    alt="Amazon" 
                    className="h-3 opacity-60"
                  />
                  <span>Suggestions from Amazon Books</span>
                  {usingFallbackSuggestions && <span>• fallback locale</span>}
                  {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                {amazonSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion}
                    className={cn(
                      "w-full flex items-center transition-colors",
                      index === selectedIndex
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onPointerDown={(e) => handleSuggestionPointerSelect(e, suggestion)}
                      onMouseDown={(e) => handleSuggestionPointerSelect(e, suggestion)}
                      className="flex-1 px-4 py-2.5 text-left flex items-center gap-3 min-w-0"
                      title="Inserisci nel campo di ricerca"
                    >
                      <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{suggestion}</span>
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => handleSuggestionPointerSelect(e, suggestion, true)}
                      onMouseDown={(e) => handleSuggestionPointerSelect(e, suggestion, true)}
                      className="px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-primary border-l border-border/50 flex-shrink-0"
                      title="Analizza subito"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">Try:</span>
        {FALLBACK_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => {
              persistRecentSearch(suggestion);
              setQuery(suggestion);
              onSearch(suggestion);
            }}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-full transition-colors disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
