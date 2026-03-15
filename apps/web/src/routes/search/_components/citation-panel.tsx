import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";

import type { Statement } from "../_hooks/useSearch";

interface CitationPanelProps {
  citations: Statement[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onCreateDraft: () => void;
}

export function CitationPanel({
  citations,
  onRemove,
  onClear,
  onCreateDraft,
}: CitationPanelProps) {
  if (citations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground text-center">
            答弁カードの「引用する」ボタンで根拠を追加できます
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">引用リスト（{citations.length}件）</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 text-xs">
            クリア
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {citations.map((citation, index) => (
          <div
            key={citation.id}
            className="flex items-start gap-2 rounded bg-muted/50 p-2"
          >
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{citation.meetingTitle}</p>
              <p className="text-xs text-muted-foreground">{citation.heldOn}</p>
              {citation.speakerName && (
                <p className="text-xs text-muted-foreground">{citation.speakerName}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(citation.id)}
              className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-destructive"
            >
              ×
            </Button>
          </div>
        ))}
        <Button onClick={onCreateDraft} className="w-full mt-2" size="sm">
          回答案を作成
        </Button>
      </CardContent>
    </Card>
  );
}
