import { useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/shared/_components/ui/button";
import { Input } from "@/shared/_components/ui/input";

import { CitationPanel } from "./_components/citation-panel";
import { DraftAnswerWorkspace } from "./_components/draft-answer-workspace";
import { PolicyCategoryBrowser } from "./_components/policy-category-browser";
import { SearchFilters } from "./_components/search-filters";
import { SkeletonCard } from "./_components/skeleton-card";
import { StatementCard } from "./_components/statement-card";
import { useSearch } from "./_hooks/useSearch";

export const Route = createFileRoute("/search/")({
  component: RouteComponent,
});

function RouteComponent() {
  const {
    pageMode,
    setPageMode,
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
    handleSearch,
    handleCategorySearch,
    handleReset,
    citations,
    addCitation,
    removeCitation,
    clearCitations,
  } = useSearch();

  const [showDraftWorkspace, setShowDraftWorkspace] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const citedIds = new Set(citations.map((c) => c.id));

  const questionPlaceholder = "例: 「待機児童対策の現状と今後の方針は？」と入力してください";

  const handlePageModeChange = (mode: typeof pageMode) => {
    setPageMode(mode);
    handleReset();
    setShowDraftWorkspace(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold mb-1">議会答弁調査</h1>
          <p className="text-sm text-muted-foreground">
            過去の答弁を素早く検索し、根拠付きで回答案を作成できます
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={pageMode === "question" ? "default" : "outline"}
            onClick={() => handlePageModeChange("question")}
            size="sm"
          >
            質問から探す
          </Button>
          <Button
            variant={pageMode === "policy" ? "default" : "outline"}
            onClick={() => handlePageModeChange("policy")}
            size="sm"
          >
            政策から探す
          </Button>
        </div>

        {/* Policy Browse Mode */}
        {pageMode === "policy" && !hasSearched && (
          <PolicyCategoryBrowser onSelectCategory={handleCategorySearch} />
        )}

        {/* Question Mode or Policy Mode after search */}
        {(pageMode === "question" || hasSearched) && (
          <div className="flex flex-col gap-4">
            {/* STEP 1: Search Input */}
            <div className="flex flex-col gap-3 rounded border border-border bg-card p-4">
              {pageMode === "question" && (
                <p className="text-xs font-medium text-muted-foreground">
                  STEP 1: 届いた質問文を入力してください
                </p>
              )}

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder={questionPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  className="flex-1"
                />
                <Button onClick={handleSearch} variant="default">
                  過去答弁を検索
                </Button>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-xs text-muted-foreground hover:text-foreground text-left"
              >
                {showFilters ? "▲ フィルターを閉じる" : "▼ フィルターで絞り込む"}
              </button>

              {showFilters && (
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
              )}
            </div>

            {/* STEP 2 label */}
            {hasSearched && pageMode === "question" && !showDraftWorkspace && (
              <p className="text-xs font-medium text-muted-foreground">
                STEP 2: 関連する過去答弁（「引用する」で根拠を収集）
              </p>
            )}

            {/* Draft Workspace (STEP 3) */}
            {showDraftWorkspace && citations.length > 0 && (
              <div className="rounded border border-primary/30 bg-primary/5 p-4">
                <DraftAnswerWorkspace
                  citations={citations}
                  onClose={() => setShowDraftWorkspace(false)}
                />
              </div>
            )}

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

                {!hasSearched && !isLoading && pageMode === "question" && (
                  <div className="rounded border border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      届いた質問文を入力して検索してください
                    </p>
                  </div>
                )}

                {hasSearched && !isLoading && statements.length === 0 && (
                  <div className="rounded border border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      発言が見つかりませんでした
                    </p>
                  </div>
                )}

                {statements.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground">
                      {statements.length}件の結果
                    </div>
                    <div className="grid gap-4">
                      {statements.map((statement) => (
                        <StatementCard
                          key={statement.id}
                          statement={statement}
                          showSimilarity={!isKeywordSearch}
                          onCite={addCitation}
                          isCited={citedIds.has(statement.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Citation Panel Sidebar */}
              {pageMode === "question" && (
                <div className="w-full lg:w-72 shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    引用リスト
                  </p>
                  <CitationPanel
                    citations={citations}
                    onRemove={removeCitation}
                    onClear={clearCitations}
                    onCreateDraft={() => setShowDraftWorkspace(true)}
                  />
                </div>
              )}
            </div>

            {/* Back to category browse */}
            {pageMode === "policy" && hasSearched && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReset()}
                className="w-fit"
              >
                ← 政策カテゴリに戻る
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
