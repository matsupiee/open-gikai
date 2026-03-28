import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc/orpc";
import { useDebouncedValue } from "@/shared/_hooks/use-debounced-value";

import { usePersistedMunicipalityCodes } from "./usePersistedMunicipalityCodes";

const DEBOUNCE_MS = 300;

export function useSearch() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"question" | "answer" | "">("");
  const [speakerName, setSpeakerName] = useState("");
  const [heldOnFrom, setHeldOnFrom] = useState("");
  const [heldOnTo, setHeldOnTo] = useState("");

  const { municipalityCodes, setMunicipalityCodes } = usePersistedMunicipalityCodes();

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const debouncedSpeakerName = useDebouncedValue(speakerName, DEBOUNCE_MS);

  const searchReady =
    municipalityCodes.length > 0 &&
    (debouncedQuery.trim().length > 0 || debouncedSpeakerName.trim().length > 0);

  const keywordQuery = useQuery({
    ...orpc.statements.search.queryOptions({
      input: {
        q: debouncedQuery.trim() || undefined,
        kind: (kind || undefined) as "question" | "answer" | undefined,
        speakerName: debouncedSpeakerName.trim() || undefined,
        heldOnFrom: heldOnFrom || undefined,
        heldOnTo: heldOnTo || undefined,
        municipalityCodes: municipalityCodes.length > 0 ? municipalityCodes : undefined,
        limit: 10,
      },
    }),
    enabled: searchReady,
  });

  const { data: keywordData, isLoading: keywordLoading } = keywordQuery;

  const statements = keywordData?.statements ?? [];

  const isLoading = keywordLoading;

  const hasSearched = debouncedQuery.trim().length > 0 || debouncedSpeakerName.trim().length > 0;

  const handleReset = () => {
    setQuery("");
    setKind("");
    setSpeakerName("");
    setHeldOnFrom("");
    setHeldOnTo("");
  };

  return {
    query,
    setQuery,
    kind,
    setKind,
    speakerName,
    setSpeakerName,
    heldOnFrom,
    setHeldOnFrom,
    heldOnTo,
    setHeldOnTo,
    municipalityCodes,
    setMunicipalityCodes,
    statements,
    isLoading,
    hasSearched,
    handleReset,
  };
}
