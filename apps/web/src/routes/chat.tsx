import { useCallback, useEffect, useRef, useState } from "react";

import { ChatSection, type ChatHandler, type Message, type MessagePart } from "@llamaindex/chat-ui";
import { Link, createFileRoute } from "@tanstack/react-router";

import { authClient } from "@/lib/better-auth/auth-client";
import { client } from "@/lib/orpc/orpc";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent } from "@/shared/_components/ui/card";

interface ChatSearchParams {
  q?: string;
}

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: ChatPage,
});

function ChatPage() {
  const { q } = Route.useSearch();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm">AI 検索を利用するにはサインインが必要です。</p>
            <div className="flex justify-center gap-2">
              <Button asChild size="sm">
                <Link to="/sign-in">サインイン</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/sign-up">アカウント作成</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ChatPageInner initialQuestion={q} />;
}

function ChatPageInner({ initialQuestion }: { initialQuestion: string | undefined }) {
  const handler = useAskHandler();
  const autoSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialQuestion) return;
    if (autoSentRef.current === initialQuestion) return;
    autoSentRef.current = initialQuestion;
    void handler.sendMessage({
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: initialQuestion }],
    });
  }, [initialQuestion, handler]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background">
      <ChatSection handler={handler} className="mx-auto h-full w-full max-w-3xl" />
    </div>
  );
}

function useAskHandler(): ChatHandler {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatHandler["status"]>("ready");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (msg: Message) => {
    const question = msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
    if (!question) return;

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, msg, { id: assistantId, role: "assistant", parts: [] }]);
    setStatus("submitted");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stream = await client.meetings.askStream({ question }, { signal: controller.signal });
      setStatus("streaming");

      for await (const event of stream) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            return { ...m, parts: applyStreamEvent(m.parts, event) };
          }),
        );
      }
      setStatus("ready");
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus("ready");
        return;
      }
      const message = err instanceof Error ? err.message : "通信エラーが発生しました";
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          return {
            ...m,
            parts: [...m.parts, { type: "text", text: `\n\n**エラー**: ${message}` }],
          };
        }),
      );
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(async () => {
    abortRef.current?.abort();
  }, []);

  return { messages, status, sendMessage, stop, setMessages };
}

type AskStreamEvent =
  | { type: "iteration_start"; iteration: number }
  | { type: "tool_call"; iteration: number; tool: string; args: unknown }
  | { type: "tool_result"; iteration: number; tool: string; resultSummary: string }
  | { type: "final_delta"; text: string }
  | { type: "done"; result: unknown };

function applyStreamEvent(parts: MessagePart[], event: AskStreamEvent): MessagePart[] {
  switch (event.type) {
    case "tool_call": {
      const id = `tool-${event.iteration}-${event.tool}`;
      const next = parts.filter((p) => !(p.type === "data-event" && p.id === id));
      next.push({
        id,
        type: "data-event",
        data: {
          title: toolTitle(event.tool),
          description: formatToolArgs(event.args),
          status: "pending",
        },
      });
      return next;
    }
    case "tool_result": {
      const id = `tool-${event.iteration}-${event.tool}`;
      const next = parts.filter((p) => !(p.type === "data-event" && p.id === id));
      next.push({
        id,
        type: "data-event",
        data: {
          title: toolTitle(event.tool),
          description: event.resultSummary,
          status: "success",
        },
      });
      return next;
    }
    case "final_delta": {
      const next = [...parts];
      const last = next[next.length - 1];
      if (last && last.type === "text") {
        next[next.length - 1] = { type: "text", text: last.text + event.text };
      } else {
        next.push({ type: "text", text: event.text });
      }
      return next;
    }
    case "iteration_start":
    case "done":
    default:
      return parts;
  }
}

function toolTitle(tool: string): string {
  switch (tool) {
    case "search_topics":
      return "議題を検索";
    case "get_meeting_digest":
      return "会議サマリを取得";
    case "find_meetings_with_topics":
      return "複数議題を扱う会議を検索";
    default:
      return tool;
  }
}

function formatToolArgs(args: unknown): string {
  if (typeof args !== "object" || args === null) return String(args);
  const entries = Object.entries(args as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return entries.join(" / ");
}
