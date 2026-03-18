import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import type { CampusStop } from "@/lib/stops";

interface StopTypeaheadProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (stop: CampusStop) => void;
  placeholder: string;
  stops: CampusStop[];
  minChars?: number;
  maxResults?: number;
  debounceMs?: number;
  remoteEndpoint?: string;
  icon?: ReactNode;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegex(query)})`, "ig");
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === query.toLowerCase();
    return isMatch
      ? <span key={`${part}-${index}`} className="text-primary font-semibold">{part}</span>
      : <span key={`${part}-${index}`}>{part}</span>;
  });
}

export default function StopTypeahead({
  value,
  onChange,
  onSelect,
  placeholder,
  stops,
  minChars = 2,
  maxResults = 8,
  debounceMs = 300,
  remoteEndpoint,
  icon,
}: StopTypeaheadProps) {
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteResults, setRemoteResults] = useState<CampusStop[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(value);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs]);

  useEffect(() => {
    function onDocumentMouseDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  useEffect(() => {
    if (!remoteEndpoint || debouncedQuery.trim().length < minChars) {
      setRemoteResults(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`${remoteEndpoint}?q=${encodeURIComponent(debouncedQuery)}&limit=${maxResults}`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("suggest request failed")))
      .then((data) => {
        if (cancelled) return;
        const suggestions = Array.isArray(data?.suggestions)
          ? data.suggestions
          : [];
        setRemoteResults(suggestions);
      })
      .catch(() => {
        if (cancelled) return;
        setRemoteResults(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, remoteEndpoint, minChars, maxResults]);

  const localMatches = useMemo(() => {
    if (debouncedQuery.trim().length < minChars) {
      return [];
    }

    const normalized = debouncedQuery.toLowerCase().trim();
    return stops
      .filter((stop) => stop.name.toLowerCase().includes(normalized))
      .slice(0, maxResults);
  }, [debouncedQuery, stops, minChars, maxResults]);

  const suggestions = remoteResults ?? localMatches;
  const shouldShowNoResults = debouncedQuery.trim().length >= minChars && suggestions.length === 0 && !isLoading;

  const handleSelect = (stop: CampusStop) => {
    onChange(stop.name);
    onSelect(stop);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        {icon ?? <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
        <input
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (value.trim().length >= minChars) {
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (!open && event.key === "ArrowDown" && suggestions.length > 0) {
              setOpen(true);
              setActiveIndex(0);
              event.preventDefault();
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!suggestions.length) return;
              setActiveIndex((prev) => (prev + 1) % suggestions.length);
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!suggestions.length) return;
              setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
            }

            if (event.key === "Enter" && open && activeIndex >= 0 && suggestions[activeIndex]) {
              event.preventDefault();
              handleSelect(suggestions[activeIndex]);
            }

            if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          className="w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>

      {open && value.trim().length >= minChars && (
        <div className="absolute mt-2 w-full rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-xl z-30 max-h-72 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Loading suggestions...</div>
          )}

          {!isLoading && suggestions.map((stop, index) => (
            <button
              key={stop.name}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(stop)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                index === activeIndex ? "bg-primary/15 text-foreground" : "hover:bg-muted/60 text-foreground"
              }`}
            >
              {highlightMatch(stop.name, debouncedQuery)}
            </button>
          ))}

          {shouldShowNoResults && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
