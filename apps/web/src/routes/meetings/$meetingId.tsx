import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";

export const Route = createFileRoute("/meetings/$meetingId")({
  component: RouteComponent,
});

const KIND_LABEL: Record<string, string> = {
  question: "質問",
  answer: "答弁",
  remark: "発言",
  unknown: "その他",
};

const KIND_COLOR: Record<string, string> = {
  question: "bg-blue-100 text-blue-800",
  answer: "bg-green-100 text-green-800",
  remark: "bg-gray-100 text-gray-800",
  unknown: "bg-gray-100 text-gray-600",
};

function RouteComponent() {
  const { meetingId } = Route.useParams();

  const { data, isLoading } = useQuery(
    orpc.meetings.statements.queryOptions({ input: { meetingId } })
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/4 mb-3" />
            <div className="h-3 bg-muted rounded w-full mb-2" />
            <div className="h-3 bg-muted rounded w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-muted-foreground">会議が見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link to="/meetings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="h-4 w-4" />
            会議一覧に戻る
          </Link>

          <h1 className="text-xl font-bold mb-2">{data.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{data.heldOn}</span>
            <span>•</span>
            <span>{data.prefecture} {data.municipality}</span>
            <span>•</span>
            <Badge variant="outline" className="text-xs">{data.meetingType}</Badge>
            {data.sourceUrl && (
              <>
                <span>•</span>
                <a
                  href={data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs"
                >
                  元の議事録を見る
                </a>
              </>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-4">
          {data.statements.length} 件の発言
        </div>

        {data.statements.length === 0 && (
          <div className="rounded border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">発言が登録されていません</p>
          </div>
        )}

        <div className="space-y-3">
          {data.statements.map((statement) => (
            <StatementCard key={statement.id} statement={statement} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface StatementCardProps {
  statement: {
    id: string;
    kind: string;
    speakerName: string | null;
    speakerRole: string | null;
    content: string;
  };
}

function StatementCard({ statement }: StatementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isTruncated = statement.content.length > 300;
  const displayContent =
    expanded || !isTruncated ? statement.content : statement.content.substring(0, 300) + "...";

  const kindLabel = KIND_LABEL[statement.kind] ?? statement.kind;
  const kindColor = KIND_COLOR[statement.kind] ?? KIND_COLOR.unknown;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {statement.speakerName && (
              <CardTitle className="text-sm font-semibold">{statement.speakerName}</CardTitle>
            )}
            {statement.speakerRole && (
              <span className="text-xs text-muted-foreground">{statement.speakerRole}</span>
            )}
          </div>
          <Badge className={`shrink-0 text-xs ${kindColor}`}>{kindLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed whitespace-pre-line">{displayContent}</p>
        {isTruncated && (
          <Button
            variant="link"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-auto p-0 text-xs mt-2 justify-start"
          >
            {expanded ? "非表示" : "続きを見る"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
