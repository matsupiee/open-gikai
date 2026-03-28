import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { client } from "@/lib/orpc/orpc";
import { useDebouncedValue } from "@/shared/_hooks/use-debounced-value";

import { usePersistedMunicipalityCodes } from "./usePersistedMunicipalityCodes";

import type { SearchParams } from "../index";

const DEBOUNCE_MS = 300;
const LIMIT = 10;

export function useSearch(searchParams: SearchParams) {
  const navigate = useNavigate();

  const { municipalityCodes, setMunicipalityCodes } = usePersistedMunicipalityCodes();

  // Local state initialized from URL params (for responsive input)
  const [query, setQuery] = useState(searchParams.q ?? "");
  const [kind, setKind] = useState<"question" | "answer" | "">(searchParams.kind ?? "");
  const [heldOnFrom, setHeldOnFrom] = useState(searchParams.heldOnFrom ?? "");
  const [heldOnTo, setHeldOnTo] = useState(searchParams.heldOnTo ?? "");

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  // Sync debounced/filter state to URL params
  useEffect(() => {
    const params: SearchParams = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (kind) params.kind = kind;
    if (heldOnFrom) params.heldOnFrom = heldOnFrom;
    if (heldOnTo) params.heldOnTo = heldOnTo;

    navigate({
      to: "/search",
      search: params,
      replace: true,
    });
  }, [debouncedQuery, kind, heldOnFrom, heldOnTo, navigate]);

  const searchInput = {
    q: debouncedQuery.trim() || undefined,
    kind: (kind || undefined) as "question" | "answer" | undefined,
    heldOnFrom: heldOnFrom || undefined,
    heldOnTo: heldOnTo || undefined,
    municipalityCodes: municipalityCodes.length > 0 ? municipalityCodes : undefined,
    limit: LIMIT,
  };

  const searchReady = municipalityCodes.length > 0 && debouncedQuery.trim().length > 0;

  const infiniteQuery = useInfiniteQuery({
    queryKey: ["statements", "search", searchInput],
    queryFn: ({ pageParam }) =>
      client.statements.search({
        ...searchInput,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: searchReady,
  });

  const statements = infiniteQuery.data?.pages.flatMap((page) => page.statements) ?? [];

  const hasSearched = debouncedQuery.trim().length > 0;

  const handleReset = () => {
    setQuery("");
    setKind("");
    setHeldOnFrom("");
    setHeldOnTo("");
  };

  return {
    query,
    setQuery,
    kind,
    setKind,
    heldOnFrom,
    setHeldOnFrom,
    heldOnTo,
    setHeldOnTo,
    municipalityCodes,
    setMunicipalityCodes,
    statements,
    isLoading: infiniteQuery.isLoading,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasSearched,
    handleReset,
  };
}
