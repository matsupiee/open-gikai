import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { client, orpc } from "@/lib/orpc/orpc";
import { Button } from "@/shared/_components/ui/button";

export const Route = createFileRoute("/admin/scrapers/$jobId")({
  component: JobDetailPage,
});

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: job } = useQuery(
    orpc.scrapers.getJob.queryOptions({
      input: { jobId },
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status && TERMINAL_STATUSES.has(status) ? false : 2000;
      },
    })
  );

  const { data: logsData } = useQuery(
    orpc.scrapers.getJobLogs.queryOptions({
      input: { jobId, limit: 500 },
      refetchInterval: (query) => {
        if (!job) return 500;
        return TERMINAL_STATUSES.has(job.status) ? false : 500;
      },
    })
  );

  const logs = logsData?.logs ?? [];
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const cancelMutation = useMutation({
    mutationFn: () => client.scrapers.cancelJob({ jobId }),
    onSuccess: () => {
      toast.success("ジョブをキャンセルしました");
      queryClient.invalidateQueries({ queryKey: orpc.scrapers.getJob.key() });
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  if (!job) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  const isRunning = !TERMINAL_STATUSES.has(job.status);
  const progress = job.totalItems
    ? Math.round((job.processedItems / job.totalItems) * 100)
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ジョブ詳細</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {job.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              キャンセル
            </Button>
          )}
          <a
            href="/admin/scrapers"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 一覧へ
          </a>
        </div>
      </div>

      <div className="rounded border border-border bg-card p-4 grid gap-3 sm:grid-cols-2 text-sm">
        <Field label="自治体ID" value={job.municipalityId} />
        <Field label="ステータス" value={<StatusBadge status={job.status} />} />
        <Field label="挿入件数" value={job.totalInserted.toLocaleString()} />
        <Field label="スキップ件数" value={job.totalSkipped.toLocaleString()} />
        {job.totalItems !== null && (
          <Field
            label="進捗"
            value={`${job.processedItems} / ${job.totalItems} (${progress}%)`}
          />
        )}
        <Field
          label="作成日時"
          value={new Date(job.createdAt).toLocaleString("ja-JP")}
        />
        {job.startedAt && (
          <Field
            label="開始日時"
            value={new Date(job.startedAt).toLocaleString("ja-JP")}
          />
        )}
        {job.completedAt && (
          <Field
            label="完了日時"
            value={new Date(job.completedAt).toLocaleString("ja-JP")}
          />
        )}
        {job.errorMessage && (
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground mb-1">エラー</div>
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-xs font-mono">
              {job.errorMessage}
            </div>
          </div>
        )}
      </div>

      {progress !== null && isRunning && (
        <div className="rounded-full bg-muted h-2">
          <div
            className="rounded-full bg-blue-500 h-2 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="rounded border border-border bg-black">
        <div className="border-b border-zinc-800 px-4 py-2 text-xs text-zinc-400 flex items-center justify-between">
          <span>ログ ({logs.length} 件)</span>
          {isRunning && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              リアルタイム
            </span>
          )}
        </div>
        <div className="p-4 font-mono text-xs space-y-1 max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-zinc-500">ログがありません</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-3">
                <span className="text-zinc-600 shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString("ja-JP")}
                </span>
                <span
                  className={LOG_LEVEL_COLORS[log.level] ?? "text-zinc-300"}
                >
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-zinc-300 break-all">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  info: "text-zinc-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        colors[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}
