import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { ArrowDown, ArrowUpDown, ExternalLink } from "lucide-react";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";
import { Input } from "@/shared/_components/ui/input";

export const Route = createFileRoute("/municipalities/")({
  component: RouteComponent,
});

type SortBy = "code" | "population";

const LIMIT = 50;

function RouteComponent() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("code");

  const offset = page * LIMIT;

  const input = {
    ...(appliedQuery ? { query: appliedQuery } : {}),
    limit: LIMIT,
    offset,
    sortBy,
  };

  const { data, isLoading } = useQuery(orpc.municipalities.list.queryOptions({ input }));

  function handleSearch() {
    setAppliedQuery(query);
    setPage(0);
  }

  function handleReset() {
    setQuery("");
    setAppliedQuery("");
    setPage(0);
  }

  function handleSortByPopulation() {
    setSortBy(sortBy === "population" ? "code" : "population");
    setPage(0);
  }

  const total = data?.total ?? 0;
  const count = data?.municipalities.length ?? 0;
  const start = offset + 1;
  const end = offset + count;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-6">自治体一覧</h1>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="例: 鹿児島市、鹿児島県、kensakusystem.jp"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} size="sm">
                絞り込む
              </Button>
              {appliedQuery && (
                <Button onClick={handleReset} variant="outline" size="sm">
                  リセット
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={sortBy === "population" ? "default" : "outline"}
                size="sm"
                onClick={handleSortByPopulation}
                className="gap-1.5"
              >
                {sortBy === "population" ? (
                  <ArrowDown className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpDown className="h-3.5 w-3.5" />
                )}
                人口順
              </Button>
              {sortBy === "population" && (
                <span className="text-xs text-muted-foreground">人口の多い順で表示中</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading && (
            <>
              {[...Array(10)].map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              ))}
            </>
          )}

          {!isLoading && data?.municipalities.length === 0 && (
            <div className="rounded border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">自治体が見つかりませんでした</p>
            </div>
          )}

          {!isLoading && data && data.municipalities.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                {start}〜{end} 件表示（全 {total.toLocaleString()} 件）
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.municipalities.map((municipality) => (
                  <MunicipalityCard key={municipality.id} municipality={municipality} />
                ))}
              </div>

              <div className="flex gap-2 justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  前のページ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={end >= total}
                >
                  次のページ
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface MunicipalityCardProps {
  municipality: {
    id: string;
    code: string;
    name: string;
    prefecture: string;
    baseUrl: string | null;
    population: number | null;
    meetingCount: number;
    systemTypeDescription: string | null;
  };
}

function MunicipalityCard({ municipality }: MunicipalityCardProps) {
  return (
    <Link
      to="/meetings"
      search={{ municipality: municipality.name } as never}
      className="block"
    >
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{municipality.name}</CardTitle>
            {municipality.baseUrl && (
              <a
                href={municipality.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="会議録サイトを開く"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{municipality.prefecture}</span>
            {municipality.population != null && (
              <>
                <span>•</span>
                <span>人口 {municipality.population.toLocaleString()} 人</span>
              </>
            )}
            {municipality.meetingCount > 0 && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="text-xs">
                  {municipality.meetingCount} 件の会議
                </Badge>
              </>
            )}
          </div>
          {municipality.systemTypeDescription && (
            <p className="mt-1.5 text-xs text-muted-foreground/70">
              {municipality.systemTypeDescription}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
