import { useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { Input } from "@/shared/_components/ui/input";

import { MunicipalitySelector } from "./_components/municipality-selector";
import { SearchFilters } from "./_components/search-filters";
import { SkeletonCard } from "./_components/skeleton-card";
import { StatementCard } from "./_components/statement-card";
import { useSearch } from "./_hooks/useSearch";

export const Route = createFileRoute("/search/")({
  component: RouteComponent,
});

export function RouteComponent() {
  const {
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
    isLoading,
    hasSearched,
    handleReset,
  } = useSearch();

  const [showFilters, setShowFilters] = useState(false);

  const canSearch = municipalityCodes.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold mb-1">議会答弁調査</h1>
          <p className="text-sm text-muted-foreground">過去の答弁を素早く検索できます</p>
        </div>

        <div className="mb-6 rounded border border-border bg-card p-4">
          <MunicipalitySelector selectedCodes={municipalityCodes} onChange={setMunicipalityCodes} />
        </div>

        {!canSearch && (
          <div className="rounded border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              上のセレクターから自治体を選択すると、検索が可能になります
            </p>
          </div>
        )}

        {canSearch && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded border border-border bg-card p-4">
              <Input
                type="text"
                placeholder="検索ワードを入力してください"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full"
              />

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-xs text-muted-foreground hover:text-foreground text-left"
              >
                {showFilters ? "▲ フィルターを閉じる" : "▼ フィルターで絞り込む"}
              </button>

              {showFilters && (
                <SearchFilters
                  kind={kind}
                  setKind={(v) => setKind(v as "question" | "answer" | "")}
                  heldOnFrom={heldOnFrom}
                  setHeldOnFrom={setHeldOnFrom}
                  heldOnTo={heldOnTo}
                  setHeldOnTo={setHeldOnTo}
                  onReset={handleReset}
                />
              )}
            </div>

            {/* Results + Citation Panel */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              {/* Main Results */}
              <div className="flex-1 min-w-0 space-y-4">
                {isLoading && (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </>
                )}

                {!hasSearched && !isLoading && (
                  <div className="rounded border border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">検索ワード未入力</p>
                  </div>
                )}

                {hasSearched && !isLoading && statements.length === 0 && (
                  <div className="rounded border border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">発言が見つかりませんでした</p>
                  </div>
                )}

                {statements.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground">{statements.length}件の結果</div>
                    <div className="grid gap-4">
                      {statements.map((statement) => (
                        <StatementCard
                          key={statement.id}
                          statement={statement}
                          showSimilarity={false}
                          onCite={() => {}}
                          isCited={false}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
