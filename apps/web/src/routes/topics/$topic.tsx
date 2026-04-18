import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent } from "@/shared/_components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/_components/ui/collapsible";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";
import { Skeleton } from "@/shared/_components/ui/skeleton";

export interface TopicDetailSearchParams {
  municipalityCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const Route = createFileRoute("/topics/$topic")({
  validateSearch: (search: Record<string, unknown>): TopicDetailSearchParams => ({
    municipalityCode:
      typeof search.municipalityCode === "string" ? search.municipalityCode : undefined,
    dateFrom: typeof search.dateFrom === "string" ? search.dateFrom : undefined,
    dateTo: typeof search.dateTo === "string" ? search.dateTo : undefined,
  }),
  component: TopicDetailPage,
});

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function TopicDetailPage() {
  const { topic: rawTopic } = Route.useParams();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const topic = safeDecode(rawTopic);

  const { data, isLoading, isFetching, error } = useQuery({
    ...orpc.topics.timeline.queryOptions({
      input: {
        topic,
        municipalityCode: searchParams.municipalityCode,
        dateFrom: searchParams.dateFrom,
        dateTo: searchParams.dateTo,
        limit: 100,
      },
    }),
    enabled: topic.length > 0,
  });

  const entries = data?.entries ?? [];

  const [filterMunicipality, setFilterMunicipality] = useState(searchParams.municipalityCode ?? "");
  const [filterFrom, setFilterFrom] = useState(searchParams.dateFrom ?? "");
  const [filterTo, setFilterTo] = useState(searchParams.dateTo ?? "");

  useEffect(() => {
    setFilterMunicipality(searchParams.municipalityCode ?? "");
    setFilterFrom(searchParams.dateFrom ?? "");
    setFilterTo(searchParams.dateTo ?? "");
  }, [searchParams.municipalityCode, searchParams.dateFrom, searchParams.dateTo]);

  const hasActiveFilters = Boolean(
    searchParams.municipalityCode || searchParams.dateFrom || searchParams.dateTo,
  );

  const onApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const next: TopicDetailSearchParams = {};
    if (filterMunicipality.trim()) next.municipalityCode = filterMunicipality.trim();
    if (filterFrom) next.dateFrom = filterFrom;
    if (filterTo) next.dateTo = filterTo;
    navigate({
      to: "/topics/$topic",
      params: { topic: rawTopic },
      search: next,
    });
  };

  const onClearFilters = () => {
    setFilterMunicipality("");
    setFilterFrom("");
    setFilterTo("");
    navigate({
      to: "/topics/$topic",
      params: { topic: rawTopic },
      search: {},
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div>
          <Link
            to="/topics"
            search={{
              q: topic,
              municipalityCode: searchParams.municipalityCode,
              dateFrom: searchParams.dateFrom,
              dateTo: searchParams.dateTo,
            }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="h-4 w-4" />
            議題検索に戻る
          </Link>
          <h1 className="text-2xl font-bold leading-snug">{topic}</h1>
          <div className="mt-2">
            <Link to="/topics/compare" search={{ topics: topic }} className="text-xs underline text-muted-foreground hover:text-foreground">この議題を他の議題と比較 →</Link>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {searchParams.municipalityCode && (
              <Badge variant="secondary">自治体: {searchParams.municipalityCode}</Badge>
            )}
            {searchParams.dateFrom && <Badge variant="secondary">from: {searchParams.dateFrom}</Badge>}
            {searchParams.dateTo && <Badge variant="secondary">to: {searchParams.dateTo}</Badge>}
            {!hasActiveFilters && <span>フィルタなし（全期間・全自治体）</span>}
          </div>
        </div>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              フィルタ変更
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="p-4">
                <form onSubmit={onApplyFilters} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="filter-municipality">自治体コード</Label>
                      <Input
                        id="filter-municipality"
                        value={filterMunicipality}
                        onChange={(e) => setFilterMunicipality(e.target.value)}
                        placeholder="例: 462012"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="filter-from">期間（開始）</Label>
                      <Input
                        id="filter-from"
                        type="date"
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="filter-to">期間（終了）</Label>
                      <Input
                        id="filter-to"
                        type="date"
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">
                      適用
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                      クリア
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            エラー: {error.message}
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div className="rounded border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              該当する会議が見つかりませんでした
            </p>
          </div>
        )}

        {!isLoading && entries.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {isFetching ? "更新中..." : `${entries.length} 件の会議`}
            </p>
            <ol className="relative space-y-4 border-l border-border pl-5">
              {entries.map((entry) => (
                <li key={entry.meetingId} className="relative">
                  <span className="absolute -left-[26px] top-2 h-2.5 w-2.5 rounded-full bg-foreground/70" />
                  <Card>
                    <CardContent className="space-y-2 p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{entry.heldOn}</span>
                        <span>・</span>
                        <span>
                          {entry.municipalityName}（{entry.prefecture}）
                        </span>
                        <span>・</span>
                        <span>{entry.meetingType}</span>
                      </div>
                      <div className="text-base font-semibold leading-snug">
                        <Link
                          to="/meetings/$meetingId"
                          params={{ meetingId: entry.meetingId }}
                          className="hover:underline"
                        >
                          {entry.title}
                        </Link>
                      </div>
                      {entry.sourceUrl && (
                        <div>
                          <a
                            href={entry.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 underline break-all"
                          >
                            原本を開く
                          </a>
                        </div>
                      )}
                      {entry.matchedTopics.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {entry.matchedTopics.map((mt, idx) => (
                            <div
                              key={`${entry.meetingId}-${idx}`}
                              className="rounded border border-border bg-muted/30 p-3"
                            >
                              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-medium">{mt.topic}</span>
                                <Badge
                                  variant={mt.relevance === "primary" ? "default" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {mt.relevance === "primary" ? "主要議題" : "関連議題"}
                                </Badge>
                                {mt.speakers.length > 0 && (
                                  <span className="text-muted-foreground">
                                    発言者: {mt.speakers.join(", ")}
                                  </span>
                                )}
                              </div>
                              <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                                {mt.digest}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
          この議題の発言を全文検索する →{" "}
          <Link to="/search" search={{ q: topic }} className="underline hover:text-foreground">
            /search?q={topic}
          </Link>
        </div>
      </div>
    </div>
  );
}
