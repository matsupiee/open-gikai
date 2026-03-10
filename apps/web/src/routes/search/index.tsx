import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/shared/_components/ui/button";
import { Input } from "@/shared/_components/ui/input";

import { AiAnswerCard } from "./_components/ai-answer-card";
import { SearchFilters } from "./_components/search-filters";
import { SkeletonCard } from "./_components/skeleton-card";
import { StatementCard } from "./_components/statement-card";
import { useSearch } from "./_hooks/useSearch";

export const Route = createFileRoute("/search/")({
  component: RouteComponent,
});

function RouteComponent() {
  const {
    searchMode,
    setSearchMode,
    query,
    setQuery,
    kind,
    setKind,
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
    isKeywordSearch,
    aiAnswer,
    aiSources,
    handleSearch,
    handleReset,
  } = useSearch();

  const placeholder =
    searchMode === "ai"
      ? "例: ○○市の子育て支援について議員はどんな発言をしていますか？"
      : "質問・答弁を検索...";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="flex-1"
              />
              <Button onClick={handleSearch} variant="default">
                {searchMode === "ai" ? "質問する" : "検索"}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant={searchMode === "keyword" ? "default" : "outline"}
                onClick={() => setSearchMode("keyword")}
                size="sm"
              >
                キーワード検索
              </Button>
              <Button
                variant={searchMode === "semantic" ? "default" : "outline"}
                onClick={() => setSearchMode("semantic")}
                size="sm"
              >
                類似検索
              </Button>
              <Button
                variant={searchMode === "ai" ? "default" : "outline"}
                onClick={() => setSearchMode("ai")}
                size="sm"
              >
                AIに質問
              </Button>
            </div>
          </div>

          <SearchFilters
            kind={kind}
            setKind={setKind}
            heldOnFrom={heldOnFrom}
            setHeldOnFrom={setHeldOnFrom}
            heldOnTo={heldOnTo}
            setHeldOnTo={setHeldOnTo}
            prefecture={prefecture}
            setPrefecture={setPrefecture}
            municipality={municipality}
            setMunicipality={setMunicipality}
            assemblyLevel={assemblyLevel}
            setAssemblyLevel={setAssemblyLevel}
            onReset={handleReset}
          />
        </div>

        <div className="space-y-4">
          {isLoading && (
            <>
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </>
          )}

          {!hasSearched && !isLoading && (
            <div className="rounded border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {searchMode === "ai"
                  ? "議会に関する質問を入力してください"
                  : "キーワードを入力して検索してください"}
              </p>
            </div>
          )}

          {searchMode === "ai" && hasSearched && !isLoading && (
            <>
              {aiAnswer ? (
                <AiAnswerCard answer={aiAnswer} sources={aiSources} />
              ) : (
                <div className="rounded border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    関連する発言が見つかりませんでした
                  </p>
                </div>
              )}
            </>
          )}

          {searchMode !== "ai" && (
            <>
              {hasSearched && !isLoading && statements.length === 0 && (
                <div className="rounded border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    発言が見つかりませんでした
                  </p>
                </div>
              )}

              {statements.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground mb-4">
                    {statements.length}件の結果
                  </div>
                  <div className="grid gap-4">
                    {statements.map((statement) => (
                      <StatementCard
                        key={statement.id}
                        statement={statement}
                        showSimilarity={!isKeywordSearch}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
