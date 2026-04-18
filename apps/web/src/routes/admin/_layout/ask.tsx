import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { client, orpc } from "@/lib/orpc/orpc";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/_components/ui/collapsible";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";
import { Textarea } from "@/shared/_components/ui/textarea";
import { MunicipalitySelector } from "@/shared/_components/municipality-selector";

export const Route = createFileRoute("/admin/_layout/ask")({
  component: AdminAskPage,
});

function AdminAskPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Ask 動作確認</h1>
      <TopicsSearchSection />
      <MeetingsAskSection />
      <TopicsTimelineSection />
      <TopicsCompareSection />
    </div>
  );
}

function TopicsSearchSection() {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [committedCode, setCommittedCode] = useState<string | undefined>(undefined);

  const enabled = committedQuery.length > 0;

  const { data, isFetching, error } = useQuery({
    ...orpc.topics.search.queryOptions({
      input: {
        query: committedQuery,
        municipalityCode: committedCode,
        limit: 30,
      },
    }),
    enabled,
  });

  const rows = data?.rows ?? [];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setCommittedQuery(query.trim());
    setCommittedCode(selectedCodes[0]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>議題キーワード検索</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MunicipalitySelector selectedCodes={selectedCodes} onChange={setSelectedCodes} />
        <p className="text-xs text-muted-foreground">
          複数選択しても先頭 1 件のみ検索条件に使われます（API 側が単一自治体指定のみ対応）。
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <Label htmlFor="topics-query">キーワード</Label>
          <div className="flex gap-2">
            <Input
              id="topics-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例: 市バス路線再編"
            />
            <Button type="submit" disabled={!query.trim()}>
              検索
            </Button>
          </div>
        </form>

        {error && (
          <p className="text-sm text-destructive">エラー: {error.message}</p>
        )}

        {enabled && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {isFetching ? "検索中..." : `${rows.length} 件ヒット`}
            </div>
            {rows.map((r) => (
              <Card key={`${r.meetingId}-${r.matchedTopic}`} className="border">
                <CardContent className="py-3 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.title}</span>
                    <span className="text-xs text-muted-foreground">({r.heldOn})</span>
                    <span className="text-xs text-muted-foreground">[{r.meetingType}]</span>
                  </div>
                  <div>
                    <span className="font-medium">議題:</span> {r.matchedTopic}{" "}
                    <span className="text-xs text-muted-foreground">({r.relevance})</span>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {r.digestPreview}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    meetingId: {r.meetingId}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AskProgressEntry {
  iteration: number;
  tool: string;
  args: unknown;
  resultSummary: string | null;
}

interface AskFinalResult {
  answer: string;
  iterations: number;
  inputTokens: number;
  outputTokens: number;
  trace: { tool: string; args: unknown; resultSummary: string }[];
}

function MeetingsAskSection() {
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<AskProgressEntry[]>([]);
  const [currentIteration, setCurrentIteration] = useState<number | null>(null);
  const [finalResult, setFinalResult] = useState<AskFinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isStreaming) return;

    // 以前のリクエストをキャンセル
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setProgress([]);
    setCurrentIteration(null);
    setFinalResult(null);
    setError(null);

    try {
      const stream = await client.meetings.askStream(
        {
          question: question.trim(),
          municipalityCode: municipalityCode.trim() || undefined,
        },
        { signal: controller.signal },
      );

      for await (const event of stream) {
        if (event.type === "iteration_start") {
          setCurrentIteration(event.iteration);
        } else if (event.type === "tool_call") {
          setProgress((prev) => [
            ...prev,
            {
              iteration: event.iteration,
              tool: event.tool,
              args: event.args,
              resultSummary: null,
            },
          ]);
        } else if (event.type === "tool_result") {
          setProgress((prev) => {
            // 同じ iteration + tool の最後の未確定エントリを更新する
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
              const entry = next[i]!;
              if (
                entry.iteration === event.iteration &&
                entry.tool === event.tool &&
                entry.resultSummary === null
              ) {
                next[i] = { ...entry, resultSummary: event.resultSummary };
                break;
              }
            }
            return next;
          });
        } else if (event.type === "done") {
          setFinalResult(event.result);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>エージェントに質問</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ask-municipality">自治体コード（任意・単一）</Label>
            <Input
              id="ask-municipality"
              value={municipalityCode}
              onChange={(e) => setMunicipalityCode(e.target.value)}
              placeholder="例: 462012"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ask-question">質問</Label>
            <Textarea
              id="ask-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例: 市バス路線再編について時系列で整理して"
              rows={5}
            />
          </div>
          <Button type="submit" disabled={!question.trim() || isStreaming}>
            {isStreaming
              ? `問い合わせ中... (iter ${currentIteration ?? "-"})`
              : "聞く"}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">エラー: {error}</p>}

        {(isStreaming || progress.length > 0) && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              進捗 ({progress.length} 件のツール呼び出し)
            </div>
            {progress.map((entry, idx) => (
              <Card key={idx} className="border">
                <CardContent className="py-2 space-y-1 text-xs">
                  <div className="font-semibold">
                    iter #{entry.iteration} · {entry.tool}
                  </div>
                  <div className="font-mono text-muted-foreground break-all">
                    args: {JSON.stringify(entry.args)}
                  </div>
                  <div className="text-muted-foreground">
                    result:{" "}
                    {entry.resultSummary ?? (
                      <span className="italic">実行中...</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {finalResult && (
          <div className="space-y-3">
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>iterations: {finalResult.iterations}</span>
              <span>input tokens: {finalResult.inputTokens}</span>
              <span>output tokens: {finalResult.outputTokens}</span>
            </div>
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">回答</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {finalResult.answer}
                </pre>
              </CardContent>
            </Card>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  trace を表示 ({finalResult.trace.length} 件)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {finalResult.trace.map((t, idx) => (
                  <Card key={idx} className="border">
                    <CardContent className="py-2 space-y-1 text-xs">
                      <div className="font-semibold">
                        #{idx + 1} {t.tool}
                      </div>
                      <div className="font-mono text-muted-foreground break-all">
                        args: {JSON.stringify(t.args)}
                      </div>
                      <div className="text-muted-foreground">
                        result: {t.resultSummary}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopicsTimelineSection() {
  const [topic, setTopic] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [committedTopic, setCommittedTopic] = useState("");
  const [committedCode, setCommittedCode] = useState<string | undefined>(undefined);
  const [committedFrom, setCommittedFrom] = useState<string | undefined>(undefined);
  const [committedTo, setCommittedTo] = useState<string | undefined>(undefined);

  const enabled = committedTopic.length > 0;

  const { data, isFetching, error } = useQuery({
    ...orpc.topics.timeline.queryOptions({
      input: {
        topic: committedTopic,
        municipalityCode: committedCode,
        dateFrom: committedFrom,
        dateTo: committedTo,
        limit: 100,
      },
    }),
    enabled,
  });

  const entries = data?.entries ?? [];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setCommittedTopic(topic.trim());
    setCommittedCode(municipalityCode.trim() || undefined);
    setCommittedFrom(dateFrom.trim() || undefined);
    setCommittedTo(dateTo.trim() || undefined);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>議題タイムライン</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="timeline-topic">議題キーワード</Label>
            <Input
              id="timeline-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例: 市バス路線再編"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeline-municipality">自治体コード（任意）</Label>
              <Input
                id="timeline-municipality"
                value={municipalityCode}
                onChange={(e) => setMunicipalityCode(e.target.value)}
                placeholder="例: 462012"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeline-from">dateFrom（任意）</Label>
              <Input
                id="timeline-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeline-to">dateTo（任意）</Label>
              <Input
                id="timeline-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={!topic.trim()}>
            タイムライン取得
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">エラー: {error.message}</p>}

        {enabled && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {isFetching ? "取得中..." : `${entries.length} 件`}
            </div>
            {entries.map((entry) => (
              <Card key={entry.meetingId} className="border">
                <CardContent className="py-3 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{entry.heldOn}</span>
                    <span>
                      {entry.municipalityName} ({entry.prefecture})
                    </span>
                    <span className="text-xs text-muted-foreground">[{entry.meetingType}]</span>
                  </div>
                  <div className="font-medium">{entry.title}</div>
                  {entry.sourceUrl && (
                    <div>
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 underline break-all"
                      >
                        {entry.sourceUrl}
                      </a>
                    </div>
                  )}
                  {entry.matchedTopics.length > 0 && (
                    <div className="space-y-1">
                      {entry.matchedTopics.map((mt, idx) => (
                        <div key={`${entry.meetingId}-${idx}`} className="rounded border p-2">
                          <div className="text-xs">
                            <span className="font-medium">{mt.topic}</span>{" "}
                            <span className="text-muted-foreground">({mt.relevance})</span>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {mt.digest.slice(0, 200)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs font-mono text-muted-foreground">
                    meetingId: {entry.meetingId}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopicsCompareSection() {
  const [topics, setTopics] = useState<string[]>(["", "", ""]);
  const [municipalityCode, setMunicipalityCode] = useState("");

  const [committedTopics, setCommittedTopics] = useState<string[]>([]);
  const [committedCode, setCommittedCode] = useState<string | undefined>(undefined);

  const enabled = committedTopics.length >= 2;

  const { data, isFetching, error } = useQuery({
    ...orpc.topics.compare.queryOptions({
      input: {
        // API 側 schema で min(2).max(5)。enabled=false の時は送られない。
        topics: committedTopics as [string, string, ...string[]],
        municipalityCode: committedCode,
        limit: 50,
      },
    }),
    enabled,
  });

  const rows = data?.rows ?? [];

  const addTopic = () => {
    if (topics.length >= 5) return;
    setTopics([...topics, ""]);
  };
  const removeTopic = (idx: number) => {
    if (topics.length <= 2) return;
    setTopics(topics.filter((_, i) => i !== idx));
  };
  const updateTopic = (idx: number, value: string) => {
    setTopics(topics.map((t, i) => (i === idx ? value : t)));
  };

  const trimmedNonEmpty = topics.map((t) => t.trim()).filter((t) => t.length > 0);
  const submitEnabled = trimmedNonEmpty.length >= 2 && trimmedNonEmpty.length <= 5;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitEnabled) return;
    setCommittedTopics(trimmedNonEmpty);
    setCommittedCode(municipalityCode.trim() || undefined);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>議題の関連分析（compare）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label>キーワード（2〜5 個）</Label>
            {topics.map((t, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={t}
                  onChange={(e) => updateTopic(idx, e.target.value)}
                  placeholder={`キーワード ${idx + 1}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeTopic(idx)}
                  disabled={topics.length <= 2}
                >
                  削除
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTopic}
              disabled={topics.length >= 5}
            >
              キーワードを追加
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="compare-municipality">自治体コード（任意）</Label>
            <Input
              id="compare-municipality"
              value={municipalityCode}
              onChange={(e) => setMunicipalityCode(e.target.value)}
              placeholder="例: 462012"
            />
          </div>
          <Button type="submit" disabled={!submitEnabled}>
            関連会議を検索
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">エラー: {error.message}</p>}

        {enabled && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {isFetching ? "検索中..." : `${rows.length} 件ヒット`}
            </div>
            {rows.map((row) => (
              <Card key={row.meetingId} className="border">
                <CardContent className="py-3 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{row.title}</span>
                    <span className="text-xs text-muted-foreground">({row.heldOn})</span>
                    <span className="text-xs text-muted-foreground">[{row.meetingType}]</span>
                  </div>
                  <div className="text-xs">
                    {row.municipalityName} ({row.prefecture}) / code: {row.municipalityCode}
                  </div>
                  <div className="space-y-1">
                    {committedTopics.map((q) => {
                      const matched = row.matchedTopicsByQuery[q] ?? [];
                      return (
                        <div key={`${row.meetingId}-${q}`} className="text-xs">
                          <span className="font-medium">{q}</span>
                          <span className="text-muted-foreground"> → </span>
                          {matched.length === 0 ? (
                            <span className="text-muted-foreground">(なし)</span>
                          ) : (
                            <span>{matched.join(", ")}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    meetingId: {row.meetingId}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
