import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/shared/_components/ui/button";
import { Input } from "@/shared/_components/ui/input";

import { MunicipalitySelector } from "@/shared/_components/municipality-selector";
import { SearchFilters } from "./_components/search-filters";
import { SkeletonCard } from "./_components/skeleton-card";
import { StatementCard } from "./_components/statement-card";
import { useSearch } from "./_hooks/useSearch";

export interface SearchParams {
  q?: string;
  kind?: "question" | "answer" | "";
  heldOnFrom?: string;
  heldOnTo?: string;
}

export const Route = createFileRoute("/search/")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    kind:
      search.kind === "question" || search.kind === "answer" || search.kind === ""
        ? search.kind
        : undefined,
    heldOnFrom: typeof search.heldOnFrom === "string" ? search.heldOnFrom : undefined,
    heldOnTo: typeof search.heldOnTo === "string" ? search.heldOnTo : undefined,
  }),
  component: RouteComponent,
});

export function RouteComponent() {
  const searchParams = Route.useSearch();
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
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    hasSearched,
    handleReset,
  } = useSearch(searchParams);

  const canSearch = municipalityCodes.length > 0;

  // Date validation: prevent from > to
  const dateError =
    heldOnFrom && heldOnTo && heldOnFrom > heldOnTo
      ? "開始日は終了日より前の日付を指定してください"
      : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4">
          <h1 className="text-xl font-bold mb-1">議会答弁調査</h1>
          <p className="text-sm text-muted-foreground">過去の答弁を素早く検索できます</p>
        </div>

        <div className="mb-3 flex flex-col gap-3 rounded border border-border bg-card px-4 py-3">
          <MunicipalitySelector selectedCodes={municipalityCodes} onChange={setMunicipalityCodes} />

          {!canSearch && (
            <p className="text-sm text-muted-foreground text-center py-4" role="status">
              上のセレクターから自治体を選択すると、検索が可能になります
            </p>
          )}

          {canSearch && (
            <>
              <SearchFilters
                kind={kind}
                setKind={(v) => setKind(v as "question" | "answer" | "")}
                heldOnFrom={heldOnFrom}
                setHeldOnFrom={setHeldOnFrom}
                heldOnTo={heldOnTo}
                setHeldOnTo={setHeldOnTo}
                onReset={handleReset}
                dateError={dateError}
              />

              <div role="search" aria-label="議会答弁検索">
                <label htmlFor="search-query" className="sr-only">
                  検索ワード
                </label>
                <Input
                  id="search-query"
                  type="search"
                  placeholder="検索ワードを入力してください"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full"
                  aria-describedby={dateError ? "date-error" : undefined}
                />
              </div>
            </>
          )}
        </div>

        {canSearch && (
          <div
            className="space-y-4"
            aria-live="polite"
            aria-atomic="false"
          >
            {isLoading && (
              <div aria-label="検索結果を読み込み中" role="status">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="mb-4">
                    <SkeletonCard />
                  </div>
                ))}
              </div>
            )}

            {!hasSearched && !isLoading && (
              <div className="rounded border border-border bg-card p-8 text-center" role="status">
                <p className="text-sm text-muted-foreground">検索ワード未入力</p>
              </div>
            )}

            {hasSearched && !isLoading && statements.length === 0 && (
              <div className="rounded border border-border bg-card p-8 text-center" role="status">
                <p className="text-sm text-muted-foreground">発言が見つかりませんでした</p>
              </div>
            )}

            {statements.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                  {statements.length}件の結果{hasNextPage && "（さらに表示可能）"}
                </p>
                <div className="grid gap-4">
                  {statements.map((statement) => (
                    <StatementCard
                      key={statement.id}
                      statement={statement}
                      showSimilarity={false}
                      query={query}
                    />
                  ))}
                </div>

                {hasNextPage && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? "読み込み中..." : "もっと見る"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
