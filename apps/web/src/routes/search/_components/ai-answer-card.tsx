import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";

import type { Statement } from "../_hooks/useSearch";
import { StatementCard } from "./statement-card";

interface AiAnswerCardProps {
  answer: string;
  sources: Statement[];
}

export function AiAnswerCard({ answer, sources }: AiAnswerCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">AI</span>
            AIによる回答
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
        </CardContent>
      </Card>

      {sources.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground font-medium">
            参考にした発言（{sources.length}件）
          </p>
          {sources.map((source, i) => (
            <div key={source.id} className="flex gap-2">
              <span className="mt-3 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-medium">
                発言{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <StatementCard statement={source} showSimilarity={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
