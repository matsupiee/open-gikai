import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc/orpc";
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

function MeetingsAskSection() {
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [question, setQuestion] = useState("");

  const mutation = useMutation(orpc.meetings.ask.mutationOptions());

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    mutation.mutate({
      question: question.trim(),
      municipalityCode: municipalityCode.trim() || undefined,
    });
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
          <Button type="submit" disabled={!question.trim() || mutation.isPending}>
            {mutation.isPending ? "問い合わせ中..." : "聞く"}
          </Button>
        </form>

        {mutation.error && (
          <p className="text-sm text-destructive">エラー: {mutation.error.message}</p>
        )}

        {mutation.data && (
          <div className="space-y-3">
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>iterations: {mutation.data.iterations}</span>
              <span>input tokens: {mutation.data.inputTokens}</span>
              <span>output tokens: {mutation.data.outputTokens}</span>
            </div>
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">回答</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {mutation.data.answer}
                </pre>
              </CardContent>
            </Card>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  trace を表示 ({mutation.data.trace.length} 件)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {mutation.data.trace.map((t, idx) => (
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
