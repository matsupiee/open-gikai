import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc/orpc";

export type SearchMode = "keyword" | "semantic";
export type PageMode = "question" | "policy";

export interface Statement {
  id: string;
  meetingId: string;
  kind: string;
  speakerName: string | null;
  content: string;
  createdAt: Date;
  meetingTitle: string;
  heldOn: string;
  prefecture: string;
  municipality: string;
  sourceUrl: string | null;
  similarity?: number;
}

type SubmittedQuery = {
  q?: string;
  kind?: string;
  speakerName?: string;
  heldOnFrom?: string;
  heldOnTo?: string;
  prefecture?: string;
  municipalityCodes?: string[];
  semanticQuery?: string;
  topK?: number;
} | null;

const STORAGE_KEY = "open-gikai:selectedMunicipalityCodes";

function loadMunicipalityCodes(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveMunicipalityCodes(codes: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // ignore
  }
}

export function useSearch() {
  const [pageMode, setPageMode] = useState<PageMode>("question");
  // 「質問から探す」→ semantic、「政策から探す」→ keyword に自動決定
  const searchMode: SearchMode = pageMode === "question" ? "semantic" : "keyword";

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [heldOnFrom, setHeldOnFrom] = useState("");
  const [heldOnTo, setHeldOnTo] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [municipalityCodes, setMunicipalityCodesState] = useState<string[]>(loadMunicipalityCodes);
  const [assemblyLevel, setAssemblyLevel] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<SubmittedQuery>(null);
  const [citations, setCitations] = useState<Statement[]>([]);

  const setMunicipalityCodes = (codes: string[]) => {
    setMunicipalityCodesState(codes);
    saveMunicipalityCodes(codes);
  };

  const keywordQuery = useQuery({
    ...orpc.statements.search.queryOptions({
      input:
        submittedQuery && searchMode === "keyword"
          ? {
              q: submittedQuery.q,
              kind: (submittedQuery.kind || undefined) as
                | "question"
                | "answer"
                | "remark"
                | "unknown"
                | undefined,
              speakerName: submittedQuery.speakerName || undefined,
              heldOnFrom: submittedQuery.heldOnFrom || undefined,
              heldOnTo: submittedQuery.heldOnTo || undefined,
              prefecture: submittedQuery.prefecture || undefined,
              municipalityCodes: submittedQuery.municipalityCodes,
            }
          : {},
    }),
    enabled: submittedQuery !== null && searchMode === "keyword",
  });

  const semanticQuery = useQuery({
    ...orpc.statements.semanticSearch.queryOptions({
      input:
        submittedQuery && searchMode === "semantic"
          ? {
              query: submittedQuery.semanticQuery || "",
              topK: submittedQuery.topK || 10,
              filters: {
                prefecture: submittedQuery.prefecture || undefined,
                municipalityCodes: submittedQuery.municipalityCodes,
                heldOnFrom: submittedQuery.heldOnFrom || undefined,
                heldOnTo: submittedQuery.heldOnTo || undefined,
              },
            }
          : { query: "", filters: {} },
    }),
    enabled: submittedQuery !== null && searchMode === "semantic",
  });

  const { data: keywordData, isLoading: keywordLoading } = keywordQuery;
  const { data: semanticData, isLoading: semanticLoading } = semanticQuery;

  const statements =
    searchMode === "keyword"
      ? (keywordData?.statements ?? [])
      : (semanticData?.statements ?? []);

  const isLoading = searchMode === "keyword" ? keywordLoading : semanticLoading;

  const hasSearched = submittedQuery !== null;

  const triggerSearch = (
    effectiveQuery: string,
    effectiveMode: SearchMode,
    overrideFilters?: {
      kind?: string;
      prefecture?: string;
      municipalityCodes?: string[];
      heldOnFrom?: string;
      heldOnTo?: string;
    }
  ) => {
    setSubmittedQuery({
      q: effectiveMode === "keyword" ? effectiveQuery : undefined,
      semanticQuery: effectiveMode !== "keyword" ? effectiveQuery : undefined,
      kind: overrideFilters?.kind ?? (kind || undefined),
      speakerName: speakerName || undefined,
      heldOnFrom: overrideFilters?.heldOnFrom ?? (heldOnFrom || undefined),
      heldOnTo: overrideFilters?.heldOnTo ?? (heldOnTo || undefined),
      prefecture: overrideFilters?.prefecture ?? (prefecture || undefined),
      municipalityCodes:
        overrideFilters?.municipalityCodes ??
        (municipalityCodes.length > 0 ? municipalityCodes : undefined),
      topK: 10,
    });
  };

  const handleSearch = () => {
    if (!query.trim() && searchMode === "keyword") return;
    if (municipalityCodes.length === 0) return;
    triggerSearch(query, searchMode);
  };

  const handleCategorySearch = (categoryQuery: string) => {
    if (municipalityCodes.length === 0) return;
    setQuery(categoryQuery);
    triggerSearch(categoryQuery, "keyword");
  };

  const handleReset = () => {
    setQuery("");
    setKind("");
    setSpeakerName("");
    setHeldOnFrom("");
    setHeldOnTo("");
    setPrefecture("");
    setAssemblyLevel("");
    setSubmittedQuery(null);
  };

  const addCitation = (statement: Statement) => {
    setCitations((prev) =>
      prev.find((c) => c.id === statement.id) ? prev : [...prev, statement]
    );
  };

  const removeCitation = (id: string) => {
    setCitations((prev) => prev.filter((c) => c.id !== id));
  };

  const clearCitations = () => setCitations([]);

  return {
    pageMode,
    setPageMode,
    searchMode,
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
    prefecture,
    setPrefecture,
    municipalityCodes,
    setMunicipalityCodes,
    statements,
    isLoading,
    hasSearched,
    isKeywordSearch: searchMode === "keyword",
    assemblyLevel,
    setAssemblyLevel,
    handleSearch,
    handleCategorySearch,
    handleReset,
    citations,
    addCitation,
    removeCitation,
    clearCitations,
  };
}
