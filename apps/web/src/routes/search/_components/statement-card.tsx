import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";

import { buildSnippet, getKindColor, getKindLabel, highlightText } from "../_utils/helpers";

interface StatementCardProps {
  statement: {
    id: string;
    meetingId: string;
    meetingTitle: string;
    kind: string;
    heldOn: string;
    speakerName: string | null;
    prefecture: string;
    municipality: string;
    content: string;
    similarity?: number;
  };
  showSimilarity: boolean;
  query?: string;
}

export function StatementCard({ statement, showSimilarity, query }: StatementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const snippet = query
    ? buildSnippet(statement.content, query)
    : { text: statement.content.substring(0, 200) + (statement.content.length > 200 ? "..." : ""), truncated: statement.content.length > 200 };
  const displayContent = expanded ? statement.content : snippet.text;
  const isTruncated = snippet.truncated;

  return (
    <Card role="article" aria-label={`${statement.meetingTitle} - ${getKindLabel(statement.kind)}`}>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold">
              <Link
                to="/meetings/$meetingId"
                params={{ meetingId: statement.meetingId }}
                className="hover:underline"
              >
                {statement.meetingTitle}
              </Link>
            </CardTitle>
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
          <p className="text-xs leading-relaxed">
            {query ? highlightText(displayContent, query) : displayContent}
          </p>
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
        </div>
      </CardContent>
    </Card>
  );
}
