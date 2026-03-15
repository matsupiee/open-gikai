import { useState } from "react";

import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";
import { Textarea } from "@/shared/_components/ui/textarea";

import type { Statement } from "../_hooks/useSearch";

interface DraftAnswerWorkspaceProps {
  citations: Statement[];
  onClose: () => void;
}

export function DraftAnswerWorkspace({ citations, onClose }: DraftAnswerWorkspaceProps) {
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const citationText = citations
      .map(
        (c, i) =>
          `[${i + 1}] ${c.meetingTitle} (${c.heldOn}${c.speakerName ? ` • ${c.speakerName}` : ""})\n「${c.content.substring(0, 100)}...」`
      )
      .join("\n\n");

    const fullText = draftText
      ? `${draftText}\n\n---\n根拠:\n${citationText}`
      : citationText;

    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">STEP 3: 回答案の作成</h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
          閉じる
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">引用した根拠</h3>
        <div className="flex flex-col gap-2">
          {citations.map((citation, index) => (
            <div key={citation.id} className="rounded bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{citation.meetingTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {citation.heldOn}
                    {citation.speakerName ? ` • ${citation.speakerName}` : ""}
                    {citation.municipality ? ` • ${citation.municipality}` : ""}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed">
                    「{citation.content.substring(0, 150)}
                    {citation.content.length > 150 ? "..." : ""}」
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium">回答案テキスト</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={`根拠[1][2]をもとに回答案を入力してください。\n例：「[1]の答弁によれば...」`}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="min-h-32 text-xs"
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleCopy} variant="outline" size="sm" className="flex-1">
          {copied ? "コピーしました" : "引用付きでコピー"}
        </Button>
      </div>
    </div>
  );
}
