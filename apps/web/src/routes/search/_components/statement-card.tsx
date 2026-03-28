import { useState } from "react";

import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";

import { getKindColor, getKindLabel } from "../_utils/helpers";

interface StatementCardProps {
  statement: {
    id: string;
    meetingTitle: string;
    kind: string;
    heldOn: string;
    speakerName: string | null;
    prefecture: string;
    municipality: string;
    content: string;
    similarity?: number;
    sourceUrl: string | null;
  };
  showSimilarity: boolean;
}

export function StatementCard({ statement, showSimilarity }: StatementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isTruncated = statement.content.length > 200;
  const displayContent =
    expanded || !isTruncated ? statement.content : statement.content.substring(0, 200) + "...";

  return (
    <Card role="article" aria-label={`${statement.meetingTitle} - ${getKindLabel(statement.kind)}`}>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{statement.meetingTitle}</CardTitle>
            <Badge className={getKindColor(statement.kind)}>
              {getKindLabel(statement.kind)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
            <time dateTime={statement.heldOn}>{statement.heldOn}</time>
            {statement.speakerName && <span>• {statement.speakerName}</span>}
            {statement.prefecture && <span>• {statement.prefecture}</span>}
            {statement.municipality && <span>• {statement.municipality}</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed">{displayContent}</p>
          {isTruncated && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-auto p-0 text-xs justify-start"
              aria-expanded={expanded}
            >
              {expanded ? "非表示" : "続きを見る"}
            </Button>
          )}
          {showSimilarity && statement.similarity !== undefined && (
            <div className="text-xs text-muted-foreground">
              類似度: {Math.round(statement.similarity * 100)}%
            </div>
          )}
          {statement.sourceUrl && (
            <a
              href={statement.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              元の議事録を見る
              <span className="sr-only">（新しいタブで開きます）</span>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
