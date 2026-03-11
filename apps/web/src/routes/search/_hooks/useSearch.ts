import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc/orpc";

export type SearchMode = "keyword" | "semantic" | "ai";

export interface Statement {
  id: string;
  meetingId: string;
  kind: string;
  speakerName: string | null;
  content: string;
  createdAt: Date;
  meetingTitle: string;
  heldOn: string;
  prefecture: string | null;
  municipality: string | null;
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
  municipality?: string;
  assemblyLevel?: string;
  semanticQuery?: string;
  topK?: number;
} | null;

export function useSearch() {
  const [searchMode, setSearchMode] = useState<SearchMode>("keyword");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [heldOnFrom, setHeldOnFrom] = useState("");
  const [heldOnTo, setHeldOnTo] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [assemblyLevel, setAssemblyLevel] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<SubmittedQuery>(null);

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
              municipality: submittedQuery.municipality || undefined,
              assemblyLevel: (submittedQuery.assemblyLevel || undefined) as
                | "national"
                | "prefectural"
                | "municipal"
                | undefined,
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
                municipality: submittedQuery.municipality || undefined,
                assemblyLevel: (submittedQuery.assemblyLevel || undefined) as
                  | "national"
                  | "prefectural"
                  | "municipal"
                  | undefined,
                heldOnFrom: submittedQuery.heldOnFrom || undefined,
                heldOnTo: submittedQuery.heldOnTo || undefined,
              },
            }
          : { query: "", filters: {} },
    }),
    enabled: submittedQuery !== null && searchMode === "semantic",
  });

  const askQuery = useQuery({
    ...orpc.statements.ask.queryOptions({
      input:
        submittedQuery && searchMode === "ai"
          ? {
              query: submittedQuery.semanticQuery || "",
              topK: 8,
              filters: {
                prefecture: submittedQuery.prefecture || undefined,
                municipality: submittedQuery.municipality || undefined,
                assemblyLevel: (submittedQuery.assemblyLevel || undefined) as
                  | "national"
                  | "prefectural"
                  | "municipal"
                  | undefined,
                heldOnFrom: submittedQuery.heldOnFrom || undefined,
                heldOnTo: submittedQuery.heldOnTo || undefined,
              },
            }
          : { query: "" },
    }),
    enabled: submittedQuery !== null && searchMode === "ai",
  });

  const { data: keywordData, isLoading: keywordLoading } = keywordQuery;
  const { data: semanticData, isLoading: semanticLoading } = semanticQuery;
  const { data: askData, isLoading: askLoading } = askQuery;

  const statements =
    searchMode === "keyword"
      ? keywordData?.statements || []
      : searchMode === "semantic"
      ? semanticData?.statements || []
      : [];

  const isLoading =
    searchMode === "keyword"
      ? keywordLoading
      : searchMode === "semantic"
      ? semanticLoading
      : askLoading;

  const hasSearched = submittedQuery !== null;

  const handleSearch = () => {
    if (!query.trim() && searchMode === "keyword") return;
    setSubmittedQuery({
      q: searchMode === "keyword" ? query : undefined,
      semanticQuery: searchMode !== "keyword" ? query : undefined,
      kind: kind || undefined,
      speakerName: speakerName || undefined,
      heldOnFrom: heldOnFrom || undefined,
      heldOnTo: heldOnTo || undefined,
      prefecture: prefecture || undefined,
      municipality: municipality || undefined,
      assemblyLevel: assemblyLevel || undefined,
      topK: 10,
    });
  };

  const handleReset = () => {
    setQuery("");
    setKind("");
    setSpeakerName("");
    setHeldOnFrom("");
    setHeldOnTo("");
    setPrefecture("");
    setMunicipality("");
    setAssemblyLevel("");
    setSubmittedQuery(null);
  };

  return {
    searchMode,
    setSearchMode,
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
    municipality,
    setMunicipality,
    assemblyLevel,
    setAssemblyLevel,
    statements,
    isLoading,
    hasSearched,
    isKeywordSearch: searchMode === "keyword",
    aiAnswer: askData?.answer ?? null,
    aiSources: askData?.sources ?? [],
    handleSearch,
    handleReset,
  };
}
