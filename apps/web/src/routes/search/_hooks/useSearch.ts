import { useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { client } from "@/lib/orpc/orpc";

import { usePersistedMunicipalityCodes } from "./usePersistedMunicipalityCodes";

import type { SearchParams } from "../index";

const LIMIT = 10;

export function useSearch(searchParams: SearchParams) {
  const navigate = useNavigate();

  const { municipalityCodes, setMunicipalityCodes } = usePersistedMunicipalityCodes();

  const query = searchParams.q ?? "";
  const kind = searchParams.kind ?? "";
  const heldOnFrom = searchParams.heldOnFrom ?? "";
  const heldOnTo = searchParams.heldOnTo ?? "";

  const setSearchParam = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => {
    navigate({
      to: "/search",
      search: (prev) => {
        const next = { ...prev, [key]: value };
        for (const k of Object.keys(next) as (keyof SearchParams)[]) {
          if (next[k] === "" || next[k] === undefined) {
            delete next[k];
          }
        }
        return next;
      },
      replace: true,
    });
  };

  const setQuery = (v: string) => setSearchParam("q", v);
  const setKind = (v: "question" | "answer" | "") => setSearchParam("kind", v);
  const setHeldOnFrom = (v: string) => setSearchParam("heldOnFrom", v);
  const setHeldOnTo = (v: string) => setSearchParam("heldOnTo", v);

  const searchInput = {
    q: query.trim() || undefined,
    kind: (kind || undefined) as "question" | "answer" | undefined,
    heldOnFrom: heldOnFrom || undefined,
    heldOnTo: heldOnTo || undefined,
    municipalityCodes: municipalityCodes.length > 0 ? municipalityCodes : undefined,
    limit: LIMIT,
  };

  const searchReady = municipalityCodes.length > 0 && query.trim().length > 0;

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

  const hasSearched = query.trim().length > 0;

  const handleReset = () => {
    navigate({
      to: "/search",
      search: {},
      replace: true,
    });
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
