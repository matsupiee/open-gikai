import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { client } from "@/lib/orpc/orpc";
import { MunicipalitySelector } from "@/shared/_components/municipality-selector";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/_components/ui/collapsible";
import { Label } from "@/shared/_components/ui/label";
import { Textarea } from "@/shared/_components/ui/textarea";

export const Route = createFileRoute("/ask")({
  component: AskPage,
});

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

function AskPage() {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
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
          municipalityCode: selectedCodes[0],
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
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">議会 AI に質問する</h1>
        <p className="text-sm text-muted-foreground">
          自治体を絞り込んで、議会議事録をもとに質問できます。未ログインの場合、同一 IP から 24
          時間あたり 5 回までご利用いただけます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>質問する</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <MunicipalitySelector selectedCodes={selectedCodes} onChange={setSelectedCodes} />
              <p className="text-xs text-muted-foreground">
                複数選択しても先頭 1 件のみ検索条件に使われます。空のままでも質問できます。
              </p>
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
              {isStreaming ? `問い合わせ中... (iter ${currentIteration ?? "-"})` : "聞く"}
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
                      result: {entry.resultSummary ?? <span className="italic">実行中...</span>}
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
                  <pre className="whitespace-pre-wrap text-sm font-sans">{finalResult.answer}</pre>
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
                        <div className="text-muted-foreground">result: {t.resultSummary}</div>
                      </CardContent>
                    </Card>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
