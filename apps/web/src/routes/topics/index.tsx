import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent } from "@/shared/_components/ui/card";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";
import { Skeleton } from "@/shared/_components/ui/skeleton";

export interface TopicsSearchParams {
  q?: string;
  municipalityCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const Route = createFileRoute("/topics/")({
  validateSearch: (search: Record<string, unknown>): TopicsSearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    municipalityCode:
      typeof search.municipalityCode === "string" ? search.municipalityCode : undefined,
    dateFrom: typeof search.dateFrom === "string" ? search.dateFrom : undefined,
    dateTo: typeof search.dateTo === "string" ? search.dateTo : undefined,
  }),
  component: TopicsSearchPage,
});

function TopicsSearchPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const [query, setQuery] = useState(searchParams.q ?? "");
  const [municipalityCode, setMunicipalityCode] = useState(searchParams.municipalityCode ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(searchParams.dateTo ?? "");

  // Sync local state when URL params change (e.g. browser back/forward, external links)
  useEffect(() => {
    setQuery(searchParams.q ?? "");
    setMunicipalityCode(searchParams.municipalityCode ?? "");
    setDateFrom(searchParams.dateFrom ?? "");
    setDateTo(searchParams.dateTo ?? "");
  }, [searchParams.q, searchParams.municipalityCode, searchParams.dateFrom, searchParams.dateTo]);

  const enabled = Boolean(searchParams.q && searchParams.q.length > 0);

  const { data, isFetching, error } = useQuery({
    ...orpc.topics.search.queryOptions({
      input: {
        query: searchParams.q ?? "",
        municipalityCode: searchParams.municipalityCode,
        dateFrom: searchParams.dateFrom,
        dateTo: searchParams.dateTo,
        limit: 30,
      },
    }),
    enabled,
  });

  const rows = data?.rows ?? [];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const next: TopicsSearchParams = { q: trimmed };
    if (municipalityCode.trim()) next.municipalityCode = municipalityCode.trim();
    if (dateFrom) next.dateFrom = dateFrom;
    if (dateTo) next.dateTo = dateTo;
    navigate({ to: "/topics", search: next });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">議題を検索</h1>
          <p className="text-sm text-muted-foreground">
            キーワードに一致する議題を含む会議を新しい順で表示します。
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="topics-q">キーワード</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="topics-q"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="例: 市バス事業"
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!query.trim()} className="sm:w-28">
                    検索
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="topics-municipality">自治体コード（任意）</Label>
                  <Input
                    id="topics-municipality"
                    value={municipalityCode}
                    onChange={(e) => setMunicipalityCode(e.target.value)}
                    placeholder="例: 462012"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="topics-date-from">期間（開始・任意）</Label>
                  <Input
                    id="topics-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="topics-date-to">期間（終了・任意）</Label>
                  <Input
                    id="topics-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            エラー: {error.message}
          </div>
        )}

        {!enabled && !error && (
          <div className="rounded border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">キーワードを入力して検索してください</p>
          </div>
        )}

        {enabled && isFetching && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {enabled && !isFetching && rows.length === 0 && !error && (
          <div className="rounded border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">該当する議題が見つかりませんでした</p>
          </div>
        )}

        {enabled && !isFetching && rows.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">{rows.length} 件の議題</p>
            <div className="grid gap-3">
              {rows.map((row) => (
                <Link
                  key={`${row.meetingId}-${row.matchedTopic}`}
                  to="/topics/$topic"
                  params={{ topic: encodeURIComponent(row.matchedTopic) }}
                  search={{
                    municipalityCode: searchParams.municipalityCode,
                    dateFrom: searchParams.dateFrom,
                    dateTo: searchParams.dateTo,
                  }}
                  className="block"
                >
                  <Card className="transition hover:border-foreground/30">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{row.heldOn}</span>
                        <span>・</span>
                        <span>{row.meetingType}</span>
                        <Badge
                          variant={row.relevance === "primary" ? "default" : "secondary"}
                          className="ml-auto"
                        >
                          {row.relevance === "primary" ? "主要議題" : "関連議題"}
                        </Badge>
                      </div>
                      <div className="text-base font-semibold leading-snug">
                        {row.matchedTopic}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {row.digestPreview}
                      </p>
                      <div className="text-xs text-muted-foreground">{row.title}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
