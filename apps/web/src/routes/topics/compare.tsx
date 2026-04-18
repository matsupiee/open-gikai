import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent } from "@/shared/_components/ui/card";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";
import { Skeleton } from "@/shared/_components/ui/skeleton";

export interface TopicsCompareSearchParams {
  topics?: string;
  municipalityCode?: string;
}

export const Route = createFileRoute("/topics/compare")({
  validateSearch: (search: Record<string, unknown>): TopicsCompareSearchParams => ({
    topics: typeof search.topics === "string" ? search.topics : undefined,
    municipalityCode:
      typeof search.municipalityCode === "string" ? search.municipalityCode : undefined,
  }),
  component: TopicsComparePage,
});

function parseTopicsParam(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const segment of raw.split(",")) {
    const t = segment.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function TopicsComparePage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const committedTopics = useMemo(() => parseTopicsParam(searchParams.topics), [searchParams.topics]);
  const committedMunicipality = searchParams.municipalityCode;

  // Input state: show at least 2 slots, sync from URL on change.
  const initialInputs = committedTopics.length >= 2 ? committedTopics : ["", ""];
  const [inputs, setInputs] = useState<string[]>(initialInputs);
  const [municipalityCode, setMunicipalityCode] = useState(committedMunicipality ?? "");

  useEffect(() => {
    setInputs(committedTopics.length >= 2 ? committedTopics : ["", ""]);
    setMunicipalityCode(committedMunicipality ?? "");
  }, [searchParams.topics, searchParams.municipalityCode]);

  const enabled = committedTopics.length >= 2;

  const { data, isFetching, error } = useQuery({
    ...orpc.topics.compare.queryOptions({
      input: {
        topics: committedTopics as [string, string, ...string[]],
        municipalityCode: committedMunicipality,
        limit: 50,
      },
    }),
    enabled,
  });

  const rows = data?.rows ?? [];

  const addInput = () => {
    if (inputs.length >= 5) return;
    setInputs([...inputs, ""]);
  };
  const removeInput = (idx: number) => {
    if (inputs.length <= 2) return;
    setInputs(inputs.filter((_, i) => i !== idx));
  };
  const updateInput = (idx: number, value: string) => {
    setInputs(inputs.map((t, i) => (i === idx ? value : t)));
  };

  const normalized = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of inputs) {
      const v = t.trim();
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  })();
  const submitEnabled = normalized.length >= 2 && normalized.length <= 5;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitEnabled) return;
    const next: TopicsCompareSearchParams = { topics: normalized.join(",") };
    if (municipalityCode.trim()) next.municipalityCode = municipalityCode.trim();
    navigate({ to: "/topics/compare", search: next });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div>
          <Link
            to="/topics"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="h-4 w-4" />
            議題検索に戻る
          </Link>
          <h1 className="text-2xl font-bold leading-snug">議題の関連分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            2〜5 個のキーワードすべてに言及している会議を探します。
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>キーワード（2〜5 個）</Label>
                <div className="space-y-2">
                  {inputs.map((t, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={t}
                        onChange={(e) => updateInput(idx, e.target.value)}
                        placeholder={`キーワード ${idx + 1}`}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeInput(idx)}
                        disabled={inputs.length <= 2}
                      >
                        削除
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInput}
                  disabled={inputs.length >= 5}
                >
                  キーワードを追加
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="compare-municipality">自治体コード（任意）</Label>
                <Input
                  id="compare-municipality"
                  value={municipalityCode}
                  onChange={(e) => setMunicipalityCode(e.target.value)}
                  placeholder="例: 462012"
                />
              </div>
              <div>
                <Button type="submit" disabled={!submitEnabled}>
                  関連会議を検索
                </Button>
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
            <p className="text-sm text-muted-foreground">
              キーワードを 2 個以上入力して検索してください
            </p>
          </div>
        )}

        {enabled && isFetching && (
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

        {enabled && !isFetching && !error && rows.length === 0 && (
          <div className="rounded border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              すべてのキーワードに言及している会議は見つかりませんでした
            </p>
          </div>
        )}

        {enabled && !isFetching && rows.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">
              全キーワードに言及している会議 {rows.length} 件
            </p>
            <div className="space-y-3">
              {rows.map((row) => (
                <Card key={row.meetingId}>
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{row.heldOn}</span>
                      <span>・</span>
                      <span>{row.meetingType}</span>
                    </div>
                    <div className="text-base font-semibold leading-snug">
                      <Link
                        to="/meetings/$meetingId"
                        params={{ meetingId: row.meetingId }}
                        className="hover:underline"
                      >
                        {row.title}
                      </Link>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.municipalityName}（{row.prefecture}）
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {committedTopics.map((q) => {
                        const matched = row.matchedTopicsByQuery[q] ?? [];
                        return (
                          <div
                            key={`${row.meetingId}-${q}`}
                            className="flex flex-wrap items-center gap-1.5 text-xs"
                          >
                            <span className="font-medium">{q}</span>
                            <span className="text-muted-foreground">→</span>
                            {matched.length === 0 ? (
                              <span className="text-muted-foreground">(なし)</span>
                            ) : (
                              matched.map((topic, i) => (
                                <Badge
                                  key={`${row.meetingId}-${q}-${i}`}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {topic}
                                </Badge>
                              ))
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {enabled && committedTopics.length > 0 && (
          <div className="border-t border-border pt-4 text-xs text-muted-foreground">
            各キーワードのタイムラインを見る:{" "}
            <span className="inline-flex flex-wrap gap-2">
              {committedTopics.map((t) => (
                <Link
                  key={t}
                  to="/topics/$topic"
                  params={{ topic: encodeURIComponent(t) }}
                  className="underline hover:text-foreground"
                >
                  {t}
                </Link>
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
