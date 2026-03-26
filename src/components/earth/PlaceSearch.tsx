'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

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

type SearchOption =
  | {
      id: string;
      label: string;
      kindLabel: string;
      type: 'space';
      value: SpaceObject;
    }
  | {
      id: string;
      label: string;
      kindLabel: string;
      type: 'place';
      value: SearchResult;
    };

const SPACE_OBJECTS: SpaceObject[] = [
  { id: 'iss', label: '国际空间站 (ISS)', keywords: ['iss', '国际空间站', 'international space station', '空间站'] },
  { id: 'tiangong', label: '天宫空间站', keywords: ['天宫', 'tiangong', 'css'] },
  { id: 'moon', label: '月球', keywords: ['月球', 'moon', '月亮'] },
  { id: 'sun', label: '太阳', keywords: ['太阳', 'sun', '恒星', 'solar'] }
];

const SEARCH_KIND_LABELS: Record<string, string> = {
  city: '城市',
  station: '车站',
  university: '高校',
  aerodrome: '机场',
  administrative: '行政区',
  suburb: '城区',
  county: '区县',
  province: '省份',
  state: '州省',
  country: '国家',
  village: '村镇',
  town: '城镇',
  hamlet: '聚落'
};

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

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
      setActiveIndex(-1);
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
      setActiveIndex(-1);
      onLocateObject?.(obj.id);
    },
    [onLocateObject]
  );

  const options = useMemo<SearchOption[]>(
    () => [
      ...spaceResults.map((item) => ({
        id: `space-${item.id}`,
        label: item.label,
        kindLabel: '天体',
        type: 'space' as const,
        value: item
      })),
      ...results.map((item) => ({
        id: `place-${item.id}`,
        label: item.label,
        kindLabel: formatSearchKind(item.kind),
        type: 'place' as const,
        value: item
      }))
    ],
    [results, spaceResults]
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

  useEffect(() => {
    if (options.length === 0) {
      setActiveIndex(-1);
      if (!loading) {
        setOpen(false);
      }
      return;
    }

    setActiveIndex((prev) => (prev >= 0 && prev < options.length ? prev : 0));
  }, [loading, options.length]);

  const hasResults = options.length > 0;
  const activeOptionId = open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const handleOptionSelect = useCallback(
    (option: SearchOption) => {
      if (option.type === 'space') {
        handleSpaceSelect(option.value);
        return;
      }

      handleSelect(option.value);
    },
    [handleSelect, handleSpaceSelect]
  );

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
          onKeyDown={(event) => {
            if (!hasResults) {
              if (event.key === 'Escape') {
                setOpen(false);
              }
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((prev) => (prev + 1) % options.length);
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1));
              return;
            }

            if (event.key === 'Enter' && open && activeIndex >= 0) {
              event.preventDefault();
              handleOptionSelect(options[activeIndex]);
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          aria-label="搜索地点或天体"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open && hasResults}
          aria-controls={hasResults ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          autoComplete="off"
        />
        {loading && <span className="placeSearchSpinner" />}
      </div>

      {open && hasResults && (
        <ul id={listboxId} className="placeSearchResults" role="listbox" aria-label="搜索建议">
          {options.map((option, index) => (
            <li
              key={option.id}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`placeSearchItem ${option.type === 'space' ? 'spaceObject' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleOptionSelect(option)}
            >
              <strong>{option.label}</strong>
              <span>{option.kindLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatSearchKind(kind: string) {
  return SEARCH_KIND_LABELS[kind] ?? kind;
}
