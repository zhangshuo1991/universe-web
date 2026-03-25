'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SearchResult = {
  id: number;
  label: string;
  lat: number;
  lon: number;
  kind: string;
  importance: number;
};

type SpaceObject = {
  id: string;
  label: string;
  keywords: string[];
};

const SPACE_OBJECTS: SpaceObject[] = [
  { id: 'iss', label: '国际空间站 (ISS)', keywords: ['iss', '国际空间站', 'international space station', '空间站'] },
  { id: 'tiangong', label: '天宫空间站', keywords: ['天宫', 'tiangong', 'css'] },
  { id: 'moon', label: '月球', keywords: ['月球', 'moon', '月亮'] },
  { id: 'sun', label: '太阳', keywords: ['太阳', 'sun', '恒星', 'solar'] }
];

type PlaceSearchProps = {
  onSelect: (lat: number, lon: number, label: string) => void;
  onLocateObject?: (objectId: string) => void;
};

export function PlaceSearch({ onSelect, onLocateObject }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [spaceResults, setSpaceResults] = useState<SpaceObject[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const matchSpaceObjects = useCallback((q: string) => {
    const lower = q.trim().toLowerCase();
    if (lower.length < 1) return [];
    return SPACE_OBJECTS.filter((obj) =>
      obj.keywords.some((kw) => kw.includes(lower) || lower.includes(kw))
    );
  }, []);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    const matched = matchSpaceObjects(trimmed);
    setSpaceResults(matched);

    if (trimmed.length < 2) {
      setResults([]);
      if (matched.length > 0) setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      const data = (await response.json()) as { results: SearchResult[] };
      setResults(data.results ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [matchSpaceObjects]);

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), 350);
    },
    [search]
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setQuery(result.label);
      setOpen(false);
      setResults([]);
      setSpaceResults([]);
      onSelect(result.lat, result.lon, result.label);
    },
    [onSelect]
  );

  const handleSpaceSelect = useCallback(
    (obj: SpaceObject) => {
      setQuery(obj.label);
      setOpen(false);
      setResults([]);
      setSpaceResults([]);
      onLocateObject?.(obj.id);
    },
    [onLocateObject]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasResults = results.length > 0 || spaceResults.length > 0;

  return (
    <div className="placeSearchWrapper" ref={wrapperRef}>
      <div className="placeSearchInputWrap">
        <svg className="placeSearchIcon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z" />
        </svg>
        <input
          type="search"
          className="placeSearchInput"
          placeholder="搜索地点或天体…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => hasResults && setOpen(true)}
          aria-label="搜索地点或天体"
          autoComplete="off"
        />
        {loading && <span className="placeSearchSpinner" />}
      </div>

      {open && hasResults && (
        <ul className="placeSearchResults" role="listbox">
          {spaceResults.map((obj) => (
            <li key={obj.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="placeSearchItem spaceObject"
                onClick={() => handleSpaceSelect(obj)}
              >
                <strong>{obj.label}</strong>
                <span>天体</span>
              </button>
            </li>
          ))}
          {results.map((result) => (
            <li key={result.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="placeSearchItem"
                onClick={() => handleSelect(result)}
              >
                <strong>{result.label}</strong>
                <span>{result.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
